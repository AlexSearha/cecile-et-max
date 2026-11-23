"use client";

import { useActionState } from "react";
import { sendMessage, type ContactState } from "./actions";

export default function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessage, {});

  if (state.ok) {
    return (
      <div className="thanks">
        <p className="notice-title">Message envoyé</p>
        <p>Merci ! Nous vous répondrons au plus vite.</p>
      </div>
    );
  }

  return (
    <form action={action} className="form">
      <div className="row">
        <label>
          Votre nom
          <input name="name" required maxLength={100} autoComplete="name" />
        </label>
        <label>
          E-mail ou téléphone <span className="muted">(facultatif)</span>
          <input name="contact" maxLength={150} autoComplete="email" />
        </label>
      </div>
      <label>
        Votre message
        <textarea name="message" required rows={5} maxLength={2000} />
      </label>
      {/* Anti-spam */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
