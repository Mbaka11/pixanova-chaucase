# Pixanova x ChauCase 2027 : transfert du projet

> **Historique :** transfert monoévénement d’origine. Le projet est devenu **Pixanova Events** : accueil commun, modèle `public/evenement.html` et fichiers `config/events/*.json`. Les décisions actuelles sont dans [CONTEXTE.md](CONTEXTE.md) et [PLAN.md](PLAN.md). Les anciennes promesses de stock fondées uniquement sur Stripe ne constituent pas une garantie anti-survente.

## Contexte (30 secondes)
- **Pixanova** (Montréal) loue et vend des écrans LED portables pour salons : 196 x 96 cm, sur roues, branchés sur 120 V, contenu par clé USB.
- **Pixanova est le fournisseur officiel d'écrans LED du salon ChauCase** (Drummondville, 2 au 4 février 2027, installation le 1er février). Le promoteur (Marc Esculier, Groupe ChauCase) ne prend aucune commission.
- **Objectif :** louer jusqu'à **20 écrans** aux exposants, à un prix exclusif. Ils réservent et paient seuls en ligne. L'équipe suit les 20 écrans sans courriels perdus.
- Le salon annonce l'offre par courriel et sur chaucase.com : le trafic arrive sur notre page. Il n'y a plus de date limite fixe de lancement : on vise les prochains jours.

## Règles d'affaires
| Prix avant taxes | Early bird (avant le 15 déc. 2026, 23 h 59, heure de Montréal) | Régulier |
|---|---|---|
| 1 écran | 599 $ | 795 $ |
| 2 écrans | 1 095 $ | 1 395 $ |
| 3 écrans | 1 590 $ * | 1 950 $ * |
| Plus de 3 (4 à 10) | 530 $ / écran | 650 $ / écran |

\* Prix du forfait 3 écrans proposé, **à confirmer avec Anis**.

- **Montage graphique** (facultatif) : simple 150 $, animé 350 $. Avec 2 écrans ou plus : +100 $. Environ 3 h (simple) ou 5 h (animé) incluses, 59,99 $/h ensuite.
- TPS 5 % et TVQ 9,975 % s'ajoutent au paiement (Stripe). Remboursement complet jusqu'au **15 janvier 2027**.
- **Ne jamais dépasser 20 écrans** (un forfait de 2 en consomme 2).
- Prix réservé aux exposants : le numéro de kiosque est demandé, **vérifié à la main après** l'achat (pas de liste fiable pour l'instant).
- Visuels : récupérés par courriel après l'achat (JPEG, PNG ou MP4 ; 516 x 1032 px par écran), date limite 29 janvier 2027.

## Où on en est
- **`index.html`** : page de vente complète, un seul fichier (HTML, CSS, JS sans framework) + dossier `assets/`. Mobile d'abord. Contient : animation, vidéo VSL en lecture automatique, compteur d'écrans, barre collante avec décompte en direct, page « Merci » (`?merci=1` ou `#/merci`), liste d'attente par courriel, statistiques avec bannière de consentement (loi 25).
- **Configuration** : objet `CONFIG` au début du script (stock, date de fin early bird, liens de paiement, identifiants GA4 / Clarity / Meta).
- **Paiement : pas encore branché.** La page attend actuellement 12 liens de paiement Stripe (4 early bird, 4 régulier, 4 montages) à coller dans `CONFIG.links`. Le compte Stripe existe, en mode test (« formulaire de paiement préconfiguré »).
- `maquette.html` : ancienne maquette avec un parcours de réservation en 3 étapes (référence visuelle seulement). `archive-plateforme-complete/` : ancien plan (Next.js, Supabase, Resend), abandonné pour aller vite.

## Où on s'en va
Remplacer les 12 liens par un **Checkout Stripe intégré** avec un panier adaptatif (quantité d'écrans, montage, un seul paiement). Il demande une petite fonction serveur (Netlify, Cloudflare Pages ou Vercel). Anis penche pour cette option. **Hébergement et configuration des taxes (taux manuels TPS/TVQ ou Stripe Tax) restent à décider.**

## À faire maintenant (par ordre)
1. **Décider** : liens de paiement (rapide) ou Checkout intégré (recommandé), et l'hébergement.
2. **Fonction serveur** : créer la session Stripe en `price_data` (aucun produit à créer), prix calculé côté serveur selon la date et les options, `custom_fields` (numéro de kiosque, entreprise), adresse de facturation et téléphone, taxes, métadonnées, retour vers la page « Merci ».
3. **Panier dans `index.html`** : remplacer les boutons de forfaits par le panier et le formulaire intégré, en gardant le style.
4. **Stock** : refuser la vente côté serveur quand il ne reste plus assez d'écrans. Aujourd'hui, le stock se met à jour à la main (`reserved` ou une cellule Google Sheets publiée).
5. **Webhook** `checkout.session.completed` : avertir l'équipe par courriel, et idéalement mettre le stock à jour automatiquement.
6. **Vidéos** : `assets/vsl-mobile.mp4` (359 Mo), `assets/vsl video.mp4` (54 Mo) et les témoignages (146 Mo) sont trop lourds. Les compresser en haute qualité ou les héberger ailleurs. Versions compressées de secours dans `assets/compresse/`.
7. **Statistiques** : coller les identifiants dans `CONFIG.analytics`.
8. **Essais** en mode test (carte `4242 4242 4242 4242`), puis passage en réel avec un petit paiement réel remboursé.
9. **Plus tard** : QuickBooks (export CSV ou application de synchronisation ; attention aux codes TPS/TVQ), rappels de visuels automatiques, Interac (virement manuel par courriel pour l'instant).

## Points d'attention
- Aucune clé secrète dans la page ni dans le dépôt.
- Le prix early bird doit basculer à l'heure de Montréal (America/Toronto).
- Deux paiements simultanés sur les derniers écrans : à gérer côté serveur.
- Le dossier `GUIDE-LANCEMENT.md` décrit l'approche par liens de paiement (prix, champs, tests).

**Contact :** Anis Elourzadi, cofondateur, info@pixanova.ca, +1 (438) 491-0384.
