/* ============================ CONFIGURATION ============================
   À modifier ici : liens de paiement Stripe, stock, statistiques.
   (Voir docs/GUIDE-LANCEMENT.md pour les étapes détaillées.)                    */
const CONFIG = {
  total: 20,                    // nombre total d'écrans
  reserved: 0,                  // écrans déjà vendus (à mettre à jour à la main)
  stockSheetUrl: '',            // optionnel : adresse CSV publiée d'un Google Sheets (une cellule = écrans vendus)
  earlyDeadline: '2026-12-15T23:59:00-05:00',   // fin du prix early bird (heure de Montréal)
  links: {                      // liens de paiement Stripe (coller les adresses entre les guillemets)
    early:   { 1:'', 2:'', 3:'', more:'' },
    regular: { 1:'', 2:'', 3:'', more:'' },
    montage: { simple1:'', simple2:'', anime1:'', anime2:'' }
  },
  waitlistEmail: 'info@pixanova.ca',
  analytics: { ga4:'', clarity:'', metaPixel:'' }   // ex. ga4:'G-XXXXXXXXXX', clarity:'abcdefghij', metaPixel:'1234567890'
};
