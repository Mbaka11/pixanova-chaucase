# Stripe — serveur et essais locaux

## Lancer le parcours complet

Utiliser **http://localhost:8888**, pas le port 8080 seul : Netlify Dev fournit à la fois la page et les fonctions `/api/*`.

Préparer `.env` depuis `.env.example`, avec la clé de **test**, les deux taux exclusifs TPS/TVQ et `SITE_URL=http://localhost:8888`. Ne jamais coller ces valeurs dans le dépôt ou dans un message.

### Terminal 1 — transfert des webhooks

```bash
npm run stripe:listen
```

Le script utilise la CLI Stripe installée dans le PATH, ou la copie Windows locale `temp/stripe-cli/stripe.exe` si elle existe. Il reçoit la clé API par environnement, sans argument visible, et refuse les clés réelles.

Le secret de signature généré est enregistré automatiquement dans `.env`, sans être affiché. Laisser ce terminal ouvert. Sur cette machine, la CLI officielle 1.55.2 est disponible dans `temp/stripe-cli/`; son téléchargement a été vérifié par SHA-256. Ce binaire ignoré par Git n’est pas inclus dans un clone neuf : installer alors la [CLI officielle](https://docs.stripe.com/stripe-cli).

### Terminal 2 — page et API

```bash
npm ci
npm run dev:full
```

- Accueil : http://localhost:8888/
- ChauCase FR : http://localhost:8888/evenement.html?event=chaucase-2027
- ChauCase EN : http://localhost:8888/evenement.html?event=chaucase-2027&lang=en
- Stock : http://localhost:8888/api/stock?event=chaucase-2027

La CLI Netlify est une dépendance de développement. L’option `--offline` évite de demander une connexion au compte Netlify; Stripe utilise toujours Internet.

**Après un changement du `.env`, redémarrer Netlify Dev.** Contrairement au CSS ou au JavaScript, les nouvelles valeurs de secret ne sont pas prises en compte automatiquement. Si le serveur était déjà lancé avant `stripe:listen`, l’arrêter puis le relancer.

Pour arrêter : Ctrl+C dans chaque terminal.

## Parcours

1. Le bouton d’une offre ouvre le récapitulatif FR/EN. **Sans montage** est choisi par défaut.
2. Choix facultatif : création graphique **200 $ / 4 h**, motion design **400 $ / 10 h**, avant taxes, sans supplément selon la quantité. Les trois fiches restent inchangées.
3. `/api/quote` calcule écrans, montage, TPS, TVQ et total sans bloquer de stock. Les taux Stripe doivent être actifs, exclusifs et correspondre aux pourcentages configurés.
4. « Continuer vers le paiement » transmet événement, quantité, montage, langue et ancien total attendu. `/api/checkout` recalcule tout : un écart exige une nouvelle confirmation, sans créer de session. Le montant Stripe créé est aussi contrôlé.
5. **Un seul Checkout et un seul paiement**, avec une ligne écrans, éventuellement une ligne création et une ligne livraison/installation à **0 $**. Nom complet, courriel, téléphone, kiosque et entreprise requis; adresse de facturation collectée. Le nom et le logo sont personnalisés par session.
6. Seuls les écrans sont temporairement bloqués pendant la session (30 minutes).
7. Au retour, `/api/reservation` vérifie Stripe et affiche aussi le montage payé. `merci=1` seul ne confirme rien. Aucun achat supplémentaire sur cette page.
8. Le webhook vérifie la signature et traite la notification. Sans Resend, il journalise seulement un résumé non personnel : aucun courriel d’équipe envoyé.

La réponse de `/api/reservation` ne contient ni adresse, ni courriel, ni téléphone, ni détails de carte.

## Essais effectués en bac à sable

| Essai | Résultat |
|---|---|
| Stock initial | 20 / 20 |
| 1 écran FR, carte `4242 4242 4242 4242` | Paiement réussi : 599,00 $ + TPS 29,95 $ + TVQ 59,75 $ = **688,70 $ CAD** |
| Retour FR | Confirmation vérifiée auprès de Stripe, récapitulatif affiché |
| Webhook de ce paiement | Reçu par la CLI et transmis au serveur : HTTP 200 |
| Stock après paiement | 19 / 20 |
| Remboursement intégral de ce paiement test | Réussi; stock revenu à 20 / 20; page affichant « Paiement remboursé » |
| 2 écrans EN, carte `4000 0000 0000 0002` | Refusée; paiement impayé; total affiché **1 258,98 $ CAD** |
| Retour depuis le Checkout anglais | Événement et langue conservés |
| Expiration forcée de la session impayée | Quantité libérée; API et page indiquent l’expiration |
| 4 écrans sélectionnés dans la troisième fiche EN | Quantité 4 reçue par Stripe; **2 437,47 $ CAD** avec taxes; stock 16 pendant le blocage, puis 20 après expiration sans paiement |
| Trois clics rapides sur le paiement | Une seule requête Checkout pendant la préparation |
| Stock insuffisant simulé | Message localisé et mise à jour du stock |
| Retour `merci=1` sans session | « Paiement non vérifié », détails de réservation masqués |
| Webhook signé / sans signature | HTTP 200 / HTTP 400 |
| Plusieurs événements dans Stripe test | Pic simultané correct : périodes disjointes réutilisées, chevauchements additionnés, réservation de mars sans effet sur février |
| Nettoyage | Sessions d’essai expirées, paiement réussi remboursé, stock final **20 / 20** |

Les expirations ont été forcées via l’API pour ne pas attendre 30 minutes. Le délai normal est configuré à 30 minutes. Aucun paiement réel n’a été effectué; les coordonnées d’essai sont fictives.

`npm test` couvre également les règles métier et la vérification de confirmation.

## Complément : montage avant Stripe

Les neuf sessions suivantes ont réellement été créées dans Stripe **test**, comparées au récapitulatif et expirées sans paiement :

| Écrans | Montage | Total CAD, taxes comprises |
|---|---|---:|
| 1 | Aucun | 688,70 $ |
| 1 | Création graphique | 918,65 $ |
| 1 | Motion design | 1 148,60 $ |
| 2 | Aucun | 1 258,98 $ |
| 2 | Création graphique | 1 488,93 $ |
| 2 | Motion design | 1 718,88 $ |
| 3 | Aucun | 1 828,10 $ |
| 3 | Création graphique | 2 058,05 $ |
| 3 | Motion design | 2 288,00 $ |

Arrondir chaque taxe **par ligne**, et non sur le sous-total global. Avec les forfaits actuels : 2 écrans + création graphique donnent TPS 64,75 $ et TVQ 129,18 $, soit 1 488,93 $ au total. La méthode a été comparée aux valeurs Stripe, pas seulement à un calcul simulé. Une ancienne commande avec création à 250 $ reste à 1 546,42 $ : ne jamais la recalculer au nouveau tarif.

Un paiement **de test** a été effectué dans le navigateur avec le nom complet du contact : **2 écrans + création graphique = 1 488,93 $**, retour anglais confirmé, résumé structuré avec TPS/TVQ et logistique offerte, aucun achat supplémentaire. Ce paiement a été intégralement remboursé.

Contrôles navigateur : ordinateur FR, mobile EN sans débordement, Échap et restitution du focus, impossibilité de focaliser l’arrière-plan, choix gratuit réinitialisé, total indisponible bloquant le paiement avec bouton de reprise, triple clic n’envoyant qu’un POST Checkout. Aucun écran n’est bloqué à la simple ouverture de la modale.

Les réservations déjà présentes ont été conservées et la disponibilité comparée avant/après chaque série d’essais. Seuls les blocages et paiements créés par ces essais ont été nettoyés. Ne jamais ramener artificiellement le stock à 20 en expirant ou remboursant les commandes d’un autre essai/utilisateur.

## Affichage de l’heure dans le Dashboard Stripe

Le décalage signalé concerne le tableau de bord, pas les dates de location. Dans les **paramètres du compte Stripe**, régler le fuseau d’affichage sur **America/Toronto**, qui couvre Montréal et les changements d’heure saisonniers. Cette préférence nécessite une action dans le compte; elle n’a pas été modifiée par le code.

Les timestamps de l’API et certains journaux/exports restent en UTC : c’est normal. Ne pas modifier `Date.now()`, les timestamps Stripe ni les périodes de réservation pour compenser cet affichage. [Référence Stripe](https://support.stripe.com/questions/customize-the-time-zone-on-the-dashboard?locale=en-GB).

## Limites avant production

- **Réservation atomique du stock toujours à ajouter**. Deux lectures Stripe ne remplacent pas une transaction ou un verrou partagé. Les clés réelles restent bloquées.
- Une seule requête au clic côté navigateur n’est pas une idempotence durable côté serveur; les reprises réseau et les multi-onglets restent à traiter.
- Authentification bancaire 3-D Secure, autres moyens de paiement et échecs asynchrones restent à tester avant activation.
- Déduplication durable des webhooks, notifications courriel et reçus client à valider avec la configuration réelle.
- L’annulation depuis Checkout ne libère pas immédiatement le blocage : il expire après son délai. Ne pas retirer le stock sur la simple visite de l’URL d’annulation.
- Valider les périodes physiques de transport/retour, le domaine public et les conditions de location avant lancement.
