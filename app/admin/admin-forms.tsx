"use client";

import { useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ROLE_LABELS, type Role } from "@/lib/shared";
import {
  addGroupsAction,
  addMemberAction,
  deleteGuestAction,
  deleteMessageAction,
  renameGuestAction,
  resetGuestAction,
  setGroupFamilyAction,
  setGroupTypeAction,
  type AddState,
  type RenameState,
} from "./actions";

const confirmSubmit = (message: string) => (e: FormEvent) => {
  if (!confirm(message)) e.preventDefault();
};

function Hidden({ token, fields }: { token: string; fields: Record<string, string> }) {
  return (
    <>
      <input type="hidden" name="token" value={token} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

export function AddGroupsForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addGroupsAction, {});
  return (
    <form action={action} className="form">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend>Type d&apos;invitation</legend>
        <div className="type-pick">
          <label className="choice">
            <input type="radio" name="type" value="full" defaultChecked />
            <span>Complète (présence, dodo, brunch)</span>
          </label>
          <label className="choice">
            <input type="radio" name="type" value="vin" />
            <span>Cérémonie + vin d&apos;honneur</span>
          </label>
        </div>
      </fieldset>
      <label>
        Un foyer par ligne
        <textarea
          name="groups"
          rows={8}
          placeholder={
            "Famille Dupond :\nJean Dupond, Marie Durand\nPaul Dupond, Julie, Léo, Emma\nMarc Dupond, Thomas Petit, Hugo (enfant)\n\nJulie Bernard"
          }
        />
      </label>
      <ul className="hint help">
        <li>
          <strong>Un foyer par ligne</strong>, personnes séparées par des virgules. Sans précision : 1<sup>re</sup>{" "}
          personne = référent, 2<sup>e</sup> = conjoint(e), suivantes = enfants.
        </li>
        <li>
          <strong>Rôle</strong> entre parenthèses si besoin : <code>(conjoint)</code> <code>(conjointe)</code>{" "}
          <code>(enfant)</code> <code>(autre)</code>
        </li>
        <li>
          <strong>Famille principale</strong> : une ligne <code>Famille Dupond :</code> puis ses foyers ; une ligne
          vide termine la famille. Ou sur une ligne : <code>Famille Roux : Marc Roux, Lou</code>
        </li>
        <li>
          Un prénom seul reprend le nom du référent : <code>Paul Dupond, Julie, Léo</code>. Prénom composé :{" "}
          <code>Jean Pierre ; Martin</code>
        </li>
      </ul>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p className="ok">{state.message}</p>}
      <button className="btn" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter à la liste"}
      </button>
    </form>
  );
}

export function GroupActions({
  token,
  groupId,
  lastName,
  type,
  family,
  families,
}: {
  token: string;
  groupId: string;
  lastName: string;
  type: "full" | "vin";
  family: string | null;
  families: string[];
}) {
  const next = type === "full" ? "vin" : "full";
  const listId = `families-${groupId}`;
  return (
    <div className="group-actions">
      <form action={setGroupFamilyAction} className="add-member move-family">
        <Hidden token={token} fields={{ groupId }} />
        <input
          name="family"
          defaultValue={family ?? ""}
          placeholder="Famille principale…"
          list={listId}
          maxLength={80}
        />
        <datalist id={listId}>
          {families.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <button className="mini">OK</button>
      </form>
      <form action={addMemberAction} className="add-member">
        <Hidden token={token} fields={{ groupId, lastName }} />
        <input name="name" placeholder="Ajouter : Prénom (enfant)…" maxLength={160} required />
        <button className="mini">+ Ajouter</button>
      </form>
      <form
        action={setGroupTypeAction}
        onSubmit={confirmSubmit(
          next === "vin"
            ? "Passer ce groupe en « cérémonie + vin d'honneur » ? Il ne sera plus trouvé sur le site principal."
            : "Passer ce groupe en invitation complète ? Il ne sera plus trouvé sur la page vin d'honneur.",
        )}
      >
        <Hidden token={token} fields={{ groupId, type: next }} />
        <button className="mini">{next === "vin" ? "→ Vin d'honneur" : "→ Invitation complète"}</button>
      </form>
    </div>
  );
}

/** Ligne du tableau avec modification du prénom / nom sur place. */
export function GuestRow({
  token,
  id,
  firstName,
  lastName,
  role,
  responded,
  cells,
}: {
  token: string;
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  responded: boolean;
  cells: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<RenameState, FormData>(renameGuestAction, {});
  const name = `${firstName} ${lastName}`;

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <tr className="editing">
        <td colSpan={2}>
          <form action={action} className="edit-name add-member">
            <Hidden token={token} fields={{ id }} />
            <input name="firstName" defaultValue={firstName} placeholder="Prénom" required maxLength={80} />
            <input name="lastName" defaultValue={lastName} placeholder="Nom" required maxLength={80} />
            <select name="role" defaultValue={role}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button className="mini" disabled={pending}>
              Enregistrer
            </button>
            <button type="button" className="mini del" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </form>
          {state.error && <p className="error">{state.error}</p>}
        </td>
        {cells}
        <td />
      </tr>
    );
  }

  return (
    <tr>
      <td>{lastName}</td>
      <td>
        {firstName}
        {role !== "referent" && <span className="role-tag">{ROLE_LABELS[role]}</span>}
      </td>
      {cells}
      <td>
        <div className="row-actions">
          <button type="button" className="mini" onClick={() => setEditing(true)}>
            Modifier
          </button>
          {responded && (
            <form
              action={resetGuestAction}
              onSubmit={confirmSubmit(`Effacer la réponse de ${name} ? Il/elle pourra répondre à nouveau.`)}
            >
              <Hidden token={token} fields={{ id }} />
              <button className="mini">Réinitialiser</button>
            </form>
          )}
          <form action={deleteGuestAction} onSubmit={confirmSubmit(`Supprimer ${name} de la liste ?`)}>
            <Hidden token={token} fields={{ id }} />
            <button className="mini del">Supprimer</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

export function DeleteMessage({ token, id }: { token: string; id: string }) {
  return (
    <form action={deleteMessageAction} onSubmit={confirmSubmit("Supprimer ce message ?")}>
      <Hidden token={token} fields={{ id }} />
      <button className="mini del">Supprimer</button>
    </form>
  );
}
