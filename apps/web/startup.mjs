/** Container startup: wait for Postgres -> migrate -> seed once (if empty) -> start Next. */
import net from "node:net";
import { spawnSync, spawn } from "node:child_process";

function sleepForever() {
  console.log("[startup] entering sleep (debug mode) — container staying alive");
  setInterval(() => {}, 60000);
}

try {
const DB_URL = process.env.DATABASE_URL || "";
const dbHost = (() => {
  try {
    return new URL(DB_URL.replace(/^postgres:/, "postgresql:")).hostname;
  } catch {
    return "postgres";
  }
})();
const DB_PORT = 5432;

console.log(`[startup] waiting for postgres at ${dbHost}:${DB_PORT}...`);
await new Promise((resolve, reject) => {
  const t0 = Date.now();
  (function tryConnect() {
    const s = net.connect(DB_PORT, dbHost);
    s.on("connect", () => {
      s.end();
      console.log("[startup] postgres reachable");
      resolve();
    });
    s.on("error", (e) => {
      console.log(`[startup] db connect error: ${e.message}`);
      if (Date.now() - t0 > 120000) reject(new Error("postgres not reachable after 120s"));
      else setTimeout(tryConnect, 2000);
    });
  })();
});

console.log("[startup] running migrations...");
const mig = spawnSync("pnpm", ["dlx", "prisma@6.0.0", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"], {
  stdio: "inherit",
  env: process.env,
});
console.log(`[startup] migrate exit code: ${mig.status}`);
if (mig.status !== 0) throw new Error(`prisma migrate deploy failed with code ${mig.status}`);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const hospitals = await prisma.hospital.count();
await prisma.$disconnect();

if (hospitals === 0) {
  console.log("[startup] empty database — seeding demo data...");
  const seed = spawnSync("pnpm", ["dlx", "tsx", "packages/db/prisma/seed.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  console.log(`[startup] seed exit code: ${seed.status}`);
  if (seed.status !== 0) throw new Error(`seed failed with code ${seed.status}`);
} else {
  console.log(`[startup] database already has ${hospitals} hospital(s) — skipping seed`);
}

console.log("[startup] starting next...");
const next = spawn("pnpm", ["--filter", "@hms/web", "start"], {
  stdio: "inherit",
  env: { ...process.env, PORT: "3100" },
});
next.on("exit", (code) => {
  console.log(`[startup] next exited with code ${code}`);
  sleepForever();
});
next.on("error", (e) => {
  console.log(`[startup] next spawn error: ${e.message}`);
  sleepForever();
});
} catch (e) {
  console.error(`[startup] FATAL: ${e.message}`);
  console.error(e.stack);
  sleepForever();
}
