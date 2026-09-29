/** Container startup: wait for Postgres -> migrate -> seed once (if empty) -> start Next. */
import net from "node:net";
import { spawnSync, spawn } from "node:child_process";

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
    s.on("error", () => {
      if (Date.now() - t0 > 120000) reject(new Error("postgres not reachable after 120s"));
      else setTimeout(tryConnect, 2000);
    });
  })();
});

console.log("[startup] running migrations...");
spawnSync("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"], {
  stdio: "inherit",
  env: process.env,
});

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const hospitals = await prisma.hospital.count();
await prisma.$disconnect();

if (hospitals === 0) {
  console.log("[startup] empty database — seeding demo data...");
  spawnSync("./node_modules/.bin/prisma", ["db", "seed", "--schema", "packages/db/prisma/schema.prisma"], {
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log(`[startup] database already has ${hospitals} hospital(s) — skipping seed`);
}

console.log("[startup] starting next...");
const next = spawn("./node_modules/.bin/next", ["start", "apps/web", "-p", "3100"], {
  stdio: "inherit",
  env: process.env,
});
next.on("exit", (code) => process.exit(code ?? 1));
