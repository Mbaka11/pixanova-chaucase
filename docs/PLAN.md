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
- [ ] Protection contre les doubles clics et abus de réservation temporaire.

**Blocage de sécurité :** le serveur refuse actuellement les clés Stripe réelles. Ne pas retirer ce blocage tant que le stock transactionnel n’est pas testé avec plusieurs acheteurs simultanés.

## 3. Paiement et confirmation

- [x] Clé de test, TPS 5 % et TVQ 9,975 % exclusives vérifiées via Stripe.
- [x] Session de test créée avec événement et dates, 688,70 $ pour un écran; expirée sans paiement.
- [x] Retour Stripe conserve l’événement choisi.
- [x] Gestion des moyens de paiement compatible avec l’API Stripe actuelle (configuration Dashboard).
- [ ] Brancher les boutons existants à `/api/checkout` sans remplacer les fiches.
- [ ] Configurer le webhook signé localement puis sur Netlify.
- [ ] Page « Merci » : vérifier côté serveur que la session correspond à l’événement et est payée. Le paramètre `merci=1` n’est pas une preuve de paiement.
- [ ] Afficher récapitulatif et référence de réservation.
- [ ] Courriels client/équipe fiables et déduplication persistante des événements Stripe.
- [ ] Tests complets : carte acceptée/refusée, abandon, stock concurrent, paiements différés, remboursements et événements en chevauchement.

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
- Montage graphique au paiement (fonctionnalité en attente).
- Administration des événements si les fichiers deviennent insuffisants.
- Rappels de remise des visuels et export comptable.

## Respect du design

Ne pas appliquer l’ancienne proposition de remplacer les trois fiches par un bloc unique ni de raccourcir la page : le choix actuel est de garder la présentation existante et de la rendre configurable.
