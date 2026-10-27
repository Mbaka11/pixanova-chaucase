# Plan de travail

Voir [CONTEXTE.md](CONTEXTE.md) pour les prix et les décisions. Ce plan se suit dans l'ordre. Cocher au fur et à mesure.

## Analyse de la page actuelle (octobre 2026)

**Constat : la page de vente est complète. Ce qui manque, ce n'est pas du contenu, c'est la réservation elle-même.**

Parcours actuel : bandeau early bird → hero (titre, prix, stock, animation) → vidéo → comment ça marche (3 étapes) → 3 offres → affiche vs écran → montage graphique → preuves (logos, photos, témoignages) → FAQ (10 questions) → appel final → pied de page. Environ 6 000 px de hauteur sur téléphone.

### Ce qui fonctionne bien

- Message clair dès le haut : rareté (20 écrans), prix, « livré et installé ».
- Le stock restant, le décompte et la barre collante en bas gardent l'urgence visible.
- Les boutons « Réserver » reviennent à chaque section.
- Les preuves (logos, témoignages vidéo, 5,0 sur Google) sont solides.
- Le style est cohérent avec l'image Pixanova.

### Ce qui manque vraiment

1. **Le panier et le paiement.** Aujourd'hui, les boutons « Réserver » n'envoient nulle part (liens Stripe vides).
2. **Un seul endroit pour choisir.** Les 3 cartes (1, 2, 3 écrans) cachent la 3ᵉ sur téléphone et le « plus de 3 » est un petit lien. Il faut un choix unique avec le total qui se met à jour.
3. **Le stock réel.** Il est modifié à la main (`reserved`), sans protection contre deux achats simultanés.
4. **Une page légale minimale** : conditions de remboursement et confidentialité (la page utilise des statistiques avec consentement, loi 25).
5. **Finitions** : icône du site, image de partage (aperçu dans les courriels et réseaux), identifiants de statistiques.

### Ce qui est en trop (pour une lecture rapide)

| Élément | Problème | Proposition |
|---|---|---|
| Section « Montage graphique » | Le montage est en pause, mais la section et le bloc de la page « Merci » sont affichés | Masquer pour l'instant |
| FAQ à 10 questions | Longue, plusieurs réponses sont déjà dites plus haut | Garder 6 à 7 questions, déplacer les détails techniques (formats, ampérage) après l'achat |
| « Affiche fixe ou écran qui bouge? » | Argumentaire utile, mais s'ajoute à 8 autres sections | Raccourcir ou fusionner avec « Comment ça marche » |
| Haut de page chargé | Titre, sous-titre, 2 boutons, prix, 3 avantages, compteur et animation dans le même écran | Garder : titre, prix, stock, un bouton. Les avantages passent sous la fenêtre |
| Cartes 1 / 2 / 3 écrans | Trois cartes répétant presque la même liste | Un seul bloc de réservation |
| Mentions « 7 000 $ de valeur » | Affirmation commerciale à confirmer avec Anis | Confirmer ou retirer |

## Étapes

### 1. Décisions rapides (avec Anis)

- [ ] Confirmer la valeur « 7 000 $ par écran » affichée.
- [ ] Confirmer que Interac reste manuel par courriel au lancement.
- [ ] Confirmer le maximum par commande (10 écrans).

Note de prix : 3 écrans = 3 × 530 $ et 3 × 650 $. Le forfait de 3 est donc le tarif « par écran » de 3 écrans et plus. Formule : 1 écran = 599 $ / 795 $, 2 écrans = 1 095 $ / 1 395 $, 3 écrans ou plus = quantité × 530 $ / 650 $.

### 2. Alléger la page

- [ ] Masquer la section montage et le bloc montage de la page « Merci ».
- [ ] Raccourcir la FAQ et la section « Affiche vs écran ».
- [ ] Simplifier le haut de page.
- [ ] Vérifier les logos et photos de la section preuves (vides sur une capture d'écran, probablement chargement différé).

### 3. Bloc de réservation unique

- [ ] Remplacer les 3 cartes par un bloc : choix du nombre d'écrans (1 à 10), prix par écran, économie, total avant taxes, mention « taxes ajoutées au paiement », bouton « Réserver ».
- [ ] Le choix est lu directement par le paiement : la page envoie seulement `{ screens: N }` au serveur.
- [ ] Les boutons « Réserver » des autres sections font défiler vers ce bloc.
- [ ] Désactiver les quantités qui dépassent le stock restant.

### 4. Fonctions serveur (`netlify/functions/`)

- [ ] `get-stock` : compte les écrans payés et en cours de paiement dans Stripe (20 − vendus − en attente). Remplace `reserved` à la main.
- [ ] `create-checkout` : recalcule le prix selon l'heure de Montréal, vérifie le stock, crée la session Stripe (prix en `price_data`, TPS et TVQ, champs « numéro de kiosque » et « entreprise », adresse, téléphone, expiration 30 min, `metadata.screens`). Vérifie le stock une seconde fois après la création pour les achats simultanés.
- [ ] `stripe-webhook` : sur `checkout.session.completed`, avertir l'équipe par courriel.
- [ ] Variables dans Netlify : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TAX_RATE_TPS`, `STRIPE_TAX_RATE_TVQ`, `SITE_URL`.

### 5. Page « Merci »

- [ ] Afficher le récapitulatif (nombre d'écrans, total).
- [ ] Garder les étapes suivantes (visuels, kiosque, installation).

### 6. Finitions

- [ ] Page « Conditions et confidentialité » (remboursement jusqu'au 15 janvier, loi 25).
- [ ] Icône du site, image de partage, balises de partage.
- [ ] Identifiants de statistiques dans `public/js/config.js`.

### 7. Essais et lancement

- [ ] `netlify dev` pour tester les fonctions en local.
- [ ] Mode test Stripe : carte `4242 4242 4242 4242`, carte refusée `4000 0000 0000 0002`, abandon de page, deux achats simultanés du dernier écran, bascule du prix le 15 décembre.
- [ ] Vérifier le reçu : TPS et TVQ séparées avec les numéros d'inscription.
- [ ] Téléphone réel : boutons, vidéo, barre du bas.
- [ ] Passage en réel : clés réelles, nouveaux taux de taxe et webhook, paiement réel remboursé.
- [ ] Annonce par ChauCase.

## Plus tard

- Montage graphique (150 $ / 350 $) dans le panier ou après l'achat.
- Interac en ligne si Stripe l'offre.
- Rappels automatiques pour les visuels.
- QuickBooks.
