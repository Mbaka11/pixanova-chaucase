# Mise en production de Stripe — suivi

Statut : **stock Supabase livré et activé en TEST sur events.pixanova.ca ; ventes réelles toujours bloquées par le code** (`create-checkout` refuse `sk_live_` / `rk_live_`) jusqu'à la validation finale. Voir [SUPABASE-EVENTS.md](SUPABASE-EVENTS.md).

## Variables Netlify (contexte Production)

Modèle : `.env.production.example`. Remplacer les valeurs `REMPLACER…` directement dans Netlify (*Project configuration → Environment variables*, portée **Production** seulement). Le site de test garde ses clés de test.

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | clé réelle `sk_live_…` ou `rk_live_…` ; clé restreinte recommandée après validation des droits (secret, jamais dans Git) |
| `STRIPE_WEBHOOK_SECRET` | secret `whsec_…` du webhook réel (secret) |
| `STRIPE_TAX_RATE_TPS` | `txr_1UW7PBBMsNrAeWFfYvCEVqcY` |
| `STRIPE_TAX_RATE_TVQ` | `txr_1UW7PjBMsNrAeWFf2AcRTqDz` |
| `SITE_URL` | `https://events.pixanova.ca` |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_TO` | courriels d'équipe |

Le serveur refuse de créer un paiement si les taux ne sont pas actifs, exclusifs et à 5 % / 9,975 %. Les deux identifiants RÉELS ont été contrôlés par API en lecture seule le 30 octobre 2026 : actifs, exclusifs, `livemode=true`, pourcentages corrects. Aucun débit réel effectué.

Attention : le projet Netlify `pixanova-events-test` sert actuellement ce domaine avec les **clés de test**, même dans son contexte de déploiement « Production ». Ne pas y remplacer les clés par le réel sans la bascule dédiée.

## Avancement du compte réel

- [x] Compte activé
- [x] Taux TPS et TVQ créés
- [x] Reçus par courriel activés
- [x] Moyens de paiement choisis
- [x] Clé API créée (clé restreinte et droits minimaux non encore validés)
- [x] Logos et couleurs (Checkout et reçus)
- [ ] Détails publics : nom légal exact, courriel de support, URL de support
- [x] Numéros d'inscription TPS/TVQ présents selon confirmation utilisateur
- [ ] Conditions de vente (URL)
- [ ] Authentification à deux facteurs
- [x] Destination webhook réelle créée selon confirmation utilisateur ; secret conservé dans le bloc réel du `.env`, pas encore raccordé au serveur
- [ ] Ajouter au webhook réel les 3 événements de cycle de vie supplémentaires avant sa bascule (voir SUPABASE-EVENTS.md)
- [x] Stock transactionnel et idempotence validés sur Supabase et Stripe TEST ; historique préservé
- [x] Webhook public TEST signé, expirations et libération du stock vérifiés
- [ ] Courriels d'équipe Resend : domaine, clé API et livraison à valider
- [ ] Validation finale du réel et éventuel petit paiement autorisé, puis remboursement de ce paiement uniquement
