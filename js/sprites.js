/* Sprites pixel art et carte du terrain — dessinés à la main, aucun fichier image. */

const PAL = {
  K: "#2a1f1b", // contour
  S: "#f1c39f", s: "#d79d78", // peau
  H: "#33251d", // cheveux (lui)
  E: "#5b3b26", e: "#a87a4d", // cheveux (Elodie), pointes éclaircies
  O: "#1b1411", M: "#b3544a", F: "#c88560",
  T: "#f3f1ea", t: "#cfcabc", // t-shirt blanc
  B: "#cdb38e", b: "#a6895f", // veste sherpa beige
  J: "#3f5878", N: "#2a2a2a",
  C: "#efe5d3", c: "#cbbda4", // haut crème
  P: "#8f8462", // pantalon kaki
  W: "#f8f6f0", w: "#d8d2c4", g: "#e7a69c" // Balou
};

const SPRITES = {
  lui: [
    "................",
    ".....KKKKKK.....",
    "....KHHHHHHK....",
    "...KHHHHHHHHK...",
    "...KHHSSSSHHK...",
    "...KSSSSSSSSK...",
    "...KSOSSSSOSK...",
    "...KSSSSSSSSK...",
    "...KsSSMMSSsK...",
    "....KssssssK....",
    "...KBBTTTTBBK...",
    "..KBBBTTTTBBBK..",
    "..KBBbTTTTbBBK..",
    "..KSBbTTTTbBSK..",
    "..KSBBBBBBBBSK..",
    "...KJJJJJJJJK...",
    "...KJJJKKJJJK...",
    "...KJJK..KJJK...",
    "...KNNK..KNNK...",
    "................"
  ],
  elodie: [
    "................",
    ".....KKKKKK.....",
    "....KEEEEEEK....",
    "...KEEEEEEEEK...",
    "..KEEESSSSEEEK..",
    "..KEESSSSSSEEK..",
    "..KESOSSSSOSEK..",
    "..KESFSSSSFSEK..",
    "..KEsSSMMSSsEK..",
    "..KEEKssssKEEK..",
    "..KEeKCCCCKeEK..",
    "..KEeCCCCCCeEK..",
    "..KeeCCCCCCeeK..",
    "..KeSCcCCcCSeK..",
    "...KSCCCCCCSK...",
    "...KPPPPPPPPK...",
    "...KPPPKKPPPK...",
    "...KPPK..KPPK...",
    "...KTTK..KTTK...",
    "................"
  ],
  balou: [
    "..KK........KK..",
    "..KWK......KWK..",
    "..KWgK....KgWK..",
    "..KWWgKKKKgWWK..",
    ".KWWWWWWWWWWWWK.",
    ".KWWOOWWWWOOWWK.",
    ".KWWOOWWWWOOWWK.",
    "..KWWWwwwwWWWK..",
    "...KWwKKKKwWK...",
    "...KWwwKKwwWK...",
    "....KWWggWWK....",
    "...KWWWWWWWWK...",
    "..KWWWWWWWWWWK..",
    ".KWWwWWWWWWwWWK.",
    ".KWWKWWWWWWKWWK.",
    ".KKK.KKKKKK.KKK."
  ]
};

