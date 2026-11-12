import { kvGet, kvSet } from '@/lib/kv';
import type { SpeakHooks, VoiceChoice, VoiceStatus } from './speak';

// Web preview voices, both open models that run on this computer (no server, no API key):
//  - Phonon 31m (phonon-tts, Apache-2.0): ~65 MB, streams 80 ms chunks, so speech starts almost at once.
//    Served from our own origin (public/phonon, see scripts/copy-phonon.mjs) because its Web Worker must be same-origin.
//  - Kokoro-82M (kokoro-js, Apache-2.0): ~90 MB, makes the whole line before playing.
// Whichever is picked goes first, the other is the fallback, then the browser's own voice.
const PHONON_ESM = '/phonon/index.js';
const KOKORO_ESM = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_VOICE = 'af_heart';
const PREBUFFER_CHUNKS = 2; // 160 ms cushion so a slow chunk doesn't stutter the start
const MAX_MS = 30_000;

export const voiceChoices: VoiceChoice[] = [
  // Measured in this preview: Phonon warm start 0.44 s (runs in a worker). Kokoro ~30+ s per visit and it
  // runs on the page's main thread, freezing the UI while it works; it suits phones (native) better.
  { id: 'phonon', label: 'Phonon', detail: 'Starts talking almost instantly' },
  { id: 'kokoro', label: 'Kokoro', detail: 'Very natural, but slow in a browser' },
];

type Engine = 'phonon' | 'kokoro';
let choice: Engine = 'phonon';
void kvGet('voice.engine').then((v) => {
  if (v === 'kokoro') choice = 'kokoro';
});
export const getVoiceChoice = async () => choice;
export async function setVoiceChoice(id: string) {
  choice = id === 'kokoro' ? 'kokoro' : 'phonon';
  await kvSet('voice.engine', choice);
}

// Loaded by the browser at runtime instead of bundled by Metro.
const importAtRuntime = new Function('url', 'return import(url)') as (url: string) => Promise<any>;

let status: VoiceStatus = { state: 'idle', progress: 0 };
const listeners = new Set<(s: VoiceStatus) => void>();
function setStatus(s: VoiceStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function onVoiceStatus(fn: (s: VoiceStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

function progressTracker() {
  const files = new Map<string, { loaded: number; total: number }>();
  return (file: string | undefined, loaded = 0, total = 0) => {
    if (!file || !total) return;
    files.set(file, { loaded, total });
    let l = 0;
    let t = 0;
    files.forEach((f) => ((l += f.loaded), (t += f.total)));
    setStatus({ state: 'loading', progress: l / t });
  };
}

let phonon: Promise<any> | null = null;
function loadPhonon(): Promise<any> {
  phonon ??= (async () => {
    setStatus({ state: 'loading', progress: 0 });
    const { PhononTTS } = await importAtRuntime(PHONON_ESM);
    const track = progressTracker();
    const tts = await PhononTTS.load({
      lang: 'en',
      quant: 'q8',
      onProgress: (p: { file?: string; loaded?: number; total?: number; cached?: boolean }) =>
        track(p.file, p.loaded, p.total),
    });
    setStatus({ state: 'ready', progress: 1 });
    return tts;
  })().catch((e) => {
    phonon = null; // allow a retry on the next tap
    setStatus({ state: 'failed', progress: 0 });
    throw e;
  });
  return phonon;
}

let kokoro: Promise<any> | null = null;
function loadKokoro(): Promise<any> {
  kokoro ??= (async () => {
    setStatus({ state: 'loading', progress: 0 });
    const { KokoroTTS } = await importAtRuntime(KOKORO_ESM);
    const track = progressTracker();
    const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) =>
        p.status === 'progress' && track(p.file, p.loaded, p.total),
    });
    setStatus({ state: 'ready', progress: 1 });
    return tts;
  })().catch((e) => {
    kokoro = null;
    setStatus({ state: 'failed', progress: 0 });
    throw e;
  });
  return kokoro;
}

