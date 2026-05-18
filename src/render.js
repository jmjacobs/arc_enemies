// render.js
// This file handles drawing things onto the canvas.
// It draws the sky, the wind bar, the city, the characters, the HUD,
// and the little bouncing triangle above whoever's turn it is.
// Later it will also draw flying projectiles and explosions.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  CHARACTER_COLORS,
  PLAYER_NAMES,
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
  ACTIVE_INDICATOR_COLOR,
  ACTIVE_INDICATOR_BOUNCE_PIXELS,
  ACTIVE_INDICATOR_SIZE,
} from "./config.js";

// Fill the whole canvas with the night-sky colour.
export function drawSky(ctx) {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the wind bar across the very top of the canvas.
export function drawWindIndicator(ctx, wind) {
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

  const arrowLength = (Math.abs(wind) / WIND_MAX) * WIND_ARROW_MAX_LENGTH;
  const direction   = wind > 0 ? 1 : -1;
  const arrowEndX   = centerX + direction * arrowLength;

  ctx.strokeStyle = WIND_ARROW_COLOR;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(arrowEndX, centerY);
  ctx.stroke();

  const headSize = 6;
  ctx.beginPath();
  ctx.moveTo(arrowEndX, centerY);
  ctx.lineTo(arrowEndX - direction * headSize, centerY - headSize / 2);
  ctx.lineTo(arrowEndX - direction * headSize, centerY + headSize / 2);
  ctx.closePath();
  ctx.fillStyle = WIND_ARROW_COLOR;
  ctx.fill();

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

// Draw a simple placeholder character — coloured body, round head, eyes, smile.
export function drawCharacter(ctx, character) {
  const cx         = character.x + character.width / 2;
  const headRadius = 7;
  const headCY     = character.y + headRadius;

  ctx.fillStyle = character.color;
  ctx.fillRect(character.x + 4, character.y + headRadius + 5, character.width - 8, 20);

  ctx.beginPath();
  ctx.arc(cx, headCY, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = character.color;
  ctx.fill();

  const eyeY      = headCY - 2;
  const eyeOffset = character.facingRight ? 2 : -2;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx + eyeOffset - 3, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffset + 3, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, headCY, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Draw "PLAYER 1'S TURN" (or 2) in that player's colour in the top-left corner.
export function drawHUD(ctx, activePlayerIndex) {
  const name  = PLAYER_NAMES[activePlayerIndex].toUpperCase();
  const color = activePlayerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;

  ctx.font         = "bold 16px 'Courier New', monospace";
  ctx.fillStyle    = color;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${name}'S TURN`, 10, WIND_BAR_HEIGHT + 6);
}

// Draw the small downward-pointing triangle that floats above the active character.
// timeMs makes it gently bob up and down so it catches the eye.
export function drawActiveIndicator(ctx, character, timeMs) {
  const bobOffset = Math.sin(timeMs / 300) * ACTIVE_INDICATOR_BOUNCE_PIXELS;
  const cx        = character.x + character.width / 2;

  // The tip of the triangle points DOWN toward the character's head.
  const tipY  = character.y - 14 + bobOffset;
  const baseY = tipY - ACTIVE_INDICATOR_SIZE * 1.2;

  ctx.beginPath();
  ctx.moveTo(cx,                         tipY);   // bottom point
  ctx.lineTo(cx - ACTIVE_INDICATOR_SIZE, baseY);  // top-left
  ctx.lineTo(cx + ACTIVE_INDICATOR_SIZE, baseY);  // top-right
  ctx.closePath();
  ctx.fillStyle = ACTIVE_INDICATOR_COLOR;
  ctx.fill();
}

// Draw the full scene in the correct order.
// sky → wind indicator → buildings → characters → HUD → active indicator
export function drawScene(ctx, world, activePlayerIndex, timeMs) {
  drawSky(ctx);
  drawWindIndicator(ctx, world.wind);
  drawCity(ctx, world.city);
  for (const character of world.characters) {
    drawCharacter(ctx, character);
  }
  drawHUD(ctx, activePlayerIndex);
  drawActiveIndicator(ctx, world.characters[activePlayerIndex], timeMs);
}
