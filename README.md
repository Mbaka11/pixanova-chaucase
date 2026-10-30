# Pixanova Events

Plateforme de location d’écrans LED pour exposants : un accueil pour choisir son événement, un modèle de page réutilisable et un serveur commun de réservation Stripe.

**État :** configuration multiévénement et parcours Stripe de test opérationnels. Récapitulatif FR/EN avant Stripe, montage facultatif et écrans payés ensemble, confirmation vérifiée côté serveur. Paiement combiné et remboursement de test validés. Les ventes réelles restent bloquées tant que le stock n’est pas réservé de manière atomique.

Forfaits de contenu : **création graphique 200 $ / 4 h**, **motion design 400 $ / 10 h**, avant taxes et sans supplément selon la quantité. Accueil compact, modale sans jargon, nom du contact requis dans Stripe et confirmation avec résumé ligne par ligne. Livraison et installation affichées comme offertes, sans réduction fictive.

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

`npm run dev:full` lance le site avec les fonctions sur http://localhost:8888 (CLI Netlify incluse dans les dépendances). Pour le transfert des événements Stripe, lancer `npm run stripe:listen` dans un autre terminal. Voir [le guide de test Stripe local](docs/STRIPE-LOCAL.md).

Le serveur statique seul sur le port 8080 ne fournit pas `/api/stock` : l’interface indique alors « Stock à confirmer » plutôt qu’un faux stock de 20.

## Organisation

```text
config/
  platform.json              Marque, contact, parc commun de 20 écrans
  events/chaucase-2027.json   Identité, dates, prix et médias du salon
  catalog.mjs                Registre des événements
shared/events.mjs            Validation, dates, prix (communs au site et au serveur)
shared/montage.mjs           Options et prix du montage
shared/order.mjs             Total de commande et taxes arrondies par ligne
public/
  index.html                 Sélection de l’événement
  evenement.html             Modèle commun (design des trois fiches conservé)
  js/catalog.js              Accueil
  js/config.js               Alimentation du modèle par l’événement choisi
  js/main.js                 Animation, fiches, navigation
  js/booking-dialog.js       Récapitulatif accessible avant paiement
  css/                       Styles
  assets/                    Images et vidéos web
server/                      Fonctions Stripe et disponibilité partagée
scripts/                     Génération de configuration et serveur de développement
test/                        Tests métier
docs/                        Contexte, plan et mode d’emploi
media-sources/               Originaux locaux, ignorés par Git
temp/                        Captures et essais locaux, ignorés par Git
```

Le français est la langue par défaut. Le sélecteur FR / EN active l’anglais avec `?lang=en`, y compris les dates, les prix et les retours Stripe. Exemple : http://localhost:8080/evenement.html?event=chaucase-2027&lang=en. Les vidéos et logos restent dans leur langue d’origine.

Textes communs : `shared/i18n.mjs`. Descriptions propres à un salon : `translations.en` dans son fichier JSON. Les noms de marque ne sont pas traduits automatiquement.

## Déploiement

Dépôt public : https://github.com/Mbaka11/pixanova-events

Netlify lit `netlify.toml` : `npm run build`, publication de `public/`, fonctions dans `server/`. Les clés Stripe vont uniquement dans `.env` et les variables Netlify. **Tout le contenu de `config/` est public : aucun secret ne doit y être placé.**

Le dossier local porte encore le nom historique `PixaNova-chaucase` : ton fichier `.env` reste au même endroit. Le dépôt, le package et la plateforme s’appellent maintenant Pixanova Events.

## Documentation

- [Contexte actuel](docs/CONTEXTE.md)
- [Configurer et ajouter un événement](docs/EVENEMENTS.md)
- [Plan à suivre](docs/PLAN.md)
- [API et limites du serveur](server/README.md)
- [Serveur et essais Stripe locaux](docs/STRIPE-LOCAL.md)

Les anciens `HANDOFF.md`, `GUIDE-LANCEMENT.md` et `docs/archive/` sont historiques; leurs instructions monoévénement ne définissent plus l’architecture actuelle.
