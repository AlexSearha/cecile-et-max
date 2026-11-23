// Lecture de la liste d'invités saisie dans le back-office (sans dépendance serveur : testable seule).
import { isRole, type Role } from "./shared";

export type ParsedPerson = { firstName: string; lastName: string; role: Role };
export type ParsedFoyer = {
  line: string;
  family: string | null;
  members: ParsedPerson[];
};

const ROLE_WORDS: Record<string, Role> = {
  conjoint: "conjoint",
  conjointe: "conjoint",
  epoux: "conjoint",
  epouse: "conjoint",
  femme: "conjoint",
  mari: "conjoint",
  compagnon: "conjoint",
  compagne: "conjoint",
  ami: "conjoint",
  amie: "conjoint",
  "petit ami": "conjoint",
  "petite amie": "conjoint",
  enfant: "enfant",
  fils: "fils",
  fille: "fils",
  "fils/fille": "fils",
  "fils / fille": "fils",
  referent: "referent",
  autre: "autre",
};

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "enfant", "(conjointe)", "petite amie"… -> rôle, ou null si inconnu. */
export function roleFromWord(word: string): Role | null {
  const w = plain(word);
  if (isRole(w)) return w;
  return ROLE_WORDS[w] ?? null;
}

/**
 * Une personne :
 *   "Paul Dupond"            -> le premier mot est le prénom
 *   "Jean Pierre ; Dupond"   -> prénom composé avec espace
 *   "Léo (enfant)"           -> prénom seul : reprend le nom du référent du foyer
 * Le rôle entre parenthèses est facultatif.
 */
export function parsePerson(
  raw: string,
  previous?: { lastName: string },
): (ParsedPerson & { roleGiven: boolean }) | null {
  let s = raw.trim();
  if (!s) return null;
  let role: Role | null = null;
  const m = s.match(/\(([^)]*)\)\s*$/);
  if (m) {
    role = roleFromWord(m[1]);
    s = s.slice(0, m.index).trim();
  }
  let firstName: string;
  let lastName: string;
  if (s.includes(";")) {
    const [first, ...rest] = s.split(";");
    firstName = first.trim();
    lastName = rest.join(" ").trim();
  } else {
    const [first, ...rest] = s.split(/\s+/);
    firstName = first ?? "";
    lastName = rest.join(" ") || previous?.lastName || "";
  }
  return {
    firstName,
    lastName,
    role: role ?? "autre",
    roleGiven: role !== null,
  };
}

/** Une ligne = un foyer. Sans rôle précisé : 1re personne = référent, 2e = conjoint(e), suivantes = enfants. */
function parseFoyer(text: string): ParsedPerson[] {
  const members: ParsedPerson[] = [];
  for (const part of text.split(",")) {
    const p = parsePerson(part, members[0]);
    if (!p) continue;
    const i = members.length;
    const role = p.roleGiven
      ? p.role
      : i === 0
        ? "referent"
        : i === 1
          ? "conjoint"
          : "enfant";
    members.push({ firstName: p.firstName, lastName: p.lastName, role });
  }
  return members;
}

/**
 * Format :
 *
 *   Famille Dupond :                          <- titre seul : début d'une famille principale
 *   Jean Dupond, Marie Durand                 <- un foyer par ligne
 *   Paul Dupond, Julie, Léo, Emma
 *   Marc Dupond, Thomas Petit (conjoint), Hugo (enfant)
 *                                             <- ligne vide : fin de la famille
 *   Julie Bernard                             <- foyer sans famille principale
 *   Famille Roux : Marc Roux, Lou             <- famille + un seul foyer sur la même ligne
 */
export function parseGuestList(text: string): ParsedFoyer[] {
  const foyers: ParsedFoyer[] = [];
  let current: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      current = null; // une ligne vide termine la famille en cours
      continue;
    }
    const colon = line.indexOf(":");
    if (colon > 0) {
      const name = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1).trim();
      if (!rest) {
        current = name; // titre de famille seul
        continue;
      }
      foyers.push({ line, family: name, members: parseFoyer(rest) });
      continue;
    }
    foyers.push({ line, family: current, members: parseFoyer(line) });
  }
  return foyers;
}

export const validPerson = (p: { firstName: string; lastName: string }) =>
  p.firstName.length > 0 &&
  p.lastName.length > 0 &&
  p.firstName.length <= 80 &&
  p.lastName.length <= 80;
