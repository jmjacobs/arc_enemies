// render.js
// This file handles drawing things onto the canvas.
// Right now it just draws the title screen.
// Later it will draw the city skyline, the characters, the flying bananas,
// explosions, and the score.

import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "./config.js";

// Draw the "ARC ENEMIES" title in the middle of the canvas.
// ctx is the 2D drawing tool we get from the canvas element.
export function drawTitle(ctx) {
  ctx.font = "bold 64px 'Courier New', monospace";
  ctx.fillStyle = COLORS.title;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ARC ENEMIES", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
}
