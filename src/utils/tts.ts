// Lightweight text-to-speech for the kiosk wayfinder.
//
// Uses the browser's built-in Web Speech API (`window.speechSynthesis`)
// — free, offline, no per-use cost. Voice quality depends on the OS's
// bundled voices. We can swap to a cloud TTS provider later by
// reimplementing `speak` without changing call sites.
//
// Behavior:
//   • Cancels any in-progress utterance when a new one starts, so fast
//     taps never stack overlapping announcements.
//   • Mute state is persisted to localStorage so staff can silence the
//     kiosk during quiet hours and the choice survives reloads.
//   • Picks the best available English voice once and caches it.

const STORAGE_KEY = 'buksu-tts-muted';

let muted: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
})();

const mutedListeners = new Set<(value: boolean) => void>();

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isTtsMuted(): boolean {
  return muted;
}

export function setTtsMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (value && isTtsSupported()) {
    window.speechSynthesis.cancel();
  }
  mutedListeners.forEach((fn) => fn(value));
}

export function subscribeMuted(fn: (value: boolean) => void): () => void {
  mutedListeners.add(fn);
  return () => mutedListeners.delete(fn);
}

let cachedVoice: SpeechSynthesisVoice | null = null;

/**
 * Find the best "JARVIS-like" voice we can. Order of preference:
 *   1. A British male voice (Daniel, George, Oliver, James, Arthur)
 *   2. Any en-GB voice
 *   3. A male en-US voice (David, Mark, Alex)
 *   4. Any English voice
 *   5. The first voice the system offers
 *
 * Voice quality varies by OS — Windows usually ships "Microsoft George"
 * (UK male) and "Microsoft David" (US male). macOS ships "Daniel" (UK
 * male) and "Alex" (US male). On Android Chrome you usually get
 * "Google UK English Male" which sounds great. We just take whichever
 * shows up first by priority.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const britishMaleNames = /\b(daniel|george|oliver|james|arthur|ryan|harry)\b/i;
  const americanMaleNames = /\b(david|mark|alex|aaron|fred|gordon|guy)\b/i;
  const explicitMale = /\bmale\b/i;
  const explicitFemale = /\b(female|woman|samantha|zira|moira|tessa|kate|fiona|veena|susan|hazel)\b/i;

  const enGb = voices.filter((v) => v.lang.toLowerCase().startsWith('en-gb'));
  const enUs = voices.filter((v) => v.lang.toLowerCase().startsWith('en-us'));
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));

  const preferred =
    enGb.find((v) => britishMaleNames.test(v.name)) ||
    enGb.find((v) => explicitMale.test(v.name)) ||
    enGb.find((v) => !explicitFemale.test(v.name)) ||
    enGb[0] ||
    enUs.find((v) => americanMaleNames.test(v.name)) ||
    enUs.find((v) => explicitMale.test(v.name)) ||
    enUs.find((v) => !explicitFemale.test(v.name)) ||
    en[0] ||
    voices[0];

  cachedVoice = preferred ?? null;
  return cachedVoice;
}

interface SpeakOptions {
  rate?: number; // 0.1–10, default 0.95 (slightly slower for JARVIS calmness)
  pitch?: number; // 0–2, default 0.9 (slightly lower for refined male tone)
  volume?: number; // 0–1
}

export function speak(text: string, options: SpeakOptions = {}) {
  if (!isTtsSupported() || muted) return;

  // Cancel any in-progress utterance so rapid taps don't stack.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  // Default: confident, measured delivery — JARVIS doesn't rush.
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 0.9;
  utterance.volume = options.volume ?? 0.92;

  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-GB'; // bias toward British accent even on fallback
  }

  // Chrome quirk: speak() right after cancel() can drop the utterance.
  // A small delay sidesteps it without being noticeable to users.
  window.setTimeout(() => {
    if (!muted) window.speechSynthesis.speak(utterance);
  }, 60);
}

export function stopSpeaking() {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

// Voices load asynchronously on some browsers — invalidate the cache
// when the list changes so the first available voice gets picked up.
if (typeof window !== 'undefined' && isTtsSupported()) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = null;
  });
}

// ─── Higher-level helpers ──────────────────────────────────────────────────

/**
 * Announce a found route with optional floor info, in a JARVIS-style
 * confident voice. Matches the on-screen "Navigating to ..." pill.
 *   "Navigating to Library."
 *   "Navigating to Data Center, located on the 2nd floor."
 */
export function announceRouteFound(toLocation: string, floor?: string | null) {
  const target = toLocation.replace(/\b's\b/g, "'s").trim();
  let phrase = `Navigating to ${target}.`;
  if (floor) {
    phrase = `Navigating to ${target}, located on the ${floor.trim()}.`;
  }
  speak(phrase);
}
