# Pixanova Events — plan actuel

Références : [CONTEXTE.md](CONTEXTE.md), [EVENEMENTS.md](EVENEMENTS.md).

## 1. Base multiévénement

- [x] Nom Pixanova Events et dépôt public `pixanova-events`.
- [x] Configuration commune du parc physique et des coordonnées.
- [x] Fichiers par événement : identité, logo, dates, prix, médias, maximum par commande.
- [x] Validation des configurations; même source pour la page et le serveur.
- [x] Accueil de sélection des événements.
- [x] Modèle commun conservant le design, les animations et les trois fiches.
- [x] Compteur de 3 à 10 écrans et alignement des prix préservés.
- [x] Dates et noms dynamiques dans les textes, FAQ, échéances et retours Stripe.
- [x] Français par défaut; traduction anglaise et sélecteur FR / EN (accueil, événement, dates, prix, consentement, navigation et retours Stripe).

## 2. Disponibilité globale selon le calendrier

- [x] Un inventaire commun de 20, pas un quota de 20 par événement.
- [x] Pic de consommation sur la période de location (transport, installation, retour compris).
- [x] Même stock partagé entre salons qui se chevauchent; réutilisation possible à des dates différentes.
- [x] Périodes figées dans les nouvelles sessions Stripe; compatibilité des anciennes sessions ChauCase.
- [x] Afficher « Stock à confirmer » si le serveur n’est pas joignable, sans annoncer de fausse disponibilité.
- [ ] **Ajouter une réservation atomique dans un stockage partagé** : aucun contrôle par lectures Stripe seules ne garantit l’absence de survente.
- [ ] Gérer création Stripe échouée, expiration, paiement, remboursement et reprise de webhook avec états idempotents.
- [ ] Protection durable contre reprises réseau, multi-onglets et abus de réservation temporaire (garde contre les doubles clics déjà en place côté navigateur).

**Blocage de sécurité :** le serveur refuse actuellement les clés Stripe réelles. Ne pas retirer ce blocage tant que le stock transactionnel n’est pas testé avec plusieurs acheteurs simultanés.

## 3. Paiement et confirmation

- [x] Clé de test, TPS 5 % et TVQ 9,975 % exclusives vérifiées via Stripe.
- [x] Session de test créée avec événement et dates, 688,70 $ pour un écran; expirée sans paiement.
- [x] Retour Stripe conserve l’événement choisi.
- [x] Gestion des moyens de paiement compatible avec l’API Stripe actuelle (configuration Dashboard).
- [x] Brancher les boutons existants à `/api/checkout` sans remplacer les fiches; attente et erreurs bilingues.
- [x] Configurer et vérifier le webhook signé localement avec Stripe CLI.
- [ ] Configurer le webhook du domaine public sur Netlify.
- [x] Page « Merci » : vérifier côté serveur événement et paiement, masquer les détails pour les états impayé/expiré/remboursé ou une session invalide.
- [x] Afficher un récapitulatif vérifié (écrans, montage acheté, montant, taxes).
- [x] Modale FR/EN avant Stripe : sans montage par défaut, simple/animé facultatifs, taxes comprises et navigation clavier/mobile.
- [x] Paiement unique avec lignes écrans et montage; prix serveur, choix strict et métadonnées figées; aucun achat de montage après paiement.
- [x] Refuser un total périmé ou un montant Stripe différent du total accepté; taxes vérifiées et arrondies par ligne.
- [x] Neuf combinaisons Stripe test et paiement combiné réussi puis remboursé; réservations préexistantes préservées.
- [ ] Ajouter une référence de réservation client durable.
- [ ] Courriels client/équipe fiables et déduplication persistante des événements Stripe.
- [x] Tests locaux Stripe : carte acceptée/refusée, retour anglais/français, expiration, remboursement, compteur 4 écrans et disponibilité selon chevauchements; stock final restauré.
- [ ] Tests supplémentaires : 3-D Secure, stock atomique concurrent, reprises réseau et paiements différés.
- Résultats et commandes : [STRIPE-LOCAL.md](STRIPE-LOCAL.md).

## Retours de la démonstration

- [x] Accueil compact : nom et dates, sans explications commerciales superflues.
- [x] Modale FR/EN allégée : bouton « Continuer vers le paiement », aucun message technique ni supplément.
- [x] Création graphique 200 $ / 4 h et motion design 400 $ / 10 h, sans variation par quantité; descriptions et FAQ coordonnées.
- [x] Collecte native du nom complet et identité Pixanova × événement dans Stripe.
- [x] Livraison/installation offertes : ligne Stripe à 0 $, badges dans le résumé, aucun prix barré inventé.
- [x] Confirmation centrée, reçu structuré avec TPS/TVQ réellement payées, trois étapes et aucun faux check pour un impayé.
- [x] Anciennes factures conservées à leur prix payé; tests FR/EN sur ordinateur et mobile.
- [ ] Régler le fuseau d’affichage du Dashboard Stripe dans les paramètres du compte (action propriétaire, pas une modification des timestamps API).

## 4. Validation métier et mise en ligne

- [ ] Valider avec Anis les marges de transport/retour de ChauCase (période actuellement provisoire).
- [ ] Fixer la fermeture des ventes si une date spécifique est souhaitée.
- [ ] Valider la valeur commerciale de 7 000 $ et l’alimentation à 4+ écrans (extrapolée, non confirmée).
- [ ] Conditions de location, remboursement, confidentialité et taxes.
- [ ] Favicon, image de partage et statistiques sous consentement.
- [ ] Relier le dépôt renommé à Netlify, renseigner les secrets et vérifier le webhook.
- [ ] Vérifier domaine personnalisé et liens envoyés par les organisateurs.
- [ ] Validation en test, puis passage réel après levée des blocages.

## Plus tard

- Sous-titrage ou versions anglaises des vidéos, si souhaité (audio original conservé).
- Administration des événements si les fichiers deviennent insuffisants.
- Rappels de remise des visuels et export comptable.

## Respect du design

Ne pas appliquer l’ancienne proposition de remplacer les trois fiches par un bloc unique ni de raccourcir la page : le choix actuel est de garder la présentation existante et de la rendre configurable.
