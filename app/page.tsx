import Link from "next/link";
import { ArrowRight, BarChart3, Check, Dumbbell, Salad } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { CoachId } from "@/lib/ai/coaches";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { CoachAvatar } from "@/components/coach-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import {
  AnalyticsMock,
  ChatMock,
  DashboardMock,
  HeroChatMock,
  ProductFrame,
  WorkoutMock,
} from "@/components/landing/mocks";

const ctaPrimary = buttonVariants({
  size: "lg",
  className: "h-11 px-6 text-[0.95rem]",
});
const ctaOutline = buttonVariants({
  size: "lg",
  variant: "outline",
  className: "h-11 px-6 text-[0.95rem]",
});

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <Coaches />
        <ClosingCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------- header --------------------------------- */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "sm", className: "px-3.5" })}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------- hero ---------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Asymmetric accent glow, top-right — complements the global top-left glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 -z-10 hidden size-[36rem] rounded-full opacity-60 lg:block"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--brand) 16%, transparent), transparent 65%)",
        }}
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 sm:px-8 lg:grid-cols-[1fr_1.08fr] lg:gap-10 lg:pb-28 lg:pt-24">
        {/* Copy — left aligned, not centered. */}
        <div className="flex max-w-xl flex-col items-start">
          <h1 className="fade-rise text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Build strength you can&nbsp;see.
          </h1>
          <p className="fade-rise fade-rise-1 mt-6 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Track your training, food, and progress — then talk it through with
            Fortis, Vita, and Lux, three AI coaches for strength, nutrition, and
            wellness.
          </p>
          <div className="fade-rise fade-rise-2 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className={ctaPrimary}>
              Get started
              <ArrowRight />
            </Link>
            <Link href="/sign-in" className={ctaOutline}>
              Sign in
            </Link>
          </div>
          <p className="fade-rise fade-rise-3 mt-5 text-xs text-muted-foreground">
            Free to start · No equipment required
          </p>
        </div>

        {/* Layered product: the coach chat leads (so the AI is unmissable), with
            the tracking dashboard peeking behind it on desktop. */}
        <div className="fade-rise fade-rise-2 relative mx-auto w-full max-w-xl lg:-mr-6">
          <div className="pointer-events-none absolute -top-8 right-0 hidden w-[68%] rotate-[2deg] lg:block">
            <ProductFrame label="tikas.app/dashboard" glow={false}>
              <DashboardMock />
            </ProductFrame>
          </div>
          <div className="relative z-10 lg:mr-16 lg:mt-24">
            <ProductFrame label="tikas.app/coach">
              <HeroChatMock />
            </ProductFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- features -------------------------------- */

type Feature = {
  label: string;
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
  frameLabel: string;
  mock: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    label: "Tracking & analytics",
    icon: BarChart3,
    title: "Every trend, at a glance",
    body: "Log your weight, body measurements, and meals — then watch the charts tell the story. Weight, BMI, calories, and macros, rendered clean.",
    points: [
      "Weight & body-measurement history",
      "Calorie and macro breakdowns",
      "Streaks that keep you honest",
    ],
    frameLabel: "tikas.app/analytics",
    mock: <AnalyticsMock />,
  },
  {
    label: "Workout planner",
    icon: Dumbbell,
    title: "Plans that progress with you",
    body: "Fortis builds a plan around your goals and equipment. Log each lift and your PRs surface automatically, with progression you can actually see.",
    points: [
      "AI-generated, editable training plans",
      "Per-exercise PR tracking",
      "Progression charts for every lift",
    ],
    frameLabel: "tikas.app/workout",
    mock: <WorkoutMock />,
  },
  {
    label: "Agentic nutrition",
    icon: Salad,
    title: "Just tell Vita what you ate",
    body: "Describe your meal in plain words. Vita resolves real nutrition data, proposes the entry, and logs it once you confirm — no forms, no fuss.",
    points: [
      "Conversational food logging",
      "Real data from Open Food Facts",
      "You confirm before anything is saved",
    ],
    frameLabel: "tikas.app/nutrition",
    mock: <ChatMock />,
  },
];

