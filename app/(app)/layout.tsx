import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isProfileComplete } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/app/providers";

// Shared chrome for every authenticated section (dashboard, workout, nutrition,
// wellness). The proxy gives an optimistic cookie check; this server-side
// session lookup is the real guard and also feeds the sidebar its user.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Gate the app on a complete profile — a fresh (or partial) user is sent to
  // onboarding before they can reach the dashboard and its unit-aware displays.
  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      height: true,
      weight: true,
      goalWeight: true,
      birthday: true,
      gender: true,
      activityLevel: true,
    },
  });

  if (!isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  return (
    <Providers>
      <AppShell
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      >
        {children}
      </AppShell>
    </Providers>
  );
}
