// characters.js
// Defines all selectable characters and their canvas draw functions.
// Every draw function is fully proportional — it scales to whatever
// width / height the caller passes, so the same code works for the
// tiny in-game sprite (28 × 32) and the large selection-screen preview.

export const CHARACTERS = [
  { id: 'robot',    name: 'Robot'    },
  { id: 'wizard',   name: 'Wizard'   },
  { id: 'alien',    name: 'Alien'    },
  { id: 'ninja',    name: 'Ninja'    },
  { id: 'viking',   name: 'Viking'   },
  { id: 'skeleton', name: 'Skeleton' },
];

// Dispatch to the right draw function based on character.charType index.
// Defaults to Robot (index 0) if charType is unset.
export function drawCharacterByType(ctx, character, pose = 'idle') {
  const fn = DRAW_FNS[character.charType ?? 0] ?? DRAW_FNS[0];
  fn(ctx, character, pose);
}

// ─── Robot ──────────────────────────────────────────────────────────────────
// Square-headed, single glowing eye, chest panel, antenna.
function drawRobot(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx     = x + w / 2;
  const metal  = '#8899bb';
  const eyeCol = '#00ddff';
  const lw     = n => Math.max(1, n);

  ctx.save();

  // Antenna stem + tip
  ctx.strokeStyle = metal;
  ctx.lineWidth   = lw(w * 0.08);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.13);
  ctx.lineTo(cx, y + h * 0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y, w * 0.07, 0, Math.PI * 2);
  ctx.fillStyle   = eyeCol;
  ctx.fill();

  // Square head
  const headW = w * 0.72, headH = h * 0.30;
  const headX = cx - headW / 2, headY = y + h * 0.10;
  ctx.fillStyle   = metal;
  ctx.fillRect(headX, headY, headW, headH);

  // Cyclops eye (glowing)
  ctx.beginPath();
  ctx.arc(cx, headY + headH * 0.52, w * 0.14, 0, Math.PI * 2);
  ctx.fillStyle   = eyeCol;
  ctx.fill();

  // Body
  const bodyW = w * 0.82, bodyH = h * 0.40;
  const bodyX = cx - bodyW / 2, bodyY = headY + headH + h * 0.02;
  ctx.fillStyle   = metal;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Chest panel detail
  ctx.strokeStyle = '#445566';
  ctx.lineWidth   = lw(w * 0.05);
  ctx.strokeRect(bodyX + bodyW * 0.20, bodyY + bodyH * 0.18, bodyW * 0.60, bodyH * 0.40);

  // Arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    ctx.strokeStyle = metal;
    ctx.lineWidth   = lw(w * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx + side * bodyW * 0.50, bodyY + bodyH * 0.15);
    ctx.lineTo(cx + side * bodyW * 0.70, bodyY - h * 0.16);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Wizard ─────────────────────────────────────────────────────────────────
