// Wrapper around the Prisma CLI that forces the DIRECT (migration) connection
// to use IPv4.
//
// Why: this dev machine advertises a global IPv6 address that can't actually
// route to Neon. Prisma's migrate engine connects over raw TCP:5432 and tries
// IPv6 first, so `prisma migrate` fails with `P1001: Can't reach database
// server`. Runtime queries are unaffected — the Neon serverless driver used by
// lib/db.ts runs over port 443 with automatic IPv4 fallback.
//
// What it does: resolves the direct host to an IPv4 address at runtime (so it
// survives Neon rotating its IPs), rewrites DIRECT_URL to connect by that IP,
// and adds Neon's `options=endpoint=<id>` param so the proxy still routes
// correctly without SNI. Then it runs the Prisma CLI with that env override.
//
// Usage:
//   npm run db:migrate                 -> prisma migrate dev
//   npm run db:migrate -- migrate deploy
//   npm run db:migrate -- migrate status
//
// Once IPv6 is fixed at the OS/router level, plain `prisma migrate dev` works
// and this wrapper can be removed.
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error("DIRECT_URL is not set (expected in .env).");
  process.exit(1);
}

const url = new URL(directUrl);
const hostname = url.hostname;

// The Neon endpoint id is the first label of the host, minus any -pooler suffix.
const endpointId = hostname.split(".")[0].replace(/-pooler$/, "");

// Resolve to IPv4 so the migrate engine never attempts the unroutable IPv6.
const { address } = await lookup(hostname, { family: 4 });

url.hostname = address;
// Connecting by IP skips SNI, so tell Neon which endpoint to route to.
url.searchParams.set("options", `endpoint=${endpointId}`);

const prismaArgs = process.argv.slice(2);
const args = prismaArgs.length > 0 ? prismaArgs : ["migrate", "dev"];

console.log(
  `db:migrate → forcing direct connection to IPv4 ${address} (endpoint=${endpointId})`,
);

const child = spawn("prisma", args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DIRECT_URL: url.toString() },
});
child.on("exit", (code) => process.exit(code ?? 0));
