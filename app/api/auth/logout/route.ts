import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/session";

export async function GET(request: Request) {
  await clearSession();
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") || "/";
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return NextResponse.redirect(new URL(safe, url.origin));
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
