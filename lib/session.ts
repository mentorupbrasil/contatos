import { cookies } from "next/headers";
import { headers } from "next/headers";

export type SessionUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const SESSION_COOKIE = "rede_session_email";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

export async function getSessionUser(): Promise<SessionUser | null> {
  const requestHeaders = await headers();
  const headerEmail = requestHeaders.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (headerEmail) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;
    return {
      displayName: fullName ?? headerEmail,
      email: headerEmail,
      fullName,
    };
  }

  const cookieStore = await cookies();
  const email = cookieStore.get(SESSION_COOKIE)?.value?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return null;

  return {
    displayName: email.split("@")[0] ?? email,
    email,
    fullName: null,
  };
}

export async function setSessionEmail(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, email.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
