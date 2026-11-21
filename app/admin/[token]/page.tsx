import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { groupName, listGroups, type Guest } from "@/lib/storage";
import { isValidToken } from "@/lib/admin";
import { wedding } from "@/lib/config";
import { AddGroupsForm, AddMemberForm, RowActions } from "../admin-forms";
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

  const groups = (await listGroups())
    .map((g) => ({ ...g, name: groupName(g) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const guests = groups.flatMap((g) => g.members);
  const answered = guests.filter((g) => g.response);
  const present = answered.filter((g) => g.response?.attending).length;
  const sleeping = answered.filter((g) => g.response?.sleepsOnSite).length;
  const brunch = answered.filter((g) => g.response?.brunch).length;

  const stats: [string | number, string, string?][] = [
    [guests.length, "Invités", `${groups.length} groupe(s)`],
    [present, "Présents", `${answered.length - present} absent(s)`],
    [guests.length - answered.length, "En attente"],
    [sleeping, "Dorment sur place"],
    [brunch, "Au brunch"],
    [`${sleeping * wedding.sleepPrice} €`, "Participations"],
  ];

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
        <div className="stats">
          {stats.map(([value, label, sub]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
              {sub && <small>{sub}</small>}
            </div>
          ))}
        </div>

        <section className="card">
          <h3>Ajouter des invités</h3>
          <AddGroupsForm token={token} />
        </section>

        <div className="toolbar">
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
                  <th>Dort sur place</th>
                  <th>Brunch</th>
                  <th>Répondu le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((grp) => {
                  const done = grp.members.filter((m) => m.response).length;
                  return (
                    <Fragment key={grp.id}>
                      <tr className="group-row">
                        <td colSpan={7}>
                          <div className="group-head">
                            <span>
                              <strong>{grp.name}</strong>{" "}
                              <span className="muted">
                                · {grp.members.length} pers. · {done}/{grp.members.length} réponse(s)
                              </span>
                            </span>
                            <AddMemberForm token={token} groupId={grp.id} lastName={grp.members[0].lastName} />
                          </div>
                        </td>
                      </tr>
                      {grp.members.map((g) => (
                        <tr key={g.id}>
                          <td>{g.lastName}</td>
                          <td>{g.firstName}</td>
                          <td>
                            <Status g={g} />
                          </td>
                          <td>{g.response?.attending ? (g.response.sleepsOnSite ? "Oui" : "Non") : "—"}</td>
                          <td>{g.response?.attending ? (g.response.brunch ? "Oui" : "Non") : "—"}</td>
                          <td>{g.response ? fmtDateTime(g.response.respondedAt) : "—"}</td>
                          <td>
                            <RowActions
                              token={token}
                              id={g.id}
                              responded={!!g.response}
                              name={`${g.firstName} ${g.lastName}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
