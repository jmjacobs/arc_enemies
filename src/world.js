// world.js
// This file builds the city that the game is played in.
// It creates the buildings, decides how tall each one is,
// picks their colours, and figures out which windows are lit up.
// It returns plain data — it doesn't draw anything itself.
// The two players will stand on top of buildings in a later phase.

import {
  CANVAS_WIDTH,
  GROUND_Y,
  BUILDING_COUNT_MIN,
  BUILDING_COUNT_MAX,
  BUILDING_MIN_HEIGHT,
  BUILDING_MAX_HEIGHT,
  BUILDING_PALETTE,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_GAP_X,
  WINDOW_GAP_Y,
  WINDOW_MARGIN,
  WINDOW_LIT_PROBABILITY,
} from "./config.js";

// Pick a random whole number between min and max (inclusive).
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build the grid of windows for one building.
// Returns a 2D array: windows[row][col] is true if that window is lit.
function generateWindows(buildingWidth, buildingHeight) {
  // Work out how many windows fit across and down, respecting the margin.
  const usableWidth  = buildingWidth  - WINDOW_MARGIN * 2;
  const usableHeight = buildingHeight - WINDOW_MARGIN * 2;

  const columns = Math.max(1, Math.floor((usableWidth  + WINDOW_GAP_X) / (WINDOW_WIDTH  + WINDOW_GAP_X)));
  const rows    = Math.max(1, Math.floor((usableHeight + WINDOW_GAP_Y) / (WINDOW_HEIGHT + WINDOW_GAP_Y)));

  const grid = [];
  for (let row = 0; row < rows; row++) {
    const rowData = [];
    for (let col = 0; col < columns; col++) {
      rowData.push(Math.random() < WINDOW_LIT_PROBABILITY);
    }
    grid.push(rowData);
  }
  return grid;
}

// Divide canvasWidth into n slices whose widths vary by up to ±15%
// but always add up to exactly canvasWidth.
function generateBuildingWidths(n, canvasWidth) {
  // Start with equal slices then apply a random nudge to each.
  const baseWidth = canvasWidth / n;
  const widths = [];
  let remaining = canvasWidth;

  for (let i = 0; i < n - 1; i++) {
    const variation = baseWidth * 0.15;
    const width = Math.round(baseWidth + (Math.random() * variation * 2 - variation));
    // Clamp so later buildings always have at least a little room.
    const clamped = Math.max(30, Math.min(width, remaining - 30 * (n - 1 - i)));
    widths.push(clamped);
    remaining -= clamped;
  }
  widths.push(remaining); // last slice gets whatever is left — guarantees no gaps
  return widths;
}

// Generate the full city and return an array of Building objects.
// Each building has: x, y (top-left corner), width, height, color, windows.
export function generateCity() {
  const count  = randomInt(BUILDING_COUNT_MIN, BUILDING_COUNT_MAX);
  const widths = generateBuildingWidths(count, CANVAS_WIDTH);

  const buildings = [];
  let currentX = 0;
  let lastColorIndex = -1;

  for (let i = 0; i < count; i++) {
    const buildingWidth  = widths[i];
    const buildingHeight = randomInt(BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT);

    // Pick a colour, but avoid repeating the same one twice in a row.
    let colorIndex;
    do {
      colorIndex = randomInt(0, BUILDING_PALETTE.length - 1);
    } while (colorIndex === lastColorIndex && BUILDING_PALETTE.length > 1);
    lastColorIndex = colorIndex;

    const buildingY = GROUND_Y - buildingHeight;

    buildings.push({
      x:       currentX,
      y:       buildingY,
      width:   buildingWidth,
      height:  buildingHeight,
      color:   BUILDING_PALETTE[colorIndex],
      windows: generateWindows(buildingWidth, buildingHeight),
    });

    currentX += buildingWidth;
  }

  return buildings;
}
