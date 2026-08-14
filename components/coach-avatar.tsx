import type { CoachId } from "@/lib/ai/coaches";
import { cn } from "@/lib/utils";

/**
 * The coaches' visual identity — a distinct, abstract geometric mark per coach
 * (deliberately NOT a face: they're AI personas, so a human photo would be
 * uncanny and dishonest). Each has its own geometric language, all in the teal
 * palette so they read as one family:
 *   Fortis (strength)   — ascending bars, angular, upward progression
 *   Vita   (nutrition)  — a leaf, organic and rounded
 *   Lux    (wellness)   — a radiant sun, soft and calm
 * Each also gets a subtly different tile finish (solid / outlined / gradient) so
 * the three feel like distinct characters. Used in the marketing coaches
 * section and in the in-app chat header so identity stays consistent.
 */

const TILE: Record<CoachId, string> = {
  FORTIS: "bg-primary text-primary-foreground",
  VITA: "border border-primary/25 bg-primary/10 text-primary",
  LUX: "bg-gradient-to-br from-primary/30 to-primary/5 text-primary ring-1 ring-inset ring-primary/15",
};

function Glyph({ coach }: { coach: CoachId }) {
  if (coach === "FORTIS") {
    // Ascending bars — strength as steady, upward progression.
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[56%]" aria-hidden>
        <rect x="4" y="13" width="3.6" height="7" rx="1.3" />
        <rect x="10.2" y="9" width="3.6" height="11" rx="1.3" />
        <rect x="16.4" y="4" width="3.6" height="16" rx="1.3" />
      </svg>
    );
  }
  if (coach === "VITA") {
    // A leaf with a center vein — growth and nourishment.
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[58%]"
        aria-hidden
      >
        <path d="M12 3.5C8 7 7.4 14.5 12 20.5C16.6 14.5 16 7 12 3.5Z" />
        <path d="M12 7.5V18.5" />
      </svg>
    );
  }
  // Lux — a radiant sun: calm, light, recovery.
  return (
    <svg viewBox="0 0 24 24" className="size-[62%]" aria-hidden>
      <circle cx="12" cy="12" r="3.3" fill="currentColor" />
      <g
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M12 3v2.3" />
        <path d="M12 18.7V21" />
        <path d="M3 12h2.3" />
        <path d="M18.7 12H21" />
        <path d="m5.6 5.6 1.6 1.6" />
        <path d="m16.8 16.8 1.6 1.6" />
        <path d="m5.6 18.4 1.6-1.6" />
        <path d="m16.8 7.2 1.6-1.6" />
      </g>
    </svg>
  );
}

export function CoachAvatar({
  coach,
  className,
}: {
  coach: CoachId;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[28%]",
        TILE[coach],
        className,
      )}
      aria-hidden
    >
      <Glyph coach={coach} />
    </span>
  );
}
