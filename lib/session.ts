import { headers } from "next/headers";

import { auth } from "./auth";

/**
 * Server-side session access for Server Components, Server Actions, and Route
 * Handlers. Returns `null` when the request is unauthenticated.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
