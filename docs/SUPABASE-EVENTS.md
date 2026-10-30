# Stock transactionnel — Pixanova Events

## État du chantier

- Projet Supabase dédié, connexion serveur vérifiée sans afficher les clés.
- Migration `202610300001_inventory_foundation.sql` installée selon confirmation opérateur.
- **Test PostgreSQL réel réussi** : 32 requêtes concurrentes, exactement 20 acceptées et 12 refusées ; idempotence, conflit de demande, fenêtres adjacentes et isolation test/réel validés. Parc QA temporaire supprimé, parc `pixanova-led` inchangé.
- Migration `202610300002_inventory_lifecycle.sql` installée et validée sur Supabase : garde de bascule, transitions désordonnées, remboursement complet, libération atomique et outbox. Les droits et fonctions ont aussi été contrôlés sur PostgreSQL local/PGlite.
- **77 tests automatisés passent**, dont les doubles submits et la reprise après un crash entre Stripe.create et l'attachement DB.
- **Intégration Stripe TEST + Supabase validée** dans un parc QA isolé : crash après création récupéré sans seconde session, expiration/libération, paiement navigateur fictif de 1,15 CAD, webhooks signés dupliqués/désordonnés, remboursement partiel de 0,01 CAD conservant le stock, puis remboursement des 1,14 CAD restants libérant le stock. Parc QA nettoyé, seules nos sessions ont été expirées/remboursées. Ce contrôle exerce le handler signé localement, pas encore la livraison webhook publique de Stripe.
- Adaptateur REST, Checkout durable, webhooks, outbox et tâche planifiée codés, mais **pas activés sur le site**.
- Le blocage `production_inventory_not_ready` pour les clés réelles reste volontairement en place.

## Schéma installé

Les migrations `001` et `002` sont installées. **Ne pas les réexécuter.** Elles ajoutent les transitions d'état, l'outbox de courriels et une garde de bascule `ready=false`, sans activer de paiement.

Pour répéter les contrôles :

```sh
npm run inventory:test
npm test
```

Le premier script teste directement PostgreSQL dans un parc QA isolé, puis supprime seulement ses propres données. Il lit les emplacements Supabase commentés de `.env` sans afficher les secrets. Après la migration 002, il teste aussi les transitions désordonnées, la libération après remboursement intégral, la capacité retrouvée et les baux de notification.

## Configuration serveur

```dotenv
SUPABASE_URL=https://<projet>.supabase.co
SUPABASE_SECRET_KEY=<clé serveur privée>
INVENTORY_BACKEND=supabase
```

Sans choix explicite de `INVENTORY_BACKEND`, le site conserve le stock Stripe historique. Une configuration Supabase explicitement sélectionnée mais défaillante renvoie une erreur : aucun fallback silencieux.

La clé est côté fonctions Netlify seulement, jamais dans `public/`. RLS est activée, aucune policy `anon` ou `authenticated`, fonctions de mutation réservées à `service_role`.

## Bascule TEST — après validation SQL

Ne pas activer Supabase sur un parc vide alors que des sessions existent déjà.

1. Publier le code en gardant le backend historique et les clés de test.
2. Sur le site cible **et les autres sites / services qui utilisent le même compte Stripe test**, suspendre les nouvelles créations (`CHECKOUT_PAUSED=true`) et attendre que les requêtes de création déjà en vol soient terminées. Une pause du site cible seule ne bloque pas un autre ordinateur utilisant la même clé.
3. Importer l'historique sans modifier Stripe :

   ```sh
   npm run inventory:bootstrap -- --site https://events.pixanova.ca
   ```

   Le script refuse les clés réelles, exige que le site réponde `checkout_paused`, vérifie `ready=false`, conserve toutes les sessions du parc (ou événements historiques reconnus), et contrôle le pic de capacité. Il ne crée, expire ni rembourse aucune session Stripe. Les anciens courriels ne sont pas renvoyés. Les expirations et remboursements historiques sont importés comme libérés. Le parc n'est marqué prêt qu'après l'import complet.

