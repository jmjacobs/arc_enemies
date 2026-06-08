// render.js
// This file handles drawing everything onto the canvas.
// Layers (bottom to top): sky → wind bar + scoreboard → city → characters →
// aim line → projectile → explosion → HUD → hint → active indicator → banner.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  THEMES,
  CHARACTER_COLORS,
  MAX_HP,
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
  TUNNEL_BOMB_PROJECTILE_RADIUS,
  TUNNEL_BOMB_PROJECTILE_COLOR,
  FREEZE_BOMB_PROJECTILE_RADIUS,
  FREEZE_BOMB_PROJECTILE_COLOR,
  FREEZE_BOMB_BLOCK_SIZE,
  FREEZE_BOMB_BLOCK_COLOR,
  FREEZE_BOMB_EXPAND_DURATION_MS,
  BANNER_BG_RGBA,
  BANNER_HEIGHT,
  BANNER_TITLE_FONT,
  BANNER_SUBTITLE_FONT,
  BANNER_TITLE_COLOR,
  BANNER_SUBTITLE_COLOR,
} from "./config.js";
import { getLaunchPoint } from "./physics.js";
import { CHARACTERS, drawCharacterByType } from "./characters.js";

// Screen shake state — set by triggerShake(), consumed each frame in drawScene().
let _shakeStart = -1e9;
let _shakeAmp   = 0;
const SHAKE_MS  = 380;

export function triggerShake(amplitude) {
  _shakeStart = performance.now();
  _shakeAmp   = amplitude;
}

// Pre-computed star pool — 250 entries so every theme has enough to draw from.
const STARS = (() => {
  const stars = [];
  let seed = 0xdeadbeef;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  for (let i = 0; i < 250; i++) {
    stars.push({ x: rand(), y: rand() * 0.72, r: rand() * 1.2 + 0.3, a: rand() * 0.5 + 0.5 });
  }
  return stars;
})();

