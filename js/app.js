/* Maison de Saucats — appli de quêtes de la maison. Tout tourne dans le téléphone ;
   la synchro passe par un fichier JSON dans un dépôt GitHub privé. */
"use strict";

const ZONES = ["Maison", "Jardin", "Piscine", "Abri", "Potager", "Poulailler", "Puits"];
const KINDS = { projet: "Projet", reparation: "Réparation", entretien: "Entretien" };
const STATE_LABEL = { ready: "Faisable", buy: "À acheter", blocked: "Bloquée", wait: "En attente", done: "Terminée", due: "À faire", ok: "À jour" };
const WHO = { lui: "lui", elodie: "elodie", tous: "Ensemble", "": "Libre" };

/* ---------------- état ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const todayISO = () => iso(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
function fmtMin(m) { m = +m || 0; if (m < 60) return m + " min"; const h = Math.floor(m / 60), r = m % 60; return h + " h" + (r ? String(r).padStart(2, "0") : ""); }
const fmtEur = n => (+n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
const fmtDate = s => s ? new Date(s + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

function freshData() {
  const tasks = {};
  SEED_TASKS.forEach(t => tasks[t.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...t, updatedAt: 0 });
  return { v: 1, tasks, log: {}, settings: { weeklyHours: 4, guide: "", players: { lui: { name: "" }, elodie: { name: "Elodie" } }, updatedAt: 0 } };
}
const S = {
  data: lsGet("maison-data", null) || freshData(),
  dev: Object.assign({ me: "", sync: { owner: "Batex23", repo: "maison-saucats-data", path: "maison.json", token: "" }, ctx: { time: 60, where: "all", energy: "normal" } }, lsGet("maison-device", {})),
  tab: "carte", filter: "actives", pocket: "now", frame: 0,
  sync: { state: "off", msg: "Synchro non configurée", dirty: lsGet("maison-dirty", false), sha: null }
};
const saveDev = () => lsSet("maison-device", S.dev);
function playerName(k) { const p = S.data.settings.players || {}; return k === "elodie" ? (p.elodie?.name || "Elodie") : k === "lui" ? (p.lui?.name || "Toi") : "Balou"; }
const tasksList = () => Object.values(S.data.tasks).filter(t => !t.deleted);

/* ---------------- modifications ---------------- */
function commit(msg) {
  lsSet("maison-data", S.data);
  S.sync.dirty = true; lsSet("maison-dirty", true);
  render();
  if (msg) toast(msg);
  scheduleSync();
}
function putTask(t) { t.updatedAt = Date.now(); S.data.tasks[t.id] = t; }
function patchTask(id, patch) { const t = { ...S.data.tasks[id], ...patch }; putTask(t); }

const xpFor = t => 10 + Math.round((+t.duration || 30) / 5);
function xpOf(who) { return Object.values(S.data.log).filter(l => l.who === who || l.who === "tous").reduce((s, l) => s + (+l.xp || 0), 0); }
function levelOf(xp) { const lv = Math.floor(Math.sqrt(xp / 40)) + 1; const lo = 40 * (lv - 1) ** 2, hi = 40 * lv ** 2; return { lv, pct: Math.round((xp - lo) / (hi - lo) * 100), toNext: hi - xp }; }

function completeTask(id) {
  const t = S.data.tasks[id]; if (!t) return;
  const who = S.dev.me || "lui";
  const before = levelOf(xpOf(who)).lv;
  const gain = xpFor(t);
  const lid = uid();
  S.data.log[lid] = { id: lid, taskId: id, title: t.title, who, xp: gain, date: todayISO() };
  let extra = "";
  if (t.kind === "entretien") patchTask(id, { lastDone: todayISO() });
  else {
    patchTask(id, { status: "done", doneAt: todayISO(), doneBy: who });
    analyze();
    const unl = tasksList().filter(x => (x.deps || []).includes(id) && x._?.state !== "done" && (x.deps || []).every(d => !S.data.tasks[d] || S.data.tasks[d].status === "done"));
    if (unl.length) extra = " · Débloqué : " + unl.map(x => x.title).join(", ");
  }
  commit();
  const after = levelOf(xpOf(who)).lv;
  toast(`+${gain} XP pour ${playerName(who)}${after > before ? " · NIVEAU " + after + " !" : ""}${extra}`, "xp");
}

/* ---------------- analyse : état, score, raisons ---------------- */
function analyze() {
  const T = tasksList(), byId = S.data.tasks, today = todayISO();
  const dependents = {};
  T.forEach(t => (t.deps || []).forEach(d => (dependents[d] = dependents[d] || []).push(t.id)));
  const unlock = (id, seen = new Set()) => { (dependents[id] || []).forEach(c => { const x = byId[c]; if (!seen.has(c) && x && !x.deleted && x.status !== "done") { seen.add(c); unlock(c, seen); } }); return seen; };
  T.forEach(t => {
    const a = {}, dur = +t.duration || 0;
    if (t.kind === "entretien") {
      const every = +t.everyDays || 7, since = t.lastDone ? daysBetween(t.lastDone, today) : every;
      a.dueIn = every - since; a.state = a.dueIn <= 0 ? "due" : "ok"; a.overdue = Math.max(0, -a.dueIn);
      a.score = 6 + Math.min(8, (since / every - 1) * 4) + (+t.urgency || 2);
      a.reasons = a.state === "due" ? [a.overdue ? "En retard de " + a.overdue + " j" : "Prévu aujourd'hui"] : [];
    } else {
      a.blockers = (t.deps || []).filter(d => byId[d] && !byId[d].deleted && byId[d].status !== "done");
      a.missing = (t.materials || []).filter(m => !m.have && m.name);
      a.missingCost = a.missing.reduce((s, m) => s + (+m.cost || 0), 0);
      a.cost = (t.materials || []).reduce((s, m) => s + (+m.cost || 0), 0);
      a.unlocks = unlock(t.id).size;
      if (t.status === "done") a.state = "done";
      else if (t.waitUntil && t.waitUntil > today) a.state = "wait";
      else if (a.blockers.length) a.state = "blocked";
      else if (a.missing.length) a.state = "buy";
      else a.state = "ready";
      const u = +t.urgency || 2, i = +t.importance || 2;
      let sc = u * 3 + i * 2 + Math.min(a.unlocks, 4) * 2;
      if (dur && dur <= 30) sc += 3; else if (dur && dur <= 90) sc += 1;
      if (a.missingCost > 200) sc -= 2; else if (a.missing.length && a.missingCost <= 20) sc += 1;
      if (t.status === "doing") sc += 2;
      a.score = sc;
      const r = [];
      if (t.status === "doing") r.push("Commencée");
      if (u >= 3) r.push("Urgent");
      if (a.unlocks) r.push("Débloque " + a.unlocks);
      if (dur && dur <= 30) r.push("Rapide");
      if (a.missing.length && a.missingCost <= 20) r.push("Achat léger");
      if (a.missingCost > 200) r.push("Gros budget");
      a.reasons = r;
    }
    t._ = a;
  });
}

/* ---------------- plan du jour (sans IA) ---------------- */
function whereOk(t) { const w = S.dev.ctx.where; return w === "all" || (w === "out" ? !!t.outdoor : !t.outdoor); }
function localPlan() {
  const c = S.dev.ctx; let left = +c.time; const cap = c.energy === "tired" ? 45 : Infinity; const out = [];
  const me = S.dev.me;
  const mine = t => !t.assignee || t.assignee === "tous" || !me || t.assignee === me;
  const ok = t => whereOk(t) && mine(t) && (+t.duration || 30) <= cap;
  const chores = tasksList().filter(t => t._.state === "due" && ok(t)).sort((a, b) => b._.score - a._.score);
  const quests = tasksList().filter(t => t._.state === "ready" && ok(t)).sort((a, b) => b._.score - a._.score);
  // on alterne : une corvée en retard, puis une quête qui fait avancer les projets
  const pool = [];
  while (chores.length || quests.length) { if (chores.length) pool.push(chores.shift()); if (quests.length) pool.push(quests.shift()); }
  for (const t of pool) { const d = +t.duration || 30; if (d <= left) { out.push({ t, min: d }); left -= d; } }
  if (!out.length) { const t = tasksList().filter(t => t._.state === "ready" && whereOk(t) && mine(t)).sort((a, b) => b._.score - a._.score)[0]; if (t && c.energy !== "tired") out.push({ t, min: left, partial: true }); }
  return out;
}

