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
- [x] Réservation atomique Supabase, séparation test/réel et pic calendaire : 32 requêtes simultanées, exactement 20 acceptées et 12 refusées.
- [x] Création Stripe ambiguë, expiration, paiement, remboursements complets/partiels et événements dupliqués/désordonnés : intégration TEST validée.
- [x] UUID de demande, paramètres figés et clé Stripe d'idempotence pour les retries réseau et doubles clics.
- [ ] Protection contre l'abus de réservations temporaires et dimensionnement de la réconciliation ; les multi-onglets peuvent encore générer des UUID distincts.

**Production active :** le réel exige désormais Supabase, un parc LIVE initialisé et une capacité vérifiée ; le backend Stripe historique reste interdit en réel. Checkout `livemode=true`, taxes, idempotence et webhook réel ont été vérifiés sans débit (stock 20 → 19 → 20). L'utilisateur a explicitement demandé l'ouverture sans Resend ; les courriels Stripe suffisent. Détails et limites : [SUPABASE-EVENTS.md](SUPABASE-EVENTS.md).

## 3. Paiement et confirmation

- [x] Clé de test, TPS 5 % et TVQ 9,975 % exclusives vérifiées via Stripe.
- [x] Session de test créée avec événement et dates, 688,70 $ pour un écran; expirée sans paiement.
- [x] Retour Stripe conserve l’événement choisi.
- [x] Gestion des moyens de paiement compatible avec l’API Stripe actuelle (configuration Dashboard).
- [x] Brancher les boutons existants à `/api/checkout` sans remplacer les fiches; attente et erreurs bilingues.
- [x] Configurer et vérifier le webhook signé localement avec Stripe CLI.
- [x] Webhook public TEST sur events.pixanova.ca : 5 événements, signature et livraison Stripe réelles validées, expirations libérant le stock.
- [x] Page « Merci » : vérifier côté serveur événement et paiement, masquer les détails pour les états impayé/expiré/remboursé ou une session invalide.
- [x] Afficher un récapitulatif vérifié (écrans, montage acheté, montant, taxes).
- [x] Modale FR/EN avant Stripe : sans montage par défaut, simple/animé facultatifs, taxes comprises et navigation clavier/mobile.
- [x] Paiement unique avec lignes écrans et montage; prix serveur, choix strict et métadonnées figées; aucun achat de montage après paiement.
- [x] Refuser un total périmé ou un montant Stripe différent du total accepté; taxes vérifiées et arrondies par ligne.
- [x] Neuf combinaisons Stripe test et paiement combiné réussi puis remboursé; réservations préexistantes préservées.
- [ ] Ajouter une référence de réservation client durable.
- [x] Reçus d'événements et transitions persistants ; courriels Stripe retenus par l'utilisateur. Resend reste une option, pas un prérequis.
- [x] Tests locaux Stripe : carte acceptée/refusée, retour anglais/français, expiration, remboursement, compteur 4 écrans et disponibilité selon chevauchements; stock final restauré.
- [x] Stock atomique concurrent, reprise après crash Stripe/DB, expiration publique et remboursements complets/partiels.
- [ ] Tests supplémentaires : 3-D Secure et cycle asynchrone complet en navigateur.
- Résultats et commandes : [STRIPE-LOCAL.md](STRIPE-LOCAL.md).

## Retours de la démonstration

- [x] Accueil compact : nom et dates, sans explications commerciales superflues.
- [x] Modale FR/EN allégée : bouton « Continuer vers le paiement », aucun message technique ni supplément.
- [x] Création graphique 200 $ / 4 h et motion design 400 $ / 10 h, sans variation par quantité; descriptions et FAQ coordonnées.
- [x] Collecte native du nom complet et identité Pixanova × événement dans Stripe.
- [x] Livraison/installation offertes : ligne Stripe à 0 $, badges dans le résumé, aucun prix barré inventé.
- [x] Confirmation centrée, reçu structuré avec TPS/TVQ réellement payées, trois étapes et aucun faux check pour un impayé.
- [x] Hiérarchie de prix allégée dans la modale et le reçu : total dominant, détails et taxes en petit, livraison/installation réunies en une mention discrète.
- [x] Anciennes factures conservées à leur prix payé; tests FR/EN sur ordinateur et mobile.
- [x] Fuseau d'affichage du Dashboard Stripe réglé selon confirmation utilisateur ; timestamps API inchangés.

## Refonte de la page de vente (revue GPT-6.1 Sol / Opus 5.5)

- [x] Ordre : vidéo explicative, offres sur fond clair, preuves, étapes, création de contenu, FAQ, rappel final.
- [x] Offres empilées sur mobile; prix par écran discret; alimentation 5 A / 10 A, puis « Selon le kiosque » dès 3 écrans.
- [x] Section création : CNC (graphique) et MAclinique (motion, extrait de 1 min 31 de la boucle V3) avec crédits en pied de page.
- [x] FAQ réduite à 7 questions; liens vers le site Pixanova; comparatif « affiche traditionnelle » retiré.
- [ ] Confirmer l’autorisation de diffuser les extraits CNC et MAclinique publiquement (le « 1 595 $ » de CNC est son propre prix).
- [ ] Sous-titres ou transcription des vidéos.

## 4. Validation métier et mise en ligne

- [ ] Valider avec Anis les marges de transport/retour de ChauCase (période actuellement provisoire).
- [ ] Fixer la fermeture des ventes si une date spécifique est souhaitée.
- [ ] Valider la valeur commerciale de 7 000 $ et l’alimentation à 4+ écrans (extrapolée, non confirmée).
- [ ] Conditions de location, remboursement, confidentialité et taxes.
- [ ] Favicon, image de partage et statistiques sous consentement.
- [x] Dépôt et CLI reliés à Netlify ; variables Supabase et webhook TEST configurés, historique de 58 sessions préservé (stock 6 pris / 14 libres).
- [x] Domaine personnalisé events.pixanova.ca et certificat HTTPS vérifiés ; SITE_URL public mis à jour.
- [ ] Vérifier les liens envoyés par les organisateurs.
- [x] Passage réel effectué sur demande explicite : clés réelles dans Netlify Production, parc LIVE et webhook réel raccordés ; notre Checkout réel non payé a été expiré et le stock restauré.

## Plus tard

- Sous-titrage ou versions anglaises des vidéos, si souhaité (audio original conservé).
- Administration des événements si les fichiers deviennent insuffisants.
- Rappels de remise des visuels et export comptable.

## Respect du design

Ne pas appliquer l’ancienne proposition de remplacer les trois fiches par un bloc unique ni de raccourcir la page : le choix actuel est de garder la présentation existante et de la rendre configurable.