// Fill the whole canvas with a sky gradient, stars, and a horizon glow.
// theme defaults to THEMES[0] (neon city) when not supplied, e.g. on the character select screen.
export function drawSky(ctx, theme = null) {
  const t = theme ?? THEMES[0];

  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, t.skyTop);
  grad.addColorStop(1, t.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Stars — draw up to theme.starCount entries from the pre-computed pool.
  const [sr, sg, sb] = t.starRgb;
  const count = Math.min(t.starCount, STARS.length);
  for (let i = 0; i < count; i++) {
    const s = STARS[i];
    ctx.beginPath();
    ctx.arc(s.x * CANVAS_WIDTH, s.y * CANVAS_HEIGHT, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${s.a})`;
    ctx.fill();
  }

  // Horizon glow.
  const glow = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT, 0,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT, CANVAS_HEIGHT * 0.55,
  );
  glow.addColorStop(0,   t.glowInner);
  glow.addColorStop(0.4, t.glowMid);
  glow.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Draw the wind bar across the very top of the canvas.
export function drawWindIndicator(ctx, wind) {
  ctx.fillStyle = WIND_BAR_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, WIND_BAR_HEIGHT);

  const cx     = CANVAS_WIDTH / 2;
  const arrowY = Math.round(WIND_BAR_HEIGHT * 0.74);
  const labelY = Math.round(WIND_BAR_HEIGHT * 0.30);
  const neon   = "#b06cff";
  const dim    = "rgba(176, 108, 255, 0.28)";
  const trackR = WIND_ARROW_MAX_LENGTH;

  // Faint track line with tick marks at centre and extremes
  ctx.save();
  ctx.strokeStyle = dim;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - trackR, arrowY);
  ctx.lineTo(cx + trackR, arrowY);
  ctx.stroke();
  [-trackR, 0, trackR].forEach(dx => {
    ctx.beginPath();
    ctx.moveTo(cx + dx, arrowY - 6);
    ctx.lineTo(cx + dx, arrowY + 6);
    ctx.stroke();
  });
  ctx.restore();

  // Small "WIND" header
  ctx.save();
  ctx.font         = "bold 16px 'Courier New', monospace";
  ctx.fillStyle    = "rgba(176, 108, 255, 0.85)";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WIND", cx, labelY);
  ctx.restore();

  if (wind === 0) {
    ctx.save();
    ctx.font         = "bold 16px 'Courier New', monospace";
    ctx.fillStyle    = "rgba(176, 108, 255, 0.75)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor  = neon;
    ctx.shadowBlur   = 8;
    ctx.fillText("— CALM —", cx, arrowY);
    ctx.restore();
    return;
  }

  const arrowLen = (Math.abs(wind) / WIND_MAX) * trackR;
  const dir      = wind > 0 ? 1 : -1;
  const endX     = cx + dir * arrowLen;

  // Glowing arrow shaft
  ctx.save();
  ctx.shadowColor = neon;
  ctx.shadowBlur  = 16;
  ctx.strokeStyle = neon;
  ctx.lineWidth   = 6;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.moveTo(cx, arrowY);
  ctx.lineTo(endX - dir * 22, arrowY);
  ctx.stroke();
  ctx.restore();

  // Arrowhead
  ctx.save();
  ctx.shadowColor = neon;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = neon;
  ctx.beginPath();
  ctx.moveTo(endX,              arrowY);
  ctx.lineTo(endX - dir * 22,  arrowY - 13);
  ctx.lineTo(endX - dir * 22,  arrowY + 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Wind value in monospace with glow
  ctx.save();
  ctx.shadowColor  = neon;
  ctx.shadowBlur   = 10;
  ctx.font         = "bold 18px 'Courier New', monospace";
  ctx.fillStyle    = neon;
  ctx.textAlign    = dir > 0 ? "left" : "right";
  ctx.textBaseline = "middle";
  ctx.fillText(wind.toFixed(1), endX + dir * 16, arrowY);
  ctx.restore();
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
  const isSuperBomb  = projectile.isSuperBomb;
  const isTunnelBomb  = projectile.isTunnelBomb;
  const isFreezeBomb  = projectile.isFreezeBomb;
  const color  = isSuperBomb  ? SUPER_BOMB_PROJECTILE_COLOR
               : isTunnelBomb ? TUNNEL_BOMB_PROJECTILE_COLOR
               : isFreezeBomb ? FREEZE_BOMB_PROJECTILE_COLOR
               : PROJECTILE_COLOR;
  const radius = isSuperBomb  ? SUPER_BOMB_PROJECTILE_RADIUS
               : isTunnelBomb ? TUNNEL_BOMB_PROJECTILE_RADIUS
               : isFreezeBomb ? FREEZE_BOMB_PROJECTILE_RADIUS
               : PROJECTILE_RADIUS;
  const trailR = isSuperBomb ? 255 : isTunnelBomb ? 170 : isFreezeBomb ? 200 : 255;
  const trailG = isSuperBomb ?  40 : isTunnelBomb ? 221 : isFreezeBomb ? 240 : 216;
  const trailB = isSuperBomb ?  40 : isTunnelBomb ? 255 : isFreezeBomb ? 255 :  77;

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

function drawFreezeBlock(ctx, proj, timeMs) {
  const elapsed  = timeMs - proj.frozenAt;
  const progress = Math.min(elapsed / FREEZE_BOMB_EXPAND_DURATION_MS, 1);
  const size     = FREEZE_BOMB_BLOCK_SIZE * progress;
  const half     = size / 2;
  const corner   = Math.max(2, 12 * progress);
  const cx = proj.x, cy = proj.y;

  ctx.save();

  // Soft outer glow — blue, not white
  ctx.shadowColor = '#2266cc';
  ctx.shadowBlur  = 28 * progress;

  // Main body — offset radial gradient so the light source feels top-left
  const grad = ctx.createRadialGradient(cx - half * 0.25, cy - half * 0.25, 0, cx, cy, half * 1.45);
  grad.addColorStop(0,    'rgba(160, 215, 255, 0.97)');
  grad.addColorStop(0.28, 'rgba(70,  145, 230, 0.94)');
  grad.addColorStop(0.65, 'rgba(28,  80,  175, 0.91)');
  grad.addColorStop(1,    'rgba(10,  40,  110, 0.88)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, size, size, corner);
  ctx.fill();

  // Top-left specular highlight — like light catching a glass surface
  ctx.shadowBlur = 0;
  const hi = ctx.createRadialGradient(cx - half * 0.5, cy - half * 0.5, 0, cx - half * 0.2, cy - half * 0.2, half * 0.85);
  hi.addColorStop(0,   'rgba(255, 255, 255, 0.32)');
  hi.addColorStop(0.6, 'rgba(180, 220, 255, 0.08)');
  hi.addColorStop(1,   'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, size, size, corner);
  ctx.fill();

  ctx.restore();
}

// Super bomb button dimensions — mirrored in game.js for hit detection.
export const SB_BTN_W = 200;
export const SB_BTN_H = 28;
export const SB_BTN_Y = WIND_BAR_HEIGHT + 8;

// Draw the bomb inventory for both players — three pills per player:
// NORMAL | SUPER | DRILL. Selected pill is highlighted; used-up pills are dim.
// superBombArmed / tunnelBombArmed may be boolean (sequential) or [bool,bool] (parallel).
export function drawSuperBombIndicators(ctx, superBombAvailable, superBombArmed, tunnelBombAvailable, tunnelBombArmed, freezeBombAvailable, freezeBombArmed, activePlayerIndex, isParallel = false) {
  const PILL_W = 60, PILL_H = 24, PILL_GAP = 4;
  const TOTAL_W = 4 * PILL_W + 3 * PILL_GAP;

  function armedSuper(p)  {
    if (Array.isArray(superBombArmed))  return superBombArmed[p];
    return superBombArmed  && p === activePlayerIndex;
  }
  function armedTunnel(p) {
    if (Array.isArray(tunnelBombArmed)) return tunnelBombArmed[p];
    return tunnelBombArmed && p === activePlayerIndex;
  }
  function armedFreeze(p) {
    if (Array.isArray(freezeBombArmed)) return freezeBombArmed[p];
    return freezeBombArmed && p === activePlayerIndex;
  }

  function drawPlayer(playerIndex, startX) {
    const color  = playerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;
    const aSuper  = armedSuper(playerIndex);
    const aTunnel = armedTunnel(playerIndex);
    const aFreeze = armedFreeze(playerIndex);
    const current = aSuper ? 'super' : aTunnel ? 'tunnel' : aFreeze ? 'freeze' : 'normal';

    const superCount = superBombAvailable[playerIndex];
    const pills = [
      { key: 'normal', label: 'NORMAL',                                          avail: true          },
      { key: 'super',  label: superCount > 1 ? `SUPER ×${superCount}` : 'SUPER', avail: superCount > 0 },
      { key: 'tunnel', label: 'DRILL',                                            avail: tunnelBombAvailable[playerIndex] },
      { key: 'freeze', label: 'FREEZE',                                           avail: freezeBombAvailable[playerIndex] },
    ];

    for (let i = 0; i < pills.length; i++) {
      const { key, label, avail } = pills[i];
      const px  = startX + i * (PILL_W + PILL_GAP);
      const py  = SB_BTN_Y;
      const sel = key === current;

      ctx.save();
      if (sel && key !== 'normal') {
        ctx.shadowColor = color;
        ctx.shadowBlur  = 10;
      }
      if (sel) {
        ctx.fillStyle   = `${color}44`;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
      } else if (avail) {
        ctx.fillStyle   = `${color}18`;
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth   = 1;
      } else {
        ctx.fillStyle   = 'rgba(40,40,40,0.4)';
        ctx.strokeStyle = 'rgba(100,100,100,0.25)';
        ctx.lineWidth   = 1;
      }
      ctx.beginPath();
      ctx.roundRect(px, py, PILL_W, PILL_H, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font         = `${sel ? 'bold ' : ''}10px 'Courier New', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = sel
        ? (key === 'super' ? SUPER_BOMB_INDICATOR_ARMED_COLOR : key === 'tunnel' ? TUNNEL_BOMB_PROJECTILE_COLOR : key === 'freeze' ? FREEZE_BOMB_PROJECTILE_COLOR : color)
        : (avail ? `${color}88` : 'rgba(90,90,90,0.6)');
      ctx.fillText(avail || key === 'normal' ? label : `${label} ✗`, px + PILL_W / 2, py + PILL_H / 2);
    }

    // Key hint below pills
    const keyLabel = playerIndex === 0 ? 'S' : 'L';
    const hintY = SB_BTN_Y + PILL_H + 7;
    ctx.font         = `bold 10px system-ui, sans-serif`;
    ctx.fillStyle    = `${color}66`;
    ctx.textBaseline = 'top';
    ctx.textAlign    = playerIndex === 0 ? 'left' : 'right';
    const hintX      = playerIndex === 0 ? startX : startX + TOTAL_W;
    const shiftHint  = isParallel ? `  -  [${playerIndex === 0 ? 'L-SHIFT' : 'R-SHIFT'}] FIRE` : '';
    ctx.fillText(`[${keyLabel}] CYCLE WEAPONS${shiftHint}`, hintX, hintY);
  }

  drawPlayer(0, SCOREBOARD_MARGIN_X);
  drawPlayer(1, CANVAS_WIDTH - SCOREBOARD_MARGIN_X - TOTAL_W);
}

