/* La maison en isométrie simplifiée, d'après les plans (RDC + étage) et les photos.
   Coordonnées en mètres approximatifs, origine au coin nord-ouest. */

const R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

const PLACES = {
  // Rez-de-chaussée
  entree:    { name: "Entrée", short: "Entrée", level: "rdc", poly: R(2.7, 0, 1.7, 1.8) },
  buanderie: { name: "Buanderie", short: "Buand.", level: "rdc", poly: R(0, 0, 2.7, 1.8) },
  ch2:       { name: "Chambre 2", short: "Ch. 2", level: "rdc", poly: R(0, 1.8, 2.6, 2.9) },
  couloir:   { name: "Couloir", short: "Couloir", level: "rdc", poly: [[2.6, 1.8], [4.4, 1.8], [4.4, 6.5], [1.2, 6.5], [1.2, 4.7], [2.6, 4.7]] },
  wc_rdc:    { name: "WC du bas", short: "WC", level: "rdc", poly: R(0, 4.7, 1.2, 1.8) },
  sde:       { name: "Salle d'eau", short: "S. d'eau", level: "rdc", poly: R(0, 6.5, 1.6, 3.0) },
  ch1:       { name: "Chambre 1", short: "Ch. 1", level: "rdc", poly: R(1.6, 6.5, 2.8, 3.0) },
  sejour:    { name: "Séjour", short: "Séjour", level: "rdc", poly: R(4.4, 0, 4.6, 4.5) },
  cuisine:   { name: "Cuisine et salle à manger", short: "Cuisine", level: "rdc", poly: R(9.0, 0, 4.7, 4.5) },
  // Étage
  wc_etage:  { name: "WC du haut", short: "WC", level: "etage", poly: R(0, 0, 1.1, 1.5) },
  sdb:       { name: "Salle de bain", short: "Salle de bain", level: "etage", poly: [[1.1, 0], [5.2, 0], [5.2, 2.8], [0, 2.8], [0, 1.5], [1.1, 1.5]] },
  suite:     { name: "Suite parentale", short: "Suite", level: "etage", poly: R(0, 2.8, 5.2, 4.2) },
  palier:    { name: "Palier", short: "Palier", level: "etage", poly: R(5.2, 0, 1.2, 5.3) },
  // Toute la maison (tâches qui concernent plusieurs pièces)
  maison:    { name: "Toute la maison", short: "Partout", level: "all" },
  // Extérieur
  facades:   { name: "Façades et toiture", short: "Façades", level: "ext", poly: R(2, 1, 13, 7), h: 1.6, roof: true },
  terrasse:  { name: "Terrasse", short: "Terrasse", level: "ext", poly: R(2, 8, 14.5, 1.8), h: 0.15 },
  piscine:   { name: "Piscine", short: "Piscine", level: "ext", poly: R(4.5, 11.2, 8.5, 3.6), h: 0.2 },
  poulailler:{ name: "Poulailler", short: "Poules", level: "ext", poly: R(16.5, 11, 3.2, 3.2), h: 0.7 },
  puits:     { name: "Puits", short: "Puits", level: "ext", poly: R(10.2, 17, 1.4, 1.4), h: 0.45 },
  potager:   { name: "Potager", short: "Potager", level: "ext", poly: R(0.5, 17, 7, 8), h: 0.12 },
  abri:      { name: "Abri de jardin", short: "Abri", level: "ext", poly: R(13, 19.5, 5, 4), h: 1.0 },
  jardin:    { name: "Jardin", short: "Jardin", level: "ext", poly: R(0, 0, 21, 26.5), h: 0, ground: true }
};
const VOIDS = {
  etage: [{ label: "Vide sur séjour", poly: R(6.4, 0, 5.0, 5.3) }]
};
const LEVEL_LABEL = { rdc: "Rez-de-chaussée", etage: "Étage", ext: "Extérieur" };
const PLACE_ORDER = ["maison", "entree", "sejour", "cuisine", "couloir", "ch1", "ch2", "sde", "wc_rdc", "buanderie", "palier", "suite", "sdb", "wc_etage",
  "terrasse", "facades", "jardin", "piscine", "abri", "potager", "poulailler", "puits"];

