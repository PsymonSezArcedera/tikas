import { createAuthClient } from "better-auth/react";

// baseURL defaults to the current origin, which is correct for both local dev
// and the Vercel deployment — so no public env var is needed.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
