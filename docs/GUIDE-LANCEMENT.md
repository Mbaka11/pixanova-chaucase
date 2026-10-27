# Guide de lancement : page de vente + liens de paiement Stripe

> **Historique :** ce guide monoévénement décrit les 12 liens Stripe, approche remplacée par Pixanova Events et un Checkout serveur commun. Suivre [CONTEXTE.md](CONTEXTE.md), [PLAN.md](PLAN.md) et [EVENEMENTS.md](EVENEMENTS.md) pour la configuration actuelle. Les anciennes procédures de stock manuel ne conviennent pas au parc partagé.

Fichier à publier : **`index.html`** (avec le dossier `assets`).
`maquette.html` est l'ancienne maquette, à garder pour référence seulement.

## 1. Les liens de paiement Stripe à créer (12 liens)

Dans Stripe : **Liens de paiement, Créer un lien**. Pour chacun : un produit, un prix en dollars canadiens, et les réglages communs ci-dessous.

### Réglages communs (à refaire pour chaque lien, ou à dupliquer)

- Taxes : laisser Stripe gérer la TPS et la TVQ comme tu l'as déjà configuré.
- Collecter l'**adresse de facturation** et le **numéro de téléphone**.
- **Champs personnalisés** (dans les options) :
  - « Numéro de kiosque ChauCase » (texte, obligatoire)
  - « Nom de l'entreprise » (texte, obligatoire)
