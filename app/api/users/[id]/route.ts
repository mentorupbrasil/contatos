import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditLogs, users } from "../../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../../lib/auth";
import { hashPassword, validatePasswordStrength } from "../../../../lib/password";

type PatchBody = {
  email?: string;
  name?: string;
  role?: "admin" | "leader";
  status?: "active" | "inactive";
  password?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const current = await requireAppUser();
    requireAdmin(current);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, "Usuário inválido.", "INVALID_USER");
    }

    const body = (await request.json()) as PatchBody;
    const db = getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new ApiError(404, "Acesso não encontrado.", "USER_NOT_FOUND");

    const updates: {
      name?: string;
      email?: string;
      role?: "admin" | "leader";
      status?: "active" | "inactive";
      passwordHash?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2) throw new ApiError(400, "Informe um nome válido.", "INVALID_USER");
      updates.name = name;
    }

    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new ApiError(400, "Informe um e-mail válido.", "INVALID_EMAIL");
      }
      if (email !== target.email) {
        const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (dup) throw new ApiError(409, "Este e-mail já está cadastrado.", "DUPLICATE_USER");
      }
      updates.email = email;
    }

    if (body.role === "admin" || body.role === "leader") {
      if (target.id === current.id && body.role === "leader") {
        const [{ value: adminCount }] = await db
          .select({ value: count() })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, target.id)));
        if (adminCount === 0) {
          throw new ApiError(400, "Mantenha ao menos uma administração ativa.", "LAST_ADMIN");
        }
      }
      updates.role = body.role;
    }

    if (body.status === "active" || body.status === "inactive") {
      if (target.id === current.id && body.status === "inactive") {
        throw new ApiError(400, "Você não pode desativar o próprio acesso.", "SELF_DISABLE");
      }
      if (target.role === "admin" && body.status === "inactive") {
        const [{ value: adminCount }] = await db
          .select({ value: count() })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, target.id)));
        if (adminCount === 0) {
          throw new ApiError(400, "Mantenha ao menos uma administração ativa.", "LAST_ADMIN");
        }
      }
      updates.status = body.status;
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      const passwordError = validatePasswordStrength(body.password);
      if (passwordError) throw new ApiError(400, passwordError, "WEAK_PASSWORD");
      updates.passwordHash = await hashPassword(body.password);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      });

    await db.insert(auditLogs).values({
      actorUserId: current.id,
      action: "user.updated",
      entityType: "user",
      entityId: String(updated.id),
      details: JSON.stringify({
        fields: Object.keys(updates).filter((key) => key !== "updatedAt" && key !== "passwordHash"),
        passwordChanged: Boolean(updates.passwordHash),
      }),
    });

    return Response.json({ user: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
