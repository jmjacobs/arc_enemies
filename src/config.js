// config.js
// This is the one place where all the numbers and settings for the game live.
// If you want to change the canvas size, a colour, or later the speed of a
// banana — you change it here, not somewhere buried in the code.
// Think of it like the settings menu for the whole game.

// How big the game canvas is, in pixels.
export const CANVAS_WIDTH  = 1280;
export const CANVAS_HEIGHT = 720;

// The y position (in pixels from the top) where building bases sit.
export const GROUND_Y = CANVAS_HEIGHT;

// How many buildings to put in the city each time we generate it.
export const BUILDING_COUNT_MIN = 8;
export const BUILDING_COUNT_MAX = 12;

// How short or tall buildings can be, in pixels.
export const BUILDING_MIN_HEIGHT = 80;
export const BUILDING_MAX_HEIGHT = 380;

// The three building colours — CGA-ish but slightly softened.
export const BUILDING_PALETTE = ["#8b3a3a", "#2a7a7a", "#5a5a6a"];

// Window size and spacing on buildings.
export const WINDOW_WIDTH       = 6;
export const WINDOW_HEIGHT      = 8;
export const WINDOW_GAP_X       = 7;
export const WINDOW_GAP_Y       = 9;
export const WINDOW_MARGIN      = 8;

export const WINDOW_LIT_COLOR        = "#ffe066";
export const WINDOW_DARK_COLOR       = "#1e1e2a";
export const WINDOW_LIT_PROBABILITY  = 0.35;

// How big the placeholder character sprites are, in pixels.
export const CHARACTER_WIDTH  = 28;
export const CHARACTER_HEIGHT = 32;

// One colour per player — easy to tell apart at a glance.
export const CHARACTER_COLORS = {
  player1: "#ff8c42", // warm orange  (left side)
  player2: "#42c5ff", // bright blue  (right side)
};

// The names shown in the HUD. Phase 7 will replace these with chosen characters.
export const PLAYER_NAMES = ["Player 1", "Player 2"];

// Wind strength. Negative = blowing left, positive = blowing right.
export const WIND_MIN = -10;
export const WIND_MAX =  10;

// The bar at the very top of the canvas that shows the wind arrow.
export const WIND_BAR_HEIGHT       = 30;
export const WIND_ARROW_MAX_LENGTH = 200;

export const WIND_BAR_BG      = "#111122";
export const WIND_ARROW_COLOR = "#ffffff";
export const WIND_TEXT_COLOR  = "#aaaacc";

// The little triangle that floats above whoever's turn it is.
export const ACTIVE_INDICATOR_COLOR         = "#ffffff";
export const ACTIVE_INDICATOR_BOUNCE_PIXELS = 4;
export const ACTIVE_INDICATOR_SIZE          = 8;

// Angle and velocity inputs — min, max, and sensible defaults.
export const ANGLE_MIN     = 0;
export const ANGLE_MAX     = 90;
export const ANGLE_DEFAULT = 45;

export const VELOCITY_MIN     = 0;
export const VELOCITY_MAX     = 100;
export const VELOCITY_DEFAULT = 50;

// Physics — how the projectile moves through the air.
// Gravity pulls it down; wind pushes it sideways; VELOCITY_SCALE converts
// the player's input number into actual pixels-per-second speed.
export const GRAVITY          = 400;  // pixels per second², pulling downward
export const VELOCITY_SCALE   = 6;    // input 100 → 600 px/s launch speed
export const WIND_ACCEL_SCALE = 4;    // wind 10 → 40 px/s² sideways push

// The projectile (placeholder banana shape for now).
export const PROJECTILE_RADIUS           = 6;
export const PROJECTILE_COLOR            = "#ffd84d";       // warm yellow
export const PROJECTILE_SPIN_RATE        = 12;              // radians per second
export const PROJECTILE_TRAIL_MAX_POINTS = 40;
export const PROJECTILE_TRAIL_COLOR_RGBA = "rgba(255, 216, 77, 0.35)";

// Where the projectile is born — offset from the character's centre.
export const LAUNCH_OFFSET_X = 18;   // pixels toward the throwing side
export const LAUNCH_OFFSET_Y = -12;  // pixels above the character centre (the raised hand)

// How long the character holds their arm up before the throw actually launches.
export const ARM_UP_DURATION_MS = 250;

