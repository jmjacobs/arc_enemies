// input.js
// Handles keyboard input during a player's turn.
// Aiming is now timing-based: angle and velocity cycle automatically.
// The only thing the player presses is SPACE — once to lock the angle,
// again to lock power and fire.

// Whether input is currently allowed (false during projectile flight).
let inputEnabled = true;

// The current aim values — written every frame by game.js during cycling,
// read back by game.js when SPACE is pressed.
let currentAim = { angle: 0, velocity: 0 };

let onSpacePressCallback = null;

// Wire up the space bar (and Enter as an alternative).
export function setupInput({ onSpacePress }) {
  onSpacePressCallback = onSpacePress;

  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (inputEnabled && onSpacePressCallback) onSpacePressCallback();
    }
  });
}

// Called every frame by game.js to push the latest cycled value.
export function setAim(angle, velocity) {
  currentAim.angle    = angle;
  currentAim.velocity = velocity;
}

// Return a snapshot of the current aim.
export function getAim() {
  return { ...currentAim };
}

// Kept for API compatibility — no longer needed with cycling input.
export function setActivePlayer(_index) {}

// Lock or unlock all controls. Called before a throw (lock) and after resolution (unlock).
export function setInputEnabled(enabled) {
  inputEnabled = enabled;
}
