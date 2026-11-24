"use client";

import { useState, useTransition, type FormEvent } from "react";
import { findFamilies, submitFamily, type Family, type FamilyMember } from "./actions";
import { AGE_GROUPS, ROLE_LABELS, paysForSleep, type AgeGroup, type InvitationType, type Role } from "@/lib/shared";

type Props = { mode: InvitationType; sleepPrice: number; contact: string };
type YesNo = "oui" | "non" | null;
type Draft = {
  attending: YesNo;
  kind: "adulte" | "enfant" | null;
  age: AgeGroup | null;
  sleeps: YesNo;
  brunch: YesNo;
};
const EMPTY: Draft = { attending: null, kind: null, age: null, sleeps: null, brunch: null };

const fullName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`;

/** Adulte/enfant connu grâce au rôle saisi par les mariés ; sinon la famille le précise. */
const kindFromRole = (role: Role): "adulte" | "enfant" | null =>
  role === "enfant" ? "enfant" : role === "referent" || role === "conjoint" || role === "fils" ? "adulte" : null;

/** Regroupe les foyers trouvés par famille principale, en gardant l'ordre. */
function byFamily(results: Family[]): { family: string | null; foyers: Family[] }[] {
  const out: { family: string | null; foyers: Family[] }[] = [];
  for (const f of results) {
    const last = out[out.length - 1];
    if (last && last.family === f.family && f.family) last.foyers.push(f);
    else out.push({ family: f.family, foyers: [f] });
  }
  return out;
}

export default function RsvpFlow({ mode, sleepPrice, contact }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Family[] | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const restart = () => {
    setFamily(null);
    setResults(null);
    setQuery("");
    setError(null);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (query.trim().length < 3) {
      setError("Tapez au moins 3 lettres de votre nom.");
      return;
    }
    startTransition(async () => setResults(await findFamilies(query, mode)));
  };

  if (family) {
    return (
      <FamilyForm
        key={family.id}
        mode={mode}
        family={family}
        sleepPrice={sleepPrice}
        contact={contact}
        onBack={() => setFamily(null)}
        onRestart={restart}
      />
    );
  }

  return (
    <div className="form">
      <form onSubmit={onSearch}>
        <label>
          Votre nom ou prénom
          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex. : Dupont"
              autoComplete="off"
              maxLength={100}
            />
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "…" : "Rechercher"}
            </button>
          </div>
        </label>
      </form>

      {error && <p className="error">{error}</p>}

      {results && results.length === 0 && (
        <p className="muted center">
          Nous ne trouvons pas ce nom. Vérifiez l&apos;orthographe ou contactez-nous via le formulaire en bas de page
          {contact ? (
            <>
              {" "}
              ou <strong>{contact}</strong>
            </>
          ) : null}
          .
        </p>
      )}

      {results && results.length > 0 && (
        <div className="results-groups">
          {results.length > 1 && <p className="hint center">Choisissez votre foyer :</p>}
          {byFamily(results).map((block) => (
            <div key={block.foyers[0].id} className={block.family ? "family-block" : undefined}>
              {block.family && <p className="family-title">{block.family}</p>}
              <ul className="results">
                {block.foyers.map((f) => {
                  const done = f.members.every((m) => m.response);
                  return (
                    <li key={f.id}>
                      <button type="button" onClick={() => setFamily(f)}>
                        <span className="result-names">
                          {f.members.map((m) => (
                            <span key={m.id}>{fullName(m)}</span>
                          ))}
                        </span>
                        <span className={done ? "tag tag-no" : "arrow"}>{done ? "Déjà répondu" : "→"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponseTags({ r, mode }: { r: NonNullable<FamilyMember["response"]>; mode: InvitationType }) {
  if (!r.attending) return <span className="tag tag-no">Absent(e)</span>;
  return (
    <span className="tags">
      <span className="tag tag-yes">Présent(e)</span>
      {mode === "full" && r.ageGroup && <span className="tag tag-age">{r.ageGroup} ans</span>}
      {r.sleepsOnSite && <span className="tag tag-sleep">Dort sur place</span>}
      {r.brunch && <span className="tag tag-brunch">Brunch</span>}
    </span>
  );
}

function FamilyForm({
  mode,
  family: initial,
  sleepPrice,
  contact,
  onBack,
  onRestart,
}: {
  mode: InvitationType;
  family: Family;
  sleepPrice: number;
  contact: string;
  onBack: () => void;
  onRestart: () => void;
}) {
  const full = mode === "full";
  const [family, setFamily] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const todo = family.members.filter((m) => !m.response);
  const draft = (id: string): Draft => drafts[id] ?? EMPTY;
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...patch } }));

  const filled = todo.filter((m) => draft(m.id).attending);
  const coming = (id: string) => draft(id).attending === "oui";
  const roleOf = (id: string): Role => family.members.find((m) => m.id === id)?.role ?? "autre";
  const kindOf = (id: string) => kindFromRole(roleOf(id)) ?? draft(id).kind;
  const ageOf = (id: string): AgeGroup | null => (kindOf(id) === "enfant" ? draft(id).age : null);
  const payingSleepers = filled.filter(
    (m) => coming(m.id) && draft(m.id).sleeps === "oui" && paysForSleep(ageOf(m.id)),
  ).length;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (filled.length === 0) return setError("Merci de répondre pour au moins une personne.");
    if (full) {
      for (const m of filled.filter((x) => coming(x.id))) {
        const d = draft(m.id);
        if (!kindOf(m.id)) return setError(`Merci d'indiquer si ${m.firstName} est un adulte ou un enfant.`);
        if (kindOf(m.id) === "enfant" && !d.age) return setError(`Merci d'indiquer la tranche d'âge de ${m.firstName}.`);
        if (!d.sleeps) return setError(`Merci d'indiquer si ${m.firstName} dort sur place.`);
        if (!d.brunch) return setError(`Merci d'indiquer si ${m.firstName} sera au brunch.`);
      }
    }

    const answers = filled.map((m) => ({
      guestId: m.id,
      attending: coming(m.id),
      ageGroup: full && coming(m.id) ? ageOf(m.id) : null,
      sleepsOnSite: full && coming(m.id) && draft(m.id).sleeps === "oui",
      brunch: full && coming(m.id) && draft(m.id).brunch === "oui",
    }));
    startTransition(async () => {
      const res = await submitFamily(family.id, answers);
      if (!res.ok) return setError("Une erreur est survenue, merci de réessayer.");
      const saved = res.family.members.filter((m) => res.saved.includes(m.id));
      const nights = saved.filter((m) => m.response?.sleepsOnSite && paysForSleep(m.response.ageGroup)).length;
      setThanks(
        saved.length
          ? `Réponse enregistrée pour ${saved.map((m) => m.firstName).join(", ")}.` +
              (nights ? ` Participation couchage : ${nights} × ${sleepPrice} € = ${nights * sleepPrice} €.` : "")
          : "Ces personnes avaient déjà répondu entre-temps.",
      );
      setFamily(res.family);
      setDrafts({});
    });
  };

  return (
    <form onSubmit={onSubmit} className="form">
      <div className="family-head">
        <p className="kicker">Votre invitation</p>
        {family.family && <p className="family-title">{family.family}</p>}
      </div>

      {thanks && (
        <div className="thanks">
          <p className="notice-title">Merci !</p>
          <p>{thanks}</p>
        </div>
      )}

      <ul className="members-list">
        {family.members.map((m) => {
          const d = draft(m.id);
          const free = !paysForSleep(ageOf(m.id));
          return (
            <li key={m.id} className={`member ${m.response ? "member-done" : ""}`}>
              <div className="member-head">
                <span>
                  <strong>{fullName(m)}</strong>
                  {(m.role === "conjoint" || m.role === "enfant" || m.role === "fils") && (
                    <small className="role">{ROLE_LABELS[m.role]}</small>
                  )}
                </span>
                {m.response && <ResponseTags r={m.response} mode={mode} />}
              </div>
              {!m.response && (
                <>
                  <Choice
                    step={full ? 1 : undefined}
                    legend={full ? "Présence au mariage" : "Présence à la cérémonie et au vin d'honneur"}
                    name={`a-${m.id}`}
                    value={d.attending}
                    options={[
                      ["oui", "Oui"],
                      ["non", "Non"],
                    ]}
                    onChange={(v) => setDraft(m.id, { attending: v })}
                  />
                  {full && coming(m.id) && (
                    <>
                      {!kindFromRole(m.role) && (
                        <Choice
                          sub
                          legend="Adulte ou enfant ?"
                          name={`k-${m.id}`}
                          value={d.kind}
                          options={[
                            ["adulte", "Adulte"],
                            ["enfant", "Enfant"],
                          ]}
                          onChange={(v) => setDraft(m.id, { kind: v, age: v === "adulte" ? null : d.age })}
                        />
                      )}
                      {kindOf(m.id) === "enfant" && (
                        <Choice
                          sub
                          legend="Tranche d'âge"
                          name={`g-${m.id}`}
                          value={d.age}
                          options={AGE_GROUPS.map((g) => [g, `${g} ans`] as [AgeGroup, string])}
                          onChange={(v) => setDraft(m.id, { age: v })}
                        />
                      )}
                      <Choice
                        step={2}
                        legend={free ? "Dormir sur place (gratuit pour les 0-3 ans)" : `Dormir sur place (${sleepPrice} €)`}
                        name={`s-${m.id}`}
                        value={d.sleeps}
                        options={[
                          ["oui", "Oui"],
                          ["non", "Non"],
                        ]}
                        onChange={(v) => setDraft(m.id, { sleeps: v })}
                      />
                      <Choice
                        step={3}
                        legend="Brunch du lendemain"
                        name={`b-${m.id}`}
                        value={d.brunch}
                        options={[
                          ["oui", "Oui"],
                          ["non", "Non"],
                        ]}
                        onChange={(v) => setDraft(m.id, { brunch: v })}
                      />
                    </>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {family.members.some((m) => m.response) && (
        <p className="hint center">
          Les réponses déjà enregistrées ne peuvent plus être modifiées en ligne. Pour un changement, écrivez-nous via
          le formulaire de contact{contact ? <> ou contactez <strong>{contact}</strong></> : null}.
        </p>
      )}

      {todo.length > 0 ? (
        <>
          {full && payingSleepers > 0 && (
            <p className="total">
              Participation couchage : {payingSleepers} × {sleepPrice} € ={" "}
              <strong>{payingSleepers * sleepPrice} €</strong>
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Envoi…" : filled.length > 1 ? `Envoyer les ${filled.length} réponses` : "Envoyer ma réponse"}
          </button>
          {!thanks && (
            <button type="button" className="link" onClick={onBack}>
              Ce n&apos;est pas moi, revenir aux résultats
            </button>
          )}
        </>
      ) : (
        !thanks && <p className="center">Tout le monde a déjà répondu, merci !</p>
      )}

      {(thanks || todo.length === 0) && (
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          Nouvelle recherche
        </button>
      )}
    </form>
  );
}

function Choice<V extends string>({
  step,
  sub,
  legend,
  name,
  value,
  options,
  onChange,
}: {
  step?: number;
  sub?: boolean;
  legend: string;
  name: string;
  value: V | null;
  options: [V, string][];
  onChange: (v: V) => void;
}) {
  return (
    <fieldset className={`choice-row ${sub ? "choice-sub" : ""}`}>
      <legend>
        {step !== undefined && <span className="step">{step}</span>}
        {legend}
      </legend>
      <div className="choices">
        {options.map(([v, label]) => (
          <label key={v} className="choice">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
