// game.js
// State machine, physics loop, and turn management.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GameState,
  GameMode,
  ANGLE_MAX,
  VELOCITY_MAX,
  ANGLE_CYCLE_SPEED,
  VELOCITY_CYCLE_SPEED,
  AIM_LINE_MIN_VELOCITY,
  ARM_UP_DURATION_MS,
  MAX_FRAME_DT,
  EXPLOSION_CRATER_RADIUS,
  EXPLOSION_DRAW_RADIUS,
  EXPLOSION_BIG_DRAW_RADIUS,
  EXPLOSION_DURATION_MS,
  MATCH_WIN_THRESHOLD,
  ROUND_END_BANNER_DURATION_MS,
  SUPER_BOMB_CRATER_RADIUS,
  SUPER_BOMB_DRAW_RADIUS,
  TUNNEL_BOMB_TUNNEL_RADIUS,
  TUNNEL_BOMB_DRAW_RADIUS,
  TUNNEL_BOMB_MAX_DRILL_PX,
  TUNNEL_BOMB_DRILL_SPEED_FACTOR,
  FREEZE_BOMB_BLOCK_SIZE,
  FREEZE_BOMB_BLOCK_COLOR,
  FREEZE_BOMB_EXPAND_DURATION_MS,
  THEMES,
  MAX_HP,
  RELOAD_COOLDOWN_MS,
} from "./config.js";
import { generateWorld, carveCrater } from "./world.js";
import { getLaunchPoint, launchVelocity, stepProjectile, isOffScreen, hitsCity, hitsCharacter } from "./physics.js";
import { drawScene, drawCharacterSelect, SB_BTN_W, SB_BTN_H, SB_BTN_Y, NEW_GAME_BTN, triggerShake } from "./render.js";
import { setupInput, setAim, getAim, setInputEnabled, setActivePlayer } from "./input.js";
import { CHARACTERS } from "./characters.js";
import { playSound, startDrillSound, stopDrillSound } from "./sound.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas    = document.getElementById("game");
  const ctx       = canvas.getContext("2d");
  const nameInput = document.getElementById("name-input");

  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // ── Shared state ────────────────────────────────────────────────────────────
  let currentState        = GameState.CHARACTER_SELECT;
  let gameMode            = GameMode.SEQUENTIAL;
  let world               = null;

  // Character selection
  let charSelectPhase = 0;   // 0 = P1, 1 = P2, 2 = mode select
  let charPreview     = [0, 0];
  let playerNames     = ["Player 1", "Player 2"];
  let charNameInput   = "";
  let gameModeIndex   = 0;   // 0 = PARALLEL, 1 = SEQUENTIAL

  let roundIndex              = 0;
  let hp                      = [MAX_HP, MAX_HP];
  let tunnelBombAvailable     = [true, true];
  let freezeBombAvailable     = [true, true];
  let activePlayerIndex       = 0;
  let roundWinner             = -1;
  let roundWinsByPlayer       = [0, 0];
  let matchWinner             = null;
  let roundEndBannerStartTime = null;
  let superBombAvailable      = [2, 2];

  // ── Sequential-only state ───────────────────────────────────────────────────
  let throwingPlayerIndex = 0;
  let projectiles         = [];    // all in-flight projectiles this turn
  let seqExplosions       = [];    // all active explosion animations
  let seqReloadAt         = null;  // performance.now() timestamp when player may fire again
  let seqAimingForReload  = false; // true when cooldown expired, player re-aiming mid-RESOLVING
  let isArmUp             = false;
  let armUpTimer          = null;
  let superBombArmed      = false;
  let tunnelBombArmed     = false;
  let freezeBombArmed     = false;
  let cyclePhase          = 'angle';
  let cycleStartTime      = null;
  let lockedAngle         = 0;

  // ── Parallel-only state ─────────────────────────────────────────────────────
  const parInit = () => ({
    cyclePhase:     'angle',
    cycleStartTime: null,
    lockedAngle:    0,
    aim:            { angle: 0, velocity: AIM_LINE_MIN_VELOCITY },
    isArmUp:        false,
    armUpTimer:     null,
    projectiles:    [],   // all in-flight projectiles for this player
    explosions:     [],   // all active explosion animations for this player
    reloadAt:       0,    // performance.now() timestamp when canFire becomes true
    superBombArmed:  false,
    tunnelBombArmed: false,
    freezeBombArmed: false,
    canFire:         true,
  });
  let par               = [parInit(), parInit()];
  let parallelRoundOver = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function paintFreezeBlock(offCtx, cx, cy) {
    const hs = FREEZE_BOMB_BLOCK_SIZE / 2;

    // Main body gradient — offset so it feels lit from top-left
    const grad = offCtx.createRadialGradient(cx - hs * 0.25, cy - hs * 0.25, 0, cx, cy, hs * 1.3);
    grad.addColorStop(0,    '#9ad4f5');
    grad.addColorStop(0.35, '#2e6fbb');
    grad.addColorStop(0.75, '#1a4e99');
    grad.addColorStop(1,    '#0d3066');
    offCtx.fillStyle = grad;
    offCtx.beginPath();
    offCtx.roundRect(cx - hs, cy - hs, FREEZE_BOMB_BLOCK_SIZE, FREEZE_BOMB_BLOCK_SIZE, 10);
    offCtx.fill();

    // Top-left specular highlight
    const hi = offCtx.createRadialGradient(cx - hs * 0.5, cy - hs * 0.5, 0, cx - hs * 0.2, cy - hs * 0.2, hs * 0.8);
    hi.addColorStop(0,   'rgba(255, 255, 255, 0.28)');
    hi.addColorStop(1,   'rgba(255, 255, 255, 0)');
    offCtx.fillStyle = hi;
    offCtx.beginPath();
    offCtx.roundRect(cx - hs, cy - hs, FREEZE_BOMB_BLOCK_SIZE, FREEZE_BOMB_BLOCK_SIZE, 10);
    offCtx.fill();
  }

  function triangleWave(elapsedMs, maxValue, speed) {
    const periodMs   = (2 * maxValue / speed) * 1000;
    const t          = elapsedMs % periodMs;
    const normalized = t / periodMs;
    return maxValue * (normalized < 0.5 ? normalized * 2 : (1 - normalized) * 2);
  }

  function buildWorld() {
    world = generateWorld(Math.floor(Math.random() * THEMES.length));
    hp    = [MAX_HP, MAX_HP];
    console.log(`wind:${world.wind}`);
    world.characters[0].charType = charPreview[0];
    world.characters[1].charType = charPreview[1];
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function redraw(timeMs = performance.now()) {
    if (currentState === GameState.CHARACTER_SELECT) {
      drawCharacterSelect(ctx, { charSelectPhase, charPreview, playerNames, charNameInput, gameModeIndex }, timeMs);
      return;
    }

    if (gameMode === GameMode.PARALLEL) {
      const parallelData = {
        projectiles: [par[0].projectiles, par[1].projectiles],
        explosions:  [par[0].explosions,  par[1].explosions],
        aims:        [par[0].aim,         par[1].aim],
        isArmUp:     [par[0].isArmUp,    par[1].isArmUp],
        showAimLine: [
          par[0].canFire && !par[0].isArmUp && !parallelRoundOver,
          par[1].canFire && !par[1].isArmUp && !parallelRoundOver,
        ],
        canFire: [par[0].canFire, par[1].canFire],
      };
      drawScene(ctx, world, activePlayerIndex, timeMs, {
        roundWinsByPlayer,
        roundBannerWinner: currentState === GameState.ROUND_END_BANNER ? roundWinner        : -1,
        matchBannerWinner: currentState === GameState.MATCH_END        ? (matchWinner ?? -1) : -1,
        superBombAvailable,
        superBombArmed:    [par[0].superBombArmed,  par[1].superBombArmed],
        tunnelBombAvailable,
        tunnelBombArmed:   [par[0].tunnelBombArmed, par[1].tunnelBombArmed],
        freezeBombAvailable,
        freezeBombArmed:   [par[0].freezeBombArmed, par[1].freezeBombArmed],
        playerNames,
        parallelData,
        hp,
      });
      return;
    }

    const isPlayerTurn  = currentState === GameState.PLAYER_TURN && !isArmUp;
    const canAimReload  = seqAimingForReload && !isArmUp;
    drawScene(ctx, world, activePlayerIndex, timeMs, {
      projectiles,
      throwingPlayerIndex,
      isArmUp,
      aim:               getAim(),
      showAimLine:       isPlayerTurn || canAimReload,
      showHint:          isPlayerTurn || canAimReload,
      seqExplosions,
      roundWinsByPlayer,
      roundBannerWinner: currentState === GameState.ROUND_END_BANNER ? roundWinner        : -1,
      matchBannerWinner: currentState === GameState.MATCH_END        ? (matchWinner ?? -1) : -1,
      superBombAvailable,
      superBombArmed,
      tunnelBombAvailable,
      tunnelBombArmed,
      freezeBombAvailable,
      freezeBombArmed,
      playerNames,
      hp,
    });
  }

  function cycleBomb(superAvail, tunnelAvail, freezeAvail, superArmed, tunnelArmed, freezeArmed) {
    if (superArmed) {
      if (tunnelAvail)  return { superArmed: false, tunnelArmed: true,  freezeArmed: false, sound: "superBombArm"    };
      if (freezeAvail)  return { superArmed: false, tunnelArmed: false, freezeArmed: true,  sound: "superBombArm"    };
      return                   { superArmed: false, tunnelArmed: false, freezeArmed: false, sound: "superBombDisarm" };
    }
    if (tunnelArmed) {
      if (freezeAvail)  return { superArmed: false, tunnelArmed: false, freezeArmed: true,  sound: "superBombArm"    };
      return                   { superArmed: false, tunnelArmed: false, freezeArmed: false, sound: "superBombDisarm" };
    }
    if (freezeArmed) {
      return                   { superArmed: false, tunnelArmed: false, freezeArmed: false, sound: "superBombDisarm" };
    }
    if (superAvail)   return   { superArmed: true,  tunnelArmed: false, freezeArmed: false, sound: "superBombArm"    };
    if (tunnelAvail)  return   { superArmed: false, tunnelArmed: true,  freezeArmed: false, sound: "superBombArm"    };
    if (freezeAvail)  return   { superArmed: false, tunnelArmed: false, freezeArmed: true,  sound: "superBombArm"    };
    return                     { superArmed: false, tunnelArmed: false, freezeArmed: false, sound: null };
  }

  // ── Sequential functions ────────────────────────────────────────────────────
  function handleThrow({ angle, velocity }) {
    const isSuperBomb  = superBombArmed;
    const isTunnelBomb = tunnelBombArmed;
    const isFreezeBomb = freezeBombArmed;
    playSound(isSuperBomb ? "throwSuper" : "throw");
    superBombArmed      = false;
    tunnelBombArmed     = false;
    freezeBombArmed     = false;
    seqAimingForReload  = false;
    if (isSuperBomb)  superBombAvailable[activePlayerIndex]--;
    if (isTunnelBomb) tunnelBombAvailable[activePlayerIndex] = false;
    if (isFreezeBomb) freezeBombAvailable[activePlayerIndex] = false;

    setInputEnabled(false);
    if (currentState !== GameState.RESOLVING) {
      throwingPlayerIndex = activePlayerIndex;
      currentState        = GameState.RESOLVING;
    }
    isArmUp = true;

    armUpTimer = setTimeout(() => {
      armUpTimer = null;
      isArmUp    = false;
      const character = world.characters[throwingPlayerIndex];
      const facing    = character.facingRight ? 1 : -1;
      const { x: launchX, y: launchY } = getLaunchPoint(character);
      const { vx, vy } = launchVelocity(angle, velocity, facing);
      projectiles.push({ x: launchX, y: launchY, vx, vy, spin: 0, trail: [], framesAlive: 0, isSuperBomb, isTunnelBomb, isFreezeBomb, frozen: false, frozenAt: 0, drillPx: 0 });
      seqReloadAt = performance.now() + RELOAD_COOLDOWN_MS;
    }, ARM_UP_DURATION_MS);
  }

  function nextTurn() {
    superBombArmed      = false;
    tunnelBombArmed     = false;
    freezeBombArmed     = false;
    cyclePhase          = 'angle';
    cycleStartTime      = null;
    lockedAngle         = 0;
    projectiles         = [];
    seqExplosions       = [];
    seqReloadAt         = null;
    seqAimingForReload  = false;
    activePlayerIndex   = activePlayerIndex === 0 ? 1 : 0;
    currentState        = GameState.PLAYER_TURN;
    setInputEnabled(true);
    setActivePlayer(activePlayerIndex);
  }

  function handleSpacePress() {
    if (gameMode === GameMode.SEQUENTIAL && currentState === GameState.RESOLVING) {
      const fp = projectiles.find(p => p.isFreezeBomb && !p.frozen);
      if (fp) {
        fp.frozen          = true;
        fp.frozenAt        = performance.now();
        fp.vx              = 0;
        fp.vy              = 0;
        fp.trail           = [];
        seqAimingForReload = false;
        seqReloadAt        = null;
        setInputEnabled(false);
        playSound("freezeActivate");
        return;
      }
    }
    if (gameMode === GameMode.PARALLEL) return;
    const canAct = (currentState === GameState.PLAYER_TURN || (currentState === GameState.RESOLVING && seqAimingForReload)) && !isArmUp;
    if (!canAct) return;
    if (cyclePhase === 'angle') {
      lockedAngle    = Math.round(getAim().angle);
      cyclePhase     = 'velocity';
      cycleStartTime = null;
      playSound("lock");
    } else {
      handleThrow({ angle: lockedAngle, velocity: Math.round(getAim().velocity) });
    }
  }

  // ── Parallel functions ──────────────────────────────────────────────────────
  function resetParallelState() {
    const quarterPeriodMs = (ANGLE_MAX / ANGLE_CYCLE_SPEED) * 500;
    for (let p = 0; p < 2; p++) {
      if (par[p].armUpTimer !== null) clearTimeout(par[p].armUpTimer);
      par[p] = parInit();
      par[p].cycleStartTime = performance.now() - quarterPeriodMs;
    }
    parallelRoundOver = false;
  }

  function fireParallelProjectile(p, angle, velocity) {
    const isSuperBomb  = par[p].superBombArmed;
    const isTunnelBomb = par[p].tunnelBombArmed;
    const isFreezeBomb = par[p].freezeBombArmed;
    par[p].superBombArmed  = false;
    par[p].tunnelBombArmed = false;
    par[p].freezeBombArmed = false;
    if (isSuperBomb)  superBombAvailable[p]--;
    if (isTunnelBomb) tunnelBombAvailable[p] = false;
    if (isFreezeBomb) freezeBombAvailable[p] = false;

    playSound(isSuperBomb ? "throwSuper" : "throw");
    par[p].canFire = false;
    par[p].isArmUp = true;

    par[p].armUpTimer = setTimeout(() => {
      par[p].armUpTimer = null;
      par[p].isArmUp    = false;
      const character = world.characters[p];
      const facing    = character.facingRight ? 1 : -1;
      const { x: launchX, y: launchY } = getLaunchPoint(character);
      const { vx, vy } = launchVelocity(angle, velocity, facing);
      par[p].projectiles.push({ x: launchX, y: launchY, vx, vy, spin: 0, trail: [], framesAlive: 0, isSuperBomb, isTunnelBomb, isFreezeBomb, frozen: false, frozenAt: 0, drillPx: 0 });
      par[p].reloadAt = performance.now() + RELOAD_COOLDOWN_MS;
    }, ARM_UP_DURATION_MS);
  }

  function handleParallelShift(p) {
    const fp = par[p].projectiles.find(pr => pr.isFreezeBomb && !pr.frozen);
    if (fp && !parallelRoundOver) {
      fp.frozen   = true;
      fp.frozenAt = performance.now();
      fp.vx       = 0;
      fp.vy       = 0;
      fp.trail    = [];
      playSound("freezeActivate");
      return;
    }
    if (currentState !== GameState.PLAYER_TURN || parallelRoundOver) return;
    if (!par[p].canFire || par[p].isArmUp) return;

    if (par[p].cyclePhase === 'angle') {
      par[p].lockedAngle    = Math.round(par[p].aim.angle);
      par[p].cyclePhase     = 'velocity';
      par[p].cycleStartTime = null;
      playSound("lock");
    } else {
      const angle    = par[p].lockedAngle;
      const velocity = Math.round(par[p].aim.velocity);
      par[p].cyclePhase     = 'angle';
      par[p].cycleStartTime = null;
      par[p].lockedAngle    = 0;
      fireParallelProjectile(p, angle, velocity);
    }
  }

  // ── Character select helpers ────────────────────────────────────────────────

  // Shared confirm logic — called by Enter key, confirm button tap, and name input Enter.
  function confirmCharSelect() {
    playerNames[charSelectPhase] = charNameInput.trim() || `Player ${charSelectPhase + 1}`;
    charNameInput   = "";
    nameInput.value = "";
    nameInput.blur();
    if (charSelectPhase < 2) {
      charSelectPhase++;
      playSound("confirm");
      redraw();
    } else {
      playSound("confirm");
      startGame();
    }
  }

  // Thumbnail and button hit detection for pointer events on the select screen.
  function handleCharSelectPointer(cx, cy) {
    // Thumbnail row — same positions as render.js
    const thumbW = 56, thumbH = 64, gap = 32;
    const totalW = CHARACTERS.length * thumbW + (CHARACTERS.length - 1) * gap;
    const rowX   = (CANVAS_WIDTH - totalW) / 2;
    const rowY   = 146;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const tx = rowX + i * (thumbW + gap);
      if (cx >= tx - 8 && cx <= tx + thumbW + 8 && cy >= rowY - 8 && cy <= rowY + thumbH + 8) {
        charPreview[charSelectPhase] = i;
        playSound("navigate");
        redraw();
        return;
      }
    }

    // Name input box — focus hidden input so the mobile keyboard appears
    const pvY  = 260, pvH = 128;
    const boxW = 480, boxH = 44;
    const boxX = CANVAS_WIDTH / 2 - boxW / 2;
    const boxY = pvY + pvH + 136;
    if (cx >= boxX && cx <= boxX + boxW && cy >= boxY && cy <= boxY + boxH) {
      nameInput.value = charNameInput;
      nameInput.focus();
      return;
    }

    // Confirm button — same dimensions as drawn in render.js
    const btnW = 260, btnH = 52;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = boxY + boxH + 18;
    if (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH) {
      confirmCharSelect();
    }
  }

  // Sync the hidden input's text into charNameInput (handles mobile keyboard typing).
  nameInput.addEventListener("input", () => {
    let val = nameInput.value.slice(0, 14);
    if (val.length >= 1) val = val[0].toUpperCase() + val.slice(1);
    if (nameInput.value !== val) nameInput.value = val;
    charNameInput = val;
    redraw();
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirmCharSelect(); }
  });

  // ── Game flow ───────────────────────────────────────────────────────────────
  function startGame() {
    gameMode = gameModeIndex === 0 ? GameMode.PARALLEL : GameMode.SEQUENTIAL;
    buildWorld();
    activePlayerIndex = 0;
    if (gameMode === GameMode.PARALLEL) {
      resetParallelState();
      currentState = GameState.PLAYER_TURN;
      setInputEnabled(false);
    } else {
      currentState = GameState.PLAYER_TURN;
      setInputEnabled(true);
      setActivePlayer(0);
    }
  }

  function startNextRound(loserIndex) {
    roundIndex++;
    buildWorld();
    activePlayerIndex       = loserIndex;
    roundWinner             = -1;
    roundEndBannerStartTime = null;
    superBombAvailable      = [2, 2];
    tunnelBombAvailable     = [true, true];
    freezeBombAvailable     = [true, true];

    if (gameMode === GameMode.PARALLEL) {
      resetParallelState();
      currentState = GameState.PLAYER_TURN;
    } else {
      superBombArmed      = false;
      tunnelBombArmed     = false;
      freezeBombArmed     = false;
      cyclePhase          = 'angle';
      cycleStartTime      = null;
      lockedAngle         = 0;
      projectiles         = [];
      seqExplosions       = [];
      seqReloadAt         = null;
      seqAimingForReload  = false;
      isArmUp             = false;
      if (armUpTimer !== null) { clearTimeout(armUpTimer); armUpTimer = null; }
      setInputEnabled(true);
      setActivePlayer(loserIndex);
      currentState = GameState.PLAYER_TURN;
    }
  }

  function resetMatch() {
    if (armUpTimer !== null) { clearTimeout(armUpTimer); armUpTimer = null; }
    resetParallelState();

    projectiles             = [];
    seqExplosions           = [];
    seqReloadAt             = null;
    seqAimingForReload      = false;
    isArmUp                 = false;
    roundWinner             = -1;
    roundWinsByPlayer       = [0, 0];
    matchWinner             = null;
    roundEndBannerStartTime = null;
    superBombAvailable      = [2, 2];
    tunnelBombAvailable     = [true, true];
    freezeBombAvailable     = [true, true];
    superBombArmed          = false;
    tunnelBombArmed         = false;
    freezeBombArmed         = false;
    cyclePhase              = 'angle';
    cycleStartTime          = null;
    lockedAngle             = 0;
    world                   = null;
    roundIndex              = 0;
    hp                      = [MAX_HP, MAX_HP];
    activePlayerIndex       = 0;
    charSelectPhase         = 0;
    playerNames             = ["Player 1", "Player 2"];
    charNameInput           = "";
    currentState            = GameState.CHARACTER_SELECT;

    nameInput.value = "";
    nameInput.blur();
    setInputEnabled(false);
    setActivePlayer(0);
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  setupInput({ onSpacePress: handleSpacePress });

  window.addEventListener("keydown", (event) => {
    if (currentState === GameState.MATCH_END && event.key === "Enter") {
      event.preventDefault();
      resetMatch();
      return;
    }

    if (currentState === GameState.CHARACTER_SELECT) {
      if (event.target === nameInput) return;
      if (charSelectPhase === 2) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          gameModeIndex = gameModeIndex === 0 ? 1 : 0;
          playSound("navigate");
          redraw();
        } else if (event.key === "Enter") {
          event.preventDefault();
          playSound("confirm");
          startGame();
        }
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        charNameInput = charNameInput.slice(0, -1);
        nameInput.value = charNameInput;
        playSound("type");
        redraw();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        charPreview[charSelectPhase] =
          (charPreview[charSelectPhase] - 1 + CHARACTERS.length) % CHARACTERS.length;
        playSound("navigate");
        redraw();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        charPreview[charSelectPhase] =
          (charPreview[charSelectPhase] + 1) % CHARACTERS.length;
        playSound("navigate");
        redraw();
      } else if (event.key === "Enter") {
        event.preventDefault();
        confirmCharSelect();
      } else if (event.key.length === 1 && charNameInput.length < 14) {
        const ch = charNameInput.length === 0 ? event.key.toUpperCase() : event.key;
        charNameInput += ch;
        nameInput.value = charNameInput;
        playSound("type");
        redraw();
      }
      return;
    }

    if (gameMode === GameMode.PARALLEL) {
      if (event.key === "Shift" && event.location === 1) {
        event.preventDefault();
        handleParallelShift(0);
      } else if (event.key === "Shift" && event.location === 2) {
        event.preventDefault();
        handleParallelShift(1);
      } else if ((event.key === "s" || event.key === "S") &&
                 currentState === GameState.PLAYER_TURN && !parallelRoundOver &&
                 par[0].canFire && !par[0].isArmUp) {
        const r = cycleBomb(superBombAvailable[0], tunnelBombAvailable[0], freezeBombAvailable[0], par[0].superBombArmed, par[0].tunnelBombArmed, par[0].freezeBombArmed);
        par[0].superBombArmed  = r.superArmed;
        par[0].tunnelBombArmed = r.tunnelArmed;
        par[0].freezeBombArmed = r.freezeArmed;
        if (r.sound) playSound(r.sound);
        redraw();
      } else if ((event.key === "l" || event.key === "L") &&
                 currentState === GameState.PLAYER_TURN && !parallelRoundOver &&
                 par[1].canFire && !par[1].isArmUp) {
        const r = cycleBomb(superBombAvailable[1], tunnelBombAvailable[1], freezeBombAvailable[1], par[1].superBombArmed, par[1].tunnelBombArmed, par[1].freezeBombArmed);
        par[1].superBombArmed  = r.superArmed;
        par[1].tunnelBombArmed = r.tunnelArmed;
        par[1].freezeBombArmed = r.freezeArmed;
        if (r.sound) playSound(r.sound);
        redraw();
      }
      return;
    }

    if ((event.key === "s" || event.key === "S") &&
        (currentState === GameState.PLAYER_TURN || (currentState === GameState.RESOLVING && seqAimingForReload)) &&
        !isArmUp) {
      const r = cycleBomb(superBombAvailable[activePlayerIndex], tunnelBombAvailable[activePlayerIndex], freezeBombAvailable[activePlayerIndex], superBombArmed, tunnelBombArmed, freezeBombArmed);
      superBombArmed  = r.superArmed;
      tunnelBombArmed = r.tunnelArmed;
      freezeBombArmed = r.freezeArmed;
      if (r.sound) playSound(r.sound);
      redraw();
    }
  });

  // ── Pointer input (mouse + touch) ───────────────────────────────────────────
  canvas.addEventListener("pointerdown", (event) => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx     = (event.clientX - rect.left) * scaleX;
    const cy     = (event.clientY - rect.top)  * scaleY;

    // Match end — new game button
    if (currentState === GameState.MATCH_END) {
      const { x, y, w, h } = NEW_GAME_BTN;
      if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
        event.preventDefault();
        resetMatch();
      }
      return;
    }

    // Character select screen
    if (currentState === GameState.CHARACTER_SELECT && charSelectPhase < 2) {
      event.preventDefault();
      handleCharSelectPointer(cx, cy);
      return;
    }

    if (currentState === GameState.CHARACTER_SELECT && charSelectPhase === 2) {
      event.preventDefault();
      const cardW = 320, cardH = 160, cardGap = 60;
      const totalW = 2 * cardW + cardGap;
      const cardStartX = (CANVAS_WIDTH - totalW) / 2;
      const cardY = 200;
      for (let i = 0; i < 2; i++) {
        const cardX = cardStartX + i * (cardW + cardGap);
        if (cx >= cardX && cx <= cardX + cardW && cy >= cardY && cy <= cardY + cardH) {
          gameModeIndex = i;
          playSound("confirm");
          startGame();
          return;
        }
      }
      return;
    }

    if (currentState === GameState.PLAYER_TURN) {
      event.preventDefault();

      // Super bomb buttons (top bar)
      if (cy >= SB_BTN_Y && cy <= SB_BTN_Y + SB_BTN_H) {
        const p1BtnX = 16; // SCOREBOARD_MARGIN_X
        const p2BtnX = CANVAS_WIDTH - 16 - SB_BTN_W;

        if (cx >= p1BtnX && cx <= p1BtnX + SB_BTN_W) {
          if (gameMode === GameMode.PARALLEL) {
            if (!parallelRoundOver && par[0].canFire && !par[0].isArmUp) {
              const r = cycleBomb(superBombAvailable[0], tunnelBombAvailable[0], freezeBombAvailable[0], par[0].superBombArmed, par[0].tunnelBombArmed, par[0].freezeBombArmed);
              par[0].superBombArmed  = r.superArmed;
              par[0].tunnelBombArmed = r.tunnelArmed;
              par[0].freezeBombArmed = r.freezeArmed;
              if (r.sound) playSound(r.sound);
              redraw();
            }
          } else if (activePlayerIndex === 0 && !isArmUp) {
            const r = cycleBomb(superBombAvailable[0], tunnelBombAvailable[0], freezeBombAvailable[0], superBombArmed, tunnelBombArmed, freezeBombArmed);
            superBombArmed  = r.superArmed;
            tunnelBombArmed = r.tunnelArmed;
            freezeBombArmed = r.freezeArmed;
            if (r.sound) playSound(r.sound);
            redraw();
          }
          return;
        }

        if (cx >= p2BtnX && cx <= p2BtnX + SB_BTN_W) {
          if (gameMode === GameMode.PARALLEL) {
            if (!parallelRoundOver && par[1].canFire && !par[1].isArmUp) {
              const r = cycleBomb(superBombAvailable[1], tunnelBombAvailable[1], freezeBombAvailable[1], par[1].superBombArmed, par[1].tunnelBombArmed, par[1].freezeBombArmed);
              par[1].superBombArmed  = r.superArmed;
              par[1].tunnelBombArmed = r.tunnelArmed;
              par[1].freezeBombArmed = r.freezeArmed;
              if (r.sound) playSound(r.sound);
              redraw();
            }
          } else if (activePlayerIndex === 1 && !isArmUp) {
            const r = cycleBomb(superBombAvailable[1], tunnelBombAvailable[1], freezeBombAvailable[1], superBombArmed, tunnelBombArmed, freezeBombArmed);
            superBombArmed  = r.superArmed;
            tunnelBombArmed = r.tunnelArmed;
            freezeBombArmed = r.freezeArmed;
            if (r.sound) playSound(r.sound);
            redraw();
          }
          return;
        }
      }

      // Parallel mode: tap near a character to aim/fire
      if (gameMode === GameMode.PARALLEL && !parallelRoundOver) {
        for (let p = 0; p < 2; p++) {
          const ch = world.characters[p];
          if (Math.hypot(cx - (ch.x + ch.width / 2), cy - (ch.y + ch.height / 2)) < 80) {
            handleParallelShift(p);
            break;
          }
        }
      }
    }
  }, { passive: false });

  // ── Animation loop ──────────────────────────────────────────────────────────
  let lastTime = null;

  function tick(timeMs) {
    const dt = lastTime === null
      ? 0
      : Math.min((timeMs - lastTime) / 1000, MAX_FRAME_DT);
    lastTime = timeMs;
    let anyDrilling = false;

    // ── PARALLEL PLAYER_TURN ─────────────────────────────────────────────────
    if (currentState === GameState.PLAYER_TURN && gameMode === GameMode.PARALLEL) {
      for (let p = 0; p < 2; p++) {
        // Re-enable firing after reload cooldown expires
        if (!par[p].canFire && !par[p].isArmUp && performance.now() >= par[p].reloadAt) {
          par[p].canFire        = true;
          par[p].cyclePhase     = 'angle';
          par[p].cycleStartTime = null;
          par[p].lockedAngle    = 0;
        }

        // Advance aim cycle for players who can fire
        if (par[p].canFire && !par[p].isArmUp && !parallelRoundOver) {
          if (par[p].cycleStartTime === null) par[p].cycleStartTime = timeMs;
          const elapsed = timeMs - par[p].cycleStartTime;
          if (par[p].cyclePhase === 'angle') {
            par[p].aim = { angle: triangleWave(elapsed, ANGLE_MAX, ANGLE_CYCLE_SPEED), velocity: AIM_LINE_MIN_VELOCITY };
          } else {
            par[p].aim = { angle: par[p].lockedAngle, velocity: triangleWave(elapsed, VELOCITY_MAX, VELOCITY_CYCLE_SPEED) };
          }
        }

        // Step all in-flight projectiles
        for (let j = par[p].projectiles.length - 1; j >= 0; j--) {
          const proj  = par[p].projectiles[j];
          const inBuildingPar = proj.isTunnelBomb &&
            world.city.buildings.find(b => proj.x >= b.x && proj.x < b.x + b.width && proj.y >= b.y);
          const effectiveDtPar = inBuildingPar ? dt * TUNNEL_BOMB_DRILL_SPEED_FACTOR : dt;
          if (proj.frozen) {
            if (timeMs - proj.frozenAt >= FREEZE_BOMB_EXPAND_DURATION_MS) {
              paintFreezeBlock(world.city.ctx, Math.round(proj.x), Math.round(proj.y));
              par[p].projectiles.splice(j, 1);
            }
            continue;
          }
          stepProjectile(proj, world.wind, effectiveDtPar);
          const enemy = 1 - p;

          if (hitsCharacter(proj, world.characters[enemy])) {
            const damage = proj.isSuperBomb ? 2 : 1;
            hp[enemy] = Math.max(0, hp[enemy] - damage);
            playSound(proj.isSuperBomb ? "explosionSuper" : "explosion");
            playSound("playerHit");
            const hitChar = world.characters[enemy];
            const bigR    = proj.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS : EXPLOSION_BIG_DRAW_RADIUS;
            par[p].explosions.push({ x: hitChar.x + hitChar.width / 2, y: hitChar.y + hitChar.height / 2, radius: bigR, startTime: timeMs });
            triggerShake(proj.isSuperBomb ? 20 : 12);
            par[p].projectiles.splice(j, 1);
            if (hp[enemy] === 0) {
              roundWinsByPlayer[p]++;
              playSound("roundWin");
              par[enemy].projectiles = [];
              roundWinner       = p;
              parallelRoundOver = true;
            }

          } else if (proj.isTunnelBomb) {
            const overB = world.city.buildings.find(b => proj.x >= b.x && proj.x < b.x + b.width);
            if (overB && proj.y >= overB.y) {
              anyDrilling = true;
              proj.drillPx += Math.hypot(proj.vx, proj.vy) * effectiveDtPar;
              if (hitsCity(proj, world.city.ctx)) carveCrater(world, proj.x, proj.y, TUNNEL_BOMB_TUNNEL_RADIUS);
              if (proj.drillPx >= TUNNEL_BOMB_MAX_DRILL_PX) {
                playSound("explosion");
                par[p].explosions.push({ x: proj.x, y: proj.y, radius: TUNNEL_BOMB_DRAW_RADIUS, startTime: timeMs });
                triggerShake(8);
                par[p].projectiles.splice(j, 1);
              }
            } else if (isOffScreen(proj, CANVAS_WIDTH, CANVAS_HEIGHT)) {
              playSound("miss");
              par[p].projectiles.splice(j, 1);
            }

          } else if (hitsCity(proj, world.city.ctx)) {
              playSound(proj.isSuperBomb ? "explosionSuper" : "explosion");
              const craterR    = proj.isSuperBomb ? SUPER_BOMB_CRATER_RADIUS : EXPLOSION_CRATER_RADIUS;
              const explosionR = proj.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS   : EXPLOSION_DRAW_RADIUS;
              carveCrater(world, proj.x, proj.y, craterR);
              par[p].explosions.push({ x: proj.x, y: proj.y, radius: explosionR, startTime: timeMs });
              triggerShake(proj.isSuperBomb ? 12 : 6);
              par[p].projectiles.splice(j, 1);

          } else if (isOffScreen(proj, CANVAS_WIDTH, CANVAS_HEIGHT)) {
            playSound("miss");
            par[p].projectiles.splice(j, 1);
          }
        }

        // Advance explosion animations
        for (let j = par[p].explosions.length - 1; j >= 0; j--) {
          if (timeMs - par[p].explosions[j].startTime >= EXPLOSION_DURATION_MS) {
            par[p].explosions.splice(j, 1);
          }
        }
      }

      // Transition out of parallel round when all projectiles and explosions are gone
      const parDone = par[0].projectiles.length === 0 && par[1].projectiles.length === 0 &&
                      par[0].explosions.length  === 0 && par[1].explosions.length  === 0;
      if (parallelRoundOver && parDone) {
        if (roundWinsByPlayer[roundWinner] >= MATCH_WIN_THRESHOLD) {
          matchWinner  = roundWinner;
          currentState = GameState.MATCH_END;
          playSound("matchWin");
        } else {
          roundEndBannerStartTime = timeMs;
          currentState = GameState.ROUND_END_BANNER;
        }
      }
    }

    // ── SEQUENTIAL RESOLVING ─────────────────────────────────────────────────
    if (currentState === GameState.RESOLVING) {
      // Re-enable aiming after reload cooldown expires
      if (seqReloadAt !== null && performance.now() >= seqReloadAt) {
        seqReloadAt        = null;
        seqAimingForReload = true;
        cyclePhase         = 'angle';
        cycleStartTime     = null;
        lockedAngle        = 0;
        setInputEnabled(true);
      }

      // Step all in-flight projectiles
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const proj = projectiles[j];
        const inBuildingSeq = proj.isTunnelBomb &&
          world.city.buildings.find(b => proj.x >= b.x && proj.x < b.x + b.width && proj.y >= b.y);
        const effectiveDtSeq = inBuildingSeq ? dt * TUNNEL_BOMB_DRILL_SPEED_FACTOR : dt;
        if (proj.frozen) {
          if (timeMs - proj.frozenAt >= FREEZE_BOMB_EXPAND_DURATION_MS) {
            paintFreezeBlock(world.city.ctx, Math.round(proj.x), Math.round(proj.y));
            projectiles.splice(j, 1);
          }
          continue;
        }
        stepProjectile(proj, world.wind, effectiveDtSeq);

        let hitCharIndex = -1;
        for (let i = 0; i < world.characters.length; i++) {
          if (i !== throwingPlayerIndex && hitsCharacter(proj, world.characters[i])) {
            hitCharIndex = i;
            break;
          }
        }

        if (hitCharIndex !== -1) {
          const damage = proj.isSuperBomb ? 2 : 1;
          hp[hitCharIndex] = Math.max(0, hp[hitCharIndex] - damage);
          playSound(proj.isSuperBomb ? "explosionSuper" : "explosion");
          playSound("playerHit");
          const hitChar   = world.characters[hitCharIndex];
          const bigRadius = proj.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS : EXPLOSION_BIG_DRAW_RADIUS;
          seqExplosions.push({ x: hitChar.x + hitChar.width / 2, y: hitChar.y + hitChar.height / 2, radius: bigRadius, startTime: timeMs });
          triggerShake(proj.isSuperBomb ? 20 : 12);
          if (hp[hitCharIndex] === 0) {
            roundWinsByPlayer[throwingPlayerIndex]++;
            playSound("roundWin");
            roundWinner = throwingPlayerIndex;
          }
          projectiles.splice(j, 1);

        } else if (proj.isTunnelBomb) {
          // Use building bounding boxes — not hitsCity — so drillPx accumulates
          // continuously even after pixels are carved away by the bomb itself.
          const overB = world.city.buildings.find(b => proj.x >= b.x && proj.x < b.x + b.width);
          if (overB && proj.y >= overB.y) {
            anyDrilling = true;
            proj.drillPx += Math.hypot(proj.vx, proj.vy) * effectiveDtSeq;
            if (hitsCity(proj, world.city.ctx)) carveCrater(world, proj.x, proj.y, TUNNEL_BOMB_TUNNEL_RADIUS);
            if (proj.drillPx >= TUNNEL_BOMB_MAX_DRILL_PX) {
              playSound("explosion");
              seqExplosions.push({ x: proj.x, y: proj.y, radius: TUNNEL_BOMB_DRAW_RADIUS, startTime: timeMs });
              triggerShake(8);
              projectiles.splice(j, 1);
            }
          } else if (isOffScreen(proj, CANVAS_WIDTH, CANVAS_HEIGHT)) {
            playSound("miss");
            projectiles.splice(j, 1);
          }

        } else if (hitsCity(proj, world.city.ctx)) {
            playSound(proj.isSuperBomb ? "explosionSuper" : "explosion");
            const craterR    = proj.isSuperBomb ? SUPER_BOMB_CRATER_RADIUS : EXPLOSION_CRATER_RADIUS;
            const explosionR = proj.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS   : EXPLOSION_DRAW_RADIUS;
            carveCrater(world, proj.x, proj.y, craterR);
            seqExplosions.push({ x: proj.x, y: proj.y, radius: explosionR, startTime: timeMs });
            triggerShake(proj.isSuperBomb ? 12 : 6);
            projectiles.splice(j, 1);

        } else if (isOffScreen(proj, CANVAS_WIDTH, CANVAS_HEIGHT)) {
          playSound("miss");
          projectiles.splice(j, 1);
        }
      }

      // Advance explosion animations
      for (let j = seqExplosions.length - 1; j >= 0; j--) {
        if (timeMs - seqExplosions[j].startTime >= EXPLOSION_DURATION_MS) {
          seqExplosions.splice(j, 1);
        }
      }

      // Transition out of RESOLVING when nothing is left in flight or animating
      if (projectiles.length === 0 && seqExplosions.length === 0 && armUpTimer === null) {
        seqReloadAt        = null;
        seqAimingForReload = false;
        if (roundWinner !== -1) {
          roundEndBannerStartTime = timeMs;
          currentState = GameState.ROUND_END_BANNER;
        } else {
          nextTurn();
        }
      }
    }

    // Start or stop the drill sound based on whether any tunnel bomb is grinding
    if (anyDrilling) startDrillSound(); else stopDrillSound();

    // ── ROUND_END_BANNER ─────────────────────────────────────────────────────
    if (currentState === GameState.ROUND_END_BANNER && roundEndBannerStartTime !== null) {
      if (timeMs - roundEndBannerStartTime >= ROUND_END_BANNER_DURATION_MS) {
        if (roundWinsByPlayer[roundWinner] >= MATCH_WIN_THRESHOLD) {
          matchWinner  = roundWinner;
          currentState = GameState.MATCH_END;
          playSound("matchWin");
        } else {
          startNextRound(1 - roundWinner);
        }
      }
    }

    // ── SEQUENTIAL aim cycling ───────────────────────────────────────────────
    if ((currentState === GameState.PLAYER_TURN || (currentState === GameState.RESOLVING && seqAimingForReload)) && !isArmUp && gameMode === GameMode.SEQUENTIAL) {
      if (cycleStartTime === null) {
        cycleStartTime = cyclePhase === 'angle'
          ? timeMs - (ANGLE_MAX / ANGLE_CYCLE_SPEED) * 500
          : timeMs;
      }
      const elapsed = timeMs - cycleStartTime;
      if (cyclePhase === 'angle') {
        setAim(triangleWave(elapsed, ANGLE_MAX, ANGLE_CYCLE_SPEED), AIM_LINE_MIN_VELOCITY);
      } else {
        setAim(lockedAngle, triangleWave(elapsed, VELOCITY_MAX, VELOCITY_CYCLE_SPEED));
      }
    }

    redraw(timeMs);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
