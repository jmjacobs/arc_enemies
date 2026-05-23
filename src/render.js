// render.js
// This file handles drawing everything onto the canvas.
// Layers (bottom to top): sky → wind bar + scoreboard → city → characters →
// aim line → projectile → explosion → HUD → hint → active indicator → banner.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  CHARACTER_COLORS,
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
  SUPER_BOMB_INDICATOR_COLOR,
  SUPER_BOMB_INDICATOR_ARMED_COLOR,
  SUPER_BOMB_PROJECTILE_RADIUS,
  SUPER_BOMB_PROJECTILE_COLOR,
  BANNER_BG_RGBA,
  BANNER_HEIGHT,
  BANNER_TITLE_FONT,
  BANNER_SUBTITLE_FONT,
  BANNER_TITLE_COLOR,
  BANNER_SUBTITLE_COLOR,
} from "./config.js";
import { getLaunchPoint } from "./physics.js";
import { CHARACTERS, drawCharacterByType } from "./characters.js";

// Pre-computed stars — deterministic LCG so the field is stable across repaints.
const STARS = (() => {
  const stars = [];
  let seed = 0xdeadbeef;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  for (let i = 0; i < 160; i++) {
    stars.push({ x: rand(), y: rand() * 0.72, r: rand() * 1.2 + 0.3, a: rand() * 0.5 + 0.5 });
  }
  return stars;
})();

