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
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_GAP_X,
  WINDOW_GAP_Y,
  WINDOW_MARGIN,
  CHARACTER_WIDTH,
  CHARACTER_HEIGHT,
  CHARACTER_COLORS,
  WIND_MIN,
  WIND_MAX,
  THEMES,
} from "./config.js";

// Pick a random whole number between min and max (inclusive).
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build the grid of windows for one building.
// Returns a 2D array: windows[row][col] is true if that window is lit.
function generateWindows(buildingWidth, buildingHeight, litProb) {
  const usableWidth  = buildingWidth  - WINDOW_MARGIN * 2;
  const usableHeight = buildingHeight - WINDOW_MARGIN * 2;

  const columns = Math.max(1, Math.floor((usableWidth  + WINDOW_GAP_X) / (WINDOW_WIDTH  + WINDOW_GAP_X)));
  const rows    = Math.max(1, Math.floor((usableHeight + WINDOW_GAP_Y) / (WINDOW_HEIGHT + WINDOW_GAP_Y)));

  const grid = [];
  for (let row = 0; row < rows; row++) {
    const rowData = [];
    for (let col = 0; col < columns; col++) {
      rowData.push(Math.random() < litProb);
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
      ctx.fillStyle = grid[row][col] ? building.winLit : building.winDark;
      if (building.portholes) {
        ctx.beginPath();
        ctx.arc(windowX + WINDOW_WIDTH / 2, windowY + WINDOW_HEIGHT / 2, WINDOW_WIDTH / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(windowX, windowY, WINDOW_WIDTH, WINDOW_HEIGHT);
      }
    }
  }

  // Gradient shading — lighter at top, darker at bottom, for depth.
  const shade = ctx.createLinearGradient(building.x, building.y, building.x, building.y + building.height);
  shade.addColorStop(0,   'rgba(255,255,255,0.10)');
  shade.addColorStop(0.4, 'rgba(0,0,0,0)');
  shade.addColorStop(1,   'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(building.x, building.y, building.width, building.height);

  // Roofline highlight — colour comes from the theme.
  ctx.fillStyle = building.roofline;
  ctx.fillRect(building.x, building.y, building.width, 2);

  // Rocky Canyon — stepped rock protrusions along the roofline
  if (building.rockSteps) {
    const sw = building.width / building.rockSteps.length;
    building.rockSteps.forEach((h, i) => {
      ctx.fillStyle = i % 3 === 0 ? '#3d1806' : i % 3 === 1 ? '#4a2008' : '#5c2c0e';
      ctx.fillRect(Math.floor(building.x + i * sw), building.y - h, Math.ceil(sw) + 1, h);
    });
  }

  // Space Station — antenna towers on rooftop
  if (building.antennae) {
    building.antennae.forEach(ant => {
      const ax = building.x + ant.xOff;
      ctx.fillStyle = '#607888';
      ctx.fillRect(ax - 1, building.y - ant.height, 2, ant.height);
      if (ant.dish) {
        ctx.fillStyle = '#8aafc0';
        ctx.beginPath();
        ctx.ellipse(ax, building.y - ant.height, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#99bbcc';
        ctx.beginPath();
        ctx.arc(ax, building.y - ant.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Neon City — horizontal neon accent bands
  if (building.neonBands) {
    building.neonBands.forEach(band => {
      ctx.fillStyle = band.color;
      ctx.fillRect(building.x, building.y + band.yOff, building.width, 2);
    });
  }
}

// Generate the city, render it to an offscreen canvas, and return all three.
// The offscreen canvas is what gets drawn to the screen each frame — fast,
// because we only repaint individual pixels when a crater is carved.
// Returns { buildings, canvas, ctx } where canvas is the offscreen element.
function generateCity(theme) {
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
      colorIndex = randomInt(0, theme.palette.length - 1);
    } while (colorIndex === lastColorIndex && theme.palette.length > 1);
    lastColorIndex = colorIndex;

    const building = {
      x:        currentX,
      y:        GROUND_Y - buildingHeight,
      width:    buildingWidth,
      height:   buildingHeight,
      color:    theme.palette[colorIndex],
      winLit:   theme.winLit,
      winDark:  theme.winDark,
      roofline: theme.roofline,
      windows:  generateWindows(buildingWidth, buildingHeight, theme.winLitProb),
    };

    if (theme.name === 'ROCKY CANYON') {
      const stepCount = Math.max(3, Math.floor(buildingWidth / 15));
      building.rockSteps = Array.from({ length: stepCount }, () => randomInt(5, 26));
    }

    if (theme.name === 'SPACE STATION') {
      building.portholes = true;
      const antennaCount = randomInt(1, 3);
      building.antennae  = Array.from({ length: antennaCount }, () => ({
        xOff:   randomInt(6, Math.max(7, buildingWidth - 6)),
        height: randomInt(12, 30),
        dish:   Math.random() < 0.45,
      }));
    }

    if (theme.name === 'NEON CITY') {
      const NEON = ['#ff2090', '#00ffcc', '#ff6600', '#cc00ff', '#ffff00'];
      const bandCount = randomInt(1, 3);
      building.neonBands = Array.from({ length: bandCount }, () => ({
        yOff:  randomInt(10, buildingHeight - 6),
        color: NEON[randomInt(0, NEON.length - 1)],
      }));
    }

    buildings.push(building);
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
// P1 picks randomly from the 5 leftmost buildings; P2 from the 5 rightmost.
// Both must be wide enough for the character sprite to stand on.
// Returns { leftIndex, rightIndex }.
function pickCharacterBuildings(buildings) {
  const minBuildingWidth = CHARACTER_WIDTH + 10;
  const poolSize = 5;

  function pickRandom(indices) {
    const valid = indices.filter(i => buildings[i].width >= minBuildingWidth);
    if (valid.length === 0) return indices[0]; // fallback: first in pool
    return valid[Math.floor(Math.random() * valid.length)];
  }

  const leftPool  = Array.from({ length: poolSize }, (_, i) => i);
  const rightPool = Array.from({ length: poolSize }, (_, i) => buildings.length - poolSize + i);

  return { leftIndex: pickRandom(leftPool), rightIndex: pickRandom(rightPool) };
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
  offCtx.fillStyle = "#000000"; // must be fully opaque so destination-out erases completely
  offCtx.beginPath();
  offCtx.arc(x, y, radius, 0, Math.PI * 2);
  offCtx.fill();
  offCtx.restore();
}

// Generate the whole world: city, characters, and wind.
// themeIndex cycles through THEMES each round.
export function generateWorld(themeIndex = 0) {
  const theme = THEMES[themeIndex % THEMES.length];
  const city  = generateCity(theme);
  const { leftIndex, rightIndex } = pickCharacterBuildings(city.buildings);

  const leftCharacter  = placeCharacter(city.buildings[leftIndex],  CHARACTER_COLORS.player1, 1, true);
  const rightCharacter = placeCharacter(city.buildings[rightIndex], CHARACTER_COLORS.player2, 2, false);
  const wind           = generateWind();

  return { city, characters: [leftCharacter, rightCharacter], wind, theme };
}
