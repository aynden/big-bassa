/**
 * Big Bass Splash™ — Main Application Controller
 * Connects SlotEngine, ReelRenderer, AudioEngine, Wallet/Token Manager,
 * Pre-Bonus 5-Modifier Lasso Modal, Free Spins Loop, and Dev/Cheat Drawer.
 */

import { GAME_CONFIG, SYMBOLS, PRE_BONUS_MODIFIERS } from './config.js';
import { SlotEngine } from './engine.js';
import { ReelRenderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { ThreeVFXEngine } from './vfx3d.js';

const STORAGE_KEY_BALANCE = 'big_bass_splash_balance_v1';

class BigBassSplashApp {
  constructor() {
    this.audio = new AudioEngine();
    this.engine = new SlotEngine();
    this.canvas = document.getElementById('slot-canvas');
    this.threeCanvas = document.getElementById('three-vfx-canvas');
    this.vfx3d = this.threeCanvas ? new ThreeVFXEngine(this.threeCanvas) : null;
    this.renderer = new ReelRenderer(this.canvas, this.audio, this.vfx3d);

    // Player Wallet & Bet State
    const savedBalance = parseFloat(localStorage.getItem(STORAGE_KEY_BALANCE));
    this.balance = !isNaN(savedBalance) && savedBalance >= 0 ? savedBalance : GAME_CONFIG.DEFAULT_BALANCE;
    this.coinsPerLineIndex = GAME_CONFIG.COINS_PER_LINE_OPTIONS.indexOf(GAME_CONFIG.DEFAULT_COINS_PER_LINE);
    this.coinValueIndex = GAME_CONFIG.COIN_VALUE_OPTIONS.indexOf(GAME_CONFIG.DEFAULT_COIN_VALUE);
    this.displayInCoins = false;

    // Spin & Control Flags
    this.isSpinning = false;
    this.isTurbo = false;
    this.isAutoplay = false;
    this.spaceHoldTimer = null;

    this._cacheDOM();
    this._bindEvents();
  }

  get coinsPerLine() {
    return GAME_CONFIG.COINS_PER_LINE_OPTIONS[this.coinsPerLineIndex];
  }

  get coinValue() {
    return GAME_CONFIG.COIN_VALUE_OPTIONS[this.coinValueIndex];
  }

  get totalBet() {
    return Number((this.coinsPerLine * this.coinValue * GAME_CONFIG.PAYLINES_COUNT).toFixed(2));
  }

  get buyBonusCost() {
    return Number((this.totalBet * GAME_CONFIG.BUY_BONUS_MULTIPLIER).toFixed(2));
  }

  async init() {
    this.setStatus('LOADING PHOTOREALISTIC ASSETS...');
    await this.renderer.loadAssets();

    // Generate initial decorative 5x3 grid
    this.renderer.currentTotalBet = this.totalBet;
    const startGrid = this.engine.generateGrid();
    this.renderer.setGrid(startGrid);
    this.renderer.startLoop();

    this.updateHUD();
    this.updateTrailUI();
    this.setStatus('HOLD SPACE FOR TURBO SPIN • PRESS SPIN TO FISH!');
  }

  _cacheDOM() {
    this.dom = {
      stage: document.getElementById('game-stage'),
      creditVal: document.getElementById('hud-credit-value'),
      betVal: document.getElementById('hud-bet-value'),
      creditBox: document.getElementById('credit-metric-box'),
      betBox: document.getElementById('bet-metric-box'),
      statusLine: document.getElementById('hud-status-line'),
      winBox: document.getElementById('hud-win-box'),
      winAmount: document.getElementById('hud-win-amount'),

      btnSpin: document.getElementById('btn-spin'),
      btnBetMinus: document.getElementById('btn-bet-minus'),
      btnBetPlus: document.getElementById('btn-bet-plus'),
      btnTurbo: document.getElementById('btn-turbo'),
      btnAutoplay: document.getElementById('btn-autoplay'),
      btnAudioToggle: document.getElementById('btn-audio-toggle'),
      btnMusicToggle: document.getElementById('btn-music-toggle'),
      btnPaytable: document.getElementById('btn-paytable'),

      // Bet Popover
      betPopover: document.getElementById('bet-popover'),
      btnCloseBetPopover: document.getElementById('btn-close-bet-popover'),
      btnCplMinus: document.getElementById('btn-cpl-minus'),
      btnCplPlus: document.getElementById('btn-cpl-plus'),
      cplDisplay: document.getElementById('cpl-display'),
      btnCvMinus: document.getElementById('btn-cv-minus'),
      btnCvPlus: document.getElementById('btn-cv-plus'),
      cvDisplay: document.getElementById('cv-display'),
      totalBetPopoverDisplay: document.getElementById('total-bet-popover-display'),
      btnMaxBet: document.getElementById('btn-max-bet'),

      // Buy Bonus
      btnBuyBonus: document.getElementById('btn-buy-bonus'),
      buyBonusPrice: document.getElementById('buy-bonus-price'),
      buyBonusModal: document.getElementById('buy-bonus-modal'),
      buyModalCost: document.getElementById('buy-modal-cost'),
      btnCancelBuy: document.getElementById('btn-cancel-buy'),
      btnConfirmBuy: document.getElementById('btn-confirm-buy'),

      // Trail & Base Header (Progress bar visible ONLY in Bonus Game!)
      baseGameHeader: document.getElementById('base-game-header'),
      freespinsTrailBar: document.getElementById('freespins-trail-bar'),
      fsModeBadge: document.getElementById('fs-mode-badge'),
      fsCounterText: document.getElementById('fs-counter-text'),
      activeModifiersPanel: document.getElementById('active-modifiers-panel'),
      activeModifiersList: document.getElementById('active-modifiers-list'),

      // Phase 1: Underwater Circle-Swim Lasso & Anchor Catch Arena
      prebonusLassoOverlay: document.getElementById('prebonus-lasso-overlay'),
      lassoPhasePill: document.getElementById('lasso-phase-pill'),
      lassoCalloutText: document.getElementById('lasso-callout-text'),
      lassoCircleCanvas: document.getElementById('lasso-circle-canvas'),

      // Phase 2: Vintage Parchment "CONGRATULATIONS! XX FREE SPINS!" Poster
      bonusIntroPosterModal: document.getElementById('bonus-intro-poster-modal'),
      bonusPosterCard: document.getElementById('bonus-poster-card'),
      posterSpinsHeadline: document.getElementById('poster-spins-headline'),
      btnStartFreeSpins: document.getElementById('btn-start-freespins'),

      // Celebration Modal
      celebrationDimmer: document.getElementById('celebration-dimmer'),
      celebrationModal: document.getElementById('celebration-modal'),
      celebrationTierBadge: document.getElementById('celebration-tier-badge'),
      celebrationAmount: document.getElementById('celebration-amount'),
      celebrationSubtext: document.getElementById('celebration-subtext'),
      btnDismissCelebration: document.getElementById('btn-dismiss-celebration'),

      // Token & Wallet Controls
      btnAdd100: document.getElementById('btn-add-100'),
      btnAdd1000: document.getElementById('btn-add-1000'),
      btnAdd10000: document.getElementById('btn-add-10000'),
      btnOpenWallet: document.getElementById('btn-open-wallet'),
      walletModal: document.getElementById('wallet-modal'),
      btnCloseWallet: document.getElementById('btn-close-wallet'),
      walletCurrentBalance: document.getElementById('wallet-current-balance'),
      btnResetBalance: document.getElementById('btn-reset-balance'),
      customBalanceForm: document.getElementById('custom-balance-form'),
      customBalanceInput: document.getElementById('custom-balance-input'),

      // Paytable Modal
      paytableModal: document.getElementById('paytable-modal'),
      btnClosePaytable: document.getElementById('btn-close-paytable'),
      paytableCurrentBet: document.getElementById('paytable-current-bet'),
      paytableSymbolsGrid: document.getElementById('paytable-symbols-grid'),

      // Cheat Drawer, Music Track Switcher & 3D FX Toggle
      btnNextTrack: document.getElementById('btn-next-track'),
      btnToggle3d: document.getElementById('btn-toggle-3d'),
      btnToggleCheat: document.getElementById('btn-toggle-cheat'),
      cheatDrawer: document.getElementById('cheat-drawer'),
      btnCloseCheat: document.getElementById('btn-close-cheat'),
      activeCheatStatus: document.getElementById('active-cheat-status')
    };
  }

  _bindEvents() {
    // Update top HUD track button label whenever BGM track switches
    this.audio.onTrackChange = track => {
      if (this.dom.btnNextTrack) {
        this.dom.btnNextTrack.textContent = `🎵 Track: ${track.name}`;
      }
    };

    if (this.dom.btnNextTrack) {
      this.dom.btnNextTrack.addEventListener('click', () => {
        this.audio.playButtonClick();
        const nextTrack = this.audio.nextTrack();
        this.setStatus(`🎵 NOW PLAYING: ${nextTrack.name.toUpperCase()}`);
      });
    }

    if (this.dom.btnToggle3d) {
      this.dom.btnToggle3d.addEventListener('click', () => {
        if (!this.vfx3d) return;
        this.audio.playButtonClick();
        this.vfx3d.enabled = !this.vfx3d.enabled;
        this.dom.btnToggle3d.textContent = this.vfx3d.enabled ? '✨ 3D FX: ON' : '✨ 3D FX: OFF';
        if (this.threeCanvas) {
          this.threeCanvas.style.opacity = this.vfx3d.enabled ? '1' : '0';
        }
        if (this.vfx3d.enabled) {
          this.vfx3d.burstCoins(0.5, 0.45, 22, 1.0);
        }
      });
    }

    // Start audio context on first user interaction
    const unlockAudio = () => {
      this.audio.init();
      if (!this.audio.isPlayingBGM && this.audio.musicEnabled) {
        this.audio.startBGM('base');
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // Main Spin Button
    this.dom.btnSpin.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.triggerSpin();
    });

    // Keyboard Spacebar support (Tap to spin, hold for turbo spin)
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        const blockingModalOpen =
          (this.dom.celebrationModal && !this.dom.celebrationModal.classList.contains('hidden')) ||
          (this.dom.bonusIntroPosterModal && !this.dom.bonusIntroPosterModal.classList.contains('hidden')) ||
          (this.dom.prebonusLassoOverlay && !this.dom.prebonusLassoOverlay.classList.contains('hidden'));
        if (blockingModalOpen) return;

        e.preventDefault();
        if (!e.repeat) {
          this.triggerSpin();
        } else {
          this.isTurbo = true;
          this.dom.btnTurbo.classList.add('active');
          this.triggerSpin();
        }
      }
    });

    // Bet adjustment (- / +)
    this.dom.btnBetMinus.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.stepTotalBet(-1);
    });
    this.dom.btnBetPlus.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.stepTotalBet(1);
    });

    // Open/Close Bet Popover
    this.dom.betBox.addEventListener('click', () => {
      this.dom.betPopover.classList.toggle('hidden');
    });
    this.dom.btnCloseBetPopover.addEventListener('click', () => {
      this.dom.betPopover.classList.add('hidden');
    });

    this.dom.btnCplMinus.addEventListener('click', () => {
      if (this.coinsPerLineIndex > 0) {
        this.coinsPerLineIndex--;
        this.updateHUD();
      }
    });
    this.dom.btnCplPlus.addEventListener('click', () => {
      if (this.coinsPerLineIndex < GAME_CONFIG.COINS_PER_LINE_OPTIONS.length - 1) {
        this.coinsPerLineIndex++;
        this.updateHUD();
      }
    });
    this.dom.btnCvMinus.addEventListener('click', () => {
      if (this.coinValueIndex > 0) {
        this.coinValueIndex--;
        this.updateHUD();
      }
    });
    this.dom.btnCvPlus.addEventListener('click', () => {
      if (this.coinValueIndex < GAME_CONFIG.COIN_VALUE_OPTIONS.length - 1) {
        this.coinValueIndex++;
        this.updateHUD();
      }
    });
    this.dom.btnMaxBet.addEventListener('click', () => {
      this.coinsPerLineIndex = GAME_CONFIG.COINS_PER_LINE_OPTIONS.length - 1;
      this.coinValueIndex = GAME_CONFIG.COIN_VALUE_OPTIONS.length - 1;
      this.updateHUD();
      this.dom.betPopover.classList.add('hidden');
    });

    // Toggle Coins vs Cash Display on Credit click
    this.dom.creditBox.addEventListener('click', () => {
      this.displayInCoins = !this.displayInCoins;
      this.updateHUD();
    });

    // Turbo & Autoplay
    this.dom.btnTurbo.addEventListener('click', () => {
      this.isTurbo = !this.isTurbo;
      this.dom.btnTurbo.classList.toggle('active', this.isTurbo);
    });

    this.dom.btnAutoplay.addEventListener('click', () => {
      this.isAutoplay = !this.isAutoplay;
      this.dom.btnAutoplay.classList.toggle('active', this.isAutoplay);
      this.dom.btnAutoplay.textContent = this.isAutoplay ? 'STOP AUTO' : 'AUTOPLAY';
      if (this.isAutoplay && !this.isSpinning) {
        this.triggerSpin();
      }
    });

    // Audio & Music Toggles
    this.dom.btnAudioToggle.addEventListener('click', () => {
      const nextMute = !this.audio.isMuted;
      this.audio.setMute(nextMute);
      this.dom.btnAudioToggle.textContent = nextMute ? '🔇' : '🔊';
    });

    this.dom.btnMusicToggle.addEventListener('click', () => {
      const nextMusic = !this.audio.musicEnabled;
      this.audio.toggleMusic(nextMusic);
      this.dom.btnMusicToggle.style.opacity = nextMusic ? '1' : '0.45';
    });

    // Buy Free Spins Modal
    this.dom.btnBuyBonus.addEventListener('click', () => {
      if (this.isSpinning || this.engine.inFreeSpins) return;
      this.audio.playButtonClick();
      this.dom.buyModalCost.textContent = this.formatCurrency(this.buyBonusCost);
      this.dom.buyBonusModal.classList.remove('hidden');
    });
    this.dom.btnCancelBuy.addEventListener('click', () => {
      this.dom.buyBonusModal.classList.add('hidden');
    });
    this.dom.btnConfirmBuy.addEventListener('click', () => {
      this.dom.buyBonusModal.classList.add('hidden');
      this.executeBuyFreeSpins();
    });

    // Token & Wallet Top-Up Controls
    this.dom.btnAdd100.addEventListener('click', () => this.addTokens(100));
    this.dom.btnAdd1000.addEventListener('click', () => this.addTokens(1000));
    this.dom.btnAdd10000.addEventListener('click', () => this.addTokens(10000));

    this.dom.btnOpenWallet.addEventListener('click', () => {
      this.dom.walletCurrentBalance.textContent = this.formatCurrency(this.balance);
      this.dom.customBalanceInput.value = Math.round(this.balance);
      this.dom.walletModal.classList.remove('hidden');
    });
    this.dom.btnCloseWallet.addEventListener('click', () => {
      this.dom.walletModal.classList.add('hidden');
    });

    document.querySelectorAll('.wallet-preset-btn[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = parseFloat(btn.dataset.add);
        this.addTokens(amt);
        this.dom.walletCurrentBalance.textContent = this.formatCurrency(this.balance);
      });
    });

    this.dom.btnResetBalance.addEventListener('click', () => {
      this.setBalance(GAME_CONFIG.DEFAULT_BALANCE);
      this.dom.walletCurrentBalance.textContent = this.formatCurrency(this.balance);
      this.renderer.addFloatingText(600, 340, 'BALANCE RESET TO $1,000.00!', '#00E5FF', 42, 1.2);
    });

    this.dom.customBalanceForm.addEventListener('submit', e => {
      e.preventDefault();
      const val = parseFloat(this.dom.customBalanceInput.value);
      if (!isNaN(val) && val >= 0) {
        this.setBalance(val);
        this.dom.walletCurrentBalance.textContent = this.formatCurrency(this.balance);
        this.dom.walletModal.classList.add('hidden');
      }
    });

    // Paytable Modal
    this.dom.btnPaytable.addEventListener('click', () => {
      this.renderPaytableModal();
      this.dom.paytableModal.classList.remove('hidden');
    });
    this.dom.btnClosePaytable.addEventListener('click', () => {
      this.dom.paytableModal.classList.add('hidden');
    });

    // Cheat Drawer
    this.dom.btnToggleCheat.addEventListener('click', () => {
      this.dom.cheatDrawer.classList.toggle('hidden');
    });
    this.dom.btnCloseCheat.addEventListener('click', () => {
      this.dom.cheatDrawer.classList.add('hidden');
    });

    document.querySelectorAll('.cheat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cheatType = btn.dataset.cheat;
        this.engine.setForcedOutcome(cheatType);
        document.querySelectorAll('.cheat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dom.activeCheatStatus.textContent = `Queued Next Spin: ${btn.textContent}`;
        this.audio.playButtonClick();
      });
    });
  }

  /**
   * Wallet helpers
   */
  addTokens(amount) {
    this.setBalance(this.balance + amount);
    this.audio.playWinChime(false);
    this.renderer.addFloatingText(
      600,
      340,
      `+${this.formatCurrency(amount)} TOKENS ADDED!`,
      '#4CD964',
      42,
      1.1
    );
  }

  setBalance(newBalance) {
    this.balance = Number(Math.max(0, newBalance).toFixed(2));
    localStorage.setItem(STORAGE_KEY_BALANCE, String(this.balance));
    this.updateHUD();
  }

  stepTotalBet(direction) {
    if (this.isSpinning || this.engine.inFreeSpins) return;
    if (direction > 0) {
      if (this.coinsPerLineIndex < GAME_CONFIG.COINS_PER_LINE_OPTIONS.length - 1) {
        this.coinsPerLineIndex++;
      } else if (this.coinValueIndex < GAME_CONFIG.COIN_VALUE_OPTIONS.length - 1) {
        this.coinValueIndex++;
      }
    } else {
      if (this.coinsPerLineIndex > 0) {
        this.coinsPerLineIndex--;
      } else if (this.coinValueIndex > 0) {
        this.coinValueIndex--;
      }
    }
    this.updateHUD();
  }

  formatCurrency(val) {
    return `$${Number(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  setStatus(text) {
    this.dom.statusLine.textContent = text;
  }

  updateHUD() {
    this.renderer.currentTotalBet = this.totalBet;

    if (this.displayInCoins) {
      const coinsBalance = Math.floor(this.balance / this.coinValue);
      const coinsBet = this.coinsPerLine * GAME_CONFIG.PAYLINES_COUNT;
      this.dom.creditVal.textContent = `${coinsBalance.toLocaleString()} COINS`;
      this.dom.betVal.textContent = `${coinsBet} COINS`;
    } else {
      this.dom.creditVal.textContent = this.formatCurrency(this.balance);
      this.dom.betVal.textContent = this.formatCurrency(this.totalBet);
    }

    this.dom.cplDisplay.textContent = String(this.coinsPerLine);
    this.dom.cvDisplay.textContent = this.formatCurrency(this.coinValue);
    this.dom.totalBetPopoverDisplay.textContent = this.formatCurrency(this.totalBet);
    this.dom.buyBonusPrice.textContent = this.formatCurrency(this.buyBonusCost);

    const disableBetChange = this.isSpinning || this.engine.inFreeSpins;
    this.dom.btnBetMinus.disabled = disableBetChange;
    this.dom.btnBetPlus.disabled = disableBetChange;
    this.dom.btnBuyBonus.disabled = disableBetChange;
  }

  updateTrailUI() {
    const inFS = this.engine.inFreeSpins;
    this.dom.stage.classList.toggle('freespins-mode', inFS);
    this.renderer.setFreeSpinsMode(inFS);

    // Progress bar is ONLY visible during the Free Spins Bonus Game!
    if (this.dom.freespinsTrailBar) {
      this.dom.freespinsTrailBar.classList.toggle('hidden', !inFS);
    }
    if (this.dom.baseGameHeader) {
      this.dom.baseGameHeader.classList.toggle('hidden', inFS);
    }

    if (inFS) {
      this.dom.fsModeBadge.textContent = `FREE SPINS: ${this.engine.freeSpinsRemaining} LEFT • LEVEL ${this.engine.currentLevel} (${this.engine.currentMultiplier}×)`;
      this.dom.fsCounterText.textContent = `BONUS TOTAL WIN: ${this.formatCurrency(this.engine.freeSpinsTotalWin)} • WILDS COLLECTED: ${this.engine.wildsCollected}/12`;
    }

    // Highlight collected wild dots & milestones (1..12)
    document.querySelectorAll('[data-wild-idx]').forEach(el => {
      const idx = parseInt(el.dataset.wildIdx, 10);
      el.classList.toggle('collected', this.engine.wildsCollected >= idx);
    });

    // Pulse the next milestone when player is sitting at 3/4 wilds (1 away from retrigger!)
    const wilds = this.engine.wildsCollected;
    document.querySelectorAll('.trail-segment').forEach(seg => {
      const segLvl = parseInt(seg.dataset.level, 10);
      const isOneAway =
        inFS &&
        ((segLvl === 2 && wilds === 3) ||
          (segLvl === 3 && wilds === 7) ||
          (segLvl === 4 && wilds === 11));
      seg.classList.toggle('tension-sweat', isOneAway);
    });
  }

  /**
   * Buy Free Spins (100x Total Bet)
   */
  async executeBuyFreeSpins() {
    if (this.isSpinning || this.engine.inFreeSpins) return;
    const cost = this.buyBonusCost;
    if (this.balance < cost) {
      this.setStatus('INSUFFICIENT TOKENS FOR BUY BONUS — USE +$1,000 AT TOP!');
      this.dom.walletModal.classList.remove('hidden');
      return;
    }

    this.setBalance(this.balance - cost);
    // Force 3, 4, or 5 Scatters on this spin
    const roll = Math.random();
    const forced = roll < 0.7 ? 'SCATTER_3' : roll < 0.92 ? 'SCATTER_4' : 'SCATTER_5';
    this.engine.setForcedOutcome(forced);
    await this.triggerSpin({ isBoughtBonus: true });
  }

  /**
   * Execute a Single Spin (Base Game or Free Spin)
   */
  async triggerSpin({ isBoughtBonus = false } = {}) {
    if (this.isSpinning || !this.renderer.grid) return;

    const inFS = this.engine.inFreeSpins;

    // Deduct bet if in Base Game (and not already paid via Buy Bonus)
    if (!inFS && !isBoughtBonus) {
      if (this.balance < this.totalBet) {
        this.isAutoplay = false;
        this.dom.btnAutoplay.classList.remove('active');
        this.dom.btnAutoplay.textContent = 'AUTOPLAY';
        this.setStatus('OUT OF TOKENS! CLICK +$1,000 IN THE TOP BAR TO RELOAD.');
        this.dom.walletCurrentBalance.textContent = this.formatCurrency(this.balance);
        this.dom.walletModal.classList.remove('hidden');
        return;
      }
      this.setBalance(this.balance - this.totalBet);
    }

    if (inFS) {
      this.engine.freeSpinsRemaining = Math.max(0, this.engine.freeSpinsRemaining - 1);
      this.engine.freeSpinsTotalPlayed++;
    }

    this.isSpinning = true;
    this.dom.btnSpin.classList.add('spinning');
    this.dom.winBox.classList.add('hidden');
    this.updateHUD();
    this.updateTrailUI();

    // Clear cheat button UI highlight if one was queued
    document.querySelectorAll('.cheat-btn').forEach(b => b.classList.remove('active'));
    this.dom.activeCheatStatus.textContent = 'Active Queue: None (Normal RNG)';

    this.setStatus(inFS ? 'CASTING LINE IN FREE SPINS...' : 'GOOD LUCK!');
    this.audio.playSpinStart();

    // Evaluate spin outcome
    const result = this.engine.evaluateSpin(this.totalBet);

    // 1. Spin to initial 5x3 grid
    await this.renderer.spinToGrid(result.initialGrid, {
      turbo: this.isTurbo,
      onReelStop: (col, hasScatter) => this.audio.playReelStop(col, hasScatter)
    });

    // 2. Play any Second-Chance (2-Scatter Nudge/Hook) or Free Spins Rescue (Dynamite/Bazooka/Hook) events
    for (const ev of result.events) {
      if (ev.type === 'SECOND_CHANCE_NUDGE') {
        this.setStatus('2 SCATTERS! NUDGE & RESPIN SECOND CHANCE!');
        await this.renderer.playNudgeRespin(ev, this.totalBet, this.isTurbo);
      } else if (ev.type === 'SECOND_CHANCE_HOOK') {
        this.setStatus('2 SCATTERS! HOOK PULLING REEL FOR 3RD SCATTER!');
        await this.renderer.playHookPullAnimation(ev.col, ev.row, ev.toGrid, '🪝 HOOK SECOND CHANCE!');
      } else if (ev.type === 'RESCUE_DYNAMITE' || ev.type === 'RESCUE_BAZOOKA') {
        this.setStatus(ev.type === 'RESCUE_DYNAMITE' ? '🧨 DYNAMITE ADDING MONEY FISH!' : '🚀 BAZOOKA BLASTING MONEY FISH!');
        await this.renderer.playRescueExplosion(ev);
      } else if (ev.type === 'RESCUE_HOOK_WILD') {
        this.setStatus('🎣 HOOK PULLING FISHERMAN WILD ONTO REELS!');
        await this.renderer.playHookPullAnimation(ev.col, ev.row, ev.toGrid, '🎣 FISHERMAN HOOKED!');
      }
    }

    // 3. Highlight standard line wins
    if (result.lineWins.length > 0) {
      this.renderer.setLineWins(result.lineWins);
      this.audio.playWinChime(result.totalLineWin >= this.totalBet * 10);
    }

    // 4. Play Free Spins Fisherman Fish Money Collection & Level-Up Trail
    if (result.fishCollection) {
      if (result.fishCollection.fishes.length > 0) {
        this.setStatus(`🤠 FISHERMAN REELING IN CASH FISH (${result.fishCollection.levelMultiplier}×)!`);
      } else {
        this.setStatus(`🤠 FISHERMAN WILD ADDED TO MULTIPLIER TRAIL!`);
      }
      await this.renderer.playFishermanCollect(
        result.fishCollection,
        this.totalBet,
        val => this.formatCurrency(val),
        () => this.updateTrailUI()
      );
      this.updateTrailUI();

      if (result.fishCollection.retriggerAward) {
        const rt = result.fishCollection.retriggerAward;
        this.audio.playLevelUpFanfare();
        this.audio.startBGM('freespins', rt.newLevel);
        this.renderer.triggerScreenShake(0.45, 18);
        if (this.vfx3d) {
          this.vfx3d.spawnShockwave(0.5, 0.35, 0xffd700, 5.8);
          this.vfx3d.burstCoins(0.5, 0.42, 52, 1.3);
        }
        this.renderer.addFloatingText(
          600,
          260,
          `LEVEL ${rt.newLevel} UNLOCKED! +${rt.extraSpins} SPINS (${rt.newMultiplier}×)!`,
          '#FFD700',
          44,
          1.8
        );
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    // 5. Credit Total Win
    if (result.totalWin > 0) {
      if (inFS) {
        this.engine.freeSpinsTotalWin = Number(
          (this.engine.freeSpinsTotalWin + result.totalWin).toFixed(2)
        );
      }
      this.setBalance(this.balance + result.totalWin);
      this.dom.winAmount.textContent = this.formatCurrency(result.totalWin);
      this.dom.winBox.classList.remove('hidden');
      this.setStatus(`WIN ${this.formatCurrency(result.totalWin)}!`);
      this.updateTrailUI();

      // Show Big Win / Mega Win / Superb Win overlay if win >= 15x total bet
      const winMult = result.totalWin / this.totalBet;
      if (winMult >= 15) {
        const tierLabel =
          winMult >= 50 ? 'SUPERB WIN!' : winMult >= 30 ? 'MEGA WIN!' : 'BIG WIN!';
        await this.showCelebrationModal(
          tierLabel,
          result.totalWin,
          `${winMult.toFixed(1)}× YOUR TOTAL BET!`
        );
      }
    } else {
      this.setStatus(inFS ? `${this.engine.freeSpinsRemaining} FREE SPINS REMAINING` : 'PRESS SPIN OR SPACE TO PLAY');
    }

    this.isSpinning = false;
    this.dom.btnSpin.classList.remove('spinning');
    this.updateHUD();

    // 6. Check if Free Spins were triggered from Base Game
    if (result.freeSpinsTriggered) {
      this.isAutoplay = false;
      this.dom.btnAutoplay.classList.remove('active');
      this.dom.btnAutoplay.textContent = 'AUTOPLAY';
      await this.launchPreBonusLassoSequence(result.freeSpinsTriggered);
      return;
    }

    // 7. If inside Free Spins, continue next free spin or conclude round
    if (this.engine.inFreeSpins) {
      if (this.engine.freeSpinsRemaining > 0) {
        await new Promise(r => setTimeout(r, this.isTurbo ? 420 : 850));
        this.triggerSpin();
      } else {
        const summary = this.engine.endFreeSpins();
        this.audio.startBGM('base');
        this.dom.activeModifiersPanel.classList.add('hidden');
        this.updateTrailUI();
        this.updateHUD();
        await this.showCelebrationModal(
          'FREE SPINS COMPLETE!',
          summary.totalWin,
          `WON IN ${summary.totalSpins} FREE SPINS (REACHED LEVEL ${summary.finalLevel} • ${summary.finalMultiplier}×)`
        );
      }
      return;
    }

    // 8. Continue Autoplay if active in Base Game
    if (this.isAutoplay) {
      setTimeout(() => {
        if (this.isAutoplay && !this.isSpinning) {
          this.triggerSpin();
        }
      }, this.isTurbo ? 350 : 750);
    }
  }

  /**
   * Authentic 2-Phase Big Bass Splash Pre-Bonus Sequence:
   *  PHASE 1: Underwater sunlit sandy seabed where 5 Modifier Fish + 1 Heavy Iron Anchor swim in a
   *           3D-perspective circular ring. A cowboy rope lasso drops from above to catch awarded fish
   *           and light up the 5 left-side circular medallions — ending when the Iron Anchor is caught!
   *  PHASE 2: Classic vintage cream parchment "CONGRATULATIONS! XX FREE SPINS!" poster showcasing
   *           Fisherman Wild CATCHES Money Fish and all 5 medallions (gold = caught, silver = missed).
   */
  async launchPreBonusLassoSequence(triggerInfo) {
    this.audio.playBonusTrigger();

    // Authentic 0 to 5 modifiers rolled before the Anchor ends the catch
    const awardedModifiers = this.engine.rollPreBonusModifiers(0);
    const awardedIds = new Set(awardedModifiers.map(m => m.id));

    // Reset all left-rail & poster medallions back to silver/greyscale
    const railMedallions = Array.from(document.querySelectorAll('#lasso-medallions-rail .mod-medallion'));
    const posterMedallions = Array.from(document.querySelectorAll('#poster-medallions-row .poster-medallion'));
    railMedallions.forEach(m => m.classList.remove('awarded'));
    posterMedallions.forEach(m => m.classList.remove('awarded'));

    if (this.dom.lassoPhasePill) {
      this.dom.lassoPhasePill.textContent = `${triggerInfo.scatterCount} SCATTERS • ${triggerInfo.baseSpins} FREE SPINS`;
    }
    if (this.dom.lassoCalloutText) {
      this.dom.lassoCalloutText.textContent = 'CASTING LASSO FOR BONUS MODIFIERS...';
    }
    if (this.dom.prebonusLassoOverlay) {
      this.dom.prebonusLassoOverlay.classList.remove('hidden');
    }

    // Setup high-DPI underwater circular-swim canvas (1280x720)
    const canvas = this.dom.lassoCircleCanvas;
    const ctx = canvas ? canvas.getContext('2d') : null;
    let lassoRunning = true;

    const CX = 700;
    const CY = 468;
    const RX = 325;
    const RY = 104;

    // 5 Modifier Fish + 1 Heavy Iron Anchor swimming evenly around the 3D perspective circle
    const modOrder = ['MORE_DYNAMITE', 'START_LEVEL_2', 'EXTRA_SPINS', 'MORE_FISH', 'MORE_FISHERMAN'];
    const swimmers = [
      ...modOrder.map((id, i) => {
        const modObj = PRE_BONUS_MODIFIERS.find(m => m.id === id);
        return {
          id,
          isAnchor: false,
          label: modObj ? modObj.name : id,
          texKey: id === 'MORE_FISH' ? 'FISH_SHOAL' : id === 'START_LEVEL_2' ? 'FISH_GOLDEN' : 'FISH',
          angleOffset: (i / 6) * Math.PI * 2,
          caught: false,
          hoistProgress: 0,
          caughtX: CX,
          caughtY: CY,
          x: CX,
          y: CY,
          scale: 1
        };
      }),
      {
        id: 'ANCHOR',
        isAnchor: true,
        label: 'ANCHOR CAUGHT!',
        texKey: null,
        angleOffset: (5 / 6) * Math.PI * 2,
        caught: false,
        hoistProgress: 0,
        caughtX: CX,
        caughtY: CY,
        x: CX,
        y: CY,
        scale: 1
      }
    ];

    const splashRings = [];
    const ambientBubbles = Array.from({ length: 28 }, () => ({
      x: 120 + Math.random() * 1080,
      y: 120 + Math.random() * 580,
      r: 3 + Math.random() * 7,
      spd: 28 + Math.random() * 52,
      phase: Math.random() * Math.PI * 2
    }));

    // Active rope animation state: { mode: 'drop'|'hoist', target, progress }
    let activeLasso = null;

    // Vector renderer for the iconic heavy rusty Iron Anchor orbiting in the circle
    const drawIronAnchor = (c, scale, angleTilt = 0) => {
      c.save();
      c.scale(scale, scale);
      c.rotate(angleTilt);

      // Soft underwater shadow
      c.shadowColor = 'rgba(0, 12, 24, 0.65)';
      c.shadowBlur = 12;
      c.shadowOffsetY = 6;

      // Iron metallic gradient
      const ironGrad = c.createLinearGradient(-35, -45, 35, 45);
      ironGrad.addColorStop(0, '#9EAAB5');
      ironGrad.addColorStop(0.42, '#5E6872');
      ironGrad.addColorStop(0.75, '#7A4C32'); // subtle rusty iron patina
      ironGrad.addColorStop(1, '#2D343B');

      // Top shackle ring
      c.lineWidth = 7;
      c.strokeStyle = ironGrad;
      c.beginPath();
      c.arc(0, -40, 11, 0, Math.PI * 2);
      c.stroke();

      // Main vertical iron shank
      c.lineWidth = 11;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -28);
      c.lineTo(0, 36);
      c.stroke();

      // Horizontal anchor stock crossbar
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(-24, -14);
      c.lineTo(24, -14);
      c.stroke();

      // Curved lower anchor arms
      c.lineWidth = 10;
      c.beginPath();
      c.arc(0, 10, 32, 0.16 * Math.PI, 0.84 * Math.PI);
      c.stroke();

      // Left & right arrowhead flukes
      c.fillStyle = ironGrad;
      const drawFluke = dir => {
        c.save();
        c.translate(dir * 29, 25);
        c.rotate(dir * -0.58);
        c.beginPath();
        c.moveTo(0, -14);
        c.lineTo(dir * 13, 8);
        c.lineTo(dir * -9, 6);
        c.closePath();
        c.fill();
        c.restore();
      };
      drawFluke(-1);
      drawFluke(1);

      // Specular metallic highlight streak along shank
      c.shadowBlur = 0;
      c.lineWidth = 2.5;
      c.strokeStyle = 'rgba(235, 246, 255, 0.55)';
      c.beginPath();
      c.moveTo(-2, -24);
      c.lineTo(-2, 26);
      c.stroke();

      c.restore();
    };

    if (ctx) {
      let lastFrame = performance.now();
      const startTs = lastFrame;

      const renderCircleScene = now => {
        if (!lassoRunning) return;
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        const elapsedSec = (now - startTs) * 0.001;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // 1. Sunlit Lake Water Surface & Deep Underwater Backdrop (matching image_2.png!)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#0C6F99');
        bgGrad.addColorStop(0.22, '#068AB3');
        bgGrad.addColorStop(0.56, '#055D7F');
        bgGrad.addColorStop(0.68, '#6B5542');
        bgGrad.addColorStop(1, '#3B2314');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Bright sunlit canyon lake surface strip at very top
        const surfGrad = ctx.createLinearGradient(0, 0, 0, 72);
        surfGrad.addColorStop(0, '#FFF1C9');
        surfGrad.addColorStop(0.45, '#59D2E8');
        surfGrad.addColorStop(1, 'rgba(6, 138, 179, 0)');
        ctx.fillStyle = surfGrad;
        ctx.fillRect(0, 0, w, 72);

        // Shimmering animated waterline
        ctx.beginPath();
        ctx.moveTo(0, 44);
        for (let x = 0; x <= w; x += 24) {
          ctx.lineTo(x, 44 + Math.sin(elapsedSec * 2.4 + x * 0.025) * 4);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(220, 252, 255, 0.72)';
        ctx.stroke();

        // 2. Volumetric Sunbeams streaming down onto the sandy seabed
        ctx.save();
        for (let i = 0; i < 6; i++) {
          const rx = 260 + i * 165 + Math.sin(elapsedSec * 0.6 + i) * 28;
          const beamGrad = ctx.createLinearGradient(rx, 40, rx + 70, 580);
          beamGrad.addColorStop(0, 'rgba(200, 252, 255, 0.22)');
          beamGrad.addColorStop(0.65, 'rgba(255, 232, 165, 0.11)');
          beamGrad.addColorStop(1, 'rgba(255, 220, 130, 0)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(rx - 38, 40);
          ctx.lineTo(rx + 42, 40);
          ctx.lineTo(rx + 150, 620);
          ctx.lineTo(rx - 70, 620);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // 3. Sunlit Golden-Sandy Underwater Lake Floor (matching image_2.png!)
        const sandGrad = ctx.createRadialGradient(CX, CY + 30, 40, CX, CY + 60, 560);
        sandGrad.addColorStop(0, 'rgba(246, 198, 138, 0.92)');
        sandGrad.addColorStop(0.55, 'rgba(196, 128, 74, 0.85)');
        sandGrad.addColorStop(1, 'rgba(54, 28, 16, 0.96)');
        ctx.fillStyle = sandGrad;
        ctx.beginPath();
        ctx.ellipse(CX, CY + 95, 680, 235, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing sunlit caustic shimmer ring under the swimming fish circle
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 240, 185, 0.28)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(CX, CY + 24, RX * 0.98, RY * 0.96, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(130, 245, 255, 0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 16]);
        ctx.beginPath();
        ctx.ellipse(CX, CY + 24, RX * 0.72, RY * 0.70, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 4. Rising translucent underwater bubbles
        for (const b of ambientBubbles) {
          b.y -= b.spd * dt;
          if (b.y < 52) {
            b.y = h - 20;
            b.x = 120 + Math.random() * 1080;
          }
          const bx = b.x + Math.sin(elapsedSec * 2 + b.phase) * 8;
          ctx.beginPath();
          ctx.arc(bx, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(190, 246, 255, 0.28)';
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.stroke();
        }

        // 5. Update positions along the 3D elliptical orbit & Z-sort back-to-front!
        const orbitSpeed = 0.88;
        const drawList = [];

        for (const s of swimmers) {
          if (s.caught && s.hoistProgress >= 1) continue;

          const angle = s.angleOffset + elapsedSec * orbitSpeed;
          const depth = Math.sin(angle); // -1 (back of circle) .. +1 (front of circle)
          let sx = CX + Math.cos(angle) * RX;
          let sy = CY + depth * RY;
          let sc = 0.74 + ((depth + 1) / 2) * 0.42; // 0.74 in back -> 1.16 in front
          const swimDir = -Math.sin(angle) >= 0 ? 1 : -1;

          if (s.caught) {
            const p = s.hoistProgress;
            const ease = p * p * (3 - 2 * p);
            sx = s.caughtX + (CX - s.caughtX) * ease * 0.35;
            sy = s.caughtY + (-130 - s.caughtY) * ease;
            sc = 1.12;
          } else {
            s.caughtX = sx;
            s.caughtY = sy;
          }

          s.x = sx;
          s.y = sy;
          s.scale = sc;
          drawList.push({ swimmer: s, depth: s.caught ? 2 : depth, swimDir });
        }

        drawList.sort((a, b) => a.depth - b.depth);

        // Draw seabed shadow ellipses + swimmers back-to-front
        for (const item of drawList) {
          const { swimmer: s, swimDir } = item;

          // Ground shadow on sandy riverbed
          if (!s.caught) {
            ctx.save();
            ctx.fillStyle = 'rgba(20, 12, 6, 0.32)';
            ctx.beginPath();
            ctx.ellipse(s.x, s.y + 52 * s.scale, 46 * s.scale, 13 * s.scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.save();
          ctx.translate(s.x, s.y);

          if (s.caught) {
            ctx.rotate(Math.sin(now * (s.isAnchor ? 0.015 : 0.045)) * (s.isAnchor ? 0.14 : 0.28));
          }

          if (s.isAnchor) {
            drawIronAnchor(ctx, s.scale * 1.12, Math.sin(elapsedSec * 2) * 0.08);
          } else {
            const img = this.renderer.images[s.texKey] || this.renderer.images['FISH'];
            if (img) {
              ctx.scale(swimDir * s.scale, s.scale);
              // Subtle natural tail bob along orbit
              const bobY = Math.sin(elapsedSec * 5 + s.angleOffset) * 3;
              ctx.drawImage(img, -66, -46 + bobY, 132, 92);
            }
          }
          ctx.restore();
        }

        // 6. Draw Expanding Water Splash Rings
        for (let i = splashRings.length - 1; i >= 0; i--) {
          const sr = splashRings[i];
          sr.life += dt;
          const p = Math.min(1, sr.life / sr.maxLife);
          const rad = 18 + p * sr.maxR;
          ctx.save();
          ctx.strokeStyle = sr.color;
          ctx.globalAlpha = Math.max(0, 1 - p);
          ctx.lineWidth = 5 * (1 - p);
          ctx.beginPath();
          ctx.ellipse(sr.x, sr.y, rad, rad * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          if (sr.life >= sr.maxLife) splashRings.splice(i, 1);
        }

        // 7. Draw Authentic Cowboy Braided Rope Lasso Dropping & Snagging!
        if (activeLasso) {
          const topX = CX;
          const topY = 0;
          const tx = activeLasso.target.x;
          const ty = activeLasso.target.y;

          let curX = tx;
          let curY = ty;
          let loopRx = 48;
          let loopRy = 22;

          if (activeLasso.mode === 'drop') {
            const ease = 1 - Math.pow(1 - activeLasso.progress, 2.2);
            curX = topX + (tx - topX) * ease;
            curY = topY + (ty - topY) * ease;
            loopRx = 62 - ease * 18;
            loopRy = 28 - ease * 8;
          } else {
            // Tightly cinched around the caught fish or anchor as it hoists up!
            loopRx = 26;
            loopRy = 13;
          }

          ctx.save();
          // Rope shadow
          ctx.strokeStyle = 'rgba(40, 22, 4, 0.55)';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo((topX + curX) * 0.5 + 18, curY * 0.5, curX, curY - 6);
          ctx.stroke();

          // Braided golden-tan cowboy lasso rope
          ctx.strokeStyle = '#F2CE7E';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo((topX + curX) * 0.5 + 18, curY * 0.5, curX, curY - 6);
          ctx.stroke();

          // Lasso Loop ellipse
          ctx.strokeStyle = '#FFE48C';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(curX, curY, loopRx, loopRy, Math.sin(elapsedSec * 9) * 0.14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#9C661A';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.ellipse(curX, curY, loopRx, loopRy, Math.sin(elapsedSec * 9) * 0.14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        requestAnimationFrame(renderCircleScene);
      };
      requestAnimationFrame(renderCircleScene);
    }

    // Helper: smooth rAF tween promise
    const animateProgress = (durMs, onStep) =>
      new Promise(resolve => {
        const t0 = performance.now();
        const tick = now => {
          const p = Math.min(1, (now - t0) / durMs);
          onStep(p);
          if (p >= 1) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    // Give player 550ms to watch the fish & anchor orbiting smoothly in the sunlit circle!
    await new Promise(r => setTimeout(r, 550));

    // Cast lasso for each awarded modifier fish one by one!
    for (const mod of awardedModifiers) {
      const targetSwimmer = swimmers.find(s => s.id === mod.id);
      const targetRailMedallion = railMedallions.find(m => m.dataset.modId === mod.id);

      if (targetSwimmer) {
        this.audio.playHookPull();
        activeLasso = { mode: 'drop', target: targetSwimmer, progress: 0 };
        await animateProgress(340, p => {
          activeLasso.progress = p;
        });

        // Snag fish & splash!
        targetSwimmer.caught = true;
        targetSwimmer.hoistProgress = 0;
        activeLasso.mode = 'hoist';
        splashRings.push({ x: targetSwimmer.x, y: targetSwimmer.y, maxR: 135, life: 0, maxLife: 0.65, color: '#FFD700' });
        this.audio.playFishCollect();

        if (this.dom.lassoCalloutText) {
          this.dom.lassoCalloutText.textContent = `✨ ${mod.name}`;
        }

        await animateProgress(430, p => {
          targetSwimmer.hoistProgress = p;
        });
        activeLasso = null;

        // Illuminate the matching left-rail circular medallion in gleaming 24K gold!
        if (targetRailMedallion) {
          targetRailMedallion.classList.add('awarded');
          this.audio.playWinChime(false);
          if (this.vfx3d) {
            const rect = targetRailMedallion.getBoundingClientRect();
            const nx = (rect.left + rect.width / 2) / window.innerWidth;
            const ny = (rect.top + rect.height / 2) / window.innerHeight;
            this.vfx3d.burstCoins(nx, ny, 14, 0.9);
            this.vfx3d.spawnShockwave(nx, ny, 0xffd700, 2.5);
          }
        }
        await new Promise(r => setTimeout(r, 340));
      }
    }

    // FINAL CAST: Catch the Heavy Rusty Iron Anchor to end the modifier-catching round!
    const anchorSwimmer = swimmers.find(s => s.isAnchor);
    if (anchorSwimmer) {
      this.audio.playHookPull();
      activeLasso = { mode: 'drop', target: anchorSwimmer, progress: 0 };
      await animateProgress(360, p => {
        activeLasso.progress = p;
      });

      anchorSwimmer.caught = true;
      anchorSwimmer.hoistProgress = 0;
      activeLasso.mode = 'hoist';
      splashRings.push({ x: anchorSwimmer.x, y: anchorSwimmer.y, maxR: 165, life: 0, maxLife: 0.72, color: '#80F5FF' });
      this.audio.playAnchorClang();

      if (this.dom.lassoCalloutText) {
        this.dom.lassoCalloutText.textContent = '⚓ ANCHOR CAUGHT! STARTING BONUS...';
      }

      await animateProgress(520, p => {
        anchorSwimmer.hoistProgress = p;
      });
      activeLasso = null;
      await new Promise(r => setTimeout(r, 480));
    }

    // Close Phase 1 Underwater Circle-Swim Arena
    lassoRunning = false;
    if (this.dom.prebonusLassoOverlay) {
      this.dom.prebonusLassoOverlay.classList.add('hidden');
    }

    // =========================================================================
    // PHASE 2: Show Authentic Vintage Parchment "CONGRATULATIONS! XX FREE SPINS!" Poster
    // =========================================================================
    const totalSpins =
      triggerInfo.baseSpins + (awardedIds.has('EXTRA_SPINS') ? 2 : 0);

    if (this.dom.posterSpinsHeadline) {
      this.dom.posterSpinsHeadline.textContent = `${totalSpins} FREE SPINS!`;
    }
    posterMedallions.forEach(med => {
      med.classList.toggle('awarded', awardedIds.has(med.dataset.modId));
    });

    this.audio.playBonusTrigger();
    if (this.vfx3d) {
      this.vfx3d.burstCoins(0.24, 0.65, 18, 1.1);
      this.vfx3d.burstCoins(0.76, 0.65, 18, 1.1);
    }

    if (this.dom.bonusIntroPosterModal) {
      this.dom.bonusIntroPosterModal.classList.remove('hidden');
    }

    // Wait for player to click anywhere on the Vintage Poster or backdrop (or press Space/Enter)
    await new Promise(resolve => {
      const cleanup = () => {
        this.dom.bonusIntroPosterModal?.removeEventListener('click', onStart);
        this.dom.bonusPosterCard?.removeEventListener('click', onStart);
        this.dom.btnStartFreeSpins?.removeEventListener('click', onStart);
        window.removeEventListener('keydown', onKey);
      };
      const onStart = e => {
        e?.stopPropagation?.();
        cleanup();
        this.audio.playButtonClick();
        resolve();
      };
      const onKey = e => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          onStart();
        }
      };
      this.dom.bonusIntroPosterModal?.addEventListener('click', onStart);
      this.dom.bonusPosterCard?.addEventListener('click', onStart);
      this.dom.btnStartFreeSpins?.addEventListener('click', onStart);
      window.addEventListener('keydown', onKey);
    });

    if (this.dom.bonusIntroPosterModal) {
      this.dom.bonusIntroPosterModal.classList.add('hidden');
    }

    // Populate left sidebar with caught active modifiers during Free Spins
    if (awardedModifiers.length > 0) {
      this.dom.activeModifiersList.innerHTML = awardedModifiers
        .map(
          m => `<div class="active-mod-pill"><span>${m.icon}</span><span>${m.shortName}</span></div>`
        )
        .join('');
      this.dom.activeModifiersPanel.classList.remove('hidden');
    } else {
      this.dom.activeModifiersPanel.classList.add('hidden');
    }

    // Initialize Free Spins in engine, reveal the top Bonus Progress Bar, & start high-tempo bluegrass BGM!
    this.engine.startFreeSpins(triggerInfo.baseSpins, awardedModifiers);
    this.audio.startBGM('freespins', this.engine.currentLevel);
    this.updateTrailUI();
    this.updateHUD();

    await new Promise(r => setTimeout(r, 450));
    this.triggerSpin();
  }

  /**
   * Show Frameless AAA Big Win / Mega Win / Superb Win / Free Spins Complete Celebration
   * layered directly in front of the real-time Three.js 3D Starburst Trophy, Crown & Twin 3D Gold Coin Fountains!
   */
  showCelebrationModal(tierTitle, amount, subtext) {
    this.audio.playBonusTrigger();
    this.dom.celebrationTierBadge.textContent = tierTitle;
    this.dom.celebrationSubtext.textContent = subtext;
    this.dom.celebrationAmount.textContent = this.formatCurrency(0);

    if (this.dom.celebrationDimmer) {
      this.dom.celebrationDimmer.classList.remove('hidden');
    }
    this.dom.celebrationModal.classList.remove('hidden');

    const intensity = tierTitle.includes('SUPERB') ? 1.55 : tierTitle.includes('MEGA') ? 1.25 : 1.0;
    if (this.vfx3d) {
      this.vfx3d.startCelebration(intensity);
    }

    return new Promise(resolve => {
      let counting = amount > 0;
      let animFrameId = null;
      const startTime = performance.now();
      const countDuration = Math.min(2600, Math.max(1200, (amount / Math.max(0.1, this.totalBet)) * 32));
      let lastTickTime = 0;

      const finishCount = () => {
        counting = false;
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
        this.dom.celebrationAmount.textContent = this.formatCurrency(amount);
        this.audio.playWinChime(true);
        if (this.vfx3d) {
          this.vfx3d.burstCoins(0.5, 0.55, 36, 1.2);
        }
      };

      const stepOdometer = now => {
        if (!counting) return;
        const p = Math.min(1, (now - startTime) / countDuration);
        const eased = 1 - Math.pow(1 - p, 2.4);
        const curVal = amount * eased;
        this.dom.celebrationAmount.textContent = this.formatCurrency(curVal);

        if (now - lastTickTime > 72) {
          lastTickTime = now;
          this.audio.playCoinCountTick(p);
        }

        if (p >= 1) {
          finishCount();
        } else {
          animFrameId = requestAnimationFrame(stepOdometer);
        }
      };

      if (counting) {
        animFrameId = requestAnimationFrame(stepOdometer);
      } else {
        this.dom.celebrationAmount.textContent = this.formatCurrency(amount);
      }

      const cleanup = () => {
        this.dom.btnDismissCelebration.removeEventListener('click', dismiss);
        this.dom.celebrationModal.removeEventListener('click', dismiss);
        window.removeEventListener('keydown', onKey, true);
      };

      const dismiss = e => {
        if (e) e.stopPropagation();
        if (counting) {
          finishCount();
          return;
        }
        cleanup();
        this.audio.playButtonClick();
        this.dom.celebrationModal.classList.add('hidden');
        if (this.dom.celebrationDimmer) {
          this.dom.celebrationDimmer.classList.add('hidden');
        }
        if (this.vfx3d) {
          this.vfx3d.stopCelebration();
        }
        resolve();
      };

      const onKey = e => {
        if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          e.stopPropagation();
          if (e.repeat) return;
          dismiss();
        }
      };

      this.dom.btnDismissCelebration.addEventListener('click', dismiss);
      this.dom.celebrationModal.addEventListener('click', dismiss);
      window.addEventListener('keydown', onKey, true);
    });
  }

  /**
   * Populate Dynamic Paytable Modal calculating exact dollar payouts for the current totalBet
   */
  renderPaytableModal() {
    const bet = this.totalBet;
    this.dom.paytableCurrentBet.textContent = this.formatCurrency(bet);

    const html = Object.values(SYMBOLS)
      .map(sym => {
        const thumbHtml = sym.image
          ? `<img class="paytable-thumb" src="${sym.image}" alt="${sym.name}" />`
          : `<div class="paytable-royal-badge" style="background:${sym.secondaryColor}; color:${sym.rimColor};">${sym.label}</div>`;

        const payoutEntries = Object.entries(sym.payouts || {})
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(
            ([count, mult]) =>
              `<div><strong>${count}×</strong> — ${this.formatCurrency(mult * bet)} <em>(${mult}×)</em></div>`
          )
          .join('');

        const descHtml = sym.description
          ? `<div style="font-size:11px; color:#b3ecff; margin-top:4px;">${sym.description}</div>`
          : '';

        return `
          <div class="paytable-item">
            ${thumbHtml}
            <div class="paytable-payouts">
              <div class="paytable-sym-title">${sym.name}</div>
              ${payoutEntries}
              ${descHtml}
            </div>
          </div>
        `;
      })
      .join('');

    this.dom.paytableSymbolsGrid.innerHTML = html;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new BigBassSplashApp();
  app.init();
});