function drawSprite(ctx, name, x, y, scale = 1) {
  const rows = SPRITES[name];
  if (!rows) return;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const col = PAL[rows[r][c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

/* Petit canvas portrait (pour le HUD, les cartes d'équipe, le guide) */
function spriteCanvas(name, scale = 3, cls = "") {
  const rows = SPRITES[name] || SPRITES.balou;
  const cv = document.createElement("canvas");
  cv.width = 16 * scale;
  cv.height = rows.length * scale;
  cv.className = "sprite " + cls;
  cv.setAttribute("aria-hidden", "true");
  drawSprite(cv.getContext("2d"), name, 0, 0, scale);
  return cv;
}

/* ---------- Carte du terrain (vue de dessus 3/4) ---------- */
const MAP_W = 192, MAP_H = 264;
const ZONE_RECTS = {
  "Maison":     [20, 4, 152, 82],
  "Piscine":    [48, 106, 94, 36],
  "Poulailler": [146, 112, 38, 38],
  "Puits":      [92, 152, 26, 26],
  "Potager":    [8, 166, 82, 90],
  "Abri":       [116, 184, 66, 76]
};
const ZONE_ANCHOR = {
  "Maison": [96, 14], "Piscine": [95, 112], "Poulailler": [165, 114], "Puits": [105, 152],
  "Potager": [50, 168], "Abri": [146, 186], "Jardin": [24, 120]
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function drawMap(cv, opts = {}) {
  const ctx = cv.getContext("2d");
  cv.width = MAP_W; cv.height = MAP_H;
  ctx.imageSmoothingEnabled = false;
  const R = rng(42);
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // herbe sèche de Gironde
  rect(0, 0, MAP_W, MAP_H, "#bcc36b");
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(R() * MAP_W), y = Math.floor(R() * MAP_H);
    px(x, y, R() < .5 ? "#a9b25b" : (R() < .5 ? "#cdd283" : "#9aa552"));
  }
  // arbres à gauche
  [[2, 18, 12], [10, 40, 10], [0, 62, 11], [6, 84, 9]].forEach(([x, y, r]) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) px(x + dx + r, y + dy, (dx + dy) % 3 === 0 ? "#3f6b34" : (dx > 2 && dy > 2 ? "#2f5428" : "#4c7d3d"));
    }
  });
  // mur des voisins à droite
  rect(184, 0, 8, MAP_H, "#d9d4c6");
  for (let y = 0; y < MAP_H; y += 6) { rect(184, y, 8, 1, "#b9b3a4"); rect(y % 12 ? 188 : 185, y, 1, 6, "#b9b3a4"); }
  rect(176, 0, 16, 10, "#d8a48e"); rect(176, 10, 16, 2, "#b6826d");

  // ---- maison bois grise, toits en tuiles ----
  // bloc étage à gauche
  rect(22, 30, 58, 56, "#8a8f8b");
  for (let y = 31; y < 86; y += 3) rect(22, y, 58, 1, "#7b807c");
  rect(18, 8, 66, 24, "#c46a42");
  for (let y = 10; y < 32; y += 3) for (let x = 18; x < 84; x += 4) rect(x + ((y / 3) % 2 ? 2 : 0), y, 2, 1, "#a9542f");
  rect(18, 30, 66, 2, "#7d3a22");
  rect(30, 40, 10, 12, "#2e3a40"); rect(31, 41, 3, 4, "#6f8a96");
  rect(58, 40, 16, 12, "#2e3a40"); rect(59, 41, 4, 4, "#6f8a96");
  rect(28, 62, 14, 22, "#2e3a40"); rect(29, 63, 3, 6, "#6f8a96");
  rect(72, 4, 3, 6, "#9aa0a4"); rect(71, 3, 5, 2, "#7f868a"); // conduit
  // aile basse à droite avec grande pergola
  rect(80, 54, 90, 32, "#5f5752");
  for (let y = 55; y < 86; y += 3) rect(80, y, 90, 1, "#544c47");
  rect(76, 38, 100, 18, "#c46a42");
  for (let y = 40; y < 56; y += 3) for (let x = 76; x < 176; x += 4) rect(x + ((y / 3) % 2 ? 2 : 0), y, 2, 1, "#a9542f");
  rect(76, 54, 100, 2, "#7d3a22");
  rect(90, 60, 26, 22, "#2e3a40"); rect(92, 62, 5, 8, "#6f8a96"); // baie vitrée
  rect(126, 62, 14, 10, "#2e3a40"); rect(127, 63, 3, 4, "#6f8a96");
  [86, 120, 150, 172].forEach(x => rect(x, 56, 2, 32, "#3a3d40")); // poteaux

  // terrasse bois
  rect(26, 86, 152, 14, "#a47b51");
  for (let x = 26; x < 178; x += 5) rect(x, 86, 1, 14, "#8b6542");
  rect(26, 99, 152, 1, "#6e5034");

  // piscine en béton (pas encore finie)
  rect(50, 108, 90, 32, "#d4cfc4");
  rect(54, 112, 82, 24, "#b8b2a6");
  rect(56, 128, 78, 6, "#7f9b78");
  for (let i = 0; i < 30; i++) px(56 + Math.floor(R() * 78), 128 + Math.floor(R() * 6), "#93ad86");
  rect(76, 114, 3, 3, "#e3c86e"); rect(100, 114, 3, 3, "#e3c86e");
  rect(122, 113, 12, 8, "#c9c3b6"); // marches

  // poulailler
  rect(150, 120, 30, 26, "#b0b48b");
  for (let x = 150; x < 180; x += 2) { px(x, 120, "#6e6a5a"); px(x, 145, "#6e6a5a"); }
  for (let y = 120; y < 146; y += 2) { px(150, y, "#6e6a5a"); px(179, y, "#6e6a5a"); }
  rect(154, 122, 14, 10, "#8c5a35"); rect(152, 118, 18, 5, "#6b3d28"); rect(159, 128, 4, 4, "#3a2618");
  [[170, 136], [160, 140], [174, 128]].forEach(([x, y]) => { rect(x, y, 4, 3, "#f5f2ea"); px(x + 3, y - 1, "#d0423a"); px(x + 4, y + 1, "#e0a33a"); });

  // puits
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= 81) px(105 + dx, 165 + dy, d > 42 ? ((dx + dy) % 2 ? "#9b958a" : "#b7b1a5") : "#2d3a40");
  }
  rect(103, 163, 4, 2, "#5f8fa0");

  // potager 11,5 x 13,5 m avec ganivelle et serre côté ouest
  rect(10, 170, 78, 84, "#7a5a3a");
  for (let y = 176; y < 250; y += 8) rect(32, y, 52, 4, "#5f4429");
  for (let y = 176; y < 250; y += 8) for (let x = 33; x < 84; x += 3) if (R() < .7) { px(x, y + 1, "#5b9a45"); px(x, y, "#78b85a"); }
  for (let x = 8; x < 90; x += 2) { rect(x, 168, 1, 3, "#8a5a32"); rect(x, 253, 1, 3, "#8a5a32"); }
  for (let y = 168; y < 256; y += 2) { rect(8, y, 3, 1, "#8a5a32"); rect(87, y, 3, 1, "#8a5a32"); }
  rect(44, 167, 10, 4, "#bcc36b"); // entrée au milieu de la façade nord
  rect(12, 178, 18, 58, "#cfe6ea");
  for (let y = 178; y < 236; y += 6) rect(12, y, 18, 1, "#9fbcc2");
  rect(12, 178, 1, 58, "#7d9aa0"); rect(29, 178, 1, 58, "#7d9aa0");
  rect(12, 236, 18, 6, "#d9c27a"); // paille

  // abri bois en construction + coin douche
  rect(120, 196, 50, 34, "#8c6239");
  for (let x = 120; x < 170; x += 4) rect(x, 196, 1, 34, "#76512e");
  rect(116, 188, 58, 9, "#5b4632");
  for (let x = 118; x < 172; x += 5) rect(x, 186, 2, 3, "#8c6239"); // chevrons apparents
  rect(140, 216, 10, 14, "#3a2a1c");
  rect(150, 236, 26, 18, "#d9d5cb");
  for (let x = 150; x < 176; x += 6) rect(x, 236, 1, 18, "#bdb8ac");
  for (let y = 236; y < 254; y += 6) rect(150, y, 26, 1, "#bdb8ac");
  rect(172, 238, 2, 12, "#8a8f8b"); rect(168, 238, 6, 2, "#8a8f8b");
  // bananier
  [[128, 240], [124, 236], [134, 236], [129, 232]].forEach(([x, y]) => { rect(x, y, 7, 3, "#4e9a3a"); rect(x + 1, y + 1, 5, 1, "#3d7d2e"); });
  rect(130, 238, 2, 12, "#6b5a2e");

  // marqueurs de quêtes « ! »
  (opts.markers || []).forEach(m => {
    const [ax, ay] = ZONE_ANCHOR[m.zone] || ZONE_ANCHOR.Jardin;
    const bob = opts.frame % 2 ? 1 : 0;
    const x = ax - 5, y = ay - 6 - bob;
    rect(x, y, 11, 11, "#2a1f1b"); rect(x + 1, y + 1, 9, 9, m.urgent ? "#f2c94c" : "#fbf8ef");
    rect(x + 5, y + 2, 1, 5, "#2a1f1b"); rect(x + 5, y + 8, 1, 1, "#2a1f1b");
    rect(x + 4, y + 11, 3, 1, "#2a1f1b"); px(x + 5, y + 12, "#2a1f1b");
  });

  // l'équipe sur la terrasse
  const f = opts.frame || 0;
  drawSprite(ctx, "lui", 98, 80 - (f % 2), 1);
  drawSprite(ctx, "elodie", 116, 80 - ((f + 1) % 2), 1);
  drawSprite(ctx, "balou", 136, 85 - (f % 2), 1);
}

function zoneAt(x, y) {
  for (const [z, [rx, ry, rw, rh]] of Object.entries(ZONE_RECTS)) {
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return z;
  }
  return "Jardin";
}
