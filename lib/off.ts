import { z } from "zod";

/**
 * Open Food Facts integration (server-only). Real, sourced nutrition for two
 * callers: the manual food-search box on /nutrition and Vita's agentic logging.
 *
 * Why Search-a-licious and not the v2 API: full-text *name* search isn't in the
 * v2 API (it's structured/filter-only). Search-a-licious
 * (search.openfoodfacts.org/search) is the supported name-search endpoint and
 * returns nutriments on a per-100g basis — which is all it indexes, so there's
 * no serving size here; callers normalize from 100g.
 *
 * Hard rules baked in below:
 *  - Always send a descriptive User-Agent; anonymous requests get throttled.
 *  - Never trust the HTTP status alone — parse the body and require real
 *    products with usable calories before returning anything.
 *  - Handle rate-limiting / downtime gracefully (typed OffError; Vita degrades
 *    to its own estimate rather than failing the log).
 */

const SEARCH_URL = "https://search.openfoodfacts.org/search";

// Identifies the app to OFF (required — anonymous traffic is rate-limited as
// abusive crawling). Contact points at the deployed app.
const USER_AGENT = "Tikas/1.0 (+https://tikas-navy.vercel.app)";

const REQUEST_TIMEOUT_MS = 8000;

export type OffErrorReason = "rate_limited" | "unavailable";

/** Thrown by searchFoods on a failed lookup. Vita's resolve path swallows it. */
export class OffError extends Error {
  reason: OffErrorReason;
  constructor(reason: OffErrorReason, message: string) {
    super(message);
    this.name = "OffError";
    this.reason = reason;
  }
}

/**
 * A matched product. Macros are per 100 g / 100 ml — the basis the search index
 * exposes. `code` is the OFF barcode (stable, used as a list key).
 */
export type OffProduct = {
  code: string;
  name: string;
  brand: string | null;
  // Per-100g basis. Calories is always present (products without it are dropped);
  // macros default to 0 when OFF has no value.
  per100g: { calories: number; protein: number; carbs: number; fat: number };
};

// Zod shape for the slice of the Search-a-licious response we consume. Numbers
// may be absent (many products lack full nutriment data); null is tolerated and
// normalized away. `.passthrough()` keeps us from choking on the many other keys.
const nutrimentsSchema = z
  .object({
    "energy-kcal_100g": z.number().nullish(),
    proteins_100g: z.number().nullish(),
    carbohydrates_100g: z.number().nullish(),
    fat_100g: z.number().nullish(),
  })
  .passthrough();

const hitSchema = z
  .object({
    code: z.union([z.string(), z.number()]).nullish(),
    product_name: z.string().nullish(),
    brands: z.union([z.string(), z.array(z.string())]).nullish(),
    nutriments: nutrimentsSchema.nullish(),
  })
  .passthrough();

const searchResponseSchema = z
  .object({
    count: z.number().nullish(),
    hits: z.array(hitSchema).default([]),
  })
  .passthrough();

const finite = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

const nonNeg = (n: number | null | undefined): number => {
  const v = finite(n);
  return v !== null && v >= 0 ? v : 0;
};

function firstBrand(brands: string | string[] | null | undefined): string | null {
  if (!brands) return null;
  const b = Array.isArray(brands) ? brands[0] : brands.split(",")[0];
  const trimmed = b?.trim();
  return trimmed ? trimmed : null;
}

// Map a validated hit to an OffProduct, or null when it lacks the essentials
// (a name and real calories). Dropping calorie-less hits is what keeps us from
// surfacing/logging empty nutrition.
function toProduct(hit: z.infer<typeof hitSchema>): OffProduct | null {
  const name = hit.product_name?.trim();
  if (!name) return null;

  const calories = finite(hit.nutriments?.["energy-kcal_100g"]);
  if (calories === null || calories < 0) return null;

  const code = hit.code != null ? String(hit.code) : "";

  return {
    code: code || name, // fall back to name for a stable-enough list key
    name,
    brand: firstBrand(hit.brands),
    per100g: {
      calories,
      protein: nonNeg(hit.nutriments?.proteins_100g),
      carbs: nonNeg(hit.nutriments?.carbohydrates_100g),
      fat: nonNeg(hit.nutriments?.fat_100g),
    },
  };
}

