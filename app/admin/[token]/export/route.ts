import { groupName, listGroups } from "@/lib/storage";
import { isValidToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidToken(token)) return new Response("Not found", { status: 404 });

  const groups = await listGroups();
  const header = ["Groupe", "Nom", "Prénom", "Statut", "Dort sur place", "Brunch", "Répondu le"];
  const rows = groups.flatMap((grp) =>
    grp.members.map((g) => {
      const r = g.response;
      const status = !r ? "En attente" : r.attending ? "Présent" : "Absent";
      const yesNo = (v: boolean | undefined) => (r?.attending ? (v ? "Oui" : "Non") : "");
      return [groupName(grp), g.lastName, g.firstName, status, yesNo(r?.sleepsOnSite), yesNo(r?.brunch), r?.respondedAt ?? ""]
        .map(cell)
        .join(";");
    }),
  );
  // BOM + séparateur ";" pour un affichage correct dans Excel FR
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invites-mariage.csv"',
    },
  });
}
