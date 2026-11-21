"use server";

import { revalidatePath } from "next/cache";
import { addGroups, addMember, deleteGuest, resetResponse, type Person } from "@/lib/storage";
import { isValidToken } from "@/lib/admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type AddState = { message?: string; error?: string };

/**
 * Une personne : "Prénom Nom" (le premier mot est le prénom)
 * ou "Prénom ; Nom" pour un prénom composé avec espace.
 * Un prénom seul reprend le nom de la personne précédente du groupe.
 */
function parsePerson(raw: string, previous?: Person): Person | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes(";")) {
    const [first, ...rest] = s.split(";");
    return { firstName: first.trim(), lastName: rest.join(" ").trim() };
  }
  const [first, ...rest] = s.split(/\s+/);
  const lastName = rest.join(" ") || previous?.lastName || "";
  return { firstName: first, lastName };
}

/**
 * Un groupe par ligne :
 *   Julie Bernard                                   -> personne seule
 *   Sophie Martin, Paul, Léa                        -> famille (Paul et Léa Martin)
 *   Famille Le Goff : Yann Le Goff, Anne            -> famille avec un libellé
 */
function parseGroups(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let label: string | null = null;
      let rest = line;
      const colon = line.indexOf(":");
      if (colon > 0) {
        label = line.slice(0, colon).trim() || null;
        rest = line.slice(colon + 1);
      }
      const members: Person[] = [];
      for (const part of rest.split(",")) {
        const p = parsePerson(part, members[members.length - 1]);
        if (p) members.push(p);
      }
      return { line, label, members };
    });
}

const validPerson = (p: Person) =>
  p.firstName.length > 0 && p.lastName.length > 0 && p.firstName.length <= 80 && p.lastName.length <= 80;

export async function addGroupsAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const token = str(formData.get("token"));
  if (!isValidToken(token)) return { error: "Accès refusé." };

  const groups = parseGroups(str(formData.get("groups")));
  if (groups.length === 0) return { error: "Saisissez au moins une ligne." };

  const bad = groups.filter((g) => g.members.length === 0 || !g.members.every(validPerson));
  if (bad.length) {
    return { error: `Ligne(s) à corriger (nom manquant ?) : « ${bad.map((g) => g.line).join(" », « ")} »` };
  }

  const res = await addGroups(groups.map(({ label, members }) => ({ label, members })));
  revalidatePath(`/admin/${token}`);
  return {
    message:
      `${res.people} personne(s) ajoutée(s) dans ${res.groups} groupe(s)` +
      (res.skipped ? `, ${res.skipped} déjà invitée(s) ignorée(s)` : "") +
      ".",
  };
}

export async function addMemberAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const groupId = str(formData.get("groupId"));
  if (!isValidToken(token) || !groupId) return;
  const p = parsePerson(str(formData.get("name")), { firstName: "", lastName: str(formData.get("lastName")) });
  if (!p || !validPerson(p)) return;
  await addMember(groupId, p);
  revalidatePath(`/admin/${token}`);
}

export async function resetGuestAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await resetResponse(id);
  revalidatePath(`/admin/${token}`);
}

export async function deleteGuestAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await deleteGuest(id);
  revalidatePath(`/admin/${token}`);
}
