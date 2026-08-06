import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "./db";

// Server-side Better Auth instance. Secrets and URLs are read from the
// environment (see .env) — never hardcoded.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  advanced: {
    database: {
      // Defer id generation to Prisma's @default(cuid()) instead of Better
      // Auth's random generator, to match our schema conventions.
      generateId: false,
    },
  },
  // Must stay last: lets Server Actions/route handlers set auth cookies in the
  // Next.js App Router.
  plugins: [nextCookies()],
});
