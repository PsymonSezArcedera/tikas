"use client";

import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Dumbbell,
  Salad,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { CoachId } from "@/lib/ai/coaches";
import { SOURCE_LABEL, type FoodSource } from "@/lib/food-summary";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type CoachProps = {
  coachId: CoachId;
  coachName: string;
  coachTitle: string;
  initialSessionId: string | null;
  initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string }[];
};

// Per-coach presentation. Icons are components, so they can't cross the
// server→client prop boundary — the page passes coachId/name/title and this
// client map supplies the icon, empty-state hint, and disclaimer noun.
const COACH_UI: Record<
  CoachId,
  { icon: LucideIcon; intro: string; guidance: string }
> = {
  FORTIS: {
    icon: Dumbbell,
    intro: "Ask about training, exercise form, or how to structure your week.",
    guidance: "training guidance",
  },
  VITA: {
    icon: Salad,
    intro: "Ask about calories, macros, meals, or building better eating habits.",
    guidance: "nutrition guidance",
  },
  LUX: {
    icon: Sparkles,
    intro: "Ask about sleep, recovery, stress, motivation, or building habits.",
    guidance: "wellness guidance",
  },
};

// A food-log proposal from Vita's logFood tool — validated server-side, shown
// here for the user to confirm or correct before it's written.
export type FoodProposal = {
  foodName: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  quantity: number;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: FoodSource;
};

export type ConfirmProposal = (
  proposal: FoodProposal,
) => Promise<{ ok: boolean; message: string }>;

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  streaming?: boolean;
  error?: boolean;
  proposal?: FoodProposal;
};

let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${tmpCounter++}`;

export function CoachChat({
  coachId,
  coachName,
  coachTitle,
  initialSessionId,
  initialMessages,
  headerAction,
  onConfirmProposal,
}: CoachProps & {
  headerAction?: React.ReactNode;
  onConfirmProposal?: ConfirmProposal;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(
    initialSessionId,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ui = COACH_UI[coachId];
  const CoachIcon = ui.icon;

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Keep the transcript pinned to the latest message / streamed token.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function patchLast(patch: Partial<ChatMessage>) {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
      return copy;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: tmpId(), role: "USER", content: text },
      { id: tmpId(), role: "ASSISTANT", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coach: coachId,
          message: text,
          sessionId: sessionId ?? undefined,
        }),
      });

      const sid = res.headers.get("X-Session-Id");
      if (sid) setSessionId(sid);

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || "Request failed");
      }

      // Vita proposed a food log — render the confirm card instead of streaming.
      if (res.headers.get("X-Coach-Response") === "proposal") {
        const data = (await res.json()) as { say: string; proposal: FoodProposal };
        patchLast({
          streaming: false,
          content: data.say,
          proposal: data.proposal,
        });
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        patchLast({ content: acc });
      }
      patchLast({ streaming: false });
    } catch (err) {
      console.error(err);
      patchLast({
        streaming: false,
        error: true,
        content:
          "Sorry — I couldn't finish that response. Please try again.",
      });
      setError("Something went wrong reaching the coach.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CoachIcon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold leading-tight tracking-tight">
            {coachName}
          </p>
          <p className="text-xs text-muted-foreground">{coachTitle}</p>
        </div>
        {headerAction}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CoachIcon className="size-6" />
            </span>
            <p className="text-sm font-medium">Chat with {coachName}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {ui.intro}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) =>
              m.proposal ? (
                <ProposalMessage
                  key={m.id}
                  say={m.content}
                  proposal={m.proposal}
                  coachName={coachName}
                  onConfirm={onConfirmProposal}
                />
              ) : (
                <MessageBubble key={m.id} message={m} coachName={coachName} />
              ),
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-center gap-2 border-t border-border bg-secondary/30 px-5 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0" />
        <span>
          {coachName} gives {ui.guidance}, not medical advice. For pain,
          injuries, or health conditions, see a qualified professional.
        </span>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        {error && (
          <p className="mb-2 px-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message ${coachName}…`}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30"
          />
          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Persistent chat trigger + drawer. A floating action button (bottom-right)
 * opens the coach in a right-side sheet (full-height on mobile). keepMounted
 * keeps the CoachChat alive across open/close so an in-session conversation
 * isn't lost. The coach shown follows coachId — the page passes the right one.
 */
