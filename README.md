# Pixanova × ChauCase 2027

Page de vente des écrans LED Pixanova pour les exposants du salon ChauCase 2027. Les exposants choisissent leurs écrans et paient en ligne avec Stripe.

Commencer par [`docs/CONTEXTE.md`](docs/CONTEXTE.md) : prix, décisions et prochaines étapes.

## Structure

```text
public/              Site mis en ligne (HTML, CSS, JS, assets)
netlify/functions/   Code serveur : paiement Stripe (à venir)
docs/                Documentation et archives
```

## Voir la page en local

```bash
npx http-server public -p 8080
```

Puis ouvrir http://localhost:8080.

## Mise en ligne

Netlify lit `netlify.toml` : le dossier `public/` est publié tel quel et les fonctions viennent de `netlify/functions/`. Les clés Stripe se configurent dans Netlify (voir `.env.example`), jamais dans le dépôt.

## Réglages rapides

`public/js/config.js` : stock total, écrans déjà vendus, date de fin du prix early bird, identifiants de statistiques.
