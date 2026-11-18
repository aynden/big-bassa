/**
 * Big Bass Splash™ — Hardware-Accelerated WebGL Renderer (PixiJS v7 + GSAP v3)
 *
 * Authentic Pragmatic Play / Reel Kingdom Visual Architecture:
 *  1. Frameless Transparent 3D Cutout Symbols floating directly in clear underwater columns
 *     (NO square wooden tiles around regular symbols or royals!).
 *  2. 5 Distinct Fish Money Sizes & Textures:
 *     - Small Green Bass (2x, 5x) -> 0.68x scale
 *     - Medium Green Bass (10x, 15x, 20x) -> 0.85x scale
 *     - Large Double Bass Shoal (25x, 50x) -> 1.0x scale
 *     - Huge Golden Crowned Trophy Bass (100x+) -> 1.14x scale with golden aura
 *  3. Real-time WebGL DisplacementFilter underwater wave shader & BlurFilter Y-motion blur on spinning reels.
 *  4. Breakout Z-Order Win & Fisherman Animations:
 *     - Winning symbols, Scatters, and Fisherman Wilds reparent onto the unclipped Breakout Layer so
 *       they expand, pop out over adjacent cells, and cast fishing lines across the entire stage.
 *  5. Physical GSAP-Timeline Fisherman Reeling & Netting:
 *     - Fisherman casts curved carbon rod & bobber -> hooks fish -> fish physically wriggles and
 *       flies along a Bezier arc into Fisherman's net with water splashes -> live counter increments ->
 *       golden orb shoots up into the top multiplier trail!
 */

import * as PIXI from './vendor/pixi.min.mjs';
import { GAME_CONFIG, SYMBOLS } from './config.js';