export function CoachChatDrawer(
  props: CoachProps & { onConfirmProposal?: ConfirmProposal },
) {
  const CoachIcon = COACH_UI[props.coachId].icon;
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Chat with ${props.coachName}`}
        className="fixed bottom-5 right-5 z-40 inline-flex size-14 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 outline-none transition hover:brightness-110 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-auto sm:px-5 sm:py-3.5"
      >
        <CoachIcon className="size-5.5 sm:size-5" />
        <span className="hidden text-sm font-medium sm:inline">
          Ask {props.coachName}
        </span>
      </SheetTrigger>
      <SheetContent keepMounted>
        <SheetTitle className="sr-only">Chat with {props.coachName}</SheetTitle>
        <CoachChat
          {...props}
          headerAction={
            <SheetClose
              aria-label="Close chat"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <X className="size-4" />
            </SheetClose>
          }
        />
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  message,
  coachName,
}: {
  message: ChatMessage;
  coachName: string;
}) {
  const isUser = message.role === "USER";
  // User text and the error notice stay plain; a coach reply renders Markdown.
  const plain = isUser || message.error;
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.error
              ? "border border-destructive/40 bg-destructive/10 text-foreground"
              : "bg-secondary text-foreground",
        )}
      >
        {!isUser && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {coachName}
          </p>
        )}
        {plain ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <CoachMarkdown content={message.content} />
        )}
        {message.streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current align-middle" />
        )}
      </div>
    </div>
  );
}

// Assistant replies come back as Markdown. react-markdown re-parses on every
// content change, so partial Markdown renders live as tokens stream in. Raw
// HTML is not enabled, so model output can't inject markup. Styling is applied
// via child selectors to keep it to the app's theme.
const MARKDOWN_CLASS = cn(
  "min-w-0 leading-relaxed",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_li]:pl-0.5 [&_li>ul]:mt-1 [&_li>ol]:mt-1 [&_li>p]:my-0",
  "[&_h1]:font-display [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:font-display [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:font-display [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:font-semibold",
  "[&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background/60 [&_pre]:p-3 [&_pre]:text-xs",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
);

const CoachMarkdown = React.memo(function CoachMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className={MARKDOWN_CLASS}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
});

const MEAL_TYPES: FoodProposal["mealType"][] = [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
];

type ProposalStatus = "idle" | "saving" | "logged" | "declined" | "error";

// Vita's food-log proposal: an editable confirm card. Nothing is written until
// the user hits Confirm — that routes through onConfirm (the food-logging Server
// Action). The values are pre-filled from the model's estimate and fully editable
// so the user can correct a bad guess before it's saved.
function ProposalMessage({
  say,
  proposal,
  coachName,
  onConfirm,
}: {
  say: string;
  proposal: FoodProposal;
  coachName: string;
  onConfirm?: ConfirmProposal;
}) {
  const [draft, setDraft] = React.useState<FoodProposal>(proposal);
  const [status, setStatus] = React.useState<ProposalStatus>("idle");
  const [note, setNote] = React.useState("");

  const locked = status === "saving" || status === "logged" || status === "declined";

  function setNum(key: keyof FoodProposal, raw: string) {
    const n = Number(raw);
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  async function confirm() {
    if (!onConfirm) return;
    setStatus("saving");
    setNote("");
    try {
      const res = await onConfirm(draft);
      if (res.ok) {
        setStatus("logged");
        setNote(res.message);
      } else {
        setStatus("error");
        setNote(res.message);
      }
    } catch {
      setStatus("error");
      setNote("Something went wrong logging that. Please try again.");
    }
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {coachName}
        </p>
        {/* Vita says the nutrition conversationally; the card below is just the
            editable fields. The source label stays honest, keyed off the
            structured source so it can become "Open Food Facts" later. */}
        <p className="mb-1 whitespace-pre-wrap">{say}</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {SOURCE_LABEL[proposal.source]}
        </p>

        <div className="rounded-xl border border-border bg-background/50 p-3">
          <label className="block text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Food
          </label>
          <input
            type="text"
            value={draft.foodName}
            disabled={locked}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, foodName: e.target.value }))
            }
            className={PROPOSAL_INPUT}
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className={PROPOSAL_LABEL}>Meal</label>
              <select
                value={draft.mealType}
                disabled={locked}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    mealType: e.target.value as FoodProposal["mealType"],
                  }))
                }
                className={PROPOSAL_INPUT}
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={PROPOSAL_LABEL}>Servings</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.quantity}
                disabled={locked}
                onChange={(e) => setNum("quantity", e.target.value)}
                className={PROPOSAL_INPUT}
              />
            </div>
            <div>
              <label className={PROPOSAL_LABEL}>Serving size</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.servingSize}
                disabled={locked}
                onChange={(e) => setNum("servingSize", e.target.value)}
                className={PROPOSAL_INPUT}
              />
            </div>
            <div>
              <label className={PROPOSAL_LABEL}>Unit</label>
              <input
                type="text"
                value={draft.servingUnit}
                disabled={locked}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, servingUnit: e.target.value }))
                }
                className={PROPOSAL_INPUT}
              />
            </div>
          </div>

          <div className="mt-2">
            <label className={PROPOSAL_LABEL}>Calories</label>
            <input
              type="number"
              inputMode="decimal"
              value={draft.calories}
              disabled={locked}
              onChange={(e) => setNum("calories", e.target.value)}
              className={PROPOSAL_INPUT}
            />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <label className={PROPOSAL_LABEL}>Protein (g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.protein}
                disabled={locked}
                onChange={(e) => setNum("protein", e.target.value)}
                className={PROPOSAL_INPUT}
              />
            </div>
            <div>
              <label className={PROPOSAL_LABEL}>Carbs (g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.carbs}
                disabled={locked}
                onChange={(e) => setNum("carbs", e.target.value)}
                className={PROPOSAL_INPUT}
              />
            </div>
            <div>
              <label className={PROPOSAL_LABEL}>Fat (g)</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.fat}
                disabled={locked}
                onChange={(e) => setNum("fat", e.target.value)}
                className={PROPOSAL_INPUT}
              />
            </div>
          </div>
        </div>

        {/* Actions / outcome */}
        {status === "logged" ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" />
            {note || "Logged to your diary."}
          </p>
        ) : status === "declined" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Okay — nothing logged.
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={() => void confirm()}
                disabled={status === "saving" || !onConfirm}
              >
                {status === "saving" ? "Logging…" : "Confirm & log"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setStatus("declined")}
                disabled={status === "saving"}
              >
                Decline
              </Button>
            </div>
            {status === "error" && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {note}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PROPOSAL_LABEL =
  "block text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground";
const PROPOSAL_INPUT =
  "mt-0.5 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70 dark:bg-input/30";
