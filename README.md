# Pixanova × ChauCase 2027

Page de vente des écrans LED Pixanova pour les exposants du salon ChauCase 2027. Les exposants choisissent leurs écrans et paient en ligne avec Stripe.

Commencer par [`docs/CONTEXTE.md`](docs/CONTEXTE.md) : prix, décisions et prochaines étapes.

## Structure

```text
public/              Site mis en ligne (HTML, CSS, JS, assets)
server/   Code serveur : réservation et paiement Stripe
docs/                Documentation et archives
```

## Voir la page en local

```bash
npm install   # une seule fois
npm run dev
```

Ouvrir http://localhost:8080. La page se met à jour automatiquement à chaque sauvegarde dans `public/` (le CSS s'applique sans recharger).

## Mise en ligne

Netlify lit `netlify.toml` : le dossier `public/` est publié tel quel et les fonctions viennent de `server/`. Les clés Stripe se configurent dans Netlify (voir `.env.example`), jamais dans le dépôt.

## Réglages rapides

`public/js/config.js` : stock total, écrans déjà vendus, date de fin du prix early bird, identifiants de statistiques.
