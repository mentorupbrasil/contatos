import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, users } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAppUser } from "../../../lib/auth";

const MAX_AVATAR_CHARS = 180_000;
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

export async function PATCH(request: Request) {
  try {
    const current = await requireAppUser();
    const body = (await request.json()) as { avatarUrl?: string | null };
    const db = getDb();

    let avatarUrl: string | null | undefined = undefined;
    if (body.avatarUrl === null) {
      avatarUrl = null;
    } else if (typeof body.avatarUrl === "string") {
      const value = body.avatarUrl.trim();
      if (!DATA_URL_RE.test(value)) {
        throw new ApiError(400, "Envie uma imagem JPEG, PNG ou WebP.", "INVALID_AVATAR");
      }
      if (value.length > MAX_AVATAR_CHARS) {
        throw new ApiError(400, "A foto ficou grande demais. Tente outra imagem.", "AVATAR_TOO_LARGE");
      }
      avatarUrl = value;
    } else {
      throw new ApiError(400, "Informe a foto do perfil.", "INVALID_AVATAR");
    }

    const [updated] = await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, current.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
      });

    await db.insert(auditLogs).values({
      actorUserId: current.id,
      action: avatarUrl ? "user.avatar_updated" : "user.avatar_removed",
      entityType: "user",
      entityId: String(current.id),
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
