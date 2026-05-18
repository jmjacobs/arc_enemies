// game.js
// This is where the game starts and where the state machine lives.
// It knows whose turn it is, launches the projectile, runs the physics loop,
// and decides when the turn ends.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GameState,
  ANGLE_DEFAULT,
  VELOCITY_DEFAULT,
  ARM_UP_DURATION_MS,
  MAX_FRAME_DT,
} from "./config.js";
import { generateWorld } from "./world.js";
import { getLaunchPoint, launchVelocity, stepProjectile, isOffScreen, hitsBuilding } from "./physics.js";
import { drawScene } from "./render.js";
import { setupInput, setAim, getAim, setInputEnabled } from "./input.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");

  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // --- Game state ---
  let currentState        = GameState.PLAYER_TURN;
  let world               = generateWorld();
  let activePlayerIndex   = 0;
  let throwingPlayerIndex = 0;
  let projectile          = null;
  let isArmUp             = false;
  let armUpTimer          = null;

  // Per-player memory of their last shot, so we can restore it on their next turn.
  let lastShots = [
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
  ];

  // Draw the current frame. Called by the RAF loop and also immediately after
  // any aim change so the aim line never lags behind a key press.
  function redraw(timeMs = performance.now()) {
    const isPlayerTurn = currentState === GameState.PLAYER_TURN && !isArmUp;
    drawScene(ctx, world, activePlayerIndex, timeMs, {
      projectile,
      throwingPlayerIndex,
      isArmUp,
      aim:         getAim(),
      showAimLine: isPlayerTurn,
      showHint:    isPlayerTurn,
    });
  }

  // Called when the active player throws.
  function handleThrow({ angle, velocity }) {
    lastShots[activePlayerIndex] = { angle, velocity };

    const playerNumber = activePlayerIndex + 1;
    console.log(
      `Player ${playerNumber} throws: angle ${angle}°, velocity ${velocity}, wind ${world.wind}`
    );

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

  // Called when the projectile stops — either hits a building or leaves the screen.
  function resolveProjectile(hitBuildingIndex) {
    const playerNumber = throwingPlayerIndex + 1;
    const outcome      = hitBuildingIndex !== -1 ? "hit a building" : "left the screen";
    console.log(`Player ${playerNumber} - projectile ${outcome}`);

    projectile        = null;
    activePlayerIndex = activePlayerIndex === 0 ? 1 : 0;
    currentState      = GameState.PLAYER_TURN;

    setInputEnabled(true);
    setAim(lastShots[activePlayerIndex].angle, lastShots[activePlayerIndex].velocity);
  }

  // Build the controls and hook up callbacks.
  setupInput({
    onThrow:      handleThrow,
    onAimChanged: () => redraw(), // instant redraw so the aim line never lags
  });

  // Initialise with Player 1's defaults.
  setAim(ANGLE_DEFAULT, VELOCITY_DEFAULT);

  // R key: cancel any in-flight state and generate a fresh world.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "r" && event.key !== "R") return;

    if (armUpTimer !== null) { clearTimeout(armUpTimer); armUpTimer = null; }

    projectile        = null;
    isArmUp           = false;
    world             = generateWorld();
    activePlayerIndex = 0;
    currentState      = GameState.PLAYER_TURN;
    lastShots = [
      { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
      { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
    ];

    setInputEnabled(true);
    setAim(ANGLE_DEFAULT, VELOCITY_DEFAULT);
  });

  // Animation loop — runs every frame for physics and the bobbing indicator.
  let lastTime = null;

  function tick(timeMs) {
    const dt = lastTime === null
      ? 0
      : Math.min((timeMs - lastTime) / 1000, MAX_FRAME_DT);
    lastTime = timeMs;

    if (currentState === GameState.RESOLVING && projectile !== null) {
      stepProjectile(projectile, world.wind, dt);

      const hitIndex  = hitsBuilding(projectile, world.city);
      const offScreen = isOffScreen(projectile, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (hitIndex !== -1 || offScreen) {
        resolveProjectile(hitIndex);
      }
    }

    redraw(timeMs);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
