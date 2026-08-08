import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, users } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../lib/auth";

export async function GET() {
  try {
    const current = await requireAppUser();
    requireAdmin(current);
    const db = await getDb();
    const rows = await db.select().from(users).orderBy(asc(users.name));
    return Response.json({ users: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireAppUser();
    requireAdmin(current);
    const body = (await request.json()) as { email?: string; name?: string; role?: "admin" | "leader" };
    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2) throw new ApiError(400, "Informe nome e e-mail válidos.", "INVALID_USER");
    const db = await getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ApiError(409, "Este e-mail já está cadastrado.", "DUPLICATE_USER");
    const [created] = await db.insert(users).values({ email, name, role: body.role === "admin" ? "admin" : "leader" }).returning();
    await db.insert(auditLogs).values({ actorUserId: current.id, action: "user.invited", entityType: "user", entityId: String(created.id), details: JSON.stringify({ role: created.role }) });
    return Response.json({ user: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
