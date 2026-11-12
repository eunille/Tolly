// Serves the Phonon browser runtime from the app's own origin (public/phonon/). Browsers only start
// Web Workers from the same origin, so it can't come from a CDN like Kokoro does. Runs on postinstall.
import { cpSync, existsSync, rmSync } from 'node:fs';

const from = new URL('../node_modules/phonon-tts/', import.meta.url);
const to = new URL('../public/phonon/', import.meta.url);

if (!existsSync(from)) {
  console.warn('phonon-tts not installed; skipping copy');
  process.exit(0);
}
rmSync(to, { recursive: true, force: true });
cpSync(from, to, {
  recursive: true,
  // keep LICENSE-* and THIRD_PARTY_LICENSES.md: the notices ship with the code
  filter: (src) => !src.endsWith('.d.ts') && !src.endsWith('README.md') && !src.endsWith('package.json'),
});
console.log('Copied phonon-tts to public/phonon');
