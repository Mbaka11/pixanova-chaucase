# Serveur commun de réservation — Pixanova Events

Les événements utilisent tous ces mêmes fonctions Netlify. Aucun serveur à dupliquer par salon. Les secrets sont dans `.env` / Netlify, jamais dans `config/` ou `public/`.

| Route | Entrée | Rôle |
|---|---|---|
| `GET /api/stock?event=chaucase-2027` | Identifiant d’événement | Disponibilité du parc commun sur sa période de location |
| `POST /api/checkout` | `{ "eventId": "chaucase-2027", "screens": 3 }` | Prix et dates tirés du catalogue, session Stripe de test |
| `POST /api/stripe-webhook` | Événement signé Stripe | Notification de paiement confirmé, événement identifié par métadonnées |

Les événements inconnus ou inactifs sont refusés. Les réservations ferment à `bookingClosesAt`, sinon au début de mise à disposition du matériel. Le client n’envoie pas de prix ni de dates faisant autorité.

## Configuration unique

`config/platform.json` : total d’écrans physiques (20), durée de blocage Stripe, coordonnées, devise.

`config/events/*.json` et `config/catalog.mjs` : événements, périodes et prix. `shared/events.mjs` fournit validation, dates et formule de prix à la fois au navigateur et au serveur.

## Stock selon le calendrier

`lib/stock.mjs` parcourt les sessions Stripe de notre parc, tous événements confondus. Les sessions ouvertes non expirées et les sessions complètes consomment du stock; les remboursements intégraux libèrent la quantité. Les remboursements partiels ne libèrent rien automatiquement.

Le calcul retient le pic simultané sur la période cible. Les métadonnées `inventory_pool`, `event`, `rental_start`, `rental_end` et `screens` préservent les réservations même si un événement est retiré du catalogue.

Pour les anciennes sessions ChauCase sans dates, seule la période du catalogue est disponible. Ne pas modifier cette période après vente sans migration contrôlée.

### Limites : pas encore prêt pour les ventes réelles

- Les lectures Stripe, même doublées avant/après création, **ne sont pas atomiques** et ne garantissent pas le stock face à des achats simultanés. Un stockage transactionnel commun reste requis.
- `create-checkout` refuse les clés réelles tant que cette garantie n’existe pas.
- La notification utilise une clé d’idempotence Resend par session, mais la déduplication durable des webhooks devra être implémentée dans le futur stockage.
- Un paiement différé est conservé dans le stock en attendant confirmation. Les échecs asynchrones et leur libération devront être traités explicitement avant activation de ces moyens de paiement.
- Les moyens de paiement sont gérés dans Stripe Dashboard (l’API actuelle refuse `payment_method_types` à la création Checkout).
- Sans Resend, un résumé non personnel est journalisé; aucun courriel n’est envoyé automatiquement.

## Essais

```bash
npm test
```

Les tests couvrent le catalogue, les dates et tarifs de différents salons, le chevauchement, la réutilisation des écrans, les anciennes sessions, les périodes figées, l’expiration et le rejet des clés réelles.

Une création puis expiration Stripe réelle **en mode test** a validé le calcul des taxes et les métadonnées. Aucun paiement n’a été effectué.
