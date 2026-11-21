"use server";

import { groupName, recordResponses, searchGroups, type Answer, type Group } from "@/lib/storage";
import { normalize } from "@/lib/text";

export type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  response: { attending: boolean; sleepsOnSite: boolean; brunch: boolean } | null;
};

export type Family = { id: string; name: string; members: FamilyMember[] };

const toFamily = (g: Group): Family => ({
  id: g.id,
  name: groupName(g),
  members: g.members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    response: m.response
      ? { attending: m.response.attending, sleepsOnSite: m.response.sleepsOnSite, brunch: m.response.brunch ?? false }
      : null,
  })),
});

/** Recherche publique : 3 caractères minimum, renvoie les familles correspondantes. */
export async function findFamilies(query: unknown): Promise<Family[]> {
  if (typeof query !== "string" || query.length > 100) return [];
  if (normalize(query).replace(/ /g, "").length < 3) return [];
  return (await searchGroups(query)).map(toFamily);
}

export async function submitFamily(
  groupId: unknown,
  answers: unknown,
): Promise<{ ok: true; family: Family; saved: string[] } | { ok: false }> {
  if (typeof groupId !== "string" || !Array.isArray(answers) || answers.length === 0 || answers.length > 50) {
    return { ok: false };
  }
  const clean: Answer[] = [];
  for (const a of answers as Record<string, unknown>[]) {
    if (
      !a ||
      typeof a.guestId !== "string" ||
      typeof a.attending !== "boolean" ||
      typeof a.sleepsOnSite !== "boolean" ||
      typeof a.brunch !== "boolean"
    ) {
      return { ok: false };
    }
    clean.push({ guestId: a.guestId, attending: a.attending, sleepsOnSite: a.sleepsOnSite, brunch: a.brunch });
  }
  const res = await recordResponses(groupId, clean);
  if (!res) return { ok: false };
  return { ok: true, family: toFamily(res.group), saved: res.saved };
}
