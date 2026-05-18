// input.js
// This file builds the controls below the canvas and handles all keyboard input.
// Arrow keys adjust angle and velocity; Space/Enter throws.
// The number inputs are read-only displays — they show the current aim values
// but can't be typed into. Arrow keys are the way to aim.
// The Throw button still works for mouse users.

import {
  ANGLE_MIN,
  ANGLE_MAX,
  ANGLE_DEFAULT,
  ANGLE_STEP,
  VELOCITY_MIN,
  VELOCITY_MAX,
  VELOCITY_DEFAULT,
  VELOCITY_STEP,
  FAST_STEP_MULTIPLIER,
  KEY_REPEAT_INITIAL_DELAY_MS,
  KEY_REPEAT_INTERVAL_MS,
} from "./config.js";

// References to the DOM elements we create.
let angleInput;
let velocityInput;
let throwButton;

// Whether input is currently allowed (false during projectile flight).
let inputEnabled = true;

// Track Shift key state so held-arrow repeat can pick it up each step.
let shiftHeld = false;

// Which aim key is currently held down, and the timers for custom repeat.
let heldKey             = null;
let repeatInitialTimer  = null;
let repeatIntervalTimer = null;

// The current aim — updated by arrow keys and by setAim().
let currentAim = { angle: ANGLE_DEFAULT, velocity: VELOCITY_DEFAULT };

// Callbacks set by setupInput().
let onThrowCallback      = null;
let onAimChangedCallback = null;

// The four aim keys.
const AIM_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// Keep a number between low and high.
function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Apply one step to the current aim based on which key is held.
// Reads shiftHeld at the moment it's called, so pressing/releasing Shift
// mid-hold instantly switches between ×1 and ×5.
function applyStep(key) {
  if (!inputEnabled) return;
  const multiplier = shiftHeld ? FAST_STEP_MULTIPLIER : 1;
  const aStep = ANGLE_STEP    * multiplier;
  const vStep = VELOCITY_STEP * multiplier;

  if      (key === "ArrowUp")    currentAim.angle    = clamp(currentAim.angle    + aStep, ANGLE_MIN,    ANGLE_MAX);
  else if (key === "ArrowDown")  currentAim.angle    = clamp(currentAim.angle    - aStep, ANGLE_MIN,    ANGLE_MAX);
  else if (key === "ArrowRight") currentAim.velocity = clamp(currentAim.velocity + vStep, VELOCITY_MIN, VELOCITY_MAX);
  else if (key === "ArrowLeft")  currentAim.velocity = clamp(currentAim.velocity - vStep, VELOCITY_MIN, VELOCITY_MAX);

  syncDisplays();
  if (onAimChangedCallback) onAimChangedCallback({ ...currentAim });
}

// Stop any ongoing key-repeat sequence.
function stopRepeat() {
  if (repeatInitialTimer)  { clearTimeout(repeatInitialTimer);   repeatInitialTimer  = null; }
  if (repeatIntervalTimer) { clearInterval(repeatIntervalTimer); repeatIntervalTimer = null; }
  heldKey = null;
}

// Update the read-only input displays to match currentAim.
function syncDisplays() {
  if (angleInput)    angleInput.value    = String(currentAim.angle);
  if (velocityInput) velocityInput.value = String(currentAim.velocity);
}

// Build the angle/velocity controls inside the #controls div and wire up all listeners.
// onThrow    — called with { angle, velocity } when the player throws.
// onAimChanged — called with { angle, velocity } whenever aim changes (for instant redraws).
export function setupInput({ onThrow, onAimChanged }) {
  onThrowCallback      = onThrow;
  onAimChangedCallback = onAimChanged;

  const controls = document.getElementById("controls");

  const angleLabel = document.createElement("label");
  angleLabel.textContent = "Angle";
  angleLabel.htmlFor = "input-angle";

  angleInput = document.createElement("input");
  angleInput.type     = "number";
  angleInput.id       = "input-angle";
  angleInput.readOnly = true;
  angleInput.value    = String(ANGLE_DEFAULT);

  const velocityLabel = document.createElement("label");
  velocityLabel.textContent = "Velocity";
  velocityLabel.htmlFor = "input-velocity";

  velocityInput = document.createElement("input");
  velocityInput.type     = "number";
  velocityInput.id       = "input-velocity";
  velocityInput.readOnly = true;
  velocityInput.value    = String(VELOCITY_DEFAULT);

  throwButton = document.createElement("button");
  throwButton.textContent = "Throw!";
  throwButton.id = "btn-throw";

  controls.append(angleLabel, angleInput, velocityLabel, velocityInput, throwButton);

  // Throw button fires with whatever aim is current.
  throwButton.addEventListener("click", () => {
    if (inputEnabled) onThrowCallback({ ...currentAim });
  });

  // ---- Keyboard listeners ------------------------------------------------

  window.addEventListener("keydown", (event) => {
    if (event.key === "Shift") {
      shiftHeld = true;
      return;
    }

    // Arrow keys — adjust aim.
    if (AIM_KEYS.has(event.key)) {
      event.preventDefault(); // stop page scrolling
      if (!inputEnabled) return;

      // Only start a new repeat sequence if this is a different key.
      if (heldKey !== event.key) {
        stopRepeat();
        heldKey = event.key;

        // Immediate first step.
        applyStep(heldKey);

        // After the initial delay, start the rapid-repeat interval.
        repeatInitialTimer = setTimeout(() => {
          repeatInitialTimer = null;
          applyStep(heldKey); // first repeated step
          repeatIntervalTimer = setInterval(() => applyStep(heldKey), KEY_REPEAT_INTERVAL_MS);
        }, KEY_REPEAT_INITIAL_DELAY_MS);
      }
      return;
    }

    // Space or Enter — throw.
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault(); // stop scrolling / button activation
      if (inputEnabled) onThrowCallback({ ...currentAim });
      return;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Shift") {
      shiftHeld = false;
      return;
    }
    if (event.key === heldKey) {
      stopRepeat();
    }
  });
}

// Set the current aim values (e.g. when switching players to restore their last shot).
// Also updates the display inputs.
export function setAim(angle, velocity) {
  currentAim.angle    = clamp(Math.round(angle),    ANGLE_MIN,    ANGLE_MAX);
  currentAim.velocity = clamp(Math.round(velocity), VELOCITY_MIN, VELOCITY_MAX);
  syncDisplays();
}

// Return a snapshot of the current aim.
export function getAim() {
  return { ...currentAim };
}

// Lock or unlock all controls. Called before a throw (lock) and after resolution (unlock).
// Also cancels any ongoing key-repeat so a held arrow doesn't fire during flight.
export function setInputEnabled(enabled) {
  inputEnabled = enabled;
  if (!enabled) stopRepeat();

  if (throwButton)   throwButton.disabled   = !enabled;
  // Visually dim the display inputs too.
  if (angleInput)    angleInput.disabled    = !enabled;
  if (velocityInput) velocityInput.disabled = !enabled;
}
