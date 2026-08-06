import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Handles all Better Auth endpoints under /api/auth/* (sign-up, sign-in,
// sign-out, OAuth callbacks, session, etc.).
export const { GET, POST } = toNextJsHandler(auth);
