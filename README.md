# Mariage – RSVP (Next.js + TypeScript)

## Fonctionnement

1. Les mariés saisissent les invités dans le back-office, seuls ou par famille, avec un **type d'invitation** :
   - **Complète** : réponse sur le site principal `/` (présence, dodo, brunch) ;
   - **Cérémonie + vin d'honneur** : réponse sur `/vin-honneur` (présence uniquement).
   Chaque page ne trouve que les invités de son type.
2. L'invité recherche son nom : les foyers trouvés sont regroupés sous leur famille principale ; il choisit
   son foyer et répond pour ses membres.
3. Pour chaque personne : présence ; si présent·e, tranche d'âge pour les enfants (le rôle saisi indique
   déjà adulte / enfant ; sinon la question est posée),
   dormir sur place (50 €, **gratuit pour les 0-3 ans**), brunch.
4. Une réponse ne peut être donnée qu'une fois. Pour la modifier, l'invité écrit via le formulaire de
   contact ; les mariés la réinitialisent depuis le back-office.
5. Le formulaire « Une question ? » (bas des deux pages) envoie les messages dans le back-office.

## Démarrage local

```bash
cp .env.example .env.local   # puis changez ADMIN_TOKEN
npm install
npm run dev
```

- Site principal : http://localhost:3000
- Cérémonie + vin d'honneur : http://localhost:3000/vin-honneur
- Back-office : http://localhost:3000/admin/<ADMIN_TOKEN>
- Export CSV : http://localhost:3000/admin/<ADMIN_TOKEN>/export

Un mauvais jeton renvoie une 404 : le back-office est invisible sans le bon lien.

## Back-office

- **Ajouter des invités** (choisir le type d'invitation), **un foyer par ligne** :

  ```
  Famille Dupond :
  Jean Dupond, Marie Durand
  Paul Dupond, Julie, Léo, Emma
  Marc Dupond, Thomas Petit (conjoint), Hugo (enfant)

  Julie Bernard
  Famille Roux : Marc Roux, Lou
  ```

  - Une ligne `Famille X :` ouvre une **famille principale** ; ses foyers suivent ; une ligne vide la termine.
    `Famille X : a, b` sur une seule ligne = famille principale avec un seul foyer.
  - Rôles : sans précision, 1re personne = référent, 2e = conjoint(e), suivantes = enfants.
    Sinon entre parenthèses : `(conjoint)`, `(conjointe)`, `(enfant)`, `(autre)`…
  - Un prénom seul reprend le nom du référent du foyer. Prénom composé : `Jean Pierre ; Martin`.
  - Une personne déjà invitée est ignorée.
- Par foyer : rattacher à une famille principale (ou l'en retirer), ajouter un membre (`Prénom (enfant)`),
  passer en « vin d'honneur » / « invitation complète ».
- Par personne : **Modifier** (prénom / nom / rôle), **Réinitialiser** la réponse, **Supprimer**.
- Compteurs : présents, enfants, en attente, vin d'honneur, couchages (dont gratuits), brunch, total des participations.
- **Messages** reçus via le formulaire de contact.

## Personnalisation

`lib/config.ts` : mariés, date, horaires (`time`, `vinTime`), photo, lieu, prix du couchage,
heure de disponibilité des chambres (`roomsFrom`), contact.
Textes : `app/page.tsx` (site principal) et `app/vin-honneur/page.tsx`.
Photo des mariés : `public/couple.jpg` (format portrait conseillé, ex. 1200×1500).
Couleurs : variables en haut de `app/globals.css`.

## Données

Deux modes, choisis automatiquement :

- **Upstash Redis** si ses variables sont présentes (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, ou tout autre
  préfixe `XXX_REST_API_URL` / `XXX_REST_API_TOKEN`). **Obligatoire sur Vercel** (disque en lecture seule).
  Clés : `mariage:groups` et `mariage:messages`. Un verrou Redis évite que deux réponses simultanées s'écrasent.
- Sinon, fichiers `DATA_DIR/groups.json` et `DATA_DIR/messages.json` (local, Docker, Coolify).

## Déploiement sur Vercel

1. Projet Vercel → **Storage** → **Upstash for Redis**, connectée au projet (préfixe `KV`).
2. Variable `ADMIN_TOKEN`.
3. Redéployer.

## Déploiement (Docker / Coolify)

1. Build pack **Dockerfile**, port **3000**.
2. Variable d'environnement `ADMIN_TOKEN` (ex. `openssl rand -hex 24`).
3. **Stockage persistant** monté sur `/app/data`.
