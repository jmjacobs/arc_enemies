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
} from "./config.js";
import { generateWorld, carveCrater } from "./world.js";
import { getLaunchPoint, launchVelocity, stepProjectile, isOffScreen, hitsCity, hitsCharacter } from "./physics.js";
import { drawScene, drawCharacterSelect, SB_BTN_W, SB_BTN_H, SB_BTN_Y } from "./render.js";
import { setupInput, setAim, getAim, setInputEnabled, setActivePlayer } from "./input.js";
import { CHARACTERS } from "./characters.js";
import { playSound } from "./sound.js";

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
  let gameModeIndex   = 1;   // 0 = SEQUENTIAL, 1 = PARALLEL

  let activePlayerIndex       = 0;
  let roundWinner             = -1;
  let roundWinsByPlayer       = [0, 0];
  let matchWinner             = null;
  let roundEndBannerStartTime = null;
  let superBombAvailable      = [true, true];

  // ── Sequential-only state ───────────────────────────────────────────────────
  let throwingPlayerIndex = 0;
  let projectile          = null;
  let isArmUp             = false;
  let armUpTimer          = null;
  let explosion           = null;
  let superBombArmed      = false;
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
    projectile:     null,
    explosion:      null,
    superBombArmed: false,
    canFire:        true,
  });
  let par               = [parInit(), parInit()];
  let parallelRoundOver = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function triangleWave(elapsedMs, maxValue, speed) {
    const periodMs   = (2 * maxValue / speed) * 1000;
    const t          = elapsedMs % periodMs;
    const normalized = t / periodMs;
    return maxValue * (normalized < 0.5 ? normalized * 2 : (1 - normalized) * 2);
  }

  function buildWorld() {
    world = generateWorld();
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
        projectiles: [par[0].projectile, par[1].projectile],
        explosions:  [par[0].explosion,  par[1].explosion],
        aims:        [par[0].aim,        par[1].aim],
        isArmUp:     [par[0].isArmUp,   par[1].isArmUp],
        showAimLine: [
          par[0].canFire && !par[0].isArmUp && par[0].projectile === null && !parallelRoundOver,
          par[1].canFire && !par[1].isArmUp && par[1].projectile === null && !parallelRoundOver,
        ],
        canFire: [par[0].canFire, par[1].canFire],
      };
      drawScene(ctx, world, activePlayerIndex, timeMs, {
        roundWinsByPlayer,
        roundBannerWinner: currentState === GameState.ROUND_END_BANNER ? roundWinner        : -1,
        matchBannerWinner: currentState === GameState.MATCH_END        ? (matchWinner ?? -1) : -1,
        superBombAvailable,
        superBombArmed:    [par[0].superBombArmed, par[1].superBombArmed],
        playerNames,
        parallelData,
      });
      return;
    }

    const isPlayerTurn = currentState === GameState.PLAYER_TURN && !isArmUp;
    drawScene(ctx, world, activePlayerIndex, timeMs, {
      projectile,
      throwingPlayerIndex,
      isArmUp,
      aim:               getAim(),
      showAimLine:       isPlayerTurn,
      showHint:          isPlayerTurn,
      explosion,
      roundWinsByPlayer,
      roundBannerWinner: currentState === GameState.ROUND_END_BANNER ? roundWinner        : -1,
      matchBannerWinner: currentState === GameState.MATCH_END        ? (matchWinner ?? -1) : -1,
      superBombAvailable,
      superBombArmed,
      playerNames,
    });
  }

  // ── Sequential functions ────────────────────────────────────────────────────
  function handleThrow({ angle, velocity }) {
    const isSuperBomb = superBombArmed;
    playSound(isSuperBomb ? "throwSuper" : "throw");
    superBombArmed = false;
    if (isSuperBomb) superBombAvailable[activePlayerIndex] = false;

    setInputEnabled(false);
    currentState        = GameState.RESOLVING;
    throwingPlayerIndex = activePlayerIndex;
    isArmUp             = true;

    armUpTimer = setTimeout(() => {
      armUpTimer = null;
      isArmUp    = false;
      const character = world.characters[throwingPlayerIndex];
      const facing    = character.facingRight ? 1 : -1;
      const { x: launchX, y: launchY } = getLaunchPoint(character);
      const { vx, vy } = launchVelocity(angle, velocity, facing);
      projectile = { x: launchX, y: launchY, vx, vy, spin: 0, trail: [], framesAlive: 0, isSuperBomb };
    }, ARM_UP_DURATION_MS);
  }

  function nextTurn() {
    superBombArmed    = false;
    cyclePhase        = 'angle';
    cycleStartTime    = null;
    lockedAngle       = 0;
    activePlayerIndex = activePlayerIndex === 0 ? 1 : 0;
    currentState      = GameState.PLAYER_TURN;
    setInputEnabled(true);
    setActivePlayer(activePlayerIndex);
  }

  function handleSpacePress() {
    if (currentState !== GameState.PLAYER_TURN || isArmUp) return;
    if (gameMode === GameMode.PARALLEL) return;
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
    for (let p = 0; p < 2; p++) {
      if (par[p].armUpTimer !== null) clearTimeout(par[p].armUpTimer);
      par[p] = parInit();
    }
    parallelRoundOver = false;
  }

  function fireParallelProjectile(p, angle, velocity) {
    const isSuperBomb = par[p].superBombArmed;
    par[p].superBombArmed = false;
    if (isSuperBomb) superBombAvailable[p] = false;

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
      par[p].projectile = { x: launchX, y: launchY, vx, vy, spin: 0, trail: [], framesAlive: 0, isSuperBomb };
    }, ARM_UP_DURATION_MS);
  }

  function handleParallelShift(p) {
    if (currentState !== GameState.PLAYER_TURN || parallelRoundOver) return;
    if (!par[p].canFire || par[p].isArmUp || par[p].projectile !== null) return;

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
    if (charSelectPhase < 1) {
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
    gameMode = gameModeIndex === 0 ? GameMode.SEQUENTIAL : GameMode.PARALLEL;
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
    buildWorld();
    activePlayerIndex       = loserIndex;
    roundWinner             = -1;
    roundEndBannerStartTime = null;
    superBombAvailable      = [true, true];

    if (gameMode === GameMode.PARALLEL) {
      resetParallelState();
      currentState = GameState.PLAYER_TURN;
    } else {
      superBombArmed = false;
      cyclePhase     = 'angle';
      cycleStartTime = null;
      lockedAngle    = 0;
      setInputEnabled(true);
      setActivePlayer(loserIndex);
      currentState = GameState.PLAYER_TURN;
    }
  }

  function resetMatch() {
    if (armUpTimer !== null) { clearTimeout(armUpTimer); armUpTimer = null; }
    resetParallelState();

    projectile              = null;
    isArmUp                 = false;
    explosion               = null;
    roundWinner             = -1;
    roundWinsByPlayer       = [0, 0];
    matchWinner             = null;
    roundEndBannerStartTime = null;
    superBombAvailable      = [true, true];
    superBombArmed          = false;
    cyclePhase              = 'angle';
    cycleStartTime          = null;
    lockedAngle             = 0;
    world                   = null;
    activePlayerIndex       = 0;
    charSelectPhase         = 0;
    gameModeIndex           = 0;
    playerNames             = ["Player 1", "Player 2"];
    charNameInput           = "";
    currentState            = GameState.CHARACTER_SELECT;

    setInputEnabled(false);
    setActivePlayer(0);
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  setupInput({ onSpacePress: handleSpacePress });

  window.addEventListener("keydown", (event) => {
    if (currentState === GameState.CHARACTER_SELECT) {
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
                 superBombAvailable[0] && par[0].canFire && !par[0].isArmUp && par[0].projectile === null) {
        par[0].superBombArmed = !par[0].superBombArmed;
        playSound(par[0].superBombArmed ? "superBombArm" : "superBombDisarm");
        redraw();
      } else if ((event.key === "l" || event.key === "L") &&
                 currentState === GameState.PLAYER_TURN && !parallelRoundOver &&
                 superBombAvailable[1] && par[1].canFire && !par[1].isArmUp && par[1].projectile === null) {
        par[1].superBombArmed = !par[1].superBombArmed;
        playSound(par[1].superBombArmed ? "superBombArm" : "superBombDisarm");
        redraw();
      }
      return;
    }

    if ((event.key === "s" || event.key === "S") &&
        currentState === GameState.PLAYER_TURN && !isArmUp &&
        superBombAvailable[activePlayerIndex]) {
      superBombArmed = !superBombArmed;
      playSound(superBombArmed ? "superBombArm" : "superBombDisarm");
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

    // Character select screen
    if (currentState === GameState.CHARACTER_SELECT && charSelectPhase < 2) {
      event.preventDefault();
      handleCharSelectPointer(cx, cy);
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
            if (!parallelRoundOver && superBombAvailable[0] && par[0].canFire && !par[0].isArmUp && par[0].projectile === null) {
              par[0].superBombArmed = !par[0].superBombArmed;
              playSound(par[0].superBombArmed ? "superBombArm" : "superBombDisarm");
              redraw();
            }
          } else if (activePlayerIndex === 0 && superBombAvailable[0] && !isArmUp) {
            superBombArmed = !superBombArmed;
            playSound(superBombArmed ? "superBombArm" : "superBombDisarm");
            redraw();
          }
          return;
        }

        if (cx >= p2BtnX && cx <= p2BtnX + SB_BTN_W) {
          if (gameMode === GameMode.PARALLEL) {
            if (!parallelRoundOver && superBombAvailable[1] && par[1].canFire && !par[1].isArmUp && par[1].projectile === null) {
              par[1].superBombArmed = !par[1].superBombArmed;
              playSound(par[1].superBombArmed ? "superBombArm" : "superBombDisarm");
              redraw();
            }
          } else if (activePlayerIndex === 1 && superBombAvailable[1] && !isArmUp) {
            superBombArmed = !superBombArmed;
            playSound(superBombArmed ? "superBombArm" : "superBombDisarm");
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

    // ── PARALLEL PLAYER_TURN ─────────────────────────────────────────────────
    if (currentState === GameState.PLAYER_TURN && gameMode === GameMode.PARALLEL) {
      for (let p = 0; p < 2; p++) {
        // Advance aim cycle for players who can still fire
        if (par[p].canFire && !par[p].isArmUp && par[p].projectile === null && !parallelRoundOver) {
          if (par[p].cycleStartTime === null) par[p].cycleStartTime = timeMs;
          const elapsed = timeMs - par[p].cycleStartTime;
          if (par[p].cyclePhase === 'angle') {
            par[p].aim = { angle: triangleWave(elapsed, ANGLE_MAX, ANGLE_CYCLE_SPEED), velocity: AIM_LINE_MIN_VELOCITY };
          } else {
            par[p].aim = { angle: par[p].lockedAngle, velocity: triangleWave(elapsed, VELOCITY_MAX, VELOCITY_CYCLE_SPEED) };
          }
        }

        // Step projectile
        if (par[p].projectile !== null) {
          stepProjectile(par[p].projectile, world.wind, dt);
          const enemy = 1 - p;

          if (hitsCharacter(par[p].projectile, world.characters[enemy])) {
            roundWinsByPlayer[p]++;
            playSound(par[p].projectile.isSuperBomb ? "explosionSuper" : "explosion");
            playSound("roundWin");
            const hitChar = world.characters[enemy];
            const bigR    = par[p].projectile.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS : EXPLOSION_BIG_DRAW_RADIUS;
            par[p].explosion  = { x: hitChar.x + hitChar.width / 2, y: hitChar.y + hitChar.height / 2, radius: bigR, startTime: timeMs };
            par[p].projectile = null;
            if (par[enemy].projectile !== null) par[enemy].projectile = null;
            roundWinner       = p;
            parallelRoundOver = true;

          } else if (hitsCity(par[p].projectile, world.city.ctx)) {
            playSound(par[p].projectile.isSuperBomb ? "explosionSuper" : "explosion");
            const craterR    = par[p].projectile.isSuperBomb ? SUPER_BOMB_CRATER_RADIUS : EXPLOSION_CRATER_RADIUS;
            const explosionR = par[p].projectile.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS   : EXPLOSION_DRAW_RADIUS;
            carveCrater(world, par[p].projectile.x, par[p].projectile.y, craterR);
            par[p].explosion      = { x: par[p].projectile.x, y: par[p].projectile.y, radius: explosionR, startTime: timeMs };
            par[p].projectile     = null;
            par[p].canFire        = true;
            par[p].cyclePhase     = 'angle';
            par[p].cycleStartTime = null;
            par[p].lockedAngle    = 0;

          } else if (isOffScreen(par[p].projectile, CANVAS_WIDTH, CANVAS_HEIGHT)) {
            playSound("miss");
            par[p].projectile     = null;
            par[p].canFire        = true;
            par[p].cyclePhase     = 'angle';
            par[p].cycleStartTime = null;
            par[p].lockedAngle    = 0;
          }
        }

        // Advance explosion
        if (par[p].explosion !== null && timeMs - par[p].explosion.startTime >= EXPLOSION_DURATION_MS) {
          par[p].explosion = null;
        }
      }

      // Transition out of parallel round when all explosions are gone
      if (parallelRoundOver && par[0].explosion === null && par[1].explosion === null) {
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
    if (currentState === GameState.RESOLVING && projectile !== null) {
      stepProjectile(projectile, world.wind, dt);

      let hitCharIndex = -1;
      for (let i = 0; i < world.characters.length; i++) {
        if (i !== throwingPlayerIndex && hitsCharacter(projectile, world.characters[i])) {
          hitCharIndex = i;
          break;
        }
      }

      if (hitCharIndex !== -1) {
        const winnerIndex = throwingPlayerIndex;
        roundWinsByPlayer[winnerIndex]++;
        playSound(projectile.isSuperBomb ? "explosionSuper" : "explosion");
        playSound("roundWin");
        const hitChar   = world.characters[hitCharIndex];
        const bigRadius = projectile.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS : EXPLOSION_BIG_DRAW_RADIUS;
        explosion    = { x: hitChar.x + hitChar.width / 2, y: hitChar.y + hitChar.height / 2, radius: bigRadius, startTime: timeMs };
        roundWinner  = winnerIndex;
        projectile   = null;
        currentState = GameState.EXPLODING;

      } else if (hitsCity(projectile, world.city.ctx)) {
        playSound(projectile.isSuperBomb ? "explosionSuper" : "explosion");
        const craterR    = projectile.isSuperBomb ? SUPER_BOMB_CRATER_RADIUS : EXPLOSION_CRATER_RADIUS;
        const explosionR = projectile.isSuperBomb ? SUPER_BOMB_DRAW_RADIUS   : EXPLOSION_DRAW_RADIUS;
        carveCrater(world, projectile.x, projectile.y, craterR);
        explosion    = { x: projectile.x, y: projectile.y, radius: explosionR, startTime: timeMs };
        projectile   = null;
        currentState = GameState.EXPLODING;

      } else if (isOffScreen(projectile, CANVAS_WIDTH, CANVAS_HEIGHT)) {
        playSound("miss");
        projectile = null;
        nextTurn();
      }
    }

    // ── SEQUENTIAL EXPLODING ─────────────────────────────────────────────────
    if (currentState === GameState.EXPLODING && explosion !== null) {
      if (timeMs - explosion.startTime >= EXPLOSION_DURATION_MS) {
        explosion = null;
        if (roundWinner !== -1) {
          roundEndBannerStartTime = timeMs;
          currentState = GameState.ROUND_END_BANNER;
        } else {
          nextTurn();
        }
      }
    }

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
    if (currentState === GameState.PLAYER_TURN && !isArmUp && gameMode === GameMode.SEQUENTIAL) {
      if (cycleStartTime === null) cycleStartTime = timeMs;
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
