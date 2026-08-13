import * as React from "react";

import { cn } from "@/lib/utils";

// Loading placeholder block. Uses the muted token so it reads correctly in both
// themes, and a gentle pulse so a slow load (e.g. a Neon cold-start) looks
// intentional rather than frozen. Decorative — hidden from assistive tech.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
