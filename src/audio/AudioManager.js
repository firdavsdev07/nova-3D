/* ------------------------------------------------------------------
   Audio

   The soundtrack is synthesised in the browser rather than streamed:
   an ambient bed has no structure worth downloading a file for, and
   generating it means it never loops audibly and costs nothing to load.

   Four layers, all quiet:

     sub    — a detuned pair near 55 Hz, felt more than heard
     pad    — a suspended chord, each voice on its own slow swell
     keys   — sparse struck notes from a pentatonic set, heavily wet
     shell  — filtered noise, gated by how far apart the car is

   Nothing starts until the listener asks for it. The context itself is
   not constructed until then, so no autoplay policy is ever tripped.
   ------------------------------------------------------------------ */

const MASTER = 0.16; // Background level. The experience is the subject.
const FADE_IN = 4.5;
const FADE_OUT = 1.2;

/** Am(add9), voiced open. Calm without being sentimental. */
const PAD_VOICES = [110.0, 164.81, 246.94, 329.63];
const KEY_NOTES = [440.0, 523.25, 587.33, 659.25, 783.99];

function noiseBuffer(ctx, seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);

  // Cheap pink-ish noise — white noise is too bright to sit under music.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099;
    b1 = 0.963 * b1 + white * 0.2965;
    b2 = 0.57 * b2 + white * 1.0526;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
  }
  return buf;
}

function impulseResponse(ctx, seconds = 4, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.nodes = [];
    this._keyTimer = null;
    this._onVisibility = this._visibility.bind(this);
  }

  get available() {
    return typeof window !== 'undefined' && !!(window.AudioContext ?? window.webkitAudioContext);
  }

  /** Must be called from a user gesture. Builds the graph on first use. */
  async enable() {
    if (!this.available) return false;

    if (!this.ctx) {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      this.ctx = new Ctx();
      this._build();
      document.addEventListener('visibilitychange', this._onVisibility);
    }

    await this.ctx.resume();
    this.enabled = true;

    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    // Never arrive at level: the fade is the point.
    this.master.gain.linearRampToValueAtTime(MASTER, now + FADE_IN);

    this._scheduleKey(3);
    return true;
  }

  disable() {
    if (!this.ctx || !this.enabled) return;
    this.enabled = false;

    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);

    clearTimeout(this._keyTimer);
    // Suspend only after the fade has actually finished.
    this._suspendTimer = setTimeout(() => {
      if (!this.enabled) this.ctx?.suspend();
    }, FADE_OUT * 1000 + 100);
  }

  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    }
    return this.enable();
  }

  _build() {
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    // A gentle ceiling so a scheduled note can never stack into a peak.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.008;
    limiter.release.value = 0.3;
    limiter.connect(this.master);
    this.bus = limiter;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.9;
    reverb.connect(reverbGain).connect(this.bus);
    this.reverb = reverb;

    this._buildSub();
    this._buildPad();
    this._buildShell();
  }

  /** Deep, slow, and barely present — the floor of the mix. */
  _buildSub() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    filter.connect(gain).connect(this.bus);

    for (const freq of [55, 55.13]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
      this.nodes.push(osc);
    }
  }

  /** The chord. Each voice swells on its own cycle so it never pulses. */
  _buildPad() {
    const ctx = this.ctx;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 820;
    tone.Q.value = 0.6;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.085;
    tone.connect(padGain);
    padGain.connect(this.bus);
    padGain.connect(this.reverb);

    // Very slow filter movement — the difference between "ambient" and
    // "a chord being held".
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.021;
    const sweepAmount = ctx.createGain();
    sweepAmount.gain.value = 380;
    sweep.connect(sweepAmount).connect(tone.frequency);
    sweep.start();
    this.nodes.push(sweep);

    PAD_VOICES.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      // A few cents apart so the voices never phase-lock.
      osc.detune.value = (i - 1.5) * 4;

      const voice = ctx.createGain();
      voice.gain.value = 0.25 / (i + 1);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.043 + i * 0.017;
      const depth = ctx.createGain();
      depth.gain.value = voice.gain.value * 0.6;
      lfo.connect(depth).connect(voice.gain);
      lfo.start();

      osc.connect(voice).connect(tone);
      osc.start();
      this.nodes.push(osc, lfo);
    });
  }

  /** Mechanical air, gated by the exploded state of the vehicle. */
  _buildShell() {
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 320;
    band.Q.value = 0.8;

    this.shellGain = ctx.createGain();
    this.shellGain.gain.value = 0;

    src.connect(band).connect(this.shellGain);
    this.shellGain.connect(this.bus);
    this.shellGain.connect(this.reverb);
    src.start();
    this.nodes.push(src);
  }

  /** A struck note, sparse and wet. Sine stack, no sample needed. */
  _key(when) {
    const ctx = this.ctx;
    const root = KEY_NOTES[Math.floor(Math.random() * KEY_NOTES.length)];

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bus);
    out.connect(this.reverb);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    tone.connect(out);

    const peak = 0.09 + Math.random() * 0.05;
    const length = 5 + Math.random() * 3;

    // Partials fall off fast, which is what separates a struck string
    // from a held organ note.
    [1, 2, 3].forEach((partial, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = root * partial;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak / (i * 2.4 + 1), when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + length / (i + 1));

      osc.connect(g).connect(tone);
      osc.start(when);
      osc.stop(when + length + 0.2);
    });

    out.gain.setValueAtTime(1, when);
  }

  _scheduleKey(delay) {
    clearTimeout(this._keyTimer);
    this._keyTimer = setTimeout(() => {
      if (!this.enabled || !this.ctx) return;
      this._key(this.ctx.currentTime + 0.05);
      this._scheduleKey(7 + Math.random() * 9);
    }, delay * 1000);
  }

  /** 0 → 1, how far apart the vehicle currently is. */
  setDisassembly(amount) {
    if (!this.ctx || !this.enabled) return;
    const target = Math.min(Math.max(amount, 0), 1) * 0.055;
    this.shellGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  /** A single soft tick for a deliberate interaction. Nothing else. */
  tick() {
    if (!this.ctx || !this.enabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.06);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.035, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(g).connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  _visibility() {
    if (!this.ctx) return;
    if (document.hidden) this.ctx.suspend();
    else if (this.enabled) this.ctx.resume();
  }

  dispose() {
    clearTimeout(this._keyTimer);
    clearTimeout(this._suspendTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);

    for (const node of this.nodes) {
      try {
        node.stop?.();
      } catch {
        /* already stopped */
      }
      node.disconnect?.();
    }
    this.nodes.length = 0;
    this.ctx?.close();
    this.ctx = null;
    this.enabled = false;
  }
}
