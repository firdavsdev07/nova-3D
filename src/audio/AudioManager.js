/* ------------------------------------------------------------------
   Audio

   The soundtrack is synthesised in the browser rather than streamed:
   an ambient bed has no structure worth downloading a file for, and
   generating it means it never loops audibly and costs nothing to load.

   Five layers, over an Fmaj9 — warm rather than melancholy:

     bass   — a detuned pair at F2, the floor of the mix
     pad    — the chord, each voice swelling on its own slow cycle
     air    — high filtered noise, the sound of a large quiet room
     keys   — sparse struck notes from the chord tones, heavily wet
     shell  — low mechanical texture, gated by the exploded state

   Gain staging is deliberate and written down, because the whole bed
   sums through one limiter and it is easy to end up 40 dB too quiet:

     bass 0.30 + pad 0.18 + keys 0.16 + air 0.02 ≈ 0.66 peak
     → limiter (-14 dB, 4:1) → master 0.55 → ≈ -12 dBFS

   Which is a background level you can actually hear.
   ------------------------------------------------------------------ */

const MASTER = 0.55;
const FADE_IN = 5.5;
const FADE_OUT = 1.4;

/** Fmaj9, voiced open. Warm, unresolved, and not sentimental. */
const PAD_VOICES = [174.61, 261.63, 329.63, 392.0, 523.25];
const KEY_NOTES = [349.23, 392.0, 523.25, 587.33, 698.46];
const BASS = [87.31, 87.44];

function noiseBuffer(ctx, seconds = 4) {
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

function impulseResponse(ctx, seconds = 5.5, decay = 3) {
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
    /** Set once the listener mutes by hand — autostart never fights that. */
    this._optedOut = false;
    this._disarm = null;
    this._onVisibility = this._visibility.bind(this);
  }

  get available() {
    return typeof window !== 'undefined' && !!(window.AudioContext ?? window.webkitAudioContext);
  }

  /**
   * Start on load if the browser allows it, and otherwise on the first
   * thing the visitor does.
   *
   * Autoplay policy will not be argued with: a context created before
   * any gesture starts life suspended, and `resume()` resolves without
   * actually running. So the attempt is made immediately, the state is
   * checked rather than trusted, and a one-shot listener on every
   * plausible first interaction — including the scroll that drives the
   * whole film — picks it up otherwise. In practice the music arrives
   * as the visitor starts moving, with nothing to press.
   *
   * @param onChange called with the resulting on/off state
   */
  armAutostart(onChange) {
    if (!this.available || this._optedOut) return;

    const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

    const attempt = async () => {
      if (this._optedOut || this.enabled) return;
      const ok = await this.enable();
      if (ok && this.ctx?.state === 'running') {
        this.disarmAutostart();
        onChange?.(true);
      }
    };

    this.disarmAutostart();
    for (const type of EVENTS) {
      window.addEventListener(type, attempt, { passive: true });
    }
    this._disarm = () => {
      for (const type of EVENTS) window.removeEventListener(type, attempt);
      this._disarm = null;
    };

    attempt();
  }

  disarmAutostart() {
    this._disarm?.();
  }

  /** Builds the graph on first use. */
  async enable() {
    if (!this.available) return false;

    if (!this.ctx) {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      this.ctx = new Ctx();
      this._build();
      document.addEventListener('visibilitychange', this._onVisibility);
    }

    try {
      await this.ctx.resume();
    } catch {
      return false;
    }
    if (this.ctx.state !== 'running') return false;

    this.enabled = true;

    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    // Never arrive at level: the fade is the point.
    this.master.gain.linearRampToValueAtTime(MASTER, now + FADE_IN);

    this._scheduleKey(4);
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
      // A deliberate mute outranks autostart for the rest of the visit.
      this._optedOut = true;
      this.disarmAutostart();
      this.disable();
      return false;
    }
    this._optedOut = false;
    return this.enable();
  }

  _build() {
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    // A gentle ceiling so a scheduled note can never stack into a peak.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 10;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.35;
    limiter.connect(this.master);
    this.bus = limiter;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.85;
    reverb.connect(reverbGain).connect(this.bus);
    this.reverb = reverb;

    this._buildBass();
    this._buildPad();
    this._buildAir();
    this._buildShell();
  }

  /** Deep and slow. F2 rather than the octave below, so laptops get it. */
  _buildBass() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    filter.connect(gain).connect(this.bus);

    // A very slow swell, so the floor of the mix breathes with the pad.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.031;
    const depth = ctx.createGain();
    depth.gain.value = 0.09;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    this.nodes.push(lfo);

    for (const freq of BASS) {
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
    tone.frequency.value = 1100;
    tone.Q.value = 0.7;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.18;
    tone.connect(padGain);
    padGain.connect(this.bus);
    padGain.connect(this.reverb);

    // Very slow filter movement — the difference between "ambient" and
    // "a chord being held".
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.019;
    const sweepAmount = ctx.createGain();
    sweepAmount.gain.value = 460;
    sweep.connect(sweepAmount).connect(tone.frequency);
    sweep.start();
    this.nodes.push(sweep);

    PAD_VOICES.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      // A few cents apart so the voices never phase-lock.
      osc.detune.value = (i - 2) * 3.5;

      // Upper voices sit progressively further back in the chord.
      const level = 0.5 / (1 + i * 0.75);
      const voice = ctx.createGain();
      voice.gain.value = level;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.037 + i * 0.014;
      const depth = ctx.createGain();
      depth.gain.value = level * 0.55;
      lfo.connect(depth).connect(voice.gain);
      lfo.start();

      osc.connect(voice).connect(tone);
      osc.start();
      this.nodes.push(osc, lfo);
    });
  }

  /** Room tone. Almost inaudible alone; its absence sounds like a mute. */
  _buildAir() {
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;

    const gain = ctx.createGain();
    gain.gain.value = 0.02;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.023;
    const depth = ctx.createGain();
    depth.gain.value = 0.011;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();

    src.connect(hp).connect(gain).connect(this.bus);
    src.start();
    this.nodes.push(src, lfo);
  }

  /** Mechanical air, gated by the exploded state of the vehicle. */
  _buildShell() {
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 260;
    band.Q.value = 1.1;

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
    tone.frequency.value = 2600;
    tone.connect(out);

    const peak = 0.16 + Math.random() * 0.06;
    const length = 5.5 + Math.random() * 3.5;

    // Partials fall off fast, which is what separates a struck string
    // from a held organ note.
    [1, 2, 3].forEach((partial, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = root * partial;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak / (i * 2.6 + 1), when + 0.005);
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
      this._scheduleKey(6 + Math.random() * 8);
    }, delay * 1000);
  }

  /** 0 → 1, how far apart the vehicle currently is. */
  setDisassembly(amount) {
    if (!this.ctx || !this.enabled) return;
    const target = Math.min(Math.max(amount, 0), 1) * 0.1;
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
    g.gain.linearRampToValueAtTime(0.07, now + 0.004);
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
    this.disarmAutostart();
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
