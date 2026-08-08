"use client";

import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dumbbell, Send, ShieldAlert } from "lucide-react";

import type { CoachId } from "@/lib/ai/coaches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  streaming?: boolean;
  error?: boolean;
};

let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${tmpCounter++}`;

export function CoachChat({
  coachId,
  coachName,
  coachTitle,
  initialSessionId,
  initialMessages,
}: {
  coachId: CoachId;
  coachName: string;
  coachTitle: string;
  initialSessionId: string | null;
  initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string }[];
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(
    initialSessionId,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || "Request failed");
      }

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
    <Card className="flex h-[34rem] flex-col gap-0 overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Dumbbell className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-tight tracking-tight">
            {coachName}
          </p>
          <p className="text-xs text-muted-foreground">{coachTitle}</p>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Dumbbell className="size-6" />
            </span>
            <p className="text-sm font-medium">Chat with {coachName}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Ask about training, exercise form, or how to structure your week.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} coachName={coachName} />
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-center gap-2 border-t border-border bg-secondary/30 px-5 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0" />
        <span>
          {coachName} gives training guidance, not medical advice. For pain,
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
    </Card>
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