let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;
let generation = 0; // bumps on stop, so audio that arrives after "stop" stays silent

/** Load the picked voice ahead of time so the first "Tolly!" isn't spent downloading. */
export async function prewarm(_text: string): Promise<void> {
  await (choice === 'kokoro' ? loadKokoro() : loadPhonon()).catch(() => {});
}

export async function speak(text: string, hooks: SpeakHooks = {}): Promise<void> {
  const mine = ++generation;
  // Create/resume audio inside the tap's user gesture; loading can outlast that window.
  ctx ??= new AudioContext();
  void ctx.resume();

  const order = choice === 'kokoro' ? [speakKokoro, speakPhonon] : [speakPhonon, speakKokoro];
  for (const engine of order) {
    let started = false;
    try {
      await engine(text, { onStart: () => ((started = true), hooks.onStart?.()) }, mine);
      return;
    } catch (e) {
      // Stopped, or already talking: never restart the announcement in another voice.
      if (mine !== generation || started) return;
      console.warn('Voice unavailable, trying the next one:', e);
    }
  }
  if (mine === generation) await browserSpeak(text, hooks);
}

/** Streams Phonon's 80 ms chunks straight into the speaker: the first words play while the rest is made. */
async function speakPhonon(text: string, hooks: SpeakHooks, mine: number): Promise<void> {
  const tts = await loadPhonon();
  if (mine !== generation) return;
  const audio = ctx!;
  const controller = new AbortController();
  const sources: AudioBufferSourceNode[] = [];
  let endAt = 0;
  let wake: (() => void) | null = null;
  stopCurrent = () => {
    controller.abort();
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already ended
      }
    });
    wake?.();
  };

  const schedule = (buffer: AudioBuffer) => {
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.destination);
    const at = Math.max(endAt, audio.currentTime + 0.03);
    src.start(at);
    endAt = at + buffer.duration;
    sources.push(src);
  };

  const pending: AudioBuffer[] = [];
  let started = false;
  const begin = () => {
    pending.splice(0).forEach(schedule);
    started = true;
    hooks.onStart?.();
  };

  const speech = tts.stream(text, { signal: controller.signal });
  for await (const pcm of speech as AsyncIterable<Float32Array>) {
    if (mine !== generation) return;
    const buffer = audio.createBuffer(1, pcm.length, tts.sampleRate);
    buffer.getChannelData(0).set(pcm);
    if (started) schedule(buffer);
    else if (pending.push(buffer) >= PREBUFFER_CHUNKS) begin();
  }
  if (!started && pending.length) begin();
  if (__DEV__) void speech.done.then((s: unknown) => console.info('Phonon stats', s));

  const left = endAt - audio.currentTime;
  if (left > 0 && mine === generation) {
    await new Promise<void>((resolve) => {
      const id = setTimeout(resolve, left * 1000 + 30);
      wake = () => {
        clearTimeout(id);
        resolve();
      };
    });
  }
  stopCurrent = null;
}

async function speakKokoro(text: string, hooks: SpeakHooks, mine: number): Promise<void> {
  const tts = await loadKokoro();
  const { audio, sampling_rate } = await tts.generate(text, { voice: KOKORO_VOICE });
  if (mine !== generation) return;
  const buffer = ctx!.createBuffer(1, audio.length, sampling_rate);
  buffer.getChannelData(0).set(audio);
  await new Promise<void>((resolve) => {
    const src = ctx!.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx!.destination);
    src.onended = () => {
      stopCurrent = null;
      resolve();
    };
    stopCurrent = () => src.stop();
    src.start();
    hooks.onStart?.();
  });
}

function browserSpeak(text: string, hooks: SpeakHooks): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    const timer = setTimeout(resolve, MAX_MS); // some browsers never fire onend without a voice
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => hooks.onStart?.();
    u.onend = done;
    u.onerror = done;
    stopCurrent = () => speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

export async function stopSpeaking(): Promise<void> {
  generation++;
  stopCurrent?.();
  stopCurrent = null;
}
