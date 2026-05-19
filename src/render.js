// render.js
// This file handles drawing everything onto the canvas.
// Layers (bottom to top): sky → wind bar + scoreboard → city → characters →
// aim line → projectile → explosion → HUD → hint → active indicator → banner.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  CHARACTER_COLORS,
  PLAYER_NAMES,
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
  EXPLOSION_DURATION_MS,
  EXPLOSION_COLORS,
  SCOREBOARD_FONT,
  SCOREBOARD_MARGIN_X,
  BANNER_BG_RGBA,
  BANNER_HEIGHT,
  BANNER_TITLE_FONT,
  BANNER_SUBTITLE_FONT,
  BANNER_TITLE_COLOR,
  BANNER_SUBTITLE_COLOR,
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

// Draw the round-win tally in the wind bar — P1 on the left, P2 on the right.
// Kept in the wind bar so it's always visible above the action.
export function drawScoreboard(ctx, roundWinsByPlayer) {
  ctx.font         = SCOREBOARD_FONT;
  ctx.textBaseline = "middle";
  const y = WIND_BAR_HEIGHT / 2;

  ctx.fillStyle = CHARACTER_COLORS.player1;
  ctx.textAlign = "left";
  ctx.fillText(`P1: ${roundWinsByPlayer[0]}`, SCOREBOARD_MARGIN_X, y);

  ctx.fillStyle = CHARACTER_COLORS.player2;
  ctx.textAlign = "right";
  ctx.fillText(`P2: ${roundWinsByPlayer[1]}`, CANVAS_WIDTH - SCOREBOARD_MARGIN_X, y);
}

// Stamp the offscreen city canvas onto the main canvas.
// Craters show up automatically because they're already carved into world.city.canvas.
export function drawCity(ctx, world) {
  ctx.drawImage(world.city.canvas, 0, 0);
}

// Draw a character. pose can be 'idle' or 'armUp'.
// In 'armUp', a small stick extends upward from the throwing shoulder.
export function drawCharacter(ctx, character, pose = "idle") {
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

  if (pose === "armUp") {
    const side      = character.facingRight ? 1 : -1;
    const shoulderX = cx + side * 8;
    const shoulderY = character.y + headRadius + 7;
    const handX     = shoulderX + side * 7;
    const handY     = shoulderY - 13;

    ctx.strokeStyle = character.color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  }
}

// Draw the flying projectile plus its fading trail.
export function drawProjectile(ctx, projectile) {
  for (let i = 0; i < projectile.trail.length; i++) {
    const point     = projectile.trail[i];
    const progress  = i / PROJECTILE_TRAIL_MAX_POINTS;
    const alpha     = progress * 0.55;
    const dotRadius = 1.5 + progress * 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 216, 77, ${alpha})`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = PROJECTILE_COLOR;
  ctx.fill();

  const sx = Math.cos(projectile.spin) * PROJECTILE_RADIUS;
  const sy = Math.sin(projectile.spin) * PROJECTILE_RADIUS;
  ctx.beginPath();
  ctx.moveTo(projectile.x - sx, projectile.y - sy);
  ctx.lineTo(projectile.x + sx, projectile.y + sy);
  ctx.strokeStyle = "rgba(255, 255, 180, 0.75)";
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Draw an expanding, fading fireball at the explosion's location.
export function drawExplosion(ctx, explosion, timeMs) {
  const elapsed  = timeMs - explosion.startTime;
  const progress = Math.min(elapsed / EXPLOSION_DURATION_MS, 1);
  const alpha    = 1 - progress;
  const drawR    = explosion.radius * (0.6 + 0.4 * progress);

  const grad = ctx.createRadialGradient(
    explosion.x, explosion.y, 0,
    explosion.x, explosion.y, drawR,
  );
  EXPLOSION_COLORS.forEach((color, i) => {
    grad.addColorStop(i / (EXPLOSION_COLORS.length - 1), color);
  });

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, drawR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// Draw a dotted aim line from the active character's launch point.
export function drawAimLine(ctx, character, angle, velocity) {
  const { x: startX, y: startY } = getLaunchPoint(character);
  const facing     = character.facingRight ? 1 : -1;
  const angleRad   = angle * (Math.PI / 180);
  const lineLength = velocity * AIM_LINE_LENGTH_SCALE;

  const endX = startX + lineLength * Math.cos(angleRad) * facing;
  const endY = startY - lineLength * Math.sin(angleRad);

  for (let i = 0; i < AIM_LINE_DOT_COUNT; i++) {
    const t     = i / (AIM_LINE_DOT_COUNT - 1);
    const dotX  = startX + (endX - startX) * t;
    const dotY  = startY + (endY - startY) * t;
    const alpha = 0.55 * (1 - t * 0.78);

    ctx.beginPath();
    ctx.arc(dotX, dotY, AIM_LINE_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
    ctx.fill();
  }
}

// Draw the keyboard hint below the HUD — only shown during a player's turn.
export function drawHint(ctx) {
  ctx.font         = "11px 'Courier New', monospace";
  ctx.fillStyle    = HINT_COLOR;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.fillText(HINT_TEXT, 10, WIND_BAR_HEIGHT + 26);
}

// Draw "PLAYER 1'S TURN" (or 2) in the top-left corner.
export function drawHUD(ctx, activePlayerIndex) {
  const name  = PLAYER_NAMES[activePlayerIndex].toUpperCase();
  const color = activePlayerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;

  ctx.font         = "bold 16px 'Courier New', monospace";
  ctx.fillStyle    = color;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${name}'S TURN`, 10, WIND_BAR_HEIGHT + 6);
}

