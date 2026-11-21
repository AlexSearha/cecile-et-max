import { timingSafeEqual } from "crypto";

// Vérifie le jeton du lien caché (variable d'environnement ADMIN_TOKEN)
export function isValidToken(token: string | undefined | null): boolean {
  const expected = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
