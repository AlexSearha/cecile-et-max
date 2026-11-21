// Minuscule, sans accents ni ponctuation : "Le Goff-Hélène" -> "le goff helene"
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
