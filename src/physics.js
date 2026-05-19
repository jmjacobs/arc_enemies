// physics.js
// This file does all the maths for how things move through the air.
// Gravity pulls the projectile down (because that's what gravity does).
// Wind pushes it left or right.
// None of this draws anything — it just updates numbers.

import {
  GRAVITY,
  VELOCITY_SCALE,
  WIND_ACCEL_SCALE,
  PROJECTILE_SPIN_RATE,
  PROJECTILE_TRAIL_MAX_POINTS,
  PROJECTILE_RADIUS,
  CHARACTER_WIDTH,
  CHARACTER_HEIGHT,
  CHARACTER_HIT_PADDING,
  LAUNCH_OFFSET_X,
  LAUNCH_OFFSET_Y,
  BUILDING_HIT_ALPHA_THRESHOLD,
} from "./config.js";

// Return the pixel position where a projectile is born for this character.
// Both game.js (to create the projectile) and render.js (to draw the aim line)
// use this so the two are always in sync.
export function getLaunchPoint(character) {
  const facing = character.facingRight ? 1 : -1;
  return {
    x: character.x + CHARACTER_WIDTH / 2 + LAUNCH_OFFSET_X * facing,
    y: character.y + CHARACTER_HEIGHT / 2 + LAUNCH_OFFSET_Y,
  };
}

// Work out how fast the projectile starts moving, based on the angle the
// player chose and the facing direction of the throwing character.
// facing is +1 if the character throws to the right, -1 if they throw left.
// Returns { vx, vy } in pixels per second.
export function launchVelocity(angleDegrees, velocityInput, facing) {
  const angleRadians = angleDegrees * (Math.PI / 180);
  const speed = velocityInput * VELOCITY_SCALE;

  // vx is horizontal speed — positive goes right, negative goes left.
  // vy is vertical speed — negative goes UP because on the canvas y=0 is the top.
  const vx = speed * Math.cos(angleRadians) * facing;
  const vy = -speed * Math.sin(angleRadians); // minus = upward

  return { vx, vy };
}

// Move the projectile forward by one tiny time slice (dt seconds).
// This gets called many times per second inside the animation loop.
// dt = "delta time" — how many seconds have passed since the last frame.
export function stepProjectile(projectile, wind, dt) {
  // Wind pushes the projectile sideways like a gentle (or not so gentle) breeze.
  projectile.vx += wind * WIND_ACCEL_SCALE * dt;

  // Gravity pulls the projectile downward every frame.
  projectile.vy += GRAVITY * dt;

  // Move the projectile based on its current speed.
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;

  // Spin increases steadily — just looks cool.
  projectile.spin += PROJECTILE_SPIN_RATE * dt;

  // Record where we just were so we can draw the trail.
  projectile.trail.push({ x: projectile.x, y: projectile.y });
  if (projectile.trail.length > PROJECTILE_TRAIL_MAX_POINTS) {
    projectile.trail.shift(); // drop the oldest point
  }

  projectile.framesAlive += 1;
}

// Check whether the projectile has left the visible area.
// The top of the canvas is OPEN — a high throw can go off the top and come
// back down. We only stop the flight at the bottom, left, and right edges.
export function isOffScreen(projectile, canvasWidth, canvasHeight) {
  return (
    projectile.x < -PROJECTILE_RADIUS ||
    projectile.x > canvasWidth  + PROJECTILE_RADIUS ||
    projectile.y > canvasHeight + PROJECTILE_RADIUS
  );
}

// Check whether the projectile has touched the city canvas.
// We read individual pixels from the offscreen canvas:
// if any pixel under the projectile's circle has solid alpha, that's a hit.
// This works even after craters are carved because destination-out makes
// those pixels transparent — so the ball can fly through holes.
export function hitsCity(projectile, cityCtx) {
  if (projectile.framesAlive < 4) return false;

  const px = Math.round(projectile.x);
  const py = Math.round(projectile.y);
  const r  = Math.ceil(PROJECTILE_RADIUS);

  // Sample the centre and four cardinal points on the projectile's edge.
  const points = [
    [px,     py    ],
    [px + r, py    ],
    [px - r, py    ],
    [px,     py + r],
    [px,     py - r],
  ];

  for (const [cx, cy] of points) {
    try {
      const data = cityCtx.getImageData(cx, cy, 1, 1).data;
      if (data[3] > BUILDING_HIT_ALPHA_THRESHOLD) return true;
    } catch (_) {
      // Off canvas bounds — not a hit.
    }
  }
  return false;
}

// Check whether the projectile has hit a character.
// Uses circle-vs-AABB: find the closest point on the (padded) bounding box
// to the projectile centre, then check if it's within the projectile's radius.
export function hitsCharacter(projectile, character) {
  const pad    = CHARACTER_HIT_PADDING;
  const left   = character.x - pad;
  const right  = character.x + character.width  + pad;
  const top    = character.y - pad;
  const bottom = character.y + character.height + pad;

  const closestX = Math.max(left, Math.min(projectile.x, right));
  const closestY = Math.max(top,  Math.min(projectile.y, bottom));
  const dx = projectile.x - closestX;
  const dy = projectile.y - closestY;

  return dx * dx + dy * dy <= PROJECTILE_RADIUS * PROJECTILE_RADIUS;
}
