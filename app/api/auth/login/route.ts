import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { ApiError, apiErrorResponse } from "../../../../lib/auth";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../../../../lib/password";
import { setSessionEmail } from "../../../../lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const name = body.name?.trim() || email.split("@")[0] || "Administração";

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError(400, "Informe um e-mail válido.", "INVALID_EMAIL");
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new ApiError(400, passwordError, "WEAK_PASSWORD");

    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      if (existing.status !== "active") {
        throw new ApiError(403, "Este acesso está desativado.", "ACCESS_INACTIVE");
      }
      if (!existing.passwordHash) {
        throw new ApiError(
          403,
          "Esta conta ainda não tem senha. Peça à administração para redefinir o acesso.",
          "PASSWORD_MISSING",
        );
      }
      const ok = await verifyPassword(password, existing.passwordHash);
      if (!ok) throw new ApiError(401, "E-mail ou senha incorretos.", "INVALID_CREDENTIALS");
      await setSessionEmail(email);
      return NextResponse.json({
        user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role },
      });
    }

    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    if (userCount > 0) {
      throw new ApiError(
        403,
        "Seu e-mail ainda não foi liberado. Peça o acesso à administração.",
        "NOT_INVITED",
      );
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({ email, name, role: "admin", passwordHash })
      .returning();
    await setSessionEmail(email);
    return NextResponse.json(
      { user: { id: created.id, name: created.name, email: created.email, role: created.role } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
