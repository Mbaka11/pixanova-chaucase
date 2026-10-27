# Contexte du projet (à lire en premier)

Résumé à jour de ce qu'il faut garder en tête. Le plan d'action est dans [PLAN.md](PLAN.md). Les documents d'origine de la personne précédente sont conservés dans [`HANDOFF.md`](HANDOFF.md) et [`GUIDE-LANCEMENT.md`](GUIDE-LANCEMENT.md).

## Le projet

- **Pixanova** loue des écrans LED portables pour salons (196 × 96 cm, sur roues, 120 V, contenu par clé USB).
- Pixanova est le **fournisseur officiel d'écrans LED de ChauCase 2027** : Drummondville, salon du 2 au 4 février 2027, installation le 1er février.
- **But :** louer **20 écrans maximum** aux exposants à un prix exclusif. L'exposant réserve et paie seul en ligne, sans échange avec l'équipe.
- Le salon annonce l'offre par courriel et sur chaucase.com, et envoie le trafic vers notre page.
- Contact : Anis Elourzadi, cofondateur, info@pixanova.ca, +1 (438) 491-0384.

## Prix (avant taxes, en CAD)

| Forfait | Early bird (jusqu'au 15 déc. 2026, 23 h 59, heure de Montréal) | Régulier |
|---|---:|---:|
| 1 écran | 599 $ | 795 $ |
| 2 écrans | 1 095 $ | 1 395 $ |
| 3 écrans | 1 590 $ | 1 950 $ |
| 4 à 10 écrans | 530 $ / écran | 650 $ / écran |

- Le prix de 3 écrans est gardé tel quel pour l'instant (il pourra changer).
- TPS 5 % et TVQ 9,975 % s'ajoutent au paiement.
- Remboursement complet jusqu'au **15 janvier 2027**.
- **Jamais plus de 20 écrans au total** (un forfait de 2 en consomme 2).
- Le numéro de kiosque est demandé au paiement, puis vérifié à la main.
- Visuels récupérés par courriel après l'achat (516 × 1032 px par écran), date limite le 29 janvier 2027.

## Décisions prises

| Sujet | Décision |
|---|---|
| Hébergement | **Netlify** (site statique `public/` + fonctions `server/`) |
| Paiement | **Stripe Checkout**, une session créée par le serveur à partir du choix du client. Pas de 12 liens de paiement. |
| Calcul du prix | Toujours côté serveur (le navigateur envoie seulement le nombre d'écrans) |
| Montage graphique | **En pause** pour l'instant (150 $ simple / 350 $ animé, +100 $ à 2 écrans ou plus) |
| Dépôt Git | Nouveau dépôt GitHub public, sans secrets |
| Ancienne plateforme Next.js / Supabase | Abandonnée, gardée dans `docs/archive/` pour référence |

## Organisation du dossier

```text
public/                 Ce qui est mis en ligne
  index.html            Structure de la page de vente
  css/styles.css        Tout le style
  js/config.js          Réglages modifiables (stock, date early bird, statistiques)
  js/main.js            Comportement de la page
  assets/               Images, logos, vidéos compressées pour le web
server/      Code serveur : paiement Stripe, stock, webhook
docs/                   Documentation
  archive/              Ancienne maquette et ancien plan de plateforme
media-sources/          Vidéos originales en pleine qualité (non versionnées)
temp/                   Fichiers de travail, captures d'écran (non versionnés)
netlify.toml            Configuration Netlify
.env.example            Variables d'environnement attendues
```

## Prochaines étapes

1. Fonction `create-checkout` : prix selon la date, stock, TPS/TVQ, champs kiosque et entreprise, retour vers la page « Merci ».
2. Remplacer les boutons de forfaits par un sélecteur de nombre d'écrans qui appelle cette fonction.
3. Stock côté serveur : compter les écrans payés et en cours de paiement dans Stripe, refuser au-delà de 20.
4. Webhook `checkout.session.completed` : avertir l'équipe.
5. Identifiants de statistiques dans `public/js/config.js`.
6. Essais en mode test Stripe (carte `4242 4242 4242 4242`), puis en réel.

## Points d'attention

- Aucune clé secrète dans `public/` ni dans le dépôt : seulement dans `.env` (local) et dans Netlify.
- La bascule early bird → régulier se fait à l'heure de Montréal (`America/Toronto`).
- Deux paiements simultanés sur les derniers écrans : à gérer côté serveur.
