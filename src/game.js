// game.js
// This is where the game starts.
// It grabs the canvas, generates the world, and draws everything.
// Later it will run the main game loop — that's the part that keeps the game
// moving every fraction of a second, like flipping pages in a flip book.

import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState } from "./config.js";
import { generateWorld } from "./world.js";
import { drawScene } from "./render.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");

  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Track which screen the game is on right now.
  let currentState = GameState.TITLE;

  // Generate the world (city + characters + wind) and draw it.
  let world = generateWorld();
  drawScene(ctx, world);

  // Press R to regenerate the whole world — new city, new positions, new wind.
  window.addEventListener("keydown", (event) => {
    if (event.key === "r" || event.key === "R") {
      world = generateWorld();
      drawScene(ctx, world);
    }
  });
});