/* ---------------- planning (Gantt) ---------------- */
function mondayOf(d) { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); x.setHours(12, 0, 0, 0); return x; }
function schedule(weeks = 12) {
  const start = mondayOf(new Date()), all = tasksList();
  const maint = Math.round(all.filter(t => t.kind === "entretien").reduce((s, t) => s + (+t.duration || 0) * 7 / (+t.everyDays || 7), 0));
  const capW = Math.max(30, (+S.data.settings.weeklyHours || 4) * 60);
  const todo = all.filter(t => t.kind !== "entretien" && t.status !== "done");
  const rem = Object.fromEntries(todo.map(t => [t.id, Math.max(15, +t.duration || 60)]));
  const res = {}, fin = {};
  all.forEach(t => { if (t.kind !== "entretien" && t.status === "done") fin[t.id] = -1; });
  for (let w = 0; w < weeks; w++) {
    const wEnd = new Date(start); wEnd.setDate(wEnd.getDate() + 7 * w + 6); const wEndISO = iso(wEnd);
    let cap = capW;
    while (cap > 0) {
      const elig = todo.filter(t => rem[t.id] > 0 && (!t.waitUntil || t.waitUntil <= wEndISO)
        && (t.deps || []).every(d => !S.data.tasks[d] || S.data.tasks[d].deleted || (fin[d] !== undefined && fin[d] < w))
        && (w > 0 || !(t._.missing || []).length || res[t.id]))
        .sort((a, b) => ((res[b.id] ? 100 : 0) + b._.score) - ((res[a.id] ? 100 : 0) + a._.score));
      const t = elig[0]; if (!t) break;
      const use = Math.min(cap, rem[t.id]); rem[t.id] -= use; cap -= use;
      if (!res[t.id]) res[t.id] = { start: w, end: w }; res[t.id].end = w;
      if (rem[t.id] <= 0) fin[t.id] = w;
    }
  }
  return { start, weeks, res, later: todo.filter(t => !res[t.id]), capW, maint };
}

/* ---------------- achats (le Sac) ---------------- */
function bag() {
  const items = {};
  tasksList().forEach(t => {
    if (t.kind === "entretien" || t._.state === "done") return;
    (t.materials || []).forEach(m => {
      if (!m.name) return;
      const k = m.name.trim().toLowerCase();
      const it = items[k] = items[k] || { key: k, name: m.name.trim(), cost: 0, tasks: [], prio: 0, now: false, have: true, borrow: false };
      if (!m.have) it.have = false;
      if (m.borrow) it.borrow = true;
      it.cost = Math.max(it.cost, +m.cost || 0);
      const now = t._.state === "buy";
      it.tasks.push({ t, now, have: !!m.have });
      if (now && !m.have) { it.now = true; it.prio += t._.score + (t._.missing.length === 1 ? 4 : 0); }
    });
  });
  return Object.values(items).sort((a, b) => (b.now - a.now) || (b.prio - a.prio) || (a.cost - b.cost));
}

/* ---------------- rendu : morceaux ---------------- */
function mini(name, scale = 1) { return `<span class="mini" data-sprite="${name}" data-scale="${scale}"></span>`; }
function hydrateSprites(root = document) {
  root.querySelectorAll("[data-sprite]").forEach(el => { if (!el.firstChild) el.appendChild(spriteCanvas(el.dataset.sprite, +el.dataset.scale || 2)); });
}
function badge(st) { return `<span class="badge b-${st}">${STATE_LABEL[st]}</span>`; }
function metaLine(t, noDur) {
  const p = [KINDS[t.kind] || "", t.zone || "", noDur ? "" : fmtMin(t.duration)];
  if (t.kind === "entretien") p.push("tous les " + (t.everyDays || 7) + " j"); else if (t._.cost) p.push(fmtEur(t._.cost));
  return p.filter(Boolean).join(" · ");
}
function whyLine(t) {
  const a = t._;
  if (t.kind === "entretien") return a.state === "due" ? "" : (a.dueIn === 1 ? "Revient demain" : "Revient dans " + a.dueIn + " jours");
  if (a.state === "blocked") return "Attend : " + a.blockers.map(id => esc(S.data.tasks[id].title)).join(", ");
  if (a.state === "buy") return "Il manque : " + a.missing.map(m => esc(m.name) + (m.borrow ? " (à emprunter)" : "")).join(", ") + (a.missingCost ? ` <span class="num">(${fmtEur(a.missingCost)})</span>` : "");
  if (a.state === "wait") return "Pas avant le " + fmtDate(t.waitUntil);
  if (a.state === "done") return "Terminée" + (t.doneAt ? " le " + fmtDate(t.doneAt) : "") + (t.doneBy ? " par " + esc(playerName(t.doneBy)) : "");
  return "";
}
function questRow(t, o = {}) {
  const a = t._, st = a.state, canDo = st === "ready" || st === "due" || (o.anyDo && st !== "done" && st !== "ok");
  const w = whyLine(t);
  const who = t.assignee === "lui" || t.assignee === "elodie" ? mini(t.assignee, 1) : t.assignee === "tous" ? mini("lui", 1) + mini("elodie", 1) : "";
  return `<div class="quest q-${st}">
    <div class="bar"></div>
    <div class="body" data-act="edit" data-id="${t.id}" role="button" tabindex="0">
      <div class="t">${esc(t.title)}</div>
      <div class="meta">${o.min ? `<b class="num">${fmtMin(o.min)}</b>${o.partial ? " pour commencer" : ""} · ` : ""}${esc(metaLine(t, !!o.min))}</div>
      ${w ? `<div class="why muted">${w}</div>` : ""}
      ${o.why ? `<div class="why">${esc(o.why)}</div>` : ""}
      <div class="tags">${badge(st)}${(a.reasons || []).map(r => `<span class="tag">${esc(r)}</span>`).join("")}${st !== "done" && st !== "ok" ? `<span class="xp">+${xpFor(t)} XP</span>` : ""}${who}</div>
    </div>
    ${canDo ? `<button class="done-btn" data-act="done" data-id="${t.id}" aria-label="Terminer « ${esc(t.title)} »">✓</button>` : "<span></span>"}
  </div>`;
}
function guideBox(html, actions = "") {
  return `<div class="box"><div class="guide"><div class="portrait">${mini("balou", 3)}</div>
    <div><div class="speaker">BALOU</div><div class="say">${html}</div></div></div>${actions ? `<div style="margin-top:12px">${actions}</div>` : ""}</div>`;
}

function renderHud() {
  const me = S.dev.me || "lui", xp = xpOf(me), L = levelOf(xp);
  const st = S.sync.state;
  $("#hud").innerHTML = `<div class="face">${mini(me, 2)}</div>
    <div class="who"><div class="name">${esc(playerName(me).toUpperCase())}</div>
      <div class="lv"><span>NV ${L.lv}</span><span class="xpbar" title="${xp} XP"><i style="width:${L.pct}%"></i></span></div></div>
    <div class="day">${new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}<br>
      <span class="sync-dot ${st === "ok" ? "ok" : st === "err" ? "err" : st === "busy" ? "busy" : ""}"></span>${st === "ok" ? "SYNC" : st === "busy" ? "…" : st === "err" ? "HORS LIGNE" : "LOCAL"}</div>`;
}

