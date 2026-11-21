"use client";

import { useState, useTransition, type FormEvent } from "react";
import { findFamilies, submitFamily, type Family, type FamilyMember } from "./actions";

type Props = { sleepPrice: number; contact: string };
type YesNo = "oui" | "non" | null;
type Draft = { attending: YesNo; sleeps: YesNo; brunch: YesNo };

export default function RsvpFlow({ sleepPrice, contact }: Props) {
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
    startTransition(async () => setResults(await findFamilies(query)));
  };

  if (family) {
    return (
      <FamilyForm
        key={family.id}
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
          Nous ne trouvons pas ce nom. Vérifiez l&apos;orthographe ou contactez <strong>{contact}</strong>.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="results">
          {results.map((f) => {
            const done = f.members.every((m) => m.response);
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setFamily(f)}>
                  <span>
                    <strong>{f.name}</strong>
                    {f.members.length > 1 && (
                      <small className="members">{f.members.map((m) => m.firstName).join(", ")}</small>
                    )}
                  </span>
                  <span className={done ? "tag tag-no" : "arrow"}>{done ? "Déjà répondu" : "→"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResponseTags({ r }: { r: NonNullable<FamilyMember["response"]> }) {
  if (!r.attending) return <span className="tag tag-no">Absent(e)</span>;
  return (
    <span className="tags">
      <span className="tag tag-yes">Présent(e)</span>
      {r.sleepsOnSite && <span className="tag tag-sleep">Dort sur place</span>}
      {r.brunch && <span className="tag tag-brunch">Brunch</span>}
    </span>
  );
}

function FamilyForm({
  family: initial,
  sleepPrice,
  contact,
  onBack,
  onRestart,
}: {
  family: Family;
  sleepPrice: number;
  contact: string;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [family, setFamily] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const todo = family.members.filter((m) => !m.response);
  const draft = (id: string): Draft => drafts[id] ?? { attending: null, sleeps: null, brunch: null };
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...patch } }));

  const filled = todo.filter((m) => draft(m.id).attending);
  const coming = (id: string) => draft(id).attending === "oui";
  const sleepers = filled.filter((m) => coming(m.id) && draft(m.id).sleeps === "oui").length;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (filled.length === 0) return setError("Merci de répondre pour au moins une personne.");
    const noSleep = filled.find((m) => coming(m.id) && !draft(m.id).sleeps);
    if (noSleep) return setError(`Merci d'indiquer si ${noSleep.firstName} dort sur place.`);
    const noBrunch = filled.find((m) => coming(m.id) && !draft(m.id).brunch);
    if (noBrunch) return setError(`Merci d'indiquer si ${noBrunch.firstName} sera au brunch.`);

    const answers = filled.map((m) => ({
      guestId: m.id,
      attending: coming(m.id),
      sleepsOnSite: coming(m.id) && draft(m.id).sleeps === "oui",
      brunch: coming(m.id) && draft(m.id).brunch === "oui",
    }));
    startTransition(async () => {
      const res = await submitFamily(family.id, answers);
      if (!res.ok) return setError("Une erreur est survenue, merci de réessayer.");
      const saved = res.family.members.filter((m) => res.saved.includes(m.id));
      const nights = saved.filter((m) => m.response?.sleepsOnSite).length;
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
        <h3>{family.name}</h3>
      </div>

      {thanks && (
        <div className="thanks">
          <p className="notice-title">Merci !</p>
          <p>{thanks}</p>
        </div>
      )}

      <ul className="members-list">
        {family.members.map((m) => (
          <li key={m.id} className={`member ${m.response ? "member-done" : ""}`}>
            <div className="member-head">
              <strong>
                {m.firstName} {m.lastName}
              </strong>
              {m.response && <ResponseTags r={m.response} />}
            </div>
            {!m.response && (
              <>
                <Choice
                  step={1}
                  legend="Présence au mariage"
                  name={`a-${m.id}`}
                  value={draft(m.id).attending}
                  onChange={(v) => setDraft(m.id, { attending: v })}
                />
                {coming(m.id) && (
                  <>
                    <Choice
                      step={2}
                      legend={`Dormir sur place (${sleepPrice} €)`}
                      name={`s-${m.id}`}
                      value={draft(m.id).sleeps}
                      onChange={(v) => setDraft(m.id, { sleeps: v })}
                    />
                    <Choice
                      step={3}
                      legend="Brunch du lendemain"
                      name={`b-${m.id}`}
                      value={draft(m.id).brunch}
                      onChange={(v) => setDraft(m.id, { brunch: v })}
                    />
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {family.members.some((m) => m.response) && (
        <p className="hint center">
          Les réponses déjà enregistrées ne peuvent plus être modifiées en ligne. Pour un changement, contactez{" "}
          <strong>{contact}</strong>.
        </p>
      )}

      {todo.length > 0 ? (
        <>
          {sleepers > 0 && (
            <p className="total">
              Participation couchage : {sleepers} × {sleepPrice} € = <strong>{sleepers * sleepPrice} €</strong>
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Envoi…" : filled.length > 1 ? `Envoyer les ${filled.length} réponses` : "Envoyer ma réponse"}
          </button>
          {!thanks && (
            <button type="button" className="link" onClick={onBack}>
              Ce n&apos;est pas ma famille, revenir aux résultats
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

function Choice({
  step,
  legend,
  name,
  value,
  onChange,
}: {
  step: number;
  legend: string;
  name: string;
  value: YesNo;
  onChange: (v: "oui" | "non") => void;
}) {
  return (
    <fieldset className="choice-row">
      <legend>
        <span className="step">{step}</span>
        {legend}
      </legend>
      <div className="choices">
        {(["oui", "non"] as const).map((v) => (
          <label key={v} className="choice">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{v === "oui" ? "Oui" : "Non"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
