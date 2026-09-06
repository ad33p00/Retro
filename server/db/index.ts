import { createClient, type InArgs } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DB_URL ?? `file:${path.join(__dirname, "retro.db")}`;
const authToken = process.env.DB_AUTH_TOKEN;

export const client = createClient(authToken ? { url, authToken } : { url });
console.log(`[db] using ${url.startsWith("file:") ? `local file (${url})` : url}`);

export async function dbAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await client.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function dbGet<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rows = await dbAll<T>(sql, args);
  return rows[0];
}

export async function dbRun(sql: string, args: InArgs = []): Promise<void> {
  await client.execute({ sql, args });
}

export async function initDb(): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON").catch(() => {});

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await client.batch(statements, "write");
}