/* ---------------- vues ---------------- */
function viewCarte() {
  const c = S.dev.ctx, plan = localPlan();
  const due = tasksList().filter(t => t._.state === "due").length, ready = tasksList().filter(t => t._.state === "ready").length;
  const chip = (k, v, l) => `<button class="chip" data-ctx="${k}" data-v="${v}" aria-pressed="${String(c[k]) === String(v)}">${l}</button>`;
  const hello = S.dev.me ? playerName(S.dev.me) : "toi";
  return `
  <section class="box mapbox"><canvas class="map" id="map" width="192" height="264" aria-label="Carte du terrain. Touche une zone pour voir ses quêtes."></canvas>
    <div class="maplegend">Touche une zone pour voir ses quêtes. Un « ! » jaune signale une quête urgente.</div></section>
  ${guideBox(`Wouf ! Salut ${esc(hello)}. Aujourd'hui il y a <b>${due}</b> corvée${due > 1 ? "s" : ""} d'entretien et <b>${ready}</b> quête${ready > 1 ? "s" : ""} faisable${ready > 1 ? "s" : ""} tout de suite. Tu as combien de temps ?`,
    `<div class="sec">
      <div class="chips">${chip("time", 15, "15 min")}${chip("time", 30, "30 min")}${chip("time", 60, "1 h")}${chip("time", 120, "2 h")}${chip("time", 240, "Demi-journée")}${chip("time", 420, "Journée")}</div>
      <div class="chips">${chip("where", "all", "Partout")}${chip("where", "in", "Dedans")}${chip("where", "out", "Dehors")}</div>
      <div class="chips">${chip("energy", "normal", "En forme")}${chip("energy", "tired", "Retour de garde")}${chip("energy", "off", "Jour de récup")}</div>
    </div>`)}
  <section class="sec">
    <div class="sec-head"><h2>Mission du jour</h2><span class="hint">${fmtMin(c.time)}</span></div>
    ${plan.length ? plan.map(p => questRow(p.t, { min: p.min, partial: p.partial })).join("") : `<div class="empty">Rien de faisable avec ces critères. Regarde le Sac : c'est sûrement un achat qui bloque.</div>`}
  </section>
  <section class="sec">
    <button class="btn primary wide" data-act="wizard">+ Nouvelle quête avec Balou</button>
    <button class="btn wide" data-act="claude">Demander à Claude</button>
  </section>`;
}

function viewQuetes() {
  const f = S.filter;
  const filters = [["actives", "En cours"], ["ready", "Faisables"], ["buy", "À acheter"], ["blocked", "Bloquées"], ["wait", "En attente"], ["entretien", "Entretien"], ["moi", "Les miennes"], ["done", "Terminées"]];
  const me = S.dev.me;
  const list = tasksList().filter(t => {
    if (f === "entretien") return t.kind === "entretien";
    if (f === "moi") return t._.state !== "done" && t._.state !== "ok" && (t.assignee === me || t.assignee === "tous");
    if (t.kind === "entretien") return false;
    if (f === "actives") return t._.state !== "done";
    return t._.state === f;
  });
  const groups = {};
  list.forEach(t => { const g = t.kind === "entretien" ? t.zone || "Autre" : t.project || t.zone || "Divers"; (groups[g] = groups[g] || []).push(t); });
  const order = { ready: 0, due: 0, buy: 1, blocked: 2, wait: 3, ok: 4, done: 5 };
  return `
  <section class="sec"><div class="row" style="justify-content:space-between"><h2>Journal de quêtes</h2><button class="btn small primary" data-act="wizard">+ Quête</button></div>
    <div class="chips">${filters.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div></section>
  ${Object.keys(groups).length ? Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([g, ts]) => `
    <section class="sec"><div class="sec-head"><h2>${esc(g)}</h2><span class="hint num">${ts.length}</span></div>
    ${ts.sort((a, b) => (order[a._.state] - order[b._.state]) || (b._.score - a._.score)).map(t => questRow(t, { anyDo: true })).join("")}</section>`).join("")
    : `<div class="empty">Aucune quête ici.</div>`}`;
}

function viewSac() {
  const all = bag(), p = S.pocket;
  const now = all.filter(b => !b.have && b.now), later = all.filter(b => !b.have && !b.now), have = all.filter(b => b.have);
  const list = p === "now" ? now : p === "later" ? later : have;
  const sum = a => a.reduce((s, b) => s + (b.borrow ? 0 : b.cost), 0);
  const row = b => `<div class="item ${p === "later" ? "later" : ""} ${b.borrow ? "borrow" : ""}">
    <div class="gem"></div>
    <div style="min-width:0"><div class="n">${esc(b.name)}${b.borrow ? " · à emprunter" : ""}</div>
      <div class="for">Pour : ${b.tasks.map(x => esc(x.t.title)).join(" · ")}</div></div>
    ${p === "have" ? `<button class="btn small" data-act="unbuy" data-key="${esc(b.key)}">Retirer</button>`
      : `<div class="row" style="gap:10px;flex-wrap:nowrap"><span class="num">${b.borrow ? "" : b.cost ? fmtEur(b.cost) : ""}</span><input type="checkbox" data-act="bought" data-key="${esc(b.key)}" aria-label="${esc(b.name)} : je l'ai"></div>`}
  </div>`;
  const intro = { now: "Ces objets débloquent des quêtes faisables. Les premiers rendent le plus service.", later: "Pour des quêtes encore bloquées ou en attente : inutile de les acheter maintenant.", have: "Ce que tu as déjà pour les quêtes en cours." }[p];
  return `
  <section class="sec"><h2>Sac</h2>
    <div class="pocket-tabs">
      <button data-pocket="now" aria-pressed="${p === "now"}">ACHATS ${now.length}</button>
      <button data-pocket="later" aria-pressed="${p === "later"}">PLUS TARD ${later.length}</button>
      <button data-pocket="have" aria-pressed="${p === "have"}">J'AI ${have.length}</button>
    </div>
    <div class="box" style="margin-top:-3px;box-shadow:none">
      <p class="muted" style="margin:0 0 6px;font-size:.92rem">${intro}</p>
      ${list.length ? list.map(row).join("") : `<div class="empty">Poche vide.</div>`}
      ${p !== "have" && list.length ? `<div class="total"><span>TOTAL</span><span class="num">${fmtEur(sum(list))}</span></div>` : ""}
    </div></section>`;
}

function viewAgenda() {
  const sc = schedule(12), cols = sc.weeks;
  const rows = Object.entries(sc.res).map(([id, r]) => ({ t: S.data.tasks[id], ...r })).sort((a, b) => a.start - b.start || a.end - b.end);
  let head = `<div class="h" style="position:sticky;left:0;z-index:2;text-align:left;padding-left:8px">QUÊTE</div>`;
  for (let w = 0; w < cols; w++) { const d = new Date(sc.start); d.setDate(d.getDate() + 7 * w); head += `<div class="h">${w === 0 ? "CETTE<br>SEM." : String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0")}</div>`; }
  const body = rows.map(r => {
    let h = `<div class="name" data-act="edit" data-id="${r.t.id}" role="button" tabindex="0" title="${esc(r.t.title)}">${esc(r.t.title)}</div>`;
    for (let w = 0; w < cols; w++) {
      const on = w >= r.start && w <= r.end;
      const cls = ["gb", (r.t._.missing || []).length ? "buy" : "", w > r.start ? "cont" : "", w < r.end ? "next" : ""].join(" ");
      h += `<div class="cell">${on ? `<div class="${cls}"></div>` : ""}</div>`;
    }
    return h;
  }).join("");
  return `
  <section class="box sec">
    <h2>Temps de bricolage</h2>
    <div class="grid2">
      <div class="field"><label for="weekly">Heures par semaine</label><input id="weekly" type="number" min="1" max="60" value="${esc(S.data.settings.weeklyHours || 4)}"></div>
      <div class="field"><span class="flabel">Entretien estimé</span><div class="num" style="padding:9px 0">${fmtMin(sc.maint)} / sem.</div></div>
    </div>
    <p class="muted" style="margin:0;font-size:.92rem">L'agenda range les quêtes par priorité, respecte ce qui doit être fini avant, les dates « pas avant » et laisse une semaine pour acheter le matériel manquant.</p>
  </section>
  <section class="sec">
    <div class="sec-head"><h2>12 prochaines semaines</h2></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Prête</span><span><i style="background:var(--amber)"></i>Achat avant</span></div>
    ${rows.length ? `<div class="gantt-wrap"><div class="gantt" style="grid-template-columns:150px repeat(${cols},50px)">${head}${body}</div></div>` : `<div class="empty">Aucune quête à planifier.</div>`}
    ${sc.later.length ? `<div class="box"><h2 style="font-size:10px">Au-delà de 12 semaines</h2><div style="margin-top:8px">${sc.later.map(t => esc(t.title)).join(" · ")}</div></div>` : ""}
  </section>`;
}

function viewEquipe() {
  const me = S.dev.me, week = iso(mondayOf(new Date()));
  const card = k => {
    const xp = xpOf(k), L = levelOf(xp);
    const n = Object.values(S.data.log).filter(l => (l.who === k || l.who === "tous") && l.date >= week).length;
    return `<div class="box trainer ${me === k ? "me" : ""}"><div class="pic">${mini(k, 4)}</div>
      <div class="tn">${esc(playerName(k).toUpperCase())}</div><div class="st">Niveau ${L.lv} · ${xp} XP</div>
      <div class="xpbar"><i style="width:${L.pct}%"></i></div><div class="st">${n} quête${n > 1 ? "s" : ""} cette semaine</div>
      <button class="btn small ${me === k ? "gold" : ""}" data-act="me" data-v="${k}">${me === k ? "C'EST MOI" : "JE SUIS " + esc(playerName(k).toUpperCase())}</button></div>`;
  };
  const sy = S.dev.sync, st = S.data.settings;
  return `
  <section class="sec"><h2>L'équipe</h2>
    <div class="cards">${card("lui")}${card("elodie")}</div>
    <div class="box"><div class="guide"><div class="portrait">${mini("balou", 3)}</div><div><div class="speaker">BALOU</div><div class="say">Chef de chantier, inspecteur du poulailler et gardien du sac de croquettes.</div></div></div></div>
  </section>
  <section class="box sec">
    <h2>Prénoms</h2>
    <div class="grid2">
      <div class="field"><label for="name-lui">Lui</label><input id="name-lui" type="text" value="${esc(st.players?.lui?.name || "")}" placeholder="Ton prénom"></div>
      <div class="field"><label for="name-elodie">Elle</label><input id="name-elodie" type="text" value="${esc(st.players?.elodie?.name || "Elodie")}"></div>
    </div>
    <button class="btn small" data-act="save-names" style="align-self:flex-start">Enregistrer</button>
  </section>
  <section class="box sec">
    <h2>Consignes pour Claude</h2>
    <p class="muted" style="margin:0;font-size:.92rem">Vos règles de fonctionnement. Elles sont ajoutées à chaque demande envoyée à Claude.</p>
    <div class="field"><label for="guide-txt">Consignes</label><textarea id="guide-txt" placeholder="Ex : je fais mes gardes de 24 h, le lendemain je suis fatigué. On évite les gros achats avant la naissance. Le bois est réservé à l'abri…">${esc(st.guide || "")}</textarea></div>
    <button class="btn small" data-act="save-guide" style="align-self:flex-start">Enregistrer</button>
  </section>
  <section class="box sec">
    <h2>Synchro entre vos téléphones</h2>
    <p class="muted" style="margin:0;font-size:.92rem">Les quêtes sont gardées dans un fichier d'un dépôt GitHub <b>privé</b>. Chaque téléphone a besoin d'un jeton GitHub limité à ce dépôt. Sans synchro, tout reste sur ce téléphone.</p>
    <div class="grid2">
      <div class="field"><label for="sy-owner">Compte</label><input id="sy-owner" type="text" value="${esc(sy.owner)}" autocapitalize="off"></div>
      <div class="field"><label for="sy-repo">Dépôt privé</label><input id="sy-repo" type="text" value="${esc(sy.repo)}" autocapitalize="off"></div>
    </div>
    <div class="field"><label for="sy-token">Jeton GitHub (reste sur ce téléphone)</label><input id="sy-token" type="password" value="${esc(sy.token)}" autocomplete="off" placeholder="github_pat_…"></div>
    <div class="row"><button class="btn small primary" data-act="sync-save">Connecter</button><button class="btn small" data-act="sync-now">Synchroniser</button></div>
    <div class="muted" style="font-size:.9rem"><span class="sync-dot ${S.sync.state === "ok" ? "ok" : S.sync.state === "err" ? "err" : ""}"></span>${esc(S.sync.msg)}</div>
  </section>
  <section class="box sec">
    <h2>Sauvegarde</h2>
    <div class="row"><button class="btn small" data-act="export">Exporter</button><button class="btn small" data-act="import">Importer</button><input type="file" id="import-file" accept="application/json" hidden></div>
  </section>`;
}

function render() {
  analyze(); renderHud();
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
  const v = { carte: viewCarte, quetes: viewQuetes, sac: viewSac, agenda: viewAgenda, equipe: viewEquipe }[S.tab] || viewCarte;
  const y = window.scrollY; $("#view").innerHTML = v(); window.scrollTo(0, y);
  hydrateSprites(document);
  if (!S.dev.me) setTimeout(firstRun, 50);
  paintMap();
}
function markers() {
  const m = {};
  tasksList().forEach(t => {
    if (t._.state !== "due" && t._.state !== "ready") return;
    const z = ZONE_RECTS[t.zone] ? t.zone : "Jardin";
    m[z] = m[z] || { zone: z, urgent: false };
    if (+t.urgency >= 3 || t._.overdue > 0) m[z].urgent = true;
  });
  return Object.values(m);
}
function paintMap() { const cv = $("#map"); if (cv) drawMap(cv, { markers: markers(), frame: S.frame }); }
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(() => { S.frame++; if (!document.hidden) paintMap(); }, 600);

/* ---------------- feuilles ---------------- */
function openSheet(html, onClick) {
  $("#sheet-root").innerHTML = `<div class="sheet-bg" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  hydrateSprites($("#sheet-root"));
  const sh = $(".sheet");
  if (onClick) sh.addEventListener("click", onClick);
  return sh;
}
function closeSheet() { $("#sheet-root").innerHTML = ""; }

function openZone(z) {
  const list = tasksList().filter(t => (ZONE_RECTS[t.zone] ? t.zone : "Jardin") === z && t._.state !== "done");
  const order = { due: 0, ready: 0, buy: 1, blocked: 2, wait: 3, ok: 4 };
  openSheet(`<div class="row" style="justify-content:space-between"><h2>${esc(z.toUpperCase())}</h2><button class="btn small" data-act="close">Fermer</button></div>
    ${list.length ? list.sort((a, b) => order[a._.state] - order[b._.state] || b._.score - a._.score).map(t => questRow(t)).join("") : `<div class="empty">Aucune quête ici. Tout est calme.</div>`}
    <button class="btn primary wide" data-act="wizard" data-zone="${esc(z)}">+ Nouvelle quête ici</button>`);
}

/* ---------- édition complète d'une quête ---------- */
function openEditor(id, preset = {}) {
  const t = id ? S.data.tasks[id] : { title: "", kind: "projet", zone: "Maison", project: "", duration: 60, urgency: 2, importance: 2, outdoor: false, deps: [], materials: [], status: "todo", everyDays: 7, lastDone: todayISO(), waitUntil: "", notes: "", assignee: "", ...preset };
  const projects = [...new Set(tasksList().map(x => x.project).filter(Boolean))];
  const others = tasksList().filter(x => x.id !== id && x.kind !== "entretien" && x.status !== "done");
  const mats = (t.materials || []).map(m => ({ ...m }));
  const sel = (n, opts, v) => `<select id="f-${n}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const lvl = [[1, "Faible"], [2, "Moyenne"], [3, "Forte"]];
  const sh = openSheet(`
    <div class="row" style="justify-content:space-between"><h2>${id ? "MODIFIER" : "NOUVELLE QUÊTE"}</h2><button class="btn small" data-act="close">Fermer</button></div>
    <div class="field"><label for="f-title">Intitulé</label><input id="f-title" type="text" value="${esc(t.title)}"></div>
    <div class="grid2"><div class="field"><label for="f-kind">Type</label>${sel("kind", Object.entries(KINDS), t.kind)}</div>
      <div class="field"><label for="f-zone">Zone</label>${sel("zone", ZONES.map(z => [z, z]), t.zone)}</div></div>
    <div class="grid2"><div class="field"><label for="f-assignee">Qui</label>${sel("assignee", [["", "Libre"], ["lui", playerName("lui")], ["elodie", playerName("elodie")], ["tous", "Ensemble"]], t.assignee || "")}</div>
      <div class="field" id="wrap-project"><label for="f-project">Projet</label><input id="f-project" type="text" list="dl-projects" value="${esc(t.project || "")}"><datalist id="dl-projects">${projects.map(p => `<option value="${esc(p)}">`).join("")}</datalist></div></div>
    <div class="grid3"><div class="field"><label for="f-duration">Durée (min)</label><input id="f-duration" type="number" min="5" step="5" value="${esc(t.duration || 60)}"></div>
      <div class="field"><label for="f-urgency">Urgence</label>${sel("urgency", lvl, t.urgency || 2)}</div>
      <div class="field"><label for="f-importance">Importance</label>${sel("importance", lvl, t.importance || 2)}</div></div>
    <label class="row"><input id="f-outdoor" type="checkbox" ${t.outdoor ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--accent)"> Se fait dehors</label>
    <div class="grid2" id="wrap-ent"><div class="field"><label for="f-every">Tous les (jours)</label><input id="f-every" type="number" min="1" value="${esc(t.everyDays || 7)}"></div>
      <div class="field"><label for="f-last">Fait la dernière fois</label><input id="f-last" type="date" value="${esc(t.lastDone || "")}"></div></div>
    <div id="wrap-proj" class="sec" style="gap:14px">
      <div class="grid2"><div class="field"><label for="f-status">Statut</label>${sel("status", [["todo", "À faire"], ["doing", "Commencée"], ["done", "Terminée"]], t.status || "todo")}</div>
        <div class="field"><label for="f-wait">Pas avant le</label><input id="f-wait" type="date" value="${esc(t.waitUntil || "")}"></div></div>
      <div class="field"><span class="flabel">Matériel et outils</span><div id="mats" class="sec" style="gap:6px"></div>
        <button class="btn small" data-act="mat-add" style="align-self:flex-start;margin-top:6px">+ Objet</button></div>
      <div class="field"><span class="flabel">À faire après</span>
        ${others.length ? `<div class="deplist">${others.map(o => `<label><input type="checkbox" value="${o.id}" ${(t.deps || []).includes(o.id) ? "checked" : ""} style="accent-color:var(--accent)">${esc(o.title)}</label>`).join("")}</div>` : `<div class="muted">Aucune autre quête.</div>`}</div>
    </div>
    <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes">${esc(t.notes || "")}</textarea></div>
    <div class="row" style="justify-content:space-between">${id ? `<button class="btn danger" data-act="del">Supprimer</button>` : "<span></span>"}<button class="btn primary" data-act="save">Enregistrer</button></div>`);
  const drawMats = () => {
    $("#mats").innerHTML = mats.length ? mats.map((m, i) => `<div class="mat">
      <input type="text" data-m="${i}" data-f="name" value="${esc(m.name)}" placeholder="Objet" aria-label="Objet">
      <input type="number" data-m="${i}" data-f="cost" value="${esc(m.cost ?? "")}" placeholder="€" aria-label="Prix">
      <select data-m="${i}" data-f="st" aria-label="État"><option value="buy" ${!m.have && !m.borrow ? "selected" : ""}>À acheter</option><option value="borrow" ${!m.have && m.borrow ? "selected" : ""}>À emprunter</option><option value="have" ${m.have ? "selected" : ""}>Je l'ai</option></select>
      <button class="btn small" data-act="mat-del" data-i="${i}" aria-label="Retirer">✕</button></div>`).join("") : `<div class="muted">Rien à prévoir.</div>`;
  };
  const toggle = () => { const ent = $("#f-kind").value === "entretien"; $("#wrap-ent").hidden = !ent; $("#wrap-proj").hidden = ent; $("#wrap-project").hidden = ent; };
  drawMats(); toggle();
  $("#f-kind").addEventListener("change", toggle);
  sh.addEventListener("input", e => { const i = e.target.dataset.m; if (i === undefined) return; const f = e.target.dataset.f; if (f === "st") { mats[i].have = e.target.value === "have"; mats[i].borrow = e.target.value === "borrow"; } else mats[i][f] = f === "cost" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; });
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act;
    if (act === "mat-add") { mats.push({ name: "", cost: "", have: false }); drawMats(); sh.querySelector(`[data-m="${mats.length - 1}"]`).focus(); }
    if (act === "mat-del") { mats.splice(+b.dataset.i, 1); drawMats(); }
    if (act === "del") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirmer"; return; }
      patchTask(id, { deleted: true }); closeSheet(); commit("Quête supprimée");
    }
    if (act === "save") {
      const title = $("#f-title").value.trim(); if (!title) { $("#f-title").focus(); toast("Donne un nom à la quête."); return; }
      const kind = $("#f-kind").value;
      const body = { ...(id ? S.data.tasks[id] : { id: uid(), createdAt: todayISO() }), title, kind, zone: $("#f-zone").value, assignee: $("#f-assignee").value,
        duration: +$("#f-duration").value || 30, urgency: +$("#f-urgency").value, importance: +$("#f-importance").value, outdoor: $("#f-outdoor").checked, notes: $("#f-notes").value.trim() };
      delete body._;
      if (kind === "entretien") Object.assign(body, { everyDays: +$("#f-every").value || 7, lastDone: $("#f-last").value || null, project: "", deps: [], materials: [], status: "todo" });
      else Object.assign(body, { project: $("#f-project").value.trim(), status: $("#f-status").value, waitUntil: $("#f-wait").value || "",
        deps: [...sh.querySelectorAll(".deplist input:checked")].map(x => x.value),
        materials: mats.filter(m => m.name && m.name.trim()).map(m => ({ name: m.name.trim(), cost: +m.cost || 0, have: !!m.have, borrow: !!m.borrow })) });
      putTask(body); closeSheet(); commit(id ? "Quête enregistrée" : "Quête ajoutée");
    }
  });
}

