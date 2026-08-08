import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, users } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../lib/auth";
import { hashPassword, validatePasswordStrength } from "../../../lib/password";

export async function GET() {
  try {
    const current = await requireAppUser();
    requireAdmin(current);
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
    return Response.json({ users: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireAppUser();
    requireAdmin(current);
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      role?: "admin" | "leader";
      password?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? "";
    const password = body.password ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2) {
      throw new ApiError(400, "Informe nome e e-mail válidos.", "INVALID_USER");
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new ApiError(400, passwordError, "WEAK_PASSWORD");

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ApiError(409, "Este e-mail já está cadastrado.", "DUPLICATE_USER");

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        role: body.role === "admin" ? "admin" : "leader",
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
      });

    await db.insert(auditLogs).values({
      actorUserId: current.id,
      action: "user.invited",
      entityType: "user",
      entityId: String(created.id),
      details: JSON.stringify({ role: created.role }),
    });
    return Response.json({ user: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
