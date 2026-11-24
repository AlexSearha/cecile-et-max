import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import { normalize } from "./text";
import type { AgeGroup, InvitationType, Role } from "./shared";

export type GuestResponse = {
  attending: boolean;
  ageGroup: AgeGroup | null; // null = adulte
  sleepsOnSite: boolean;
  brunch: boolean; // présent au brunch du lendemain
  respondedAt: string; // ISO
};

export type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  role?: Role; // rôle dans le foyer (absent = données anciennes)
  response: GuestResponse | null; // null = pas encore répondu
};

/**
 * Un groupe = un foyer (personne seule, couple, parents + enfants…).
 * Plusieurs foyers peuvent appartenir à la même famille principale (ex. "Famille Dupond").
 */
export type Group = {
  id: string;
  family?: string | null; // famille principale (facultatif)
  label?: string | null; // ancien champ : sert de famille principale si "family" est absent
  type?: InvitationType; // absent = "full" (données anciennes)
  createdAt: string;
  members: Guest[];
};

export type Message = {
  id: string;
  name: string;
  contact: string;
  message: string;
  createdAt: string;
};

export type Vendor = {
  id: string;
  company: string;
  phone: string;
  contact: string;
  comment: string;
  updatedAt: string; // ISO, mis à jour à chaque modification
};

export type Person = { firstName: string; lastName: string };
export type PersonWithRole = Person & { role: Role };

export const groupType = (g: Pick<Group, "type">): InvitationType => g.type ?? "full";
export const groupFamily = (g: Pick<Group, "family" | "label">): string | null => g.family ?? g.label ?? null;
export const guestRole = (m: Pick<Guest, "role">, index: number): Role => m.role ?? (index === 0 ? "referent" : "autre");

// ---------------------------------------------------------------------------
// Deux modes de stockage :
//  - Upstash Redis si ses variables sont présentes (obligatoire sur Vercel)
//  - sinon fichiers JSON dans DATA_DIR (local, Docker, Coolify)
// ---------------------------------------------------------------------------

/** Trouve l'URL/token Upstash quel que soit le préfixe choisi (KV_, STORAGE_, UPSTASH_REDIS_…). */
function findRedisEnv(): { url: string; token: string } | null {
  const env = process.env;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  for (const key of Object.keys(env)) {
    if (!key.endsWith("_REST_API_URL")) continue;
    const prefix = key.slice(0, -"_REST_API_URL".length);
    const url = env[key];
    const token = env[`${prefix}_REST_API_TOKEN`];
    if (url && token) return { url, token };
  }
  return null;
}

const redisEnv = findRedisEnv();
const redis = redisEnv ? new Redis(redisEnv) : null;

if (!redis && process.env.VERCEL) {
  console.error(
    "[storage] Aucune base Redis trouvée : connectez Upstash Redis au projet Vercel puis redéployez. Variables visibles : " +
      (Object.keys(process.env).filter((k) => /REDIS|KV|REST_API/.test(k)).join(", ") || "aucune"),
  );
}

const PREFIX = process.env.REDIS_PREFIX ?? "mariage";
const LOCK_KEY = `${PREFIX}:lock`;
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

type Collection = "groups" | "messages" | "vendors";

