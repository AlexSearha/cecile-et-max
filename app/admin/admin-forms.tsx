"use client";

import { useActionState } from "react";
import {
  addGroupsAction,
  addMemberAction,
  deleteGuestAction,
  resetGuestAction,
  type AddState,
} from "./actions";

export function AddGroupsForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addGroupsAction, {});
  return (
    <form action={action} className="form">
      <input type="hidden" name="token" value={token} />
      <label>
        Un groupe par ligne
        <textarea
          name="groups"
          rows={6}
          placeholder={"Julie Bernard\nSophie Martin, Paul, Léa\nFamille Le Goff : Yann Le Goff, Anne, Jean Pierre ; Le Goff"}
        />
      </label>
      <ul className="hint help">
        <li>
          <strong>Personne seule</strong> : <code>Julie Bernard</code>
        </li>
        <li>
          <strong>Famille</strong> : personnes séparées par des virgules. Un prénom seul reprend le nom précédent :{" "}
          <code>Sophie Martin, Paul, Léa</code>
        </li>
        <li>
          <strong>Nom de famille affiché</strong> (facultatif) : <code>Famille Le Goff : Yann Le Goff, Anne</code>
        </li>
        <li>
          Prénom composé avec espace : <code>Jean Pierre ; Martin</code>
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

export function AddMemberForm({ token, groupId, lastName }: { token: string; groupId: string; lastName: string }) {
  return (
    <form action={addMemberAction} className="add-member">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="lastName" value={lastName} />
      <input name="name" placeholder="Ajouter un prénom…" maxLength={160} required />
      <button className="mini">+ Ajouter</button>
    </form>
  );
}

export function RowActions({
  token,
  id,
  responded,
  name,
}: {
  token: string;
  id: string;
  responded: boolean;
  name: string;
}) {
  return (
    <div className="row-actions">
      {responded && (
        <form
          action={resetGuestAction}
          onSubmit={(e) => {
            if (!confirm(`Effacer la réponse de ${name} ? Il/elle pourra répondre à nouveau.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="id" value={id} />
          <button className="mini">Réinitialiser</button>
        </form>
      )}
      <form
        action={deleteGuestAction}
        onSubmit={(e) => {
          if (!confirm(`Supprimer ${name} de la liste ?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="id" value={id} />
        <button className="mini del">Supprimer</button>
      </form>
    </div>
  );
}
