// input.js
// This file builds the controls below the canvas and listens for what the
// players type. When a player fills in their angle and velocity and presses
// Throw (or hits Enter), this file collects those numbers, clamps them so
// they stay in range, and passes them on to the game.
// It also knows how to lock the controls during the projectile's flight.

import {
  ANGLE_MIN,
  ANGLE_MAX,
  ANGLE_DEFAULT,
  VELOCITY_MIN,
  VELOCITY_MAX,
  VELOCITY_DEFAULT,
} from "./config.js";

// Keep references to the inputs and button so other functions can use them.
let angleInput;
let velocityInput;
let throwButton;

// Build the angle/velocity form inside the #controls div and wire up listeners.
// onThrow is called with { angle, velocity } when the player submits their shot.
export function setupInput({ onThrow }) {
  const controls = document.getElementById("controls");

  const angleLabel = document.createElement("label");
  angleLabel.textContent = "Angle";
  angleLabel.htmlFor = "input-angle";

  angleInput = document.createElement("input");
  angleInput.type  = "number";
  angleInput.id    = "input-angle";
  angleInput.min   = String(ANGLE_MIN);
  angleInput.max   = String(ANGLE_MAX);
  angleInput.step  = "1";
  angleInput.value = String(ANGLE_DEFAULT);

  const velocityLabel = document.createElement("label");
  velocityLabel.textContent = "Velocity";
  velocityLabel.htmlFor = "input-velocity";

  velocityInput = document.createElement("input");
  velocityInput.type  = "number";
  velocityInput.id    = "input-velocity";
  velocityInput.min   = String(VELOCITY_MIN);
  velocityInput.max   = String(VELOCITY_MAX);
  velocityInput.step  = "1";
  velocityInput.value = String(VELOCITY_DEFAULT);

  throwButton = document.createElement("button");
  throwButton.textContent = "Throw!";
  throwButton.id = "btn-throw";

  controls.append(angleLabel, angleInput, velocityLabel, velocityInput, throwButton);

  // Clamp the values and fire the throw callback.
  function fireThrow() {
    if (throwButton.disabled) return; // safety guard during flight
    const angle    = clamp(Math.round(Number(angleInput.value)),    ANGLE_MIN,    ANGLE_MAX);
    const velocity = clamp(Math.round(Number(velocityInput.value)), VELOCITY_MIN, VELOCITY_MAX);
    angleInput.value    = String(angle);
    velocityInput.value = String(velocity);
    onThrow({ angle, velocity });
  }

  throwButton.addEventListener("click", fireThrow);

  angleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") fireThrow();
  });

  velocityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") fireThrow();
  });
}

// Fill the inputs with the given values — used when switching players.
export function setInputDefaults(angle, velocity) {
  if (angleInput)    angleInput.value    = String(angle);
  if (velocityInput) velocityInput.value = String(velocity);
}

// Move keyboard focus to the angle input so the player can start typing right away.
export function focusAngleInput() {
  if (angleInput) angleInput.focus();
}

// Lock or unlock all controls. Called before a throw (lock) and after
// the projectile resolves (unlock).
export function setInputEnabled(enabled) {
  if (angleInput)    angleInput.disabled    = !enabled;
  if (velocityInput) velocityInput.disabled = !enabled;
  if (throwButton)   throwButton.disabled   = !enabled;
}

// Keep a number between a low and high value.
function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}
