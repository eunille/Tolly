import type { AutosweepCreds } from '@/providers/autosweep/client';
import { kvDelete, kvGet, kvSet } from './kv';

export type ProviderId = 'autosweep' | 'easytrip';
/** Last known balance; asOf is epoch ms. */
export type CachedBalance = { amount: number; asOf: number };

// Key names and JSON shapes are shared with app-intents/TollAnnouncer.swift (iOS). Rename both together.

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export const getAutosweepCreds = () => getJson<AutosweepCreds>('autosweep.creds');
export async function setAutosweepCreds(creds: AutosweepCreds) {
  await kvSet('autosweep.creds', JSON.stringify(creds));
  await kvDelete('autosweep.authBlocked'); // new creds: allow login attempts again
}

export const getEasytripAccount = () => kvGet('easytrip.account');
export const setEasytripAccount = (n: string) => kvSet('easytrip.account', n);

export const getCached = (p: ProviderId) => getJson<CachedBalance>(`balance.${p}`);
export const setCached = (p: ProviderId, c: CachedBalance) => kvSet(`balance.${p}`, JSON.stringify(c));
/** A balance the user read off the provider's page/SMS just now. */
export const setSeenBalance = (p: ProviderId, amount: number) => setCached(p, { amount, asOf: Date.now() });

/** Hands-free listening for "Tolly" stays on across launches (phones only; browsers need a tap each visit). */
export const isHandsFreeOn = async () => (await kvGet('handsfree')) === '1';
export const setHandsFreeOn = (on: boolean) => kvSet('handsfree', on ? '1' : '0');

/** First-run setup flow finished or skipped. */
export const isSetupDone = async () => (await kvGet('setup.done')) === '1';
export const markSetupDone = () => kvSet('setup.done', '1');

/** Set after a rejected login so background refreshes stop hitting the portal (it locks accounts). */
export const isAutosweepAuthBlocked = async () => (await kvGet('autosweep.authBlocked')) === '1';
export const blockAutosweepAuth = () => kvSet('autosweep.authBlocked', '1');
