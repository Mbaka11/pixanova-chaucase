# Fonctions serveur (Netlify Functions)

Code serveur de la réservation. Rien ici n'est visible par le navigateur. Les clés Stripe viennent des variables d'environnement (voir `.env.example`).

| Fonction | Adresse | Rôle |
|---|---|---|
| `get-stock.mjs` | `GET /api/stock` | Renvoie `{ total, taken, remaining }` à partir de Stripe |
| `create-checkout.mjs` | `POST /api/checkout` | Reçoit `{ screens: N }`, calcule le prix, vérifie le stock, crée la session Stripe et renvoie `{ url }` |
| `stripe-webhook.mjs` | `POST /api/stripe-webhook` | Vérifie la signature Stripe et avertit l'équipe d'un paiement réussi |
| `lib/config.mjs` | | Prix, date early bird, total d'écrans, maximum par commande |
| `lib/pricing.mjs` | | Calcul du prix selon la date (heure de Montréal) |
| `lib/stock.mjs` | | Comptage des écrans pris (payés + en cours de paiement − remboursés) |

## Règles appliquées côté serveur

- Le navigateur n'envoie que le nombre d'écrans (1 à 10). Le prix est toujours recalculé ici.
- Jamais plus de 20 écrans : le stock est vérifié avant, puis une seconde fois après la création de la session. Si deux achats se croisent, la session en trop est expirée.
- Les écrans sont bloqués 30 minutes pendant le paiement, puis libérés.
- Un paiement remboursé libère ses écrans.

## Tests

```bash
npm test
```
