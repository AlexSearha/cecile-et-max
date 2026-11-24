"use server";

import { revalidatePath } from "next/cache";
import {
  addGroups,
  addMember,
  addVendor,
  deleteGuest,
  deleteVendor,
  updateVendor,
  deleteMessage,
  resetResponse,
  setGroupFamily,
  setGroupType,
  updateGuest,
} from "@/lib/storage";
import { isValidToken } from "@/lib/admin";
import { isRole, type InvitationType } from "@/lib/shared";
import { parseGuestList, parsePerson, validPerson } from "@/lib/parse-guests";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const asType = (v: string): InvitationType => (v === "vin" ? "vin" : "full");

export type AddState = { message?: string; error?: string };
export type RenameState = { ok?: boolean; error?: string };
export type VendorState = { ok?: boolean; error?: string; nonce?: number };

function refresh(token: string) {
  revalidatePath(`/admin/${token}`);
}

export async function addGroupsAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const token = str(formData.get("token"));
  if (!isValidToken(token)) return { error: "Accès refusé." };

  const foyers = parseGuestList(str(formData.get("groups")));
  if (foyers.length === 0) return { error: "Saisissez au moins un foyer." };

  const bad = foyers.filter((g) => g.members.length === 0 || !g.members.every(validPerson));
  if (bad.length) {
    return { error: `Ligne(s) à corriger (nom manquant ?) : « ${bad.map((g) => g.line).join(" », « ")} »` };
  }

  const type = asType(str(formData.get("type")));
  const res = await addGroups(
    foyers.map(({ family, members }) => ({ family, members })),
    type,
  );
  const families = new Set(foyers.map((f) => f.family).filter(Boolean)).size;
  refresh(token);
  return {
    message:
      `${res.people} personne(s) ajoutée(s) dans ${res.groups} foyer(s)` +
      (families ? `, ${families} famille(s) principale(s)` : "") +
      (type === "vin" ? " (cérémonie + vin d'honneur)" : "") +
      (res.skipped ? `, ${res.skipped} déjà invitée(s) ignorée(s)` : "") +
      ".",
  };
}

export async function addMemberAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const groupId = str(formData.get("groupId"));
  if (!isValidToken(token) || !groupId) return;
  const p = parsePerson(str(formData.get("name")), { lastName: str(formData.get("lastName")) });
  if (!p || !validPerson(p)) return;
  await addMember(groupId, { firstName: p.firstName, lastName: p.lastName, role: p.roleGiven ? p.role : "autre" });
  refresh(token);
}

export async function renameGuestAction(_prev: RenameState, formData: FormData): Promise<RenameState> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return { error: "Accès refusé." };
  const role = str(formData.get("role"));
  const person = {
    firstName: str(formData.get("firstName")),
    lastName: str(formData.get("lastName")),
    role: isRole(role) ? role : "autre",
  };
  if (!validPerson(person)) return { error: "Prénom et nom obligatoires." };
  const res = await updateGuest(id, person);
  if (res === "duplicate") return { error: "Cette personne existe déjà." };
  refresh(token);
  return { ok: true };
}

export async function setGroupTypeAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const groupId = str(formData.get("groupId"));
  if (!isValidToken(token) || !groupId) return;
  await setGroupType(groupId, asType(str(formData.get("type"))));
  refresh(token);
}

export async function setGroupFamilyAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const groupId = str(formData.get("groupId"));
  if (!isValidToken(token) || !groupId) return;
  const family = str(formData.get("family")).slice(0, 80);
  await setGroupFamily(groupId, family || null);
  refresh(token);
}

export async function resetGuestAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await resetResponse(id);
  refresh(token);
}

export async function deleteGuestAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await deleteGuest(id);
  refresh(token);
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await deleteMessage(id);
  refresh(token);
}

// ---------------------------- Prestataires --------------------------------

function vendorFields(formData: FormData) {
  return {
    company: str(formData.get("company")).slice(0, 120),
    phone: str(formData.get("phone")).slice(0, 40),
    contact: str(formData.get("contact")).slice(0, 120),
    comment: str(formData.get("comment")).slice(0, 3000),
  };
}

export async function saveVendorAction(_prev: VendorState, formData: FormData): Promise<VendorState> {
  const token = str(formData.get("token"));
  if (!isValidToken(token)) return { error: "Accès refusé." };
  const v = vendorFields(formData);
  if (!v.company) return { error: "Le nom de l'entreprise est obligatoire." };
  const id = str(formData.get("id"));
  if (id) await updateVendor(id, v);
  else await addVendor(v);
  refresh(token);
  return { ok: true, nonce: Date.now() };
}

export async function deleteVendorAction(formData: FormData): Promise<void> {
  const token = str(formData.get("token"));
  const id = str(formData.get("id"));
  if (!isValidToken(token) || !id) return;
  await deleteVendor(id);
  refresh(token);
}
