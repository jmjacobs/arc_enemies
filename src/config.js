// config.js
// This is the one place where all the numbers and settings for the game live.
// If you want to change the canvas size, a colour, or later the speed of a
// banana — you change it here, not somewhere buried in the code.
// Think of it like the settings menu for the whole game.

// How big the game canvas is, in pixels.
export const CANVAS_WIDTH  = 1000;
export const CANVAS_HEIGHT = 600;

// The y position (in pixels from the top) where building bases sit.
// We put it at the very bottom of the canvas.
export const GROUND_Y = CANVAS_HEIGHT;

// How many buildings to put in the city each time we generate it.
export const BUILDING_COUNT_MIN = 8;
export const BUILDING_COUNT_MAX = 12;

// How short or tall buildings can be, in pixels.
export const BUILDING_MIN_HEIGHT = 80;
export const BUILDING_MAX_HEIGHT = 380;

// The three building colours — a bit like the old CGA palette but softer.
// Red, cyan, and grey, all slightly muted so they look like a real city at night.
export const BUILDING_PALETTE = ["#8b3a3a", "#2a7a7a", "#5a5a6a"];

// Window size and spacing on buildings.
export const WINDOW_WIDTH       = 6;   // how wide each window is
export const WINDOW_HEIGHT      = 8;   // how tall each window is
export const WINDOW_GAP_X       = 7;   // horizontal space between windows
export const WINDOW_GAP_Y       = 9;   // vertical space between windows
export const WINDOW_MARGIN      = 8;   // gap between the window grid and the building edge

// What colour a lit or dark window should be.
export const WINDOW_LIT_COLOR   = "#ffe066"; // warm yellow glow
export const WINDOW_DARK_COLOR  = "#1e1e2a"; // dark blue-grey

// Roughly 1 in 3 windows will be lit up.
export const WINDOW_LIT_PROBABILITY = 0.35;

// How big the placeholder character sprites are, in pixels.
export const CHARACTER_WIDTH  = 28;
export const CHARACTER_HEIGHT = 32;

// One colour per player — easy to tell apart at a glance.
export const CHARACTER_COLORS = {
  player1: "#ff8c42", // warm orange  (left side)
  player2: "#42c5ff", // bright blue  (right side)
};

// Wind strength. Negative = blowing left, positive = blowing right.
// The exact units don't matter yet — Phase 4 will hook them to physics.
export const WIND_MIN = -10;
export const WIND_MAX =  10;

// The bar at the very top of the canvas that shows the wind arrow.
export const WIND_BAR_HEIGHT       = 30;  // pixels tall
export const WIND_ARROW_MAX_LENGTH = 200; // pixels long at maximum wind

// Colours for the wind indicator.
export const WIND_BAR_BG      = "#111122"; // dark strip behind the arrow
export const WIND_ARROW_COLOR = "#ffffff"; // the arrow itself
export const WIND_TEXT_COLOR  = "#aaaacc"; // the number label

// All the colours used in the game.
export const COLORS = {
  sky:    "#0d0d1a", // deep navy — makes lit windows really pop
  title:  "#ffffff", // white — used for the title text
  border: "#ffffff", // white — the border around the canvas
};

// GameState keeps track of what screen the game is on.
// TITLE     = the title screen
// PLAYING   = a round of the game is happening
// ROUND_END = someone just won a round
export const GameState = Object.freeze({
  TITLE:     "TITLE",
  PLAYING:   "PLAYING",
  ROUND_END: "ROUND_END",
});
