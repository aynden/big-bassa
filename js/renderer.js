/**
 * Big Bass Splash - High-DPI 60FPS HTML5 Canvas Renderer
 * Renders photorealistic 3D symbol sprites, bespoke 3D glossy water-droplet Royal cards,
 * animated rising bubble column dividers, underwater caustic light beams, payline laser paths,
 * Fish Money cash tags, and special rescue animations (Dynamite, Bazooka, Hook, Fisherman Collect).
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

    // Reel spin animation state per column
    this.reelStates = Array.from({ length: this.cols }, (_, c) => ({
      spinning: false,
      offsetY: 0,
      speed: 0,
      strip: [],
      stopTime: 0,
      bouncePhase: 0,
      locked: false
    }));

    // Ambient rising bubbles between the 5 reels (6 vertical streams)
    this.bubbles = [];
    this._initBubbles();

    // Active visual overlays
    this.activeLineWins = [];
    this.highlightCycleIndex = 0;
    this.highlightTimer = 0;
    this.highlightedPositions = new Set(); // "col,row"

    // Special feature animations (fishing lines, hooks, dynamite, floating popups)
    this.projectiles = [];
    this.fishingLines = [];
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

      // Rounded wooden/brass outer slot tile backing
      const r = 38;
      c.save();
      this._roundRect(c, 12, 12, size - 24, size - 24, r);
      const bgGrad = c.createRadialGradient(size / 2, size / 2, 15, size / 2, size / 2, size / 1.7);
      bgGrad.addColorStop(0, 'rgba(10, 62, 92, 0.85)');
      bgGrad.addColorStop(1, 'rgba(3, 24, 42, 0.94)');
      c.fillStyle = bgGrad;
      c.fill();

      // Golden brass border
      c.lineWidth = 8;
      const rimGrad = c.createLinearGradient(0, 0, size, size);
      rimGrad.addColorStop(0, '#FFE484');
      rimGrad.addColorStop(0.5, '#C98A27');
      rimGrad.addColorStop(1, '#784B08');
      c.strokeStyle = rimGrad;
      c.stroke();

      // Inner highlight ring
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      this._roundRect(c, 18, 18, size - 36, size - 36, r - 4);
      c.stroke();

      // 3D Extruded Letter
      c.font = '900 132px "Bungee", "Impact", "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const cx = size / 2;
      const cy = size / 2 + 6;

      // Deep drop shadow & 3D depth layers
      c.fillStyle = 'rgba(0, 0, 0, 0.65)';
      for (let d = 10; d >= 1; d--) {
        c.fillText(sym.label, cx + d * 0.6, cy + d * 1.1);
      }

      // Outer gold/cream stroke
      c.lineWidth = 14;
      c.lineJoin = 'round';
      c.strokeStyle = sym.rimColor;
      c.strokeText(sym.label, cx, cy);

      // Dark inner bevel stroke
      c.lineWidth = 6;
      c.strokeStyle = sym.secondaryColor;
      c.strokeText(sym.label, cx, cy);

      // Glossy 3D gradient fill
      const textGrad = c.createLinearGradient(cx, cy - 65, cx, cy + 65);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(0.22, sym.primaryColor);
      textGrad.addColorStop(0.75, sym.primaryColor);
      textGrad.addColorStop(1, sym.secondaryColor);
      c.fillStyle = textGrad;
      c.fillText(sym.label, cx, cy);

      // Water droplets & specular shine on the letter
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
    // Create 6 vertical bubble streams (left edge, 4 reel dividers, right edge)
    for (let divider = 0; divider <= this.cols; divider++) {
      const baseX = this.paddingX + divider * this.cellW;
      for (let i = 0; i < 14; i++) {
        this.bubbles.push({
          baseX,
          x: baseX + (Math.random() - 0.5) * 12,
          y: Math.random() * this.height,
          r: 2.2 + Math.random() * 5.2,
          speed: 35 + Math.random() * 55,
          wobbleSpeed: 1.5 + Math.random() * 2.5,
          wobbleOffset: Math.random() * Math.PI * 2,
          alpha: 0.35 + Math.random() * 0.5
        });
      }
    }
  }

  setGrid(grid) {
    this.grid = grid;
  }

  clearHighlights() {
    this.activeLineWins = [];
    this.highlightedPositions.clear();
    this.fishingLines = [];
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
   * Start main render loop
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
   * Animate a 5-reel spin to targetGrid
   */
  spinToGrid(targetGrid, { turbo = false, lockedCols = [], onReelStop = null } = {}) {
    this.clearHighlights();
    const now = performance.now();
    const symbolKeys = Object.keys(SYMBOLS);

    const baseDuration = turbo ? 260 : 680;
    const stagger = turbo ? 75 : 190;

    // Check if earlier columns have scatters to add suspense delay on later reels
    let scatterCountSoFar = 0;

    const promises = [];

    for (let c = 0; c < this.cols; c++) {
      if (lockedCols.includes(c)) {
        this.grid[c] = targetGrid[c];
        continue;
      }

      const hasScatterInCol = targetGrid[c].some(cell => cell.id === 'SCATTER');
      const suspenseDelay = (!turbo && scatterCountSoFar >= 2) ? 550 : 0;
      if (hasScatterInCol) scatterCountSoFar++;

      const stopTime = now + baseDuration + c * stagger + suspenseDelay;

      // Create dummy strip of random symbols for motion blur scrolling
      const strip = Array.from({ length: 6 }, () => {
        const randId = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        return { id: randId, symbol: SYMBOLS[randId], money: randId === 'FISH' ? { multiplier: 10, tier: 'medium' } : null };
      });

      const state = this.reelStates[c];
      state.spinning = true;
      state.offsetY = 0;
      state.speed = turbo ? 2600 : 1950;
      state.strip = strip;
      state.stopTime = stopTime;
      state.targetCol = targetGrid[c];

      promises.push(
        new Promise(resolve => {
          state.onFinished = () => {
            this.grid[c] = targetGrid[c];
            if (onReelStop) onReelStop(c, hasScatterInCol);
            resolve();
          };
        })
      );
    }

    return Promise.all(promises);
  }

  /**
   * Animate 2-Scatter Nudge down 1 row + respin other columns
   */
  async playNudgeRespin(event, totalBet, turbo = false) {
    // Visual popup banner
    this.addFloatingText(this.width / 2, this.height / 2, 'NUDGE & RESPIN!', '#00E5FF', 54, 1.3);
    this.audio.playHookPull();

    // Flash locked scatter columns and nudge them down
    for (const c of event.lockedCols) {
      const cx = this.paddingX + c * this.cellW + this.cellW / 2;
      this.spawnSplashParticles(cx, this.height / 2, 24, '#00E5FF');
    }

    await this.spinToGrid(event.toGrid, {
      turbo,
      lockedCols: [],
      onReelStop: (c, hasScatter) => this.audio.playReelStop(c, hasScatter)
    });
  }

  /**
   * Animate Hook pulling a reel up to reveal a 3rd Scatter or a Fisherman Wild
   */
  async playHookPullAnimation(col, row, targetGrid, labelText = 'HOOK FEATURE!') {
    this.audio.playHookPull();
    const targetX = this.paddingX + col * this.cellW + this.cellW / 2;
    const targetY = this.paddingY + row * this.cellH + this.cellH / 2;

    this.addFloatingText(this.width / 2, 110, labelText, '#FFD700', 52, 1.4);

    return new Promise(resolve => {
      const startTime = performance.now();
      const duration = 950;

      const hookAnim = {
        update: now => {
          const t = Math.min(1, (now - startTime) / duration);
          // Drop down first half, yank up second half
          const hookY = t < 0.45
            ? (t / 0.45) * (targetY + 40)
            : (targetY + 40) - ((t - 0.45) / 0.55) * 90;

          hookAnim.currentX = targetX;
          hookAnim.currentY = hookY;

          if (t >= 0.5 && !hookAnim.swapped) {
            hookAnim.swapped = true;
            this.grid = targetGrid;
            this.spawnSplashParticles(targetX, targetY, 35, '#FFD700');
            this.audio.playReelStop(col, true);
          }

          if (t >= 1) {
            this.projectiles = this.projectiles.filter(p => p !== hookAnim);
            resolve();
          }
        },
        draw: ctx => {
          const x = hookAnim.currentX || targetX;
          const y = hookAnim.currentY || 0;
          ctx.save();
          // taut fishing line from top
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, y - 25);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#E2F1FF';
          ctx.stroke();

          // Metallic J-Hook
          ctx.beginPath();
          ctx.arc(x + 12, y - 10, 18, Math.PI, 0, true);
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#D4DCE8';
          ctx.stroke();

          // Red/Gold Lure at hook top
          ctx.beginPath();
          ctx.arc(x, y - 25, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#FF3B30';
          ctx.fill();
          ctx.restore();
        }
      };

      this.projectiles.push(hookAnim);
    });
  }

  /**
   * Animate Dynamite or Bazooka blasting non-fish cells into Fish Money symbols
   */
  async playRescueExplosion(event) {
    const isDynamite = event.type === 'RESCUE_DYNAMITE';
    const banner = isDynamite ? '🧨 DYNAMITE FEATURE!' : '🚀 BAZOOKA FEATURE!';
    this.addFloatingText(this.width / 2, 110, banner, '#FF5E3A', 54, 1.4);

    for (const target of event.targets) {
      const tx = this.paddingX + target.col * this.cellW + this.cellW / 2;
      const ty = this.paddingY + target.row * this.cellH + this.cellH / 2;

      await new Promise(resolve => {
        const startX = isDynamite ? this.width / 2 : 0;
        const startY = isDynamite ? this.height : ty;
        const startTime = performance.now();
        const dur = 320;

        const proj = {
          update: now => {
            const t = Math.min(1, (now - startTime) / dur);
            proj.x = startX + (tx - startX) * t;
            proj.y = startY + (ty - startY) * t - (isDynamite ? Math.sin(t * Math.PI) * 140 : 0);

            if (t >= 1) {
              this.projectiles = this.projectiles.filter(p => p !== proj);
              this.grid[target.col][target.row] = target.cell;
              this.audio.playExplosion();
              this.spawnSplashParticles(tx, ty, 38, '#FF8A00');
              resolve();
            }
          },
          draw: ctx => {
            ctx.save();
            ctx.font = '44px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isDynamite ? '🧨' : '🚀', proj.x || startX, proj.y || startY);
            ctx.restore();
          }
        };
        this.projectiles.push(proj);
      });
    }

    this.grid = event.toGrid;
  }

  /**
   * Animate Fisherman Wild(s) casting fishing lines to collect all Fish Money symbols on screen
   */
  async playFishermanCollect(fishCollection, totalBet, formatCurrency) {
    const { wilds, fishes, levelMultiplier } = fishCollection;
    if (!wilds.length || !fishes.length) return;

    for (const wildPos of wilds) {
      const wx = this.paddingX + wildPos.col * this.cellW + this.cellW / 2;
      const wy = this.paddingY + wildPos.row * this.cellH + this.cellH / 2;

      this.fishingLines = fishes.map(f => ({
        fromX: wx,
        fromY: wy,
        toX: this.paddingX + f.col * this.cellW + this.cellW / 2,
        toY: this.paddingY + f.row * this.cellH + this.cellH / 2,
        progress: 0
      }));

      this.audio.playFishCollect();

      for (const f of fishes) {
        const fx = this.paddingX + f.col * this.cellW + this.cellW / 2;
        const fy = this.paddingY + f.row * this.cellH + this.cellH / 2;
        const cashVal = f.cell.money.multiplier * totalBet * levelMultiplier;
        this.spawnSplashParticles(fx, fy, 20, '#FFD700');
        this.addFloatingText(
          fx,
          fy,
          `+${formatCurrency(cashVal)}${levelMultiplier > 1 ? ` (${levelMultiplier}x)` : ''}`,
          '#4CD964',
          32,
          1.1
        );
      }

      await new Promise(r => setTimeout(r, 750));

      this.addFloatingText(
        wx,
        wy - 20,
        `COLLECTED ${formatCurrency(fishCollection.singleFishermanTotal)}!`,
        '#FFD700',
        40,
        1.3
      );
      this.spawnSplashParticles(wx, wy, 36, '#FFD700');
      await new Promise(r => setTimeout(r, 450));
      this.fishingLines = [];
    }
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
      const speed = 80 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: 3 + Math.random() * 6,
        color,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35
      });
    }
  }

  update(dt, now) {
    // 1. Update rising water bubbles
    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      b.x = b.baseX + Math.sin(now * 0.002 * b.wobbleSpeed + b.wobbleOffset) * 8;
      if (b.y < -15) {
        b.y = this.height + 15;
      }
    }

    // 2. Update spinning reels
    for (let c = 0; c < this.cols; c++) {
      const state = this.reelStates[c];
      if (state.spinning) {
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
        state.bouncePhase = Math.max(0, state.bouncePhase - dt * 5.5);
      }
    }

    // 3. Cycle active payline highlights
    if (this.activeLineWins.length > 0) {
      this.highlightTimer += dt;
      if (this.highlightTimer >= 1.35) {
        this.highlightTimer = 0;
        this.highlightCycleIndex = (this.highlightCycleIndex + 1) % this.activeLineWins.length;
      }
    }

    // 4. Update projectiles
    for (const p of [...this.projectiles]) {
      if (p.update) p.update(now);
    }

    // 5. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 380 * dt; // gravity
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 6. Update floating texts
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

    // 1. Translucent Underwater Reel Stage Backing with Golden Wood & Rope Frame
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

        if (state.spinning) {
          // Draw scrolling blurred strip
          for (let r = -1; r < this.rows; r++) {
            const cell = state.strip[r + 1];
            const cellY = this.paddingY + r * this.cellH + state.offsetY;
            this._drawSymbolCell(ctx, cell, colX, cellY, this.cellW, this.cellH, {
              spinning: true,
              highlighted: false,
              dimmed: false,
              now
            });
          }
        } else {
          // Landing spring bounce
          const bounceY =
            state.bouncePhase > 0
              ? Math.sin(state.bouncePhase * Math.PI) * 16
              : 0;

          for (let r = 0; r < this.rows; r++) {
            const cell = this.grid[c][r];
            const cellY = this.paddingY + r * this.cellH + bounceY;
            const key = `${c},${r}`;
            const hasWins = this.highlightedPositions.size > 0;
            const isHighlighted = this.highlightedPositions.has(key);

            this._drawSymbolCell(ctx, cell, colX, cellY, this.cellW, this.cellH, {
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

    // 3. Rising Air Bubble Column Dividers (signature Big Bass Splash look!)
    this._drawBubbleDividers(ctx);

    // 4. Active Winning Payline Laser Path & Badge
    if (this.activeLineWins.length > 0) {
      this._drawWinningPaylines(ctx, now);
    }

    // 5. Fisherman Collection Lines
    if (this.fishingLines.length > 0) {
      this._drawFishingLines(ctx, now);
    }

    // 6. Active Projectiles (Hooks, Dynamite, Bazooka)
    for (const p of this.projectiles) {
      if (p.draw) p.draw(ctx);
    }

    // 7. Splash & Coin Particles
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

    // 8. Floating Win / Feature Texts
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
  }

  _drawReelFrame(ctx, now) {
    ctx.save();
    // Deep translucent underwater glass panel
    this._roundRect(ctx, this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 20);
    const waterGrad = ctx.createLinearGradient(0, this.paddingY, 0, this.height - this.paddingY);
    waterGrad.addColorStop(0, 'rgba(7, 74, 108, 0.58)');
    waterGrad.addColorStop(0.5, 'rgba(4, 45, 72, 0.68)');
    waterGrad.addColorStop(1, 'rgba(2, 24, 44, 0.78)');
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Animated underwater caustic sunbeams
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const beamX = 180 + i * 260 + Math.sin(now * 0.0007 + i) * 55;
      const beamGrad = ctx.createLinearGradient(beamX, 0, beamX + 90, this.height);
      beamGrad.addColorStop(0, 'rgba(135, 245, 255, 0.11)');
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
    // Subtle vertical glow lines between reels
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

    // Rising translucent air bubbles
    for (const b of this.bubbles) {
      if (b.y < this.paddingY || b.y > this.height - this.paddingY) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(185, 245, 255, ${b.alpha * 0.45})`;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.stroke();

      // Tiny specular highlight dot inside bubble
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSymbolCell(ctx, cell, x, y, w, h, { spinning, highlighted, dimmed, now }) {
    if (!cell) return;
    ctx.save();

    const cx = x + w / 2;
    const cy = y + h / 2;

    if (dimmed) {
      ctx.globalAlpha = 0.42;
    }

    // Pulse animation when highlighted on a winning line
    let scale = 1.0;
    if (highlighted) {
      scale = 1.06 + Math.sin(now * 0.01) * 0.04;
    }

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const pad = 12;
    const boxSize = Math.min(w, h) - pad * 2;
    const bx = -boxSize / 2;
    const by = -boxSize / 2;

    const img = this.images[cell.id];
    const royalCanvas = this.royalCanvases[cell.id];

    if (img) {
      // Draw rounded clip around photorealistic 3D symbol artwork
      ctx.save();
      this._roundRect(ctx, bx, by, boxSize, boxSize, 24);
      ctx.shadowColor = highlighted ? '#FFD700' : 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = highlighted ? 24 : 10;
      ctx.fillStyle = '#07263B';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(img, bx, by, boxSize, boxSize);
      ctx.restore();

      // Golden glow border if winning symbol
      if (highlighted) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFD700';
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

    // If this is a FISH Money symbol, draw its glowing cash multiplier tag!
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

    // Color-coded pill based on prize tier
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
    // Draw currently cycled payline prominently, and others softly
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

    // Draw payline number & payout badge at start of line
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

  _drawFishingLines(ctx, now) {
    ctx.save();
    for (const line of this.fishingLines) {
      ctx.beginPath();
      ctx.moveTo(line.fromX, line.fromY);
      const midX = (line.fromX + line.toX) / 2;
      const midY = Math.min(line.fromY, line.toY) - 45;
      ctx.quadraticCurveTo(midX, midY, line.toX, line.toY);

      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FFF5B8';
      ctx.stroke();

      // Hook icon at target fish
      ctx.beginPath();
      ctx.arc(line.toX, line.toY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
    }
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
