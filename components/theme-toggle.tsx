"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

// Toggles the `dark` class on <html> and persists the choice. The initial theme
// is applied before paint by the inline script in app/layout.tsx — keep the
// storage key ('tikas-theme') in sync with it. Which icon shows is driven purely
// by CSS (`dark:` variant), so this needs no React state.
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("tikas-theme", next ? "dark" : "light");
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className={className}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
