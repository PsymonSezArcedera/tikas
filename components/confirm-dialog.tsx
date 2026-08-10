"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

// Small on-brand confirm, shared by the logging and workout CRUD. Destructive by
// default (delete flows); the caller supplies the description and can override
// the title/labels. Keeps the dialog open with a pending state until the mutation
// settles, showing an inline error on failure.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
  title = "Delete entry?",
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle className="font-display text-lg font-semibold tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          {description}
        </DialogDescription>

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-9"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
