/* Petits portraits pixel art (Baptiste, Elodie, Baloo) — dessinés à la main, aucun fichier image. */

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
  W: "#f8f6f0", w: "#d8d2c4", g: "#e7a69c" // Baloo
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
  baloo: [
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
  const rows = SPRITES[name] || SPRITES.baloo;
  const cv = document.createElement("canvas");
  cv.width = 16 * scale;
  cv.height = rows.length * scale;
  cv.className = "sprite " + cls;
  cv.setAttribute("aria-hidden", "true");
  drawSprite(cv.getContext("2d"), name, 0, 0, scale);
  return cv;
}

