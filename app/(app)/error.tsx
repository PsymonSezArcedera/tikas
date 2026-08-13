"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Error boundary for every authenticated page. A data page throwing (e.g. Neon
// unreachable / a cold-start that times out) lands here instead of Next's raw
// error screen. `retry` (Next 16) re-fetches and re-renders the segment — most
// of these failures are transient, so trying again usually recovers.
export default function AppError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void; // legacy fallback for older Next; retry is primary in 16.3
}) {
  React.useEffect(() => {
    console.error("[app] page render error:", error);
  }, [error]);

  const recover = retry ?? reset;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md items-center gap-4 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load this page. The connection may have hiccuped —
            give it a moment and try again.
          </p>
        </div>
        {recover ? (
          <Button onClick={() => recover()} className="h-10">
            Try again
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
