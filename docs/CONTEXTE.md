# Pixanova Events — contexte à jour

## Objectif

Une plateforme réutilisable pour les salons : l’exposant choisit son événement, découvre son offre, puis réserve et paie ses écrans en ligne. Une seule page de vente réutilisable, un serveur commun et un inventaire physique commun de 20 écrans.

## Décisions validées

- Nom : **Pixanova Events**; dépôt public `Mbaka11/pixanova-events`.
- Hébergement : Netlify, site statique et fonctions dans `server/`.
- Événements gérés par **fichiers de configuration**, sans interface administrateur.
- Page d’accueil avec sélection du salon, puis modèle commun `evenement.html?event=<id>`.
- Noms, logos, dates et tarifs alimentés depuis la configuration; conserver les animations, les trois fiches et le compteur 3+.
- Français par défaut; anglais disponible via FR / EN et `?lang=en`. Interface, dates, prix, FAQ, consentement, animation SVG et libellés Checkout traduits. Les vidéos gardent leur audio d’origine, avec une mention sur la page anglaise.
- Paiement : session Stripe Checkout calculée côté serveur, pas de douze liens.
- Montage graphique : achat reporté. La présentation actuelle reste en place; pas de nouvelles options de montage à développer à ce stade.

## Inventaire commun selon les dates

Le parc physique comprend **20 écrans**, pas 20 par salon.

- Deux événements simultanés partagent le même parc.
- Deux événements à des dates différentes peuvent réutiliser les écrans.
- La période bloquée couvre transport, installation, salon, démontage et retour. Elle peut être plus large que les dates publiques du salon.
- Disponibilité = parc total moins **pic d’utilisation simultanée** pendant la période concernée, pas somme de toutes les réservations de l’année.
- Les dates sont figées dans les métadonnées de chaque nouvelle session Stripe. Modifier ensuite le fichier du salon ne doit pas déplacer silencieusement une réservation déjà existante.
- L’inventaire est configuré dans `config/platform.json`, les périodes et tarifs dans `config/events/*.json`.

**Limite majeure :** les lectures Stripe actuelles permettent le calcul de disponibilité mais ne garantissent pas l’atomicité lors de deux réservations simultanées. Un stockage transactionnel commun reste requis. Les clés réelles sont explicitement refusées par `create-checkout` en attendant cette étape.

## Premier événement : ChauCase 2027

- Drummondville, du 2 au 4 février 2027; installation le 1er février.
- Fin early bird : 15 décembre 2026 à 23 h 59, heure de Montréal; bascule au tarif régulier le 16 décembre à 00 h 00.
- Remboursement complet jusqu’au 15 janvier 2027 inclus.
- Visuels à remettre le 29 janvier 2027.
- Date de fin des réservations non confirmée : `bookingClosesAt: null`. À défaut, le serveur ferme au début de mise à disposition du matériel.
- Période de stock **provisoire** : du 1er février à 00 h 00 au 5 février à 00 h 00 (fin exclusive). **À valider avec Anis selon transport et retour réels** avant les ventes.

| Prix avant taxes CAD | Early bird | Régulier |
|---|---:|---:|
| 1 écran | 599 $ | 795 $ |
| 2 écrans | 1 095 $ | 1 395 $ |
| 3 écrans ou plus | 530 $ par écran | 650 $ par écran |

Maximum de 10 écrans par commande actuellement configuré. TPS 5 % et TVQ 9,975 % ajoutées par Stripe. Numéro de kiosque demandé au paiement puis vérifié manuellement.

## État technique

- Configuration commune validée et générée pour le navigateur; les secrets `.env` ne sont jamais exportés.
- Modèle événement et accueil testés dans Chrome sur ordinateur et téléphone.
- Deuxième événement fictif vérifié uniquement dans un test navigateur, non publié.
- Stripe de test connecté; taxes exclusives TPS/TVQ vérifiées. Session de 1 écran : 599 $ + 89,70 $ = 688,70 $. Session expirée sans paiement.
- Le stock partagé passe de 20 à 19 pendant ce test puis revient à 20 après expiration.
- Session anglaise de test vérifiée : locale Stripe `en`, champs Booth number / Company name, montant inchangé; expirée sans paiement. Le retour conserve `lang=en`.
- Webhook non configuré localement; clé de signature absente. Notifications Resend facultatives, déduplication durable encore à faire.
- Aucun achat réel; boutons de paiement non branchés. Page « Merci » historique à sécuriser par vérification serveur.

## À confirmer avant production

1. Périodes réelles de transport/retour et fermeture des ventes par événement.
2. Stock transactionnel et stratégie de reprise après échec Stripe.
3. Moyens de paiement activés dans Stripe et traitement des paiements différés/échoués.
4. Valeur commerciale de 7 000 $ par écran et besoins électriques : les valeurs de 4+ écrans restent des extrapolations non validées.
5. Conditions, confidentialité, reçus et notifications automatiques.

Les anciens documents sont conservés pour historique. Le plan actuel est [PLAN.md](PLAN.md); la procédure d’ajout d’un salon est [EVENEMENTS.md](EVENEMENTS.md).
