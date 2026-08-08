import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export function validatePasswordStrength(password: string) {
  if (password.length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return null;
}
