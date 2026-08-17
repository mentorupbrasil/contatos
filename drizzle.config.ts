import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function loadLocalDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return;
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!match) continue;
      process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  } catch {
    // Vercel/CI already injects DATABASE_URL.
  }
}

loadLocalDatabaseUrl();

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
