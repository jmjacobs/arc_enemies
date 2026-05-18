// config.js
// This is the one place where all the numbers and settings for the game live.
// If you want to change the canvas size, a colour, or later the speed of a
// banana — you change it here, not somewhere buried in the code.
// Think of it like the settings menu for the whole game.

// How big the game canvas is, in pixels.
export const CANVAS_WIDTH  = 800;
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

// The sun — placed top-center but nudged right so it doesn't always sit
// directly on top of a building.
export const SUN_X      = Math.round(CANVAS_WIDTH * 0.72); // slightly right of center
export const SUN_Y      = 80;   // near the top of the canvas
export const SUN_RADIUS = 40;
export const SUN_COLOR  = "#ffe94d"; // cheerful yellow

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
// We'll actually use this in Phase 2, but we set it up now so the pieces are ready.
export const GameState = Object.freeze({
  TITLE:     "TITLE",
  PLAYING:   "PLAYING",
  ROUND_END: "ROUND_END",
});
