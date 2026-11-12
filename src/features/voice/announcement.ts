/** One provider's balance as the voice should read it. amount null = no balance known at all. */
export type Reading =
  | { label: string; amount: number; asOf: number; live: boolean }
  | { label: string; amount: null };

// ponytail: fixed threshold; the plan replaces this with a days-left prediction from toll history.
export const LOW_BALANCE = 200;

/** "340 pesos", "1 peso", "340 pesos and 50 centavos", "minus 20 pesos". Words, so TTS never reads "point five zero". */
export function pesos(amount: number): string {
  const totalCents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  let s = `${amount < 0 ? 'minus ' : ''}${whole} ${whole === 1 ? 'peso' : 'pesos'}`;
  if (cents) s += ` and ${cents} ${cents === 1 ? 'centavo' : 'centavos'}`;
  return s;
}

/** "5 minutes ago", "2 hours ago", "1 day ago"; null when under a minute (no need to say it). */
export function ago(ms: number): string | null {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return null;
  const say = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (min < 60) return say(min, 'minute');
  const hours = Math.floor(min / 60);
  return hours < 24 ? say(hours, 'hour') : say(Math.floor(hours / 24), 'day');
}

export function buildAnnouncement(readings: Reading[], now = Date.now()): string {
  if (readings.length === 0) return 'No toll accounts set up yet.';
  return readings
    .map((r) => {
      if (r.amount === null) return `${r.label} balance unavailable.`;
      const age = r.live ? null : ago(now - r.asOf);
      let s = `${r.label}: ${pesos(r.amount)}${age ? `, as of ${age}` : ''}.`;
      if (r.amount < LOW_BALANCE) s += ' Low, reload soon.';
      return s;
    })
    .join(' ');
}
