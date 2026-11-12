// Captures what the myEasytrip (CAMS) customer portal shows after login, so the Easytrip adapter can be
// built from real data. Personal details are removed before anything is written.
//
// Usage (PowerShell):  $env:ET_USER="your-username"; $env:ET_PASSWORD="..."; npm run capture:easytrip
//
// Logs in ONCE and stops on failure (no retries: repeated bad logins can lock the account).
// Stops if Cloudflare challenges the request: we don't try to get around bot checks.
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://myeasytripcams.easytrip.ph';
const LOGIN = `${BASE}/CAMS/?ReturnUrl=%2FCAMS%2FCustomer%2FIndex`;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const { ET_USER: user, ET_PASSWORD: password } = process.env;
if (!user || !password) {
  console.error('Set ET_USER and ET_PASSWORD environment variables first.');
  process.exit(1);
}

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function keepCookies(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
  }
}

/** Fetch that keeps cookies across redirects (fetch's own redirect handling drops Set-Cookie). */
async function go(url, init = {}) {
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual', headers: { 'User-Agent': UA, cookie: cookieHeader(), ...init.headers } });
    keepCookies(res);
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).href;
      init = {}; // redirects after a POST continue as GET
      continue;
    }
    const body = await res.text();
    console.log(`${init.method ?? 'GET'} ${new URL(url).pathname} -> ${res.status}`);
    if (res.status === 403 || res.status === 503 || /cf-chl|Just a moment|challenge-platform/i.test(body)) {
      console.error('Cloudflare is challenging this request. Stopping (not bypassing bot checks).');
      process.exit(2);
    }
    return { url, body };
  }
  throw new Error('Too many redirects');
}

// 1. Login page: the ASP.NET form token is ordinary CSRF protection that every browser gets the same way.
const page = await go(`${BASE}/CAMS`);
const token = /name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(page.body)?.[1];
if (!token) {
  console.error('Login form token not found; the page may have changed.');
  process.exit(1);
}

// 2. Log in once.
const after = await go(LOGIN, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ UserName: user, Password: password, __RequestVerificationToken: token }).toString(),
});
if (/name="Password"/.test(after.body)) {
  console.error('Still on the login page: wrong username/password, or the portal wants something else. Not retrying.');
  process.exit(1);
}

// 3. Redact and save what a logged-in customer sees.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shape = (s) => s.replace(/[0-9]/g, '9'); // ₱1,234.56 -> ₱9,999.99: keeps the format, drops the value
function redact(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '<script>…</script>')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/value="[^"]*"/gi, 'value="…"')
    .replace(new RegExp(esc(user), 'gi'), '[USERNAME]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]')
    .replace(/>([^<]+)</g, (_, text) => {
      let t = shape(text);
      // Two to four ALL-CAPS words is usually a person's name or an address line.
      if (/^\s*[A-ZÑ][A-ZÑ.'-]+(\s+[A-ZÑ][A-ZÑ.'-]+){1,3}\s*$/.test(t) && !/BALANCE|ACCOUNT|STATUS|TOTAL|PREPAID|POSTPAID/.test(t)) t = '[NAME?]';
      return `>${t}<`;
    });
}
const endpoints = [...new Set(after.body.match(/["'](\/CAMS\/[A-Za-z0-9/_-]+)["']/g) ?? [])].map((s) => s.slice(1, -1)).sort();

const out = new URL('../src/providers/easytrip/fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('dashboard.redacted.html', out), redact(after.body));
writeFileSync(new URL('endpoints.txt', out), `${endpoints.join('\n')}\n`);
console.log(`Landed on ${new URL(after.url).pathname}. Saved fixtures/dashboard.redacted.html and endpoints.txt.`);
console.log('Open them and check nothing personal is left before sharing.');
