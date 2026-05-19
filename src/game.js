// game.js
// This is where the game starts and where the state machine lives.
// It tracks whose turn it is, runs the physics loop, handles explosions,
// counts round wins, and decides when a round or the whole match is over.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GameState,
  ANGLE_DEFAULT,
  VELOCITY_DEFAULT,
  ARM_UP_DURATION_MS,
  MAX_FRAME_DT,
  EXPLOSION_CRATER_RADIUS,
  EXPLOSION_DRAW_RADIUS,
  EXPLOSION_BIG_DRAW_RADIUS,
  EXPLOSION_DURATION_MS,
  MATCH_WIN_THRESHOLD,
  ROUND_END_BANNER_DURATION_MS,
} from "./config.js";
import { generateWorld, carveCrater } from "./world.js";
import { getLaunchPoint, launchVelocity, stepProjectile, isOffScreen, hitsCity, hitsCharacter } from "./physics.js";
import { drawScene } from "./render.js";
import { setupInput, setAim, getAim, setInputEnabled } from "./input.js";
import { playSound } from "./sound.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");

  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // --- Game state ---
  let currentState        = GameState.PLAYER_TURN;
  let world               = generateWorld();
  console.log(`wind:${world.wind}`);
  let activePlayerIndex   = 0;
  let throwingPlayerIndex = 0;
  let projectile          = null;
  let isArmUp             = false;
  let armUpTimer          = null;
  let explosion           = null;
  let roundWinner         = -1;   // index of round winner while relevant, else -1
  let roundWinsByPlayer   = [0, 0];
  let matchWinner         = null; // non-null (player index) once the match is over
  let roundEndBannerStartTime = null; // performance.now() when the round banner appeared

  // Per-player memory of their last shot, restored when their turn comes back.
  let lastShots = [
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
  ];

  // Draw the current frame. Also called immediately on aim changes so the
  // aim line never lags behind a key press.
  function redraw(timeMs = performance.now()) {
    const isPlayerTurn = currentState === GameState.PLAYER_TURN && !isArmUp;
    drawScene(ctx, world, activePlayerIndex, timeMs, {
      projectile,
      throwingPlayerIndex,
      isArmUp,
      aim:               getAim(),
      showAimLine:       isPlayerTurn,
      showHint:          isPlayerTurn,
      explosion,
      roundWinsByPlayer,
      roundBannerWinner: currentState === GameState.ROUND_END_BANNER ? roundWinner        : -1,
      matchBannerWinner: currentState === GameState.MATCH_END        ? (matchWinner ?? -1) : -1,
    });
  }

  // Called when the active player commits to a throw.
  function handleThrow({ angle, velocity }) {
    lastShots[activePlayerIndex] = { angle, velocity };
    playSound("throw");

    setInputEnabled(false);
    currentState        = GameState.RESOLVING;
    throwingPlayerIndex = activePlayerIndex;
    isArmUp             = true;

    armUpTimer = setTimeout(() => {
      armUpTimer = null;
      isArmUp    = false;

      const character  = world.characters[throwingPlayerIndex];
      const facing     = character.facingRight ? 1 : -1;
      const { x: launchX, y: launchY } = getLaunchPoint(character);
      const { vx, vy } = launchVelocity(angle, velocity, facing);

      projectile = { x: launchX, y: launchY, vx, vy, spin: 0, trail: [], framesAlive: 0 };
    }, ARM_UP_DURATION_MS);
  }

  // Switch to the other player's turn after a building hit or a miss.
  function nextTurn() {
    activePlayerIndex = activePlayerIndex === 0 ? 1 : 0;
    currentState      = GameState.PLAYER_TURN;
    setInputEnabled(true);
    setAim(lastShots[activePlayerIndex].angle, lastShots[activePlayerIndex].velocity);
  }

  // Reset the whole match — scores, world, and state — back to square one.
  // Called by the R key from any state.
  function resetMatch() {
    if (armUpTimer !== null) { clearTimeout(armUpTimer); armUpTimer = null; }

    projectile              = null;
    isArmUp                 = false;
    explosion               = null;
    roundWinner             = -1;
    roundWinsByPlayer       = [0, 0];
    matchWinner             = null;
    roundEndBannerStartTime = null;
    world                   = generateWorld();
    console.log(`wind:${world.wind}`);
    activePlayerIndex       = 0;
    currentState            = GameState.PLAYER_TURN;
    lastShots = [
      { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
      { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
    ];

    setInputEnabled(true);
    setAim(ANGLE_DEFAULT, VELOCITY_DEFAULT);
  }

  setupInput({
    onThrow:      handleThrow,
    onAimChanged: () => redraw(),
  });

  setAim(ANGLE_DEFAULT, VELOCITY_DEFAULT);

  // R resets the match from any state — even mid-flight.
  window.addEventListener("keydown", (event) => {
    if (event.key === "r" || event.key === "R") resetMatch();
  });

  // Animation loop — physics, state transitions, and rendering each frame.
  let lastTime = null;

  function tick(timeMs) {
    const dt = lastTime === null
      ? 0
      : Math.min((timeMs - lastTime) / 1000, MAX_FRAME_DT);
    lastTime = timeMs;

    // ── RESOLVING: projectile is in the air ──────────────────────────────
    if (currentState === GameState.RESOLVING && projectile !== null) {
      stepProjectile(projectile, world.wind, dt);

      // Character hits take priority — check the enemy character first.
      let hitCharIndex = -1;
      for (let i = 0; i < world.characters.length; i++) {
        if (i !== throwingPlayerIndex && hitsCharacter(projectile, world.characters[i])) {
          hitCharIndex = i;
          break;
        }
      }

      if (hitCharIndex !== -1) {
        // A player was hit — score a point for the thrower.
        const winnerIndex = throwingPlayerIndex;
        console.log(`projectile hits Player ${hitCharIndex + 1}`);
        roundWinsByPlayer[winnerIndex]++;
        playSound("explosion");
        playSound("roundWin");

        const hitChar = world.characters[hitCharIndex];
        explosion = {
          x:         hitChar.x + hitChar.width  / 2,
          y:         hitChar.y + hitChar.height / 2,
          radius:    EXPLOSION_BIG_DRAW_RADIUS,
          startTime: timeMs,
        };
        roundWinner  = winnerIndex;
        projectile   = null;
        currentState = GameState.EXPLODING;

      } else if (hitsCity(projectile, world.city.ctx)) {
        // Hit a building — carve a crater, play a smaller explosion.
        playSound("explosion");
        carveCrater(world, projectile.x, projectile.y, EXPLOSION_CRATER_RADIUS);
        explosion = {
          x:         projectile.x,
          y:         projectile.y,
          radius:    EXPLOSION_DRAW_RADIUS,
          startTime: timeMs,
        };
        projectile   = null;
        currentState = GameState.EXPLODING;

      } else if (isOffScreen(projectile, CANVAS_WIDTH, CANVAS_HEIGHT)) {
        // Missed everything — switch turns, no banner.
        playSound("miss");
        projectile = null;
        nextTurn();
      }
    }

    // ── EXPLODING: waiting for the animation to finish ───────────────────
    if (currentState === GameState.EXPLODING && explosion !== null) {
      if (timeMs - explosion.startTime >= EXPLOSION_DURATION_MS) {
        explosion = null;
        if (roundWinner !== -1) {
          // Explosion was for a character hit — show the round-end banner.
          roundEndBannerStartTime = timeMs;
          currentState = GameState.ROUND_END_BANNER;
        } else {
          // Explosion was for a building hit — next player's turn.
          nextTurn();
        }
      }
    }

    // ── ROUND_END_BANNER: banner is visible, waiting before next round ───
    if (currentState === GameState.ROUND_END_BANNER && roundEndBannerStartTime !== null) {
      if (timeMs - roundEndBannerStartTime >= ROUND_END_BANNER_DURATION_MS) {
        if (roundWinsByPlayer[roundWinner] >= MATCH_WIN_THRESHOLD) {
          // This player has enough round wins to claim the match.
          matchWinner  = roundWinner;
          currentState = GameState.MATCH_END;
          playSound("matchWin");
        } else {
          // Start the next round — the losing player throws first.
          const loserIndex  = 1 - roundWinner;
          activePlayerIndex = loserIndex;
          world = generateWorld();
          console.log(`wind:${world.wind}`);
          lastShots = [
            { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
            { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
          ];
          roundWinner             = -1;
          roundEndBannerStartTime = null;
          setInputEnabled(true);
          setAim(ANGLE_DEFAULT, VELOCITY_DEFAULT);
          currentState = GameState.PLAYER_TURN;
        }
      }
    }

    // ── MATCH_END: frozen — R key (handled above) is the only way out ────

    redraw(timeMs);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
