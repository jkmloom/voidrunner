// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Audio Manager — Retro synth sound effects via Web Audio API
   ═══════════════════════════════════════════════════════════ */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /* Play a frequency sweep — used for various SFX */
  _sweep(startFreq, endFreq, duration, type = 'square', vol = 0.15) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  shoot() {
    this._sweep(800, 200, 0.08, 'square', 0.08);
  }

  shootRapid() {
    this._sweep(1000, 300, 0.05, 'square', 0.06);
  }

  enemyHit() {
    this._sweep(400, 100, 0.1, 'sawtooth', 0.1);
  }

  enemyDie() {
    this._sweep(300, 50, 0.25, 'sawtooth', 0.15);
    setTimeout(() => this._sweep(200, 30, 0.15, 'square', 0.1), 50);
  }

  playerHit() {
    this._sweep(150, 40, 0.3, 'sawtooth', 0.2);
    this._sweep(100, 30, 0.4, 'square', 0.15);
  }

  powerup() {
    const t = this.ctx.currentTime;
    [400, 500, 600, 800].forEach((f, i) => {
      setTimeout(() => this._sweep(f, f * 1.5, 0.1, 'sine', 0.1), i * 60);
    });
  }

  waveStart() {
    this._sweep(200, 600, 0.3, 'sine', 0.12);
    setTimeout(() => this._sweep(300, 900, 0.3, 'sine', 0.1), 150);
  }

  gameOver() {
    [400, 350, 300, 200, 100].forEach((f, i) => {
      setTimeout(() => this._sweep(f, f * 0.5, 0.3, 'sawtooth', 0.12), i * 200);
    });
  }
}
