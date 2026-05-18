// game.js
// This is where the game starts and where the state machine lives.
// It knows whose turn it is, handles the Throw action, and keeps
// redrawing the canvas every frame so the active indicator can animate.
// Phase 4 will add the actual banana flight here.

import { CANVAS_WIDTH, CANVAS_HEIGHT, GameState, ANGLE_DEFAULT, VELOCITY_DEFAULT } from "./config.js";
import { generateWorld } from "./world.js";
import { drawScene } from "./render.js";
import { setupInput, setInputDefaults, focusAngleInput } from "./input.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");

  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // --- Game state ---
  let currentState      = GameState.PLAYER_TURN;
  let world             = generateWorld();
  let activePlayerIndex = 0; // 0 = Player 1, 1 = Player 2

  // Remember each player's last shot so we can pre-fill the inputs next turn.
  let lastShots = [
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
    { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
  ];

  // Called when the active player presses Throw.
  function handleThrow({ angle, velocity }) {
    // Save this shot so we can restore it on the player's next turn.
    lastShots[activePlayerIndex] = { angle, velocity };

    const playerNumber = activePlayerIndex + 1;
    console.log(
      `Player ${playerNumber} throws at angle ${angle}, velocity ${velocity} (wind: ${world.wind})`
    );

    // Hand control to the other player.
    activePlayerIndex = activePlayerIndex === 0 ? 1 : 0;

    setInputDefaults(lastShots[activePlayerIndex].angle, lastShots[activePlayerIndex].velocity);
    focusAngleInput();
  }

  // Build the controls UI and connect the throw handler.
  setupInput({ onThrow: handleThrow });

  // Pre-fill Player 1's defaults and focus the angle field right away.
  setInputDefaults(lastShots[0].angle, lastShots[0].velocity);
  focusAngleInput();

  // R key: fresh world, reset everything back to Player 1's turn.
  window.addEventListener("keydown", (event) => {
    if (event.key === "r" || event.key === "R") {
      world             = generateWorld();
      activePlayerIndex = 0;
      lastShots = [
        { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
        { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT },
      ];
      setInputDefaults(lastShots[0].angle, lastShots[0].velocity);
      focusAngleInput();
    }
  });

  // Animation loop — redraws the scene every frame so the active indicator bobs.
  function tick(timeMs) {
    drawScene(ctx, world, activePlayerIndex, timeMs);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});
