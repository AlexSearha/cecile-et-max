import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { familyNames, foyerName, groupFamily, groupType, guestRole, listGroups, listMessages, type Guest } from "@/lib/storage";
import { paysForSleep } from "@/lib/shared";
import { isValidToken } from "@/lib/admin";
import { wedding } from "@/lib/config";
import { AddGroupsForm, DeleteMessage, GroupActions, GuestRow } from "../admin-forms";
import { FloralCorner } from "../../florals";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Espace des mariés", robots: { index: false, follow: false } };

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function Status({ g }: { g: Guest }) {
  if (!g.response) return <span className="tag tag-wait">En attente</span>;
  return g.response.attending ? (
    <span className="tag tag-yes">Présent</span>
  ) : (
    <span className="tag tag-no">Absent</span>
  );
}

export default async function AdminPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidToken(token)) notFound(); // lien invalide = page 404

  const [rawGroups, messages] = await Promise.all([listGroups(), listMessages()]);
  const groups = rawGroups
    .map((g) => ({ ...g, name: foyerName(g), kind: groupType(g), fam: groupFamily(g) }))
    .sort(
      (a, b) =>
        (a.fam ?? "\uffff").localeCompare(b.fam ?? "\uffff", "fr") || a.name.localeCompare(b.name, "fr"),
    );
  const families = familyNames(rawGroups);

  // Regroupe les foyers par famille principale (les foyers sans famille restent seuls)
  const blocks: { fam: string | null; foyers: typeof groups }[] = [];
  for (const g of groups) {
    const last = blocks[blocks.length - 1];
    if (g.fam && last && last.fam === g.fam) last.foyers.push(g);
    else blocks.push({ fam: g.fam, foyers: [g] });
  }

  const full = groups.filter((g) => g.kind === "full").flatMap((g) => g.members);
  const vin = groups.filter((g) => g.kind === "vin").flatMap((g) => g.members);
  const answered = full.filter((g) => g.response);
  const present = answered.filter((g) => g.response?.attending);
  const kids = present.filter((g) => g.response?.ageGroup);
  const sleeping = present.filter((g) => g.response?.sleepsOnSite);
  const paying = sleeping.filter((g) => paysForSleep(g.response?.ageGroup ?? null)).length;
  const brunch = present.filter((g) => g.response?.brunch).length;
  const vinPresent = vin.filter((g) => g.response?.attending).length;
  const vinPending = vin.filter((g) => !g.response).length;

  const stats: [string | number, string, string?][] = [
    [full.length, "Invités complets", `${groups.filter((g) => g.kind === "full").length} foyer(s) · ${families.length} famille(s)`],
    [present.length, "Présents", `${answered.length - present.length} absent(s) · ${kids.length} enfant(s)`],
    [full.length - answered.length, "En attente"],
    [`${vinPresent}/${vin.length}`, "Vin d'honneur", `${vinPending} en attente`],
    [sleeping.length, "Dorment sur place", `dont ${sleeping.length - paying} gratuit(s) 0-3 ans`],
    [brunch, "Au brunch"],
    [`${paying * wedding.sleepPrice} €`, "Participations", `${paying} × ${wedding.sleepPrice} €`],
    [messages.length, "Messages"],
  ];

  const yesNo = (g: Guest, v: boolean | undefined) => (g.response?.attending ? (v ? "Oui" : "Non") : "—");

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
        <nav className="admin-nav">
          <a href="#invites">Invités</a>
          <a href="#ajouter">Ajouter</a>
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
            <p className="empty">Aucun invité pour le moment. Ajoutez votre liste ci-dessus.</p>
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
                              · {block.foyers.length} foyer(s) · {people.length} pers. ·{" "}
                              {people.filter((m) => m.response).length}/{people.length} réponse(s)
                            </span>
                          </td>
                        </tr>
                      )}
                      {block.foyers.map((grp) => {
                        const done = grp.members.filter((m) => m.response).length;
                        return (
                          <Fragment key={grp.id}>
                            <tr className={`group-row ${block.fam ? "in-family" : ""}`}>
                              <td colSpan={8}>
                                <div className="group-head">
                                  <span>
                                    <strong>{grp.name}</strong>
                                    <span className={`type-badge ${grp.kind}`}>
                                      {grp.kind === "vin" ? "Vin d'honneur" : "Complète"}
                                    </span>{" "}
                                    <span className="muted">
                                      · {grp.members.length} pers. · {done}/{grp.members.length} réponse(s)
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
                                      {grp.kind === "full" && g.response?.attending
                                        ? g.response.ageGroup
                                          ? `Enfant ${g.response.ageGroup}`
                                          : "Adulte"
                                        : "—"}
                                    </td>
                                    <td>{grp.kind === "full" ? yesNo(g, g.response?.sleepsOnSite) : "—"}</td>
                                    <td>{grp.kind === "full" ? yesNo(g, g.response?.brunch) : "—"}</td>
                                    <td>{g.response ? fmtDateTime(g.response.respondedAt) : "—"}</td>
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
