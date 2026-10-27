# Pixanova Events

Plateforme de location d’écrans LED pour exposants : un accueil pour choisir son événement, un modèle de page réutilisable et un serveur commun de réservation Stripe.

**État :** configuration multiévénement et aperçu opérationnels; Stripe testé avec création/expiration de session, sans paiement. Les boutons de paiement ne sont pas encore branchés. Les ventes réelles sont bloquées tant que le stock n’est pas réservé de manière atomique.

## Développement

Node.js 22 ou plus récent.

```bash
npm ci
npm run dev
```

- Accueil : http://localhost:8080/
- ChauCase : http://localhost:8080/evenement.html?event=chaucase-2027

Rechargement automatique du HTML/CSS/JS, mais aussi de `config/` et `shared/`.

```bash
npm test       # validation de configuration + tests métier
npm run build # génère les données publiques à partir de config/
```

`npm run dev:full` nécessite la CLI Netlify installée et lance le site avec les fonctions sur http://localhost:8888. Le serveur statique seul ne fournit pas `/api/stock` : l’interface indique alors « Stock à confirmer » plutôt qu’un faux stock de 20.

## Organisation

```text
config/
  platform.json              Marque, contact, parc commun de 20 écrans
  events/chaucase-2027.json   Identité, dates, prix et médias du salon
  catalog.mjs                Registre des événements
shared/events.mjs            Validation, dates, prix (communs au site et au serveur)
public/
  index.html                 Sélection de l’événement
  evenement.html             Modèle commun (design des trois fiches conservé)
  js/catalog.js              Accueil
  js/config.js               Alimentation du modèle par l’événement choisi
  js/main.js                 Animation, fiches, navigation
  css/                       Styles
  assets/                    Images et vidéos web
server/                      Fonctions Stripe et disponibilité partagée
scripts/                     Génération de configuration et serveur de développement
test/                        Tests métier
docs/                        Contexte, plan et mode d’emploi
media-sources/               Originaux locaux, ignorés par Git
temp/                        Captures et essais locaux, ignorés par Git
```

Le français est la seule langue actuellement livrée. L’anglais est prévu ultérieurement, pas encore traduit.

## Déploiement

Dépôt public : https://github.com/Mbaka11/pixanova-events

Netlify lit `netlify.toml` : `npm run build`, publication de `public/`, fonctions dans `server/`. Les clés Stripe vont uniquement dans `.env` et les variables Netlify. **Tout le contenu de `config/` est public : aucun secret ne doit y être placé.**

Le dossier local porte encore le nom historique `PixaNova-chaucase` : ton fichier `.env` reste au même endroit. Le dépôt, le package et la plateforme s’appellent maintenant Pixanova Events.

## Documentation

- [Contexte actuel](docs/CONTEXTE.md)
- [Configurer et ajouter un événement](docs/EVENEMENTS.md)
- [Plan à suivre](docs/PLAN.md)
- [API et limites du serveur](server/README.md)

Les anciens `HANDOFF.md`, `GUIDE-LANCEMENT.md` et `docs/archive/` sont historiques; leurs instructions monoévénement ne définissent plus l’architecture actuelle.
