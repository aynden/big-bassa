/**
 * Big Bass Splash - High-DPI 60FPS HTML5 Canvas Renderer
 * Features authentic Pragmatic Play choreography:
 *  - Fisherman Wild casts an animated fishing rod, hooks each Money Fish, reels the physical
 *    wriggling fish + cash tag across the water into his net with water splashes, escalates a
 *    live counter badge on the Fisherman tile, and shoots golden trail tokens up to the top meter!
 *  - Authentic Pre-Bonus Fisherman on Shore / Boat Casting Lasso scene catching swimming fish modifiers!
 *  - Realistic Dynamite sticks with burning fuse sparks, Bazooka rocket with smoke trail & screen shake,
 *    and 3D Hook pulling physical reel columns with splashing water ripples.
 */

import { GAME_CONFIG, SYMBOLS } from './config.js';

export class ReelRenderer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;

    // Logical dimensions (1200 x 690 internal resolution for crisp retina rendering)
    this.width = 1200;
    this.height = 690;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.cols = GAME_CONFIG.REELS;
    this.rows = GAME_CONFIG.ROWS;
    this.paddingX = 30;
    this.paddingY = 24;
    this.gridWidth = this.width - this.paddingX * 2;
    this.gridHeight = this.height - this.paddingY * 2;
    this.cellW = this.gridWidth / this.cols;
    this.cellH = this.gridHeight / this.rows;

    // Loaded Image cache + offscreen pre-rendered 3D Royals cache
    this.images = {};
    this.royalCanvases = {};

    // Current visible 5x3 grid
    this.grid = null;

    // Screen shake intensity
    this.shakeTime = 0;
    this.shakeMagnitude = 0;

    // Reel spin animation state per column
    this.reelStates = Array.from({ length: this.cols }, (_, c) => ({
      spinning: false,
      offsetY: 0,
      pullOffsetY: 0, // For Hook pulling entire reel column up
      speed: 0,
      strip: [],
      stopTime: 0,
      bouncePhase: 0,
      locked: false,
      anticipationGlow: false
    }));

    // Ambient rising bubbles between the 5 reels + background swimming fish silhouettes
    this.bubbles = [];
    this.bgFish = [];
    this._initBubbles();
    this._initBgFish();

    // Active visual overlays
    this.activeLineWins = [];
    this.highlightCycleIndex = 0;
    this.highlightTimer = 0;
    this.highlightedPositions = new Set(); // "col,row"

    // Fisherman active collection state (hides fish from static grid while being reeled in!)
    this.collectedFishSet = new Set(); // "col,row" of fish already pulled out of their cells
    this.activeFishermanState = null;  // { col, row, x, y, rodAngle, accumulatedWin, scale, bobbing }
    this.reelingFishes = [];           // Active fish sprites flying on the fishing line toward the fisherman

    // Special feature animations (hooks, dynamite, bazooka, water rings, floating popups)
    this.projectiles = [];
    this.waterRings = [];
    this.floatingTexts = [];
    this.particles = [];

    this.lastFrameTime = performance.now();
    this._preRender3DRoyals();
  }

  /**
   * Preload all photorealistic symbol images
   */
  async loadAssets() {
    const entries = Object.values(SYMBOLS).filter(s => s.image);
    const promises = entries.map(sym => {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          this.images[sym.id] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Fallback used for image: ${sym.image}`);
          resolve();
        };
        img.src = sym.image;
      });
    });
    await Promise.all(promises);
  }

  triggerScreenShake(duration = 0.35, magnitude = 14) {
    this.shakeTime = duration;
    this.shakeMagnitude = magnitude;
  }

  addWaterRing(x, y, maxRadius = 110, color = '#8CEEFF') {
    this.waterRings.push({
      x,
      y,
      r: 8,
      maxR: maxRadius,
      color,
      life: 0,
      maxLife: 0.55
    });
  }

  /**
   * Pre-render high-definition 3D beveled Royal letters (10, J, Q, K, A) with water droplets & brass rim
   */
  _preRender3DRoyals() {
    const royals = Object.values(SYMBOLS).filter(s => s.type === 'low');
    for (const sym of royals) {
      const size = 256;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const c = off.getContext('2d');

      const r = 38;
      c.save();
      this._roundRect(c, 12, 12, size - 24, size - 24, r);
      const bgGrad = c.createRadialGradient(size / 2, size / 2, 15, size / 2, size / 2, size / 1.7);
      bgGrad.addColorStop(0, 'rgba(10, 62, 92, 0.85)');
      bgGrad.addColorStop(1, 'rgba(3, 24, 42, 0.94)');
      c.fillStyle = bgGrad;
      c.fill();

      c.lineWidth = 8;
      const rimGrad = c.createLinearGradient(0, 0, size, size);
      rimGrad.addColorStop(0, '#FFE484');
      rimGrad.addColorStop(0.5, '#C98A27');
      rimGrad.addColorStop(1, '#784B08');
      c.strokeStyle = rimGrad;
      c.stroke();

      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      this._roundRect(c, 18, 18, size - 36, size - 36, r - 4);
      c.stroke();

      c.font = '900 132px "Bungee", "Impact", "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const cx = size / 2;
      const cy = size / 2 + 6;

      c.fillStyle = 'rgba(0, 0, 0, 0.65)';
      for (let d = 10; d >= 1; d--) {
        c.fillText(sym.label, cx + d * 0.6, cy + d * 1.1);
      }

      c.lineWidth = 14;
      c.lineJoin = 'round';
      c.strokeStyle = sym.rimColor;
      c.strokeText(sym.label, cx, cy);

      c.lineWidth = 6;
      c.strokeStyle = sym.secondaryColor;
      c.strokeText(sym.label, cx, cy);

      const textGrad = c.createLinearGradient(cx, cy - 65, cx, cy + 65);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(0.22, sym.primaryColor);
      textGrad.addColorStop(0.75, sym.primaryColor);
      textGrad.addColorStop(1, sym.secondaryColor);
      c.fillStyle = textGrad;
      c.fillText(sym.label, cx, cy);

      const droplets = [
        { x: cx - 35, y: cy - 32, rad: 6 },
        { x: cx + 38, y: cy - 18, rad: 5 },
        { x: cx - 20, y: cy + 28, rad: 7 },
        { x: cx + 25, y: cy + 35, rad: 4.5 },
        { x: cx + 8,  y: cy - 42, rad: 4 }
      ];
      for (const drop of droplets) {
        c.beginPath();
        c.arc(drop.x, drop.y, drop.rad, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.75)';
        c.fill();
        c.beginPath();
        c.arc(drop.x - drop.rad * 0.3, drop.y - drop.rad * 0.3, drop.rad * 0.35, 0, Math.PI * 2);
        c.fillStyle = '#FFFFFF';
        c.fill();
      }

      c.restore();
      this.royalCanvases[sym.id] = off;
    }
  }

  _initBubbles() {
    this.bubbles = [];
    for (let divider = 0; divider <= this.cols; divider++) {
      const baseX = this.paddingX + divider * this.cellW;
      for (let i = 0; i < 15; i++) {
        this.bubbles.push({
          baseX,
          x: baseX + (Math.random() - 0.5) * 12,
          y: Math.random() * this.height,
          r: 2.2 + Math.random() * 5.5,
          speed: 38 + Math.random() * 60,
          wobbleSpeed: 1.5 + Math.random() * 2.5,
          wobbleOffset: Math.random() * Math.PI * 2,
          alpha: 0.35 + Math.random() * 0.5
        });
      }
    }
  }

  _initBgFish() {
    this.bgFish = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * this.width,
      y: 90 + Math.random() * (this.height - 180),
      speed: (22 + Math.random() * 35) * (i % 2 === 0 ? 1 : -1),
      size: 26 + Math.random() * 22,
      wobble: Math.random() * Math.PI * 2
    }));
  }

  setGrid(grid) {
    this.grid = grid;
    this.collectedFishSet.clear();
  }

  clearHighlights() {
    this.activeLineWins = [];
    this.highlightedPositions.clear();
    this.collectedFishSet.clear();
    this.activeFishermanState = null;
    this.reelingFishes = [];
  }

  setLineWins(lineWins) {
    this.activeLineWins = lineWins || [];
    this.highlightCycleIndex = 0;
    this.highlightTimer = 0;
    this.highlightedPositions.clear();
    for (const win of this.activeLineWins) {
      for (const pos of win.positions) {
        this.highlightedPositions.add(`${pos.col},${pos.row}`);
      }
    }
  }

  /**
   * Start main 60fps render loop
   */
  startLoop() {
    const loop = now => {
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.update(dt, now);
      this.render(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * Animate a 5-reel spin to targetGrid with authentic Scatter drumroll anticipation glow
   */
  spinToGrid(targetGrid, { turbo = false, lockedCols = [], onReelStop = null } = {}) {
    this.clearHighlights();
    const now = performance.now();
    const symbolKeys = Object.keys(SYMBOLS);

    const baseDuration = turbo ? 260 : 660;
    const stagger = turbo ? 75 : 190;

    let scatterCountSoFar = 0;
    let cumulativeSuspense = 0;
    const promises = [];

    for (let c = 0; c < this.cols; c++) {
      const state = this.reelStates[c];
      state.anticipationGlow = false;

      if (lockedCols.includes(c)) {
        this.grid[c] = targetGrid[c];
        continue;
      }

      // If 2 Scatters have already landed on earlier reels, turn on Golden Suspense Spotlight on this reel!
      const isSuspenseReel = !turbo && scatterCountSoFar >= 2;
      if (isSuspenseReel) {
        cumulativeSuspense += 620;
      }

      const hasScatterInCol = targetGrid[c].some(cell => cell.id === 'SCATTER');
      const hasWildInCol = targetGrid[c].some(cell => cell.id === 'WILD');
      if (hasScatterInCol) scatterCountSoFar++;

      const stopTime = now + baseDuration + c * stagger + cumulativeSuspense;

      const strip = Array.from({ length: 6 }, () => {
        const randId = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        return {
          id: randId,
          symbol: SYMBOLS[randId],
          money: randId === 'FISH' ? { multiplier: 10, tier: 'medium' } : null
        };
      });

      state.spinning = true;
      state.offsetY = 0;
      state.pullOffsetY = 0;
      state.speed = turbo ? 2650 : isSuspenseReel ? 2450 : 1950;
      state.strip = strip;
      state.stopTime = stopTime;
      state.targetCol = targetGrid[c];
      state.isSuspenseReel = isSuspenseReel;

      promises.push(
        new Promise(resolve => {
          state.onFinished = () => {
            state.anticipationGlow = false;
            this.grid[c] = targetGrid[c];

            // Water splash burst when Scatter or Fisherman Wild slams onto the reel!
            if (hasScatterInCol || hasWildInCol) {
              const rowIdx = targetGrid[c].findIndex(cell => cell.id === 'SCATTER' || cell.id === 'WILD');
              const sx = this.paddingX + c * this.cellW + this.cellW / 2;
              const sy = this.paddingY + rowIdx * this.cellH + this.cellH / 2;
              this.addWaterRing(sx, sy, 115, hasScatterInCol ? '#00E5FF' : '#FFD700');
              this.spawnSplashParticles(sx, sy, 28, hasScatterInCol ? '#80F5FF' : '#FFD700');
            }

            if (onReelStop) onReelStop(c, hasScatterInCol || hasWildInCol);
            resolve();
          };
        })
      );
    }

    return Promise.all(promises);
  }

  /**
   * Animate 2-Scatter Nudge down 1 row + respin unlocked columns
   */
  async playNudgeRespin(event, totalBet, turbo = false) {
    this.addFloatingText(this.width / 2, this.height / 2, '⏬ NUDGE & RESPIN!', '#00E5FF', 54, 1.3);
    this.audio.playHookPull();
    this.triggerScreenShake(0.25, 10);

    for (const c of event.lockedCols) {
      const cx = this.paddingX + c * this.cellW + this.cellW / 2;
      this.addWaterRing(cx, this.height / 2, 130, '#00E5FF');
      this.spawnSplashParticles(cx, this.height / 2, 28, '#00E5FF');
    }

    await this.spinToGrid(event.toGrid, {
      turbo,
      lockedCols: [],
      onReelStop: (c, hasScatter) => this.audio.playReelStop(c, hasScatter)
    });
  }

  /**
   * Authentic Hook Pull Animation:
   * A giant metal treble hook drops into the water, hooks the bottom of the reel column,
   * and physically hoists the entire reel column upward with splashing water & screen shake
   * to reveal the 3rd Scatter or Fisherman Wild!
   */
  async playHookPullAnimation(col, row, targetGrid, labelText = '🪝 HOOK FEATURE!') {
    this.audio.playHookPull();
    const targetX = this.paddingX + col * this.cellW + this.cellW / 2;
    const targetY = this.paddingY + row * this.cellH + this.cellH / 2;
    const colState = this.reelStates[col];

    this.addFloatingText(this.width / 2, 95, labelText, '#FFD700', 52, 1.45);

    return new Promise(resolve => {
      const startTime = performance.now();
      const duration = 1250;

      const hookAnim = {
        update: now => {
          const t = Math.min(1, (now - startTime) / duration);

          // Phase 1 (0 -> 0.38): Hook plunges down into the reel
          // Phase 2 (0.38 -> 0.52): Hook latches onto reel with water splash
          // Phase 3 (0.52 -> 1.0): Hook yanks the entire reel column upward to reveal the symbol!
          let hookY = 0;
          if (t < 0.38) {
            const p = t / 0.38;
            hookY = p * (targetY + 85);
          } else if (t < 0.52) {
            hookY = targetY + 85;
            if (!hookAnim.latched) {
              hookAnim.latched = true;
              this.triggerScreenShake(0.25, 10);
              this.addWaterRing(targetX, targetY + 60, 125, '#80F5FF');
              this.spawnSplashParticles(targetX, targetY + 60, 32, '#80F5FF');
            }
          } else {
            const p = (t - 0.52) / 0.48;
            const easeOut = 1 - Math.pow(1 - p, 3);
            hookY = (targetY + 85) - easeOut * 220;

            // Physically displace the reel column vertically as the hook yanks it up!
            colState.pullOffsetY = (1 - easeOut) * 145 * (Math.sin(p * Math.PI * 3) * 0.25 + 0.75);

            if (!hookAnim.swapped) {
              hookAnim.swapped = true;
              this.grid = targetGrid;
              this.triggerScreenShake(0.35, 14);
              this.addWaterRing(targetX, targetY, 150, '#FFD700');
              this.spawnSplashParticles(targetX, targetY, 45, '#FFD700');
              this.audio.playReelStop(col, true);
            }
          }

          hookAnim.currentX = targetX;
          hookAnim.currentY = hookY;

          if (t >= 1) {
            colState.pullOffsetY = 0;
            this.projectiles = this.projectiles.filter(p => p !== hookAnim);
            resolve();
          }
        },
        draw: ctx => {
          const x = hookAnim.currentX || targetX;
          const y = hookAnim.currentY || 0;
          ctx.save();

          // Braided fishing line from top of screen
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, y - 42);
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = '#E8F6FF';
          ctx.shadowColor = '#00E5FF';
          ctx.shadowBlur = 10;
          ctx.stroke();

          // Red & Gold Swivel Sinker
          this._roundRect(ctx, x - 9, y - 46, 18, 22, 6);
          ctx.fillStyle = '#D92B2B';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#FFD700';
          ctx.stroke();

          // Heavy 3D Metallic Treble Fishing Hook
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#D8E2EE';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 12;

          // Left & Right hook curves
          ctx.beginPath();
          ctx.moveTo(x, y - 24);
          ctx.lineTo(x, y + 6);
          ctx.arc(x - 20, y + 6, 20, 0, Math.PI, false);
          ctx.lineTo(x - 40, y - 6);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x, y + 6);
          ctx.arc(x + 20, y + 6, 20, Math.PI, 0, true);
          ctx.lineTo(x + 40, y - 6);
          ctx.stroke();

          // Barbs
          ctx.lineWidth = 4;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(x - 40, y - 12);
          ctx.lineTo(x - 47, y + 2);
          ctx.lineTo(x - 34, y - 1);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(x + 40, y - 12);
          ctx.lineTo(x + 47, y + 2);
          ctx.lineTo(x + 34, y - 1);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      };

      this.projectiles.push(hookAnim);
    });
  }

  /**
   * Authentic Dynamite & Bazooka Rescue Animation:
   * - Dynamite: Spinning red dynamite sticks with burning fuse sparks arc onto the reels,
   *   detonate with shockwave rings + screen shake, and transform symbols into wriggling Money Fish!
   * - Bazooka: Fisherman aims a rocket launcher across the reels, firing high-speed missiles with
   *   smoke trails that blast symbols into Money Fish!
   */
  async playRescueExplosion(event) {
    const isDynamite = event.type === 'RESCUE_DYNAMITE';
    const banner = isDynamite ? '🧨 DYNAMITE FEATURE!' : '🚀 BAZOOKA FEATURE!';
    this.addFloatingText(this.width / 2, 95, banner, '#FF5E3A', 54, 1.45);

    for (const target of event.targets) {
      const tx = this.paddingX + target.col * this.cellW + this.cellW / 2;
      const ty = this.paddingY + target.row * this.cellH + this.cellH / 2;

      await new Promise(resolve => {
        const startX = isDynamite ? this.width / 2 : -40;
        const startY = isDynamite ? this.height + 30 : ty + (Math.random() - 0.5) * 80;
        const startTime = performance.now();
        const dur = isDynamite ? 420 : 340;

        const proj = {
          update: now => {
            const t = Math.min(1, (now - startTime) / dur);
            proj.x = startX + (tx - startX) * t;
            proj.y = startY + (ty - startY) * t - (isDynamite ? Math.sin(t * Math.PI) * 190 : 0);
            proj.rotation = t * Math.PI * (isDynamite ? 3.5 : 0);

            // Emit fuse sparks or rocket exhaust smoke trail every frame
            this.particles.push({
              x: proj.x,
              y: proj.y,
              vx: (Math.random() - 0.5) * 90,
              vy: (Math.random() - 0.5) * 90,
              r: isDynamite ? 3.5 : 6,
              color: isDynamite ? '#FFE600' : 'rgba(220, 230, 240, 0.75)',
              life: 0,
              maxLife: 0.25
            });

            if (t >= 1) {
              this.projectiles = this.projectiles.filter(p => p !== proj);
              this.grid[target.col][target.row] = target.cell;
              this.audio.playExplosion();
              this.triggerScreenShake(0.32, 16);
              this.addWaterRing(tx, ty, 140, '#FF8A00');
              this.spawnSplashParticles(tx, ty, 45, '#FF9500');
              this.spawnSplashParticles(tx, ty, 22, '#00E5FF');
              resolve();
            }
          },
          draw: ctx => {
            const x = proj.x || startX;
            const y = proj.y || startY;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(proj.rotation || 0);

            if (isDynamite) {
              // Draw 3D Red Dynamite Bundle with gold bands & burning fuse
              this._roundRect(ctx, -14, -28, 28, 56, 6);
              ctx.fillStyle = '#D91E18';
              ctx.fill();
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#FFD700';
              ctx.stroke();

              // Black & gold straps
              ctx.fillStyle = '#222222';
              ctx.fillRect(-14, -14, 28, 7);
              ctx.fillRect(-14, 8, 28, 7);

              // Fuse cord & glowing spark tip
              ctx.beginPath();
              ctx.moveTo(0, -28);
              ctx.quadraticCurveTo(12, -40, 6, -48);
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#DDD';
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(6, -48, 7, 0, Math.PI * 2);
              ctx.fillStyle = '#FFF200';
              ctx.shadowColor = '#FF5500';
              ctx.shadowBlur = 14;
              ctx.fill();
            } else {
              // Draw 3D Red/Steel Bazooka Rocket with fiery thruster
              ctx.beginPath();
              ctx.arc(-28, 0, 14, 0, Math.PI * 2);
              ctx.fillStyle = '#FF6B00';
              ctx.shadowColor = '#FF2A00';
              ctx.shadowBlur = 18;
              ctx.fill();

              this._roundRect(ctx, -22, -11, 44, 22, 8);
              ctx.fillStyle = '#3A4A5E';
              ctx.fill();

              // Red warhead nose cone
              ctx.beginPath();
              ctx.moveTo(16, -12);
              ctx.lineTo(36, 0);
              ctx.lineTo(16, 12);
              ctx.closePath();
              ctx.fillStyle = '#FF2E2E';
              ctx.fill();
            }

            ctx.restore();
          }
        };
        this.projectiles.push(proj);
      });
    }

    this.grid = event.toGrid;
  }

  /**
   * AUTHENTIC BIG BASS SPLASH FISHERMAN COLLECTION ANIMATION (like in the YouTube gameplay!):
   * 1. Each Fisherman Wild springs forward with an animated curved carbon fishing rod.
   * 2. For each Money Fish on the grid:
   *    - Fisherman casts his line & glowing bobber/hook out to the fish cell with a water splash ring.
   *    - The hook latches onto the fish! The fish pops out of its cell (leaving water ripples behind)
   *      and physically wriggles & flies along the taut fishing line right into the Fisherman's net!
   *    - As each fish slams into the Fisherman tile, a water/coin burst explodes, the Fisherman tile
   *      bounces, and a live golden counter badge on the Fisherman tile escalates ($20 -> $70 -> $170!).
   * 3. Finally, a glowing golden Fisherman badge shoots upward from the Fisherman into the top
   *    12-slot progressive multiplier trail meter!
   */
  async playFishermanCollect(fishCollection, totalBet, formatCurrency, onWildAddedToTrail = null) {
    const { wilds, fishes, levelMultiplier } = fishCollection;
    if (!wilds.length) return;

    for (const wildPos of wilds) {
      const wx = this.paddingX + wildPos.col * this.cellW + this.cellW / 2;
      const wy = this.paddingY + wildPos.row * this.cellH + this.cellH / 2;

      // Reset collected fish visuals for this fisherman's sweep so each Fisherman reels all fish in!
      this.collectedFishSet.clear();

      this.activeFishermanState = {
        col: wildPos.col,
        row: wildPos.row,
        x: wx,
        y: wy,
        rodCastProgress: 0,
        accumulatedWin: 0,
        bounceScale: 1.14,
        levelMultiplier,
        targetX: wx,
        targetY: wy
      };

      // Pulse Fisherman tile on activation
      this.addWaterRing(wx, wy, 130, '#FFD700');
      this.spawnSplashParticles(wx, wy, 24, '#FFD700');
      this.audio.playHookPull();
      await new Promise(r => setTimeout(r, 220));

      // Reel in each Money Fish one by one (or rapidly in sequence!)
      for (const f of fishes) {
        const fx = this.paddingX + f.col * this.cellW + this.cellW / 2;
        const fy = this.paddingY + f.row * this.cellH + this.cellH / 2;
        const baseCash = f.cell.money.multiplier * totalBet;
        const multipliedCash = baseCash * levelMultiplier;
        const fishKey = `${f.col},${f.row}`;

        this.activeFishermanState.targetX = fx;
        this.activeFishermanState.targetY = fy;

        // Step A: Cast line from Fisherman's rod tip out to the Fish cell (180ms)
        await new Promise(resolve => {
          const castStart = performance.now();
          const castDur = 175;
          const castProj = {
            update: now => {
              const t = Math.min(1, (now - castStart) / castDur);
              this.activeFishermanState.rodCastProgress = t;
              castProj.hookX = wx + (fx - wx) * t;
              castProj.hookY = wy + (fy - wy) * t - Math.sin(t * Math.PI) * 55;
              if (t >= 1) {
                this.projectiles = this.projectiles.filter(p => p !== castProj);
                resolve();
              }
            },
            draw: ctx => {
              this._drawRodAndLineToPoint(
                ctx,
                wx,
                wy,
                castProj.hookX ?? wx,
                castProj.hookY ?? wy,
                false
              );
            }
          };
          this.projectiles.push(castProj);
        });

        // Splash on the fish cell as the hook snags the fish!
        this.collectedFishSet.add(fishKey);
        this.addWaterRing(fx, fy, 110, '#00E5FF');
        this.spawnSplashParticles(fx, fy, 26, '#80F5FF');
        this.audio.playFishCollect();

        // Step B: Reel the wriggling physical Fish Sprite + Cash Tag along the line into the Fisherman! (360ms)
        await new Promise(resolve => {
          const reelStart = performance.now();
          const reelDur = 360;

          const flyingFish = {
            cell: f.cell,
            cashText: formatCurrency(multipliedCash),
            multText: levelMultiplier > 1 ? `${levelMultiplier}×` : '',
            update: now => {
              const t = Math.min(1, (now - reelStart) / reelDur);
              const easeIn = t * t * (3 - 2 * t);
              // Arc path from fish cell to Fisherman
              flyingFish.x = fx + (wx - fx) * easeIn;
              flyingFish.y = fy + (wy - fy) * easeIn - Math.sin(t * Math.PI) * 70;
              flyingFish.scale = 1.08 - t * 0.28;
              // Wriggle rotation as the fish is reeled through the water!
              flyingFish.rotation = Math.sin(now * 0.045) * 0.32;

              // Water droplets trailing off the reeled fish
              if (Math.random() < 0.65) {
                this.particles.push({
                  x: flyingFish.x,
                  y: flyingFish.y,
                  vx: (Math.random() - 0.5) * 110,
                  vy: (Math.random() - 0.5) * 110,
                  r: 3.5,
                  color: '#8CEEFF',
                  life: 0,
                  maxLife: 0.3
                });
              }

              if (t >= 1) {
                this.reelingFishes = this.reelingFishes.filter(rf => rf !== flyingFish);
                resolve();
              }
            },
            draw: ctx => {
              const x = flyingFish.x ?? fx;
              const y = flyingFish.y ?? fy;
              // Draw bent rod & taut line attached to the wriggling fish
              this._drawRodAndLineToPoint(ctx, wx, wy, x, y, true);

              // Draw the physical wriggling fish sprite + glowing cash badge
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(flyingFish.rotation || 0);
              ctx.scale(flyingFish.scale || 1, flyingFish.scale || 1);

              const fishImg = this.images['FISH'];
              const size = 148;
              if (fishImg) {
                this._roundRect(ctx, -size / 2, -size / 2, size, size, 28);
                ctx.save();
                ctx.clip();
                ctx.drawImage(fishImg, -size / 2, -size / 2, size, size);
                ctx.restore();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#FFD700';
                ctx.stroke();
              }

              // Cash tag on the flying fish
              this._roundRect(ctx, -68, 26, 136, 38, 12);
              ctx.fillStyle = '#073B1E';
              ctx.fill();
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#4CD964';
              ctx.stroke();

              ctx.font = '900 20px "Bungee", Impact, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(flyingFish.cashText, 0, 46);
              ctx.restore();
            }
          };

          this.reelingFishes.push(flyingFish);
        });

        // Fish lands inside Fisherman's net! Escalate Fisherman's accumulated win badge & splash!
        this.activeFishermanState.accumulatedWin = Number(
          (this.activeFishermanState.accumulatedWin + multipliedCash).toFixed(2)
        );
        this.activeFishermanState.bounceScale = 1.24;
        this.triggerScreenShake(0.16, 7);
        this.addWaterRing(wx, wy, 120, '#4CD964');
        this.spawnSplashParticles(wx, wy, 32, '#FFD700');
        this.spawnSplashParticles(wx, wy, 18, '#4CD964');
        this.addFloatingText(
          wx,
          wy - 55,
          `+${formatCurrency(multipliedCash)}${levelMultiplier > 1 ? ` (${levelMultiplier}×)` : ''}`,
          '#4CD964',
          34,
          0.95
        );
      }

      // Hold a beat so player sees total collected on the Fisherman tile, then shoot golden trail orb up to the top meter!
      if (fishes.length > 0) {
        this.addFloatingText(
          wx,
          wy - 75,
          `NETTED ${formatCurrency(this.activeFishermanState.accumulatedWin)}!`,
          '#FFD700',
          42,
          1.35
        );
      }

      // Shoot glowing golden Fisherman Wild orb up to the top Multiplier Trail bar
      await new Promise(resolve => {
        const orbStart = performance.now();
        const orbDur = 420;
        const targetTrailX = this.width * 0.65;
        const targetTrailY = 12;

        const trailOrb = {
          update: now => {
            const t = Math.min(1, (now - orbStart) / orbDur);
            const ease = t * t;
            trailOrb.x = wx + (targetTrailX - wx) * ease;
            trailOrb.y = wy + (targetTrailY - wy) * ease;

            this.particles.push({
              x: trailOrb.x,
              y: trailOrb.y,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              r: 5,
              color: '#FFD700',
              life: 0,
              maxLife: 0.25
            });

            if (t >= 1) {
              this.projectiles = this.projectiles.filter(p => p !== trailOrb);
              if (onWildAddedToTrail) onWildAddedToTrail();
              resolve();
            }
          },
          draw: ctx => {
            const x = trailOrb.x ?? wx;
            const y = trailOrb.y ?? wy;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FFA500';
            ctx.shadowBlur = 24;
            ctx.fill();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🤠', x, y);
            ctx.restore();
          }
        };
        this.projectiles.push(trailOrb);
      });

      await new Promise(r => setTimeout(r, 280));
      this.activeFishermanState = null;
      this.collectedFishSet.clear();
    }
  }

  /**
   * Draw curved animated fishing rod emerging from Fisherman Wild tile + fishing line + bobber/hook
   */
  _drawRodAndLineToPoint(ctx, wx, wy, targetX, targetY, isTautWithFish) {
    ctx.save();
    const dir = targetX >= wx ? 1 : -1;
    const rodBaseX = wx + dir * 28;
    const rodBaseY = wy + 18;
    const rodTipX = wx + dir * 78;
    const rodTipY = wy - (isTautWithFish ? 48 : 72);

    // Curved carbon-fiber fishing rod bending under tension
    ctx.beginPath();
    ctx.moveTo(rodBaseX, rodBaseY);
    ctx.quadraticCurveTo(
      wx + dir * 45,
      wy - 55,
      rodTipX,
      rodTipY
    );
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3B230A';
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    // Taut glowing fishing line from rod tip to the fish/hook
    ctx.beginPath();
    ctx.moveTo(rodTipX, rodTipY);
    if (isTautWithFish) {
      ctx.lineTo(targetX, targetY);
    } else {
      const midX = (rodTipX + targetX) / 2;
      const midY = Math.min(rodTipY, targetY) - 45;
      ctx.quadraticCurveTo(midX, midY, targetX, targetY);
    }
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Red & white fishing bobber float + silver hook at target
    ctx.beginPath();
    ctx.arc(targetX, targetY - 12, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FF3B30';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();
  }

  addFloatingText(x, y, text, color = '#FFD700', size = 38, duration = 1.2) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      life: 0,
      maxLife: duration
    });
  }

  spawnSplashParticles(x, y, count = 24, color = '#00E5FF') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 85 + Math.random() * 270;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 75,
        r: 3 + Math.random() * 6,
        color,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35
      });
    }
  }

  update(dt, now) {
    // 0. Screen shake decay
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
    }

    // 1. Update rising water bubbles & ambient background fish silhouettes
    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      b.x = b.baseX + Math.sin(now * 0.002 * b.wobbleSpeed + b.wobbleOffset) * 8;
      if (b.y < -15) {
        b.y = this.height + 15;
      }
    }

    for (const bf of this.bgFish) {
      bf.x += bf.speed * dt;
      if (bf.speed > 0 && bf.x > this.width + 60) bf.x = -60;
      if (bf.speed < 0 && bf.x < -60) bf.x = this.width + 60;
    }

    // 2. Update spinning reels
    for (let c = 0; c < this.cols; c++) {
      const state = this.reelStates[c];
      if (state.spinning) {
        // Turn on suspense spotlight when previous reels have stopped and this is a suspense reel
        const prevStopped = c === 0 || !this.reelStates[c - 1].spinning;
        state.anticipationGlow = Boolean(state.isSuspenseReel && prevStopped);

        state.offsetY += state.speed * dt;
        if (state.offsetY >= this.cellH) {
          state.offsetY -= this.cellH;
          state.strip.pop();
          const keys = Object.keys(SYMBOLS);
          const randId = keys[Math.floor(Math.random() * keys.length)];
          state.strip.unshift({
            id: randId,
            symbol: SYMBOLS[randId],
            money: randId === 'FISH' ? { multiplier: 10, tier: 'medium' } : null
          });
        }

        if (now >= state.stopTime) {
          state.spinning = false;
          state.offsetY = 0;
          state.bouncePhase = 1.0;
          if (state.onFinished) {
            const cb = state.onFinished;
            state.onFinished = null;
            cb();
          }
        }
      } else if (state.bouncePhase > 0) {
        state.bouncePhase = Math.max(0, state.bouncePhase - dt * 5.2);
      }
    }

    // 3. Decay Fisherman bounce scale
    if (this.activeFishermanState && this.activeFishermanState.bounceScale > 1.08) {
      this.activeFishermanState.bounceScale = Math.max(
        1.08,
        this.activeFishermanState.bounceScale - dt * 1.4
      );
    }

    // 4. Cycle active payline highlights
    if (this.activeLineWins.length > 0) {
      this.highlightTimer += dt;
      if (this.highlightTimer >= 1.35) {
        this.highlightTimer = 0;
        this.highlightCycleIndex = (this.highlightCycleIndex + 1) % this.activeLineWins.length;
      }
    }

    // 5. Update projectiles & flying reeled fish
    for (const p of [...this.projectiles]) {
      if (p.update) p.update(now);
    }
    for (const rf of [...this.reelingFishes]) {
      if (rf.update) rf.update(now);
    }

    // 6. Update water splash rings
    for (let i = this.waterRings.length - 1; i >= 0; i--) {
      const wr = this.waterRings[i];
      wr.life += dt;
      wr.r = 10 + (wr.maxR - 10) * (wr.life / wr.maxLife);
      if (wr.life >= wr.maxLife) {
        this.waterRings.splice(i, 1);
      }
    }

    // 7. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 380 * dt;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 8. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y -= 42 * dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // Apply screen shake offset if active
    if (this.shakeTime > 0) {
      const sx = (Math.random() - 0.5) * this.shakeMagnitude;
      const sy = (Math.random() - 0.5) * this.shakeMagnitude;
      ctx.translate(sx, sy);
    }

    // 1. Translucent Underwater Reel Stage Backing with Ambient Fish & Caustics
    this._drawReelFrame(ctx, now);

    // 2. Render each of the 5 columns
    if (this.grid) {
      ctx.save();
      this._roundRect(
        ctx,
        this.paddingX,
        this.paddingY,
        this.gridWidth,
        this.gridHeight,
        18
      );
      ctx.clip();

      for (let c = 0; c < this.cols; c++) {
        const state = this.reelStates[c];
        const colX = this.paddingX + c * this.cellW;

        // Golden Suspense Spotlight when waiting for 3rd Scatter!
        if (state.anticipationGlow) {
          const glowGrad = ctx.createLinearGradient(colX, this.paddingY, colX, this.height - this.paddingY);
          glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.38)');
          glowGrad.addColorStop(0.5, 'rgba(255, 149, 0, 0.22)');
          glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0.38)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(colX, this.paddingY, this.cellW, this.gridHeight);
        }

        if (state.spinning) {
          for (let r = -1; r < this.rows; r++) {
            const cell = state.strip[r + 1];
            const cellY = this.paddingY + r * this.cellH + state.offsetY;
            this._drawSymbolCell(ctx, cell, colX, cellY, this.cellW, this.cellH, {
              col: c,
              row: r,
              spinning: true,
              highlighted: false,
              dimmed: false,
              now
            });
          }
        } else {
          const bounceY =
            (state.bouncePhase > 0 ? Math.sin(state.bouncePhase * Math.PI) * 18 : 0) -
            (state.pullOffsetY || 0);

          for (let r = 0; r < this.rows; r++) {
            const cell = this.grid[c][r];
            const cellY = this.paddingY + r * this.cellH + bounceY;
            const key = `${c},${r}`;
            const hasWins = this.highlightedPositions.size > 0;
            const isHighlighted = this.highlightedPositions.has(key);

            this._drawSymbolCell(ctx, cell, colX, cellY, this.cellW, this.cellH, {
              col: c,
              row: r,
              spinning: false,
              highlighted: isHighlighted,
              dimmed: hasWins && !isHighlighted,
              now
            });
          }
        }
      }
      ctx.restore();
    }

    // 3. Rising Air Bubble Column Dividers
    this._drawBubbleDividers(ctx);

    // 4. Active Winning Payline Laser Path & Badge
    if (this.activeLineWins.length > 0) {
      this._drawWinningPaylines(ctx, now);
    }

    // 5. Water Ripple Rings
    for (const wr of this.waterRings) {
      const alpha = Math.max(0, 1 - wr.life / wr.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(wr.x, wr.y, wr.r, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = wr.color;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Active Projectiles (Hooks, Dynamite, Bazooka, Rod Casting)
    for (const p of this.projectiles) {
      if (p.draw) p.draw(ctx);
    }

    // 7. Reeling Wriggling Money Fish flying into the Fisherman's net!
    for (const rf of this.reelingFishes) {
      if (rf.draw) rf.draw(ctx);
    }

    // 8. Active Fisherman Collector Live Counter Overlay
    if (this.activeFishermanState) {
      this._drawActiveFishermanOverlay(ctx, this.activeFishermanState, now);
    }

    // 9. Splash & Coin Particles
    for (const pt of this.particles) {
      const alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    }

    // 10. Floating Win / Feature Texts
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, 1 - Math.pow(ft.life / ft.maxLife, 2));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px "Bungee", "Impact", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#001829';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawActiveFishermanOverlay(ctx, fsState, now) {
    const { x, y, accumulatedWin, levelMultiplier } = fsState;
    if (accumulatedWin <= 0) return;

    ctx.save();
    ctx.translate(x, y + 66);

    this._roundRect(ctx, -84, -22, 168, 44, 14);
    const pillGrad = ctx.createLinearGradient(0, -22, 0, 22);
    pillGrad.addColorStop(0, '#FF9500');
    pillGrad.addColorStop(1, '#9E3D00');
    ctx.fillStyle = pillGrad;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 18;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFF5B8';
    ctx.stroke();

    ctx.font = '900 22px "Bungee", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    const txt = `$${accumulatedWin.toFixed(accumulatedWin % 1 === 0 ? 0 : 2)}${levelMultiplier > 1 ? ` (${levelMultiplier}×)` : ''}`;
    ctx.fillText(txt, 0, 1);
    ctx.restore();
  }

  _drawReelFrame(ctx, now) {
    ctx.save();
    this._roundRect(ctx, this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 20);
    const waterGrad = ctx.createLinearGradient(0, this.paddingY, 0, this.height - this.paddingY);
    waterGrad.addColorStop(0, 'rgba(7, 74, 108, 0.56)');
    waterGrad.addColorStop(0.5, 'rgba(4, 45, 72, 0.66)');
    waterGrad.addColorStop(1, 'rgba(2, 24, 44, 0.76)');
    ctx.fillStyle = waterGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Ambient underwater fish silhouettes swimming behind the reels
    for (const bf of this.bgFish) {
      const dir = bf.speed >= 0 ? 1 : -1;
      const swimY = bf.y + Math.sin(now * 0.003 + bf.wobble) * 10;
      ctx.save();
      ctx.translate(bf.x, swimY);
      ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(0, 24, 44, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, bf.size, bf.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-bf.size * 0.85, 0);
      ctx.lineTo(-bf.size * 1.35, -bf.size * 0.4);
      ctx.lineTo(-bf.size * 1.35, bf.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Animated underwater caustic sunbeams
    for (let i = 0; i < 4; i++) {
      const beamX = 180 + i * 260 + Math.sin(now * 0.0007 + i) * 55;
      const beamGrad = ctx.createLinearGradient(beamX, 0, beamX + 90, this.height);
      beamGrad.addColorStop(0, 'rgba(135, 245, 255, 0.12)');
      beamGrad.addColorStop(1, 'rgba(135, 245, 255, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(beamX - 50, this.paddingY);
      ctx.lineTo(beamX + 70, this.paddingY);
      ctx.lineTo(beamX + 160, this.height - this.paddingY);
      ctx.lineTo(beamX - 20, this.height - this.paddingY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Outer golden wood & brass border around the 5x3 grid
    ctx.lineWidth = 6;
    const frameGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
    frameGrad.addColorStop(0, '#FFE38E');
    frameGrad.addColorStop(0.5, '#C88728');
    frameGrad.addColorStop(1, '#7D4C09');
    ctx.strokeStyle = frameGrad;
    this._roundRect(ctx, this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 20);
    ctx.stroke();
    ctx.restore();
  }

  _drawBubbleDividers(ctx) {
    ctx.save();
    for (let c = 1; c < this.cols; c++) {
      const x = this.paddingX + c * this.cellW;
      const lineGrad = ctx.createLinearGradient(x, this.paddingY, x, this.height - this.paddingY);
      lineGrad.addColorStop(0, 'rgba(120, 235, 255, 0.08)');
      lineGrad.addColorStop(0.5, 'rgba(120, 235, 255, 0.25)');
      lineGrad.addColorStop(1, 'rgba(120, 235, 255, 0.08)');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, this.paddingY + 10);
      ctx.lineTo(x, this.height - this.paddingY - 10);
      ctx.stroke();
    }

    for (const b of this.bubbles) {
      if (b.y < this.paddingY || b.y > this.height - this.paddingY) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(185, 245, 255, ${b.alpha * 0.45})`;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSymbolCell(ctx, cell, x, y, w, h, { col, row, spinning, highlighted, dimmed, now }) {
    if (!cell) return;
    const cellKey = `${col},${row}`;
    const isCollectedFish = !spinning && cell.id === 'FISH' && this.collectedFishSet.has(cellKey);
    const isActiveFisherman =
      !spinning &&
      this.activeFishermanState &&
      this.activeFishermanState.col === col &&
      this.activeFishermanState.row === row;

    ctx.save();
    const cx = x + w / 2;
    const cy = y + h / 2;

    if (dimmed && !isActiveFisherman) {
      ctx.globalAlpha = 0.42;
    }

    // Idle breathing / swimming animation for high-value & special symbols!
    let scaleX = 1.0;
    let scaleY = 1.0;
    let rot = 0;

    if (!spinning) {
      if (isActiveFisherman) {
        scaleX = this.activeFishermanState.bounceScale;
        scaleY = this.activeFishermanState.bounceScale;
        rot = Math.sin(now * 0.014) * 0.04;
      } else if (highlighted) {
        const s = 1.07 + Math.sin(now * 0.011) * 0.045;
        scaleX = s;
        scaleY = s;
        rot = Math.sin(now * 0.008) * 0.03;
      } else if (cell.id === 'FISH') {
        // Subtle tail-wag swimming oscillation while fish sit on the grid
        scaleX = 1.0 + Math.sin(now * 0.006 + col * 1.3 + row) * 0.022;
        scaleY = 1.0 - Math.sin(now * 0.006 + col * 1.3 + row) * 0.018;
      } else if (cell.id === 'SCATTER' || cell.id === 'WILD') {
        const s = 1.02 + Math.sin(now * 0.005 + col) * 0.02;
        scaleX = s;
        scaleY = s;
      }
    } else {
      // Vertical stretch motion blur during high-speed reel spin
      scaleX = 0.94;
      scaleY = 1.12;
    }

    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);

    const pad = 12;
    const boxSize = Math.min(w, h) - pad * 2;
    const bx = -boxSize / 2;
    const by = -boxSize / 2;

    // If this fish was just hooked and reeled out of its slot, show an empty water-ripple socket with "CAUGHT!" badge
    if (isCollectedFish) {
      this._roundRect(ctx, bx, by, boxSize, boxSize, 24);
      ctx.fillStyle = 'rgba(3, 35, 58, 0.48)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '900 22px "Bungee", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4CD964';
      ctx.fillText('HOOKED! 🎣', 0, -10);
      if (cell.money) {
        const val = cell.money.multiplier * (this.currentTotalBet || 2);
        ctx.font = '800 18px "Inter", sans-serif';
        ctx.fillStyle = '#FFE875';
        ctx.fillText(`+$${val.toFixed(val % 1 === 0 ? 0 : 2)}`, 0, 20);
      }
      ctx.restore();
      return;
    }

    const img = this.images[cell.id];
    const royalCanvas = this.royalCanvases[cell.id];

    if (img) {
      ctx.save();
      this._roundRect(ctx, bx, by, boxSize, boxSize, 24);
      ctx.shadowColor =
        isActiveFisherman || highlighted ? '#FFD700' : 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = isActiveFisherman || highlighted ? 26 : 10;
      ctx.fillStyle = '#07263B';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(img, bx, by, boxSize, boxSize);
      ctx.restore();

      if (highlighted || isActiveFisherman) {
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = isActiveFisherman ? '#FF9500' : '#FFD700';
        this._roundRect(ctx, bx, by, boxSize, boxSize, 24);
        ctx.stroke();
      }
    } else if (royalCanvas) {
      ctx.drawImage(royalCanvas, bx, by, boxSize, boxSize);
      if (highlighted) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFD700';
        this._roundRect(ctx, bx + 8, by + 8, boxSize - 16, boxSize - 16, 28);
        ctx.stroke();
      }
    }

    if (cell.id === 'FISH' && cell.money) {
      this._drawFishMoneyTag(ctx, cell.money, boxSize, this.currentTotalBet || 2.0);
    }

    ctx.restore();
  }

  _drawFishMoneyTag(ctx, money, boxSize, totalBet) {
    const cashVal = money.multiplier * totalBet;
    const formatted =
      cashVal >= 1000
        ? `$${(cashVal / 1000).toFixed(cashVal % 1000 === 0 ? 0 : 1)}K`
        : `$${cashVal.toFixed(cashVal < 10 && cashVal % 1 !== 0 ? 2 : 0)}`;

    const tagW = boxSize * 0.78;
    const tagH = 38;
    const tx = -tagW / 2;
    const ty = boxSize / 2 - tagH - 8;

    ctx.save();
    this._roundRect(ctx, tx, ty, tagW, tagH, 12);

    const isHigh = money.multiplier >= 25;
    const pillGrad = ctx.createLinearGradient(0, ty, 0, ty + tagH);
    if (isHigh) {
      pillGrad.addColorStop(0, '#FF453A');
      pillGrad.addColorStop(1, '#8E0000');
    } else {
      pillGrad.addColorStop(0, '#00385C');
      pillGrad.addColorStop(1, '#00172B');
    }
    ctx.fillStyle = pillGrad;
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    ctx.font = '900 21px "Bungee", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFE875';
    ctx.fillText(`${formatted} (${money.multiplier}x)`, 0, ty + tagH / 2 + 1);
    ctx.restore();
  }

  _drawWinningPaylines(ctx, now) {
    const currentWin = this.activeLineWins[this.highlightCycleIndex];
    if (!currentWin) return;

    ctx.save();
    ctx.beginPath();
    for (let c = 0; c < this.cols; c++) {
      const r = currentWin.rows[c];
      const px = this.paddingX + c * this.cellW + this.cellW / 2;
      const py = this.paddingY + r * this.cellH + this.cellH / 2;
      if (c === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = currentWin.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 7;
    ctx.strokeStyle = currentWin.color;
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    const firstRow = currentWin.rows[0];
    const bx = this.paddingX + 38;
    const by = this.paddingY + firstRow * this.cellH + 34;

    this._roundRect(ctx, bx - 30, by - 18, 175, 36, 10);
    ctx.fillStyle = 'rgba(0, 18, 36, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = currentWin.color;
    ctx.stroke();

    ctx.font = '800 16px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`LINE #${currentWin.paylineId}  +$${currentWin.payout.toFixed(2)}`, bx - 20, by);
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
