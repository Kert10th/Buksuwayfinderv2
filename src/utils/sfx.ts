// Professional UI sound effects for the BukSU Wayfinder kiosk.
//
// Tuned for a public-institutional setting (students, visitors, guests),
// so every sound is deliberately understated: short, calm sine-based
// tones with layered harmonics for warmth and a very gentle reverb tail.
// No frequency sweeps, no noise bursts, no synth-y sawtooths — just
// clean musical intervals like a high-end banking app or museum kiosk.
//
// Audio contexts must be created/resumed after a user gesture in modern
// browsers, so we lazily create the context on first play and call
// `.resume()` each call to reliably unblock audio after the first tap.

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterFilter: BiquadFilterNode | null = null;
let reverbDelay: DelayNode | null = null;
let reverbFeedback: GainNode | null = null;
let reverbWet: GainNode | null = null;
let muted = false;

export function getSfxContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContext = new Ctor();

      // Master chain: gentle low-pass for warmth → master gain → out.
      masterFilter = audioContext.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 8500;
      masterFilter.Q.value = 0.4;

      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.85;

      masterFilter.connect(masterGain);
      masterGain.connect(audioContext.destination);

      // Subtle "room" reverb via a short feedback delay. Low wet level
      // so sounds feel like they're in a small calm space, not a hall.
      reverbDelay = audioContext.createDelay(0.4);
      reverbDelay.delayTime.value = 0.07;
      reverbFeedback = audioContext.createGain();
      reverbFeedback.gain.value = 0.22;
      reverbWet = audioContext.createGain();
      reverbWet.gain.value = 0.18;

      reverbWet.connect(reverbDelay);
      reverbDelay.connect(reverbFeedback);
      reverbFeedback.connect(reverbDelay);
      reverbDelay.connect(masterFilter);
    } catch {
      return null;
    }
  }
  return audioContext;
}

function getDryDestination(): AudioNode | null {
  getSfxContext();
  return masterFilter;
}
function getWetDestination(): AudioNode | null {
  getSfxContext();
  return reverbWet;
}

export function setSfxMuted(value: boolean) {
  muted = value;
}
export function isSfxMuted() {
  return muted;
}

interface Partial {
  freq: number;
  type?: OscillatorType;
  volume: number;
  attack?: number;
  decay?: number;
  startOffset?: number;
  reverbAmount?: number;
}

function play(partials: Partial[]) {
  if (muted) return;
  const ctx = getSfxContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const dry = getDryDestination();
  if (!dry) return;
  const wet = getWetDestination();

  const now = ctx.currentTime;

  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p.type ?? 'sine';
    osc.frequency.value = p.freq;
    osc.connect(gain);
    gain.connect(dry);

    if (p.reverbAmount && p.reverbAmount > 0 && wet) {
      const send = ctx.createGain();
      send.gain.value = p.reverbAmount;
      gain.connect(send);
      send.connect(wet);
    }

    const start = now + (p.startOffset ?? 0);
    const attack = p.attack ?? 0.005;
    const decay = p.decay ?? 0.18;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(p.volume, 0.0001), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    osc.start(start);
    osc.stop(start + decay + 0.04);
  });
}

// ─── Professional sounds ──────────────────────────────────────────────────

// Soft tap — the kind of click you'd hear in iOS or Material 3.
export function playClick() {
  play([
    { freq: 1320, type: 'sine', volume: 0.09, attack: 0.002, decay: 0.06, reverbAmount: 0.20 },
    { freq: 1980, type: 'sine', volume: 0.04, attack: 0.002, decay: 0.05, reverbAmount: 0.20 },
  ]);
}

// Bell-like select — warm fundamental + perfect 5th + octave (sine bell).
export function playPop() {
  play([
    { freq: 587.33, type: 'sine', volume: 0.11, attack: 0.003, decay: 0.32, reverbAmount: 0.30 }, // D5
    { freq: 880.00, type: 'sine', volume: 0.06, attack: 0.003, decay: 0.28, reverbAmount: 0.28 }, // A5
    { freq: 1174.66, type: 'sine', volume: 0.03, attack: 0.003, decay: 0.22, reverbAmount: 0.25 },// D6
  ]);
}

// Soft confirm tone — used when opening / activating a panel.
export function playToggle() {
  play([
    { freq: 660, type: 'sine', volume: 0.10, attack: 0.008, decay: 0.16, reverbAmount: 0.25 },
    { freq: 990, type: 'sine', volume: 0.05, attack: 0.008, decay: 0.14, reverbAmount: 0.22 },
  ]);
}

// Mirror tone — for closing / dismissing.
export function playToggleClose() {
  play([
    { freq: 523, type: 'sine', volume: 0.09, attack: 0.008, decay: 0.16, reverbAmount: 0.25 },
    { freq: 784, type: 'sine', volume: 0.04, attack: 0.008, decay: 0.14, reverbAmount: 0.22 },
  ]);
}

// Confirmation chime — a calm, three-note ascending arpeggio in C major,
// each note doubled at the octave for fullness. The kind of "your route
// is ready" tone you'd hear in a hotel or airline app.
export function playSuccess() {
  play([
    { freq: 523.25, type: 'sine', volume: 0.12, attack: 0.005, decay: 0.34, startOffset: 0,    reverbAmount: 0.35 }, // C5
    { freq: 1046.5, type: 'sine', volume: 0.04, attack: 0.005, decay: 0.30, startOffset: 0,    reverbAmount: 0.32 }, // C6

    { freq: 659.25, type: 'sine', volume: 0.12, attack: 0.005, decay: 0.34, startOffset: 0.10, reverbAmount: 0.35 }, // E5
    { freq: 1318.5, type: 'sine', volume: 0.04, attack: 0.005, decay: 0.30, startOffset: 0.10, reverbAmount: 0.32 }, // E6

    { freq: 783.99, type: 'sine', volume: 0.14, attack: 0.005, decay: 0.55, startOffset: 0.20, reverbAmount: 0.40 }, // G5
    { freq: 1567.98, type: 'sine', volume: 0.05, attack: 0.005, decay: 0.45, startOffset: 0.20, reverbAmount: 0.36 },// G6
  ]);
}

// Light selection pluck — root + octave, warm.
export function playSelect() {
  play([
    { freq: 698.46, type: 'sine', volume: 0.11, attack: 0.005, decay: 0.22, reverbAmount: 0.28 }, // F5
    { freq: 1396.91, type: 'sine', volume: 0.05, attack: 0.005, decay: 0.18, reverbAmount: 0.25 },// F6
  ]);
}

// Soft, never harsh — descending minor 3rd, like a polite "not allowed".
export function playError() {
  play([
    { freq: 523.25, type: 'sine', volume: 0.10, attack: 0.005, decay: 0.22, startOffset: 0,    reverbAmount: 0.30 }, // C5
    { freq: 440.00, type: 'sine', volume: 0.10, attack: 0.005, decay: 0.30, startOffset: 0.12, reverbAmount: 0.30 }, // A4
  ]);
}

// Subtle tick (available for idle countdown).
export function playTick() {
  play([
    { freq: 1500, type: 'sine', volume: 0.06, attack: 0.001, decay: 0.04, reverbAmount: 0.10 },
  ]);
}
