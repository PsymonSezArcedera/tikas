import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

import { SignOutButton } from "./sign-out-button";

// Protected route. The proxy (middleware) redirects when the session cookie is
// missing; this server-side check is the real validation and also covers direct
// requests. Using headers() via getSession() opts this route out of static
// prerendering.
export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{session.user.email}</strong>
      </p>
      <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {JSON.stringify(session.user, null, 2)}
      </pre>
      <SignOutButton />
    </main>
  );
}
