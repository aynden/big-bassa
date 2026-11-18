/**
 * Big Bass Splash (vs10txbigbass) - Core Math & Feature Engine
 * Handles reel strips, weighted RNG, 10-payline evaluation, Fish Money values,
 * 2-Scatter Nudge/Hook respins, 5 pre-bonus modifiers, 4-level Free Spins trail,
 * and Dynamite / Hook / Bazooka rescue modifiers.
 */

import {
  GAME_CONFIG,
  PAYLINES,
  SYMBOLS,
  FISH_MONEY_VALUES,
  PRE_BONUS_MODIFIERS,
  TRAIL_LEVELS
} from './config.js';

export class SlotEngine {
  constructor() {
    this.reels = GAME_CONFIG.REELS;
    this.rows = GAME_CONFIG.ROWS;

    // Active Free Spins state
    this.inFreeSpins = false;
    this.freeSpinsRemaining = 0;
    this.freeSpinsTotalPlayed = 0;
    this.freeSpinsTotalWin = 0;
    this.activeModifiers = new Set(); // Set of modifier IDs
    this.wildsCollected = 0;
    this.currentLevel = 1; // 1..4
    this.currentMultiplier = 1; // 1x, 2x, 3x, 10x

    // Queued cheat/force outcome for testing
    this.forcedOutcome = null;
  }

  setForcedOutcome(type) {
    this.forcedOutcome = type;
  }

  /**
   * Pick a random Fish Money multiplier value (2x to 5000x total bet)
   */
  rollFishMoneyMultiplier() {
    const totalWeight = FISH_MONEY_VALUES.reduce((acc, item) => acc + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of FISH_MONEY_VALUES) {
      r -= item.weight;
      if (r <= 0) {
        return { multiplier: item.multiplier, tier: item.tier };
      }
    }
    return { multiplier: 2, tier: 'small' };
  }

  /**
   * Pick a single symbol cell taking into account Base vs Free Spins, virtual reel clumping, and active modifiers
   */
  rollSymbol(col, existingColSymbols = [], prevCols = []) {
    const symbolList = Object.values(SYMBOLS);
    const weights = symbolList.map(sym => {
      let w = this.inFreeSpins ? sym.freeSpinWeight : sym.baseWeight;

      // Prevent more than 1 Scatter per column
      if (sym.id === 'SCATTER' && existingColSymbols.some(s => s.id === 'SCATTER')) {
        return 0;
      }
      // Prevent more than 1 Wild per column in normal rolls
      if (sym.id === 'WILD' && existingColSymbols.some(s => s.id === 'WILD')) {
        return 0;
      }

      // Authentic virtual reel-strip clumping: symbols present on Reel 1-2 have stacked affinity on adjacent reels
      if (sym.type !== 'scatter' && sym.type !== 'wild' && col > 0 && prevCols.length >= col) {
        const prevColHas = prevCols[col - 1].some(s => s.id === sym.id);
        const firstColHas = prevCols[0].some(s => s.id === sym.id);
        if (prevColHas && firstColHas) {
          w *= this.inFreeSpins ? 1.65 : 2.73;
        } else if (prevColHas || firstColHas) {
          w *= this.inFreeSpins ? 1.24 : 1.50;
        }
      }

      // Apply Free Spins pre-bonus modifiers
      if (this.inFreeSpins) {
        if (sym.id === 'FISH' && this.activeModifiers.has('MORE_FISH')) {
          w *= 1.28;
        }
        if (sym.id === 'WILD' && this.activeModifiers.has('MORE_FISHERMAN')) {
          w *= 1.22;
        }
      }
      return w;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < symbolList.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        return this.createCell(symbolList[i].id);
      }
    }
    return this.createCell('TEN');
  }

  createCell(symbolId, customMoneyMultiplier = null) {
    const sym = SYMBOLS[symbolId];
    let money = null;
    if (symbolId === 'FISH') {
      if (customMoneyMultiplier !== null) {
        const tierObj = FISH_MONEY_VALUES.find(f => f.multiplier >= customMoneyMultiplier) || FISH_MONEY_VALUES[0];
        money = { multiplier: customMoneyMultiplier, tier: tierObj.tier };
      } else {
        money = this.rollFishMoneyMultiplier();
      }
    }
    return {
      id: sym.id,
      symbol: sym,
      money
    };
  }

