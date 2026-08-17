import { count, eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getSessionUser } from "./session";

export type AppUser = typeof users.$inferSelect;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_ERROR") {
    super(message);
  }
}

export async function requireAppUser(): Promise<AppUser> {
  const identity = await getSessionUser();
  if (!identity) throw new ApiError(401, "Entre para continuar.", "UNAUTHENTICATED");

  const email = identity.email.trim().toLowerCase();
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing?.status === "active") return existing;
  if (existing?.status === "inactive") throw new ApiError(403, "Este acesso está desativado.", "ACCESS_INACTIVE");

  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) {
    throw new ApiError(403, "Seu e-mail ainda não foi convidado por uma administradora.", "NOT_INVITED");
  }

  const [created] = await db
    .insert(users)
    .values({ email, name: identity.fullName ?? identity.displayName, role: "admin" })
    .returning();
  return created;
}

export function requireAdmin(user: AppUser) {
  if (user.role !== "admin") {
    throw new ApiError(403, "Somente administradoras podem realizar esta ação.", "ADMIN_REQUIRED");
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  console.error("API error", message);
  return Response.json({ error: "Não foi possível concluir a operação.", code: "INTERNAL_ERROR" }, { status: 500 });
}
