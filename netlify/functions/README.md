# Fonctions serveur (Netlify Functions)

Dossier réservé au code serveur. Rien ici n'est visible par le navigateur.

Prévu :

- `create-checkout` : reçoit le choix du client (nombre d'écrans), recalcule le prix selon la date (heure de Montréal), vérifie le stock et crée la session Stripe Checkout.
- `stripe-webhook` : reçoit la confirmation de paiement de Stripe et avertit l'équipe.

Les clés Stripe sont lues dans les variables d'environnement (voir `.env.example`).
