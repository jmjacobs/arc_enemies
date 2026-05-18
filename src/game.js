// game.js
// This is where the game starts.
// It grabs the canvas, sets everything up, and then decides what to show.
// Later it will run the main game loop — that's the part that keeps the game
// moving every fraction of a second, like flipping pages in a flip book.

import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, GameState } from "./config.js";
import { drawTitle } from "./render.js";

// Wait until the whole page has loaded before we try to find the canvas.
window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Set the canvas size to match our config numbers.
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Track which screen the game is on right now.
  let currentState = GameState.TITLE;

  // Fill the background with the sky colour.
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw the title screen.
  drawTitle(ctx);
});