// Draw the downward-pointing triangle that bobs above the active character.
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

// Draw a centred banner band with a title and subtitle.
// Used for both round-win and match-win announcements.
// titleColor overrides the default white so the winner's colour can be used.
function drawBanner(ctx, { title, subtitle, titleColor = BANNER_TITLE_COLOR }) {
  const centerX = CANVAS_WIDTH  / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const top     = centerY - BANNER_HEIGHT / 2;

  ctx.fillStyle = BANNER_BG_RGBA;
  ctx.fillRect(0, top, CANVAS_WIDTH, BANNER_HEIGHT);

  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.font      = BANNER_TITLE_FONT;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, centerX, top + BANNER_HEIGHT * 0.38);

  ctx.font      = BANNER_SUBTITLE_FONT;
  ctx.fillStyle = BANNER_SUBTITLE_COLOR;
  ctx.fillText(subtitle, centerX, top + BANNER_HEIGHT * 0.72);
}

// Show who won the round and the current running score.
export function drawRoundBanner(ctx, winnerIndex, roundWinsByPlayer) {
  const name  = PLAYER_NAMES[winnerIndex].toUpperCase();
  const color = winnerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
  const [w0, w1] = roundWinsByPlayer;

  drawBanner(ctx, {
    title:      `${name} WINS THE ROUND!`,
    subtitle:   `${w0} — ${w1}`,
    titleColor: color,
  });
}

// Show who won the entire match and prompt for a rematch.
export function drawMatchBanner(ctx, winnerIndex, roundWinsByPlayer) {
  const name  = PLAYER_NAMES[winnerIndex].toUpperCase();
  const color = winnerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
  const [w0, w1] = roundWinsByPlayer;

  drawBanner(ctx, {
    title:      `${name} WINS THE MATCH!`,
    subtitle:   `${w0} — ${w1}   ·   press R for a new match`,
    titleColor: color,
  });
}

// Draw the full scene every frame.
//
// Draw order:
//   sky → wind bar + scoreboard → city → characters → aim line →
//   projectile → explosion → HUD → hint → active indicator → banner
//
// Options:
//   projectile          — in-flight projectile, or null
//   throwingPlayerIndex — who threw (for arm-up pose)
//   isArmUp             — true during the brief pre-launch wind-up
//   aim                 — { angle, velocity } for the aim line
//   showAimLine         — only true during PLAYER_TURN
//   showHint            — only true during PLAYER_TURN
//   explosion           — active explosion object, or null
//   roundWinsByPlayer   — [p1wins, p2wins] for the scoreboard
//   roundBannerWinner   — ≥0 to show the round-win banner (winnerIndex)
//   matchBannerWinner   — ≥0 to show the match-win banner (winnerIndex)
export function drawScene(ctx, world, activePlayerIndex, timeMs, {
  projectile          = null,
  throwingPlayerIndex = -1,
  isArmUp             = false,
  aim                 = null,
  showAimLine         = false,
  showHint            = false,
  explosion           = null,
  roundWinsByPlayer   = [0, 0],
  roundBannerWinner   = -1,
  matchBannerWinner   = -1,
} = {}) {
  drawSky(ctx);
  drawWindIndicator(ctx, world.wind);
  drawScoreboard(ctx, roundWinsByPlayer);

  drawCity(ctx, world);

  for (let i = 0; i < world.characters.length; i++) {
    const pose = (isArmUp && i === throwingPlayerIndex) ? "armUp" : "idle";
    drawCharacter(ctx, world.characters[i], pose);
  }

  if (showAimLine && aim) {
    drawAimLine(ctx, world.characters[activePlayerIndex], aim.angle, aim.velocity);
  }

  if (projectile !== null) {
    drawProjectile(ctx, projectile);
  }

  if (explosion !== null) {
    drawExplosion(ctx, explosion, timeMs);
  }

  drawHUD(ctx, activePlayerIndex);

  if (showHint) {
    drawHint(ctx);
  }

  const bannerActive = roundBannerWinner >= 0 || matchBannerWinner >= 0;
  if (!isArmUp && projectile === null && explosion === null && !bannerActive) {
    drawActiveIndicator(ctx, world.characters[activePlayerIndex], timeMs);
  }

  // Banners sit on top of everything else.
  if (roundBannerWinner >= 0) {
    drawRoundBanner(ctx, roundBannerWinner, roundWinsByPlayer);
  } else if (matchBannerWinner >= 0) {
    drawMatchBanner(ctx, matchBannerWinner, roundWinsByPlayer);
  }
}