async function load<T>(name: Collection): Promise<T[]> {
  if (redis) return (await redis.get<T[]>(`${PREFIX}:${name}`)) ?? [];
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${name}.json`), "utf8")) as T[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function save<T>(name: Collection, data: T[]): Promise<void> {
  if (redis) {
    await redis.set(`${PREFIX}:${name}`, data);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(`${file}.tmp`, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(`${file}.tmp`, file); // écriture atomique
}

// Verrou local : sérialise les écritures dans un même processus
let queue: Promise<unknown> = Promise.resolve();
function localLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/** Verrou distribué : sur Vercel, plusieurs fonctions peuvent écrire en parallèle. */
async function distributedLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!redis) return fn();
  const token = randomUUID();
  for (let i = 0; ; i++) {
    const ok = await redis.set(LOCK_KEY, token, { nx: true, px: 10_000 });
    if (ok) break;
    if (i > 80) throw new Error("Stockage occupé, réessayez dans un instant.");
    await sleep(100);
  }
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE_SCRIPT, [LOCK_KEY], [token]);
  }
}

/** Toute opération de lecture-modification-écriture passe par ici. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  return localLock(() => distributedLock(fn));
}

/** Lit les groupes, applique une modification, et enregistre si demandé. */
function mutateGroups<T>(fn: (groups: Group[]) => { result: T; save: boolean }): Promise<T> {
  return withLock(async () => {
    const groups = await load<Group>("groups");
    const { result, save: shouldSave } = fn(groups);
    if (shouldSave) await save("groups", groups);
    return result;
  });
}

const personKey = (p: Person) => normalize(`${p.firstName} ${p.lastName}`);
const newGuest = (p: PersonWithRole): Guest => ({ ...p, id: randomUUID(), response: null });

/** Nom d'un foyer dans le back-office : "Foyer de Paul Dupond" (ou le nom de la personne seule). */
export function foyerName(g: Pick<Group, "members">): string {
  const ref = g.members.find((m) => m.role === "referent") ?? g.members[0];
  if (!ref) return "Foyer vide";
  const name = `${ref.firstName} ${ref.lastName}`;
  return g.members.length === 1 ? name : `Foyer de ${name}`;
}

/** Nom complet pour l'export : "Famille Dupond › Foyer de Paul Dupond". */
export function groupName(g: Pick<Group, "family" | "label" | "members">): string {
  const fam = groupFamily(g);
  return fam ? `${fam} › ${foyerName(g)}` : foyerName(g);
}

// ----------------------------- Groupes ------------------------------------

/** Lecture seule : pas besoin de verrou. */
export function listGroups(): Promise<Group[]> {
  return load<Group>("groups");
}

/** Ajoute des groupes ; une personne déjà invitée (même prénom + nom) est ignorée. */
export function addGroups(
  input: { family: string | null; members: PersonWithRole[] }[],
  type: InvitationType,
): Promise<{ groups: number; people: number; skipped: number }> {
  return mutateGroups((groups) => {
    const existing = new Set(groups.flatMap((g) => g.members.map(personKey)));
    let added = 0;
    let people = 0;
    let skipped = 0;
    for (const item of input) {
      const members: Guest[] = [];
      for (const p of item.members) {
        const key = personKey(p);
        if (!key || existing.has(key)) {
          skipped++;
          continue;
        }
        existing.add(key);
        members.push(newGuest(p));
      }
      if (members.length === 0) continue;
      groups.push({ id: randomUUID(), family: item.family, type, createdAt: new Date().toISOString(), members });
      added++;
      people += members.length;
    }
    return { result: { groups: added, people, skipped }, save: added > 0 };
  });
}

/** Admin : ajoute une personne à un groupe existant. */
export function addMember(groupId: string, person: PersonWithRole): Promise<boolean> {
  return mutateGroups((groups) => {
    const group = groups.find((g) => g.id === groupId);
    const exists = groups.some((g) => g.members.some((m) => personKey(m) === personKey(person)));
    if (!group || exists) return { result: false, save: false };
    group.members.push(newGuest(person));
    return { result: true, save: true };
  });
}

/** Admin : corrige le prénom, le nom et/ou le rôle d'une personne. */
export function updateGuest(guestId: string, person: PersonWithRole): Promise<"ok" | "duplicate" | "notfound"> {
  return mutateGroups((groups) => {
    const all = groups.flatMap((g) => g.members);
    const guest = all.find((m) => m.id === guestId);
    if (!guest) return { result: "notfound" as const, save: false };
    if (all.some((m) => m.id !== guestId && personKey(m) === personKey(person))) {
      return { result: "duplicate" as const, save: false };
    }
    guest.firstName = person.firstName;
    guest.lastName = person.lastName;
    guest.role = person.role;
    return { result: "ok" as const, save: true };
  });
}

/** Admin : change le type d'invitation d'un groupe. */
export function setGroupType(groupId: string, type: InvitationType): Promise<void> {
  return mutateGroups((groups) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) group.type = type;
    return { result: undefined, save: !!group };
  });
}

/** Admin : rattache un foyer à une famille principale (null = aucune). */
export function setGroupFamily(groupId: string, family: string | null): Promise<void> {
  return mutateGroups((groups) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.family = family;
      group.label = null;
    }
    return { result: undefined, save: !!group };
  });
}

/** Noms des familles principales existantes (pour l'autocomplétion du back-office). */
export function familyNames(groups: Group[]): string[] {
  return [...new Set(groups.map(groupFamily).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Recherche tolérante (accents, casse) parmi les groupes d'un type donné :
 * chaque mot tapé doit débuter un mot du prénom ou du nom d'un membre.
 */
export async function searchGroups(query: string, type: InvitationType, limit = 10): Promise<Group[]> {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];
  const groups = await listGroups();
  return groups
    .filter((g) => groupType(g) === type)
    .filter((g) =>
      g.members.some((m) => {
        const words = personKey(m).split(" ");
        return terms.every((t) => words.some((w) => w.startsWith(t)));
      }),
    )
    .slice(0, limit)
    .sort((a, b) => (groupFamily(a) ?? "\uffff").localeCompare(groupFamily(b) ?? "\uffff", "fr"));
}

export type Answer = {
  guestId: string;
  attending: boolean;
  ageGroup: AgeGroup | null;
  sleepsOnSite: boolean;
  brunch: boolean;
};

/**
 * Enregistre les réponses d'un groupe. Une réponse déjà donnée n'est jamais écrasée.
 * Pour une invitation "vin d'honneur", seuls la présence est conservée.
 */
export function recordResponses(
  groupId: string,
  answers: Answer[],
): Promise<{ group: Group; saved: string[] } | null> {
  return mutateGroups((groups) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return { result: null, save: false };
    const full = groupType(group) === "full";
    const saved: string[] = [];
    const now = new Date().toISOString();
    for (const a of answers) {
      const member = group.members.find((m) => m.id === a.guestId);
      if (!member || member.response) continue;
      const coming = a.attending;
      member.response = {
        attending: coming,
        ageGroup: full && coming ? a.ageGroup : null,
        sleepsOnSite: full && coming && a.sleepsOnSite,
        brunch: full && coming && a.brunch,
        respondedAt: now,
      };
      saved.push(member.id);
    }
    return { result: { group, saved }, save: saved.length > 0 };
  });
}

/** Admin : efface la réponse pour que la personne puisse répondre à nouveau. */
export function resetResponse(guestId: string): Promise<void> {
  return mutateGroups((groups) => {
    const member = groups.flatMap((g) => g.members).find((m) => m.id === guestId);
    if (member) member.response = null;
    return { result: undefined, save: !!member };
  });
}

/** Admin : supprime une personne (et son groupe s'il devient vide). */
export function deleteGuest(guestId: string): Promise<void> {
  return mutateGroups((groups) => {
    for (const g of groups) g.members = g.members.filter((m) => m.id !== guestId);
    const kept = groups.filter((g) => g.members.length > 0);
    groups.splice(0, groups.length, ...kept);
    return { result: undefined, save: true };
  });
}

// ----------------------------- Messages -----------------------------------

export function listMessages(): Promise<Message[]> {
  return load<Message>("messages");
}

export function addMessage(m: Omit<Message, "id" | "createdAt">): Promise<void> {
  return withLock(async () => {
    const messages = await load<Message>("messages");
    messages.push({ ...m, id: randomUUID(), createdAt: new Date().toISOString() });
    await save("messages", messages.slice(-500)); // garde les 500 derniers
  });
}

export function deleteMessage(id: string): Promise<void> {
  return withLock(async () => {
    const messages = await load<Message>("messages");
    await save(
      "messages",
      messages.filter((m) => m.id !== id),
    );
  });
}

// ---------------------------- Prestataires --------------------------------

export type VendorInput = Omit<Vendor, "id" | "updatedAt">;

export function listVendors(): Promise<Vendor[]> {
  return load<Vendor>("vendors");
}

export function addVendor(v: VendorInput): Promise<void> {
  return withLock(async () => {
    const vendors = await load<Vendor>("vendors");
    vendors.push({ ...v, id: randomUUID(), updatedAt: new Date().toISOString() });
    await save("vendors", vendors);
  });
}

export function updateVendor(id: string, v: VendorInput): Promise<void> {
  return withLock(async () => {
    const vendors = await load<Vendor>("vendors");
    const vendor = vendors.find((x) => x.id === id);
    if (!vendor) return;
    Object.assign(vendor, v, { updatedAt: new Date().toISOString() });
    await save("vendors", vendors);
  });
}

export function deleteVendor(id: string): Promise<void> {
  return withLock(async () => {
    const vendors = await load<Vendor>("vendors");
    await save(
      "vendors",
      vendors.filter((x) => x.id !== id),
    );
  });
}
