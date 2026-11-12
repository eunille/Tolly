// What Tolly listens for. Speech recognisers rarely spell a made-up name the same way twice,
// so the wake word matches the common mishearings too.
export type Command = 'balances' | 'stop' | 'settings';

const WAKE = /\b(?:hey\s+|hi\s+|ok(?:ay)?\s+)?(tolly|tolley|tollie|tolli|toli|toly|tali|tally|tawly|dolly|polly|holly|trolley)\b/i;

// Order matters: "stop" wins over everything, so "no, stop" never reads balances.
const COMMANDS: [Command, RegExp][] = [
  ['stop', /\b(stop|quiet|cancel|never ?mind|shut up|enough|pause|no)\b/i],
  ['settings', /\b(settings?|set ?up|accounts?|options)\b/i],
  ['balances', /\b(balances?|how much|check|load|money|tolls?|yes|yeah|yep|yup|sure|ok(ay)?|go|please|read|tell me|oo|sige)\b/i],
];

/** Did they say Tolly? `rest` is whatever came after it, e.g. "check my balance". */
export function hearWake(text: string): { wake: boolean; rest: string } {
  const m = WAKE.exec(text);
  return m ? { wake: true, rest: text.slice(m.index + m[0].length) } : { wake: false, rest: '' };
}

export function parseCommand(text: string): Command | null {
  for (const [command, re] of COMMANDS) if (re.test(text)) return command;
  return null;
}
