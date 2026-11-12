// Captures real Autosweep portal replies as test fixtures, with personal data redacted.
// Usage (PowerShell):  $env:ASW_EMAIL="you@x.com"; $env:ASW_PASSWORD="..."; npm run capture:autosweep
// Logs in ONCE and stops on failure: the portal locks accounts after repeated bad logins.
import { mkdirSync, writeFileSync } from 'node:fs';

const API = 'https://autosweeprfidapps.com/api/v3/portalnew/index.php';
const { ASW_EMAIL: email, ASW_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error('Set ASW_EMAIL and ASW_PASSWORD environment variables first.');
  process.exit(1);
}

let cookie = '';
async function post(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await fetch(API, { method: 'POST', body, headers: cookie ? { cookie } : {} });
  const set = res.headers.getSetCookie();
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  console.log(`${fields.tag}: HTTP ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return { nonJson: text.slice(0, 300) };
  }
}

// Keep only fields the parser needs as-is; everything else that looks personal is redacted.
const KEEP = /^(success|msg|active|account_status|available_balance|balance|total_accounts|last_reload_main|nonJson)$/;
const PERSONAL = /email|name|plate|account|mobile|phone|contact|address|birth|alias|token|^id$|_id$/i;
const redact = (v, key = '') =>
  Array.isArray(v) ? v.map((x) => redact(x))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x, k)]))
  : !KEEP.test(key) && PERSONAL.test(key) && v != null && v !== '' ? 'REDACTED'
  : v;

const outDir = new URL('../src/providers/autosweep/fixtures/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const save = (name, json) => {
  writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(redact(json), null, 2) + '\n');
  console.log(`  saved fixtures/${name}.json`);
};

const login = await post({ tag: 'login', email, password, remember_me: 'false' });
save('login', login);
if (login?.success !== 1) {
  console.error('Login failed; not retrying (account-lock risk). Check the credentials on the portal website.');
  process.exit(1);
}
save('checkbalance', await post({ tag: 'checkbalance', account_number: String(login.data.account_number) }));
save('getsubaccounts', await post({ tag: 'getsubaccounts', page: '1', limit: '10' }));
console.log('Done. Review the files for anything personal before committing them.');
