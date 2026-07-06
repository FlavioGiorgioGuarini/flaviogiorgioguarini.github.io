/* AudioEngine: streams DNS_1 via <audio> (no 400MB decode in RAM),
   analyses it with WebAudio, exposes smoothed bass/mid/treble/level.
   ponytail: single <audio loop> path everywhere; a gapless dual-buffer
   crossfader is not worth its weight for an ambient score. */

const STORE_KEY = 'fgg-sound';

export class AudioEngine {
  constructor(src) {
    this.el = new Audio(src);
    this.el.loop = true;
    this.el.preload = 'none';
    this.ctx = null;
    this.gain = null;
    this.analyser = null;
    this.bins = null;
    this.playing = false;
    this.muted = sessionStorage.getItem(STORE_KEY) === 'muted';
    // smoothed reactive bus, read by the scene every frame
    this.bass = 0; this.mid = 0; this.treble = 0; this.level = 0;

    document.addEventListener('visibilitychange', () => {
      if (!this.playing) return;
      if (document.hidden) this._ramp(0, 0.5).then(() => this.el.pause());
      else if (!this.muted) { this.el.play().catch(() => {}); this._ramp(1, 1.2); }
    });
  }

  /* must be called from a user gesture (browser autoplay policy) */
  async start(fadeSec = 5) {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaElementSource(this.el);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.72;
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      src.connect(this.analyser).connect(this.gain).connect(this.ctx.destination);
    }
    await this.ctx.resume();
    try { await this.el.play(); } catch { return false; }
    this.playing = true;
    if (!this.muted) this._ramp(1, fadeSec);
    return true;
  }

  async stop(fadeSec = 5) {
    if (!this.playing) return;
    await this._ramp(0, fadeSec);
    this.el.pause();
    this.playing = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    sessionStorage.setItem(STORE_KEY, this.muted ? 'muted' : 'on');
    if (this.playing) this._ramp(this.muted ? 0 : 1, 0.6);
    return this.muted;
  }

  _ramp(target, sec) {
    if (!this.gain) return Promise.resolve();
    const g = this.gain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0001), t);
    if (target > 0) g.exponentialRampToValueAtTime(target, t + sec);
    else g.linearRampToValueAtTime(0.0001, t + sec);
    return new Promise(r => setTimeout(r, sec * 1000));
  }

  /* call once per rAF; cheap. Bands assume 48 kHz / fft 2048 (23.4 Hz per bin) */
  frame() {
    if (!this.analyser || !this.playing || this.muted) {
      // decay to calm when silent so visuals settle instead of freezing
      this.bass *= 0.96; this.mid *= 0.96; this.treble *= 0.96; this.level *= 0.96;
      return this;
    }
    this.analyser.getByteFrequencyData(this.bins);
    const avg = (a, b) => {
      let s = 0; for (let i = a; i < b; i++) s += this.bins[i];
      return s / ((b - a) * 255);
    };
    const k = 0.18; // extra smoothing on top of the analyser's own
    this.bass   += (avg(1, 8)    - this.bass)   * k;
    this.mid    += (avg(8, 86)   - this.mid)    * k;
    this.treble += (avg(86, 342) - this.treble) * k;
    this.level  += (avg(1, 342)  - this.level)  * k;
    return this;
  }
}