/* ---------- l'assistant Balou : il pose les questions une par une ---------- */
function openWizard(zone) {
  const W = { step: "title", title: "", zone: zone || "", kind: "", duration: 0, everyDays: 0, mats: [], matIdx: 0, deps: [], urgency: 2, importance: 2, waitUntil: "", assignee: "" };
  const opens = tasksList().filter(t => t.kind !== "entretien" && t.status !== "done");
  const box = html => `<div class="row" style="justify-content:space-between"><h2>NOUVELLE QUÊTE</h2><button class="btn small" data-act="close">Fermer</button></div>
    <div class="guide"><div class="portrait">${mini("balou", 3)}</div><div><div class="speaker">BALOU</div><div class="say" id="wz-say"></div></div></div>
    <div id="wz-body" class="sec"></div>`;
  const sh = openSheet(box());
  const say = h => { $("#wz-say").innerHTML = h; };
  const body = h => { $("#wz-body").innerHTML = h; hydrateSprites($("#wz-body")); const f = $("#wz-body input,#wz-body .choice"); if (f) f.focus(); };
  const choices = (arr, act) => `<div class="choices">${arr.map(([v, l]) => `<button class="choice" data-act="${act}" data-v="${esc(v)}">${l}</button>`).join("")}</div>`;
  const back = `<button class="btn small" data-act="wz-back" style="align-self:flex-start">◀ Retour</button>`;
  const hist = [];
  const go = (s, push = true) => { if (push) hist.push(W.step); W.step = s; step(); };

  function step() {
    const s = W.step;
    if (s === "title") {
      say("Wouf ! Qu'est-ce que tu as en tête ? Dis-le simplement, je m'occupe du reste.");
      body(`<div class="field"><label for="wz-title">La quête</label><input id="wz-title" type="text" value="${esc(W.title)}" placeholder="Ex : recoller le liège de l'entrée"></div>
        <button class="btn primary" data-act="wz-title">Suivant ▶</button>`);
    } else if (s === "zone") {
      say(`« ${esc(W.title)} ». Ça se passe où ?`);
      body(choices(ZONES.map(z => [z, z]), "wz-zone") + back);
    } else if (s === "kind") {
      say("C'est quel genre de quête ?");
      body(choices([["projet", "Un projet, une construction"], ["reparation", "Une réparation"], ["entretien", "Une corvée qui revient régulièrement"]], "wz-kind") + back);
    } else if (s === "every") {
      say("Elle revient tous les combien ?");
      body(choices([[1, "Tous les jours"], [2, "Tous les 2 jours"], [7, "Chaque semaine"], [14, "Toutes les 2 semaines"], [30, "Chaque mois"], [90, "Chaque trimestre"], [180, "Deux fois par an"], [365, "Une fois par an"]], "wz-every") + back);
    } else if (s === "duration") {
      say("Ça va te prendre combien de temps, à peu près ?");
      body(choices([[15, "Un quart d'heure"], [30, "Une demi-heure"], [60, "Une heure"], [120, "Deux heures"], [240, "Une demi-journée"], [420, "Une journée"], [960, "Plusieurs jours"]], "wz-duration") + back);
    } else if (s === "mats") {
      say(W.mats.length ? `Noté : <b>${W.mats.map(m => esc(m.name)).join(", ")}</b>. Il te faut autre chose ? Pense aux outils, à la visserie, aux consommables.`
        : "De quoi tu as besoin pour la faire ? Matériel, outils, fournitures… Ajoute-les un par un.");
      body(`<div class="field"><label for="wz-mat">Objet nécessaire</label><input id="wz-mat" type="text" placeholder="Ex : colle contact, spatule crantée"></div>
        <div class="row"><button class="btn" data-act="wz-mat-add">+ Ajouter</button><button class="btn primary" data-act="wz-mat-done">${W.mats.length ? "C'est tout ▶" : "Rien de spécial ▶"}</button></div>${back}`);
    } else if (s === "have") {
      const m = W.mats[W.matIdx];
      say(`Et <b>${esc(m.name)}</b>, tu l'as déjà ?`);
      body(choices([["have", "Oui, je l'ai"], ["buy", "Non, il faut l'acheter"], ["borrow", "Je peux l'emprunter"], ["unsure", "Je ne sais pas, je vérifie"]], "wz-have") + back);
    } else if (s === "cost") {
      const m = W.mats[W.matIdx];
      say(`Combien coûte <b>${esc(m.name)}</b>, environ ?`);
      body(choices([[5, "Moins de 10 €"], [20, "Une vingtaine d'euros"], [50, "Autour de 50 €"], [100, "Une centaine d'euros"], [250, "Entre 200 et 300 €"], [500, "500 € ou plus"]], "wz-cost") +
        `<div class="row"><div class="field" style="flex:1"><label for="wz-cost-n">Montant précis (€)</label><input id="wz-cost-n" type="number" min="0"></div><button class="btn" data-act="wz-cost-n" style="align-self:flex-end">OK</button></div>${back}`);
    } else if (s === "deps") {
      say("Il faut finir une autre quête avant de pouvoir commencer celle-ci ?");
      body(opens.length ? `<div class="choices">${opens.map(o => `<button class="choice ${W.deps.includes(o.id) ? "on" : ""}" data-act="wz-dep" data-v="${o.id}">${esc(o.title)}</button>`).join("")}</div>
        <button class="btn primary" data-act="wz-deps-done">${W.deps.length ? "Valider ▶" : "Non, rien avant ▶"}</button>${back}` : `<button class="btn primary" data-act="wz-deps-done">Suivant ▶</button>`);
    } else if (s === "when") {
      say("C'est pour quand ?");
      body(choices([["3", "Urgent, cette semaine"], ["2", "Dans le mois"], ["1", "Pas pressé"], ["date", "Pas avant une date (saison, livraison…)"]], "wz-when") + back);
    } else if (s === "date") {
      say("À partir de quand on peut s'y mettre ?");
      body(`<div class="field"><label for="wz-date">Pas avant le</label><input id="wz-date" type="date" min="${todayISO()}"></div><button class="btn primary" data-act="wz-date">Suivant ▶</button>${back}`);
    } else if (s === "importance") {
      say("Et ça compte beaucoup pour vous deux ?");
      body(choices([["3", "Oui, c'est important"], ["2", "Moyennement"], ["1", "C'est du bonus"]], "wz-imp") + back);
    } else if (s === "who") {
      say("Qui s'en occupe ?");
      body(choices([["lui", esc(playerName("lui"))], ["elodie", esc(playerName("elodie"))], ["tous", "On la fait ensemble"], ["", "On verra"]], "wz-who") + back);
    } else if (s === "summary") {
      const miss = W.mats.filter(m => !m.have), cost = miss.filter(m => !m.borrow).reduce((s, m) => s + (+m.cost || 0), 0);
      const unsure = W.mats.filter(m => m.unsure);
      let verdict;
      if (W.waitUntil) verdict = `Elle attendra le <b>${fmtDate(W.waitUntil)}</b>.`;
      else if (W.deps.length) verdict = `Elle se débloquera après : <b>${W.deps.map(d => esc(S.data.tasks[d].title)).join(", ")}</b>.`;
      else if (miss.length) verdict = `Il te manque <b>${miss.map(m => esc(m.name)).join(", ")}</b>${cost ? ` (≈ ${fmtEur(cost)})` : ""}. Je le range dans le Sac.`;
      else verdict = "Tu as tout ce qu'il faut : elle est <b>faisable tout de suite</b> !";
      if (unsure.length) verdict += ` Pense à vérifier si tu as ${unsure.map(m => esc(m.name)).join(", ")} : je l'ai noté à acheter en attendant.`;
      say(`Récap ! ${verdict}`);
      body(`<div class="box" style="box-shadow:none"><div class="t" style="font-weight:700">${esc(W.title)}</div>
        <div class="muted" style="font-size:.92rem;margin-top:4px">${esc([W.zone, KINDS[W.kind], fmtMin(W.duration), W.kind === "entretien" ? "tous les " + W.everyDays + " j" : "", W.assignee === "tous" ? "Ensemble" : W.assignee ? playerName(W.assignee) : ""].filter(Boolean).join(" · "))}</div>
        ${W.mats.length ? `<div style="margin-top:6px;font-size:.95rem">${W.mats.map(m => esc(m.name) + (m.have ? " ✓" : m.borrow ? " (emprunt)" : m.cost ? " (" + fmtEur(m.cost) + ")" : "")).join(" · ")}</div>` : ""}</div>
        <button class="btn primary" data-act="wz-save">Enregistrer la quête</button>${back}`);
    }
  }
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, v = b.dataset.v;
    if (a === "wz-back") { if (hist.length) { W.step = hist.pop(); step(); } return; }
    if (a === "wz-title") { const t = $("#wz-title").value.trim(); if (!t) { toast("Dis-moi ce que tu as en tête."); return; } W.title = t; go(W.zone ? "kind" : "zone"); }
    if (a === "wz-zone") { W.zone = v; go("kind"); }
    if (a === "wz-kind") { W.kind = v; go(v === "entretien" ? "every" : "duration"); }
    if (a === "wz-every") { W.everyDays = +v; go("duration"); }
    if (a === "wz-duration") { W.duration = +v; go(W.kind === "entretien" ? "who" : "mats"); }
    if (a === "wz-mat-add") { const n = $("#wz-mat").value.trim(); if (n) { W.mats.push({ name: n }); step(); } }
    if (a === "wz-mat-done") { const n = $("#wz-mat").value.trim(); if (n) W.mats.push({ name: n }); W.matIdx = 0; go(W.mats.length ? "have" : "deps"); }
    if (a === "wz-have") {
      const m = W.mats[W.matIdx]; m.have = v === "have"; m.borrow = v === "borrow"; m.unsure = v === "unsure"; m.cost = 0;
      if (v === "buy" || v === "unsure") return go("cost");
      nextMat();
    }
    if (a === "wz-cost") { W.mats[W.matIdx].cost = +v; nextMat(); }
    if (a === "wz-cost-n") { W.mats[W.matIdx].cost = +$("#wz-cost-n").value || 0; nextMat(); }
    if (a === "wz-dep") { W.deps = W.deps.includes(v) ? W.deps.filter(x => x !== v) : [...W.deps, v]; b.classList.toggle("on"); }
    if (a === "wz-deps-done") go("when");
    if (a === "wz-when") { if (v === "date") return go("date"); W.urgency = +v; W.waitUntil = ""; go("importance"); }
    if (a === "wz-date") { W.waitUntil = $("#wz-date").value || ""; W.urgency = 1; go("importance"); }
    if (a === "wz-imp") { W.importance = +v; go("who"); }
    if (a === "wz-who") { W.assignee = v; go("summary"); }
    if (a === "wz-save") {
      const ent = W.kind === "entretien";
      const t = { id: uid(), createdAt: todayISO(), title: W.title, kind: W.kind, zone: W.zone, project: "", duration: W.duration, urgency: W.urgency, importance: W.importance,
        outdoor: W.zone !== "Maison", assignee: W.assignee, status: "todo", notes: "", deps: ent ? [] : W.deps, waitUntil: ent ? "" : W.waitUntil,
        materials: ent ? [] : W.mats.map(m => ({ name: m.name, cost: m.cost || 0, have: !!m.have, borrow: !!m.borrow })) };
      if (ent) Object.assign(t, { everyDays: W.everyDays, lastDone: todayISO() });
      putTask(t); closeSheet(); commit("Nouvelle quête : " + W.title);
    }
  });
  sh.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "wz-title") { e.preventDefault(); sh.querySelector('[data-act="wz-title"]').click(); }
    if (e.target.id === "wz-mat") { e.preventDefault(); sh.querySelector('[data-act="wz-mat-add"]').click(); }
  });
  function nextMat() { W.matIdx++; if (W.matIdx < W.mats.length) go("have"); else go("deps"); }
  step();
}

