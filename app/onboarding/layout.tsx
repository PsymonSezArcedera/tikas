import Link from "next/link";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-20">
      {/* Glow + grain come from the global atmosphere. */}
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative w-full max-w-xl">{children}</main>
    </div>
  );
}
