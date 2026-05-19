// world.js
// This file builds everything that makes up the game world:
// the city skyline, where the two players stand, and how hard the wind blows.
// It also owns the offscreen canvas that holds the painted city,
// and the carveCrater function that punches holes in it when things explode.
// Think of it like a city planner who designs everything on paper first,
// then hands the finished painting to the game.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
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
  WINDOW_LIT_COLOR,
  WINDOW_DARK_COLOR,
  WINDOW_LIT_PROBABILITY,
  CHARACTER_WIDTH,
  CHARACTER_HEIGHT,
  CHARACTER_COLORS,
  WIND_MIN,
  WIND_MAX,
} from "./config.js";

// Pick a random whole number between min and max (inclusive).
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build the grid of windows for one building.
// Returns a 2D array: windows[row][col] is true if that window is lit.
function generateWindows(buildingWidth, buildingHeight) {
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
// but always add up to exactly canvasWidth — so there are never any gaps.
function generateBuildingWidths(n, canvasWidth) {
  const baseWidth = canvasWidth / n;
  const widths = [];
  let remaining = canvasWidth;

  for (let i = 0; i < n - 1; i++) {
    const variation = baseWidth * 0.15;
    const width = Math.round(baseWidth + (Math.random() * variation * 2 - variation));
    const clamped = Math.max(30, Math.min(width, remaining - 30 * (n - 1 - i)));
    widths.push(clamped);
    remaining -= clamped;
  }
  widths.push(remaining);
  return widths;
}

// Paint one building (walls + windows) onto any canvas context.
function drawBuildingToCtx(ctx, building) {
  ctx.fillStyle = building.color;
  ctx.fillRect(building.x, building.y, building.width, building.height);

  const grid = building.windows;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const windowX = building.x + WINDOW_MARGIN + col * (WINDOW_WIDTH  + WINDOW_GAP_X);
      const windowY = building.y + WINDOW_MARGIN + row * (WINDOW_HEIGHT + WINDOW_GAP_Y);
      ctx.fillStyle = grid[row][col] ? WINDOW_LIT_COLOR : WINDOW_DARK_COLOR;
      ctx.fillRect(windowX, windowY, WINDOW_WIDTH, WINDOW_HEIGHT);
    }
  }
}

// Generate the city, render it to an offscreen canvas, and return all three.
// The offscreen canvas is what gets drawn to the screen each frame — fast,
// because we only repaint individual pixels when a crater is carved.
// Returns { buildings, canvas, ctx } where canvas is the offscreen element.
function generateCity() {
  const count  = randomInt(BUILDING_COUNT_MIN, BUILDING_COUNT_MAX);
  const widths = generateBuildingWidths(count, CANVAS_WIDTH);

  const buildings = [];
  let currentX = 0;
  let lastColorIndex = -1;

  for (let i = 0; i < count; i++) {
    const buildingWidth  = widths[i];
    const buildingHeight = randomInt(BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT);

    let colorIndex;
    do {
      colorIndex = randomInt(0, BUILDING_PALETTE.length - 1);
    } while (colorIndex === lastColorIndex && BUILDING_PALETTE.length > 1);
    lastColorIndex = colorIndex;

    buildings.push({
      x:       currentX,
      y:       GROUND_Y - buildingHeight,
      width:   buildingWidth,
      height:  buildingHeight,
      color:   BUILDING_PALETTE[colorIndex],
      windows: generateWindows(buildingWidth, buildingHeight),
    });

    currentX += buildingWidth;
  }

  // Paint every building onto an offscreen canvas once.
  // willReadFrequently lets the browser optimise the pixel-read calls
  // used by collision detection later.
  const offscreen = document.createElement("canvas");
  offscreen.width  = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
  for (const b of buildings) {
    drawBuildingToCtx(offCtx, b);
  }

  return { buildings, canvas: offscreen, ctx: offCtx };
}

// Choose which two buildings the players will stand on.
// Player 1 gets a building from the left half, Player 2 from the right half.
// Rules: not the tallest building, not adjacent to each other,
// and wide enough to stand on.
// Returns { leftIndex, rightIndex }.
function pickCharacterBuildings(buildings) {
  const midpoint        = buildings.length / 2;
  const minBuildingWidth = CHARACTER_WIDTH + 10;

  // Find the tallest building so we can avoid putting a player on it.
  let tallestIndex = 0;
  for (let i = 1; i < buildings.length; i++) {
    if (buildings[i].height > buildings[tallestIndex].height) tallestIndex = i;
  }

  // Gather valid candidates for each half of the city.
  const leftCandidates  = [];
  const rightCandidates = [];
  for (let i = 0; i < buildings.length; i++) {
    if (buildings[i].width < minBuildingWidth) continue;
    if (i === tallestIndex) continue;
    if (i < midpoint) leftCandidates.push(i);
    else              rightCandidates.push(i);
  }

  // Find a pair that isn't adjacent (gap of at least 2 buildings between them).
  for (const li of leftCandidates) {
    for (const ri of rightCandidates) {
      if (ri - li >= 2) return { leftIndex: li, rightIndex: ri };
    }
  }

  // Fallback: if no perfect pair exists, just pick one from each half.
  const fallbackLeft  = Math.floor(midpoint / 2);
  const fallbackRight = Math.floor(midpoint + (buildings.length - midpoint) / 2);
  return { leftIndex: fallbackLeft, rightIndex: fallbackRight };
}

// Place a character on top of a building.
// The character is centred on the building's roof.
// Returns a Character object: { id, color, x, y, width, height, facingRight }.
function placeCharacter(building, color, id, facingRight) {
  return {
    id,
    color,
    x:           building.x + Math.floor((building.width - CHARACTER_WIDTH) / 2),
    y:           building.y - CHARACTER_HEIGHT,
    width:       CHARACTER_WIDTH,
    height:      CHARACTER_HEIGHT,
    facingRight,
  };
}

// Pick a random wind strength with one decimal place.
// Negative means blowing left, positive means blowing right.
export function generateWind() {
  const raw = Math.random() * (WIND_MAX - WIND_MIN) + WIND_MIN;
  return parseFloat(raw.toFixed(1));
}

// Punch a transparent circular hole in the city canvas at (x, y).
// destination-out erases whatever pixels are inside the circle,
// which is how craters appear in the buildings.
export function carveCrater(world, x, y, radius) {
  const offCtx = world.city.ctx;
  offCtx.save();
  offCtx.globalCompositeOperation = "destination-out";
  offCtx.beginPath();
  offCtx.arc(x, y, radius, 0, Math.PI * 2);
  offCtx.fill();
  offCtx.restore();
}

// Generate the whole world: city, characters, and wind.
// This is the main function that game.js calls to set everything up.
export function generateWorld() {
  const city = generateCity(); // { buildings, canvas, ctx }
  const { leftIndex, rightIndex } = pickCharacterBuildings(city.buildings);

  const leftCharacter  = placeCharacter(city.buildings[leftIndex],  CHARACTER_COLORS.player1, 1, true);
  const rightCharacter = placeCharacter(city.buildings[rightIndex], CHARACTER_COLORS.player2, 2, false);
  const wind           = generateWind();

  return { city, characters: [leftCharacter, rightCharacter], wind };
}
