# Serveur commun de réservation — Pixanova Events

Les événements utilisent tous ces mêmes fonctions Netlify. Aucun serveur à dupliquer par salon. Les secrets sont dans `.env` / Netlify, jamais dans `config/` ou `public/`.

| Route | Entrée | Rôle |
|---|---|---|
| `GET /api/stock?event=chaucase-2027` | Identifiant d’événement | Disponibilité du parc commun sur sa période de location |
| `POST /api/quote` | `{ "eventId": "chaucase-2027", "screens": 3, "montage": "simple" }` | Récapitulatif et taxes vérifiées, sans création de session ni blocage |
| `POST /api/checkout` | `{ "eventId": "chaucase-2027", "screens": 3, "montage": "simple", "language": "en", "expectedTotalCents": 205805, "requestId": "550e8400-e29b-41d4-a716-446655440000" }` | Une session Stripe avec écrans et montage; tous les prix recalculés |
| `GET /api/reservation?event=...&session_id=...` | Événement + session Stripe | Vérification du paiement; récapitulatif sans donnée personnelle |
| `POST /api/stripe-webhook` | Événement signé Stripe | États et stock durables : paiement, expiration, échec, remboursement ; signature obligatoire |

Les événements inconnus ou inactifs sont refusés. Les réservations ferment à `bookingClosesAt`, sinon au début de mise à disposition du matériel. Le client n’envoie pas de prix ni de dates faisant autorité. `language` est facultatif (français par défaut), limité à `fr` / `en` et conservé dans les métadonnées et les URLs de retour. Seuls les libellés et la locale Checkout changent, jamais le prix ou le stock.

`montage` est facultatif (`none` par défaut), strictement limité à `none`, `simple`, `animated`. Les forfaits sont fixes : création graphique 200 $ / 4 h, motion design 400 $ / 10 h, sans supplément par écran. Les métadonnées `montage`, `montage_cents`, `rental_cents`, `montage_hours` figent le choix payé; seul `screens` consomme du stock.

`expectedTotalCents`, facultatif pour compatibilité, est envoyé par la modale : un écart renvoie HTTP 409 `quote_changed` **sans créer de session**. Le montant Stripe créé est aussi comparé au total calculé ; en cas d'écart, aucune redirection n'est renvoyée. En backend durable, l'allocation reste en vérification plutôt que d'être libérée sans preuve. `requestId` UUID v4 est obligatoire et conservé lors des retries. `totalCents` dans les réponses quote/checkout comprend les taxes; `subtotalCents` les exclut.

Checkout collecte le nom complet via `name_collection.individual`, en plus du courriel et du téléphone. Le nom n’est pas ajouté à l’API publique de confirmation. Le co-branding utilise `branding_settings` par session; une ligne logistique à 0 $ affiche les prestations offertes sans fausse réduction.

La confirmation retourne aussi `rentalCents`, `gstCents`, `qstCents` et `includedLogistics`. Les taxes séparées viennent de `total_details.breakdown` de Stripe, avec identifiants de taux figés; si cette ventilation manque ou n’est pas identifiable, les deux valeurs sont `null` et l’interface affiche la taxe globale. Les anciennes réservations ne sont jamais recalculées au tarif actuel.

## Configuration unique

`config/platform.json` : total d’écrans physiques (20), durée de blocage Stripe, coordonnées, devise, montage et pourcentages TPS/TVQ. `lib/taxes.mjs` vérifie les taux Stripe actifs et exclusifs (cache de 60 secondes).

`config/events/*.json` et `config/catalog.mjs` : événements, périodes et prix. `shared/events.mjs` fournit validation, dates et formule de prix à la fois au navigateur et au serveur.

## Stock selon le calendrier

En production, `INVENTORY_BACKEND=supabase` utilise un verrou PostgreSQL sur le parc LIVE, le pic calendaire et des transitions durables. Le parc doit être initialisé (`ready=true`) et sa capacité doit correspondre au catalogue. `lib/stock.mjs` conserve le calcul de pic et le backend historique, interdit avec une clé réelle. Les remboursements intégraux libèrent la quantité ; les remboursements partiels ne libèrent rien.

Le calcul retient le pic simultané sur la période cible. Les métadonnées `inventory_pool`, `event`, `rental_start`, `rental_end` et `screens` préservent les réservations même si un événement est retiré du catalogue.

Pour les anciennes sessions ChauCase sans dates, seule la période du catalogue est disponible. Ne pas modifier cette période après vente sans migration contrôlée.

### Garde-fous de production

- Une clé réelle exige Supabase, un parc `live` prêt et une capacité vérifiée. Aucun fallback vers les lectures Stripe non atomiques.
- Les retries réutilisent la même réservation et la même clé Stripe. Une erreur ambiguë conserve le stock jusqu'à réconciliation.
- Le webhook relit l'état Stripe actuel et conserve les reçus d'événements dans Supabase ; les états terminaux résistent aux événements désordonnés.
- Un paiement asynchrone conserve son stock jusqu'à confirmation ou échec terminal vérifié. Un remboursement partiel ne libère rien.
- Les moyens de paiement sont gérés dans Stripe Dashboard (l'API actuelle refuse `payment_method_types` à la création Checkout).
- **Resend est facultatif et non requis pour les ventes.** Les courriels Stripe restent le canal choisi. Le serveur n'active pas de facturation PDF additionnelle.
- Réconciliation planifiée toutes les 5 minutes : jusqu'à 10 allocations/holds et 2 paiements par lot, séparés par environnement. Les erreurs ne libèrent jamais aveuglément le stock.

## Essais

```bash
npm test
```

Les tests couvrent le catalogue, les dates et tarifs de différents salons, le chevauchement, la réutilisation des écrans, les anciennes sessions, les périodes figées, l'expiration et le rejet des configurations réelles sans parc LIVE prêt.

Le parcours **en bac à sable** a été vérifié : paiement accepté puis remboursé, refus de carte, expiration, compteur 4 écrans, calendrier et webhook signé. Le montage a ensuite été vérifié dans 9 combinaisons (1/2/3 écrans × sans/simple/animé), puis avec un paiement combiné réussi et remboursé. Seules les sessions créées par ces essais sont nettoyées; les réservations préexistantes sont conservées. Aucun paiement réel.

**Production active :** Checkout `livemode=true` vérifié à 688,70 CAD, taxes réelles, retry idempotent, expiration de notre seule session et livraison du webhook réel avec stock 20 → 19 → 20. Aucun paiement réel soumis ni débité pendant la vérification.

Commandes historiques : [docs/STRIPE-LOCAL.md](../docs/STRIPE-LOCAL.md). État et exploitation actuels : [docs/SUPABASE-EVENTS.md](../docs/SUPABASE-EVENTS.md).
