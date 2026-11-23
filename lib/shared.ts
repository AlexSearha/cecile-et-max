// Types et règles partagés entre le serveur et le navigateur (aucun accès disque ici).

/** "full" = invitation complète (dîner, dodo, brunch) ; "vin" = cérémonie + vin d'honneur uniquement */
export type InvitationType = "full" | "vin";

export const AGE_GROUPS = ["0-3", "4-10", "11-18"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const isAgeGroup = (v: unknown): v is AgeGroup =>
  typeof v === "string" && (AGE_GROUPS as readonly string[]).includes(v);

/** Les 0-3 ans dorment gratuitement. */
export const paysForSleep = (ageGroup: AgeGroup | null) => ageGroup !== "0-3";

export const ageLabel = (ageGroup: AgeGroup | null) =>
  ageGroup ? `Enfant ${ageGroup} ans` : "Adulte";

/** Rôle d'une personne dans son foyer. */
export type Role = "referent" | "conjoint" | "enfant" | "fils" | "autre";

export const ROLE_LABELS: Record<Role, string> = {
  referent: "Référent",
  conjoint: "Conjoint(e)",
  enfant: "Enfant",
  fils: "Fils/Fille",
  autre: "Autre",
};

export const isRole = (v: unknown): v is Role =>
  v === "referent" ||
  v === "conjoint" ||
  v === "enfant" ||
  v === "autre" ||
  v === "fils";
