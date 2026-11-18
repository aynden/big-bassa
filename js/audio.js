/**
 * Big Bass Splash - Web Audio API Country-Rock Banjo Synthesizer & Sound Effects Engine
 * Also supports loading external audio files from assets/audio/ if present.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.volume = 0.75;
    this.isPlayingBGM = false;
    this.bgmMode = 'base'; // 'base' | 'freespins'
    this.bgmTimer = null;
    this.stepIndex = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.masterGain);
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  toggleMusic(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopBGM();
    } else {
      this.startBGM(this.bgmMode);
    }
  }

  /**
   * Country-Rock Banjo & Acoustic Bass Sequencer
   */
  startBGM(mode = 'base') {
    this.init();
    this.bgmMode = mode;
    if (!this.musicEnabled || !this.ctx) return;
    if (this.isPlayingBGM) {
      clearInterval(this.bgmTimer);
    }
    this.isPlayingBGM = true;

    // Country G-Major / E-minor pentatonic banjo roll notes (Hz)
    const baseBanjoNotes = [
      196.00, 246.94, 293.66, 392.00, 329.63, 293.66, 246.94, 392.00, // G chord roll
      261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 261.63, // C chord roll
      196.00, 246.94, 293.66, 392.00, 440.00, 392.00, 293.66, 246.94, // G chord roll
      293.66, 369.99, 440.00, 587.33, 440.00, 369.99, 293.66, 246.94  // D chord roll
    ];

    const freeSpinsBanjoNotes = [
      293.66, 392.00, 493.88, 587.33, 659.25, 587.33, 493.88, 392.00,
      329.63, 392.00, 523.25, 659.25, 587.33, 523.25, 392.00, 329.63,
      369.99, 440.00, 587.33, 739.99, 659.25, 587.33, 440.00, 369.99,
      392.00, 493.88, 587.33, 783.99, 659.25, 587.33, 493.88, 392.00
    ];

    const bassLine = [98.00, 98.00, 130.81, 130.81, 98.00, 98.00, 146.83, 123.47];
    const tempoMs = mode === 'freespins' ? 145 : 175;

    this.bgmTimer = setInterval(() => {
      if (!this.musicEnabled || this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
      const notes = this.bgmMode === 'freespins' ? freeSpinsBanjoNotes : baseBanjoNotes;
      const noteFreq = notes[this.stepIndex % notes.length];

      // Pluck banjo string
      this._pluckBanjo(noteFreq, 0.14);

      // Bass note on every 4th step
      if (this.stepIndex % 4 === 0) {
        const bassFreq = bassLine[Math.floor(this.stepIndex / 4) % bassLine.length];
        this._playAcousticBass(bassFreq, 0.35);
      }

      // Country snare brush on backbeat
      if (this.stepIndex % 4 === 2) {
        this._playBrushHit(0.05);
      }

      this.stepIndex++;
    }, tempoMs);
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _pluckBanjo(freq, duration) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    // Metallic banjo twang overtone
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.0, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 3.2, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
  }

  _playAcousticBass(freq, duration) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  _playBrushHit(duration) {
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(now);
  }

  /**
   * Sound Effects
   */
  playSpinStart() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Water splash + fishing reel whir
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240 + i * 75, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(520 + i * 90, now + i * 0.03 + 0.08);

      gain.gain.setValueAtTime(0.14, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.09);
    }
  }

  playReelStop(reelIndex = 0, hasScatter = false) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep water bubble thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 125 + reelIndex * 12;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // If a Scatter landed on this reel, play exciting bell + splash chime
    if (hasScatter) {
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'triangle';
      const scatterFreq = 587.33 * Math.pow(1.12, reelIndex);
      bell.frequency.setValueAtTime(scatterFreq, now);
      bell.frequency.setValueAtTime(scatterFreq * 1.25, now + 0.06);

      bellGain.gain.setValueAtTime(0.35, now);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      bell.connect(bellGain);
      bellGain.connect(this.sfxGain);
      bell.start(now);
      bell.stop(now + 0.35);
    }
  }

  playWinChime(isBig = false) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = isBig
      ? [392.00, 493.88, 587.33, 783.99, 987.77, 1174.66]
      : [392.00, 493.88, 587.33, 783.99];

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);

      gain.gain.setValueAtTime(0.24, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.42);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.42);
    });
  }

  playFishCollect() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Fishing reel drag zing + coin ding
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1280, now + 0.18);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playExplosion() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.55;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  playHookPull() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.35);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  playBonusTrigger() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const fanfare = [392.00, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50];
    fanfare.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;

      gain.gain.setValueAtTime(0.25, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.35);
    });
  }

  playButtonClick() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}
