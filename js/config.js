/**
 * Big Bass Splash (vs10txbigbass) - Complete Configuration, Paytable & Paylines
 */

export const GAME_CONFIG = {
  REELS: 5,
  ROWS: 3,
  PAYLINES_COUNT: 10,
  DEFAULT_BALANCE: 1000.00,
  BUY_BONUS_MULTIPLIER: 100, // 100x total bet
  MAX_WIN_MULTIPLIER: 5000,  // 5,000x total bet cap
  COINS_PER_LINE_OPTIONS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  COIN_VALUE_OPTIONS: [0.01, 0.02, 0.05, 0.10, 0.20, 0.25, 0.50, 1.00, 1.50, 2.00, 2.50],
  DEFAULT_COINS_PER_LINE: 2,
  DEFAULT_COIN_VALUE: 0.10, // Total default bet = 2 * 0.10 * 10 = $2.00
};

/**
 * Exact 10 Fixed Paylines (row indices 0..2 for each of the 5 reels)
 */
export const PAYLINES = [
  { id: 1,  rows: [1, 1, 1, 1, 1], color: '#FFD700' }, // Middle horizontal
  { id: 2,  rows: [0, 0, 0, 0, 0], color: '#FF3B30' }, // Top horizontal
  { id: 3,  rows: [2, 2, 2, 2, 2], color: '#00E5FF' }, // Bottom horizontal
  { id: 4,  rows: [0, 1, 2, 1, 0], color: '#34C759' }, // V-shape
  { id: 5,  rows: [2, 1, 0, 1, 2], color: '#FF2D55' }, // Inverted V
  { id: 6,  rows: [1, 0, 0, 0, 1], color: '#AF52DE' }, // Top bridge
  { id: 7,  rows: [1, 2, 2, 2, 1], color: '#FF9500' }, // Bottom bridge
  { id: 8,  rows: [0, 0, 1, 2, 2], color: '#5856D6' }, // Step down
  { id: 9,  rows: [2, 2, 1, 0, 0], color: '#A4E831' }, // Step up
  { id: 10, rows: [1, 2, 1, 0, 1], color: '#FF6482' }, // Wave
];

/**
 * Symbol Definitions
 * Payouts are expressed as multipliers of the TOTAL BET (matching Pragmatic Play's paytable display).
 * E.g. 5 Monster Trucks = 200x Total Bet.
 */
export const SYMBOLS = {
  WILD: {
    id: 'WILD',
    name: 'Fisherman Wild',
    type: 'wild',
    image: 'assets/images/symbols/wild_fisherman.png',
    baseWeight: 0, // Authentic Big Bass Splash: Fisherman Wild only appears during Free Spins!
    freeSpinWeight: 1.85, // Calibrated so a Fisherman lands roughly once every 3.5-4 free spins
    payouts: { 3: 5, 4: 25, 5: 200 },
    description: 'Appears on all reels during Free Spins. Substitutes for all symbols except Scatter and collects all Fish Money values on screen!'
  },
  SCATTER: {
    id: 'SCATTER',
    name: 'Hooked Bass Scatter',
    type: 'scatter',
    image: 'assets/images/symbols/scatter_bass.png',
    baseWeight: 4,
    freeSpinWeight: 0, // Scatters do not land during Free Spins
    payouts: {},
    description: '3, 4, or 5 Scatters trigger 10, 15, or 20 Free Spins! 2 Scatters can trigger Nudge Respin or Hook Pull.'
  },
  TRUCK: {
    id: 'TRUCK',
    name: 'Monster Truck',
    type: 'high',
    image: 'assets/images/symbols/monster_truck.png',
    baseWeight: 5,
    freeSpinWeight: 5,
    payouts: { 2: 0.5, 3: 5, 4: 20, 5: 200 },
    description: 'Highest paying symbol. Pays even for 2-of-a-kind!'
  },
  ROD: {
    id: 'ROD',
    name: 'Fishing Rod & Reel',
    type: 'high',
    image: 'assets/images/symbols/fishing_rod.png',
    baseWeight: 7,
    freeSpinWeight: 7,
    payouts: { 3: 3, 4: 15, 5: 100 }
  },
  DRAGONFLY: {
    id: 'DRAGONFLY',
    name: 'Emerald Dragonfly',
    type: 'high',
    image: 'assets/images/symbols/dragonfly.png',
    baseWeight: 9,
    freeSpinWeight: 9,
    payouts: { 3: 2, 4: 10, 5: 50 }
  },
  TACKLE: {
    id: 'TACKLE',
    name: 'Tackle Box',
    type: 'high',
    image: 'assets/images/symbols/tackle_box.png',
    baseWeight: 9,
    freeSpinWeight: 9,
    payouts: { 3: 2, 4: 10, 5: 50 }
  },
  FISH: {
    id: 'FISH',
    name: 'Fish Money Symbol',
    type: 'money',
    image: 'assets/images/symbols/fish_single.png',
    shoalImage: 'assets/images/symbols/fish_money.png',
    goldenImage: 'assets/images/symbols/fish_golden.png',
    baseWeight: 15,
    freeSpinWeight: 18,
    payouts: { 3: 1, 4: 5, 5: 20 },
    description: 'Takes a random cash value (2x to 5000x total bet) on every spin. Collected by Fisherman Wild during Free Spins!'
  },
  A: {
    id: 'A',
    name: 'Ace',
    type: 'low',
    label: 'A',
    primaryColor: '#FF2E4C',
    secondaryColor: '#9E001C',
    rimColor: '#FFD56B',
    baseWeight: 16,
    freeSpinWeight: 15,
    payouts: { 3: 0.2, 4: 2.5, 5: 10 }
  },
  K: {
    id: 'K',
    name: 'King',
    type: 'low',
    label: 'K',
    primaryColor: '#FF8A00',
    secondaryColor: '#A14600',
    rimColor: '#FFE27A',
    baseWeight: 16,
    freeSpinWeight: 15,
    payouts: { 3: 0.2, 4: 2.5, 5: 10 }
  },
  Q: {
    id: 'Q',
    name: 'Queen',
    type: 'low',
    label: 'Q',
    primaryColor: '#B833FF',
    secondaryColor: '#5B0099',
    rimColor: '#F3B8FF',
    baseWeight: 18,
    freeSpinWeight: 17,
    payouts: { 3: 0.2, 4: 1, 5: 5 }
  },
  J: {
    id: 'J',
    name: 'Jack',
    type: 'low',
    label: 'J',
    primaryColor: '#00C8FF',
    secondaryColor: '#00568F',
    rimColor: '#9EEBFF',
    baseWeight: 18,
    freeSpinWeight: 17,
    payouts: { 3: 0.2, 4: 1, 5: 5 }
  },
  TEN: {
    id: 'TEN',
    name: 'Ten',
    type: 'low',
    label: '10',
    primaryColor: '#2EE55D',
    secondaryColor: '#046E24',
    rimColor: '#A8FFBE',
    baseWeight: 19,
    freeSpinWeight: 18,
    payouts: { 3: 0.2, 4: 1, 5: 5 }
  }
};

