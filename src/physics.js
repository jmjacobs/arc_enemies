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
} from "./config.js";

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

// Check whether the projectile has hit any building.
// Uses a circle-vs-rectangle check: find the closest point on the building
// to the projectile's centre, then check if it's within the projectile's radius.
// Returns the index of the building that was hit, or -1 if nothing was hit.
export function hitsBuilding(projectile, city) {
  // Skip the first few frames so the projectile doesn't immediately collide
  // with the rooftop it was just launched from.
  if (projectile.framesAlive < 4) return -1;

  for (let i = 0; i < city.length; i++) {
    const b = city[i];

    // Find the point on the building rectangle closest to the projectile centre.
    const closestX = Math.max(b.x, Math.min(projectile.x, b.x + b.width));
    const closestY = Math.max(b.y, Math.min(projectile.y, b.y + b.height));

    const dx = projectile.x - closestX;
    const dy = projectile.y - closestY;

    if (dx * dx + dy * dy <= PROJECTILE_RADIUS * PROJECTILE_RADIUS) {
      return i;
    }
  }
  return -1;
}
