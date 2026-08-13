import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

// Inline, recoverable error notice for a failed data fetch — e.g. a day-switch
// query that errored, so the surface shows a clear "couldn't load" instead of a
// misleading empty state. Same destructive treatment as the coach error bubble
// and the page error boundary; the retry action uses the teal accent.
export function InlineError({
  message = "Couldn't load this. Check your connection and try again.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground",
        className,
      )}
    >
      <TriangleAlert className="size-4 shrink-0 text-destructive" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium text-primary transition-opacity hover:opacity-80"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