/**
 * Weighted Fish Money Multipliers (Multipliers of Total Bet)
 * Authentic Big Bass Splash distribution: 2x, 5x, 10x, 15x, 20x, 25x, 50x, 100x, 200x, 500x, 1000x, 2500x, 5000x
 */
export const FISH_MONEY_VALUES = [
  { multiplier: 2,    weight: 340, tier: 'small' },
  { multiplier: 5,    weight: 250, tier: 'small' },
  { multiplier: 10,   weight: 160, tier: 'medium' },
  { multiplier: 15,   weight: 95,  tier: 'medium' },
  { multiplier: 20,   weight: 65,  tier: 'medium' },
  { multiplier: 25,   weight: 42,  tier: 'large' },
  { multiplier: 50,   weight: 26,  tier: 'large' },
  { multiplier: 100,  weight: 12,  tier: 'huge' },
  { multiplier: 200,  weight: 5,   tier: 'huge' },
  { multiplier: 500,  weight: 3,   tier: 'mega' },
  { multiplier: 1000, weight: 1.2, tier: 'mega' },
  { multiplier: 2500, weight: 0.5, tier: 'jackpot' },
  { multiplier: 5000, weight: 0.3, tier: 'jackpot' }
];

/**
 * 5 Pre-Bonus Free Spins Modifiers
 */
export const PRE_BONUS_MODIFIERS = [
  {
    id: 'MORE_FISH',
    name: 'MORE FISH!',
    shortName: 'More Fish',
    icon: '🐟',
    description: 'More Fish Money symbols are present on the reel strips during the entire Free Spins round!'
  },
  {
    id: 'MORE_FISHERMAN',
    name: 'MORE FISHERMEN!',
    shortName: 'More Fishermen',
    icon: '🤠',
    description: 'More Wild Fisherman symbols are added to the reel strips during the Free Spins round!'
  },
  {
    id: 'MORE_DYNAMITE',
    name: 'MORE DYNAMITES, HOOKS & BAZOOKAS!',
    shortName: 'More Dynamite/Hooks',
    icon: '🧨',
    description: 'Greatly increased chance of hitting Dynamite, Hook, or Bazooka rescue features at the end of a spin!'
  },
  {
    id: 'START_LEVEL_2',
    name: 'START FROM LEVEL 2!',
    shortName: 'Start Level 2 (2x)',
    icon: '⭐',
    description: 'The Free Spins round starts directly from Level 2 with a 2x Fish Money collection multiplier!'
  },
  {
    id: 'EXTRA_SPINS',
    name: '+2 SPINS!',
    shortName: '+2 Extra Spins',
    icon: '🔄',
    description: 'Start with +2 extra Free Spins and receive +2 extra spins (12 total) on every level retrigger!'
  }
];

/**
 * Free Spins Progressive Trail Levels
 */
export const TRAIL_LEVELS = [
  { level: 1, wildsRequired: 0,  multiplier: 1,  spinsAwarded: 10 },
  { level: 2, wildsRequired: 4,  multiplier: 2,  spinsAwarded: 10 },
  { level: 3, wildsRequired: 8,  multiplier: 3,  spinsAwarded: 10 },
  { level: 4, wildsRequired: 12, multiplier: 10, spinsAwarded: 10 }
];
