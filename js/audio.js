/**
 * Big Bass Splash™ — Real Sampled Open-Source Audio & Multi-Track Music Engine
 *
 * Uses real recorded Creative Commons (CC-BY / Public Domain) studio music & SFX from Wikimedia Commons
 * in assets/audio/:
 *  BGM Tracks (7 selectable & dynamic tracks):
 *   1. bgm_bama_country.mp3    — "Bama Country" (Kevin MacLeod — Full-band Country Banjo, Fiddle & Guitar)
 *   2. bgm_guts_bourbon.mp3    — "Guts & Bourbon" (Kevin MacLeod — Monster-Truck Southern Country Rock)
 *   3. bgm_porch_blues.mp3     — "Porch Blues" (Kevin MacLeod — Sunny Lakeside Acoustic Guitar)
 *   4. bgm_base.ogg            — "Lakeside Folk" (Acoustic Folk Guitar & Banjo)
 *   5. bgm_river_breakdown.mp3 — "River Valley Breakdown" (Kevin MacLeod — Fast Bluegrass Banjo & Fiddle Breakdown)
 *   6. bgm_fiddles_mcginty.mp3 — "Fiddles McGinty" (Kevin MacLeod — Celebratory Fiddle & Banjo Hoedown for Level 2+ Retriggers)
 *   7. bgm_freespins.ogg       — "5-String Banjo Roll" (Classic Solo Bluegrass Banjo)
 *
 *  Real Recorded Sound Effects:
 *   - sfx_splash.ogg: Real recorded water splash audio
 *   - sfx_bubbles.ogg: Real recorded underwater bubbling audio
 *   - sfx_explosion.ogg: Real recorded dynamite / bazooka blast explosion audio
 *   - sfx_coins.ogg: Real recorded coins jingling & cascading audio
 *   - sfx_coin_drop.ogg: Real recorded single coin / token drop impact
 */

