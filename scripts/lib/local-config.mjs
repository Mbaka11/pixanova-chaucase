import { readFileSync } from 'node:fs';

// Scripts opérateur seulement : lit également les emplacements commentés Supabase.
// Ne jamais importer depuis le site ou les fonctions Netlify.
export function localConfig() {
  const values = { ...process.env };
  for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    const commented = /^#\s*(SUPABASE_URL|SUPABASE_SECRET_KEY)=/.test(text);
    if (text.startsWith('#') && !commented) continue;
    const match = (commented ? text.replace(/^#\s*/, '') : text).match(/^([A-Z_]+)=(.*)$/);
    if (match && !values[match[1]]) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
