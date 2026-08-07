import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

// Shared chrome for every authenticated section (dashboard, workout, nutrition,
// wellness). The proxy gives an optimistic cookie check; this server-side
// session lookup is the real guard and also feeds the sidebar its user.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </AppShell>
  );
}
