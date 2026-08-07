import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* The amber corner glow + grain come from the global atmosphere. */}
      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          AI-powered fitness companion
        </span>
        <h1 className="max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Build strength you can see.
        </h1>
        <p className="mt-4 max-w-md text-balance text-muted-foreground">
          Track workouts, calories, and progress — with three AI coaches for
          strength, nutrition, and wellness.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "lg", className: "h-11 px-6 text-[0.95rem]" })}
          >
            Get started
            <ArrowRight />
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({
              size: "lg",
              variant: "outline",
              className: "h-11 px-6 text-[0.95rem]",
            })}
          >
            I have an account
          </Link>
        </div>
      </main>

      <footer className="relative px-6 py-6 text-center text-xs text-muted-foreground">
        Tikas — from the Tagalog <em>matikas</em>, an upright, athletic bearing.
      </footer>
    </div>
  );
}