/* ---------- pont vers Claude (sans clé API) ---------- */
function stateForClaude() {
  return tasksList().filter(t => t._.state !== "done").map(t => {
    const a = t._, o = { id: t.id, titre: t.title, type: t.kind, zone: t.zone, minutes: +t.duration || 0, etat: STATE_LABEL[a.state] };
    if (t.assignee) o.qui = t.assignee === "tous" ? "ensemble" : playerName(t.assignee);
    if (t.kind === "entretien") { o.tous_les_jours = t.everyDays; if (a.overdue) o.retard_jours = a.overdue; }
    else { if (a.missing.length) o.manque = a.missing.map(m => m.name + (m.cost ? " ~" + m.cost + "€" : "")); if (a.blockers.length) o.attend = a.blockers.map(b => S.data.tasks[b].title); if (t.waitUntil) o.pas_avant = t.waitUntil; if (t.project) o.projet = t.project; }
    return o;
  });
}
function claudePrompt(ask) {
  const lui = playerName("lui"), elle = playerName("elodie"), c = S.dev.ctx;
  return `Tu es Balou, le guide de l'appli « Maison de Saucats » : la gestion de la maison de ${lui} et ${elle} (et de Balou, leur berger blanc suisse), à Saucats en Gironde. Maison bois avec terrasse, piscine non finie, abri en construction, potager, poulailler et puits.
${S.data.settings.guide ? "\nConsignes du foyer :\n" + S.data.settings.guide + "\n" : ""}
C'est ${S.dev.me ? playerName(S.dev.me) : lui} qui écrit. Aujourd'hui (${todayISO()}) : ${fmtMin(c.time)} de dispo, ${{ all: "dedans ou dehors", in: "dedans", out: "dehors" }[c.where]}, ${{ normal: "en forme", tired: "fatigué après une garde", off: "jour de récupération" }[c.energy]}.

Ma demande : ${ask || "(je t'explique dans le message suivant)"}

Quêtes actuelles de l'appli (JSON) :
${JSON.stringify(stateForClaude())}

Méthode : pose-moi tes questions une par une avant de planifier. De quoi j'ai besoin (matériel, outils, consommables), est-ce que je l'ai déjà, où l'acheter ou l'emprunter, combien de temps ça prend, ce qu'il faut finir avant, l'urgence, qui s'en occupe. Tiens compte du budget, de la météo et de ce qui débloque d'autres quêtes.
Quand tout est clair, donne-moi le plan, puis termine par un bloc \`\`\`json contenant un tableau des NOUVELLES quêtes à ajouter dans l'appli, au format :
[{"title":"…","kind":"projet|reparation|entretien","zone":"${ZONES.join("|")}","project":"…","duration":60,"urgency":1-3,"importance":1-3,"outdoor":true,"assignee":"lui|elodie|tous|","materials":[{"name":"…","cost":20,"have":false,"borrow":false}],"deps":["id existant ou titre d'une nouvelle quête"],"everyDays":null,"waitUntil":"AAAA-MM-JJ ou vide"}]`;
}
function openClaude() {
  const sh = openSheet(`
    <div class="row" style="justify-content:space-between"><h2>DEMANDER À CLAUDE</h2><button class="btn small" data-act="close">Fermer</button></div>
    <div class="guide"><div class="portrait">${mini("balou", 3)}</div><div><div class="speaker">BALOU</div><div class="say">Explique ton idée. J'envoie tout l'état de la maison à Claude, il te pose ses questions, puis il te donne un bloc de quêtes à recoller ici.</div></div></div>
    <div class="field"><label for="cl-ask">Ce que tu as en tête</label><textarea id="cl-ask" placeholder="Ex : j'aimerais finir l'abri avant la naissance, mais le bois est cher. Planifie-moi ça."></textarea></div>
    <button class="btn primary" data-act="cl-go">1 · Ouvrir Claude</button>
    <p class="muted" style="margin:0;font-size:.9rem">La demande est aussi copiée : si Claude s'ouvre vide, colle-la.</p>
    <div class="field"><label for="cl-back">2 · Colle ici la réponse finale de Claude</label><textarea id="cl-back" placeholder="Colle tout le message, je retrouve le bloc json."></textarea></div>
    <button class="btn" data-act="cl-parse">Lire les quêtes</button>
    <div id="cl-preview" class="sec"></div>`);
  let items = [];
  sh.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "cl-go") {
      const p = claudePrompt($("#cl-ask").value.trim());
      try { await navigator.clipboard.writeText(p); } catch (err) { }
      const url = "https://claude.ai/new?q=" + encodeURIComponent(p);
      window.open(url.length < 7500 ? url : "https://claude.ai/new", "_blank", "noopener");
    }
    if (b.dataset.act === "cl-parse") {
      items = parseClaude($("#cl-back").value);
      $("#cl-preview").innerHTML = items.length ? `${items.map((x, i) => `<label class="quest" style="grid-template-columns:auto 1fr;padding-left:10px"><input type="checkbox" data-i="${i}" checked style="width:22px;height:22px;accent-color:var(--accent)"><span class="body"><span class="t">${esc(x.title)}</span><span class="meta" style="display:block">${esc([KINDS[x.kind], x.zone, fmtMin(x.duration), (x.materials || []).map(m => m.name).join(", ")].filter(Boolean).join(" · "))}</span></span></label>`).join("")}
        <button class="btn primary" data-act="cl-add">Ajouter les quêtes cochées</button>` : `<div class="empty">Je ne trouve pas de bloc json valide dans ce texte.</div>`;
    }
    if (b.dataset.act === "cl-add") {
      const keep = [...sh.querySelectorAll("#cl-preview input:checked")].map(x => items[+x.dataset.i]);
      const n = addImported(keep); closeSheet(); commit(n + " quête" + (n > 1 ? "s" : "") + " ajoutée" + (n > 1 ? "s" : ""));
    }
  });
}
function parseClaude(text) {
  if (!text) return [];
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
  const cands = blocks.length ? blocks.reverse() : [text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)];
  for (const c of cands) { try { const a = JSON.parse(c); if (Array.isArray(a)) return a.filter(x => x && x.title); } catch (e) { } }
  return [];
}
function addImported(arr) {
  const ids = arr.map(() => uid()), byTitle = {};
  arr.forEach((x, i) => byTitle[String(x.title).toLowerCase()] = ids[i]);
  arr.forEach((x, i) => {
    const kind = KINDS[x.kind] ? x.kind : "projet", ent = kind === "entretien";
    const deps = ent ? [] : (x.deps || []).map(d => String(d)).map(d => S.data.tasks[d] && !S.data.tasks[d].deleted ? d : byTitle[d.toLowerCase()]).filter(Boolean);
    const t = { id: ids[i], createdAt: todayISO(), title: String(x.title).slice(0, 140), kind, zone: ZONES.includes(x.zone) ? x.zone : "Maison", project: ent ? "" : String(x.project || ""),
      duration: Math.max(5, +x.duration || 30), urgency: Math.min(3, Math.max(1, +x.urgency || 2)), importance: Math.min(3, Math.max(1, +x.importance || 2)),
      outdoor: !!x.outdoor, assignee: ["lui", "elodie", "tous"].includes(x.assignee) ? x.assignee : "", status: "todo", notes: "", deps,
      materials: ent ? [] : (x.materials || []).filter(m => m && m.name).map(m => ({ name: String(m.name), cost: +m.cost || 0, have: !!m.have, borrow: !!m.borrow })),
      waitUntil: /^\d{4}-\d{2}-\d{2}$/.test(x.waitUntil || "") ? x.waitUntil : "" };
    if (ent) Object.assign(t, { everyDays: Math.max(1, +x.everyDays || 7), lastDone: todayISO() });
    putTask(t);
  });
  return arr.length;
}