export class ReelRenderer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;

    this.width = 1200;
    this.height = 690;

    this.cols = GAME_CONFIG.REELS;
    this.rows = GAME_CONFIG.ROWS;
    this.paddingX = 36;
    this.paddingY = 24;
    this.gridWidth = this.width - this.paddingX * 2;
    this.gridHeight = this.height - this.paddingY * 2;
    this.cellW = this.gridWidth / this.cols;
    this.cellH = this.gridHeight / this.rows;

    // Initialize PixiJS v7 WebGL Application attached to #slot-canvas
    this.app = new PIXI.Application({
      view: this.canvas,
      width: this.width,
      height: this.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true
    });

    // Master stage hierarchy
    this.rootContainer = new PIXI.Container();
    this.app.stage.addChild(this.rootContainer);

    // Layer 1: Translucent underwater reel stage backing, caustics & ambient swimming fish
    this.waterStageLayer = new PIXI.Container();
    this.rootContainer.addChild(this.waterStageLayer);

    // Layer 2: Masked 5-column reel container (clips scrolling reels cleanly at top/bottom)
    this.reelsViewport = new PIXI.Container();
    this.rootContainer.addChild(this.reelsViewport);

    this.reelsMask = new PIXI.Graphics();
    this.reelsMask.beginFill(0xffffff);
    this.reelsMask.drawRoundedRect(this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 22);
    this.reelsMask.endFill();
    this.rootContainer.addChild(this.reelsMask);
    this.reelsViewport.mask = this.reelsMask;

    // Layer 3: Rising Bubble Column Dividers & Golden Rope/Wood Outer Frame
    this.frameAndBubblesLayer = new PIXI.Container();
    this.rootContainer.addChild(this.frameAndBubblesLayer);

    // Layer 4: Payline Laser Traces
    this.paylineGraphics = new PIXI.Graphics();
    this.paylineBadgeContainer = new PIXI.Container();
    this.rootContainer.addChild(this.paylineGraphics);
    this.rootContainer.addChild(this.paylineBadgeContainer);

    // Layer 5: UNCLIPPED BREAKOUT LAYER (Fisherman casting, wriggling hooked fish, explosions, floating texts)
    this.breakoutLayer = new PIXI.Container();
    this.rootContainer.addChild(this.breakoutLayer);

    // Texture cache
    this.textures = {};
    this.images = {}; // Also keep raw HTMLImageElement references for the pre-bonus lasso canvas

    // Current logical 5x3 grid
    this.grid = null;
    this.currentTotalBet = 2.0;

    // Per-column Pixi containers, BlurFilter, and cell display objects
    this.reelColumns = [];
    this.cellContainers = Array.from({ length: this.cols }, () => []);

    // Active state
    this.activeLineWins = [];
    this.highlightCycleIndex = 0;
    this.highlightTimer = 0;
    this.highlightedPositions = new Set();
    this.collectedFishSet = new Set();
    this.activeFishermanState = null;

    // Animated ambient objects
    this.bubbles = [];
    this.bgFish = [];
    this.causticBeams = [];
    this.particles = [];
    this.waterRings = [];
    this.floatingTexts = [];
    this.customRenderCallbacks = [];

    this.shakeTime = 0;
    this.shakeMagnitude = 0;
  }

  /**
   * Load all transparent PNG cutouts + generate procedural 3D frameless Royals & displacement map
   */
  async loadAssets() {
    const toLoad = [];
    for (const sym of Object.values(SYMBOLS)) {
      if (sym.image) toLoad.push({ key: sym.id, url: sym.image });
      if (sym.shoalImage) toLoad.push({ key: 'FISH_SHOAL', url: sym.shoalImage });
      if (sym.goldenImage) toLoad.push({ key: 'FISH_GOLDEN', url: sym.goldenImage });
    }

    await Promise.all(
      toLoad.map(
        item =>
          new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              this.images[item.key] = img;
              this.textures[item.key] = PIXI.Texture.from(img);
              resolve();
            };
            img.onerror = () => {
              console.warn('Failed to load texture:', item.url);
              resolve();
            };
            img.src = item.url;
          })
      )
    );

    this._generateFrameless3DRoyalTextures();
    this._generateBubbleAndParticleTextures();
    this._buildUnderwaterStage();
    this._buildReelColumns();
  }

  /**
   * Generate frameless, floating 3D glossy water-droplet Royal letters (10, J, Q, K, A)
   * with NO square box background—just like Pragmatic Play's Big Bass Splash!
   */
  _generateFrameless3DRoyalTextures() {
    const royals = Object.values(SYMBOLS).filter(s => s.type === 'low');
    for (const sym of royals) {
      const size = 280;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const c = off.getContext('2d');

      const cx = size / 2;
      const cy = size / 2 + 8;

      c.save();
      c.font = '900 158px "Bungee", "Impact", "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.miterLimit = 2;

      // Soft outer water glow & deep 3D extrusion shadow
      c.shadowColor = 'rgba(0, 12, 26, 0.85)';
      c.shadowBlur = 18;
      c.shadowOffsetY = 10;

      for (let d = 14; d >= 1; d--) {
        c.fillStyle = d > 10 ? '#1A0B02' : sym.secondaryColor;
        c.fillText(sym.label, cx + d * 0.5, cy + d * 1.15);
      }

      c.shadowBlur = 0;
      c.shadowOffsetY = 0;

      // Thick outer golden-cream cartoon rim
      c.lineWidth = 22;
      c.strokeStyle = sym.rimColor;
      c.strokeText(sym.label, cx, cy);

      // Rich inner dark bevel stroke
      c.lineWidth = 10;
      c.strokeStyle = sym.secondaryColor;
      c.strokeText(sym.label, cx, cy);

      // High-gloss candy gradient fill
      const textGrad = c.createLinearGradient(cx, cy - 75, cx, cy + 75);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(0.18, sym.primaryColor);
      textGrad.addColorStop(0.72, sym.primaryColor);
      textGrad.addColorStop(1, sym.secondaryColor);
      c.fillStyle = textGrad;
      c.fillText(sym.label, cx, cy);

      // Crisp specular highlight arc across top of letter
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      c.strokeText(sym.label, cx - 1, cy - 2);

      // 3D Water Droplets clinging to the letter
      const droplets = [
        { x: cx - 38, y: cy - 34, rad: 7.5 },
        { x: cx + 42, y: cy - 20, rad: 6.0 },
        { x: cx - 22, y: cy + 32, rad: 8.5 },
        { x: cx + 28, y: cy + 38, rad: 5.5 },
        { x: cx + 6,  y: cy - 46, rad: 5.0 }
      ];
      for (const drop of droplets) {
        c.beginPath();
        c.arc(drop.x, drop.y + 2, drop.rad, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0, 0, 0, 0.35)';
        c.fill();

        c.beginPath();
        c.arc(drop.x, drop.y, drop.rad, 0, Math.PI * 2);
        const dGrad = c.createRadialGradient(
          drop.x - drop.rad * 0.3,
          drop.y - drop.rad * 0.3,
          1,
          drop.x,
          drop.y,
          drop.rad
        );
        dGrad.addColorStop(0, '#FFFFFF');
        dGrad.addColorStop(0.5, 'rgba(190, 245, 255, 0.85)');
        dGrad.addColorStop(1, 'rgba(0, 140, 210, 0.45)');
        c.fillStyle = dGrad;
        c.fill();
      }

      c.restore();
      this.textures[sym.id] = PIXI.Texture.from(off);
    }
  }

  _generateBubbleAndParticleTextures() {
    // Glossy water bubble sprite texture
    const bCan = document.createElement('canvas');
    bCan.width = 64;
    bCan.height = 64;
    const bc = bCan.getContext('2d');
    const grad = bc.createRadialGradient(22, 20, 4, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.3, 'rgba(165, 242, 255, 0.45)');
    grad.addColorStop(0.85, 'rgba(80, 215, 255, 0.25)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
    bc.beginPath();
    bc.arc(32, 32, 26, 0, Math.PI * 2);
    bc.fillStyle = grad;
    bc.fill();
    bc.lineWidth = 2;
    bc.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    bc.stroke();
    this.textures['BUBBLE'] = PIXI.Texture.from(bCan);

    // Procedural noise texture for WebGL Underwater Displacement Shader
    const dispCan = document.createElement('canvas');
    dispCan.width = 256;
    dispCan.height = 256;
    const dc = dispCan.getContext('2d');
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x += 4) {
        const v1 = Math.floor(128 + Math.sin((x / 256) * Math.PI * 4) * 60 + Math.cos((y / 256) * Math.PI * 4) * 60);
        const v2 = Math.floor(128 + Math.cos((x / 256) * Math.PI * 4) * 60 - Math.sin((y / 256) * Math.PI * 4) * 60);
        dc.fillStyle = `rgb(${v1}, ${v2}, 128)`;
        dc.fillRect(x, y, 4, 4);
      }
    }
    const dispTex = PIXI.Texture.from(dispCan);
    dispTex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    this.displacementSprite = new PIXI.Sprite(dispTex);
    this.displacementFilter = new PIXI.DisplacementFilter(this.displacementSprite, 14);
  }

  _buildUnderwaterStage() {
    // 1. Subtle dark-turquoise glass backing behind the 5x3 grid so symbols pop against the canyon lake
    const glass = new PIXI.Graphics();
    glass.beginFill(0x032238, 0.42);
    glass.drawRoundedRect(this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 22);
    glass.endFill();
    this.waterStageLayer.addChild(glass);

    // Attach WebGL Underwater Displacement Shader to the water stage layer
    this.waterStageLayer.addChild(this.displacementSprite);
    this.waterStageLayer.filters = [this.displacementFilter];

    // 2. Animated Underwater Caustic God-Rays
    for (let i = 0; i < 5; i++) {
      const ray = new PIXI.Graphics();
      ray.beginFill(0x99f6ff, 0.085);
      ray.moveTo(-55, 0);
      ray.lineTo(65, 0);
      ray.lineTo(155, this.gridHeight);
      ray.lineTo(-25, this.gridHeight);
      ray.closePath();
      ray.endFill();
      ray.x = this.paddingX + 120 + i * 230;
      ray.y = this.paddingY;
      this.waterStageLayer.addChild(ray);
      this.causticBeams.push({ sprite: ray, baseX: ray.x, phase: i * 1.3 });
    }

    // 3. Ambient Background Fish Silhouettes swimming peacefully behind the reels
    for (let i = 0; i < 6; i++) {
      const fishG = new PIXI.Graphics();
      const sz = 24 + Math.random() * 20;
      fishG.beginFill(0x011627, 0.35);
      fishG.drawEllipse(0, 0, sz, sz * 0.42);
      fishG.moveTo(-sz * 0.85, 0);
      fishG.lineTo(-sz * 1.38, -sz * 0.42);
      fishG.lineTo(-sz * 1.38, sz * 0.42);
      fishG.closePath();
      fishG.endFill();

      const dir = i % 2 === 0 ? 1 : -1;
      fishG.scale.x = dir;
      fishG.x = Math.random() * this.width;
      fishG.y = this.paddingY + 70 + Math.random() * (this.gridHeight - 140);
      this.waterStageLayer.addChild(fishG);
      this.bgFish.push({
        sprite: fishG,
        speed: (24 + Math.random() * 34) * dir,
        baseY: fishG.y,
        wobble: Math.random() * Math.PI * 2
      });
    }

    // 4. Rising Air Bubble Streams separating the 5 Reels (authentic Big Bass Splash bubble dividers!)
    for (let div = 0; div <= this.cols; div++) {
      const baseX = this.paddingX + div * this.cellW;

      // Soft vertical aqua shimmer line
      if (div > 0 && div < this.cols) {
        const line = new PIXI.Graphics();
        line.lineStyle(2, 0x7ceeff, 0.18);
        line.moveTo(baseX, this.paddingY + 12);
        line.lineTo(baseX, this.height - this.paddingY - 12);
        this.frameAndBubblesLayer.addChild(line);
      }

      for (let i = 0; i < 16; i++) {
        const bSprite = new PIXI.Sprite(this.textures['BUBBLE']);
        bSprite.anchor.set(0.5);
        const scale = 0.12 + Math.random() * 0.24;
        bSprite.scale.set(scale);
        bSprite.alpha = 0.35 + Math.random() * 0.55;
        bSprite.x = baseX + (Math.random() - 0.5) * 14;
        bSprite.y = this.paddingY + Math.random() * this.gridHeight;
        this.frameAndBubblesLayer.addChild(bSprite);

        this.bubbles.push({
          sprite: bSprite,
          baseX,
          speed: 45 + Math.random() * 75,
          wobbleSpeed: 1.8 + Math.random() * 2.5,
          wobbleOffset: Math.random() * Math.PI * 2
        });
      }
    }

    // 5. Sleek Top & Bottom Wood-and-Brass Horizontal Bars (matching the real game's open sides!)
    const borderG = new PIXI.Graphics();
    // Outer subtle rounded frame
    borderG.lineStyle(5, 0xffe07d, 0.75);
    borderG.drawRoundedRect(this.paddingX, this.paddingY, this.gridWidth, this.gridHeight, 22);
    borderG.lineStyle(2, 0x784906, 0.9);
    borderG.drawRoundedRect(this.paddingX - 3, this.paddingY - 3, this.gridWidth + 6, this.gridHeight + 6, 24);
    this.frameAndBubblesLayer.addChild(borderG);
  }

  _buildReelColumns() {
    this.reelColumns = [];
    for (let c = 0; c < this.cols; c++) {
      const colContainer = new PIXI.Container();
      colContainer.x = this.paddingX + c * this.cellW + this.cellW / 2;
      colContainer.y = this.paddingY;

      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blurX = 0;
      blurFilter.blurY = 0;
      colContainer.filters = [blurFilter];

      // Golden Suspense Spotlight behind column (for 3rd Scatter anticipation)
      const spotlight = new PIXI.Graphics();
      spotlight.beginFill(0xffd700, 0.26);
      spotlight.drawRect(-this.cellW / 2, 0, this.cellW, this.gridHeight);
      spotlight.endFill();
      spotlight.visible = false;
      colContainer.addChild(spotlight);

      const symbolsHolder = new PIXI.Container();
      colContainer.addChild(symbolsHolder);

      this.reelsViewport.addChild(colContainer);
      this.reelColumns.push({
        index: c,
        container: colContainer,
        symbolsHolder,
        spotlight,
        blurFilter,
        spinning: false,
        offsetY: 0,
        speed: 0,
        strip: [],
        stopTime: 0,
        isSuspenseReel: false
      });
    }
  }

  /**
   * Create a PixiJS display container for a single symbol cell (frameless 3D cutout + dynamic Fish Money badge)
   */
  _createSymbolNode(cell, col, row) {
    const node = new PIXI.Container();
    node.cellData = cell;
    node.gridCol = col;
    node.gridRow = row;

    if (!cell) return node;

    // Choose texture & natural scale
    let tex = this.textures[cell.id];
    let baseScale = 1.0;

    if (cell.id === 'FISH' && cell.money) {
      const mult = cell.money.multiplier;
      if (mult >= 100 && this.textures['FISH_GOLDEN']) {
        tex = this.textures['FISH_GOLDEN'];
        baseScale = 1.12;
      } else if (mult >= 25 && this.textures['FISH_SHOAL']) {
        tex = this.textures['FISH_SHOAL'];
        baseScale = 1.02;
      } else if (mult >= 10) {
        tex = this.textures['FISH'];
        baseScale = 0.88;
      } else {
        tex = this.textures['FISH'];
        baseScale = 0.72;
      }
    } else if (cell.id === 'WILD' || cell.id === 'SCATTER') {
      baseScale = 1.02;
    } else if (cell.symbol?.type === 'high') {
      baseScale = 0.96;
    } else {
      baseScale = 0.84;
    }

    node.baseScale = baseScale;

    // Soft underwater drop shadow sprite behind frameless symbol
    if (tex && cell.id !== 'WILD' && cell.id !== 'SCATTER') {
      const shadowSprite = new PIXI.Sprite(tex);
      shadowSprite.anchor.set(0.5);
      const targetDim = Math.min(this.cellW, this.cellH) * 0.84 * baseScale;
      const sFactor = targetDim / Math.max(tex.width || 256, tex.height || 256);
      shadowSprite.scale.set(sFactor);
      shadowSprite.tint = 0x000b18;
      shadowSprite.alpha = 0.45;
      shadowSprite.x = 5;
      shadowSprite.y = 10;
      node.addChild(shadowSprite);
      node.shadowSprite = shadowSprite;
    }

    // Main high-res 3D cutout sprite
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      const targetDim = Math.min(this.cellW, this.cellH) * 0.84 * baseScale;
      const sFactor = targetDim / Math.max(tex.width || 256, tex.height || 256);
      sprite.scale.set(sFactor);
      node.baseSpriteScale = sFactor;
      node.addChild(sprite);
      node.mainSprite = sprite;
    }

    // If FISH Money symbol, attach glowing 3D casino cash value pill!
    if (cell.id === 'FISH' && cell.money) {
      const badge = this._createFishMoneyBadge(cell.money, this.currentTotalBet || 2.0);
      badge.y = this.cellH * 0.30;
      node.addChild(badge);
      node.moneyBadge = badge;
    }

    return node;
  }

  _createFishMoneyBadge(money, totalBet) {
    const container = new PIXI.Container();
    const cashVal = money.multiplier * totalBet;
    const formatted =
      cashVal >= 1000
        ? `$${(cashVal / 1000).toFixed(cashVal % 1000 === 0 ? 0 : 1)}K`
        : `$${cashVal.toFixed(cashVal < 10 && cashVal % 1 !== 0 ? 2 : 0)}`;

    const isJackpot = money.multiplier >= 100;
    const isHigh = money.multiplier >= 25;

    const pillW = 158;
    const pillH = 38;
    const bg = new PIXI.Graphics();
    bg.lineStyle(2.5, isJackpot ? 0xffffff : 0xffd700, 1);
    bg.beginFill(isJackpot ? 0xd97706 : isHigh ? 0xb91c1c : 0x032b47, 0.94);
    bg.drawRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 12);
    bg.endFill();
    container.addChild(bg);

    const style = new PIXI.TextStyle({
      fontFamily: 'Bungee, Impact, Arial Black, sans-serif',
      fontSize: 19,
      fontWeight: '900',
      fill: ['#FFFFFF', '#FFE66D'],
      stroke: '#001529',
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 2
    });

    const label = new PIXI.Text(`${formatted} (${money.multiplier}x)`, style);
    label.anchor.set(0.5);
    container.addChild(label);
    return container;
  }

  setGrid(grid) {
    this.grid = grid;
    this.collectedFishSet.clear();
    this._rebuildStaticGridNodes();
  }

  _rebuildStaticGridNodes() {
    if (!this.grid) return;
    for (let c = 0; c < this.cols; c++) {
      const colObj = this.reelColumns[c];
      colObj.symbolsHolder.removeChildren();
      this.cellContainers[c] = [];

      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        const node = this._createSymbolNode(cell, c, r);
        node.x = 0;
        node.y = r * this.cellH + this.cellH / 2;
        colObj.symbolsHolder.addChild(node);
        this.cellContainers[c][r] = node;
      }
    }
  }

  clearHighlights() {
    this.activeLineWins = [];
    this.highlightedPositions.clear();
    this.collectedFishSet.clear();
    this.activeFishermanState = null;
    this.paylineGraphics.clear();
    this.paylineBadgeContainer.removeChildren();

    // Restore alpha/scale on all static nodes
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const node = this.cellContainers[c]?.[r];
        if (node) {
          node.alpha = 1;
          node.scale.set(1);
        }
      }
    }
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
    this._drawCurrentPaylineLaser();
  }

  startLoop() {
    this.app.ticker.add(() => {
      const dt = Math.min(0.05, this.app.ticker.deltaMS / 1000);
      const now = performance.now();
      this.update(dt, now);
    });
  }

  triggerScreenShake(duration = 0.35, magnitude = 14) {
    this.shakeTime = duration;
    this.shakeMagnitude = magnitude;
  }

  addWaterRing(x, y, maxRadius = 120, colorHex = 0x8ceeff) {
    const color = typeof colorHex === 'string' ? parseInt(colorHex.replace('#', ''), 16) : colorHex;
    const g = new PIXI.Graphics();
    g.x = x;
    g.y = y;
    this.breakoutLayer.addChild(g);
    this.waterRings.push({
      graphics: g,
      color,
      r: 10,
      maxR: maxRadius,
      life: 0,
      maxLife: 0.55
    });
  }

  spawnSplashParticles(x, y, count = 26, colorHex = '#00E5FF') {
    const color = typeof colorHex === 'string' ? parseInt(colorHex.replace('#', ''), 16) : colorHex;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 280;
      const pSprite = new PIXI.Sprite(this.textures['BUBBLE']);
      pSprite.anchor.set(0.5);
      pSprite.tint = color;
      const sc = 0.1 + Math.random() * 0.22;
      pSprite.scale.set(sc);
      pSprite.x = x;
      pSprite.y = y;
      this.breakoutLayer.addChild(pSprite);

      this.particles.push({
        sprite: pSprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 85,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.35
      });
    }
  }

  addFloatingText(x, y, text, color = '#FFD700', size = 40, duration = 1.25) {
    const style = new PIXI.TextStyle({
      fontFamily: 'Bungee, Impact, Arial Black, sans-serif',
      fontSize: size,
      fontWeight: '900',
      fill: [color, '#FFFFFF'],
      stroke: '#001829',
      strokeThickness: 7,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 10,
      dropShadowDistance: 4
    });
    const tSprite = new PIXI.Text(text, style);
    tSprite.anchor.set(0.5);
    tSprite.x = x;
    tSprite.y = y;
    this.breakoutLayer.addChild(tSprite);

    this.floatingTexts.push({
      sprite: tSprite,
      life: 0,
      maxLife: duration
    });
  }

  /**
   * Hardware-accelerated 5-Reel Spin with WebGL Y-Motion Blur & Elastic Bounce Landing
   */
  spinToGrid(targetGrid, { turbo = false, lockedCols = [], onReelStop = null } = {}) {
    this.clearHighlights();
    const now = performance.now();
    const symbolKeys = Object.keys(SYMBOLS);

    const baseDuration = turbo ? 250 : 650;
    const stagger = turbo ? 75 : 190;

    let scatterCountSoFar = 0;
    let cumulativeSuspense = 0;
    const promises = [];

    for (let c = 0; c < this.cols; c++) {
      const colObj = this.reelColumns[c];
      colObj.spotlight.visible = false;

      if (lockedCols.includes(c)) {
        this.grid[c] = targetGrid[c];
        continue;
      }

      const isSuspenseReel = !turbo && scatterCountSoFar >= 2;
      if (isSuspenseReel) {
        cumulativeSuspense += 640;
      }

      const hasScatterInCol = targetGrid[c].some(cell => cell.id === 'SCATTER');
      const hasWildInCol = targetGrid[c].some(cell => cell.id === 'WILD');
      if (hasScatterInCol) scatterCountSoFar++;

      const stopTime = now + baseDuration + c * stagger + cumulativeSuspense;

      // Populate scrolling strip of 5 symbol nodes for this column
      colObj.symbolsHolder.removeChildren();
      const stripNodes = [];
      for (let r = -1; r <= this.rows; r++) {
        const randId = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const dummyCell = {
          id: randId,
          symbol: SYMBOLS[randId],
          money: randId === 'FISH' ? { multiplier: 10, tier: 'medium' } : null
        };
        const node = this._createSymbolNode(dummyCell, c, r);
        node.y = r * this.cellH + this.cellH / 2;
        colObj.symbolsHolder.addChild(node);
        stripNodes.push(node);
      }

      colObj.spinning = true;
      colObj.offsetY = 0;
      colObj.speed = turbo ? 2800 : isSuspenseReel ? 2550 : 2100;
      colObj.blurFilter.blurY = turbo ? 18 : 14;
      colObj.stripNodes = stripNodes;
      colObj.stopTime = stopTime;
      colObj.isSuspenseReel = isSuspenseReel;

      promises.push(
        new Promise(resolve => {
          colObj.onFinished = () => {
            colObj.spotlight.visible = false;
            colObj.blurFilter.blurY = 0;
            this.grid[c] = targetGrid[c];

            // Rebuild crisp final target column nodes and play elastic bounce!
            colObj.symbolsHolder.removeChildren();
            this.cellContainers[c] = [];
            for (let r = 0; r < this.rows; r++) {
              const cell = targetGrid[c][r];
              const node = this._createSymbolNode(cell, c, r);
              node.x = 0;
              const finalY = r * this.cellH + this.cellH / 2;
              node.y = finalY - 26;
              colObj.symbolsHolder.addChild(node);
              this.cellContainers[c][r] = node;

              if (window.gsap) {
                window.gsap.to(node, {
                  y: finalY,
                  duration: 0.34,
                  ease: 'back.out(2.4)'
                });
              } else {
                node.y = finalY;
              }
            }

            if (hasScatterInCol || hasWildInCol) {
              const rowIdx = targetGrid[c].findIndex(cell => cell.id === 'SCATTER' || cell.id === 'WILD');
              const sx = this.paddingX + c * this.cellW + this.cellW / 2;
              const sy = this.paddingY + rowIdx * this.cellH + this.cellH / 2;
              this.addWaterRing(sx, sy, 125, hasScatterInCol ? 0x00e5ff : 0xffd700);
              this.spawnSplashParticles(sx, sy, 30, hasScatterInCol ? '#80F5FF' : '#FFD700');

              // Dramatic scale punch on landed Scatter or Fisherman Wild!
              const specialNode = this.cellContainers[c][rowIdx];
              if (specialNode && window.gsap) {
                window.gsap.fromTo(
                  specialNode.scale,
                  { x: 1.32, y: 1.32 },
                  { x: 1.0, y: 1.0, duration: 0.45, ease: 'elastic.out(1.2, 0.4)' }
                );
              }
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
   * 2-Scatter Nudge Respin
   */
  async playNudgeRespin(event, totalBet, turbo = false) {
    this.addFloatingText(this.width / 2, this.height / 2, '⏬ NUDGE & RESPIN!', '#00E5FF', 54, 1.3);
    this.audio.playHookPull();
    this.triggerScreenShake(0.25, 10);

    for (const c of event.lockedCols) {
      const cx = this.paddingX + c * this.cellW + this.cellW / 2;
      this.addWaterRing(cx, this.height / 2, 130, 0x00e5ff);
      this.spawnSplashParticles(cx, this.height / 2, 28, '#00E5FF');
    }

    await this.spinToGrid(event.toGrid, {
      turbo,
      lockedCols: [],
      onReelStop: (c, hasScatter) => this.audio.playReelStop(c, hasScatter)
    });
  }

  /**
   * 3D Metal Treble Hook Hoisting a Reel Column Upward
   */
  async playHookPullAnimation(col, row, targetGrid, labelText = '🪝 HOOK FEATURE!') {
    this.audio.playHookPull();
    const targetX = this.paddingX + col * this.cellW + this.cellW / 2;
    const targetY = this.paddingY + row * this.cellH + this.cellH / 2;
    const colObj = this.reelColumns[col];

    this.addFloatingText(this.width / 2, 95, labelText, '#FFD700', 52, 1.45);

    const hookGraphics = new PIXI.Graphics();
    this.breakoutLayer.addChild(hookGraphics);

    return new Promise(resolve => {
      const startTime = performance.now();
      const duration = 1250;
      let latched = false;
      let swapped = false;

      const cb = now => {
        const t = Math.min(1, (now - startTime) / duration);
        let hookY = 0;

        if (t < 0.38) {
          hookY = (t / 0.38) * (targetY + 85);
        } else if (t < 0.52) {
          hookY = targetY + 85;
          if (!latched) {
            latched = true;
            this.triggerScreenShake(0.25, 10);
            this.addWaterRing(targetX, targetY + 60, 125, 0x80f5ff);
            this.spawnSplashParticles(targetX, targetY + 60, 32, '#80F5FF');
          }
        } else {
          const p = (t - 0.52) / 0.48;
          const easeOut = 1 - Math.pow(1 - p, 3);
          hookY = (targetY + 85) - easeOut * 220;
          colObj.symbolsHolder.y = -(1 - easeOut) * 140;

          if (!swapped) {
            swapped = true;
            this.setGrid(targetGrid);
            this.triggerScreenShake(0.35, 14);
            this.addWaterRing(targetX, targetY, 150, 0xffd700);
            this.spawnSplashParticles(targetX, targetY, 45, '#FFD700');
            this.audio.playReelStop(col, true);
          }
        }

        // Draw 3D Treble Hook & Braided Line
        hookGraphics.clear();
        hookGraphics.lineStyle(4.5, 0xe8f6ff, 1);
        hookGraphics.moveTo(targetX, 0);
        hookGraphics.lineTo(targetX, hookY - 40);

        // Red/Gold Swivel
        hookGraphics.lineStyle(2.5, 0xffd700, 1);
        hookGraphics.beginFill(0xd92b2b, 1);
        hookGraphics.drawRoundedRect(targetX - 9, hookY - 45, 18, 22, 6);
        hookGraphics.endFill();

        // Steel J-hooks
        hookGraphics.lineStyle(7, 0xd8e2ee, 1);
        hookGraphics.moveTo(targetX, hookY - 23);
        hookGraphics.lineTo(targetX, hookY + 6);
        hookGraphics.arc(targetX - 20, hookY + 6, 20, 0, Math.PI, false);
        hookGraphics.moveTo(targetX, hookY + 6);
        hookGraphics.arc(targetX + 20, hookY + 6, 20, Math.PI, 0, true);

        if (t >= 1) {
          colObj.symbolsHolder.y = 0;
          this.breakoutLayer.removeChild(hookGraphics);
          hookGraphics.destroy();
          this.customRenderCallbacks = this.customRenderCallbacks.filter(fn => fn !== cb);
          resolve();
        }
      };

      this.customRenderCallbacks.push(cb);
    });
  }

  /**
   * Burning-Fuse Dynamite & Bazooka Missile Rescue Animations
   */
  async playRescueExplosion(event) {
    const isDynamite = event.type === 'RESCUE_DYNAMITE';
    const banner = isDynamite ? '🧨 DYNAMITE FEATURE!' : '🚀 BAZOOKA FEATURE!';
    this.addFloatingText(this.width / 2, 95, banner, '#FF5E3A', 54, 1.45);

    for (const target of event.targets) {
      const tx = this.paddingX + target.col * this.cellW + this.cellW / 2;
      const ty = this.paddingY + target.row * this.cellH + this.cellH / 2;

      const projG = new PIXI.Graphics();
      this.breakoutLayer.addChild(projG);

      await new Promise(resolve => {
        const startX = isDynamite ? this.width / 2 : -40;
        const startY = isDynamite ? this.height + 30 : ty + (Math.random() - 0.5) * 80;
        const startTime = performance.now();
        const dur = isDynamite ? 420 : 340;

        const cb = now => {
          const t = Math.min(1, (now - startTime) / dur);
          const curX = startX + (tx - startX) * t;
          const curY = startY + (ty - startY) * t - (isDynamite ? Math.sin(t * Math.PI) * 190 : 0);

          projG.clear();
          projG.x = curX;
          projG.y = curY;
          projG.rotation = t * Math.PI * (isDynamite ? 3.5 : 0);

          if (isDynamite) {
            projG.lineStyle(2.5, 0xffd700, 1);
            projG.beginFill(0xd91e18, 1);
            projG.drawRoundedRect(-14, -26, 28, 52, 6);
            projG.endFill();
            projG.beginFill(0xfff200, 1);
            projG.drawCircle(6, -38, 7);
            projG.endFill();
          } else {
            projG.beginFill(0xff6b00, 1);
            projG.drawCircle(-26, 0, 12);
            projG.endFill();
            projG.beginFill(0x3a4a5e, 1);
            projG.drawRoundedRect(-20, -10, 40, 20, 6);
            projG.endFill();
            projG.beginFill(0xff2e2e, 1);
            projG.moveTo(16, -11);
            projG.lineTo(34, 0);
            projG.lineTo(16, 11);
            projG.closePath();
            projG.endFill();
          }

          if (t >= 1) {
            this.breakoutLayer.removeChild(projG);
            projG.destroy();
            this.customRenderCallbacks = this.customRenderCallbacks.filter(fn => fn !== cb);

            this.grid[target.col][target.row] = target.cell;
            this._rebuildStaticGridNodes();
            this.audio.playExplosion();
            this.triggerScreenShake(0.32, 16);
            this.addWaterRing(tx, ty, 140, 0xff8a00);
            this.spawnSplashParticles(tx, ty, 42, '#FF9500');
            resolve();
          }
        };
        this.customRenderCallbacks.push(cb);
      });
    }
  }

  /**
   * AUTHENTIC WEBGL FISHERMAN PHYSICAL REELING & NETTING CHOREOGRAPHY:
   *  - Fisherman tile pops out on the unclipped breakout stage with an animated bending fishing rod.
   *  - Casts line & bobber to each fish cell -> fish pops out of its cell onto the unclipped Breakout Layer,
   *    bends/wriggles rapidly as it is physically pulled along the fishing line into the Fisherman's net!
   *  - Live golden counter badge on the Fisherman tile escalates ($20 -> $70 -> $170!).
   *  - Golden Fisherman trail orb shoots up into the top 12-slot multiplier trail!
   */
  async playFishermanCollect(fishCollection, totalBet, formatCurrency, onWildAddedToTrail = null) {
    const { wilds, fishes, levelMultiplier } = fishCollection;
    if (!wilds.length) return;

    const rodGraphics = new PIXI.Graphics();
    this.breakoutLayer.addChild(rodGraphics);

    for (const wildPos of wilds) {
      const wx = this.paddingX + wildPos.col * this.cellW + this.cellW / 2;
      const wy = this.paddingY + wildPos.row * this.cellH + this.cellH / 2;
      const wildNode = this.cellContainers[wildPos.col]?.[wildPos.row];

      if (wildNode && window.gsap) {
        window.gsap.to(wildNode.scale, { x: 1.15, y: 1.15, duration: 0.25, ease: 'back.out(2)' });
      }

      // Live accumulating payout badge below the Fisherman tile
      const counterBadge = new PIXI.Container();
      counterBadge.x = wx;
      counterBadge.y = wy + 68;
      counterBadge.visible = false;
      this.breakoutLayer.addChild(counterBadge);

      let accumulatedWin = 0;
      const updateCounterBadge = val => {
        counterBadge.visible = true;
        counterBadge.removeChildren();
        const bg = new PIXI.Graphics();
        bg.lineStyle(3, 0xfff5b8, 1);
        bg.beginFill(0xd97706, 0.96);
        bg.drawRoundedRect(-86, -22, 172, 44, 14);
        bg.endFill();
        counterBadge.addChild(bg);

        const txt = new PIXI.Text(
          `$${val.toFixed(val % 1 === 0 ? 0 : 2)}${levelMultiplier > 1 ? ` (${levelMultiplier}×)` : ''}`,
          new PIXI.TextStyle({
            fontFamily: 'Bungee, Impact, sans-serif',
            fontSize: 21,
            fontWeight: '900',
            fill: '#FFFFFF',
            stroke: '#3B1800',
            strokeThickness: 4
          })
        );
        txt.anchor.set(0.5);
        counterBadge.addChild(txt);
      };

      this.addWaterRing(wx, wy, 130, 0xffd700);
      this.spawnSplashParticles(wx, wy, 24, '#FFD700');
      this.audio.playHookPull();
      await new Promise(r => setTimeout(r, 200));

      // Reel in every Money Fish on the screen!
      for (const f of fishes) {
        const fx = this.paddingX + f.col * this.cellW + this.cellW / 2;
        const fy = this.paddingY + f.row * this.cellH + this.cellH / 2;
        const baseCash = f.cell.money.multiplier * totalBet;
        const multipliedCash = baseCash * levelMultiplier;
        const fishNode = this.cellContainers[f.col]?.[f.row];

        // 1. Cast fishing line from Fisherman rod tip out to the Fish cell (170ms)
        await new Promise(resolve => {
          const castStart = performance.now();
          const castDur = 170;
          const cb = now => {
            const t = Math.min(1, (now - castStart) / castDur);
            const hx = wx + (fx - wx) * t;
            const hy = wy + (fy - wy) * t - Math.sin(t * Math.PI) * 55;
            this._drawWebGLRodAndLine(rodGraphics, wx, wy, hx, hy, false);
            if (t >= 1) {
              this.customRenderCallbacks = this.customRenderCallbacks.filter(fn => fn !== cb);
              resolve();
            }
          };
          this.customRenderCallbacks.push(cb);
        });

        // 2. Hook snags the fish! Dim original cell & spawn a breakout wriggling fish clone that flies into Fisherman's net!
        if (fishNode) {
          fishNode.alpha = 0.22;
        }
        this.addWaterRing(fx, fy, 115, 0x00e5ff);
        this.spawnSplashParticles(fx, fy, 26, '#80F5FF');
        this.audio.playFishCollect();

        const flyingFishNode = this._createSymbolNode(f.cell, f.col, f.row);
        flyingFishNode.x = fx;
        flyingFishNode.y = fy;
        this.breakoutLayer.addChild(flyingFishNode);

        await new Promise(resolve => {
          const reelStart = performance.now();
          const reelDur = 370;
          const cb = now => {
            const t = Math.min(1, (now - reelStart) / reelDur);
            const ease = t * t * (3 - 2 * t);
            const curX = fx + (wx - fx) * ease;
            const curY = fy + (wy - fy) * ease - Math.sin(t * Math.PI) * 75;

            flyingFishNode.x = curX;
            flyingFishNode.y = curY;
            // Energetic wriggling tail-thrash as the fish is reeled across the water!
            flyingFishNode.rotation = Math.sin(now * 0.055) * 0.36;
            const sc = 1.12 - t * 0.35;
            flyingFishNode.scale.set(sc, sc * (1 + Math.cos(now * 0.055) * 0.12));

            this._drawWebGLRodAndLine(rodGraphics, wx, wy, curX, curY, true);

            if (t >= 1) {
              this.breakoutLayer.removeChild(flyingFishNode);
              flyingFishNode.destroy({ children: true });
              this.customRenderCallbacks = this.customRenderCallbacks.filter(fn => fn !== cb);
              resolve();
            }
          };
          this.customRenderCallbacks.push(cb);
        });

        // 3. Fish lands in Fisherman's net! Punch Fisherman scale & increment live counter badge!
        rodGraphics.clear();
        accumulatedWin = Number((accumulatedWin + multipliedCash).toFixed(2));
        updateCounterBadge(accumulatedWin);

        if (wildNode && window.gsap) {
          window.gsap.fromTo(
            wildNode.scale,
            { x: 1.3, y: 1.3 },
            { x: 1.12, y: 1.12, duration: 0.28, ease: 'back.out(2)' }
          );
        }

        this.triggerScreenShake(0.16, 8);
        this.addWaterRing(wx, wy, 125, 0x4cd964);
        this.spawnSplashParticles(wx, wy, 32, '#FFD700');
        this.addFloatingText(
          wx,
          wy - 55,
          `+${formatCurrency(multipliedCash)}${levelMultiplier > 1 ? ` (${levelMultiplier}×)` : ''}`,
          '#4CD964',
          34,
          0.95
        );
      }

      // Restore fish cell visibility after this fisherman finishes his sweep
      for (const f of fishes) {
        const fishNode = this.cellContainers[f.col]?.[f.row];
        if (fishNode) fishNode.alpha = 1;
      }

      if (fishes.length > 0) {
        this.addFloatingText(
          wx,
          wy - 78,
          `NETTED ${formatCurrency(accumulatedWin)}!`,
          '#FFD700',
          42,
          1.35
        );
      }

      // 4. Shoot glowing golden Fisherman Wild orb up into the top Multiplier Trail bar!
      const orbG = new PIXI.Graphics();
      orbG.beginFill(0xffd700, 1);
      orbG.lineStyle(3, 0xffffff, 1);
      orbG.drawCircle(0, 0, 20);
      orbG.endFill();
      orbG.x = wx;
      orbG.y = wy;
      this.breakoutLayer.addChild(orbG);

      await new Promise(resolve => {
        const orbStart = performance.now();
        const orbDur = 400;
        const targetTrailX = this.width * 0.65;
        const targetTrailY = 10;

        const cb = now => {
          const t = Math.min(1, (now - orbStart) / orbDur);
          const ease = t * t;
          orbG.x = wx + (targetTrailX - wx) * ease;
          orbG.y = wy + (targetTrailY - wy) * ease;

          if (t >= 1) {
            this.breakoutLayer.removeChild(orbG);
            orbG.destroy();
            this.customRenderCallbacks = this.customRenderCallbacks.filter(fn => fn !== cb);
            if (onWildAddedToTrail) onWildAddedToTrail();
            resolve();
          }
        };
        this.customRenderCallbacks.push(cb);
      });

      await new Promise(r => setTimeout(r, 260));
      if (wildNode && window.gsap) {
        window.gsap.to(wildNode.scale, { x: 1.0, y: 1.0, duration: 0.25 });
      }
      this.breakoutLayer.removeChild(counterBadge);
      counterBadge.destroy({ children: true });
    }

    this.breakoutLayer.removeChild(rodGraphics);
    rodGraphics.destroy();
  }

  _drawWebGLRodAndLine(g, wx, wy, targetX, targetY, isTaut) {
    g.clear();
    const dir = targetX >= wx ? 1 : -1;
    const rodBaseX = wx + dir * 26;
    const rodBaseY = wy + 18;
    const rodTipX = wx + dir * 78;
    const rodTipY = wy - (isTaut ? 46 : 72);

    // Carbon-fiber fishing rod bending under load
    g.lineStyle(7, 0x3b230a, 1);
    g.moveTo(rodBaseX, rodBaseY);
    g.quadraticCurveTo(wx + dir * 44, wy - 55, rodTipX, rodTipY);

    g.lineStyle(2.5, 0xffd700, 1);
    g.moveTo(rodBaseX, rodBaseY);
    g.quadraticCurveTo(wx + dir * 44, wy - 55, rodTipX, rodTipY);

    // Taut glowing braided fishing line
    g.lineStyle(3.5, 0xffffff, 0.95);
    g.moveTo(rodTipX, rodTipY);
    if (isTaut) {
      g.lineTo(targetX, targetY);
    } else {
      g.quadraticCurveTo((rodTipX + targetX) / 2, Math.min(rodTipY, targetY) - 45, targetX, targetY);
    }

    // Red & white bobber float at hook point
    g.lineStyle(2.5, 0xffffff, 1);
    g.beginFill(0xff3b30, 1);
    g.drawCircle(targetX, targetY - 10, 9);
    g.endFill();
  }

  _drawCurrentPaylineLaser() {
    this.paylineGraphics.clear();
    this.paylineBadgeContainer.removeChildren();
    if (!this.activeLineWins.length) return;

    const currentWin = this.activeLineWins[this.highlightCycleIndex];
    if (!currentWin) return;

    const colorNum = parseInt(currentWin.color.replace('#', ''), 16);

    // Outer neon laser glow
    this.paylineGraphics.lineStyle(9, colorNum, 0.45);
    for (let c = 0; c < this.cols; c++) {
      const r = currentWin.rows[c];
      const px = this.paddingX + c * this.cellW + this.cellW / 2;
      const py = this.paddingY + r * this.cellH + this.cellH / 2;
      if (c === 0) this.paylineGraphics.moveTo(px, py);
      else this.paylineGraphics.lineTo(px, py);
    }

    // Crisp inner core
    this.paylineGraphics.lineStyle(4, 0xffffff, 0.95);
    for (let c = 0; c < this.cols; c++) {
      const r = currentWin.rows[c];
      const px = this.paddingX + c * this.cellW + this.cellW / 2;
      const py = this.paddingY + r * this.cellH + this.cellH / 2;
      if (c === 0) this.paylineGraphics.moveTo(px, py);
      else this.paylineGraphics.lineTo(px, py);
    }

    // Payline payout pill badge
    const firstRow = currentWin.rows[0];
    const bx = this.paddingX + 95;
    const by = this.paddingY + firstRow * this.cellH + 32;

    const badgeBg = new PIXI.Graphics();
    badgeBg.lineStyle(2.5, colorNum, 1);
    badgeBg.beginFill(0x001224, 0.92);
    badgeBg.drawRoundedRect(bx - 85, by - 18, 178, 36, 10);
    badgeBg.endFill();
    this.paylineBadgeContainer.addChild(badgeBg);

    const badgeText = new PIXI.Text(
      `LINE #${currentWin.paylineId}  +$${currentWin.payout.toFixed(2)}`,
      new PIXI.TextStyle({
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 15,
        fontWeight: '800',
        fill: '#FFFFFF'
      })
    );
    badgeText.anchor.set(0.5);
    badgeText.x = bx + 4;
    badgeText.y = by;
    this.paylineBadgeContainer.addChild(badgeText);
  }

  update(dt, now) {
    // 1. Animate WebGL Underwater Displacement Shader & Caustic Sunbeams
    if (this.displacementSprite) {
      this.displacementSprite.x += 28 * dt;
      this.displacementSprite.y += 18 * dt;
    }

    for (const beam of this.causticBeams) {
      beam.sprite.x = beam.baseX + Math.sin(now * 0.0007 + beam.phase) * 50;
    }

    // 2. Screen shake
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      this.rootContainer.x = (Math.random() - 0.5) * this.shakeMagnitude;
      this.rootContainer.y = (Math.random() - 0.5) * this.shakeMagnitude;
    } else {
      this.rootContainer.x = 0;
      this.rootContainer.y = 0;
    }

    // 3. Rising water bubbles & ambient background fish
    for (const b of this.bubbles) {
      b.sprite.y -= b.speed * dt;
      b.sprite.x = b.baseX + Math.sin(now * 0.0022 * b.wobbleSpeed + b.wobbleOffset) * 8;
      if (b.sprite.y < this.paddingY - 15) {
        b.sprite.y = this.height - this.paddingY + 15;
      }
    }

    for (const bf of this.bgFish) {
      bf.sprite.x += bf.speed * dt;
      bf.sprite.y = bf.baseY + Math.sin(now * 0.003 + bf.wobble) * 10;
      if (bf.speed > 0 && bf.sprite.x > this.width + 70) bf.sprite.x = -70;
      if (bf.speed < 0 && bf.sprite.x < -70) bf.sprite.x = this.width + 70;
    }

    // 4. Update spinning reels
    const symbolKeys = Object.keys(SYMBOLS);
    for (let c = 0; c < this.cols; c++) {
      const colObj = this.reelColumns[c];
      if (colObj.spinning) {
        const prevStopped = c === 0 || !this.reelColumns[c - 1].spinning;
        colObj.spotlight.visible = Boolean(colObj.isSuspenseReel && prevStopped);

        colObj.offsetY += colObj.speed * dt;
        if (colObj.offsetY >= this.cellH) {
          colObj.offsetY -= this.cellH;
          const popped = colObj.stripNodes.pop();
          if (popped) {
            colObj.symbolsHolder.removeChild(popped);
            popped.destroy({ children: true });
          }

          const randId = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
          const dummyCell = {
            id: randId,
            symbol: SYMBOLS[randId],
            money: randId === 'FISH' ? { multiplier: 10, tier: 'medium' } : null
          };
          const newNode = this._createSymbolNode(dummyCell, c, -1);
          colObj.symbolsHolder.addChild(newNode);
          colObj.stripNodes.unshift(newNode);
        }

        for (let i = 0; i < colObj.stripNodes.length; i++) {
          colObj.stripNodes[i].y = (i - 1) * this.cellH + this.cellH / 2 + colObj.offsetY;
        }

        if (now >= colObj.stopTime) {
          colObj.spinning = false;
          colObj.offsetY = 0;
          if (colObj.onFinished) {
            const fn = colObj.onFinished;
            colObj.onFinished = null;
            fn();
          }
        }
      } else {
        // Organic idle swimming / breathing animation on landed frameless 3D cutouts!
        for (let r = 0; r < this.rows; r++) {
          const node = this.cellContainers[c]?.[r];
          if (!node || !node.mainSprite) continue;

          const key = `${c},${r}`;
          const hasWins = this.highlightedPositions.size > 0;
          const isHighlighted = this.highlightedPositions.has(key);

          if (hasWins && !isHighlighted) {
            node.alpha = 0.38;
          } else if (!hasWins && node.alpha < 0.9) {
            // Keep alpha if dimmed during fish collection, otherwise 1
          }

          if (isHighlighted) {
            const pulse = 1.09 + Math.sin(now * 0.011) * 0.06;
            node.mainSprite.scale.set(node.baseSpriteScale * pulse);
            node.mainSprite.rotation = Math.sin(now * 0.008) * 0.05;
          } else if (node.cellData?.id === 'FISH') {
            // Money fish gently swim and wag in the water current
            const wag = Math.sin(now * 0.0055 + c * 1.4 + r);
            node.mainSprite.scale.set(
              node.baseSpriteScale * (1 + wag * 0.025),
              node.baseSpriteScale * (1 - wag * 0.02)
            );
            node.mainSprite.rotation = wag * 0.035;
          } else if (node.cellData?.id === 'DRAGONFLY') {
            // Dragonfly hovers rapidly
            const hover = Math.sin(now * 0.018 + c);
            node.mainSprite.scale.set(node.baseSpriteScale * (1 + hover * 0.02));
            node.mainSprite.rotation = hover * 0.03;
          } else {
            const breathe = 1 + Math.sin(now * 0.0035 + c + r) * 0.015;
            node.mainSprite.scale.set(node.baseSpriteScale * breathe);
            node.mainSprite.rotation = 0;
          }
        }
      }
    }

    // 5. Cycle winning payline laser highlights
    if (this.activeLineWins.length > 0) {
      this.highlightTimer += dt;
      if (this.highlightTimer >= 1.35) {
        this.highlightTimer = 0;
        this.highlightCycleIndex = (this.highlightCycleIndex + 1) % this.activeLineWins.length;
        this._drawCurrentPaylineLaser();
      }
    }

    // 6. Execute custom tween callbacks (Hook hoist, Dynamite flight, Fisherman reeling)
    for (const cb of [...this.customRenderCallbacks]) {
      cb(now);
    }

    // 7. Update expanding water rings
    for (let i = this.waterRings.length - 1; i >= 0; i--) {
      const wr = this.waterRings[i];
      wr.life += dt;
      const p = Math.min(1, wr.life / wr.maxLife);
      wr.r = 10 + (wr.maxR - 10) * p;
      wr.graphics.clear();
      wr.graphics.lineStyle(4 * (1 - p), wr.color, 1 - p);
      wr.graphics.drawCircle(0, 0, wr.r);
      if (wr.life >= wr.maxLife) {
        this.breakoutLayer.removeChild(wr.graphics);
        wr.graphics.destroy();
        this.waterRings.splice(i, 1);
      }
    }

    // 8. Update splash particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.sprite.x += pt.vx * dt;
      pt.sprite.y += pt.vy * dt;
      pt.vy += 420 * dt;
      pt.sprite.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      if (pt.life >= pt.maxLife) {
        this.breakoutLayer.removeChild(pt.sprite);
        pt.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }

    // 9. Update floating win texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.sprite.y -= 45 * dt;
      ft.sprite.alpha = Math.max(0, 1 - Math.pow(ft.life / ft.maxLife, 2));
      if (ft.life >= ft.maxLife) {
        this.breakoutLayer.removeChild(ft.sprite);
        ft.sprite.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
