import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

import { PrismaClient } from "./generated/prisma/client";

// The Neon serverless driver talks to Postgres over a WebSocket. In Node.js
// (local dev, Vercel's Node runtime) there's no reliable global WebSocket, so
// point the driver at the `ws` package. Not needed on edge runtimes.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Runtime queries go through the pooled connection via the Neon driver adapter.
// (Migrations use the direct connection — see prisma.config.ts.)
const adapter = new PrismaNeon({ connectionString });

// Reuse a single PrismaClient across HMR reloads in dev to avoid exhausting
// connections with a new client on every change.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
