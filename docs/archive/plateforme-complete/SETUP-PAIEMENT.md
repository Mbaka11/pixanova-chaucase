# Mise en place du paiement et de la plateforme

Document de travail pour Anis. Cocher au fur et à mesure.
Règle d'or : **ne jamais coller une clé secrète dans un courriel ni dans un message.** Les clés vont seulement dans le fichier `.env.local` (sur ton ordinateur) et dans les variables d'environnement de Vercel.

## 0. Comment le paiement va fonctionner

1. L'exposant choisit son offre. Le serveur recalcule le prix (early bird ou régulier selon la date, heure de Montréal), la TPS (5 %) et la TVQ (9,975 %). Le navigateur ne décide jamais du prix.
2. Les écrans sont bloqués : 30 minutes pour la carte, 5 jours pour Interac.
3. Carte : l'exposant est envoyé vers la page de paiement sécurisée de Stripe. Quand Stripe confirme (webhook), la réservation devient « payée », le stock est définitif et le courriel de confirmation part.
4. Interac : l'exposant reçoit les instructions de virement. Tu cliques « Paiement reçu » dans l'admin. Sans confirmation après 5 jours, les écrans sont libérés.
5. Remboursement complet jusqu'au 15 janvier 2027 : tu le fais dans Stripe (ou par virement Interac), puis tu marques la réservation « annulée » dans l'admin.

## 1. Stripe (carte de crédit et de débit)

À faire par toi :

- [ ] Créer ou ouvrir le compte Stripe pour Pixanova (pays : Canada, devise : CAD).
- [ ] Remplir les informations d'entreprise : nom légal, adresse, numéro d'entreprise, représentant.
- [ ] Ajouter le compte bancaire de l'entreprise (en dollars canadiens) pour recevoir les dépôts.
- [ ] Vérification d'identité (pièce d'identité) demandée par Stripe.
- [ ] Rester en **mode test** jusqu'à la fin des essais (interrupteur « Mode test » en haut du tableau de bord).
- [ ] Image de marque : Paramètres, Image de marque. Ajouter le logo, la couleur, le nom « Pixanova ».
- [ ] Courriels : activer l'envoi automatique des reçus aux clients.
- [ ] Taxes : Produits, Taux de taxe. Créer deux taux **exclusifs** (ajoutés au prix) :
  - TPS, 5 %, avec ton numéro de TPS
  - TVQ, 9,975 %, avec ton numéro de TVQ
  - Noter l'identifiant de chaque taux (il commence par `txr_`).
- [ ] Modes de paiement : Paramètres, Modes de paiement. Vérifier ce qui est offert pour ton compte (carte, Apple Pay, Google Pay, Interac). Si l'Interac en ligne est disponible, on pourra remplacer le virement manuel.
- [ ] Récupérer les clés **de test** : Développeurs, Clés API. Les mettre dans `.env.local` (voir `.env.example`).

À faire par moi (dans le code) :

- Créer la session de paiement avec les lignes de prix, les deux taux de taxe et un délai d'expiration de 30 minutes.
- Écouter les événements Stripe : paiement réussi, session expirée, remboursement.
- Libérer les écrans si la session expire.

Frais à prévoir (à confirmer dans ton tableau de bord) : environ 2,9 % + 0,30 $ par transaction sur les cartes canadiennes, calculés sur le total taxes incluses. Pour un écran à 599 $ (688,70 $ avec taxes), cela fait environ 20 $. À garder en tête pour ta marge.

## 2. Interac (virement manuel)

- [ ] Choisir l'adresse qui reçoit les virements (par exemple `paiements@pixanova.ca`) et activer le dépôt automatique.
- [ ] Choisir la question de sécurité ou le dépôt automatique (le dépôt automatique est plus simple pour les exposants).
- [ ] Les instructions affichées à l'exposant : montant exact, adresse, et numéro de kiosque dans le message.

## 3. QuickBooks (comptabilité)

- [ ] Confirmer ta version : QuickBooks en ligne Canada.
- [ ] Vérifier que les codes de taxes TPS et TVQ existent.
- [ ] Au lancement : utiliser l'export CSV du tableau de bord pour les paiements.
- [ ] Après le lancement : essayer une application de synchronisation (Synder, PayTraQer, Bookkeep) avec un essai gratuit, sur une vente test avec les deux taxes.

## 4. Les autres comptes

- [ ] **Supabase** : base de données, liens magiques, stockage des visuels. Créer un projet (région la plus proche, par exemple Canada Centre si offerte).
- [ ] **Resend** : courriels automatiques. Ajouter ton domaine `pixanova.ca` et copier les enregistrements DNS demandés chez ton hébergeur de domaine.
- [ ] **Vercel** : mise en ligne. Relier le projet, puis ajouter les variables d'environnement.
- [ ] **GitHub** : stocker le code (Vercel s'y connecte).
- [ ] **Adresse du site** : par exemple `chaucase.pixanova.ca` (un sous-domaine, ajouter un enregistrement DNS chez ton hébergeur).
- [ ] **Courriel expéditeur** : par exemple `reservations@pixanova.ca`.
- [ ] **Accès administrateur** : la liste des courriels de ton équipe qui verront le tableau de bord.

## 5. Webhook Stripe (une fois le site en ligne sur Vercel)

- [ ] Stripe, Développeurs, Webhooks, Ajouter un point de terminaison : `https://ton-adresse/api/stripe/webhook`.
- [ ] Événements : `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`.
- [ ] Copier le « secret de signature » dans la variable `STRIPE_WEBHOOK_SECRET`.

## 6. Plan d'essais (en mode test, avant de passer en réel)

| Essai | Résultat attendu |
|---|---|
| Carte test `4242 4242 4242 4242`, date future, n'importe quel CVC | Réservation payée, courriel envoyé, stock diminué |
| Carte refusée `4000 0000 0000 0002` | Réservation non confirmée, écrans libérés |
| Abandonner la page de paiement | Écrans libérés après 30 minutes |
| Deux navigateurs qui paient en même temps le dernier écran | Un seul réussit, l'autre est refusé (jamais plus de 20) |
| Prix avant et après le 15 décembre | 599 $ puis 795 $ (changement automatique) |
| Vérifier le reçu Stripe | TPS et TVQ affichées séparément avec tes numéros |
| Interac : réserver, puis cliquer « Paiement reçu » | Réservation confirmée, courriel envoyé |
| Interac : ne rien faire pendant 5 jours (simulé) | Écrans libérés |
| Remboursement dans Stripe | Réservation marquée « annulée », écran remis en stock |
| Un seul vrai paiement réel de 1 $ en mode réel | Argent reçu dans le compte bancaire |

## 7. Passage en réel

- [ ] Désactiver le mode test dans Stripe, copier les clés **réelles** dans Vercel (pas dans ce dossier).
- [ ] Recréer les taux de taxe et le webhook en mode réel (les identifiants changent).
- [ ] Faire un paiement réel de petit montant, puis le rembourser.
- [ ] Mettre en ligne et annoncer.