  /**
   * Generate a 5x3 grid (grid[col][row])
   */
  generateGrid() {
    const grid = [];
    for (let c = 0; c < this.reels; c++) {
      const col = [];
      for (let r = 0; r < this.rows; r++) {
        col.push(this.rollSymbol(c, col, grid));
      }
      grid.push(col);
    }

    // Apply forced test outcomes if requested by user via Cheat Panel
    if (this.forcedOutcome) {
      this._applyForcedOutcome(grid, this.forcedOutcome);
      this.forcedOutcome = null;
    }

    return grid;
  }

  _applyForcedOutcome(grid, outcomeType) {
    // Clear existing scatters/wilds when forcing specific scenarios
    const clearSpecial = () => {
      for (let c = 0; c < this.reels; c++) {
        for (let r = 0; r < this.rows; r++) {
          if (grid[c][r].id === 'SCATTER' || grid[c][r].id === 'WILD') {
            grid[c][r] = this.createCell(['A', 'K', 'Q', 'J', 'TEN'][c % 5]);
          }
        }
      }
    };

    if (outcomeType === 'SCATTER_3') {
      clearSpecial();
      grid[0][1] = this.createCell('SCATTER');
      grid[2][0] = this.createCell('SCATTER');
      grid[4][2] = this.createCell('SCATTER');
    } else if (outcomeType === 'SCATTER_4') {
      clearSpecial();
      grid[0][1] = this.createCell('SCATTER');
      grid[1][2] = this.createCell('SCATTER');
      grid[3][0] = this.createCell('SCATTER');
      grid[4][1] = this.createCell('SCATTER');
    } else if (outcomeType === 'SCATTER_5') {
      clearSpecial();
      for (let c = 0; c < 5; c++) {
        grid[c][c % 3] = this.createCell('SCATTER');
      }
    } else if (outcomeType === 'SCATTER_2_HOOK') {
      clearSpecial();
      grid[0][1] = this.createCell('SCATTER');
      grid[2][1] = this.createCell('SCATTER');
      grid._forceSecondChance = 'HOOK';
    } else if (outcomeType === 'SCATTER_2_NUDGE') {
      clearSpecial();
      grid[0][0] = this.createCell('SCATTER');
      grid[3][1] = this.createCell('SCATTER');
      grid._forceSecondChance = 'NUDGE';
    } else if (outcomeType === 'TRUCK_5') {
      for (let c = 0; c < 5; c++) {
        grid[c][1] = this.createCell('TRUCK');
      }
    } else if (outcomeType === 'FISHERMAN_COLLECT') {
      clearSpecial();
      grid[1][1] = this.createCell('WILD');
      grid[0][0] = this.createCell('FISH', 10);
      grid[2][2] = this.createCell('FISH', 25);
      grid[3][1] = this.createCell('FISH', 50);
      grid[4][0] = this.createCell('FISH', 15);
    } else if (outcomeType === 'DYNAMITE_RESCUE') {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (grid[c][r].id === 'FISH' || grid[c][r].id === 'WILD') {
            grid[c][r] = this.createCell(['A', 'K', 'Q', 'J', 'TEN'][(c + r) % 5]);
          }
        }
      }
      grid[2][1] = this.createCell('WILD');
      grid._forceRescue = 'DYNAMITE';
    } else if (outcomeType === 'BAZOOKA_RESCUE') {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (grid[c][r].id === 'FISH' || grid[c][r].id === 'WILD') {
            grid[c][r] = this.createCell(['A', 'K', 'Q', 'J', 'TEN'][(c + r) % 5]);
          }
        }
      }
      grid[1][1] = this.createCell('WILD');
      grid._forceRescue = 'BAZOOKA';
    } else if (outcomeType === 'HOOK_FISHERMAN_RESCUE') {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (grid[c][r].id === 'WILD') {
            grid[c][r] = this.createCell('A');
          }
        }
      }
      grid[0][1] = this.createCell('FISH', 20);
      grid[2][0] = this.createCell('FISH', 50);
      grid[4][2] = this.createCell('FISH', 100);
      grid._forceRescue = 'HOOK_WILD';
    }
  }

  /**
   * Execute a full spin evaluation, including 2-Scatter 2nd chance or Free Spins Rescue features
   */
  evaluateSpin(totalBet) {
    const initialGrid = this.generateGrid();
    let workingGrid = this._cloneGrid(initialGrid);

    const events = []; // Sequence of special animations for the renderer

    // 1. Base Game: Check for 2 Scatters Second-Chance Feature (Nudge Respin or Hook Pull)
    if (!this.inFreeSpins) {
      const scatters = this._findSymbolPositions(workingGrid, 'SCATTER');
      if (scatters.length === 2) {
        const canNudge = scatters.every(pos => pos.row < 2); // Neither scatter is on bottom row (row 2)
        const forceType = initialGrid._forceSecondChance;

        if (forceType === 'NUDGE' || (!forceType && canNudge && Math.random() < 0.25)) {
          // Nudge Respin: Scatters move down 1 row, other reels respin!
          const nudgedGrid = this._cloneGrid(workingGrid);
          const lockedCols = new Set(scatters.map(s => s.col));

          for (const s of scatters) {
            // Shift column down 1 position
            nudgedGrid[s.col][2] = nudgedGrid[s.col][1];
            nudgedGrid[s.col][1] = nudgedGrid[s.col][0];
            nudgedGrid[s.col][0] = this.rollSymbol(s.col, nudgedGrid[s.col]);
          }

          // Respin unlocked columns with chance of landing the 3rd scatter
          let landedThird = false;
          for (let c = 0; c < this.reels; c++) {
            if (!lockedCols.has(c)) {
              const col = [];
              for (let r = 0; r < this.rows; r++) {
                if (!landedThird && (forceType === 'NUDGE' || Math.random() < 0.22)) {
                  col.push(this.createCell('SCATTER'));
                  landedThird = true;
                } else {
                  let cell = this.rollSymbol(c, col);
                  if (cell.id === 'SCATTER') landedThird = true;
                  col.push(cell);
                }
              }
              nudgedGrid[c] = col;
            }
          }

          events.push({
            type: 'SECOND_CHANCE_NUDGE',
            lockedCols: Array.from(lockedCols),
            fromGrid: this._cloneGrid(workingGrid),
            toGrid: this._cloneGrid(nudgedGrid)
          });
          workingGrid = nudgedGrid;
        } else if (forceType === 'HOOK' || (!forceType && Math.random() < 0.14)) {
          // Hook Pull: A fishing hook pulls one of the non-scatter reels up to reveal a 3rd Scatter!
          const scatterCols = new Set(scatters.map(s => s.col));
          const availableCols = [0, 1, 2, 3, 4].filter(c => !scatterCols.has(c));
          const hookCol = availableCols[Math.floor(Math.random() * availableCols.length)];
          const hookRow = 1;

          const hookedGrid = this._cloneGrid(workingGrid);
          hookedGrid[hookCol][hookRow] = this.createCell('SCATTER');

          events.push({
            type: 'SECOND_CHANCE_HOOK',
            col: hookCol,
            row: hookRow,
            symbolId: 'SCATTER',
            toGrid: this._cloneGrid(hookedGrid)
          });
          workingGrid = hookedGrid;
        }
      }
    }

    // 2. Free Spins Mode: Check for Rescue Features (Dynamite, Bazooka, or Hook Fisherman)
    if (this.inFreeSpins) {
      let wildPositions = this._findSymbolPositions(workingGrid, 'WILD');
      let fishPositions = this._findSymbolPositions(workingGrid, 'FISH');
      const rescueChanceBoost = this.activeModifiers.has('MORE_DYNAMITE') ? 0.28 : 0.14;
      const hookRescueChance = this.activeModifiers.has('MORE_DYNAMITE') ? 0.11 : 0.05;
      const forceRescue = initialGrid._forceRescue;

      // Case A: Fisherman Wild(s) landed, but 0 Fish Money symbols on screen -> Dynamite or Bazooka!
      if (
        (wildPositions.length > 0 && fishPositions.length === 0) &&
        (forceRescue === 'DYNAMITE' || forceRescue === 'BAZOOKA' || Math.random() < rescueChanceBoost)
      ) {
        const rescueType =
          forceRescue === 'DYNAMITE'
            ? 'DYNAMITE'
            : forceRescue === 'BAZOOKA'
              ? 'BAZOOKA'
              : Math.random() < 0.55
                ? 'DYNAMITE'
                : 'BAZOOKA';

        const countToSpawn = 2 + Math.floor(Math.random() * 3); // 2 to 4 money fish
        const candidates = [];
        for (let c = 0; c < this.reels; c++) {
          for (let r = 0; r < this.rows; r++) {
            if (workingGrid[c][r].id !== 'WILD' && workingGrid[c][r].id !== 'FISH') {
              candidates.push({ col: c, row: r });
            }
          }
        }
        // Shuffle candidates
        candidates.sort(() => Math.random() - 0.5);
        const spawnedTargets = candidates.slice(0, countToSpawn);
        const rescuedGrid = this._cloneGrid(workingGrid);
        const spawnedCells = [];

        for (const t of spawnedTargets) {
          const newFish = this.createCell('FISH');
          rescuedGrid[t.col][t.row] = newFish;
          spawnedCells.push({ col: t.col, row: t.row, cell: newFish });
        }

        events.push({
          type: rescueType === 'DYNAMITE' ? 'RESCUE_DYNAMITE' : 'RESCUE_BAZOOKA',
          targets: spawnedCells,
          toGrid: this._cloneGrid(rescuedGrid)
        });
        workingGrid = rescuedGrid;
      }
      // Case B: 3+ Fish Money symbols on screen, but 0 Fisherman Wilds -> Rare Hook pulls reel to reveal a Fisherman Wild!
      else if (
        (fishPositions.length >= 3 && wildPositions.length === 0) &&
        (forceRescue === 'HOOK_WILD' || Math.random() < hookRescueChance)
      ) {
        // Choose a column that doesn't exclusively hold high-value fish
        const hookCol = Math.floor(Math.random() * this.reels);
        const hookRow = 1;
        const rescuedGrid = this._cloneGrid(workingGrid);
        rescuedGrid[hookCol][hookRow] = this.createCell('WILD');

        events.push({
          type: 'RESCUE_HOOK_WILD',
          col: hookCol,
          row: hookRow,
          symbolId: 'WILD',
          toGrid: this._cloneGrid(rescuedGrid)
        });
        workingGrid = rescuedGrid;
      }
    }

    // 3. Evaluate 10 Fixed Paylines on final workingGrid
    const lineWins = this._evaluatePaylines(workingGrid, totalBet);
    const totalLineWin = lineWins.reduce((sum, w) => sum + w.payout, 0);

    // 4. Evaluate Free Spins Fisherman Collection & Progressive Trail
    let fishCollection = null;
    if (this.inFreeSpins) {
      const wilds = this._findSymbolPositions(workingGrid, 'WILD');
      const fishes = this._findSymbolPositions(workingGrid, 'FISH');

      if (wilds.length > 0) {
        const singleCollectBase = fishes.reduce(
          (sum, pos) => sum + pos.cell.money.multiplier * totalBet,
          0
        );
        // Each Fisherman Wild collects all fish on screen, multiplied by current level multiplier!
        const singleFishermanTotal = singleCollectBase * this.currentMultiplier;
        const totalCollectWin = singleFishermanTotal * wilds.length;

        fishCollection = {
          wilds,
          fishes,
          levelMultiplier: this.currentMultiplier,
          singleFishermanTotal,
          totalCollectWin
        };
      }

      // Advance Fisherman Wild Trail
      let retriggerAward = null;
      if (wilds.length > 0) {
        const previousWilds = this.wildsCollected;
        this.wildsCollected = Math.min(12, this.wildsCollected + wilds.length);

        // Check if we crossed a 4-wild threshold (4, 8, or 12)
        for (const lvl of TRAIL_LEVELS) {
          if (lvl.level > this.currentLevel && this.wildsCollected >= lvl.wildsRequired) {
            this.currentLevel = lvl.level;
            this.currentMultiplier = lvl.multiplier;
            const extraSpins =
              lvl.spinsAwarded + (this.activeModifiers.has('EXTRA_SPINS') ? 2 : 0);
            this.freeSpinsRemaining += extraSpins;
            retriggerAward = {
              newLevel: this.currentLevel,
              newMultiplier: this.currentMultiplier,
              extraSpins,
              previousWilds,
              newWilds: this.wildsCollected
            };
          }
        }
      }

      if (fishCollection) {
        fishCollection.retriggerAward = retriggerAward;
      } else if (retriggerAward) {
        fishCollection = {
          wilds,
          fishes: [],
          levelMultiplier: this.currentMultiplier,
          singleFishermanTotal: 0,
          totalCollectWin: 0,
          retriggerAward
        };
      }
    }

    // 5. Check Scatter Trigger (Base Game only)
    const finalScatters = this._findSymbolPositions(workingGrid, 'SCATTER');
    let freeSpinsTriggered = null;
    if (!this.inFreeSpins && finalScatters.length >= 3) {
      const count = Math.min(5, finalScatters.length);
      const baseSpins = count === 3 ? 10 : count === 4 ? 15 : 20;
      freeSpinsTriggered = {
        scatterCount: count,
        scatters: finalScatters,
        baseSpins
      };
    }

    const totalCollectAmount = fishCollection ? fishCollection.totalCollectWin : 0;
    const rawTotalWin = totalLineWin + totalCollectAmount;
    const maxCap = totalBet * GAME_CONFIG.MAX_WIN_MULTIPLIER;
    const totalWin = Math.min(maxCap, Number(rawTotalWin.toFixed(2)));

    return {
      initialGrid,
      finalGrid: workingGrid,
      events,
      lineWins,
      totalLineWin: Number(totalLineWin.toFixed(2)),
      fishCollection,
      freeSpinsTriggered,
      totalWin
    };
  }

  /**
   * Roll 0 to 5 pre-bonus modifiers when Free Spins are triggered
   */
  rollPreBonusModifiers(guaranteedMin = 0) {
    // Authentic Big Bass Splash picks 0 to 5 modifiers before Free Spins begin
    const weights = [
      { count: 0, w: 22 },
      { count: 1, w: 38 },
      { count: 2, w: 25 },
      { count: 3, w: 10 },
      { count: 4, w: 3.5 },
      { count: 5, w: 1.5 }
    ];
    const totalW = weights.reduce((s, i) => s + i.w, 0);
    let r = Math.random() * totalW;
    let count = guaranteedMin;
    for (const item of weights) {
      r -= item.w;
      if (r <= 0) {
        count = Math.max(guaranteedMin, item.count);
        break;
      }
    }

    const pool = [...PRE_BONUS_MODIFIERS];
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, count);
  }

  /**
   * Start Free Spins Round with chosen pre-bonus modifiers
   */
  startFreeSpins(baseSpins, modifiersList = []) {
    this.inFreeSpins = true;
    this.activeModifiers = new Set(modifiersList.map(m => m.id));
    this.freeSpinsTotalPlayed = 0;
    this.freeSpinsTotalWin = 0;

    const extraSpinsBonus = this.activeModifiers.has('EXTRA_SPINS') ? 2 : 0;
    this.freeSpinsRemaining = baseSpins + extraSpinsBonus;

    if (this.activeModifiers.has('START_LEVEL_2')) {
      this.currentLevel = 2;
      this.currentMultiplier = 2;
      this.wildsCollected = 4;
    } else {
      this.currentLevel = 1;
      this.currentMultiplier = 1;
      this.wildsCollected = 0;
    }
  }

  endFreeSpins() {
    const summary = {
      totalSpins: this.freeSpinsTotalPlayed,
      totalWin: Number(this.freeSpinsTotalWin.toFixed(2)),
      finalLevel: this.currentLevel,
      finalMultiplier: this.currentMultiplier
    };
    this.inFreeSpins = false;
    this.freeSpinsRemaining = 0;
    this.activeModifiers.clear();
    this.wildsCollected = 0;
    this.currentLevel = 1;
    this.currentMultiplier = 1;
    return summary;
  }

  /**
   * Evaluate all 10 paylines left-to-right
   */
  _evaluatePaylines(grid, totalBet) {
    const wins = [];

    for (const payline of PAYLINES) {
      const lineCells = payline.rows.map((r, c) => ({
        col: c,
        row: r,
        cell: grid[c][r]
      }));

      // Scatter does not form line wins
      if (lineCells[0].cell.id === 'SCATTER') continue;

      // Determine target matching symbol on this line (first non-WILD symbol, or WILD if all wilds)
      let targetSymbolId = 'WILD';
      for (const item of lineCells) {
        if (item.cell.id === 'SCATTER') break;
        if (item.cell.id !== 'WILD') {
          targetSymbolId = item.cell.id;
          break;
        }
      }

      // Count consecutive matching symbols from leftmost reel (col 0)
      const matchedPositions = [];
      for (const item of lineCells) {
        const id = item.cell.id;
        if (id === targetSymbolId || id === 'WILD') {
          matchedPositions.push({ col: item.col, row: item.row, cell: item.cell });
        } else {
          break;
        }
      }

      const matchCount = matchedPositions.length;
      const symDef = SYMBOLS[targetSymbolId];
      const multiplier = symDef?.payouts?.[matchCount];

      if (multiplier && multiplier > 0) {
        const payout = Number((multiplier * totalBet).toFixed(2));
        wins.push({
          paylineId: payline.id,
          color: payline.color,
          symbolId: targetSymbolId,
          symbolName: symDef.name,
          count: matchCount,
          multiplier,
          payout,
          positions: matchedPositions,
          rows: payline.rows
        });
      }
    }

    return wins;
  }

  _findSymbolPositions(grid, symbolId) {
    const list = [];
    for (let c = 0; c < this.reels; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (grid[c][r].id === symbolId) {
          list.push({ col: c, row: r, cell: grid[c][r] });
        }
      }
    }
    return list;
  }

  _cloneGrid(grid) {
    return grid.map(col =>
      col.map(cell => ({
        id: cell.id,
        symbol: cell.symbol,
        money: cell.money ? { ...cell.money } : null
      }))
    );
  }
}
