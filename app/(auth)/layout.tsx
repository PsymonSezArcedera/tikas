import Link from "next/link";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Ember glow — the one accent, kept subtle behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />

      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative w-full max-w-sm">{children}</main>
    </div>
  );
}
