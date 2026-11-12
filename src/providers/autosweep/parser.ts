// Response shapes come from the Autosweep customer portal's own JS bundle
// (autosweeprfidapps.com/customerportal, Nov 2026). Replace the guesses with
// captured fixtures via `npm run capture:autosweep`.

export type AutosweepErrorKind = 'bad-login' | 'locked' | 'session-expired' | 'network' | 'unexpected';

export class AutosweepError extends Error {
  kind: AutosweepErrorKind;
  constructor(kind: AutosweepErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export type AutosweepLogin = { accountNumber: string };

// Never echo response values into errors: they end up in logs/Sentry and may hold personal data.
const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v).join(',') : typeof v);

export function parseLogin(json: any): AutosweepLogin {
  if (json?.success === 1) {
    if (Number(json.data?.active) === 2) throw new AutosweepError('locked', 'Autosweep account is locked');
    const accountNumber = String(json.data?.account_number ?? '').trim();
    if (!accountNumber) throw new AutosweepError('unexpected', `Login reply had no account number (data keys: ${keysOf(json.data)})`);
    return { accountNumber };
  }
  if (json?.success === 0) {
    const status = Number(json.account_status);
    if (status === 2 || status === 3) throw new AutosweepError('locked', 'Autosweep account is locked');
    throw new AutosweepError('bad-login', 'Autosweep rejected the email or password');
  }
  throw new AutosweepError('unexpected', `Unrecognised login reply (keys: ${keysOf(json)})`);
}

/** The portal itself defaults a missing balance to 0. We throw instead: speaking "zero pesos" by mistake is worse than "unavailable". */
export function parseBalance(json: any): number {
  const raw = json?.data?.available_balance;
  const amount = typeof raw === 'string' ? Number(raw.replace(/[,\s₱]/g, '')) : Number(raw);
  if (raw == null || raw === '' || !Number.isFinite(amount)) {
    throw new AutosweepError('unexpected', `No balance in reply (data keys: ${keysOf(json?.data)})`);
  }
  return amount;
}
