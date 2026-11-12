import type { Reading } from '@/features/voice/announcement';
import {
  blockAutosweepAuth,
  getAutosweepCreds,
  getCached,
  getEasytripAccount,
  isAutosweepAuthBlocked,
  setCached,
} from '@/lib/storage';
import { fetchAutosweepBalance } from '@/providers/autosweep/client';
import { AutosweepError } from '@/providers/autosweep/parser';

async function cached(label: string, id: 'autosweep' | 'easytrip'): Promise<Reading> {
  const c = await getCached(id);
  return c ? { label, ...c, live: false } : { label, amount: null };
}

async function autosweep(): Promise<Reading | null> {
  const creds = await getAutosweepCreds();
  if (!creds) return null;
  const label = 'Autosweep';
  if (!(await isAutosweepAuthBlocked())) {
    try {
      const amount = await fetchAutosweepBalance(creds);
      const asOf = Date.now();
      await setCached('autosweep', { amount, asOf });
      return { label, amount, asOf, live: true };
    } catch (e) {
      if (e instanceof AutosweepError && (e.kind === 'bad-login' || e.kind === 'locked')) await blockAutosweepAuth();
      console.warn('Autosweep refresh failed:', e instanceof Error ? e.message : e);
    }
  }
  // Provider down or login blocked: fall back to the last known balance, spoken with its age.
  return cached(label, 'autosweep');
}

/** Easytrip can't be fetched (reCAPTCHA); we only have what the user last typed in. */
async function easytrip(): Promise<Reading | null> {
  return (await getEasytripAccount()) ? cached('Easytrip', 'easytrip') : null;
}

/** Saved balances only, no network: lets the screen paint instantly before the live refresh lands. */
export async function cachedReadings(): Promise<Reading[]> {
  const [creds, et] = await Promise.all([getAutosweepCreds(), getEasytripAccount()]);
  return Promise.all([
    ...(creds ? [cached('Autosweep', 'autosweep')] : []),
    ...(et ? [cached('Easytrip', 'easytrip')] : []),
  ]);
}

/** Readings for every set-up provider. Never throws: a failure becomes a cached or "unavailable" reading. */
export async function refreshAll(): Promise<Reading[]> {
  const readings = await Promise.all([autosweep(), easytrip()]);
  return readings.filter((r): r is Reading => r !== null);
}