4. Configurer Supabase dans Netlify, toujours en TEST, puis `INVENTORY_BACKEND=supabase` ; garder `CHECKOUT_PAUSED=true` jusqu'à ce que tous les écrivains soient migrés ou arrêtés.
5. Mettre à jour le webhook **de test** avec les événements ci-dessous. Ne pas remplacer son secret par celui du réel.
6. Valider stock/API, puis retirer la pause et tester le parcours complet. Redémarrer Netlify Dev après tout changement de `.env`.

Si l'import échoue, le parc reste non prêt et les créations restent suspendues. Ne pas forcer `ready=true` ni supprimer des réservations. La commande peut reprendre l'import tant que `ready=false` ; elle refuse un parc déjà activé.

## Événements Stripe requis pour le backend Supabase

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Événements Snapshot du compte concerné, pas Connect. Les événements d'un environnement opposé sont refusés. Le serveur relit la session et le dernier charge dans Stripe avant de modifier le stock ; il ne croit pas un snapshot ancien. Une session inconnue de notre parc renvoie 500 afin que Stripe réessaie, au lieu de perdre la réservation.

## Garanties et limites

- 20 écrans par environnement ; le parc de test est une simulation sans effet sur le parc réel.
- Verrou sur la ligne du parc, calcul du pic sur les fenêtres logistiques figées semi-ouvertes.
- UUID de demande conservé par le navigateur sur les retries réseau (sessionStorage si disponible). Empreinte des choix et du total ; paramètres Stripe figés en base, clé Stripe d'idempotence stable.
- Supabase est réservé AVANT Stripe.create. En cas de timeout, conserver le blocage et reprendre avec la même clé et les mêmes paramètres. Au-delà de 23 h, aucune recréation automatique ambiguë.
- Une minute de marge réseau s'ajoute au hold de 30 minutes lors de la création durable, pour respecter le minimum Stripe de 30 minutes après l'aller-retour DB. La date exacte est figée en base.
- Aucune libération sur simple dépassement de `hold_until`. Expiration Stripe confirmée, échec asynchrone terminal confirmé ou remboursement intégral seulement. Un remboursement partiel conserve tous les écrans.
- Un paiement confirmé ne redevient pas impayé à cause d'un ancien événement. Un remboursement intégral confirmé ne peut pas être annulé par un événement payé ancien.
- Une divergence de montant, de session, de métadonnées ou d'environnement bloque la réservation pour vérification, sans redirection vers Checkout ni libération aveugle.
- Outbox : état durable, bail de 5 min, clé Resend par session. L'état `sent` empêche les renvois ordinaires après 24 h. Ce n'est **pas** une garantie exactement-une-fois externe : si Resend accepte le mail mais que la confirmation DB est perdue au-delà de sa fenêtre d'idempotence, un doublon reste possible. Resend non configuré laisse la notification en attente.
- `reconcile-inventory` est planifiée toutes les 5 min sur les déploiements Netlify publiés, sans route HTTP publique. Lots conservateurs de 2 lignes, rotation par date de vérification : le stock peut rester bloqué plus longtemps que le hold si la file grossit ou si Stripe est indisponible. Dimensionnement et observabilité à valider avant production.
- Réparation opérateur : `npm run inventory:reconcile` relit les sessions test, retrouve les sessions détachées et conserve les cas ambigus. Aucun remboursement ni expiration forcée.

## Validation avant déblocage réel

Restent : la bascule et préservation de l'historique, la livraison des webhooks publics et des notifications, le parcours navigateur sur le site basculé et les cas d'échec / 3DS. Préparer une bascule réelle distincte ; les scripts de bootstrap et de réconciliation refusent actuellement le mode réel. Garder les clés et webhooks test/réel séparés. Ne lever la garde réelle qu'après ces validations et accord d'ouverture.
