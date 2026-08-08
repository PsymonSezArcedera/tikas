"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Dumbbell,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Salad,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview" },
  { href: "/tracking", label: "Tracking", icon: LineChart, hint: "Progress" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Insights" },
  { href: "/workout", label: "Workout", icon: Dumbbell, hint: "Fortis" },
  { href: "/nutrition", label: "Nutrition", icon: Salad, hint: "Vita" },
  { href: "/wellness", label: "Wellness", icon: Sparkles, hint: "Lux" },
];

type ShellUser = {
  name?: string | null;
  email: string;
  image?: string | null;
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-svh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
        <Brand />
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 border-r border-sidebar-border bg-sidebar">
            <SidebarContent
              user={user}
              pathname={pathname}
              onClose={() => setOpen(false)}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  pathname,
  onClose,
  onNavigate,
}: {
  user: ShellUser;
  pathname: string;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between px-2 py-3">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X />
          </Button>
        ) : (
          <ThemeToggle />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1">{item.label}</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/70">
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <UserFooter user={user} />
    </div>
  );
}

function UserFooter({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const label = user.name?.trim() || user.email;
  const initial = (label[0] ?? "?").toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-sidebar-border pt-3 pb-1">
      <div className="flex items-center gap-3 px-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground hover:text-foreground"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <LogOut />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
