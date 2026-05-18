// config.js
// This is the one place where all the numbers and settings for the game live.
// If you want to change the canvas size, a colour, or later the speed of a
// banana — you change it here, not somewhere buried in the code.
// Think of it like the settings menu for the whole game.

// How big the game canvas is, in pixels.
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// All the colours used in the game.
// We'll add more every phase as we build more things.
export const COLORS = {
  sky:    "#1a1a2e", // deep dark blue — the night sky behind the city
  title:  "#ffffff", // white — used for the title text
  border: "#ffffff", // white — the border around the canvas
};

// GameState keeps track of what screen the game is on.
// TITLE   = the title screen (what you see right now)
// PLAYING = a round of the game is happening
// ROUND_END = someone just won a round
// We'll actually use this in Phase 2, but we set it up now so the pieces are ready.
export const GameState = Object.freeze({
  TITLE:     "TITLE",
  PLAYING:   "PLAYING",
  ROUND_END: "ROUND_END",
});
