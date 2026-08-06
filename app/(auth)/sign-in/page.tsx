"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

// Minimal, intentionally-unstyled form for testing sign-in + Google login
// end to end. Real styled auth pages come later.
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Sign in failed");
      return;
    }
    router.push("/dashboard");
  }

  async function handleGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  }

  return (
    <main style={{ maxWidth: 320, margin: "4rem auto", display: "grid", gap: 12 }}>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button type="button" onClick={handleGoogle}>
        Continue with Google
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p>
        Need an account? <Link href="/sign-up">Sign up</Link>
      </p>
    </main>
  );
}
