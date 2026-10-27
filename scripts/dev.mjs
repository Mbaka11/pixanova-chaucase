import browserSync from 'browser-sync';
import { watch } from 'node:fs';
import { execFileSync } from 'node:child_process';

const build = () => execFileSync(process.execPath, ['scripts/build-config.mjs'], { stdio: 'inherit' });
build();
let timeout;
for (const directory of ['config', 'shared']) {
  watch(directory, { recursive: true }, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      try { build(); } catch { console.error('Configuration invalide : corriger le fichier pour recharger.'); }
    }, 200);
  });
}
browserSync.create().init({
  server: 'public', files: ['public/**/*'], port: 8080,
  notify: false, open: false, ui: false, ghostMode: false,
});
