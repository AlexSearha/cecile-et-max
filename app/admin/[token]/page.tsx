import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  familyNames,
  foyerName,
  groupFamily,
  groupType,
  guestRole,
  listGroups,
  listMessages,
  listVendors,
  type Guest,
} from "@/lib/storage";
import { AGE_GROUPS, paysForSleep, type AgeGroup } from "@/lib/shared";
import { isValidToken } from "@/lib/admin";
import { wedding } from "@/lib/config";
import {
  AddGroupsForm,
  DeleteMessage,
  GroupActions,
  GuestRow,
  VendorForm,
  VendorRow,
} from "../admin-forms";
import { FloralCorner } from "../../florals";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Espace des mariés",
  robots: { index: false, follow: false },
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

function Status({ g }: { g: Guest }) {
  if (!g.response) return <span className="tag tag-wait">En attente</span>;
  return g.response.attending ? (
    <span className="tag tag-yes">Présent</span>
  ) : (
    <span className="tag tag-no">Absent</span>
  );
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidToken(token)) notFound(); // lien invalide = page 404

  const [rawGroups, messages, vendors] = await Promise.all([
    listGroups(),
    listMessages(),
    listVendors(),
  ]);
  const groups = rawGroups
    .map((g) => ({
      ...g,
      name: foyerName(g),
      kind: groupType(g),
      fam: groupFamily(g),
    }))
    .sort(
      (a, b) =>
        (a.fam ?? "\uffff").localeCompare(b.fam ?? "\uffff", "fr") ||
        a.name.localeCompare(b.name, "fr"),
    );
  const families = familyNames(rawGroups);

  // Regroupe les foyers par famille principale (les foyers sans famille restent seuls)
  const blocks: { fam: string | null; foyers: typeof groups }[] = [];
  for (const g of groups) {
    const last = blocks[blocks.length - 1];
    if (g.fam && last && last.fam === g.fam) last.foyers.push(g);
    else blocks.push({ fam: g.fam, foyers: [g] });
  }

  const full = groups
    .filter((g) => g.kind === "full")
    .flatMap((g) => g.members);
  const vin = groups.filter((g) => g.kind === "vin").flatMap((g) => g.members);
  const answered = full.filter((g) => g.response);
  const present = answered.filter((g) => g.response?.attending);
  const kids = present.filter((g) => g.response?.ageGroup);
  const sleeping = present.filter((g) => g.response?.sleepsOnSite);
  const paying = sleeping.filter((g) =>
    paysForSleep(g.response?.ageGroup ?? null),
  ).length;
  const brunch = present.filter((g) => g.response?.brunch).length;
  const vinPresent = vin.filter((g) => g.response?.attending).length;
  const vinPending = vin.filter((g) => !g.response).length;

  const stats: [string | number, string, string?][] = [
    [
      full.length,
      "Invités complets",
      `${groups.filter((g) => g.kind === "full").length} foyer(s) · ${families.length} famille(s)`,
    ],
    [
      present.length,
      "Présents",
      `${answered.length - present.length} absent(s) · ${kids.length} enfant(s)`,
    ],
    [full.length - answered.length, "En attente"],
    [
      `${vinPresent}/${vin.length}`,
      "Vin d'honneur",
      `${vinPending} en attente`,
    ],
    [
      sleeping.length,
      "Dorment sur place",
      `dont ${sleeping.length - paying} gratuit(s) 0-3 ans`,
    ],
    [brunch, "Au brunch"],
    [
      `${paying * wedding.sleepPrice} €`,
      "Participations",
      `${paying} × ${wedding.sleepPrice} €`,
    ],
    [messages.length, "Messages"],
  ];

  // ---- Bilan par tranche d'âge (invitations complètes, personnes présentes) ----
  const bilanRows: { label: string; age: AgeGroup | null }[] = [
    { label: "Adultes", age: null },
    ...[...AGE_GROUPS]
      .reverse()
      .map((a) => ({ label: `Enfants ${a} ans`, age: a })),
  ];
  const bilan = bilanRows.map(({ label, age }) => {
    const people = present.filter(
      (g) => (g.response?.ageGroup ?? null) === age,
    );
    return {
      label,
      present: people.length,
      sleeping: people.filter((g) => g.response?.sleepsOnSite).length,
      brunch: people.filter((g) => g.response?.brunch).length,
      paying:
        age === "0-3"
          ? 0
          : people.filter((g) => g.response?.sleepsOnSite).length,
    };
  });
  const bilanTotal = {
    present: present.length,
    sleeping: sleeping.length,
    brunch,
    paying,
  };
  const pendingFull = full.length - answered.length;

  const yesNo = (g: Guest, v: boolean | undefined) =>
    g.response?.attending ? (v ? "Oui" : "Non") : "—";

  return (
    <main>
      <header className="hero hero-small">
        <FloralCorner className="left" />
        <FloralCorner className="right" />
        <div className="hero-content">
          <p className="kicker">Espace des mariés</p>
          <h1>{wedding.couple}</h1>
        </div>
      </header>

      <div className="page admin">
        <nav className="admin-nav top-lg">
          <a href="#invites">Invités</a>
          <a href="#ajouter">Ajouter</a>
          <a href="#bilan">Bilan</a>
          <a href="#prestataires">Prestataires ({vendors.length})</a>
          <a href="#messages">Messages ({messages.length})</a>
        </nav>

        <div className="stats">
          {stats.map(([value, label, sub]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
              {sub && <small>{sub}</small>}
            </div>
          ))}
        </div>

        <section className="card links-box">
          <h3>Liens à envoyer</h3>
          <span>
            Invitation complète : <code>/</code>
          </span>
          <span>
            Cérémonie + vin d&apos;honneur : <code>/vin-honneur</code>
          </span>
        </section>

        <section className="card" id="ajouter">
          <h3>Ajouter des invités</h3>
          <AddGroupsForm token={token} />
        </section>

        <div className="toolbar" id="invites">
          <h3>Liste des invités</h3>
          <a href={`/admin/${token}/export`}>Exporter en CSV ↓</a>
        </div>

        <div className="table-wrap">
          {groups.length === 0 ? (
            <p className="empty">
              Aucun invité pour le moment. Ajoutez votre liste ci-dessus.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Statut</th>
                  <th>Âge</th>
                  <th>Dort sur place</th>
                  <th>Brunch</th>
                  <th>Répondu le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => {
                  const people = block.foyers.flatMap((f) => f.members);
                  return (
                    <Fragment key={block.foyers[0].id}>
                      {block.fam && (
                        <tr className="family-row">
                          <td colSpan={8}>
                            <strong>{block.fam}</strong>{" "}
                            <span className="muted">
                              · {block.foyers.length} foyer(s) · {people.length}{" "}
                              pers. · {people.filter((m) => m.response).length}/
                              {people.length} réponse(s)
                            </span>
                          </td>
                        </tr>
                      )}
                      {block.foyers.map((grp) => {
                        const done = grp.members.filter(
                          (m) => m.response,
                        ).length;
                        return (
                          <Fragment key={grp.id}>
                            <tr
                              className={`group-row ${block.fam ? "in-family" : ""}`}
                            >
                              <td colSpan={8}>
                                <div className="group-head">
                                  <span>
                                    <strong>{grp.name}</strong>
                                    <span className={`type-badge ${grp.kind}`}>
                                      {grp.kind === "vin"
                                        ? "Vin d'honneur"
                                        : "Complète"}
                                    </span>{" "}
                                    <span className="muted">
                                      · {grp.members.length} pers. · {done}/
                                      {grp.members.length} réponse(s)
                                    </span>
                                  </span>
                                  <GroupActions
                                    token={token}
                                    groupId={grp.id}
                                    lastName={grp.members[0].lastName}
                                    type={grp.kind}
                                    family={grp.fam}
                                    families={families}
                                  />
                                </div>
                              </td>
                            </tr>
                            {grp.members.map((g, i) => (
                              <GuestRow
                                key={g.id}
                                token={token}
                                id={g.id}
                                firstName={g.firstName}
                                lastName={g.lastName}
                                role={guestRole(g, i)}
                                responded={!!g.response}
                                cells={
                                  <>
                                    <td>
                                      <Status g={g} />
                                    </td>
                                    <td>
                                      {grp.kind === "full" &&
                                      g.response?.attending
                                        ? g.response.ageGroup
                                          ? `Enfant ${g.response.ageGroup}`
                                          : "Adulte"
                                        : "—"}
                                    </td>
                                    <td>
                                      {grp.kind === "full"
                                        ? yesNo(g, g.response?.sleepsOnSite)
                                        : "—"}
                                    </td>
                                    <td>
                                      {grp.kind === "full"
                                        ? yesNo(g, g.response?.brunch)
                                        : "—"}
                                    </td>
                                    <td>
                                      {g.response
                                        ? fmtDateTime(g.response.respondedAt)
                                        : "—"}
                                    </td>
                                  </>
                                }
                              />
                            ))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="toolbar" id="bilan">
          <h3>Bilan pour les prestataires</h3>
        </div>
        <div className="table-wrap">
          <table className="bilan">
            <thead>
              <tr>
                <th>Tranche d&apos;âge</th>
                <th>Présents au mariage</th>
                <th>Dorment sur place</th>
                <th>dont payants</th>
                <th>Brunch</th>
              </tr>
            </thead>
            <tbody>
              {bilan.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.present}</td>
                  <td>{r.sleeping}</td>
                  <td>{r.paying}</td>
                  <td>{r.brunch}</td>
                </tr>
              ))}
              <tr className="bilan-total">
                <td>Total</td>
                <td>{bilanTotal.present}</td>
                <td>{bilanTotal.sleeping}</td>
                <td>
                  {bilanTotal.paying} ({bilanTotal.paying * wedding.sleepPrice}{" "}
                  €)
                </td>
                <td>{bilanTotal.brunch}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint bilan-note">
          Basé sur les réponses reçues des invitations complètes. Encore{" "}
          {pendingFull} personne(s) en attente de réponse. Cérémonie + vin
          d&apos;honneur : {vinPresent} présent(s) en plus ({vinPending} en
          attente).
        </p>

        <div className="toolbar" id="prestataires">
          <h3>Prestataires ({vendors.length})</h3>
        </div>
        <div className="table-wrap">
          {vendors.length === 0 ? (
            <p className="empty">Aucun prestataire pour le moment.</p>
          ) : (
            <table className="vendors">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Téléphone</th>
                  <th>Contact</th>
                  <th>Dernière mise à jour</th>
                  <th>Commentaires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...vendors]
                  .sort((a, b) => a.company.localeCompare(b.company, "fr"))
                  .map((v) => (
                    <VendorRow
                      key={v.id}
                      token={token}
                      vendor={v}
                      updatedLabel={fmtDateTime(v.updatedAt)}
                    />
                  ))}
              </tbody>
            </table>
          )}
        </div>
        <section className="card">
          <h3>Ajouter un prestataire</h3>
          <VendorForm token={token} />
        </section>

        <div className="toolbar" id="messages">
          <h3>Messages ({messages.length})</h3>
        </div>
        <div className="messages">
          {messages.length === 0 ? (
            <p className="empty card">Aucun message pour le moment.</p>
          ) : (
            [...messages].reverse().map((m) => (
              <article className="message" key={m.id}>
                <div className="message-head">
                  <span>
                    <strong>{m.name}</strong>
                    {m.contact && <span className="muted"> · {m.contact}</span>}
                  </span>
                  <span className="group-actions">
                    <small>{fmtDateTime(m.createdAt)}</small>
                    <DeleteMessage token={token} id={m.id} />
                  </span>
                </div>
                <p>{m.message}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
