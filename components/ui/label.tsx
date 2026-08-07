import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        // Editorial field-label treatment: small, uppercase, letter-spaced.
        "flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground leading-none select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
