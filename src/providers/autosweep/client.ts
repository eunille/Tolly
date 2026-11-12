import { AutosweepError, parseBalance, parseLogin } from './parser';

const API = 'https://autosweeprfidapps.com/api/v3/portalnew/index.php';
const TIMEOUT_MS = 10_000;

export type AutosweepCreds = { email: string; password: string };

async function post(fields: Record<string, string>): Promise<unknown> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    // credentials: 'include' keeps the PHP session cookie from login for the next call (native cookie jar).
    res = await fetch(API, { method: 'POST', credentials: 'include', body, signal: ctrl.signal });
  } catch {
    throw new AutosweepError('network', 'Could not reach Autosweep');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new AutosweepError('session-expired', 'Autosweep session expired');
  if (!res.ok) throw new AutosweepError('unexpected', `Autosweep HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new AutosweepError('unexpected', 'Autosweep sent a non-JSON reply');
  }
}

/**
 * Logs in, then reads the main account's balance.
 * Never retry on 'bad-login' / 'locked': the portal locks accounts after repeated failed logins.
 */
// ponytail: logs in on every refresh (2 requests); reuse the session cookie if Autosweep rate-limits us.
export async function fetchAutosweepBalance(creds: AutosweepCreds): Promise<number> {
  const { accountNumber } = parseLogin(
    await post({ tag: 'login', email: creds.email, password: creds.password, remember_me: 'false' }),
  );
  return parseBalance(await post({ tag: 'checkbalance', account_number: accountNumber }));
}
