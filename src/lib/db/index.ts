import fs from "node:fs";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

// Next.js may load this module in more than one bundle (instrumentation, routes, pages),
// but they share one Node process — keep a single connection on globalThis.
const g = globalThis as unknown as { __dispatchDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__dispatchDb) {
    g.__dispatchDb = init().catch((err) => {
      g.__dispatchDb = undefined;
      throw err;
    });
  }
  return g.__dispatchDb;
}

async function init(): Promise<Db> {
  if (env.databaseUrl) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(new Pool({ connectionString: env.databaseUrl }), { schema });
    await migrate(db, { migrationsFolder });
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  fs.mkdirSync(env.pgliteDir, { recursive: true });
  const db = drizzle(new PGlite(env.pgliteDir), { schema });
  await migrate(db, { migrationsFolder });
  // The PGlite and node-postgres drivers expose the same query API.
  return db as unknown as Db;
}

export function describeDatabase() {
  return env.databaseUrl
    ? { kind: "PostgreSQL", detail: env.databaseUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:••••@") }
    : { kind: "Embedded PostgreSQL (PGlite)", detail: path.relative(process.cwd(), env.pgliteDir) };
}

export { schema };
