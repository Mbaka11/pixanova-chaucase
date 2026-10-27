// Test local uniquement. La clé API est transmise à la CLI par environnement, jamais en argument.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Une clé Stripe de TEST est requise.');
const bundled = path.resolve('temp/stripe-cli/stripe.exe');
const command = process.env.STRIPE_CLI_BIN || (existsSync(bundled) ? bundled : 'stripe');
const child = spawn(command, ['listen', '--events', 'checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,charge.refunded', '--forward-to', 'http://localhost:8888/api/stripe-webhook'], {
  env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY }, stdio: ['ignore', 'pipe', 'pipe'],
});
let pendingOutput = '', saved = false;
const redact = (value) => value.replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, '[SECRET]');
function output(chunk) {
  pendingOutput += chunk.toString();
  const newline = pendingOutput.lastIndexOf('\n');
  if (newline < 0) return; // Ne pas enregistrer ni afficher un secret partiellement reçu.
  const text = pendingOutput.slice(0, newline + 1);
  pendingOutput = pendingOutput.slice(newline + 1);
  const secret = text.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if (secret && !saved) {
    const source = readFileSync('.env', 'utf8');
    const matches = source.match(/^STRIPE_WEBHOOK_SECRET=/gm) || [];
    if (matches.length > 1) throw new Error('Variable webhook en double dans .env');
    const updated = matches.length
      ? source.replace(/^STRIPE_WEBHOOK_SECRET=[^\r\n]*/m, `STRIPE_WEBHOOK_SECRET=${secret}`)
      : source + `\nSTRIPE_WEBHOOK_SECRET=${secret}\n`;
    writeFileSync('.env', updated, 'utf8');
    saved = true;
    console.log('Secret du webhook local enregistré dans .env (non affiché).');
  }
  process.stdout.write(redact(text));
}
child.stdout.on('data', output); child.stderr.on('data', output);
child.on('error', (error) => { console.error(redact(error.message)); process.exitCode = 1; });
child.on('exit', (code) => { if (pendingOutput) output('\n'); process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
