# Mariage – RSVP (Next.js + TypeScript)

1. Les mariés saisissent les invités dans le back-office, seuls ou par famille.
2. L'invité arrive sur le site, découvre le lieu et la date, puis recherche son nom.
3. Il voit toute sa famille : qui a déjà répondu, et un formulaire pour les autres,
   en 3 étapes par personne : présence au mariage, dormir sur place (participation
   par personne), brunch du lendemain.
4. Une réponse ne peut être donnée qu'une fois. Pour la modifier, l'invité contacte l'organisateur,
   qui la réinitialise depuis le back-office.

## Démarrage local

```bash
cp .env.example .env.local   # puis changez ADMIN_TOKEN
npm install
npm run dev
```

- Site invités : http://localhost:3000
- Back-office : http://localhost:3000/admin/<ADMIN_TOKEN>
- Export CSV : http://localhost:3000/admin/<ADMIN_TOKEN>/export

Un mauvais jeton renvoie une 404 : le back-office est invisible sans le bon lien.

## Back-office

- **Ajouter des invités** : un groupe par ligne.
  - Personne seule : `Julie Bernard`
  - Famille : `Sophie Martin, Paul, Léa` (un prénom seul reprend le nom précédent)
  - Avec un nom affiché : `Famille Le Goff : Yann Le Goff, Anne`
  - Prénom composé avec espace : `Jean Pierre ; Martin`
  Une personne déjà invitée est ignorée.
- **Ajouter un membre** à une famille existante : champ dans l'en-tête de chaque groupe.
- **Réinitialiser** : efface la réponse d'un invité pour qu'il puisse répondre à nouveau.
- **Supprimer** : retire l'invité de la liste.
- Compteurs : présents, absents, en attente, couchages et total des participations.

## Personnalisation

Mariés, date, lieu (nom, adresse, lien du domaine, itinéraire), prix du couchage et contact : `lib/config.ts`.
Texte d'accueil : `app/page.tsx`.
Couleurs : variables en haut de `app/globals.css`.

## Données

Pas de base de données : tout est dans `DATA_DIR/groups.json` (un groupe = une famille ou une personne seule) (par défaut `./data`).
Les écritures sont sérialisées et atomiques.

La recherche publique demande au moins 3 lettres et renvoie les familles qui contiennent ce nom,
avec l'état des réponses de chaque membre.

## Déploiement (Docker / Coolify)

1. Build pack **Dockerfile**, port **3000**.
2. Variable d'environnement `ADMIN_TOKEN` (ex. `openssl rand -hex 24`).
3. **Stockage persistant** monté sur `/app/data`, sinon les données
   seront perdues à chaque redéploiement.
