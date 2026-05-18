// render.js
// This file handles drawing everything onto the canvas.
// It draws the sky, wind bar, city, characters, the flying projectile,
// the HUD, and the bouncing indicator above the active player.
// Phase 5 will add explosion animations here.

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
  PROJECTILE_RADIUS,
  PROJECTILE_COLOR,
  PROJECTILE_TRAIL_MAX_POINTS,
  AIM_LINE_LENGTH_SCALE,
  AIM_LINE_DOT_COUNT,
  AIM_LINE_DOT_RADIUS,
  HINT_TEXT,
  HINT_COLOR,
} from "./config.js";
import { getLaunchPoint } from "./physics.js";

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

// Draw a character. pose can be 'idle' or 'armUp'.
// In 'armUp', a small stick extends upward from the throwing shoulder —
// a quick way to show the character is winding up to throw.
export function drawCharacter(ctx, character, pose = "idle") {
  const cx         = character.x + character.width / 2;
  const headRadius = 7;
  const headCY     = character.y + headRadius;

  // Body.
  ctx.fillStyle = character.color;
  ctx.fillRect(character.x + 4, character.y + headRadius + 5, character.width - 8, 20);

  // Head.
  ctx.beginPath();
  ctx.arc(cx, headCY, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = character.color;
  ctx.fill();

  // Eyes — shifted toward the facing direction.
  const eyeY      = headCY - 2;
  const eyeOffset = character.facingRight ? 2 : -2;
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

  // Arm-up pose: a stick from the shoulder pointing upward on the throwing side.
  if (pose === "armUp") {
    const side        = character.facingRight ? 1 : -1;
    const shoulderX   = cx + side * 8;
    const shoulderY   = character.y + headRadius + 7;
    const handX       = shoulderX + side * 7;
    const handY       = shoulderY - 13;

    ctx.strokeStyle = character.color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  }
}

// Draw the flying projectile plus its fading trail.
// The trail shows where the projectile has been — older dots are more transparent.
export function drawProjectile(ctx, projectile) {
  // Trail — dots fade from invisible at the back to semi-opaque near the front.
  for (let i = 0; i < projectile.trail.length; i++) {
    const point     = projectile.trail[i];
    const progress  = i / PROJECTILE_TRAIL_MAX_POINTS; // 0 = oldest, ~1 = newest
    const alpha     = progress * 0.55;
    const dotRadius = 1.5 + progress * 2; // dots grow slightly toward the front
    ctx.beginPath();
    ctx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 216, 77, ${alpha})`;
    ctx.fill();
  }

  // The projectile itself — a filled circle.
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = PROJECTILE_COLOR;
  ctx.fill();

  // A thin line across the circle that rotates as it spins — looks like it's tumbling.
  const sx = Math.cos(projectile.spin) * PROJECTILE_RADIUS;
  const sy = Math.sin(projectile.spin) * PROJECTILE_RADIUS;
  ctx.beginPath();
  ctx.moveTo(projectile.x - sx, projectile.y - sy);
  ctx.lineTo(projectile.x + sx, projectile.y + sy);
  ctx.strokeStyle = "rgba(255, 255, 180, 0.75)";
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Draw a line of dots from the active character's launch point showing the
// throw direction and power. Longer line = more velocity. The dots fade out
// toward the far end so it reads as "this is the direction, not a prediction."
export function drawAimLine(ctx, character, angle, velocity) {
  const { x: startX, y: startY } = getLaunchPoint(character);
  const facing     = character.facingRight ? 1 : -1;
  const angleRad   = angle * (Math.PI / 180);
  const lineLength = velocity * AIM_LINE_LENGTH_SCALE;

  // End point — up and to the facing side, based on the angle.
  const endX = startX + lineLength * Math.cos(angleRad) * facing;
  const endY = startY - lineLength * Math.sin(angleRad); // minus = upward

  for (let i = 0; i < AIM_LINE_DOT_COUNT; i++) {
    const t     = i / (AIM_LINE_DOT_COUNT - 1); // 0 at start, 1 at end
    const dotX  = startX + (endX - startX) * t;
    const dotY  = startY + (endY - startY) * t;
    // Full opacity near the character, fading to ~0.12 at the far end.
    const alpha = 0.55 * (1 - t * 0.78);

    ctx.beginPath();
    ctx.arc(dotX, dotY, AIM_LINE_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
    ctx.fill();
  }
}

// Draw a small hint below the HUD reminding players how to aim.
// Only shown during a player's turn — hidden during flight.
export function drawHint(ctx) {
  ctx.font         = "11px 'Courier New', monospace";
  ctx.fillStyle    = HINT_COLOR;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.fillText(HINT_TEXT, 10, WIND_BAR_HEIGHT + 26);
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

// Draw the small downward-pointing triangle that bobs above the active character.
export function drawActiveIndicator(ctx, character, timeMs) {
  const bobOffset = Math.sin(timeMs / 300) * ACTIVE_INDICATOR_BOUNCE_PIXELS;
  const cx        = character.x + character.width / 2;
  const tipY      = character.y - 14 + bobOffset;
  const baseY     = tipY - ACTIVE_INDICATOR_SIZE * 1.2;

  ctx.beginPath();
  ctx.moveTo(cx,                         tipY);
  ctx.lineTo(cx - ACTIVE_INDICATOR_SIZE, baseY);
  ctx.lineTo(cx + ACTIVE_INDICATOR_SIZE, baseY);
  ctx.closePath();
  ctx.fillStyle = ACTIVE_INDICATOR_COLOR;
  ctx.fill();
}

// Draw the full scene.
// Order: sky → wind indicator → buildings → characters → aim line →
//        projectile → HUD → hint → active indicator
//
// Options object fields:
//   projectile          — the in-flight projectile, or null
//   throwingPlayerIndex — who threw (for arm-up pose)
//   isArmUp             — true during the brief pre-launch pose
//   aim                 — { angle, velocity } for the aim line
//   showAimLine         — draw the aim line (only during PLAYER_TURN)
//   showHint            — draw the keyboard hint (only during PLAYER_TURN)
export function drawScene(ctx, world, activePlayerIndex, timeMs, {
  projectile          = null,
  throwingPlayerIndex = -1,
  isArmUp             = false,
  aim                 = null,
  showAimLine         = false,
  showHint            = false,
} = {}) {
  drawSky(ctx);
  drawWindIndicator(ctx, world.wind);
  drawCity(ctx, world.city);

  for (let i = 0; i < world.characters.length; i++) {
    const pose = (isArmUp && i === throwingPlayerIndex) ? "armUp" : "idle";
    drawCharacter(ctx, world.characters[i], pose);
  }

  // Aim line sits on top of buildings but below the projectile and HUD.
  if (showAimLine && aim) {
    drawAimLine(ctx, world.characters[activePlayerIndex], aim.angle, aim.velocity);
  }

  if (projectile !== null) {
    drawProjectile(ctx, projectile);
  }

  drawHUD(ctx, activePlayerIndex);

  if (showHint) {
    drawHint(ctx);
  }

  // Bobbing indicator only when the player is actively choosing their shot.
  if (!isArmUp && projectile === null) {
    drawActiveIndicator(ctx, world.characters[activePlayerIndex], timeMs);
  }
}
