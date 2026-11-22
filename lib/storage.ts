import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { normalize } from "./text";
import { Redis } from "@upstash/redis";

export type GuestResponse = {
  attending: boolean;
  sleepsOnSite: boolean;
  brunch: boolean; // présent au brunch du lendemain
  respondedAt: string; // ISO
};

export type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  response: GuestResponse | null; // null = pas encore répondu
};

/** Un groupe = une personne seule ou une famille. */
export type Group = {
  id: string;
  label: string | null; // ex. "Famille Martin" (facultatif)
  createdAt: string;
  members: Guest[];
};

export type Person = { firstName: string; lastName: string };

// Deux modes : Upstash Redis si les variables sont définies (obligatoire sur Vercel),
// sinon fichier JSON dans DATA_DIR (local, Docker, Coolify).
const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

const KEY = process.env.REDIS_KEY ?? "mariage:groups";
const LOCK_KEY = `${KEY}:lock`;

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "groups.json");

async function readAll(): Promise<Group[]> {
  if (redis) return (await redis.get<Group[]>(KEY)) ?? [];
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Group[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(groups: Group[]): Promise<void> {
  if (redis) {
    await redis.set(KEY, groups);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(groups, null, 2), "utf8");
  await fs.rename(tmp, FILE);
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

// Verrou distribué : sur Vercel, plusieurs fonctions tournent en parallèle
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

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  return localLock(() => distributedLock(fn));
}

const personKey = (p: Person) => normalize(`${p.firstName} ${p.lastName}`);
const newGuest = (p: Person): Guest => ({
  ...p,
  id: randomUUID(),
  response: null,
});

/** Nom affiché d'un groupe : le libellé, sinon "Prénom Nom" (seul) ou "Famille Nom". */
export function groupName(g: Pick<Group, "label" | "members">): string {
  if (g.label) return g.label;
  if (g.members.length === 1)
    return `${g.members[0].firstName} ${g.members[0].lastName}`;
  return `Famille ${g.members[0]?.lastName ?? ""}`.trim();
}

export function listGroups(): Promise<Group[]> {
  return readAll();
}

/** Ajoute des groupes ; une personne déjà invitée (même prénom + nom) est ignorée. */
export function addGroups(
  input: { label: string | null; members: Person[] }[],
): Promise<{ groups: number; people: number; skipped: number }> {
  return withLock(async () => {
    const groups = await readAll();
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
      groups.push({
        id: randomUUID(),
        label: item.label,
        createdAt: new Date().toISOString(),
        members,
      });
      added++;
      people += members.length;
    }
    await writeAll(groups);
    return { groups: added, people, skipped };
  });
}

/** Admin : ajoute une personne à un groupe existant. */
export function addMember(groupId: string, person: Person): Promise<boolean> {
  return withLock(async () => {
    const groups = await readAll();
    const group = groups.find((g) => g.id === groupId);
    const exists = groups.some((g) =>
      g.members.some((m) => personKey(m) === personKey(person)),
    );
    if (!group || exists) return false;
    group.members.push(newGuest(person));
    await writeAll(groups);
    return true;
  });
}

/**
 * Recherche tolérante (accents, casse) : chaque mot tapé doit débuter
 * un mot du prénom ou du nom d'un membre. Renvoie les groupes entiers.
 */
export async function searchGroups(query: string, limit = 6): Promise<Group[]> {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];
  const groups = await listGroups();
  return groups
    .filter((g) =>
      g.members.some((m) => {
        const words = personKey(m).split(" ");
        return terms.every((t) => words.some((w) => w.startsWith(t)));
      }),
    )
    .slice(0, limit);
}

export type Answer = {
  guestId: string;
  attending: boolean;
  sleepsOnSite: boolean;
  brunch: boolean;
};

/**
 * Enregistre les réponses d'un groupe. Une réponse déjà donnée n'est jamais écrasée.
 * Renvoie le groupe à jour et la liste des personnes enregistrées.
 */
export function recordResponses(
  groupId: string,
  answers: Answer[],
): Promise<{ group: Group; saved: string[] } | null> {
  return withLock(async () => {
    const groups = await readAll();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;
    const saved: string[] = [];
    const now = new Date().toISOString();
    for (const a of answers) {
      const member = group.members.find((m) => m.id === a.guestId);
      if (!member || member.response) continue;
      member.response = {
        attending: a.attending,
        sleepsOnSite: a.attending && a.sleepsOnSite,
        brunch: a.attending && a.brunch,
        respondedAt: now,
      };
      saved.push(member.id);
    }
    if (saved.length) await writeAll(groups);
    return { group, saved };
  });
}

/** Admin : efface la réponse pour que la personne puisse répondre à nouveau. */
export function resetResponse(guestId: string): Promise<void> {
  return withLock(async () => {
    const groups = await readAll();
    const member = groups
      .flatMap((g) => g.members)
      .find((m) => m.id === guestId);
    if (member) {
      member.response = null;
      await writeAll(groups);
    }
  });
}

/** Admin : supprime une personne (et son groupe s'il devient vide). */
export function deleteGuest(guestId: string): Promise<void> {
  return withLock(async () => {
    const groups = await readAll();
    for (const g of groups)
      g.members = g.members.filter((m) => m.id !== guestId);
    await writeAll(groups.filter((g) => g.members.length > 0));
  });
}
