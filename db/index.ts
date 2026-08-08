import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof createDb>;

function createDb(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. No Vercel, conecte o Neon Storage e use a connection string do Postgres.",
    );
  }
  return createDb(connectionString);
}
