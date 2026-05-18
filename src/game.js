// game.js
// This is where the game starts.
// It grabs the canvas, generates the city, and draws everything.
// Later it will run the main game loop — that's the part that keeps the game
// moving every fraction of a second, like flipping pages in a flip book.

import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState } from "./config.js";
import { generateCity } from "./world.js";
import { drawScene } from "./render.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");

  // Set the canvas size to match our config numbers.
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Track which screen the game is on right now.
  let currentState = GameState.TITLE;

  // Generate a city and draw the opening scene.
  let city = generateCity();
  drawScene(ctx, city);

  // TODO: remove in Phase 2 — debug shortcut to regenerate the city.
  // Press R to get a brand-new random city without refreshing the page.
  window.addEventListener("keydown", (event) => {
    if (event.key === "r" || event.key === "R") {
      city = generateCity();
      drawScene(ctx, city);
    }
  });
});
