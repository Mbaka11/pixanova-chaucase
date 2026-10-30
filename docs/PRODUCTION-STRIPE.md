# Mise en production de Stripe — suivi

Statut : **préparation du compte en cours. Les ventes réelles restent bloquées par le code** tant que le stock transactionnel n'est pas livré (`create-checkout` refuse `sk_live_` / `rk_live_`).

## Variables Netlify (contexte Production)

Modèle : `.env.production.example`. Remplacer les valeurs `REMPLACER…` directement dans Netlify (*Project configuration → Environment variables*, portée **Production** seulement). Le site de test garde ses clés de test.

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | clé restreinte réelle `rk_live_…` (secret, jamais dans Git) |
| `STRIPE_WEBHOOK_SECRET` | secret `whsec_…` du webhook réel (secret) |
| `STRIPE_TAX_RATE_TPS` | `txr_1UW7PBBMsNrAeWFfYvCEVqcY` |
| `STRIPE_TAX_RATE_TVQ` | `txr_1UW7PjBMsNrAeWFf2AcRTqDz` |
| `SITE_URL` | domaine final HTTPS (à choisir) |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_TO` | courriels d'équipe |

Le serveur refuse de créer un paiement si les taux ne sont pas actifs, exclusifs et à 5 % / 9,975 %.

## Avancement du compte réel

- [x] Compte activé
- [x] Taux TPS et TVQ créés
- [x] Reçus par courriel activés
- [x] Moyens de paiement choisis
- [x] Clé API restreinte créée
- [x] Logos et couleurs (Checkout et reçus)
- [ ] Détails publics : nom légal exact, courriel de support, URL de support
- [ ] Numéros d'inscription TPS/TVQ sur les reçus et factures
- [ ] Conditions de vente (URL)
- [ ] Authentification à deux facteurs
- [ ] Webhook réel (après choix du domaine)
- [ ] Stock transactionnel, idempotence, courriels d'équipe
- [ ] Paiement réel de 1 écran puis remboursement