/* ---------- premier lancement ---------- */
function firstRun() {
  if ($("#sheet-root").innerHTML) return;
  openSheet(`<div class="guide"><div class="portrait">${mini("balou", 3)}</div><div><div class="speaker">BALOU</div><div class="say">Wouf ! Bienvenue à la Maison de Saucats. Qui tient ce téléphone ?</div></div></div>
    <div class="cards"><button class="box trainer" data-act="me" data-v="lui"><span class="pic">${mini("lui", 4)}</span><span class="tn">${esc(playerName("lui").toUpperCase())}</span></button>
    <button class="box trainer" data-act="me" data-v="elodie"><span class="pic">${mini("elodie", 4)}</span><span class="tn">${esc(playerName("elodie").toUpperCase())}</span></button></div>`);
}

/* ---------------- synchro GitHub ---------------- */
const b64enc = s => { const by = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = c => new TextDecoder().decode(Uint8Array.from(atob(c.replace(/\s/g, "")), ch => ch.charCodeAt(0)));
const canon = o => JSON.stringify(o, (k, v) => k === "_" ? undefined : (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v));
function mergeData(a, b) {
  if (!b) return a;
  const out = { v: 1, tasks: {}, log: { ...(b.log || {}), ...(a.log || {}) }, settings: null };
  const ids = new Set([...Object.keys(a.tasks || {}), ...Object.keys(b.tasks || {})]);
  ids.forEach(id => { const x = a.tasks?.[id], y = b.tasks?.[id]; out.tasks[id] = !x ? y : !y ? x : ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x); });
  out.settings = ((b.settings?.updatedAt || 0) > (a.settings?.updatedAt || 0)) ? b.settings : a.settings;
  return out;
}
const syncOn = () => S.dev.sync.token && S.dev.sync.owner && S.dev.sync.repo;
const apiUrl = () => `https://api.github.com/repos/${encodeURIComponent(S.dev.sync.owner)}/${encodeURIComponent(S.dev.sync.repo)}/contents/${S.dev.sync.path || "maison.json"}`;
const ghHeaders = () => ({ Authorization: "Bearer " + S.dev.sync.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
async function ghGet() {
  const r = await fetch(apiUrl() + "?t=" + Date.now(), { headers: ghHeaders(), cache: "no-store" });
  if (r.status === 404) return { data: null, sha: null, missing: true };
  if (!r.ok) throw { status: r.status };
  const j = await r.json();
  return { data: JSON.parse(b64dec(j.content)), sha: j.sha };
}
async function ghPut(data, sha) {
  const clean = JSON.parse(canon(data));
  const r = await fetch(apiUrl(), { method: "PUT", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Quêtes mises à jour par " + playerName(S.dev.me || "lui"), content: b64enc(JSON.stringify(clean, null, 1)), ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw { status: r.status };
  return (await r.json()).content.sha;
}
let syncTimer = null, syncing = false;
function scheduleSync() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(doSync, 1500); }
function setSync(state, msg) { S.sync.state = state; S.sync.msg = msg; renderHud(); const el = document.querySelector('[data-act="sync-now"]'); if (el && S.tab === "equipe") render(); }
async function doSync(tries = 2) {
  if (!syncOn() || syncing) return;
  syncing = true; setSync("busy", "Synchronisation…");
  try {
    const remote = await ghGet();
    const merged = mergeData(S.data, remote.data);
    if (!remote.data || canon(merged) !== canon(remote.data)) S.sync.sha = await ghPut(merged, remote.sha);
    else S.sync.sha = remote.sha;
    const changed = canon(merged) !== canon(S.data);
    S.data = merged; lsSet("maison-data", S.data);
    S.sync.dirty = false; lsSet("maison-dirty", false);
    syncing = false;
    setSync("ok", "Synchronisé à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    if (changed && !$("#sheet-root").innerHTML) render();
  } catch (e) {
    syncing = false;
    if ((e.status === 409 || e.status === 422) && tries > 1) return doSync(tries - 1);
    const m = e.status === 401 ? "Jeton refusé : vérifie-le ou crée-en un nouveau."
      : e.status === 403 ? "Le jeton n'a pas le droit d'écrire dans ce dépôt (Contents : lecture et écriture)."
      : e.status === 404 ? "Dépôt introuvable : vérifie le nom et que le jeton y a accès."
      : "Pas de connexion : les changements restent sur ce téléphone et partiront plus tard.";
    setSync("err", m);
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) doSync(); });
window.addEventListener("online", () => doSync());
setInterval(() => { if (!document.hidden) doSync(); }, 90000);

/* ---------------- événements ---------------- */
function toast(msg, kind = "") { const t = $("#toast"); t.textContent = msg; t.className = "toast " + kind; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, kind === "xp" ? 3500 : 2600); }
const TABS = ["carte", "quetes", "sac", "agenda", "equipe"];
function go(t) { if (!TABS.includes(t)) t = "carte"; S.tab = t; if (location.hash !== "#" + t) history.replaceState(null, "", "#" + t); window.scrollTo(0, 0); render(); }

document.addEventListener("click", e => {
  const tab = e.target.closest("nav.tabs button"); if (tab) return go(tab.dataset.tab);
  if (e.target.dataset && e.target.dataset.close) return closeSheet();
  if (e.target.id === "map") {
    const r = e.target.getBoundingClientRect();
    return openZone(zoneAt((e.clientX - r.left) * MAP_W / r.width, (e.clientY - r.top) * MAP_H / r.height));
  }
  const ctx = e.target.closest("[data-ctx]");
  if (ctx) { const k = ctx.dataset.ctx; S.dev.ctx[k] = k === "time" ? +ctx.dataset.v : ctx.dataset.v; saveDev(); return render(); }
  const f = e.target.closest("[data-filter]"); if (f) { S.filter = f.dataset.filter; return render(); }
  const p = e.target.closest("[data-pocket]"); if (p) { S.pocket = p.dataset.pocket; return render(); }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "close") closeSheet();
  else if (act === "edit") openEditor(a.dataset.id);
  else if (act === "done") { closeSheet(); completeTask(a.dataset.id); }
  else if (act === "wizard") { closeSheet(); openWizard(a.dataset.zone || ""); }
  else if (act === "claude") openClaude();
  else if (act === "me") { S.dev.me = a.dataset.v; saveDev(); closeSheet(); render(); }
  else if (act === "unbuy") setBought(a.dataset.key, false);
  else if (act === "save-names") {
    const st = { ...S.data.settings, players: { lui: { name: $("#name-lui").value.trim() }, elodie: { name: $("#name-elodie").value.trim() || "Elodie" } }, updatedAt: Date.now() };
    S.data.settings = st; commit("Prénoms enregistrés");
  }
  else if (act === "save-guide") { S.data.settings = { ...S.data.settings, guide: $("#guide-txt").value.trim(), updatedAt: Date.now() }; commit("Consignes enregistrées"); }
  else if (act === "sync-save") {
    S.dev.sync = { ...S.dev.sync, owner: $("#sy-owner").value.trim(), repo: $("#sy-repo").value.trim(), token: $("#sy-token").value.trim() };
    saveDev(); doSync();
  }
  else if (act === "sync-now") doSync();
  else if (act === "export") {
    const blob = new Blob([JSON.stringify(JSON.parse(canon(S.data)), null, 1)], { type: "application/json" });
    const u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = "maison-saucats-" + todayISO() + ".json"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  else if (act === "import") $("#import-file").click();
});
document.addEventListener("change", e => {
  if (e.target.dataset.act === "bought" && e.target.checked) setBought(e.target.dataset.key, true);
  if (e.target.id === "weekly") { S.data.settings = { ...S.data.settings, weeklyHours: Math.max(1, Math.min(60, +e.target.value || 4)), updatedAt: Date.now() }; commit("Agenda recalculé"); }
  if (e.target.id === "import-file" && e.target.files[0]) {
    e.target.files[0].text().then(txt => { try { const d = JSON.parse(txt); if (!d.tasks) throw 0; S.data = mergeData(S.data, d); commit("Sauvegarde importée"); } catch (err) { toast("Ce fichier n'est pas une sauvegarde de l'appli."); } });
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("#sheet-root").innerHTML) closeSheet();
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-act="edit"]')) { e.preventDefault(); openEditor(e.target.dataset.id); }
});
function setBought(key, have) {
  tasksList().forEach(t => {
    if (!(t.materials || []).some(m => m.name && m.name.trim().toLowerCase() === key)) return;
    patchTask(t.id, { materials: t.materials.map(m => m.name && m.name.trim().toLowerCase() === key ? { ...m, have } : m) });
  });
  commit(have ? "Rangé dans le sac" : "Remis dans la liste d'achats");
}
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== S.tab) { S.tab = h; render(); } });

/* ---------------- démarrage ---------------- */
{ const h = location.hash.slice(1); if (TABS.includes(h)) S.tab = h; }
render();
if (syncOn()) doSync();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
