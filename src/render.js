// render.js
// This file handles drawing things onto the canvas.
// It draws the sky, the wind bar, the city, and the characters.
// Later it will also draw flying projectiles, explosions, and the score.

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
  WIND_BAR_HEIGHT,
  WIND_ARROW_MAX_LENGTH,
  WIND_BAR_BG,
  WIND_ARROW_COLOR,
  WIND_TEXT_COLOR,
  WIND_MAX,
} from "./config.js";

// Fill the whole canvas with the night-sky colour.
export function drawSky(ctx) {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the wind bar across the very top of the canvas.
// It shows an arrow pointing in the direction the wind is blowing,
// with a number telling you how strong it is.
export function drawWindIndicator(ctx, wind) {
  // Dark background strip.
  ctx.fillStyle = WIND_BAR_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, WIND_BAR_HEIGHT);

  const centerX = CANVAS_WIDTH / 2;
  const centerY = WIND_BAR_HEIGHT / 2;

  if (wind === 0) {
    ctx.fillStyle    = WIND_TEXT_COLOR;
    ctx.font         = "12px 'Courier New', monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No wind", centerX, centerY);
    return;
  }

  // Work out how long the arrow should be.
  const arrowLength = (Math.abs(wind) / WIND_MAX) * WIND_ARROW_MAX_LENGTH;
  const direction   = wind > 0 ? 1 : -1; // +1 = right, -1 = left
  const arrowEndX   = centerX + direction * arrowLength;

  // Draw the arrow shaft.
  ctx.strokeStyle = WIND_ARROW_COLOR;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(arrowEndX, centerY);
  ctx.stroke();

  // Draw the arrowhead as a small filled triangle.
  const headSize = 6;
  ctx.beginPath();
  ctx.moveTo(arrowEndX, centerY);
  ctx.lineTo(arrowEndX - direction * headSize, centerY - headSize / 2);
  ctx.lineTo(arrowEndX - direction * headSize, centerY + headSize / 2);
  ctx.closePath();
  ctx.fillStyle = WIND_ARROW_COLOR;
  ctx.fill();

  // Show the wind strength as a number just past the arrowhead.
  const labelX = arrowEndX + direction * 10;
  ctx.fillStyle    = WIND_TEXT_COLOR;
  ctx.font         = "11px 'Courier New', monospace";
  ctx.textAlign    = wind > 0 ? "left" : "right";
  ctx.textBaseline = "middle";
  ctx.fillText(wind.toFixed(1), labelX, centerY);
}

// Draw one building and all of its windows.
function drawBuilding(ctx, building) {
  ctx.fillStyle = building.color;
  ctx.fillRect(building.x, building.y, building.width, building.height);

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

// Draw a simple placeholder character — a coloured body with a round head,
// two eyes, and a smile. The eyes are shifted toward whichever way they face
// so you can tell the two players apart at a glance.
export function drawCharacter(ctx, character) {
  const cx = character.x + character.width / 2;  // centre x of the character
  const headRadius = 7;
  const headCY     = character.y + headRadius;    // centre y of the head

  // Body rectangle below the head.
  ctx.fillStyle = character.color;
  ctx.fillRect(character.x + 4, character.y + headRadius + 5, character.width - 8, 20);

  // Head circle.
  ctx.beginPath();
  ctx.arc(cx, headCY, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = character.color;
  ctx.fill();

  // Eyes — both dots sit on the side the character is facing.
  const eyeY      = headCY - 2;
  const eyeOffset = character.facingRight ? 2 : -2; // nudge toward facing direction
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx + eyeOffset - 3, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffset + 3, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Smile.
  ctx.beginPath();
  ctx.arc(cx, headCY, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Draw the full scene in the right order so everything appears on top of
// the correct things: sky → wind bar → buildings → characters.
export function drawScene(ctx, world) {
  drawSky(ctx);
  drawWindIndicator(ctx, world.wind);
  drawCity(ctx, world.city);
  for (const character of world.characters) {
    drawCharacter(ctx, character);
  }
}
