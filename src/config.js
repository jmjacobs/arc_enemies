// config.js
// This is the one place where all the numbers and settings for the game live.
// If you want to change the canvas size, a colour, or later the speed of a
// banana — you change it here, not somewhere buried in the code.
// Think of it like the settings menu for the whole game.

// How big the game canvas is, in pixels.
export const CANVAS_WIDTH  = 1000;
export const CANVAS_HEIGHT = 600;

// The y position (in pixels from the top) where building bases sit.
export const GROUND_Y = CANVAS_HEIGHT;

// How many buildings to put in the city each time we generate it.
export const BUILDING_COUNT_MIN = 8;
export const BUILDING_COUNT_MAX = 12;

// How short or tall buildings can be, in pixels.
export const BUILDING_MIN_HEIGHT = 80;
export const BUILDING_MAX_HEIGHT = 380;

// The three building colours — CGA-ish but slightly softened.
export const BUILDING_PALETTE = ["#8b3a3a", "#2a7a7a", "#5a5a6a"];

// Window size and spacing on buildings.
export const WINDOW_WIDTH       = 6;
export const WINDOW_HEIGHT      = 8;
export const WINDOW_GAP_X       = 7;
export const WINDOW_GAP_Y       = 9;
export const WINDOW_MARGIN      = 8;

export const WINDOW_LIT_COLOR        = "#ffe066";
export const WINDOW_DARK_COLOR       = "#1e1e2a";
export const WINDOW_LIT_PROBABILITY  = 0.35;

// How big the placeholder character sprites are, in pixels.
export const CHARACTER_WIDTH  = 28;
export const CHARACTER_HEIGHT = 32;

// One colour per player — easy to tell apart at a glance.
export const CHARACTER_COLORS = {
  player1: "#ff8c42", // warm orange  (left side)
  player2: "#42c5ff", // bright blue  (right side)
};

// The names shown in the HUD. Phase 7 will replace these with chosen characters.
export const PLAYER_NAMES = ["Player 1", "Player 2"];

// Wind strength. Negative = blowing left, positive = blowing right.
export const WIND_MIN = -10;
export const WIND_MAX =  10;

// The bar at the very top of the canvas that shows the wind arrow.
export const WIND_BAR_HEIGHT       = 30;
export const WIND_ARROW_MAX_LENGTH = 200;

export const WIND_BAR_BG      = "#111122";
export const WIND_ARROW_COLOR = "#ffffff";
export const WIND_TEXT_COLOR  = "#aaaacc";

// The little triangle that floats above whoever's turn it is.
export const ACTIVE_INDICATOR_COLOR         = "#ffffff";
export const ACTIVE_INDICATOR_BOUNCE_PIXELS = 4;  // how far it bobs up and down
export const ACTIVE_INDICATOR_SIZE          = 8;   // half-width of the triangle

// Angle and velocity inputs — min, max, and sensible defaults.
export const ANGLE_MIN     = 0;
export const ANGLE_MAX     = 90;
export const ANGLE_DEFAULT = 45;

export const VELOCITY_MIN     = 0;
export const VELOCITY_MAX     = 100;
export const VELOCITY_DEFAULT = 50;

// All the colours used in the game.
export const COLORS = {
  sky:    "#0d0d1a",
  title:  "#ffffff",
  border: "#ffffff",
};

// GameState lists every possible screen or phase the game can be in.
// We won't use them all in Phase 3, but naming them now keeps things honest.
// TITLE       = the title screen (wired up in a later polish phase)
// PLAYER_TURN = a player is choosing their angle and velocity
// RESOLVING   = a throw is in the air (Phase 4)
// ROUND_END   = someone was hit (Phase 5)
// MATCH_END   = someone reached the score limit (Phase 5)
export const GameState = Object.freeze({
  TITLE:       "TITLE",
  PLAYER_TURN: "PLAYER_TURN",
  RESOLVING:   "RESOLVING",
  ROUND_END:   "ROUND_END",
  MATCH_END:   "MATCH_END",
});
