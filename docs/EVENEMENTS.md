# Configurer les événements

## Ce qui est partagé

`config/platform.json` contient : nom de plateforme, langue par défaut, fuseau de référence, devise, **nombre total d’écrans physiques**, durée de blocage pendant Checkout, logo Pixanova, contact et caractéristiques des écrans.

Ne pas dupliquer les 20 écrans dans chaque salon. Tous les événements interrogent le même serveur et le même parc.

**Aucun secret dans ces fichiers.** Leurs données sont publiées dans le JavaScript du navigateur. Les clés Stripe et autres identifiants privés restent dans `.env` / Netlify.

## Ajouter un salon

1. Copier `config/events/chaucase-2027.json` sous un nouveau nom.
2. Changer `id` (par exemple `salon-velo-2028`), nom, édition, ville, description et logo.
3. Ajuster toutes les dates et tous les tarifs.
4. Mettre le logo dans `public/assets/` et renseigner son chemin `/assets/...`.
5. Si nécessaire, remplacer les vidéos de présentation; les témoignages communs restent réutilisés.
6. Importer le nouveau JSON dans `config/catalog.mjs`, puis l’ajouter au tableau `events`.
7. Lancer `npm test`, puis vérifier l’accueil et la fiche du salon dans `npm run dev`.

```js
import salonVelo from './events/salon-velo-2028.json' with { type: 'json' };
// ...
export const catalog = validateCatalog({ platform, events: [chaucase, salonVelo] });
```

La page est automatiquement accessible à `/evenement.html?event=salon-velo-2028`. Aucun HTML à dupliquer.

## Dates à renseigner

| Champ | Format | Utilisation |
|---|---|---|
| `startsOn`, `endsOn` | `YYYY-MM-DD` | Dates publiques du salon; durée affichée calculée automatiquement |
| `installationOn` | `YYYY-MM-DD` | Date d’installation affichée |
| `rentalStartsAt` | Date/heure avec fuseau | Début du blocage physique, transport et préparation compris |
| `rentalEndsAt` | Date/heure avec fuseau | Retour du matériel disponible; **borne exclusive** |
| `earlyBirdEndsAt` | Date/heure avec fuseau | Instant de passage au tarif régulier |
| `bookingClosesAt` | Date/heure ou `null` | Fermeture des ventes; `null` = début de mise à disposition |
| `refundEndsAt` | Date/heure avec fuseau | Fin exclusive de la période de remboursement affichée |
| `artworkDueOn` | `YYYY-MM-DD` | Date limite des visuels |

Exemple : fin du prix early bird le 15 décembre 2026 à 23 h 59 inclus → `2026-12-16T00:00:00-05:00`. L’interface affiche automatiquement « 15 décembre ».

Pour Montréal : `-05:00` en heure normale, `-04:00` en heure avancée. Ne pas réutiliser automatiquement le décalage de février pour un événement d’été. L’affichage utilise `America/Toronto`.

Deux périodes `[1er février, 5 février[` et `[5 février, 8 février[` ne se chevauchent pas. Si le transport nécessite un délai, élargir les périodes au lieu de compter sur une disponibilité instantanée.

Les dates sont copiées dans les sessions Stripe pour préserver l’historique. Changer les dates d’un salon déjà vendu nécessite une migration contrôlée des réservations, pas simplement une modification de JSON. Une augmentation des marges logistiques après vente doit aussi être traitée explicitement.

## Prix

Prix **en cents CAD**, avant taxes, dans deux groupes :

- `early.one`, `early.two`, `early.perScreen`;
- `regular.one`, `regular.two`, `regular.perScreen`.

Pour 1 ou 2 écrans, le prix est celui du forfait; dès 3, c’est la quantité multipliée par `perScreen`. Le navigateur et le serveur utilisent la même configuration et la même formule. Le serveur ignore tout montant envoyé par le client.

`maxScreensPerOrder` limite le compteur de la troisième fiche. `active: false` retire le salon du catalogue et interdit de nouvelles sessions; les réservations existantes continuent d’occuper le parc.

## Français / anglais

Le français reste la langue par défaut. Ajouter `?lang=en` (ou `&lang=en` si le lien contient déjà `event=...`) pour la version anglaise. Le sélecteur FR / EN conserve l’événement, l’ancre et les paramètres de retour de paiement. Une langue URL inconnue revient au français.

`shared/i18n.mjs` centralise les traductions. `staticEnglish` traduit les nœuds texte et attributs accessibles du modèle français sans remplacer les icônes ou les spans de paramètres. Toute modification d’un texte source français doit donc mettre à jour son entrée anglaise. `copy(language)` produit les libellés dynamiques. Les dates et montants utilisent `Intl` (`fr-CA` ou `en-CA`).

Un événement peut fournir `translations.en.description`, et facultativement `translations.en.name` et `translations.en.city`. Sans description anglaise, une phrase anglaise générique est générée avec le nom du salon; la description française n’est pas affichée par erreur dans la version anglaise.

Le serveur accepte `language: "fr"` ou `"en"` lors de la création Checkout. Stripe utilise `fr-CA` pour le français et **`en` pour l’anglais** (Stripe n’accepte pas `en-CA`); la devise et les tarifs restent CAD. Les notifications internes à l’équipe restent en français.

Les vidéos et les logos restent dans leur langue d’origine. La page anglaise précise que les vidéos sont en français; aucun doublage ni sous-titre anglais n’est fourni.

## Génération et aperçu

`npm run build` génère `public/js/catalog-data.js` et copie les utilitaires publics. Ces fichiers, ainsi que la copie publique `public/js/i18n.mjs`, sont ignorés par Git; ils sont reconstruits automatiquement sur Netlify.

`npm run dev` surveille `config/` et `shared/`, regénère ces fichiers puis recharge la page. Si le JSON est invalide, le terminal indique l’erreur et il faut la corriger avant de continuer.

Le catalogue se charge en JavaScript : pour le moment, les aperçus de partage sans JavaScript utilisent les métadonnées génériques de Pixanova Events. Un pré-rendu par événement pourra être ajouté si nécessaire.
