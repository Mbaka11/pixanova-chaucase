# Mise en production de Stripe — suivi

Statut : **PRODUCTION ACTIVE sur https://events.pixanova.ca.** Stripe réel, taxes réelles, parc transactionnel LIVE et webhook réel raccordés. Checkout réel vérifié sans paiement, puis notre session expirée et stock restauré à 20. Voir [SUPABASE-EVENTS.md](SUPABASE-EVENTS.md).

## Variables Netlify (contexte Production)

Modèle : `.env.production.example`. Remplacer les valeurs `REMPLACER…` directement dans Netlify (*Project configuration → Environment variables*, portée **Production** seulement). Le développement local et les autres contextes de prévisualisation gardent leurs clés de test ; le contexte Netlify Production sert désormais les vraies ventes.

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | clé réelle `sk_live_…` ou `rk_live_…` ; clé restreinte recommandée après validation des droits (secret, jamais dans Git) |
| `STRIPE_WEBHOOK_SECRET` | secret `whsec_…` du webhook réel (secret) |
| `STRIPE_TAX_RATE_TPS` | `txr_1UW7PBBMsNrAeWFfYvCEVqcY` |
| `STRIPE_TAX_RATE_TVQ` | `txr_1UW7PjBMsNrAeWFf2AcRTqDz` |
| `SITE_URL` | `https://events.pixanova.ca` |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_TO` | courriels d'équipe |

Le serveur refuse de créer un paiement si les taux ne sont pas actifs, exclusifs et à 5 % / 9,975 %. Les deux identifiants RÉELS ont été contrôlés par API en lecture seule le 30 octobre 2026 : actifs, exclusifs, `livemode=true`, pourcentages corrects. Aucun débit réel effectué.

Attention : le nom interne du projet Netlify reste `pixanova-events-test`, mais **son contexte Production utilise désormais les clés réelles** et le domaine events.pixanova.ca. Ne pas remettre les clés de test sur ce contexte. Le `.env` local garde une clé de test active ; le bloc réel commenté est réservé aux commandes opérateur `--live`.

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
- [x] Destination webhook réelle raccordée au serveur public avec les 5 événements requis ; signature et livraison d'une expiration réelle vérifiées
- [x] Stock transactionnel et idempotence validés ; parcs TEST et LIVE séparés ; historique de test préservé
- [x] Webhook public TEST signé, expirations et libération du stock vérifiés durant la préproduction
- [x] Courriels Stripe retenus par l'utilisateur ; **Resend facultatif et non requis**
- [x] Checkout réel à 688,70 CAD vérifié, retry idempotent, session expirée, stock 20 → 19 → 20
- Aucun paiement réel soumis ni débité. La livraison effective d'un reçu réel n'a donc pas été testée ; aucun débit de contrôle n'est lancé sans autorisation.