// ── Per-theme background and atmosphere ─────────────────────────────────────

function drawMountains(ctx) {
  const layers = [
    {
      color: '#130501',
      pts:   [[0,720],[0,410],[150,305],[300,425],[445,255],[575,365],[700,265],[840,385],[975,285],[1115,395],[1260,315],[1280,355],[1280,720]],
    },
    {
      color: '#1e0a04',
      pts:   [[0,720],[0,470],[110,400],[235,490],[375,370],[505,458],[635,398],[765,472],[895,402],[1025,468],[1155,408],[1280,448],[1280,720]],
    },
    {
      color: '#2c1208',
      pts:   [[0,720],[0,535],[90,492],[185,548],[308,442],[428,520],[555,462],[678,528],[798,466],[918,532],[1055,470],[1175,532],[1280,502],[1280,720]],
    },
  ];
  layers.forEach(({ color, pts }) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
  });
}

function drawPlanet(ctx) {
  const px = 980, py = 168, pr = 88;

  // Faint nebula behind planet
  const neb = ctx.createRadialGradient(950, 200, 10, 950, 210, 290);
  neb.addColorStop(0,   'rgba(45, 85, 165, 0.07)');
  neb.addColorStop(0.5, 'rgba(85, 45, 125, 0.04)');
  neb.addColorStop(1,   'rgba(0,  0,  0,   0)');
  ctx.fillStyle = neb;
  ctx.fillRect(670, 0, 610, 480);

  // Back half of ring
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#7799bb';
  ctx.lineWidth   = 14;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.95, pr * 0.38, -0.18, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Planet body
  const body = ctx.createRadialGradient(px - 28, py - 28, 6, px, py, pr);
  body.addColorStop(0,    '#4e7a8e');
  body.addColorStop(0.35, '#2a5570');
  body.addColorStop(0.72, '#153850');
  body.addColorStop(1,    '#071c2e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();

  // Atmospheric band stripes
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.clip();
  [
    { y: py - 22, h: 12, a: 0.05 },
    { y: py +  8, h:  8, a: 0.04 },
    { y: py - 44, h:  6, a: 0.06 },
  ].forEach(b => {
    ctx.fillStyle = `rgba(180, 220, 255, ${b.a})`;
    ctx.fillRect(px - pr, b.y, pr * 2, b.h);
  });
  ctx.restore();

  // Specular highlight
  const hi = ctx.createRadialGradient(px - 30, py - 30, 0, px - 10, py - 10, pr * 0.65);
  hi.addColorStop(0, 'rgba(200, 232, 255, 0.20)');
  hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();

  // Front half of ring (over planet)
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = '#aaccee';
  ctx.lineWidth   = 14;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.95, pr * 0.38, -0.18, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawBackground(ctx, world) {
  const name = world.theme.name;
  if (name === 'ROCKY CANYON') drawMountains(ctx);
  if (name === 'SPACE STATION') drawPlanet(ctx);
}

function drawRain(ctx, timeMs) {
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < 80; i++) {
    const x       = (i * 181 + 47) % CANVAS_WIDTH;
    const y       = ((timeMs * 0.18 + i * 109) % (CANVAS_HEIGHT - WIND_BAR_HEIGHT)) + WIND_BAR_HEIGHT;
    const alpha   = 0.10 + (i % 5) * 0.02;
    ctx.strokeStyle = `rgba(155, 200, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y + 28);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAtmosphere(ctx, world, timeMs) {
  if (world.theme.name === 'NEON CITY') drawRain(ctx, timeMs);
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

// Bounds of the "New Game" button — exported so game.js can do hit detection.
export const NEW_GAME_BTN = {
  w: 280,
  h: 56,
  get x() { return CANVAS_WIDTH  / 2 - this.w / 2; },
  get y() { return CANVAS_HEIGHT / 2 + BANNER_HEIGHT / 2 + 24; },
};

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

  const { x, y, w, h } = NEW_GAME_BTN;

  ctx.save();
  ctx.fillStyle   = "rgba(255,255,255,0.10)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.font         = "bold 20px system-ui, sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NEW GAME", CANVAS_WIDTH / 2, y + h / 2);
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
      { label: "PARALLEL",   sub: "Both fire at once" },
      { label: "SEQUENTIAL", sub: "Players take turns" },
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

      ctx.font      = "12px 'Courier New', monospace";
      ctx.fillStyle = isSel ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.18)";
      if (i === 0) {
        ctx.fillText("P1: SHIFT  |  P2: SHIFT →", cx + cardW / 2, cardY + cardH * 0.80);
      } else {
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

  // Confirm button
  const btnW = 260, btnH = 52;
  const btnX = CANVAS_WIDTH / 2 - btnW / 2;
  const btnY = boxY + boxH + 18;
  ctx.save();
  ctx.fillStyle   = `${color}33`;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font         = "bold 18px system-ui, sans-serif";
  ctx.fillStyle    = color;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CONFIRM  ▶", CANVAS_WIDTH / 2, btnY + btnH / 2);
}

// Draw HP pips above a character. playerIndex 0 = P1 (orange), 1 = P2 (cyan).
function drawHealthBar(ctx, character, playerHp, playerIndex) {
  const pipW   = 11, pipH = 9, pipGap = 3;
  const totalW = MAX_HP * pipW + (MAX_HP - 1) * pipGap;
  const cx     = character.x + character.width / 2;
  const barY   = character.y - 30;
  const startX = Math.round(cx - totalW / 2);
  const color  = playerIndex === 0 ? CHARACTER_COLORS.player1 : CHARACTER_COLORS.player2;

  for (let i = 0; i < MAX_HP; i++) {
    const px     = startX + i * (pipW + pipGap);
    const filled = i < playerHp;
    ctx.save();
    if (filled) {
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = color;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    }
    ctx.fillRect(px, barY, pipW, pipH);
    ctx.strokeStyle = filled ? color : 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(px + 0.5, barY + 0.5, pipW - 1, pipH - 1);
    ctx.restore();
  }
}

// Draw the full scene every frame.
//
// Draw order:
//   sky → wind bar + scoreboard → city → characters → aim line →
//   projectile → explosion → HUD → hint → active indicator → banner
//
// Options:
//   projectiles         — array of in-flight sequential projectiles
//   throwingPlayerIndex — who threw (for arm-up pose)
//   isArmUp             — true during the brief pre-launch wind-up
//   aim                 — { angle, velocity } for the aim line
//   showAimLine         — only true during PLAYER_TURN (or reload re-aim)
//   showHint            — only true during PLAYER_TURN (or reload re-aim)
//   seqExplosions       — array of active sequential explosion objects
//   roundWinsByPlayer   — [p1wins, p2wins] for the scoreboard
//   roundBannerWinner   — ≥0 to show the round-win banner (winnerIndex)
//   matchBannerWinner   — ≥0 to show the match-win banner (winnerIndex)
export function drawScene(ctx, world, activePlayerIndex, timeMs, {
  projectiles         = [],
  throwingPlayerIndex = -1,
  isArmUp             = false,
  aim                 = null,
  showAimLine         = false,
  showHint            = false,
  seqExplosions       = [],
  roundWinsByPlayer   = [0, 0],
  roundBannerWinner   = -1,
  matchBannerWinner   = -1,
  superBombAvailable  = [2, 2],
  superBombArmed      = false,
  tunnelBombAvailable = [true, true],
  tunnelBombArmed     = false,
  freezeBombAvailable = [true, true],
  freezeBombArmed     = false,
  playerNames         = ["Player 1", "Player 2"],
  parallelData        = null,
  hp                  = [MAX_HP, MAX_HP],
} = {}) {
  const _shakeElapsed = performance.now() - _shakeStart;
  const _shaking      = _shakeElapsed < SHAKE_MS;
  if (_shaking) {
    const decay = 1 - _shakeElapsed / SHAKE_MS;
    ctx.save();
    ctx.translate(
      Math.sin(_shakeElapsed * 0.28) * _shakeAmp * decay,
      Math.cos(_shakeElapsed * 0.23) * _shakeAmp * decay,
    );
  }

  drawSky(ctx, world.theme);
  drawBackground(ctx, world);
  drawWindIndicator(ctx, world.wind);
  drawScoreboard(ctx, roundWinsByPlayer, playerNames);
  drawSuperBombIndicators(ctx, superBombAvailable, superBombArmed, tunnelBombAvailable, tunnelBombArmed, freezeBombAvailable, freezeBombArmed, activePlayerIndex, Boolean(parallelData));

  drawCity(ctx, world);
  drawAtmosphere(ctx, world, timeMs);

  if (parallelData) {
    // Parallel mode — draw both characters; arm-up per player
    for (let i = 0; i < world.characters.length; i++) {
      const pose = parallelData.isArmUp[i] ? "armUp" : "idle";
      drawCharacter(ctx, world.characters[i], pose);
    }
    for (let i = 0; i < 2; i++) drawHealthBar(ctx, world.characters[i], hp[i], i);
    // Aim lines for each player who is still aiming
    for (let i = 0; i < 2; i++) {
      if (parallelData.showAimLine[i] && parallelData.aims[i]) {
        drawAimLine(ctx, world.characters[i], parallelData.aims[i].angle, parallelData.aims[i].velocity, Array.isArray(superBombArmed) ? superBombArmed[i] : false);
      }
    }
    // Projectiles (array per player)
    for (let i = 0; i < 2; i++) {
      for (const proj of parallelData.projectiles[i]) { if (proj.frozen) drawFreezeBlock(ctx, proj, timeMs); else drawProjectile(ctx, proj); }
    }
    // Explosions (array per player)
    for (let i = 0; i < 2; i++) {
      for (const expl of parallelData.explosions[i]) drawExplosion(ctx, expl, timeMs);
    }
  } else {
    // Sequential mode
    for (let i = 0; i < world.characters.length; i++) {
      const pose = (isArmUp && i === throwingPlayerIndex) ? "armUp" : "idle";
      drawCharacter(ctx, world.characters[i], pose);
    }
    for (let i = 0; i < 2; i++) drawHealthBar(ctx, world.characters[i], hp[i], i);
    if (showAimLine && aim) {
      drawAimLine(ctx, world.characters[activePlayerIndex], aim.angle, aim.velocity, superBombArmed);
    }
    for (const proj of projectiles) { if (proj.frozen) drawFreezeBlock(ctx, proj, timeMs); else drawProjectile(ctx, proj); }
    for (const expl of seqExplosions) drawExplosion(ctx, expl, timeMs);
  }

  const anyProjectile = parallelData
    ? parallelData.projectiles.some(arr => arr.length > 0)
    : projectiles.length > 0;
  const anyExplosion = parallelData
    ? parallelData.explosions.some(arr => arr.length > 0)
    : seqExplosions.length > 0;
  const anyArmUp = parallelData
    ? parallelData.isArmUp.some(Boolean)
    : isArmUp;

  const bannerActive = roundBannerWinner >= 0 || matchBannerWinner >= 0;
  if (parallelData) {
    // Parallel: show indicator per player independently of projectile state
    for (let i = 0; i < 2; i++) {
      if (parallelData.canFire[i] && !parallelData.isArmUp[i] && !bannerActive) {
        drawActiveIndicator(ctx, world.characters[i], timeMs);
      }
    }
  } else if (!anyArmUp && !bannerActive && (showAimLine || (!anyProjectile && !anyExplosion))) {
    // Sequential: show when player can aim, or when nothing is in flight
    drawActiveIndicator(ctx, world.characters[activePlayerIndex], timeMs);
  }

  // Banners sit on top of everything else.
  if (roundBannerWinner >= 0) {
    drawRoundBanner(ctx, roundBannerWinner, roundWinsByPlayer, playerNames);
  } else if (matchBannerWinner >= 0) {
    drawMatchBanner(ctx, matchBannerWinner, roundWinsByPlayer, playerNames);
  }

  if (_shaking) ctx.restore();
}
