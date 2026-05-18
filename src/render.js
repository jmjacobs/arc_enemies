// render.js
// This file handles drawing things onto the canvas.
// It draws the sky, the sun, and the city full of buildings.
// Later it will also draw the characters, the flying projectiles,
// explosions, and the score display.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_GAP_X,
  WINDOW_GAP_Y,
  WINDOW_MARGIN,
  WINDOW_LIT_COLOR,
  WINDOW_DARK_COLOR,
  SUN_X,
  SUN_Y,
  SUN_RADIUS,
  SUN_COLOR,
} from "./config.js";

// Fill the whole canvas with the night-sky colour.
export function drawSky(ctx) {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the smiling sun. It has two eyes and a curved smile.
export function drawSun(ctx) {
  // The big yellow circle.
  ctx.beginPath();
  ctx.arc(SUN_X, SUN_Y, SUN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = SUN_COLOR;
  ctx.fill();

  // Left eye.
  ctx.beginPath();
  ctx.arc(SUN_X - 12, SUN_Y - 10, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#000000";
  ctx.fill();

  // Right eye.
  ctx.beginPath();
  ctx.arc(SUN_X + 12, SUN_Y - 10, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#000000";
  ctx.fill();

  // Smile — a curved arc across the lower half of the face.
  ctx.beginPath();
  ctx.arc(SUN_X, SUN_Y - 2, 16, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.stroke();
}

// Draw one building and all of its windows.
function drawBuilding(ctx, building) {
  // Draw the building rectangle.
  ctx.fillStyle = building.color;
  ctx.fillRect(building.x, building.y, building.width, building.height);

  // Draw each window in the grid.
  const grid = building.windows;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const windowX = building.x + WINDOW_MARGIN + col * (WINDOW_WIDTH  + WINDOW_GAP_X);
      const windowY = building.y + WINDOW_MARGIN + row * (WINDOW_HEIGHT + WINDOW_GAP_Y);

      ctx.fillStyle = grid[row][col] ? WINDOW_LIT_COLOR : WINDOW_DARK_COLOR;
      ctx.fillRect(windowX, windowY, WINDOW_WIDTH, WINDOW_HEIGHT);
    }
  }
}

// Draw every building in the city.
export function drawCity(ctx, city) {
  for (const building of city) {
    drawBuilding(ctx, building);
  }
}

// Draw the full scene: sky first, then sun, then buildings on top.
// The sun is drawn before the buildings so a very tall building can
// overlap it rather than the sun floating weirdly in front.
export function drawScene(ctx, city) {
  drawSky(ctx);
  drawSun(ctx);
  drawCity(ctx, city);
}
