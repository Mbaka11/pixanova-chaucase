import { mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { catalog } from '../config/catalog.mjs';

// Échouer au build plutôt que publier un logo ou une vidéo manquante.
const assets = [catalog.platform.brand.logo, ...catalog.events.flatMap((event) => [event.logo, event.media.desktopVideo, event.media.mobileVideo])];
for (const asset of assets) {
  if (!statSync(new URL(`../public${asset}`, import.meta.url)).isFile()) throw new Error(`Média invalide : ${asset}`);
}
const js = new URL('../public/js/', import.meta.url);
mkdirSync(js, { recursive: true });
writeFileSync(new URL('catalog-data.js', js), '// Généré depuis config/ : ne pas modifier. AUCUN secret dans config/.\nexport default ' + JSON.stringify(catalog, null, 2) + ';\n');
copyFileSync(new URL('../shared/events.mjs', import.meta.url), new URL('events-shared.js', js));
console.log(`${catalog.platform.name} : ${catalog.events.length} événement(s) validé(s).`);