// Cap on how much time can pass in one frame, so a paused/backgrounded tab
// doesn't cause a giant physics jump when the player comes back.
export const MAX_FRAME_DT = 0.05; // seconds

// Arrow-key aiming — how much each press changes angle or velocity.
export const ANGLE_STEP           = 1;   // degrees per press
export const VELOCITY_STEP        = 1;   // units per press
export const FAST_STEP_MULTIPLIER = 5;   // Shift + arrow = ×5

// How the custom key-repeat feels. The browser's built-in repeat has
// an awkward initial pause that makes it feel sluggish for a game.
// We roll our own with these timings instead.
export const KEY_REPEAT_INITIAL_DELAY_MS = 350; // pause before repeat starts
export const KEY_REPEAT_INTERVAL_MS      =  55; // delay between each repeated step

// The aim line drawn from the active character toward the throw direction.
export const AIM_LINE_LENGTH_SCALE  = 1.5;  // at velocity 100, the line is 150px
export const AIM_LINE_DOT_COUNT     = 12;
export const AIM_LINE_DOT_RADIUS    = 2.5;
export const AIM_LINE_COLOR_RGBA    = "rgba(255, 255, 255, 0.55)";

// Hint text shown under the HUD during a player's turn.
export const HINT_TEXT  = "↑↓ angle   ←→ power   SHIFT for ×5   SPACE to throw";
export const HINT_COLOR = "#888888";

// Explosion animation — sizes, timing, and colours.
export const EXPLOSION_CRATER_RADIUS   = 24;   // how big the hole in the building is
export const EXPLOSION_DRAW_RADIUS     = 38;   // how big the visible flash is (building hit)
export const EXPLOSION_BIG_DRAW_RADIUS = 64;   // how big the flash is when a character is hit
export const EXPLOSION_DURATION_MS     = 450;  // how long before the explosion fades out
// Colours run from the bright centre to the dark edge — like a real fireball.
export const EXPLOSION_COLORS = ["#fff8c0", "#ffd84d", "#ff8c42", "#c94d2c"];

// Extra pixels of padding added around a character's hit box.
// Slightly bigger = more "near-miss" forgiveness for younger players.
export const CHARACTER_HIT_PADDING = 10;

// When sampling a pixel from the city canvas, alpha above this value means "solid building".
export const BUILDING_HIT_ALPHA_THRESHOLD = 200;

// How many round wins it takes to claim the whole match.
// Change this to 1 or 2 for shorter matches, 5 for longer ones.
export const MATCH_WIN_THRESHOLD = 3;

// How long the round-win banner stays on screen before the next round starts.
// Lower it if the kids are impatient; raise it if they want time to high-five.
export const ROUND_END_BANNER_DURATION_MS = 2200;

// The banner that pops up when someone wins a round or the whole match.
export const BANNER_BG_RGBA        = "rgba(0, 0, 0, 0.65)";
export const BANNER_HEIGHT         = 160;
export const BANNER_TITLE_FONT     = 'bold 44px "Courier New", monospace';
export const BANNER_SUBTITLE_FONT  = '24px "Courier New", monospace';
export const BANNER_TITLE_COLOR    = "#ffffff";
export const BANNER_SUBTITLE_COLOR = "#dddddd";

// The round-win scoreboard shown inside the wind bar.
export const SCOREBOARD_FONT     = 'bold 22px "Courier New", monospace';
export const SCOREBOARD_MARGIN_X = 16;

// All the colours used in the game.
export const COLORS = {
  sky:    "#0d0d1a",
  title:  "#ffffff",
  border: "#ffffff",
};

// GameState lists every possible screen or phase the game can be in.
// TITLE             = the title screen (wired up in a later phase)
// PLAYER_TURN       = a player is choosing their angle and velocity
// RESOLVING         = a throw is in the air
// EXPLODING         = explosion animation is playing
// ROUND_END_BANNER  = round-win banner is showing before the next round
// MATCH_END         = one player has won the whole match; freeze until R
export const GameState = Object.freeze({
  TITLE:            "TITLE",
  PLAYER_TURN:      "PLAYER_TURN",
  RESOLVING:        "RESOLVING",
  EXPLODING:        "EXPLODING",
  ROUND_END_BANNER: "ROUND_END_BANNER",
  MATCH_END:        "MATCH_END",
});