// Fill the whole canvas with a night-sky gradient, stars, and a horizon glow.
export function drawSky(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Stars
  for (const s of STARS) {
    ctx.beginPath();
    ctx.arc(s.x * CANVAS_WIDTH, s.y * CANVAS_HEIGHT, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 255, ${s.a})`;
    ctx.fill();
  }

  // Horizon city-glow — warm purple bloom at the bottom of the sky.
  const glow = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT, 0,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT, CANVAS_HEIGHT * 0.55,
  );
  glow.addColorStop(0,   'rgba(120, 30, 160, 0.30)');
  glow.addColorStop(0.4, 'rgba(60,  10,  90, 0.12)');
  glow.addColorStop(1,   'rgba(0,    0,   0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the wind bar across the very top of the canvas.
export function drawWindIndicator(ctx, wind) {
  ctx.fillStyle = WIND_BAR_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, WIND_BAR_HEIGHT);

  const centerX = CANVAS_WIDTH / 2;
  const centerY = WIND_BAR_HEIGHT * 0.38;  // arrow row
  const labelY  = WIND_BAR_HEIGHT * 0.78;  // "WIND DIRECTION" row

  if (wind === 0) {
    ctx.fillStyle    = WIND_TEXT_COLOR;
    ctx.font         = "bold 18px system-ui, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No wind", centerX, centerY);
    ctx.font      = "bold 14px system-ui, sans-serif";
    ctx.fillText("WIND DIRECTION", centerX, labelY);
    return;
  }

  const arrowLength = (Math.abs(wind) / WIND_MAX) * WIND_ARROW_MAX_LENGTH;
  const direction   = wind > 0 ? 1 : -1;
  const arrowEndX   = centerX + direction * arrowLength;

  ctx.save();
  ctx.strokeStyle = WIND_ARROW_COLOR;
  ctx.lineWidth   = 5;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(arrowEndX, centerY);
  ctx.stroke();

  const headSize = 14;
  ctx.beginPath();
  ctx.moveTo(arrowEndX, centerY);
  ctx.lineTo(arrowEndX - direction * headSize, centerY - headSize * 0.6);
  ctx.lineTo(arrowEndX - direction * headSize, centerY + headSize * 0.6);
  ctx.closePath();
  ctx.fillStyle = WIND_ARROW_COLOR;
  ctx.fill();
  ctx.restore();

  const labelX = arrowEndX + direction * 16;
  ctx.fillStyle    = WIND_TEXT_COLOR;
  ctx.font         = "bold 18px system-ui, sans-serif";
  ctx.textAlign    = wind > 0 ? "left" : "right";
  ctx.textBaseline = "middle";
  ctx.fillText(wind.toFixed(1), labelX, centerY);

  ctx.font      = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WIND DIRECTION", centerX, labelY);
}

// Draw pill-shaped score badges in the wind bar — P1 left, P2 right.
export function drawScoreboard(ctx, roundWinsByPlayer, playerNames = ["Player 1", "Player 2"]) {
  const y       = WIND_BAR_HEIGHT / 2;
  const pillH   = 56;
  const pillR   = pillH / 2;
  const padding = 28;

  function drawPill(label, color, align) {
    ctx.font         = 'bold 32px system-ui, sans-serif';
    ctx.textBaseline = "middle";
    const textW = ctx.measureText(label).width;
    const pillW = textW + padding * 2;
    const pillX = align === "left"
      ? SCOREBOARD_MARGIN_X
      : CANVAS_WIDTH - SCOREBOARD_MARGIN_X - pillW;

    ctx.save();
    ctx.fillStyle   = `${color}22`;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, y - pillR, pillW, pillH, pillR);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle  = color;
    ctx.textAlign  = "left";
    ctx.fillText(label, pillX + padding, y);
    ctx.restore();
  }

  drawPill(`${playerNames[0]}  ${roundWinsByPlayer[0]}`, CHARACTER_COLORS.player1, "left");
  drawPill(`${playerNames[1]}  ${roundWinsByPlayer[1]}`, CHARACTER_COLORS.player2, "right");
}

// Stamp the offscreen city canvas onto the main canvas.
// Craters show up automatically because they're already carved into world.city.canvas.
export function drawCity(ctx, world) {
  ctx.drawImage(world.city.canvas, 0, 0);
}

// Draw a character using the type-specific draw function from characters.js.
export function drawCharacter(ctx, character, pose = "idle") {
  drawCharacterByType(ctx, character, pose);
}

// Draw the flying projectile plus its fading trail.
export function drawProjectile(ctx, projectile) {
  const isSuperBomb = projectile.isSuperBomb;
  const color  = isSuperBomb ? SUPER_BOMB_PROJECTILE_COLOR : PROJECTILE_COLOR;
  const radius = isSuperBomb ? SUPER_BOMB_PROJECTILE_RADIUS : PROJECTILE_RADIUS;
  const trailR = isSuperBomb ? 255 : 255;
  const trailG = isSuperBomb ?  40 : 216;
  const trailB = isSuperBomb ?  40 :  77;

  for (let i = 0; i < projectile.trail.length; i++) {
    const point     = projectile.trail[i];
    const progress  = i / PROJECTILE_TRAIL_MAX_POINTS;
    const alpha     = progress * 0.55;
    const dotRadius = (isSuperBomb ? 2.5 : 1.5) + progress * 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${trailR}, ${trailG}, ${trailB}, ${alpha})`;
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const sx = Math.cos(projectile.spin) * radius;
  const sy = Math.sin(projectile.spin) * radius;
  ctx.beginPath();
  ctx.moveTo(projectile.x - sx, projectile.y - sy);
  ctx.lineTo(projectile.x + sx, projectile.y + sy);
  ctx.strokeStyle = isSuperBomb ? "rgba(255, 180, 180, 0.75)" : "rgba(255, 255, 180, 0.75)";
  ctx.lineWidth   = isSuperBomb ? 2.5 : 1.5;
  ctx.stroke();
  ctx.restore();
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
export function drawAimLine(ctx, character, angle, velocity, superBombArmed = false) {
  const { x: startX, y: startY } = getLaunchPoint(character);
  const facing     = character.facingRight ? 1 : -1;
  const angleRad   = angle * (Math.PI / 180);
  const lineLength = velocity * AIM_LINE_LENGTH_SCALE;

  const endX = startX + lineLength * Math.cos(angleRad) * facing;
  const endY = startY - lineLength * Math.sin(angleRad);

  const [r, g, b] = superBombArmed ? [255, 40, 40] : [255, 255, 255];

  for (let i = 0; i < AIM_LINE_DOT_COUNT; i++) {
    const t     = i / (AIM_LINE_DOT_COUNT - 1);
    const dotX  = startX + (endX - startX) * t;
    const dotY  = startY + (endY - startY) * t;
    const alpha = 0.55 * (1 - t * 0.78);

    ctx.beginPath();
    ctx.arc(dotX, dotY, AIM_LINE_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    ctx.fill();
  }
}

// Draw the keyboard hint below the HUD — only shown during a player's turn.
export function drawHint(ctx) {
  ctx.font         = "bold 14px 'Courier New', monospace";
  ctx.fillStyle    = HINT_COLOR;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.fillText(HINT_TEXT, 10, WIND_BAR_HEIGHT + 40);
}

// Draw super bomb availability indicators below each player's score pill.
// P1's indicator sits on the left, P2's on the right.
// superBombArmed may be a boolean (sequential) or [bool, bool] (parallel).
export function drawSuperBombIndicators(ctx, superBombAvailable, superBombArmed, activePlayerIndex) {
  const y = WIND_BAR_HEIGHT + 22;

  function isArmed(playerIndex) {
    if (Array.isArray(superBombArmed)) return superBombArmed[playerIndex];
    return superBombArmed && playerIndex === activePlayerIndex;
  }

  function drawIndicator(playerIndex, align, keyLabel) {
    if (!superBombAvailable[playerIndex]) return;

    const armed  = isArmed(playerIndex);
    const color  = armed ? SUPER_BOMB_INDICATOR_ARMED_COLOR : SUPER_BOMB_INDICATOR_COLOR;
    const label  = armed ? "[ SUPER BOMB ARMED ]" : `[ ${keyLabel} ] SUPER BOMB`;
    const x      = align === "left" ? SCOREBOARD_MARGIN_X : CANVAS_WIDTH - SCOREBOARD_MARGIN_X;

    ctx.save();
    ctx.font         = "bold 12px 'Courier New', monospace";
    ctx.fillStyle    = color;
    ctx.textAlign    = align;
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  drawIndicator(0, "left",  "S");
  drawIndicator(1, "right", "L");
}

// Draw the downward-pointing triangle that bobs above the active character.
export function drawActiveIndicator(ctx, character, timeMs) {
  const bobOffset = Math.sin(timeMs / 300) * ACTIVE_INDICATOR_BOUNCE_PIXELS;
  const cx        = character.x + character.width / 2;
  const tipY      = character.y - 14 + bobOffset;
  const baseY     = tipY - ACTIVE_INDICATOR_SIZE * 1.2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx,                         tipY);
  ctx.lineTo(cx - ACTIVE_INDICATOR_SIZE, baseY);
  ctx.lineTo(cx + ACTIVE_INDICATOR_SIZE, baseY);
  ctx.closePath();
  ctx.fillStyle = ACTIVE_INDICATOR_COLOR;
  ctx.fill();
  ctx.restore();
}

// Draw a centred banner band with a title and subtitle.
// Used for both round-win and match-win announcements.
// titleColor overrides the default white so the winner's colour can be used.
function drawBanner(ctx, { title, subtitle, titleColor = BANNER_TITLE_COLOR }) {
  const centerX = CANVAS_WIDTH  / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const top     = centerY - BANNER_HEIGHT / 2;

  // Gradient banner — solid in the centre, fading to transparent at the edges.
  const bgGrad = ctx.createLinearGradient(0, top, 0, top + BANNER_HEIGHT);
  bgGrad.addColorStop(0,   'rgba(5, 0, 25, 0)');
  bgGrad.addColorStop(0.2, BANNER_BG_RGBA);
  bgGrad.addColorStop(0.8, BANNER_BG_RGBA);
  bgGrad.addColorStop(1,   'rgba(5, 0, 25, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, top, CANVAS_WIDTH, BANNER_HEIGHT);

  // Thin glowing accent lines at top and bottom edges.
  ctx.save();
  ctx.strokeStyle = `${titleColor}88`;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, top); ctx.lineTo(CANVAS_WIDTH, top);
  ctx.moveTo(0, top + BANNER_HEIGHT); ctx.lineTo(CANVAS_WIDTH, top + BANNER_HEIGHT);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.font      = BANNER_TITLE_FONT;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, centerX, top + BANNER_HEIGHT * 0.38);
  ctx.restore();

  ctx.font      = BANNER_SUBTITLE_FONT;
  ctx.fillStyle = BANNER_SUBTITLE_COLOR;
  ctx.fillText(subtitle, centerX, top + BANNER_HEIGHT * 0.72);
}

// Show who won the round and the current running score.
export function drawRoundBanner(ctx, winnerIndex, roundWinsByPlayer, playerNames = ["Player 1", "Player 2"]) {
  const name  = playerNames[winnerIndex].toUpperCase();
  const color = winnerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
  const [w0, w1] = roundWinsByPlayer;

  drawBanner(ctx, {
    title:      `${name} WINS THE ROUND!`,
    subtitle:   `${w0} — ${w1}`,
    titleColor: color,
  });
}

// Show who won the entire match and prompt for a rematch.
export function drawMatchBanner(ctx, winnerIndex, roundWinsByPlayer, playerNames = ["Player 1", "Player 2"]) {
  const name  = playerNames[winnerIndex].toUpperCase();
  const color = winnerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
  const [w0, w1] = roundWinsByPlayer;

  drawBanner(ctx, {
    title:      `${name} WINS THE MATCH!`,
    subtitle:   `${w0} — ${w1}`,
    titleColor: color,
  });
}

// Draw the character selection screen.
// charSelectPhase: 0 = P1 choosing, 1 = P2 choosing, 2 = mode select.
// charPreview:    [p1Index, p2Index] currently browsed character per player.
// playerNames:    confirmed names.
// charNameInput:  what the current player has typed so far.
// gameModeIndex:  0 = SEQUENTIAL, 1 = PARALLEL (only relevant on phase 2).
// timeMs:         used for cursor blinking.
export function drawCharacterSelect(ctx, { charSelectPhase, charPreview, playerNames, charNameInput, gameModeIndex = 0 }, timeMs = 0) {
  drawSky(ctx);

  // Phase 2 — game mode selector
  if (charSelectPhase === 2) {
    // Show both players' choices at the top
    const p1Col = CHARACTER_COLORS.player1;
    const p2Col = CHARACTER_COLORS.player2;
    ctx.save();
    ctx.font         = "bold 14px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle    = p1Col;
    ctx.textAlign    = "left";
    ctx.fillText(`${playerNames[0]} chose: ${CHARACTERS[charPreview[0]].name}`, 24, 24);
    ctx.fillStyle    = p2Col;
    ctx.textAlign    = "right";
    ctx.fillText(`${playerNames[1]} chose: ${CHARACTERS[charPreview[1]].name}`, CANVAS_WIDTH - 24, 24);
    ctx.restore();

    // Title
    ctx.font         = "bold 44px system-ui, sans-serif";
    ctx.fillStyle    = "#ffffff";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("ARC ENEMIES", CANVAS_WIDTH / 2, 40);

    ctx.font         = "bold 18px system-ui, sans-serif";
    ctx.fillStyle    = "rgba(255,255,255,0.70)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("SELECT GAME MODE", CANVAS_WIDTH / 2, 116);

    // Mode cards
    const modes = [
      { label: "SEQUENTIAL", sub: "Players take turns" },
      { label: "PARALLEL",   sub: "Both fire at once" },
    ];
    const cardW = 320, cardH = 160, cardGap = 60;
    const totalW = modes.length * cardW + (modes.length - 1) * cardGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const cardY  = 200;

    for (let i = 0; i < modes.length; i++) {
      const cx    = startX + i * (cardW + cardGap);
      const isSel = i === gameModeIndex;
      const col   = isSel ? "#ffffff" : "rgba(255,255,255,0.25)";

      ctx.save();
      ctx.strokeStyle = isSel ? "#ffffff" : "rgba(255,255,255,0.18)";
      ctx.fillStyle   = isSel ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)";
      ctx.lineWidth   = isSel ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font         = `bold 26px system-ui, sans-serif`;
      ctx.fillStyle    = col;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(modes[i].label, cx + cardW / 2, cardY + cardH * 0.38);

      ctx.font         = "14px system-ui, sans-serif";
      ctx.fillStyle    = isSel ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.22)";
      ctx.fillText(modes[i].sub, cx + cardW / 2, cardY + cardH * 0.62);

      if (i === 1) {
        ctx.font      = "12px 'Courier New', monospace";
        ctx.fillStyle = isSel ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.18)";
        ctx.fillText("P1: SHIFT  |  P2: SHIFT →", cx + cardW / 2, cardY + cardH * 0.80);
      } else {
        ctx.font      = "12px 'Courier New', monospace";
        ctx.fillStyle = isSel ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.18)";
        ctx.fillText("SPACE to aim and fire", cx + cardW / 2, cardY + cardH * 0.80);
      }
    }

    ctx.font         = "13px system-ui, sans-serif";
    ctx.fillStyle    = "rgba(255,255,255,0.38)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("◄  ►  to choose mode     ENTER to start", CANVAS_WIDTH / 2, cardY + cardH + 36);
    return;
  }

  // Phase 0 or 1 — character + name selection
  const pIdx  = charSelectPhase;
  const color = pIdx === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
  const sel   = charPreview[pIdx];

  // While P2 is selecting, show P1's confirmed name + character as a badge.
  if (pIdx === 1) {
    const p1Col = CHARACTER_COLORS.player1;
    ctx.save();
    ctx.font         = "bold 14px system-ui, sans-serif";
    ctx.fillStyle    = p1Col;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${playerNames[0]} chose: ${CHARACTERS[charPreview[0]].name}`, 24, 24);
    ctx.restore();
  }

  // Game title
  ctx.font         = "bold 44px system-ui, sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("ARC ENEMIES", CANVAS_WIDTH / 2, 40);

  // Player heading
  ctx.font         = "bold 18px system-ui, sans-serif";
  ctx.fillStyle    = color;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`PLAYER ${pIdx + 1}  —  CHOOSE YOUR CHARACTER`, CANVAS_WIDTH / 2, 116);

  // Thumbnail row
  const thumbW = 56, thumbH = 64, gap = 32;
  const totalW = CHARACTERS.length * thumbW + (CHARACTERS.length - 1) * gap;
  const rowX   = (CANVAS_WIDTH - totalW) / 2;
  const rowY   = 146;

  for (let i = 0; i < CHARACTERS.length; i++) {
    const tx    = rowX + i * (thumbW + gap);
    const isSel = i === sel;

    ctx.save();
    if (isSel) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth   = 1;
    }
    ctx.strokeRect(tx - 8, rowY - 8, thumbW + 16, thumbH + 16);
    ctx.restore();

    const fakeChar = { x: tx, y: rowY, width: thumbW, height: thumbH, facingRight: true, charType: i };
    if (!isSel) { ctx.save(); ctx.globalAlpha = 0.38; }
    drawCharacterByType(ctx, fakeChar, 'idle');
    if (!isSel) ctx.restore();

    ctx.font         = "bold 11px system-ui, sans-serif";
    ctx.fillStyle    = isSel ? color : "rgba(255,255,255,0.30)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(CHARACTERS[i].name.toUpperCase(), tx + thumbW / 2, rowY + thumbH + 20);
  }

  // Large preview
  const pvW = 112, pvH = 128;
  const pvX = CANVAS_WIDTH / 2 - pvW / 2;
  const pvY = 260;
  drawCharacterByType(ctx, { x: pvX, y: pvY, width: pvW, height: pvH, facingRight: true, charType: sel }, 'idle');

  // Selected character name
  ctx.font         = "bold 26px system-ui, sans-serif";
  ctx.fillStyle    = color;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(CHARACTERS[sel].name.toUpperCase(), CANVAS_WIDTH / 2, pvY + pvH + 16);

  // Instructions
  ctx.font         = "13px system-ui, sans-serif";
  ctx.fillStyle    = "rgba(255,255,255,0.38)";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("◄  ►  to choose character     ENTER to confirm", CANVAS_WIDTH / 2, pvY + pvH + 50);

  // Name input label
  ctx.font         = "bold 13px system-ui, sans-serif";
  ctx.fillStyle    = "rgba(255,255,255,0.50)";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("TYPE YOUR NAME", CANVAS_WIDTH / 2, pvY + pvH + 116);

  // Name input box
  const boxW = 480, boxH = 44;
  const boxX = CANVAS_WIDTH / 2 - boxW / 2;
  const boxY = pvY + pvH + 136;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.font         = "bold 22px system-ui, sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  if (charNameInput.length > 0) {
    const cursor = Math.floor(timeMs / 500) % 2 === 0 ? "|" : "";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(charNameInput + cursor, boxX + 16, boxY + boxH / 2);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText("Enter your name...", boxX + 16, boxY + boxH / 2);
  }
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
  superBombAvailable  = [true, true],
  superBombArmed      = false,
  playerNames         = ["Player 1", "Player 2"],
  parallelData        = null,
} = {}) {
  drawSky(ctx);
  drawWindIndicator(ctx, world.wind);
  drawScoreboard(ctx, roundWinsByPlayer, playerNames);
  drawSuperBombIndicators(ctx, superBombAvailable, superBombArmed, activePlayerIndex);

  drawCity(ctx, world);

  if (parallelData) {
    // Parallel mode — draw both characters; arm-up per player
    for (let i = 0; i < world.characters.length; i++) {
      const pose = parallelData.isArmUp[i] ? "armUp" : "idle";
      drawCharacter(ctx, world.characters[i], pose);
    }
    // Aim lines for each player who is still aiming
    for (let i = 0; i < 2; i++) {
      if (parallelData.showAimLine[i] && parallelData.aims[i]) {
        drawAimLine(ctx, world.characters[i], parallelData.aims[i].angle, parallelData.aims[i].velocity, Array.isArray(superBombArmed) ? superBombArmed[i] : false);
      }
    }
    // Projectiles
    for (let i = 0; i < 2; i++) {
      if (parallelData.projectiles[i] !== null) drawProjectile(ctx, parallelData.projectiles[i]);
    }
    // Explosions
    for (let i = 0; i < 2; i++) {
      if (parallelData.explosions[i] !== null) drawExplosion(ctx, parallelData.explosions[i], timeMs);
    }
  } else {
    // Sequential mode
    for (let i = 0; i < world.characters.length; i++) {
      const pose = (isArmUp && i === throwingPlayerIndex) ? "armUp" : "idle";
      drawCharacter(ctx, world.characters[i], pose);
    }
    if (showAimLine && aim) {
      drawAimLine(ctx, world.characters[activePlayerIndex], aim.angle, aim.velocity, superBombArmed);
    }
    if (projectile !== null) drawProjectile(ctx, projectile);
    if (explosion  !== null) drawExplosion(ctx, explosion, timeMs);
  }

  const anyProjectile = parallelData
    ? parallelData.projectiles.some(p => p !== null)
    : projectile !== null;
  const anyExplosion = parallelData
    ? parallelData.explosions.some(e => e !== null)
    : explosion !== null;
  const anyArmUp = parallelData
    ? parallelData.isArmUp.some(Boolean)
    : isArmUp;

  const bannerActive = roundBannerWinner >= 0 || matchBannerWinner >= 0;
  if (!anyArmUp && !anyProjectile && !anyExplosion && !bannerActive) {
    if (parallelData) {
      // In parallel mode show both indicators
      for (let i = 0; i < 2; i++) {
        if (parallelData.canFire[i]) drawActiveIndicator(ctx, world.characters[i], timeMs);
      }
    } else {
      drawActiveIndicator(ctx, world.characters[activePlayerIndex], timeMs);
    }
  }

  // Banners sit on top of everything else.
  if (roundBannerWinner >= 0) {
    drawRoundBanner(ctx, roundBannerWinner, roundWinsByPlayer, playerNames);
  } else if (matchBannerWinner >= 0) {
    drawMatchBanner(ctx, matchBannerWinner, roundWinsByPlayer, playerNames);
  }
}