/* ---------- projection ---------- */
const ISO_S = 40, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const iso = (x, y, z = 0) => [(x - y) * C30 * ISO_S, (x + y) * S30 * ISO_S - z * ISO_S];
const ptsStr = arr => arr.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
function centroid(poly) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; } a /= 2; return [cx / (6 * a), cy / (6 * a)]; }
function inside(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function inset(poly, d) {
  // retrait simple vers le centroïde pour séparer visuellement les pièces
  const [cx, cy] = centroid(poly);
  return poly.map(([x, y]) => [x + Math.sign(cx - x) * d, y + Math.sign(cy - y) * d]);
}
function prism(poly, h) {
  // faces visibles (tournées vers le spectateur) puis dessus
  const faces = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1, mx = (a[0] + b[0]) / 2 + nx / len * 0.01, my = (a[1] + b[1]) / 2 + ny / len * 0.01;
    const out = !inside(poly, mx, my);
    const [ox, oy] = out ? [nx, ny] : [-nx, -ny];
    if (ox + oy > 0.0001 && h > 0) faces.push({ pts: [iso(a[0], a[1], 0), iso(b[0], b[1], 0), iso(b[0], b[1], h), iso(a[0], a[1], h)], side: ox > oy ? "e" : "s" });
  }
  return { faces, top: poly.map(p => iso(p[0], p[1], h)) };
}

/* ---------- rendu SVG d'un niveau ---------- */
function houseSVG(level, info, selected) {
  const ids = Object.keys(PLACES).filter(k => PLACES[k].level === level && PLACES[k].poly);
  const all = [];
  ids.forEach(k => PLACES[k].poly.forEach(p => all.push(p)));
  (VOIDS[level] || []).forEach(v => v.poly.forEach(p => all.push(p)));
  const roofH = level === "ext" ? 2.6 : 0.5;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  all.forEach(([x, y]) => [0, roofH].forEach(z => { const [X, Y] = iso(x, y, z); minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); }));
  const pad = 24;
  const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
  const order = ids.slice().sort((a, b) => {
    if (PLACES[a].ground) return -1; if (PLACES[b].ground) return 1;
    const ca = centroid(PLACES[a].poly), cb = centroid(PLACES[b].poly); return (ca[0] + ca[1]) - (cb[0] + cb[1]);
  });
  const sk = Math.max(1, vb[2] / 760); // garde des étiquettes lisibles quelle que soit la taille du niveau
  const fs = (23 * sk).toFixed(0), rr = (17 * sk).toFixed(0), cfs = (20 * sk).toFixed(0);
  let svg = `<svg class="house" data-level="${level}" viewBox="${vb.map(v => v.toFixed(0)).join(" ")}" role="group" aria-label="${LEVEL_LABEL[level]} : touche une pièce">`;
  // dalle du niveau
  if (level !== "ext") {
    const outer = level === "rdc" ? [[0, 0], [13.7, 0], [13.7, 4.5], [4.4, 4.5], [4.4, 9.5], [0, 9.5]] : [[0, 0], [11.4, 0], [11.4, 5.3], [5.2, 5.3], [5.2, 7], [0, 7]];
    const pr = prism(outer, 0.18);
    pr.faces.forEach(f => svg += `<polygon class="slab-${f.side}" points="${ptsStr(f.pts)}"/>`);
    svg += `<polygon class="slab-top" points="${ptsStr(pr.top)}"/>`;
  }
  (VOIDS[level] || []).forEach(v => {
    svg += `<polygon class="void" points="${ptsStr(v.poly.map(p => iso(p[0], p[1], 0.18)))}"/>`;
    const [cx, cy] = centroid(v.poly), [X, Y] = iso(cx, cy, 0.18);
    svg += `<text class="void-label" font-size="${(20 * sk).toFixed(0)}" x="${X.toFixed(0)}" y="${(Y + 34).toFixed(0)}">${esc(v.label)}</text>`;
  });
  order.forEach(k => {
    const P = PLACES[k], h = level === "ext" ? (P.h || 0.1) : 0.42;
    const base = level === "ext" ? P.poly : inset(P.poly, 0.06);
    const pr = prism(base, h), st = info[k] || {};
    const cls = ["room", st.tone ? "tone-" + st.tone : "", selected === k ? "sel" : "", P.ground ? "ground" : "", "p-" + k].join(" ");
    svg += `<g class="${cls}" data-place="${k}" tabindex="0" role="button" aria-label="${esc(P.name)}${st.count ? ", " + st.count + " tâche" + (st.count > 1 ? "s" : "") : ""}">`;
    pr.faces.forEach(f => svg += `<polygon class="side-${f.side}" points="${ptsStr(f.pts)}"/>`);
    svg += `<polygon class="top" points="${ptsStr(pr.top)}"/>`;
    if (P.roof) {
      const [x0, y0] = P.poly[0], [x1, y1] = P.poly[2];
      const ridge = (y0 + y1) / 2;
      const r1 = [iso(x0, y0, h), iso(x1, y0, h), iso(x1, ridge, h + 1), iso(x0, ridge, h + 1)];
      const r2 = [iso(x0, ridge, h + 1), iso(x1, ridge, h + 1), iso(x1, y1, h), iso(x0, y1, h)];
      svg += `<polygon class="roof-back" points="${ptsStr(r1)}"/><polygon class="roof-front" points="${ptsStr(r2)}"/>`;
    }
    svg += decor(k, h);
    if (!P.ground) {
      const [cx, cy] = centroid(P.poly), [X, Y] = iso(cx, cy, P.roof ? h + 0.5 : h);
      svg += `<text class="lbl" font-size="${fs}" x="${X.toFixed(0)}" y="${(Y + 8 * sk).toFixed(0)}">${esc(P.short)}</text>`;
      if (st.count) svg += `<g class="cnt tone-${st.tone || "none"}"><circle cx="${(X).toFixed(0)}" cy="${(Y - 26 * sk).toFixed(0)}" r="${rr}"/><text font-size="${cfs}" x="${X.toFixed(0)}" y="${(Y - 19 * sk).toFixed(0)}">${st.count}</text></g>`;
    } else if (st.count) {
      const [X, Y] = iso(18, 5, 0);
      svg += `<text class="lbl" font-size="${fs}" x="${X.toFixed(0)}" y="${(Y + 8 * sk).toFixed(0)}">Jardin</text><g class="cnt tone-${st.tone || "none"}"><circle cx="${X.toFixed(0)}" cy="${(Y - 26 * sk).toFixed(0)}" r="${rr}"/><text font-size="${cfs}" x="${X.toFixed(0)}" y="${(Y - 19 * sk).toFixed(0)}">${st.count}</text></g>`;
    }
    svg += `</g>`;
  });
  return svg + `</svg>`;
}