export const BGM_TRACKS = [
  { id: 'bama_country',    name: 'Bama Country',           url: 'assets/audio/bgm_bama_country.mp3',    mode: 'base',      baseGain: 0.44 },
  { id: 'guts_bourbon',    name: 'Guts & Bourbon',         url: 'assets/audio/bgm_guts_bourbon.mp3',    mode: 'base',      baseGain: 0.44 },
  { id: 'porch_blues',     name: 'Porch Blues',            url: 'assets/audio/bgm_porch_blues.mp3',     mode: 'base',      baseGain: 0.46 },
  { id: 'lakeside_folk',   name: 'Lakeside Folk',          url: 'assets/audio/bgm_base.ogg',            mode: 'base',      baseGain: 0.42 },
  { id: 'river_breakdown', name: 'River Valley Breakdown', url: 'assets/audio/bgm_river_breakdown.mp3', mode: 'freespins', baseGain: 0.50 },
  { id: 'fiddles_mcginty', name: 'Fiddles McGinty',        url: 'assets/audio/bgm_fiddles_mcginty.mp3', mode: 'freespins', baseGain: 0.50 },
  { id: 'banjo_roll',      name: '5-String Banjo Roll',    url: 'assets/audio/bgm_freespins.ogg',       mode: 'freespins', baseGain: 0.45 }
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    this.isMuted = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.volume = 0.80;

    this.isPlayingBGM = false;
    this.bgmMode = 'base'; // 'base' | 'freespins'
    this.currentBaseTrackIdx = 0; // Default: Bama Country
    this.currentTrackId = 'bama_country';
    this.bgmAudioElements = {}; // Cached HTML5 Audio elements for instant streaming
    this.activeBgmAudio = null;
    this.onTrackChange = null; // Optional UI callback when track switches

    // Decoded AudioBuffer cache from real .ogg SFX files in assets/audio/
    this.buffers = {};
    this.loadingPromise = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.42;
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.90;
        this.sfxGain.connect(this.masterGain);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this._loadAllAudioSamples();
    }
  }

  async _loadAllAudioSamples() {
    const sfxFiles = {
      splash: 'assets/audio/sfx_splash.ogg',
      bubbles: 'assets/audio/sfx_bubbles.ogg',
      explosion: 'assets/audio/sfx_explosion.ogg',
      coins: 'assets/audio/sfx_coins.ogg',
      coin_drop: 'assets/audio/sfx_coin_drop.ogg'
    };

    if (this.ctx) {
      await Promise.all(
        Object.entries(sfxFiles).map(async ([key, url]) => {
          try {
            const resp = await fetch(url);
            if (!resp.ok) return;
            const arrayBuf = await resp.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            this.buffers[key] = audioBuf;
          } catch (err) {
            console.warn(`Audio sample ${url} load fallback:`, err);
          }
        })
      );
    }
  }

  /**
   * Play a decoded real audio buffer (or a specific slice of it) with optional pitch/rate & gain
   */
  _playBuffer(key, { offset = 0, duration = null, rate = 1.0, gainVal = 0.8, loop = false, targetGainNode = null } = {}) {
    if (!this.ctx || !this.buffers[key]) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[key];
    source.playbackRate.value = rate;
    source.loop = loop;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);

    source.connect(g);
    g.connect(targetGainNode || this.sfxGain);

    const now = this.ctx.currentTime;
    if (duration !== null && !loop) {
      g.gain.setValueAtTime(gainVal, now + Math.max(0.01, duration - 0.08));
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.start(now, offset, duration);
    } else {
      source.start(now, offset);
    }

    return source;
  }

  _updateBgmElementVolume() {
    if (!this.activeBgmAudio) return;
    const track = BGM_TRACKS.find(t => t.id === this.currentTrackId) || BGM_TRACKS[0];
    if (this.isMuted || !this.musicEnabled) {
      this.activeBgmAudio.volume = 0;
    } else {
      this.activeBgmAudio.volume = Math.max(0, Math.min(1, this.volume * track.baseGain));
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
    this._updateBgmElementVolume();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
    this._updateBgmElementVolume();
  }

  toggleMusic(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopBGM();
    } else {
      this.startBGM(this.bgmMode);
    }
  }

  getCurrentTrack() {
    return BGM_TRACKS.find(t => t.id === this.currentTrackId) || BGM_TRACKS[0];
  }

  /**
   * Cycle to the next studio music track in the 7-song library
   */
  nextTrack() {
    this.init();
    const curIdx = BGM_TRACKS.findIndex(t => t.id === this.currentTrackId);
    const nextIdx = (curIdx + 1) % BGM_TRACKS.length;
    const nextTrackObj = BGM_TRACKS[nextIdx];
    if (nextTrackObj.mode === 'base') {
      this.currentBaseTrackIdx = nextIdx;
    }
    this._playTrackById(nextTrackObj.id);
    return nextTrackObj;
  }

  /**
   * Start Real Recorded Studio Country / Bluegrass BGM Loop
   */
  startBGM(mode = 'base', bonusLevel = 1) {
    this.init();
    this.bgmMode = mode;
    this.isPlayingBGM = true;

    let targetTrackId;
    if (mode === 'freespins') {
      // Level 1 plays River Valley Breakdown; Level 2+ (2x, 3x, 10x) escalates to Fiddles McGinty!
      targetTrackId = bonusLevel >= 2 ? 'fiddles_mcginty' : 'river_breakdown';
    } else {
      const baseTracks = BGM_TRACKS.filter(t => t.mode === 'base');
      const chosen = baseTracks[this.currentBaseTrackIdx % baseTracks.length] || baseTracks[0];
      targetTrackId = chosen.id;
    }

    this._playTrackById(targetTrackId);
  }

  _playTrackById(trackId) {
    const track = BGM_TRACKS.find(t => t.id === trackId) || BGM_TRACKS[0];
    this.currentTrackId = track.id;

    if (this.onTrackChange) {
      this.onTrackChange(track);
    }

    if (!this.musicEnabled) return;

    if (this.activeBgmAudio && this.activeBgmAudio._trackId !== track.id) {
      try {
        this.activeBgmAudio.pause();
      } catch (_) {}
    }

    if (!this.bgmAudioElements[track.id]) {
      const audioEl = new Audio(track.url);
      audioEl.loop = true;
      audioEl.preload = 'auto';
      audioEl._trackId = track.id;
      this.bgmAudioElements[track.id] = audioEl;
    }

    this.activeBgmAudio = this.bgmAudioElements[track.id];
    this._updateBgmElementVolume();

    const playPromise = this.activeBgmAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.activeBgmAudio) {
      try {
        this.activeBgmAudio.pause();
      } catch (_) {}
    }
  }

  /**
   * Real Water Bubbling + Splash when Reels Spin
   */
  playSpinStart() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    // Play a 0.65s slice of real underwater bubbling
    if (this.buffers.bubbles) {
      this._playBuffer('bubbles', {
        offset: 0.4,
        duration: 0.65,
        rate: 1.15,
        gainVal: 0.65
      });
    }

    // Play a short 0.35s slice of real water splash
    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 0.25,
        duration: 0.38,
        rate: 1.25,
        gainVal: 0.45
      });
    }
  }

  /**
   * Reel Stop Thud + Real Splash / Bell when Scatter or Fisherman Wild lands
   */
  playReelStop(reelIndex = 0, hasSpecial = false) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Short water bubble thud on every reel stop
    if (this.buffers.coin_drop) {
      this._playBuffer('coin_drop', {
        offset: 0,
        duration: 0.22,
        rate: 0.72 + reelIndex * 0.06,
        gainVal: 0.55
      });
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125 + reelIndex * 10, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // If a Scatter Bass or Fisherman Wild landed, trigger a real water splash + metallic bell!
    if (hasSpecial) {
      if (this.buffers.splash) {
        this._playBuffer('splash', {
          offset: 1.1,
          duration: 0.55,
          rate: 1.05 + reelIndex * 0.05,
          gainVal: 0.75
        });
      }

      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'triangle';
      const scatterFreq = 587.33 * Math.pow(1.12, reelIndex);
      bell.frequency.setValueAtTime(scatterFreq, now);
      bell.frequency.setValueAtTime(scatterFreq * 1.25, now + 0.06);
      bellGain.gain.setValueAtTime(0.32, now);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      bell.connect(bellGain);
      bellGain.connect(this.sfxGain);
      bell.start(now);
      bell.stop(now + 0.35);
    }
  }

  /**
   * Real Coin Cascade + Win Fanfare
   */
  playWinChime(isBig = false) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    // Play real recorded coins jingling & cascading!
    if (this.buffers.coins) {
      this._playBuffer('coins', {
        offset: 0.1,
        duration: isBig ? 1.8 : 0.85,
        rate: isBig ? 1.0 : 1.15,
        gainVal: 0.85
      });
    }

    const now = this.ctx.currentTime;
    const chord = isBig
      ? [392.00, 493.88, 587.33, 783.99, 987.77, 1174.66]
      : [392.00, 493.88, 587.33, 783.99];

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.20, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.40);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.40);
    });
  }

  /**
   * Real Water Splash + Coin Jingling when Fisherman reels in a Money Fish
   */
  playFishCollect() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 2.2,
        duration: 0.45,
        rate: 1.2,
        gainVal: 0.70
      });
    }

    if (this.buffers.coins) {
      this._playBuffer('coins', {
        offset: 0.2,
        duration: 0.55,
        rate: 1.25,
        gainVal: 0.75
      });
    }

    // Fishing reel drag zing
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.16);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Real Recorded Explosion + Water Splash for Dynamite & Bazooka Features
   */
  playExplosion() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.explosion) {
      this._playBuffer('explosion', {
        offset: 0,
        duration: 1.1,
        rate: 1.0,
        gainVal: 0.95
      });
    }

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 1.0,
        duration: 0.65,
        rate: 0.95,
        gainVal: 0.75
      });
    }
  }

  /**
   * Real Water Splash & Line Whoosh for Hook Feature
   */
  playHookPull() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 3.1,
        duration: 0.6,
        rate: 1.05,
        gainVal: 0.80
      });
    }

    if (this.buffers.bubbles) {
      this._playBuffer('bubbles', {
        offset: 1.2,
        duration: 0.5,
        rate: 1.3,
        gainVal: 0.60
      });
    }
  }

  /**
   * Bonus Trigger Celebration Fanfare + Real Coins & Splash
   */
  playBonusTrigger() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.coins) {
      this._playBuffer('coins', {
        offset: 0,
        duration: 2.0,
        rate: 1.0,
        gainVal: 0.90
      });
    }

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 1.1,
        duration: 0.8,
        rate: 1.0,
        gainVal: 0.75
      });
    }

    const now = this.ctx.currentTime;
    const fanfare = [392.00, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50];
    fanfare.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.22, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.35);
    });
  }

  playButtonClick() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.coin_drop) {
      this._playBuffer('coin_drop', {
        offset: 0.02,
        duration: 0.14,
        rate: 1.65,
        gainVal: 0.45
      });
    }
  }

  /**
   * Authentic Casino Suspense Anticipation Riser (when 2 Scatters land or spinning for 4th Fisherman)
   */
  startAnticipationRiser() {
    this.init();
    if (!this.sfxEnabled || !this.ctx || this._riserTimer) return;

    let step = 0;
    const playBeat = () => {
      if (!this.ctx || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      const baseFreq = 260 * Math.pow(1.045, Math.min(step, 20));

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.09);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);

      // Subtle metallic rattle on alternating beats
      if (step % 2 === 0 && this.buffers.coin_drop) {
        this._playBuffer('coin_drop', {
          offset: 0.01,
          duration: 0.08,
          rate: 1.4 + Math.min(step, 16) * 0.04,
          gainVal: 0.28
        });
      }
      step++;
    };

    playBeat();
    this._riserTimer = setInterval(playBeat, 115);
  }

  stopAnticipationRiser() {
    if (this._riserTimer) {
      clearInterval(this._riserTimer);
      this._riserTimer = null;
    }
  }

  /**
   * Crisp Metallic Coin Counter Tick synced to Big Win / Mega Win / Bonus Total rolling odometer
   */
  playCoinCountTick(progress = 0) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.buffers.coin_drop) {
      this._playBuffer('coin_drop', {
        offset: 0.01,
        duration: 0.075,
        rate: 1.25 + progress * 0.65,
        gainVal: 0.34
      });
    }

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720 + progress * 520, now);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Grand Level-Up Retrigger Fanfare (2x / 3x / 10x unlocked!)
   */
  playLevelUpFanfare() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;

    if (this.buffers.coins) {
      this._playBuffer('coins', {
        offset: 0,
        duration: 2.2,
        rate: 1.05,
        gainVal: 0.95
      });
    }

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 987.77, 1174.66, 1567.98];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 2600;
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      g.gain.setValueAtTime(0.18, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.42);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.44);
    });
  }

  /**
   * Heavy Metallic Iron Anchor Clang + Water Splash (ends Pre-Bonus Modifier Catch)
   */
  playAnchorClang() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 0.9,
        duration: 0.75,
        rate: 0.82,
        gainVal: 0.85
      });
    }

    // Metallic inharmonic iron clank partials
    const partials = [185, 293, 468, 712];
    partials.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.52);
      g.gain.setValueAtTime(0.22 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.56);
    });
  }

  /**
   * Option 1B Ghost Trail Comet Whoosh + Rising Golden Sparkle Glissando
   * Plays as the Fisherman portrait launches from the reel toward the stitched-leather progress belt!
   */
  playFishermanCometWhoosh() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Airy rising golden comet whoosh (bandpass-swept white noise)
    const sampleRate = this.ctx.sampleRate;
    const dur = 0.62;
    const buf = this.ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.55;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + dur * 0.88);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // 2. Sparkling rising golden harp/bell comet trail glissando
    const notes = [523.25, 659.25, 783.99, 987.77, 1318.51];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.075;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, t + 0.22);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.30);
    });
  }

  /**
   * Leather Belt Slot Impact Slam + Harmonic Climbing Gold Chime (Option 1B arrival!)
   */
  playBeltSlotSlam(slotIdx = 1) {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Punchy saddle-leather impact thud
    const thud = this.ctx.createOscillator();
    const tGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(165, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    tGain.gain.setValueAtTime(0.32, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thud.connect(tGain);
    tGain.connect(this.sfxGain);
    thud.start(now);
    thud.stop(now + 0.17);

    // 2. Climbing harmonic golden chime across each 4-slot segment (1 -> 2 -> 3 -> 4!)
    const segPos = ((Math.max(1, slotIdx) - 1) % 4); // 0, 1, 2, 3
    const baseFreqs = [587.33, 698.46, 880.0, 1174.66]; // D5, F5, A5, D6
    const f = baseFreqs[segPos];
    const chord = segPos === 3 ? [f, f * 1.25, f * 1.5] : [f, f * 1.5];

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);
      g.gain.setValueAtTime(0.20 / (idx + 1), now + idx * 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42 + idx * 0.05);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.025);
      osc.stop(now + 0.48 + idx * 0.05);
    });
  }

  /**
   * Dramatic Lasso Near-Miss Slip-Away Swish (fish darts away just before loop closes!)
   */
  playLassoNearMiss() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 0.25,
        duration: 0.42,
        rate: 1.28,
        gainVal: 0.45
      });
    }

    // Playful descending slip-away whistle/whoop
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.28);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /**
   * Dramatic Lasso Tug-of-War Rope Tension & Water Thrash
   */
  playLassoTensionCreak() {
    this.init();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.buffers.splash) {
      this._playBuffer('splash', {
        offset: 0.5,
        duration: 0.55,
        rate: 1.05,
        gainVal: 0.55
      });
    }

    // Rising tension hum during tug-of-war pull
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 650;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.42);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }
}
