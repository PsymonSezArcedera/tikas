"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

// A right-side sheet/drawer built on Base UI's Dialog (the app's primitive base
// is Base UI, not Radix). It brings focus trap, scroll lock, Escape, and
// click-outside for free; enter/exit animate off the data-[starting/ending-style]
// attributes Base UI sets. Full-width on mobile (a sheet), ~28rem on desktop.

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

export function SheetContent({
  className,
  children,
  keepMounted,
  ...props
}: React.ComponentProps<typeof Dialog.Popup> & { keepMounted?: boolean }) {
  return (
    <Dialog.Portal keepMounted={keepMounted}>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <Dialog.Popup
        // h-dvh (not inset-y-0) so the mobile keyboard can shrink it — see the
        // interactiveWidget viewport hint in app/layout.tsx.
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-border bg-popover text-popover-foreground shadow-2xl outline-none",
          "transition-transform duration-300 ease-out",
          "data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
          className,
        )}
        {...props}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