/**
 * Search Open Food Facts by food name. Returns up to `limit` products that have
 * usable calorie data, most-relevant first (OFF's own ranking). Throws OffError
 * on rate-limiting or downtime — never on a plain "no results" (that's `[]`).
 */
export async function searchFoods(
  query: string,
  limit = 8,
): Promise<OffProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", q);
  // Over-fetch a little: many hits get dropped for missing calories.
  url.searchParams.set("page_size", String(Math.min(limit * 3, 25)));
  url.searchParams.set(
    "fields",
    "code,product_name,brands,nutriments",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      // Cache identical queries server-side for an hour to ease rate limits.
      next: { revalidate: 3600 },
    });
  } catch (err) {
    throw new OffError(
      "unavailable",
      err instanceof Error ? err.message : "Network error",
    );
  } finally {
    clearTimeout(timeout);
  }

  // 429/503 are OFF's rate-limit / downtime signals. Treat any non-2xx as a
  // failure — but crucially, a 2xx is NOT trusted on its own; we still validate
  // the body below.
  if (res.status === 429 || res.status === 503) {
    throw new OffError("rate_limited", `Rate limited (${res.status})`);
  }
  if (!res.ok) {
    throw new OffError("unavailable", `Unexpected status ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new OffError("unavailable", "Malformed response");
  }

  const parsed = searchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new OffError("unavailable", "Unexpected response shape");
  }

  const products: OffProduct[] = [];
  for (const hit of parsed.data.hits) {
    const p = toProduct(hit);
    if (p) products.push(p);
    if (products.length >= limit) break;
  }
  return products;
}

// --- Vita auto-resolution -------------------------------------------------

// Generic descriptors that qualify a food without identifying it. Dropped from
// the relevance check so "plain greek yogurt" still matches "Greek Yogurt",
// while identifying words (a dish name, an ingredient) are never dropped.
const QUALIFIERS = new Set([
  "plain",
  "fresh",
  "raw",
  "cooked",
  "organic",
  "natural",
  "homemade",
  "whole",
  "the",
  "and",
  "with",
]);

// Significant word tokens for the relevance check: drops short/noise words and
// generic qualifiers, keeping only tokens that actually identify the food.
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !QUALIFIERS.has(t));
}

/**
 * Is `name` a plausible match for `query`? Requires every significant query
 * token to appear in the product name. Deliberately strict: for automatic
 * resolution (no human picking from a list), a wrong match logs wrong data, so
 * we'd rather fall back to Vita's labeled estimate. This is what makes local
 * dishes OFF doesn't cleanly carry (e.g. "sinigang na baboy" → "Sinigang") fall
 * through instead of grabbing a mismatched product.
 */
function isRelevant(query: string, name: string): boolean {
  const q = tokens(query);
  if (q.length === 0) return false;
  const n = name.toLowerCase();
  return q.every((t) => n.includes(t));
}

export type ResolvedNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  product: OffProduct;
};

/**
 * Resolve real nutrition for `name` scaled to `grams`, for Vita's proposal.
 * Returns null on any miss — no relevant match, no calorie data, OFF
 * unavailable — so the caller cleanly falls back to the model's estimate.
 * Never throws.
 */
export async function resolveFoodNutrition(
  name: string,
  grams: number,
): Promise<ResolvedNutrition | null> {
  if (!Number.isFinite(grams) || grams <= 0) return null;

  // Search on the identifying tokens only. The model's food name often carries
  // qualifiers/punctuation ("Chobani Greek yogurt, plain") that skew full-text
  // ranking away from the real product; the cleaned query keeps the match near
  // the top where our scan can find it.
  const cleaned = tokens(name).join(" ") || name.trim();

  let products: OffProduct[];
  try {
    products = await searchFoods(cleaned, 5);
  } catch {
    return null; // OFF down / throttled → estimate, never block logging
  }

  const match = products.find((p) => isRelevant(name, p.name));
  if (!match) return null;

  // Scale per-100g to the eaten amount, rounded to one decimal so the proposal
  // fields read cleanly (74 kcal/100g × 1.5 → 111, not 111.00000001).
  const factor = grams / 100;
  const scale = (per100: number) => Math.round(per100 * factor * 10) / 10;
  return {
    calories: scale(match.per100g.calories),
    protein: scale(match.per100g.protein),
    carbs: scale(match.per100g.carbs),
    fat: scale(match.per100g.fat),
    product: match,
  };
}
