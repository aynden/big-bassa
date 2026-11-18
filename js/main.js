/**
 * Big Bass Splash™ — Main Application Controller
 * Connects SlotEngine, ReelRenderer, AudioEngine, Wallet/Token Manager,
 * Pre-Bonus 5-Modifier Lasso Modal, Free Spins Loop, and Dev/Cheat Drawer.
 */

import { GAME_CONFIG, SYMBOLS, PRE_BONUS_MODIFIERS } from './config.js';
import { SlotEngine } from './engine.js';
import { ReelRenderer } from './renderer.js';
import { AudioEngine } from './audio.js';

const STORAGE_KEY_BALANCE = 'big_bass_splash_balance_v1';

class BigBassSplashApp {
  constructor() {
    this.audio = new AudioEngine();
    this.engine = new SlotEngine();
    this.canvas = document.getElementById('slot-canvas');
    this.renderer = new ReelRenderer(this.canvas, this.audio);

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

      // Trail & Active Modifiers
      fsModeBadge: document.getElementById('fs-mode-badge'),
      fsCounterText: document.getElementById('fs-counter-text'),
      activeModifiersPanel: document.getElementById('active-modifiers-panel'),
      activeModifiersList: document.getElementById('active-modifiers-list'),

      // Pre-Bonus 5-Modifier Lasso Modal
      lassoModal: document.getElementById('modifier-lasso-modal'),
      lassoTitle: document.getElementById('lasso-title'),
      btnStartFreeSpins: document.getElementById('btn-start-freespins'),

      // Celebration Modal
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

      // Cheat Drawer & Music Track Switcher
      btnNextTrack: document.getElementById('btn-next-track'),
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

    if (inFS) {
      this.dom.fsModeBadge.textContent = `FREE SPINS: ${this.engine.freeSpinsRemaining} LEFT • LEVEL ${this.engine.currentLevel} (${this.engine.currentMultiplier}×)`;
      this.dom.fsCounterText.textContent = `BONUS TOTAL WIN: ${this.formatCurrency(this.engine.freeSpinsTotalWin)} • WILDS COLLECTED: ${this.engine.wildsCollected}/12`;
    } else {
      this.dom.fsModeBadge.textContent = 'BASE GAME • 10 FIXED PAYLINES';
      this.dom.fsCounterText.textContent = 'LAND 3+ SCATTERS FOR FREE SPINS & UP TO 5 MODIFIERS!';
    }

    // Highlight collected wild dots & milestones (1..12)
    document.querySelectorAll('[data-wild-idx]').forEach(el => {
      const idx = parseInt(el.dataset.wildIdx, 10);
      el.classList.toggle('collected', this.engine.wildsCollected >= idx);
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
    if (this.isSpinning) return;

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
        this.audio.playBonusTrigger();
        this.renderer.triggerScreenShake(0.4, 16);
        this.renderer.addFloatingText(
          600,
          260,
          `LEVEL ${rt.newLevel} UNLOCKED! +${rt.extraSpins} SPINS (${rt.newMultiplier}×)!`,
          '#FFD700',
          44,
          1.8
        );
        await new Promise(r => setTimeout(r, 1100));
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
   * Authentic Pre-Bonus 5-Modifier Fishing Lasso Scene:
   * Renders the Fisherman on #lasso-fishing-canvas casting his rope lasso into the water
   * to physically snag swimming modifier fish one by one, before throwing a boot/anchor to end!
   */
  async launchPreBonusLassoSequence(triggerInfo) {
    this.audio.playBonusTrigger();
    const awardedModifiers = this.engine.rollPreBonusModifiers(1);
    const awardedIds = new Set(awardedModifiers.map(m => m.id));

    // Reset modal cards
    const cards = Array.from(document.querySelectorAll('.modifier-card'));
    cards.forEach(c => c.classList.remove('scanning', 'awarded'));
    this.dom.btnStartFreeSpins.classList.add('hidden');
    this.dom.lassoTitle.textContent = `${triggerInfo.scatterCount} SCATTERS! ${triggerInfo.baseSpins} FREE SPINS!`;
    this.dom.lassoModal.classList.remove('hidden');

    // Setup animated Pre-Bonus Lasso Fishing Canvas
    const lassoCanvas = document.getElementById('lasso-fishing-canvas');
    const lctx = lassoCanvas ? lassoCanvas.getContext('2d') : null;
    let lassoRunning = true;

    const swimFishes = PRE_BONUS_MODIFIERS.map((m, i) => ({
      id: m.id,
      name: m.shortName,
      icon: m.icon,
      x: 240 + i * 82,
      y: 115 + (i % 2) * 32,
      baseX: 240 + i * 82,
      baseY: 115 + (i % 2) * 32,
      caught: false,
      reelingProgress: 0
    }));

    let activeRope = null; // { targetX, targetY, progress, isReturning, caughtFish }

    if (lctx) {
      const renderLassoScene = now => {
        if (!lassoRunning) return;
        const w = lassoCanvas.width;
        const h = lassoCanvas.height;
        lctx.clearRect(0, 0, w, h);

        // Sky / Lake surface waterline
        const skyGrad = lctx.createLinearGradient(0, 0, 0, 62);
        skyGrad.addColorStop(0, '#FF9E44');
        skyGrad.addColorStop(1, '#FFD166');
        lctx.fillStyle = skyGrad;
        lctx.fillRect(0, 0, w, 62);

        // Underwater lake depth
        const waterGrad = lctx.createLinearGradient(0, 62, 0, h);
        waterGrad.addColorStop(0, '#0096C7');
        waterGrad.addColorStop(1, '#022B42');
        lctx.fillStyle = waterGrad;
        lctx.fillRect(0, 62, w, h - 62);

        // Shimmering waterline wave
        lctx.beginPath();
        lctx.moveTo(0, 62);
        for (let x = 0; x <= w; x += 20) {
          lctx.lineTo(x, 62 + Math.sin(now * 0.004 + x * 0.05) * 3);
        }
        lctx.lineWidth = 3;
        lctx.strokeStyle = '#ADE8F4';
        lctx.stroke();

        // Fisherman in his boat on left shore (x=88, y=54)
        lctx.fillStyle = '#6B3E16';
        lctx.beginPath();
        lctx.moveTo(28, 52);
        lctx.lineTo(148, 52);
        lctx.lineTo(132, 74);
        lctx.lineTo(42, 74);
        lctx.closePath();
        lctx.fill();
        lctx.lineWidth = 2;
        lctx.strokeStyle = '#FFD166';
        lctx.stroke();

        const wildImg = this.renderer.images['WILD'];
        if (wildImg) {
          lctx.save();
          lctx.beginPath();
          lctx.arc(88, 34, 28, 0, Math.PI * 2);
          lctx.clip();
          lctx.drawImage(wildImg, 60, 6, 56, 56);
          lctx.restore();
        }

        // Draw 5 swimming modifier fish in the water
        const fishImg = this.renderer.images['FISH'];
        for (const sf of swimFishes) {
          if (sf.caught && sf.reelingProgress >= 1) continue;

          let fx = sf.baseX + Math.sin(now * 0.004 + sf.baseX) * 14;
          let fy = sf.baseY + Math.cos(now * 0.005 + sf.baseY) * 6;

          if (sf.caught) {
            fx = sf.baseX + (105 - sf.baseX) * sf.reelingProgress;
            fy = sf.baseY + (48 - sf.baseY) * sf.reelingProgress - Math.sin(sf.reelingProgress * Math.PI) * 30;
          }

          sf.x = fx;
          sf.y = fy;

          lctx.save();
          lctx.translate(fx, fy);
          if (sf.caught) {
            lctx.rotate(Math.sin(now * 0.05) * 0.35);
          }
          if (fishImg) {
            lctx.beginPath();
            lctx.arc(0, 0, 24, 0, Math.PI * 2);
            lctx.save();
            lctx.clip();
            lctx.drawImage(fishImg, -24, -24, 48, 48);
            lctx.restore();
            lctx.lineWidth = 2.5;
            lctx.strokeStyle = sf.caught ? '#4CD964' : '#FFD700';
            lctx.stroke();
          }
          lctx.font = '18px sans-serif';
          lctx.textAlign = 'center';
          lctx.textBaseline = 'middle';
          lctx.fillText(sf.icon, 0, -26);
          lctx.restore();
        }

        // Draw Fisherman's Lasso Rope / Hook
        if (activeRope) {
          const handX = 112;
          const handY = 38;
          const curX = handX + (activeRope.targetX - handX) * activeRope.progress;
          const curY = handY + (activeRope.targetY - handY) * activeRope.progress;

          lctx.beginPath();
          lctx.moveTo(handX, handY);
          lctx.quadraticCurveTo((handX + curX) / 2, Math.min(handY, curY) - 28, curX, curY);
          lctx.lineWidth = 3.5;
          lctx.strokeStyle = '#FFE680';
          lctx.stroke();

          // Lasso Loop
          lctx.beginPath();
          lctx.ellipse(curX, curY, 22, 14, 0.2, 0, Math.PI * 2);
          lctx.lineWidth = 3;
          lctx.strokeStyle = '#FFD700';
          lctx.stroke();
        }

        requestAnimationFrame(renderLassoScene);
      };
      requestAnimationFrame(renderLassoScene);
    }

    // For each awarded modifier, cast the Fisherman's lasso to snag that swimming fish and reel it into the boat!
    for (const mod of awardedModifiers) {
      const targetFish = swimFishes.find(f => f.id === mod.id);
      const targetCard = cards.find(c => c.dataset.modId === mod.id);

      if (targetFish) {
        this.audio.playHookPull();
        // Cast rope out to fish (260ms)
        activeRope = { targetX: targetFish.x, targetY: targetFish.y, progress: 0 };
        for (let step = 1; step <= 10; step++) {
          activeRope.progress = step / 10;
          activeRope.targetX = targetFish.x;
          activeRope.targetY = targetFish.y;
          await new Promise(r => setTimeout(r, 25));
        }

        // Snag fish & reel it back into the boat! (340ms)
        targetFish.caught = true;
        this.audio.playFishCollect();
        for (let step = 1; step <= 12; step++) {
          const p = step / 12;
          targetFish.reelingProgress = p;
          activeRope.progress = 1 - p * 0.85;
          activeRope.targetX = targetFish.x;
          activeRope.targetY = targetFish.y;
          await new Promise(r => setTimeout(r, 28));
        }
        activeRope = null;
      }

      if (targetCard) {
        targetCard.classList.add('awarded');
        this.audio.playWinChime(false);
        await new Promise(r => setTimeout(r, 260));
      }
    }

    const totalSpins =
      triggerInfo.baseSpins + (awardedIds.has('EXTRA_SPINS') ? 2 : 0);
    this.dom.lassoTitle.textContent = `${totalSpins} FREE SPINS + ${awardedModifiers.length} MODIFIER${awardedModifiers.length > 1 ? 'S' : ''} CAUGHT!`;
    this.dom.btnStartFreeSpins.classList.remove('hidden');

    await new Promise(resolve => {
      const onStart = () => {
        this.dom.btnStartFreeSpins.removeEventListener('click', onStart);
        resolve();
      };
      this.dom.btnStartFreeSpins.addEventListener('click', onStart);
    });

    lassoRunning = false;
    this.dom.lassoModal.classList.add('hidden');

    // Populate left sidebar with active modifiers during Free Spins
    this.dom.activeModifiersList.innerHTML = awardedModifiers
      .map(
        m => `<div class="active-mod-pill"><span>${m.icon}</span><span>${m.shortName}</span></div>`
      )
      .join('');
    this.dom.activeModifiersPanel.classList.remove('hidden');

    // Initialize Free Spins in engine & switch BGM to high-tempo country banjo
    this.engine.startFreeSpins(triggerInfo.baseSpins, awardedModifiers);
    this.audio.startBGM('freespins', this.engine.currentLevel);
    this.updateTrailUI();
    this.updateHUD();

    await new Promise(r => setTimeout(r, 500));
    this.triggerSpin();
  }

  /**
   * Show Big Win / Free Spins Total Celebration Modal
   */
  showCelebrationModal(tierTitle, amount, subtext) {
    this.audio.playBonusTrigger();
    this.dom.celebrationTierBadge.textContent = tierTitle;
    this.dom.celebrationAmount.textContent = this.formatCurrency(amount);
    this.dom.celebrationSubtext.textContent = subtext;
    this.dom.celebrationModal.classList.remove('hidden');

    return new Promise(resolve => {
      const dismiss = () => {
        this.dom.btnDismissCelebration.removeEventListener('click', dismiss);
        this.dom.celebrationModal.classList.add('hidden');
        resolve();
      };
      this.dom.btnDismissCelebration.addEventListener('click', dismiss);
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