// Tall pointy hat, skin face, white beard, tapered purple robe.
function drawWizard(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx        = x + w / 2;
  const hatCol    = '#5511aa';
  const robeCol   = '#7722cc';
  const skinCol   = '#f5d9a8';
  const beardCol  = '#ddddee';
  const starCol   = '#ffdd00';
  const lw        = n => Math.max(1, n);

  ctx.save();

  // Pointy hat
  const hatBase = y + h * 0.28;
  ctx.fillStyle   = hatCol;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx - w * 0.40, hatBase);
  ctx.lineTo(cx + w * 0.40, hatBase);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - w * 0.48, hatBase - h * 0.025, w * 0.96, h * 0.055); // brim

  // Star on hat
  ctx.fillStyle   = starCol;
  ctx.beginPath();
  ctx.arc(cx + w * 0.05, y + h * 0.12, w * 0.065, 0, Math.PI * 2);
  ctx.fill();

  // Face
  const headR  = w * 0.26;
  const headCY = hatBase + headR * 0.85;
  ctx.fillStyle = skinCol;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eo = (facingRight ? 1 : -1) * w * 0.06;
  ctx.fillStyle = '#333333';
  ctx.beginPath(); ctx.arc(cx + eo - w * 0.06, headCY - headR * 0.10, headR * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eo + w * 0.07, headCY - headR * 0.10, headR * 0.16, 0, Math.PI * 2); ctx.fill();

  // Beard
  ctx.fillStyle = beardCol;
  ctx.beginPath();
  ctx.ellipse(cx, headCY + headR * 0.68, headR * 0.62, headR * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  // Robe (tapered trapezoid)
  const robeTop = headCY + headR * 0.80;
  ctx.fillStyle   = robeCol;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.28, robeTop);
  ctx.lineTo(cx + w * 0.28, robeTop);
  ctx.lineTo(cx + w * 0.46, y + h);
  ctx.lineTo(cx - w * 0.46, y + h);
  ctx.closePath();
  ctx.fill();

  // Staff in arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    const sx = cx + side * w * 0.48;
    ctx.strokeStyle = '#aa8833';
    ctx.lineWidth   = lw(w * 0.10);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, robeTop + h * 0.08);
    ctx.lineTo(sx + side * w * 0.16, robeTop - h * 0.22);
    ctx.stroke();
    ctx.fillStyle   = starCol;
    ctx.beginPath();
    ctx.arc(sx + side * w * 0.18, robeTop - h * 0.26, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Alien ──────────────────────────────────────────────────────────────────
// Huge oval head, enormous dark eyes with white glint, tiny body.
function drawAlien(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx   = x + w / 2;
  const skin = '#44cc66';

  ctx.save();

  // Large oval head
  const headCY = y + h * 0.28;
  ctx.fillStyle   = skin;
  ctx.beginPath();
  ctx.ellipse(cx, headCY, w * 0.40, h * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big eyes
  const eo  = w * 0.15;
  const eR  = w * 0.14;
  const eRy = eR * 1.35;
  const eyY = headCY - h * 0.04;
  ctx.fillStyle = '#050518';
  ctx.beginPath(); ctx.ellipse(cx - eo, eyY, eR, eRy, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + eo, eyY, eR, eRy, 0, 0, Math.PI * 2); ctx.fill();
  // glints
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.arc(cx - eo - eR * 0.30, eyY - eRy * 0.28, eR * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eo - eR * 0.30, eyY - eRy * 0.28, eR * 0.28, 0, Math.PI * 2); ctx.fill();

  // Small oval body
  const bodyTop = headCY + h * 0.28;
  ctx.fillStyle   = skin;
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop + h * 0.14, w * 0.26, h * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    ctx.strokeStyle = skin;
    ctx.lineWidth   = Math.max(1, w * 0.12);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.28, bodyTop + h * 0.06);
    ctx.lineTo(cx + side * w * 0.46, bodyTop - h * 0.12);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Ninja ──────────────────────────────────────────────────────────────────
// All-black wrapped head, red headband, glowing red eye slit, dark body.
function drawNinja(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx      = x + w / 2;
  const dark    = '#111122';
  const bandCol = '#cc2222';
  const slitCol = '#ff5555';

  ctx.save();

  // Wrapped head (dark circle)
  const headR  = w * 0.30;
  const headCY = y + h * 0.18;
  ctx.fillStyle   = dark;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Red headband
  ctx.fillStyle = bandCol;
  ctx.fillRect(cx - headR, headCY - headR * 0.18, headR * 2, headR * 0.36);
  // Re-clip to circle by overdrawing outside arcs (simplified: just overdraw top/bottom)
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(cx, headCY, headR, Math.PI, 0); ctx.fill();         // upper half
  ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI); ctx.fill();         // lower half
  // Redraw band strip (now it sits cleanly on top within the circle region)
  ctx.fillStyle = bandCol;
  ctx.fillRect(cx - headR, headCY - headR * 0.16, headR * 2, headR * 0.32);

  // Glowing eye slit
  ctx.fillStyle   = slitCol;
  ctx.fillRect(cx - headR * 0.65, headCY - headR * 0.10, headR * 1.30, headR * 0.22);

  // Body
  const bodyTop = headCY + headR * 0.85;
  ctx.fillStyle   = dark;
  ctx.fillRect(cx - w * 0.32, bodyTop, w * 0.64, h * 0.44);

  // Belt / sash line
  ctx.strokeStyle = bandCol;
  ctx.lineWidth   = Math.max(1, h * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.32, bodyTop + h * 0.20);
  ctx.lineTo(cx + w * 0.32, bodyTop + h * 0.20);
  ctx.stroke();

  // Arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    ctx.strokeStyle = dark;
    ctx.lineWidth   = Math.max(2, w * 0.18);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.32, bodyTop + h * 0.08);
    ctx.lineTo(cx + side * w * 0.52, bodyTop - h * 0.16);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Viking ─────────────────────────────────────────────────────────────────
// Silver horned helmet, skin face, big orange beard, broad body.
function drawViking(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx         = x + w / 2;
  const helmetCol  = '#aabbcc';
  const skinCol    = '#f5c89a';
  const beardCol   = '#dd7733';
  const bodyCol    = '#8b5e3c';

  ctx.save();

  // Horns
  ctx.fillStyle   = helmetCol;
  [[cx - w * 0.28, cx - w * 0.48, cx - w * 0.16],
   [cx + w * 0.28, cx + w * 0.48, cx + w * 0.16]].forEach(([bx, tx, ix]) => {
    ctx.beginPath();
    ctx.moveTo(bx, y + h * 0.14);
    ctx.lineTo(tx, y - h * 0.04);
    ctx.lineTo(ix, y + h * 0.20);
    ctx.closePath();
    ctx.fill();
  });

  // Helmet dome
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.20, w * 0.34, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(cx - w * 0.36, y + h * 0.20, w * 0.72, h * 0.07); // rim

  // Face (lower half-circle peek under helmet)
  const headCY = y + h * 0.31;
  const headR  = w * 0.27;
  ctx.fillStyle = skinCol;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI);
  ctx.fill();

  // Eyes
  const ed = (facingRight ? 1 : -1) * headR * 0.35;
  ctx.fillStyle = '#441100';
  ctx.beginPath(); ctx.arc(cx - ed, headCY - headR * 0.14, headR * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + ed, headCY - headR * 0.14, headR * 0.16, 0, Math.PI * 2); ctx.fill();

  // Beard
  ctx.fillStyle   = beardCol;
  ctx.beginPath();
  ctx.ellipse(cx, headCY + headR * 0.65, headR * 0.70, headR * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyTop = headCY + headR * 0.50;
  ctx.fillStyle   = bodyCol;
  ctx.fillRect(cx - w * 0.40, bodyTop, w * 0.80, h * 0.42);

  // Arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth   = Math.max(2, w * 0.22);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.40, bodyTop + h * 0.10);
    ctx.lineTo(cx + side * w * 0.58, bodyTop - h * 0.14);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
// Bone-white skull, hollow eye sockets, nose gap, ribcage lines on body.
function drawSkeleton(ctx, { x, y, width: w, height: h, facingRight }, pose) {
  const cx      = x + w / 2;
  const bone    = '#d4cba8';
  const hollow  = '#0d0820';

  ctx.save();

  // Skull
  const skullR  = w * 0.30;
  const skullCY = y + h * 0.22;
  ctx.fillStyle   = bone;
  ctx.beginPath();
  ctx.arc(cx, skullCY, skullR, 0, Math.PI * 2);
  ctx.fill();

  // Jaw bump
  ctx.beginPath();
  ctx.arc(cx, skullCY + skullR * 0.56, skullR * 0.62, 0, Math.PI);
  ctx.fill();

  // Teeth gaps (two dark rectangles on jaw)
  ctx.fillStyle = hollow;
  ctx.fillRect(cx - skullR * 0.46, skullCY + skullR * 0.72, skullR * 0.36, skullR * 0.32);
  ctx.fillRect(cx + skullR * 0.10, skullCY + skullR * 0.72, skullR * 0.36, skullR * 0.32);

  // Hollow eye sockets
  const eo = (facingRight ? 1 : -1) * w * 0.04;
  ctx.fillStyle = hollow;
  ctx.beginPath(); ctx.ellipse(cx + eo - w * 0.09, skullCY - skullR * 0.06, skullR * 0.24, skullR * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + eo + w * 0.10, skullCY - skullR * 0.06, skullR * 0.24, skullR * 0.28, 0, 0, Math.PI * 2); ctx.fill();

  // Nose triangle
  ctx.beginPath();
  ctx.moveTo(cx + eo + w * 0.015, skullCY + skullR * 0.14);
  ctx.lineTo(cx + eo - w * 0.040, skullCY + skullR * 0.36);
  ctx.lineTo(cx + eo + w * 0.070, skullCY + skullR * 0.36);
  ctx.closePath();
  ctx.fill();

  // Body
  const bodyTop = skullCY + skullR * 1.10;
  const bodyW   = w * 0.58, bodyH = h * 0.42;
  ctx.fillStyle   = bone;
  ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);

  // Rib lines
  ctx.strokeStyle = hollow;
  ctx.lineWidth   = Math.max(1, w * 0.065);
  for (let i = 0; i < 3; i++) {
    const ry = bodyTop + bodyH * (0.18 + i * 0.26);
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.42, ry);
    ctx.lineTo(cx + bodyW * 0.42, ry);
    ctx.stroke();
  }

  // Arm-up pose
  if (pose === 'armUp') {
    const side = facingRight ? 1 : -1;
    ctx.strokeStyle = bone;
    ctx.lineWidth   = Math.max(1.5, w * 0.16);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * bodyW * 0.50, bodyTop + bodyH * 0.10);
    ctx.lineTo(cx + side * (bodyW * 0.50 + w * 0.22), bodyTop - h * 0.14);
    ctx.stroke();
  }

  ctx.restore();
}

// Map index → draw function, matching the CHARACTERS array order.
const DRAW_FNS = [drawRobot, drawWizard, drawAlien, drawNinja, drawViking, drawSkeleton];