- **Après le paiement** : rediriger vers `https://TON-ADRESSE/?merci=1` (remplace par l'adresse réelle du site).
- Facultatif : « Limiter le nombre de paiements » (voir section 3).

### Prix early bird (jusqu'au 15 décembre 2026, 23 h 59)

| Nom du produit | Prix avant taxes | Quantité |
|---|---|---|
| Écran LED ChauCase 2027, 1 écran (early bird) | 599 $ | 1 (fixe) |
| Écran LED ChauCase 2027, 2 écrans (early bird) | 1 095 $ | 1 (fixe) |
| Écran LED ChauCase 2027, 3 écrans (early bird) | 1 590 $ | 1 (fixe) |
| Écran LED ChauCase 2027, par écran (early bird) | 530 $ | **ajustable, minimum 4, maximum 10** |

### Prix régulier (après le 15 décembre)

| Nom du produit | Prix avant taxes | Quantité |
|---|---|---|
| Écran LED ChauCase 2027, 1 écran | 795 $ | 1 (fixe) |
| Écran LED ChauCase 2027, 2 écrans | 1 395 $ | 1 (fixe) |
| Écran LED ChauCase 2027, 3 écrans | 1 950 $ | 1 (fixe) |
| Écran LED ChauCase 2027, par écran | 650 $ | **ajustable, minimum 4, maximum 10** |

### Montage (même prix toute la période, offert sur la page « Merci »)

| Nom du produit | Prix avant taxes |
|---|---|
| Montage simple, 1 écran | 150 $ |
| Montage simple, 2 écrans ou plus | 250 $ |
| Montage animé, 1 écran | 350 $ |
| Montage animé, 2 écrans ou plus | 450 $ |

Pour les 4 montages, pas besoin des champs « kiosque » : le client est déjà connu.

## 2. Coller les liens dans la page

Ouvre `index.html` avec un éditeur de texte. Au début du script, cherche `const CONFIG`. Colle chaque adresse Stripe (`https://buy.stripe.com/...`) entre les guillemets :

```
links: {
  early:   { 1:'https://buy.stripe.com/...', 2:'...', 3:'...', more:'...' },
  regular: { 1:'...', 2:'...', 3:'...', more:'...' },
  montage: { simple1:'...', simple2:'...', anime1:'...', anime2:'...' }
},
```

Tant qu'un lien est vide, le bouton affiche un message d'avertissement au lieu d'envoyer le visiteur nulle part.

Le basculement du prix early bird au prix régulier se fait **tout seul** le 15 décembre à 23 h 59 (heure de Montréal) : la page change de prix et de liens. Pense à désactiver les liens early bird dans Stripe à ce moment.

## 3. Le stock de 20 écrans

Deux façons de tenir le compteur « X écrans restants » :

**Simple : à la main.** Dans `CONFIG`, change `reserved: 0` pour le nombre d'écrans déjà vendus (un forfait 2 écrans compte pour 2, etc.), puis remets le fichier en ligne.

**Mieux : avec un Google Sheets.**
1. Crée un Google Sheets. Dans la cellule A1, écris le nombre d'écrans vendus.
2. Fichier, Partager, **Publier sur le web**. Choisis « Feuille 1 » et le format **CSV**, puis publie.
3. Copie l'adresse obtenue dans `stockSheetUrl` de `CONFIG`.
4. Après chaque vente, change le chiffre dans A1. La page le lit à chaque visite, sans remettre le fichier en ligne.

Quand il reste moins d'écrans qu'un forfait, son bouton devient « liste d'attente » tout seul. Quand tout est vendu, tous les boutons mènent à la liste d'attente (un courriel préparé vers `info@pixanova.ca`).

**Pour éviter de dépasser 20 :** les liens Stripe ne connaissent pas le stock. Quand il reste peu d'écrans, désactive les liens trop gros dans Stripe (Liens de paiement, Désactiver). Les paiements simultanés pour le dernier écran restent possibles, mais rares.

## 4. Mettre la page en ligne

Il faut publier `index.html` **et** le dossier `assets` ensemble, au même endroit. Options simples : Netlify (glisser-déposer le dossier), Cloudflare Pages, GoHighLevel, ou ton hébergeur actuel.

À ne **pas** publier : `maquette.html`, `archive-plateforme-complete`, `assets/compresse`.

Attention aux vidéos : `assets/vsl-mobile.mp4` (359 Mo) et les vidéos de témoignages (146 Mo en tout) sont très lourdes. Le site fonctionne avec elles, mais le chargement sera lent sur téléphone. Avant le lancement réel, on prévoit une version allégée en haute qualité.

## 5. Statistiques de visiteurs

Dans `CONFIG`, section `analytics`, colle les identifiants :

- **Google Analytics 4** (`ga4:'G-XXXXXXXXXX'`) : d'où viennent les visiteurs, appareil, temps passé, pages. Gratuit.
- **Microsoft Clarity** (`clarity:'xxxxxxxxxx'`) : cartes de chaleur, jusqu'où on défile, enregistrements de visites. Gratuit. Le plus utile pour voir quelle section retient l'attention.
- **Pixel Meta** (`metaPixel:'1234567890'`) : utile si tu fais de la publicité.

Une **bannière de consentement** (loi 25) s'affiche toute seule dès qu'un identifiant est rempli. Rien n'est envoyé tant que le visiteur n'a pas accepté.

Ce que la page enregistre pour les visiteurs qui acceptent :
- les **sections vues** (offre, vidéo, comment ça marche, offres, pourquoi, montage, réalisations, questions, appel final);
- la **vidéo** : lecture, 25 %, 50 %, 75 %, 100 %, activation du son;
- les **clics** sur « Réserver » et sur chaque forfait (début de paiement);
- l'**achat** (arrivée sur la page « Merci »).

## 6. Courriel à envoyer à chaque acheteur (visuels)

> **Objet :** ChauCase 2027 : vos visuels pour votre écran LED
>
> Bonjour,
>
> Merci pour votre réservation! Votre écran est confirmé pour le salon ChauCase 2027 (installation le 1er février, salon du 2 au 4 février).
>
> Pour préparer votre écran, répondez à ce courriel avec :
> - votre logo et vos visuels (JPEG, PNG ou MP4);
> - le numéro de votre kiosque;
> - le nom et le cellulaire de la personne sur place.
>
> Format : 516 x 1032 px pour 1 écran, 1032 x 1032 px pour 2 écrans côte à côte, 1548 x 1032 px pour 3 écrans. Date limite : **29 janvier 2027**.
>
> Pas de visuels? Notre infographiste peut les créer : montage simple (150 $) ou animé (350 $).
>
> Au plaisir,
>
> Anis Elourzadi
> Cofondateur & Développement Commercial
> Pixanova · info@pixanova.ca · +1 (438) 491-0384

## 7. Essais avant d'annoncer

1. Dans Stripe en **mode test**, crée les liens et colle-les dans la page.
2. Paie avec la carte `4242 4242 4242 4242` (date future, n'importe quel CVC). Tu dois arriver sur la page « Merci ».
3. Vérifie le reçu : TPS et TVQ affichées, champs « kiosque » et « entreprise » reçus.
4. Teste les 4 liens de montage, puis le lien « plus de 3 écrans » (quantité de 4 à 10).
5. Teste sur un téléphone : boutons, vidéo, barre du bas, page « Merci ».
6. Remplace par les liens **réels**, fais un paiement réel de petit montant, puis rembourse-le.

## 8. Remboursements

Remboursement complet jusqu'au 15 janvier 2027 : fais-le dans Stripe (Paiements, le paiement, Rembourser). Pense ensuite à baisser le nombre dans `reserved` ou dans la cellule A1 pour remettre l'écran en stock.

## 9. Plus tard

- **QuickBooks** : export des paiements Stripe en CSV, puis application de synchronisation (Synder ou autre).
- **Plateforme complète** (base de données, lien magique, tableau de bord) : le plan est dans `archive-plateforme-complete`, si le volume le justifie un jour.