/* quelques repères dessinés : escalier, cheminée, lit, baignoire… */
function decor(k, h) {
  const line = (a, b) => `<line class="deco" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
  const box = (x, y, w, d, z = h, cls = "deco-fill") => `<polygon class="${cls}" points="${ptsStr([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)])}"/>`;
  let s = "";
  if (k === "sejour") { for (let i = 0; i < 10; i++) { const x = 5.6 + i * 0.28; s += line(iso(x, 0.15, h), iso(x, 0.95, h)); } s += box(4.55, 1.6, 0.35, 1.3, h, "deco-dark"); }
  if (k === "cuisine") { s += box(13.0, 0.2, 0.55, 4.1); s += box(10.0, 1.6, 2.2, 1.0, h, "deco-wood"); }
  if (k === "ch1") s += box(2.3, 7.2, 1.5, 1.9);
  if (k === "ch2") s += box(0.5, 2.4, 1.5, 1.9);
  if (k === "suite") s += box(1.6, 4.0, 1.8, 2.0);
  if (k === "sdb") { s += box(2.2, 1.7, 1.7, 0.75, h, "deco-water"); s += box(3.0, 0.15, 1.0, 0.9, h, "deco-water"); }
  if (k === "sde") s += box(0.2, 8.2, 1.2, 1.1, h, "deco-water");
  if (k === "palier") for (let i = 0; i < 6; i++) { const y = 0.3 + i * 0.25; s += line(iso(5.3, y, h), iso(6.3, y, h)); }
  if (k === "piscine") s += `<polygon class="deco-water" points="${ptsStr([iso(5.2, 13.6, h), iso(12.3, 13.6, h), iso(12.3, 14.2, h), iso(5.2, 14.2, h)])}"/>`;
  if (k === "potager") for (let i = 0; i < 6; i++) s += box(3.3, 17.8 + i * 1.2, 3.8, 0.55, h, "deco-green");
  if (k === "potager") s += box(0.8, 17.6, 2, 6.6, h, "deco-glass");
  return s;
}
