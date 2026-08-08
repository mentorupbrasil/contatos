import { getSessionUser, type SessionUser } from "../lib/session";

/** @deprecated Prefer getSessionUser from lib/session */
export type ChatGPTUser = SessionUser;

export async function getChatGPTUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export function chatGPTSignInPath(returnTo = "/") {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/?login=1&return_to=${encodeURIComponent(safe)}`;
}

export function chatGPTSignOutPath(returnTo = "/") {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/api/auth/logout?return_to=${encodeURIComponent(safe)}`;
}
