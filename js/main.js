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
    this.setStatus(
      window.innerWidth <= 860
        ? 'PLACE YOUR BETS!'
        : 'HOLD SPACE FOR TURBO SPIN • PRESS SPIN TO FISH!'
    );
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
      hudBonusDisplay: document.getElementById('hud-bonus-display'),
      hudBonusWinValue: document.getElementById('hud-bonus-win-value'),
      hudBonusSubLabel: document.getElementById('hud-bonus-sub-label'),
      hudBonusSpinsValue: document.getElementById('hud-bonus-spins-value'),

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

      // Trail, Bonus Left Medallions Rail & Base Header (Progress belt visible ONLY in Bonus Game!)
      baseGameHeader: document.getElementById('base-game-header'),
      freespinsTrailBar: document.getElementById('freespins-trail-bar'),
      bonusMedallionsRail: document.getElementById('bonus-medallions-rail'),
      trailCometCanvas: document.getElementById('trail-comet-canvas'),

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

      // Level-Up Retrigger Parchment Poster ("EXTRA 10 FREE SPINS / ARE NOW × 2")
      bonusRetriggerModal: document.getElementById('bonus-retrigger-modal'),
      bonusRetriggerCard: document.getElementById('bonus-retrigger-card'),
      retriggerExtraSpins: document.getElementById('retrigger-extra-spins'),
      retriggerNewMult: document.getElementById('retrigger-new-mult'),

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

    // Main Spin Button (Tap to spin, or Hold 420ms on touch/mouse for Turbo Spin!)
    let spinHoldTimer = null;
    let spinHoldTriggered = false;
    const clearSpinHold = () => {
      if (spinHoldTimer) {
        clearTimeout(spinHoldTimer);
        spinHoldTimer = null;
      }
    };
    this.dom.btnSpin.addEventListener('pointerdown', () => {
      spinHoldTriggered = false;
      clearSpinHold();
      spinHoldTimer = setTimeout(() => {
        spinHoldTriggered = true;
        this.isTurbo = true;
        this.dom.btnTurbo.classList.add('active');
        this.audio.playButtonClick();
        this.triggerSpin();
      }, 420);
    });
    this.dom.btnSpin.addEventListener('pointerup', clearSpinHold);
    this.dom.btnSpin.addEventListener('pointerleave', clearSpinHold);
    this.dom.btnSpin.addEventListener('pointercancel', clearSpinHold);
    this.dom.btnSpin.addEventListener('click', () => {
      clearSpinHold();
      if (spinHoldTriggered) {
        spinHoldTriggered = false;
        return;
      }
      this.audio.playButtonClick();
      this.triggerSpin();
    });

    // Keyboard Spacebar support (Tap to spin, hold for turbo spin)
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        const blockingModalOpen =
          (this.dom.celebrationModal && !this.dom.celebrationModal.classList.contains('hidden')) ||
          (this.dom.bonusIntroPosterModal && !this.dom.bonusIntroPosterModal.classList.contains('hidden')) ||
          (this.dom.bonusRetriggerModal && !this.dom.bonusRetriggerModal.classList.contains('hidden')) ||
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

  updateTrailUI(displayedWildsOverride = null) {
    const inFS = this.engine.inFreeSpins;
    this.dom.stage.classList.toggle('freespins-mode', inFS);
    this.renderer.setFreeSpinsMode(inFS);

    // Top stitched-leather progress belt, left medallions rail, & bonus bottom HUD visible ONLY in Free Spins!
    if (this.dom.freespinsTrailBar) {
      this.dom.freespinsTrailBar.classList.toggle('hidden', !inFS);
    }
    if (this.dom.baseGameHeader) {
      this.dom.baseGameHeader.classList.toggle('hidden', inFS);
    }
    if (this.dom.bonusMedallionsRail) {
      this.dom.bonusMedallionsRail.classList.toggle('hidden', !inFS);
    }
    if (this.dom.hudBonusDisplay) {
      this.dom.hudBonusDisplay.classList.toggle('hidden', !inFS);
    }

    if (inFS) {
      if (this.dom.hudBonusWinValue) {
        this.dom.hudBonusWinValue.textContent = this.formatCurrency(this.engine.freeSpinsTotalWin);
      }
      if (this.dom.hudBonusSubLabel) {
        this.dom.hudBonusSubLabel.textContent = 'FREE SPINS LEFT';
      }
      if (this.dom.hudBonusSpinsValue) {
        this.dom.hudBonusSpinsValue.textContent = String(this.engine.freeSpinsRemaining);
      }
    }

    const shownWilds =
      displayedWildsOverride !== null ? displayedWildsOverride : this.engine.wildsCollected;

    // Highlight collected fisherman portraits & milestone badges (1..12) on the stitched leather belt
    document.querySelectorAll('#freespins-trail-bar [data-wild-idx]').forEach(el => {
      const idx = parseInt(el.dataset.wildIdx, 10);
      el.classList.toggle('collected', shownWilds >= idx);
    });

    // Pulse the next milestone tile when player sits at 3/4 wilds (3, 7, or 11 collected)
    document.querySelectorAll('#freespins-trail-bar .belt-milestone[data-milestone-level]').forEach(ms => {
      const lvl = parseInt(ms.dataset.milestoneLevel, 10);
      const isOneAway =
        inFS &&
        ((lvl === 2 && shownWilds === 3) ||
          (lvl === 3 && shownWilds === 7) ||
          (lvl === 4 && shownWilds === 11));
      ms.classList.toggle('tension-sweat', isOneAway);
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
    const preSpinWilds = this.engine.wildsCollected;
    this.updateHUD();
    this.updateTrailUI(preSpinWilds);

    // Clear cheat button UI highlight if one was queued
    document.querySelectorAll('.cheat-btn').forEach(b => b.classList.remove('active'));
    this.dom.activeCheatStatus.textContent = 'Active Queue: None (Normal RNG)';

    if (!inFS) {
      this.setStatus('GOOD LUCK!');
    }
    this.audio.playSpinStart();

    // Evaluate spin outcome (note: wildsCollected is advanced inside engine, but UI stays at preSpinWilds until orbs land!)
    const result = this.engine.evaluateSpin(this.totalBet);
    let alreadyCreditedThisSpin = 0;

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
        await this.renderer.playRescueExplosion(ev);
      } else if (ev.type === 'RESCUE_HOOK_WILD') {
        await this.renderer.playHookPullAnimation(ev.col, ev.row, ev.toGrid, '🎣 FISHERMAN HOOKED!');
      }
    }

    // 3. Highlight standard line wins & credit live during Free Spins
    if (result.lineWins.length > 0) {
      this.renderer.setLineWins(result.lineWins);
      this.audio.playWinChime(result.totalLineWin >= this.totalBet * 10);
      if (inFS && result.totalLineWin > 0) {
        const lineCredit = Math.min(result.totalLineWin, result.totalWin);
        alreadyCreditedThisSpin = Number((alreadyCreditedThisSpin + lineCredit).toFixed(2));
        this.engine.freeSpinsTotalWin = Number(
          (this.engine.freeSpinsTotalWin + lineCredit).toFixed(2)
        );
        this.setBalance(this.balance + lineCredit);
        this.updateTrailUI(preSpinWilds);
      }
    }

    // 4. Play Authentic Two-Step Free Spins Fisherman Collection (Collect Fish -> Apply x2/x3/x10 -> Option 1B Ghost Trail Comet to Belt)
    if (result.fishCollection) {
      let displayedWilds = preSpinWilds;
      await this.renderer.playFishermanCollect(
        result.fishCollection,
        this.totalBet,
        val => this.formatCurrency(val),
        async (slotIdx, originInfo) => {
          await this.playFishermanCometToBelt(originInfo, slotIdx, () => {
            displayedWilds = slotIdx;
            this.updateTrailUI(displayedWilds);
            const targetSlotEl = document.querySelector(
              `#freespins-trail-bar [data-wild-idx="${slotIdx}"]`
            );
            if (targetSlotEl) {
              targetSlotEl.classList.remove('slot-slam-pop');
              void targetSlotEl.offsetWidth;
              targetSlotEl.classList.add('slot-slam-pop');
              setTimeout(() => targetSlotEl.classList.remove('slot-slam-pop'), 500);
            }
            if (slotIdx === 4 || slotIdx === 8 || slotIdx === 12) {
              this.audio.playLevelUpFanfare();
              if (this.vfx3d && targetSlotEl) {
                const r = targetSlotEl.getBoundingClientRect();
                const nx = (r.left + r.width / 2) / window.innerWidth;
                const ny = (r.top + r.height / 2) / window.innerHeight;
                this.vfx3d.spawnShockwave(nx, ny, 0xffd700, 4.2);
                this.vfx3d.burstCoins(nx, ny, 28, 1.05);
              }
            }
          });
        },
        fishermanWin => {
          const remainingCap = Math.max(0, Number((result.totalWin - alreadyCreditedThisSpin).toFixed(2)));
          const creditNow = Math.min(fishermanWin, remainingCap);
          if (creditNow > 0) {
            alreadyCreditedThisSpin = Number((alreadyCreditedThisSpin + creditNow).toFixed(2));
            if (inFS) {
              this.engine.freeSpinsTotalWin = Number(
                (this.engine.freeSpinsTotalWin + creditNow).toFixed(2)
              );
            }
            this.setBalance(this.balance + creditNow);
            this.updateTrailUI(displayedWilds);
          }
        }
      );
      this.updateTrailUI();
    }

    // 5. Credit any remaining win balance (Base Game or rounding delta)
    if (result.totalWin > 0) {
      const remainingCredit = Number((result.totalWin - alreadyCreditedThisSpin).toFixed(2));
      if (remainingCredit > 0) {
        if (inFS) {
          this.engine.freeSpinsTotalWin = Number(
            (this.engine.freeSpinsTotalWin + remainingCredit).toFixed(2)
          );
        }
        this.setBalance(this.balance + remainingCredit);
      }
      if (!inFS) {
        this.dom.winAmount.textContent = this.formatCurrency(result.totalWin);
        this.dom.winBox.classList.remove('hidden');
        this.setStatus(`WIN ${this.formatCurrency(result.totalWin)}!`);
      }
      this.updateTrailUI();

      // Show Big Win / Mega Win / Superb Win overlay if win >= 15x total bet (NO "X× TOTAL BET" label!)
      const winMult = result.totalWin / this.totalBet;
      if (winMult >= 15) {
        const tierLabel =
          winMult >= 50 ? 'SUPERB WIN!' : winMult >= 30 ? 'MEGA WIN!' : 'BIG WIN!';
        const subLabel =
          winMult >= 50 ? 'MONSTER CATCH!' : winMult >= 30 ? 'HUGE CATCH!' : 'GREAT CATCH!';
        await this.showCelebrationModal(tierLabel, result.totalWin, subLabel);
      }
    } else if (!inFS) {
      this.setStatus('PRESS SPIN OR SPACE TO PLAY');
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

    // 7. If inside Free Spins: finish current level's spins -> check delayed Level-Up Retrigger -> or conclude bonus!
    if (this.engine.inFreeSpins) {
      if (this.engine.freeSpinsRemaining > 0) {
        await new Promise(r => setTimeout(r, this.isTurbo ? 420 : 850));
        this.triggerSpin();
      } else {
        // Authentic Big Bass Splash Delayed Level-Up:
        // Only now that all spins of the current level have reached 0, check if the next level was unlocked!
        this.updateTrailUI(); // Ensures bottom HUD cleanly shows "FREE SPINS LEFT 0"
        const retrigger = this.engine.advancePendingRetrigger();
        if (retrigger) {
          // Keep bottom bar visibly showing 0 spins left while the Congratulations parchment modal is open
          if (this.dom.hudBonusSpinsValue) {
            this.dom.hudBonusSpinsValue.textContent = '0';
          }
          await this.showRetriggerModal(retrigger);
          this.audio.startBGM('freespins', retrigger.newLevel);
          this.updateTrailUI();
          this.updateHUD();
          await new Promise(r => setTimeout(r, 420));
          this.triggerSpin();
        } else {
          const summary = this.engine.endFreeSpins();
          this.audio.startBGM('base');
          this.updateTrailUI();
          this.updateHUD();
          await this.showCelebrationModal(
            'FREE SPINS COMPLETE!',
            summary.totalWin,
            `WON IN ${summary.totalSpins} FREE SPINS!`
          );
        }
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
   * OPTION 1B: Ghost Trail Comet Fisherman → Top Stitched-Leather Progress Belt
   * Renders at 60 FPS on full-viewport #trail-comet-canvas so the clean Fisherman portrait
   * lifts directly off his reel cell, sweeps upward along a glowing S-curve leaving 5 golden
   * after-image clones & comet sparks behind him, and slams straight into the exact leather belt slot!
   */
  playFishermanCometToBelt(originInfo, targetSlotIdx, onImpact = null) {
    const canvas = this.dom.trailCometCanvas;
    const slotEl = document.querySelector(`#freespins-trail-bar [data-wild-idx="${targetSlotIdx}"]`);
    const fishermanImg = this.renderer.images['WILD_BONUS'] || this.renderer.images['WILD'];

    if (!canvas || !slotEl || !originInfo) {
      this.audio.playBeltSlotSlam(targetSlotIdx);
      if (onImpact) onImpact();
      return Promise.resolve();
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.audio.playBeltSlotSlam(targetSlotIdx);
      if (onImpact) onImpact();
      return Promise.resolve();
    }

    const slotRect = slotEl.getBoundingClientRect();
    const startX = originInfo.clientX;
    const startY = originInfo.clientY;
    const startSize = Math.max(76, Math.min(148, originInfo.tileSize || 110));
    const endX = slotRect.left + slotRect.width / 2;
    const endY = slotRect.top + slotRect.height / 2;
    const endSize = Math.max(44, Math.min(68, Math.max(slotRect.width, slotRect.height)));

    // Sweeping golden S-curve Bezier control points (works both upward on Desktop and downward on Mobile Portrait!)
    const dx = endX - startX;
    const dy = endY - startY;
    const bendSign = dx >= 0 ? -1 : 1;
    const horizSpread = Math.min(vw * 0.24, Math.max(52, Math.abs(dx) * 0.35));
    const cp1X = startX + dx * 0.22 + bendSign * horizSpread;
    const cp1Y = dy < 0
      ? startY - Math.max(56, Math.abs(dy) * 0.28)
      : startY - Math.min(54, Math.max(26, Math.abs(dy) * 0.22));
    const cp2X = endX - dx * 0.14 - bendSign * Math.min(44, horizSpread * 0.45);
    const cp2Y = dy < 0
      ? endY + Math.max(36, Math.abs(dy) * 0.34)
      : endY - Math.max(28, Math.abs(dy) * 0.34);

    const cubicAt = u => {
      const m = 1 - u;
      return {
        x: m * m * m * startX + 3 * m * m * u * cp1X + 3 * m * u * u * cp2X + u * u * u * endX,
        y: m * m * m * startY + 3 * m * m * u * cp1Y + 3 * m * u * u * cp2Y + u * u * u * endY
      };
    };

    const flightDur = this.isTurbo ? 680 : 880;
    const impactDur = 380;
    const sparks = [];
    let impactFired = false;

    this.audio.playFishermanCometWhoosh();

    return new Promise(resolve => {
      let t0 = null;

      const drawPortrait = (x, y, sz, alpha, tilt = 0, goldenAura = false) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.globalAlpha = alpha;
        if (goldenAura) {
          const glow = ctx.createRadialGradient(0, 0, sz * 0.12, 0, 0, sz * 0.78);
          glow.addColorStop(0, 'rgba(255, 232, 112, 0.85)');
          glow.addColorStop(0.55, 'rgba(255, 174, 20, 0.42)');
          glow.addColorStop(1, 'rgba(255, 140, 0, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.78, 0, Math.PI * 2);
          ctx.fill();
        }
        if (fishermanImg && fishermanImg.complete) {
          ctx.drawImage(fishermanImg, -sz / 2, -sz / 2, sz, sz);
        }
        ctx.restore();
      };

      const step = now => {
        if (t0 === null) t0 = now;
        const elapsed = Math.max(0, now - t0);
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, vw, vh);

        if (elapsed < flightDur) {
          const p = Math.min(1, elapsed / flightDur);
          // Smooth accelerate-into-slam curve
          const ease = p < 0.42 ? 2.1 * p * p : 1 - Math.pow(1 - p, 2.35);
          const cur = cubicAt(ease);

          // 1. Luminous golden comet tail ribbon behind the Fisherman
          ctx.save();
          ctx.lineCap = 'round';
          for (let seg = 14; seg >= 1; seg--) {
            const u0 = Math.max(0, ease - seg * 0.026);
            const u1 = Math.max(0, ease - (seg - 1) * 0.026);
            if (u1 <= u0) continue;
            const a = cubicAt(u0);
            const b = cubicAt(u1);
            const fade = 1 - seg / 15;
            ctx.strokeStyle = seg % 2 === 0 ? `rgba(255, 240, 148, ${fade * 0.65})` : `rgba(255, 178, 28, ${fade * 0.55})`;
            ctx.lineWidth = Math.max(2, fade * 26);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          ctx.restore();

          // 2. Spawn continuous sparkling comet flecks
          for (let s = 0; s < 2; s++) {
            sparks.push({
              x: cur.x + (Math.random() - 0.5) * 26,
              y: cur.y + (Math.random() - 0.5) * 26,
              vx: (Math.random() - 0.5) * 95,
              vy: (Math.random() - 0.5) * 95 + 22,
              r: 2.2 + Math.random() * 3.8,
              life: 0,
              maxLife: 0.34 + Math.random() * 0.24,
              color: Math.random() < 0.5 ? '#FFF8C4' : '#FFB800'
            });
          }

          // 3. Draw 5 translucent golden ghost after-image Fisherman clones trailing along the S-curve!
          for (let g = 5; g >= 1; g--) {
            const gu = Math.max(0, ease - g * 0.072);
            const gp = cubicAt(gu);
            const gSize = startSize + (endSize - startSize) * gu;
            const gAlpha = (6 - g) * 0.095;
            drawPortrait(gp.x, gp.y, gSize * (0.96 - g * 0.02), gAlpha, Math.sin(gu * Math.PI) * -0.14, true);
          }

          // 4. Draw Lead Crisp Fisherman Portrait with golden comet halo
          const leadSize = startSize + (endSize - startSize) * ease;
          const leadTilt = Math.sin(p * Math.PI) * (dx >= 0 ? 0.14 : -0.14);
          drawPortrait(cur.x, cur.y, leadSize, 1, leadTilt, true);
        } else {
          // Trigger impact callback & climbing leather-slam chime at the exact arrival moment!
          if (!impactFired) {
            impactFired = true;
            this.audio.playBeltSlotSlam(targetSlotIdx);
            if (onImpact) onImpact();
            for (let k = 0; k < 16; k++) {
              const ang = (k / 16) * Math.PI * 2 + Math.random() * 0.2;
              const spd = 95 + Math.random() * 145;
              sparks.push({
                x: endX,
                y: endY,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                r: 2.5 + Math.random() * 3.5,
                life: 0,
                maxLife: 0.36,
                color: k % 2 === 0 ? '#FFF9CC' : '#FFD000'
              });
            }
          }

          const ip = Math.min(1, (elapsed - flightDur) / impactDur);
          // Expanding 24K gold shockwave ring centered right on the landed belt slot!
          ctx.save();
          ctx.strokeStyle = '#FFE875';
          ctx.globalAlpha = Math.max(0, 1 - ip);
          ctx.lineWidth = 5 * (1 - ip);
          ctx.beginPath();
          ctx.arc(endX, endY, 16 + ip * 58, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#FFFFFF';
          ctx.globalAlpha = Math.max(0, (1 - ip) * 0.7);
          ctx.lineWidth = 2.5 * (1 - ip);
          ctx.beginPath();
          ctx.arc(endX, endY, 10 + ip * 38, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Update & draw golden comet + impact sparkle particles
        const dt = 0.016;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const sp = sparks[i];
          sp.life += dt;
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          const a = Math.max(0, 1 - sp.life / sp.maxLife);
          if (a <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r * a, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();

        if (elapsed < flightDur + impactDur) {
          requestAnimationFrame(step);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
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

    // Setup high-DPI underwater circular-swim canvas (Portrait 720x940 on mobile phones, Landscape 1280x720 on desktop!)
    const canvas = this.dom.lassoCircleCanvas;
    const isPortraitMobile = window.innerHeight > window.innerWidth && window.innerWidth <= 860;
    if (canvas) {
      canvas.width = isPortraitMobile ? 720 : 1280;
      canvas.height = isPortraitMobile ? 940 : 720;
    }
    const ctx = canvas ? canvas.getContext('2d') : null;
    let lassoRunning = true;

    const canvasW = canvas ? canvas.width : 1280;
    const canvasH = canvas ? canvas.height : 720;
    const CX = isPortraitMobile ? canvasW * 0.5 : 700;
    const CY = isPortraitMobile ? canvasH * 0.60 : 468;
    const RX = isPortraitMobile ? canvasW * 0.36 : 325;
    const RY = isPortraitMobile ? canvasH * 0.13 : 104;

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
      x: canvasW * 0.08 + Math.random() * canvasW * 0.84,
      y: canvasH * 0.12 + Math.random() * canvasH * 0.80,
      r: 3 + Math.random() * 7,
      spd: 28 + Math.random() * 52,
      phase: Math.random() * Math.PI * 2
    }));

    // Active rope animation state: { mode: 'twirl'|'tease'|'drop'|'tug'|'hoist', target, progress }
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
        const beamCount = isPortraitMobile ? 4 : 6;
        for (let i = 0; i < beamCount; i++) {
          const rx = w * (0.14 + (i / Math.max(1, beamCount - 1)) * 0.72) + Math.sin(elapsedSec * 0.6 + i) * 26;
          const beamGrad = ctx.createLinearGradient(rx, 40, rx + 70, h * 0.85);
          beamGrad.addColorStop(0, 'rgba(200, 252, 255, 0.22)');
          beamGrad.addColorStop(0.65, 'rgba(255, 232, 165, 0.11)');
          beamGrad.addColorStop(1, 'rgba(255, 220, 130, 0)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(rx - 38, 40);
          ctx.lineTo(rx + 42, 40);
          ctx.lineTo(rx + 145, h * 0.88);
          ctx.lineTo(rx - 68, h * 0.88);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // 3. Sunlit Golden-Sandy Underwater Lake Floor
        const sandRadius = isPortraitMobile ? w * 0.76 : 560;
        const sandGrad = ctx.createRadialGradient(CX, CY + 30, 40, CX, CY + 60, sandRadius);
        sandGrad.addColorStop(0, 'rgba(246, 198, 138, 0.92)');
        sandGrad.addColorStop(0.55, 'rgba(196, 128, 74, 0.85)');
        sandGrad.addColorStop(1, 'rgba(54, 28, 16, 0.96)');
        ctx.fillStyle = sandGrad;
        ctx.beginPath();
        ctx.ellipse(CX, CY + (isPortraitMobile ? 115 : 95), isPortraitMobile ? w * 0.78 : 680, isPortraitMobile ? h * 0.34 : 235, 0, 0, Math.PI * 2);
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
            b.x = w * 0.08 + Math.random() * w * 0.84;
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
        const orbitSpeed = 0.96;
        const drawList = [];

        for (const s of swimmers) {
          if (s.caught && s.hoistProgress >= 1) continue;

          // Smooth extra angular burst when a fish darts away during a dramatic near-miss!
          if (!s.dartOffset) s.dartOffset = 0;
          if (s.dartVelocity && s.dartVelocity > 0.01) {
            s.dartOffset += s.dartVelocity * dt;
            s.dartVelocity *= Math.pow(0.08, dt);
          }

          const angle = s.angleOffset + elapsedSec * orbitSpeed + s.dartOffset;
          const depth = Math.sin(angle); // -1 (back of circle) .. +1 (front of circle)
          let sx = CX + Math.cos(angle) * RX;
          let sy = CY + depth * RY;
          const sizeBoost = isPortraitMobile ? 1.12 : 1.0;
          let sc = (0.74 + ((depth + 1) / 2) * 0.42) * sizeBoost;
          const swimDir = -Math.sin(angle) >= 0 ? 1 : -1;

          if (s.tugging) {
            // Vigorous tug-of-war struggle right on the seabed before breaking free!
            const amp = s.isAnchor ? 6 : 12;
            sx = s.caughtX + Math.sin(now * (s.isAnchor ? 0.032 : 0.068)) * amp;
            sy = s.caughtY + Math.cos(now * 0.05) * (s.isAnchor ? 4 : 8) - (s.tugLift || 0) * 28;
            sc = 1.12 * sizeBoost;
          } else if (s.caught) {
            const p = s.hoistProgress;
            const ease = p * p * (3 - 2 * p);
            sx = s.caughtX + (CX - s.caughtX) * ease * 0.35;
            sy = s.caughtY + (-130 - s.caughtY) * ease;
            sc = 1.12 * sizeBoost;
          } else {
            s.caughtX = sx;
            s.caughtY = sy;
          }

          s.x = sx;
          s.y = sy;
          s.scale = sc;
          drawList.push({ swimmer: s, depth: s.caught || s.tugging ? 2 : depth, swimDir });
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

          if (s.tugging || s.caught) {
            ctx.rotate(
              Math.sin(now * (s.isAnchor ? 0.022 : 0.058)) * (s.isAnchor ? 0.19 : 0.34)
            );
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

        // 7. Draw Dramatic Cowboy Braided Rope Lasso (Twirling -> Tease Dip -> Drop -> Tug-of-War -> Hoist!)
        if (activeLasso) {
          const topX = CX;
          const topY = 0;
          const twirlRx = isPortraitMobile ? w * 0.25 : 215;
          const twirlYBase = isPortraitMobile ? h * 0.24 : 175;
          const twirlX = CX + Math.cos(elapsedSec * 2.9) * twirlRx;
          const twirlY = twirlYBase + Math.sin(elapsedSec * 3.4) * 34;

          let curX = twirlX;
          let curY = twirlY;
          let loopRx = 62;
          let loopRy = 26;
          let ropeBow = 20;

          if (activeLasso.mode === 'twirl') {
            curX = twirlX;
            curY = twirlY;
            loopRx = 66 + Math.sin(elapsedSec * 6) * 6;
            loopRy = 26 + Math.cos(elapsedSec * 6) * 4;
          } else if (activeLasso.mode === 'tease') {
            // Sweeps down dramatically toward a fish, hovers inches above it, then recoils back up!
            const dip = Math.sin(activeLasso.progress * Math.PI);
            const tx = activeLasso.target.x;
            const ty = activeLasso.target.y - 34;
            curX = twirlX + (tx - twirlX) * dip;
            curY = twirlY + (ty - twirlY) * dip;
            loopRx = 66 - dip * 22;
            loopRy = 26 - dip * 8;
          } else if (activeLasso.mode === 'drop') {
            const ease = 1 - Math.pow(1 - activeLasso.progress, 2.2);
            const sx0 = activeLasso.startX ?? twirlX;
            const sy0 = activeLasso.startY ?? twirlY;
            curX = sx0 + (activeLasso.target.x - sx0) * ease;
            curY = sy0 + (activeLasso.target.y - sy0) * ease;
            loopRx = 64 - ease * 28;
            loopRy = 26 - ease * 11;
          } else if (activeLasso.mode === 'tug') {
            // Razor-taut vibrating rope locked around thrashing fish or heavy anchor!
            curX = activeLasso.target.x;
            curY = activeLasso.target.y;
            loopRx = 28;
            loopRy = 14;
            ropeBow = Math.sin(now * 0.09) * 5;
          } else {
            // Tightly cinched hoist out of the sunlit lake!
            curX = activeLasso.target.x;
            curY = activeLasso.target.y;
            loopRx = 26;
            loopRy = 13;
            ropeBow = 6;
          }

          activeLasso.lastX = curX;
          activeLasso.lastY = curY;

          ctx.save();
          // Rope shadow
          ctx.strokeStyle = 'rgba(40, 22, 4, 0.55)';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo((topX + curX) * 0.5 + ropeBow, curY * 0.5, curX, curY - 6);
          ctx.stroke();

          // Braided golden-tan cowboy lasso rope
          ctx.strokeStyle = activeLasso.mode === 'tug' ? '#FFF0A8' : '#F2CE7E';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo((topX + curX) * 0.5 + ropeBow, curY * 0.5, curX, curY - 6);
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

    // Helper: Dramatic Near-Miss Tease (lasso dips down toward a fish -> fish darts away at last split-second!)
    const performNearMissTease = async (teaseSwimmer, dipCallout, missCallout) => {
      if (!teaseSwimmer) return;
      if (this.dom.lassoCalloutText) {
        this.dom.lassoCalloutText.textContent = dipCallout;
      }
      this.audio.playHookPull();
      activeLasso = { mode: 'tease', target: teaseSwimmer, progress: 0 };
      let darted = false;
      await animateProgress(1050, p => {
        activeLasso.progress = p;
        if (p >= 0.48 && !darted) {
          darted = true;
          teaseSwimmer.dartVelocity = 3.2; // Fish darts forward just out of the lasso loop!
          splashRings.push({
            x: teaseSwimmer.x,
            y: teaseSwimmer.y,
            maxR: 120,
            life: 0,
            maxLife: 0.58,
            color: '#80F5FF'
          });
          this.audio.playLassoNearMiss();
          if (this.dom.lassoCalloutText) {
            this.dom.lassoCalloutText.textContent = missCallout;
          }
        }
      });
      activeLasso = { mode: 'twirl', progress: 0 };
      await new Promise(r => setTimeout(r, 420));
    };

    const getUncaughtNonAwardedFish = () =>
      swimmers.filter(s => !s.isAnchor && !s.caught && !awardedIds.has(s.id));

    // OPENING SUSPENSE: Overhead cowboy lasso twirls above the orbiting fish & anchor (~1.25s)
    activeLasso = { mode: 'twirl', progress: 0 };
    if (this.dom.lassoCalloutText) {
      this.dom.lassoCalloutText.textContent = '🤠 SPINNING LASSO — SCANNING THE LAKE...';
    }
    await new Promise(r => setTimeout(r, 1250));

    // If 0 modifiers were rolled (Anchor-first!), create thrilling suspense with 2 near-miss fish dips first!
    if (awardedModifiers.length === 0) {
      const fishPool = swimmers.filter(s => !s.isAnchor);
      if (fishPool[0]) {
        await performNearMissTease(
          fishPool[0],
          '🎯 DIPPING FOR A BONUS MODIFIER...',
          '😮 SO CLOSE! FISH SLIPPED AWAY!'
        );
      }
      if (fishPool[2]) {
        await performNearMissTease(
          fishPool[2],
          '🎯 GOING FOR THE GOLDEN BASS...',
          '💨 ANOTHER NEAR MISS! WATCH THE ANCHOR!'
        );
      }
    }

    // Cast lasso dramatically for each awarded modifier fish (drop -> tug-of-war -> hoist -> gold medallion!)
    for (let mIdx = 0; mIdx < awardedModifiers.length; mIdx++) {
      const mod = awardedModifiers[mIdx];
      const targetSwimmer = swimmers.find(s => s.id === mod.id);
      const targetRailMedallion = railMedallions.find(m => m.dataset.modId === mod.id);

      // Optional mid-sequence near-miss tease before 2nd catch for authentic Pragmatic Play suspense
      if (mIdx === 1) {
        const decoys = getUncaughtNonAwardedFish();
        if (decoys.length > 0) {
          await performNearMissTease(
            decoys[0],
            '🎯 GOING FOR ANOTHER BONUS...',
            '😮 SLIPPED FREE — CASTING AGAIN!'
          );
        }
      }

      if (targetSwimmer) {
        if (this.dom.lassoCalloutText) {
          this.dom.lassoCalloutText.textContent =
            mIdx === 0 ? '🎯 LOCKED ON! CASTING LASSO...' : '🎯 CASTING FOR ANOTHER BONUS...';
        }
        this.audio.playHookPull();
        activeLasso = {
          mode: 'drop',
          target: targetSwimmer,
          startX: activeLasso?.lastX ?? CX,
          startY: activeLasso?.lastY ?? 175,
          progress: 0
        };
        await animateProgress(520, p => {
          activeLasso.progress = p;
        });

        // TUG-OF-WAR STRUGGLE (520ms): Fish hooks & thrashes taut against the rope!
        targetSwimmer.tugging = true;
        targetSwimmer.tugLift = 0;
        activeLasso.mode = 'tug';
        splashRings.push({
          x: targetSwimmer.x,
          y: targetSwimmer.y,
          maxR: 130,
          life: 0,
          maxLife: 0.65,
          color: '#80F5FF'
        });
        this.audio.playLassoTensionCreak();
        if (this.dom.lassoCalloutText) {
          this.dom.lassoCalloutText.textContent = '🔥 HOOKED A BONUS! REELING IT IN...';
        }
        await animateProgress(520, p => {
          targetSwimmer.tugLift = p;
          if (Math.random() < 0.14) {
            splashRings.push({
              x: targetSwimmer.x,
              y: targetSwimmer.y,
              maxR: 95,
              life: 0,
              maxLife: 0.45,
              color: '#FFD700'
            });
          }
        });

        // HOIST OUT OF THE LAKE!
        targetSwimmer.tugging = false;
        targetSwimmer.caught = true;
        targetSwimmer.hoistProgress = 0;
        activeLasso.mode = 'hoist';
        splashRings.push({
          x: targetSwimmer.x,
          y: targetSwimmer.y,
          maxR: 165,
          life: 0,
          maxLife: 0.72,
          color: '#FFD700'
        });
        this.audio.playFishCollect();

        if (this.dom.lassoCalloutText) {
          this.dom.lassoCalloutText.textContent = `✨ ${mod.name}`;
        }

        await animateProgress(560, p => {
          targetSwimmer.hoistProgress = p;
        });

        // Illuminate the matching left-rail circular medallion in gleaming 24K gold!
        if (targetRailMedallion) {
          targetRailMedallion.classList.add('awarded');
          this.audio.playWinChime(false);
          if (this.vfx3d) {
            const rect = targetRailMedallion.getBoundingClientRect();
            const nx = (rect.left + rect.width / 2) / window.innerWidth;
            const ny = (rect.top + rect.height / 2) / window.innerHeight;
            this.vfx3d.burstCoins(nx, ny, 16, 0.95);
            this.vfx3d.spawnShockwave(nx, ny, 0xffd700, 2.8);
          }
        }

        // Return lasso to overhead twirl while player savors the caught bonus
        activeLasso = { mode: 'twirl', progress: 0 };
        await new Promise(r => setTimeout(r, 620));
      }
    }

    // FINAL DRAMATIC CLIMAX: One tense overhead twirl (+ optional last near-miss) -> Heavy Iron Anchor!
    const anchorSwimmer = swimmers.find(s => s.isAnchor);
    if (anchorSwimmer) {
      if (awardedModifiers.length > 0) {
        const remainingFish = getUncaughtNonAwardedFish();
        if (remainingFish.length > 0 && awardedModifiers.length <= 2) {
          await performNearMissTease(
            remainingFish[remainingFish.length - 1],
            '🤠 ONE MORE CAST... CAN WE GET ANOTHER?',
            '😮 JUST MISSED! WATCH OUT FOR THE ANCHOR!'
          );
        } else {
          if (this.dom.lassoCalloutText) {
            this.dom.lassoCalloutText.textContent = '🤠 CASTING ONE MORE TIME...';
          }
          await new Promise(r => setTimeout(r, 700));
        }
      }

      if (this.dom.lassoCalloutText) {
        this.dom.lassoCalloutText.textContent = '⚠️ UH OH... WATCH THE ANCHOR!';
      }
      this.audio.playHookPull();
      activeLasso = {
        mode: 'drop',
        target: anchorSwimmer,
        startX: activeLasso?.lastX ?? CX,
        startY: activeLasso?.lastY ?? 175,
        progress: 0
      };
      await animateProgress(560, p => {
        activeLasso.progress = p;
      });

      // HEAVY ANCHOR TUG-OF-WAR (680ms) + IRON CLANG!
      anchorSwimmer.tugging = true;
      anchorSwimmer.tugLift = 0;
      activeLasso.mode = 'tug';
      splashRings.push({
        x: anchorSwimmer.x,
        y: anchorSwimmer.y,
        maxR: 175,
        life: 0,
        maxLife: 0.78,
        color: '#80F5FF'
      });
      this.audio.playAnchorClang();
      if (this.dom.lassoCalloutText) {
        this.dom.lassoCalloutText.textContent = '⚓ HEAVY IRON ANCHOR HOOKED!';
      }
      await animateProgress(680, p => {
        anchorSwimmer.tugLift = p;
      });

      // SLOW HEAVY HEAVE OUT OF THE WATER!
      anchorSwimmer.tugging = false;
      anchorSwimmer.caught = true;
      anchorSwimmer.hoistProgress = 0;
      activeLasso.mode = 'hoist';
      if (this.dom.lassoCalloutText) {
        this.dom.lassoCalloutText.textContent = '⚓ ANCHOR CAUGHT! STARTING BONUS...';
      }
      await animateProgress(680, p => {
        anchorSwimmer.hoistProgress = p;
      });
      activeLasso = null;
      await new Promise(r => setTimeout(r, 620));
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

    // Sync left vertical circular modifier medallions rail for the Free Spins bonus round
    document.querySelectorAll('#bonus-medallions-rail .bonus-rail-medallion').forEach(med => {
      med.classList.toggle('awarded', awardedIds.has(med.dataset.modId));
    });

    // Initialize Free Spins in engine, reveal the top stitched-leather belt & bonus bottom HUD, & start bluegrass BGM!
    this.engine.startFreeSpins(triggerInfo.baseSpins, awardedModifiers);
    this.audio.startBGM('freespins', this.engine.currentLevel);
    this.updateTrailUI();
    this.updateHUD();

    await new Promise(r => setTimeout(r, 450));
    this.triggerSpin();
  }

  /**
   * Show Authentic Level-Up Retrigger Vintage Parchment Screen:
   * "CONGRATULATIONS! / EXTRA 10 FREE SPINS / [Fisherman] / ARE NOW × 2"
   * Resolves on click anywhere OR Space/Enter!
   */
  showRetriggerModal(retrigger) {
    this.audio.playLevelUpFanfare();
    if (this.dom.retriggerExtraSpins) {
      this.dom.retriggerExtraSpins.textContent = String(retrigger.extraSpins);
    }
    if (this.dom.retriggerNewMult) {
      this.dom.retriggerNewMult.textContent = `× ${retrigger.newMultiplier}`;
    }

    if (this.vfx3d) {
      this.vfx3d.spawnShockwave(0.5, 0.45, 0xffd700, 5.2);
      this.vfx3d.burstCoins(0.24, 0.62, 22, 1.15);
      this.vfx3d.burstCoins(0.76, 0.62, 22, 1.15);
    }

    if (this.dom.bonusRetriggerModal) {
      this.dom.bonusRetriggerModal.classList.remove('hidden');
    }

    return new Promise(resolve => {
      const cleanup = () => {
        this.dom.bonusRetriggerModal?.removeEventListener('click', onContinue);
        this.dom.bonusRetriggerCard?.removeEventListener('click', onContinue);
        window.removeEventListener('keydown', onKey, true);
      };
      const onContinue = e => {
        e?.stopPropagation?.();
        cleanup();
        this.audio.playButtonClick();
        if (this.dom.bonusRetriggerModal) {
          this.dom.bonusRetriggerModal.classList.add('hidden');
        }
        resolve();
      };
      const onKey = e => {
        if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          e.stopPropagation();
          if (e.repeat) return;
          onContinue();
        }
      };
      this.dom.bonusRetriggerModal?.addEventListener('click', onContinue);
      this.dom.bonusRetriggerCard?.addEventListener('click', onContinue);
      window.addEventListener('keydown', onKey, true);
    });
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
        const thumbImg = sym.bonusImage || sym.image;
        const thumbHtml = thumbImg
          ? `<img class="paytable-thumb" src="${thumbImg}" alt="${sym.name}" />`
          : `<div class="paytable-royal-badge" style="background:${sym.secondaryColor}; color:${sym.rimColor};">${sym.label}</div>`;

        const payoutEntries = Object.entries(sym.payouts || {})
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(
            ([count, mult]) =>
              `<div><strong>${count}×</strong> — ${this.formatCurrency(mult * bet)}</div>`
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
  window.bigBassApp = app;
  app.init();
});
