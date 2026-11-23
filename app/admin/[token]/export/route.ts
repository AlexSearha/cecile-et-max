import { foyerName, groupFamily, groupType, guestRole, listGroups } from "@/lib/storage";
import { ROLE_LABELS } from "@/lib/shared";
import { isValidToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidToken(token)) return new Response("Not found", { status: 404 });

  const groups = await listGroups();
  const header = ["Famille principale", "Foyer", "Rôle", "Invitation", "Nom", "Prénom", "Statut", "Âge", "Dort sur place", "Brunch", "Répondu le"];
  const rows = groups.flatMap((grp) => {
    const full = groupType(grp) === "full";
    return grp.members.map((g, i) => {
      const r = g.response;
      const status = !r ? "En attente" : r.attending ? "Présent" : "Absent";
      const yesNo = (v: boolean | undefined) => (full && r?.attending ? (v ? "Oui" : "Non") : "");
      const age = full && r?.attending ? (r.ageGroup ? `Enfant ${r.ageGroup}` : "Adulte") : "";
      return [
        groupFamily(grp) ?? "",
        foyerName(grp),
        ROLE_LABELS[guestRole(g, i)],
        full ? "Complète" : "Cérémonie + vin d'honneur",
        g.lastName,
        g.firstName,
        status,
        age,
        yesNo(r?.sleepsOnSite),
        yesNo(r?.brunch),
        r?.respondedAt ?? "",
      ]
        .map(cell)
        .join(";");
    });
  });
  // BOM + séparateur ";" pour un affichage correct dans Excel FR
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invites-mariage.csv"',
    },
  });
}