function Features() {
  return (
    <section
      id="features"
      className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-24 px-6 py-24 sm:px-8 lg:gap-32 lg:py-28"
    >
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        const reversed = i % 2 === 1;
        return (
          <div
            key={f.title}
            className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            {/* Copy */}
            <Reveal className={cn(reversed && "lg:order-2 lg:pl-4")}>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Icon className="size-4" />
                {f.label}
              </span>
              <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {f.title}
              </h2>
              <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
                {f.body}
              </p>
              <ul className="mt-6 flex flex-col gap-2.5">
                {f.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Check className="size-3" />
                    </span>
                    <span className="text-foreground/90">{p}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Frame */}
            <Reveal
              delay={120}
              className={cn(reversed && "lg:order-1")}
            >
              <ProductFrame label={f.frameLabel}>{f.mock}</ProductFrame>
            </Reveal>
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------- coaches -------------------------------- */

type Coach = {
  id: CoachId;
  name: string;
  role: string;
  blurb: string;
  line: string;
};

const COACHES: Coach[] = [
  {
    id: "FORTIS",
    name: "Fortis",
    role: "Strength",
    blurb:
      "Programs your training, dials in volume and intensity, and keeps your lifts progressing.",
    line: "“Add 2.5kg to your top set this week.”",
  },
  {
    id: "VITA",
    name: "Vita",
    role: "Nutrition",
    blurb:
      "Logs your meals from plain language, balances your macros, and answers the food questions.",
    line: "“That's 48g of protein — right on target.”",
  },
  {
    id: "LUX",
    name: "Lux",
    role: "Wellness",
    blurb:
      "Guides sleep, recovery, stress, and the habits that make the rest of it actually stick.",
    line: "“Let's protect your recovery tonight.”",
  },
];

function Coaches() {
  return (
    <section
      id="coaches"
      className="relative scroll-mt-20 overflow-hidden border-y border-border/60 bg-secondary/20"
    >
      {/* Centered ambient glow for the section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[28rem] w-[42rem] -translate-x-1/2 opacity-50"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 0%, color-mix(in oklch, var(--brand) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Specialized coaching, always on call
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Not one generic bot — three focused coaches, each an expert in their
            domain, that hand off to each other as your questions cross over.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COACHES.map((c, i) => {
            return (
              <Reveal key={c.name} delay={i * 110}>
                <div className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--card-shadow)] transition-shadow duration-300 hover:shadow-[var(--card-shadow-hover)]">
                  <div className="flex items-center gap-3.5">
                    <CoachAvatar
                      coach={c.id}
                      className="size-12 transition-transform duration-300 group-hover:-translate-y-0.5"
                    />
                    <div className="flex flex-col">
                      <span className="font-display text-lg font-semibold leading-tight tracking-tight">
                        {c.name}
                      </span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {c.role}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {c.blurb}
                  </p>
                  <p className="mt-5 border-t border-border pt-4 text-sm italic text-foreground/80">
                    {c.line}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ closing CTA ------------------------------ */

function ClosingCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 lg:py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-[var(--card-shadow)] sm:px-12 lg:py-20">
          {/* Teal wash behind the panel content. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(70% 120% at 50% 0%, color-mix(in oklch, var(--brand) 18%, transparent), transparent 60%)",
            }}
          />
          <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Start building today
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
            Set up your profile in a minute and let your coaches take it from
            there. Your strongest self is a few reps away.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={ctaPrimary}>
              Get started
              <ArrowRight />
            </Link>
            <Link href="/sign-in" className={ctaOutline}>
              Sign in
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------- footer --------------------------------- */

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          {/* Brand + the name's meaning — the home for the Tikas story. */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="w-fit transition-opacity hover:opacity-80">
              <Brand />
            </Link>
            <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              From the Tagalog{" "}
              <span className="font-medium text-foreground">matikas</span> — an
              upright, athletic bearing. Tikas is built to help you carry
              yourself like it.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: "#features", label: "Features" },
              { href: "#coaches", label: "The coaches" },
            ]}
          />
          <FooterColumn
            title="Get started"
            links={[
              { href: "/sign-up", label: "Create an account" },
              { href: "/sign-in", label: "Sign in" },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {year} Tikas — your fitness companion.
          </p>
          <p className="text-xs text-muted-foreground/80">
            <span className="text-muted-foreground">/ma&middot;ti&middot;kas/</span>{" "}
            &middot; Tagalog, adj.
          </p>
        </div>
      </div>
    </footer>
  );
}
