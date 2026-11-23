"use server";

import { addMessage, groupFamily, guestRole, recordResponses, searchGroups, type Answer, type Group } from "@/lib/storage";
import { isAgeGroup, type AgeGroup, type InvitationType, type Role } from "@/lib/shared";
import { normalize } from "@/lib/text";

export type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  response: { attending: boolean; ageGroup: AgeGroup | null; sleepsOnSite: boolean; brunch: boolean } | null;
};

/** Un foyer, avec le nom de sa famille principale (affiché en titre dans les résultats). */
export type Family = { id: string; family: string | null; members: FamilyMember[] };

const toFamily = (g: Group): Family => ({
  id: g.id,
  family: groupFamily(g),
  members: g.members.map((m, i) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    role: guestRole(m, i),
    response: m.response
      ? {
          attending: m.response.attending,
          ageGroup: m.response.ageGroup ?? null,
          sleepsOnSite: m.response.sleepsOnSite,
          brunch: m.response.brunch ?? false,
        }
      : null,
  })),
});

/** Recherche publique : 3 caractères minimum, uniquement parmi les invitations du type demandé. */
export async function findFamilies(query: unknown, type: unknown): Promise<Family[]> {
  if (typeof query !== "string" || query.length > 100) return [];
  if (type !== "full" && type !== "vin") return [];
  if (normalize(query).replace(/ /g, "").length < 3) return [];
  return (await searchGroups(query, type as InvitationType)).map(toFamily);
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
      typeof a.brunch !== "boolean" ||
      !(a.ageGroup === null || isAgeGroup(a.ageGroup))
    ) {
      return { ok: false };
    }
    clean.push({
      guestId: a.guestId,
      attending: a.attending,
      ageGroup: a.ageGroup,
      sleepsOnSite: a.sleepsOnSite,
      brunch: a.brunch,
    });
  }
  const res = await recordResponses(groupId, clean);
  if (!res) return { ok: false };
  return { ok: true, family: toFamily(res.group), saved: res.saved };
}

export type ContactState = { ok?: boolean; error?: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function sendMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  if (str(formData.get("website"))) return { ok: true }; // champ piège anti-robots
  const name = str(formData.get("name"));
  const contact = str(formData.get("contact"));
  const message = str(formData.get("message"));
  if (!name || !message) return { error: "Merci d'indiquer votre nom et votre message." };
  if (name.length > 100 || contact.length > 150 || message.length > 2000) {
    return { error: "Votre message est trop long." };
  }
  await addMessage({ name, contact, message });
  return { ok: true };
}
