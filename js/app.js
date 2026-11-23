/* Maison de Saucats — les tâches de la maison, pièce par pièce. Tout tourne dans le téléphone ;
   la synchro passe par un fichier JSON dans un dépôt GitHub privé. */
"use strict";

const KINDS = { projet: "Projet", reparation: "Réparation", entretien: "Entretien" };
const STATE_LABEL = { ready: "Faisable", buy: "Il manque du matériel", blocked: "Après une autre tâche", wait: "Plus tard", done: "Terminée", due: "À faire", ok: "À jour" };
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const hasDay = t => t.weekday !== undefined && t.weekday !== null && t.weekday !== "";
const rhythm = t => hasDay(t) ? "chaque " + DAYS[+t.weekday] + (t.evening ? " soir" : "") : (+t.everyDays === 1 ? "tous les jours" : "tous les " + (t.everyDays || 7) + " j");
const TALK_URL_DEFAULT = "https://claude.ai/code/session_01PaT4dfmjKr2KoFCZipNkpg"; // la conversation avec Claude où Baptiste dicte les tâches
const talkUrl = () => (S.data.settings.talkUrl || TALK_URL_DEFAULT);
const ZONE_TO_PLACE = { Maison: "maison", Jardin: "jardin", Piscine: "piscine", Abri: "abri", Potager: "potager", Poulailler: "poulailler", Puits: "puits", "Garage / atelier": "abri" };

/* ---------------- utilitaires ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function iso8(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const todayISO = () => iso8(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
function fmtMin(m) { m = +m || 0; if (m < 60) return m + " min"; const h = Math.floor(m / 60), r = m % 60; return h + " h" + (r ? String(r).padStart(2, "0") : ""); }
const fmtEur = n => (+n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
const fmtDate = s => s ? new Date(s + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
const placeOf = t => (t.place && PLACES[t.place]) ? t.place : (ZONE_TO_PLACE[t.zone] || "maison");
const placeName = id => (PLACES[id] || PLACES.maison).name;
const isOutdoor = t => PLACES[placeOf(t)].level === "ext" || !!PLACES[placeOf(t)].out;

/* ---------------- données ---------------- */
function freshData() {
  const tasks = {};
  SEED_TASKS.forEach(t => tasks[t.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...t, updatedAt: 0 });
  return { v: 6, tasks, log: {}, settings: { weeklyHours: 4, guide: "", players: { lui: { name: "Baptiste" }, elodie: { name: "Elodie" } }, updatedAt: 0 } };
}
function migrate(d) {
  if (!d || !d.tasks) return freshData();
  if ((d.v || 1) < 2) {
    Object.values(d.tasks).forEach(t => {
      const seed = SEED_TASKS.find(s => s.id === t.id);
      let ch = false;
      if (!t.place) { t.place = seed?.place || ZONE_TO_PLACE[t.zone] || "maison"; ch = true; }
      if (/Balou/.test(t.title)) { t.title = t.title.replace(/Balou/g, "Baloo"); ch = true; }
      if (ch) t.updatedAt = Date.now();
    });
    const p = d.settings.players || {};
    if (!p.lui?.name) { d.settings.players = { ...p, lui: { name: "Baptiste" }, elodie: p.elodie || { name: "Elodie" } }; d.settings.updatedAt = Date.now(); }
    d.v = 2;
  }
  if (d.v < 3) {
    // projets du moment (23/11/2026) : on ajoute ceux qui manquent, sans toucher à ce qui existe
    SEED_TASKS.forEach(s => { if (!d.tasks[s.id]) d.tasks[s.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...s, updatedAt: Date.now() }; });
    const l = d.tasks["t-liege"], s = SEED_TASKS.find(x => x.id === "t-liege");
    if (l && l.place === "maison" && l.status !== "done") Object.assign(l, { place: s.place, title: s.title, duration: s.duration, zone: s.zone, updatedAt: Date.now() });
    d.v = 3;
  }
  if (d.v < 4) {
    // extérieur (23/11/2026) : nouvelles tâches, et mise à jour des tâches de départ encore jamais modifiées
    const OLD = { "t-abri": "Terminer la structure de l'abri", "t-abri-toit": "Couvrir le toit de l'abri", "t-allee": "Faire l'allée en gravier" };
    SEED_TASKS.forEach(s => {
      const cur = d.tasks[s.id];
      if (!cur) d.tasks[s.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...s, updatedAt: Date.now() };
      else if (OLD[s.id] && cur.title === OLD[s.id] && cur.status !== "done") d.tasks[s.id] = { ...cur, ...s, updatedAt: Date.now() };
    });
    d.v = 4;
  }
  if (d.v < 5) {
    SEED_TASKS.forEach(s => { if (!d.tasks[s.id]) d.tasks[s.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...s, updatedAt: Date.now() }; });
    if (d.tasks["e-aspi"]) Object.assign(d.tasks["e-aspi"], { everyDays: 1, title: "Passer l'aspirateur", updatedAt: Date.now() });
    d.v = 5;
  }
  // tâches dictées dans la conversation : ajoutées si absentes (une tâche supprimée dans l'appli reste supprimée)
  SEED_TASKS.forEach(s => { if (!d.tasks[s.id]) d.tasks[s.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...s, updatedAt: Date.now() }; });
  d.applied = d.applied || {};
  (typeof SEED_PATCHES !== "undefined" ? SEED_PATCHES : []).forEach(p => {
    if (d.applied[p.key] || !d.tasks[p.id]) return;
    Object.assign(d.tasks[p.id], p.set, { updatedAt: Date.now() }); d.applied[p.key] = 1;
    if (p.log) { const lid = "log-" + p.key; d.log = d.log || {}; d.log[lid] = { id: lid, taskId: p.id, title: d.tasks[p.id].title, minutes: +d.tasks[p.id].duration || 0, place: d.tasks[p.id].place, kind: d.tasks[p.id].kind, ...p.log }; }
  });
  if (d.v < 6) {
    SEED_TASKS.forEach(s => { if (!d.tasks[s.id]) d.tasks[s.id] = { deps: [], materials: [], status: "todo", notes: "", assignee: "", ...s, updatedAt: Date.now() }; });
    d.v = 6;
  }
  return d;
}
const S = {
  data: migrate(lsGet("maison-data", null)),
  dev: Object.assign({ me: "", sync: { owner: "Batex23", repo: "maison-saucats-data", path: "maison.json", token: "" }, ctx: { time: 60, where: "all", energy: "normal" }, level: "rdc" }, lsGet("maison-device", {})),
  tab: "maison", room: null, filter: "actives", pocket: "now",
  sync: { state: "off", msg: "Synchro non configurée", dirty: lsGet("maison-dirty", false) }
};
if (!["rdc", "etage", "ext"].includes(S.dev.level)) S.dev.level = "rdc";
lsSet("maison-data", S.data);
const saveDev = () => lsSet("maison-device", S.dev);
function playerName(k) { const p = S.data.settings.players || {}; return k === "elodie" ? (p.elodie?.name || "Elodie") : k === "lui" ? (p.lui?.name || "Baptiste") : "Baloo"; }
const tasksList = () => Object.values(S.data.tasks).filter(t => !t.deleted);

function commit(msg) {
  lsSet("maison-data", S.data);
  S.sync.dirty = true; lsSet("maison-dirty", true);
  render();
  if (msg) toast(msg);
  scheduleSync();
}
function putTask(t) { t.updatedAt = Date.now(); S.data.tasks[t.id] = t; }
function patchTask(id, patch) { putTask({ ...S.data.tasks[id], ...patch }); }

function completeTask(id) {
  const t = S.data.tasks[id]; if (!t) return;
  const before = { ...t }, who = S.dev.me || "lui", lid = uid();
  S.data.log[lid] = { id: lid, taskId: id, title: t.title, who, date: todayISO(), minutes: +t.duration || 0, place: placeOf(t), kind: t.kind, pts: pointsFor(t.duration, t.kind) };
  let extra = "";
  if (t.kind === "entretien") patchTask(id, { lastDone: todayISO() });
  else {
    patchTask(id, { status: "done", doneAt: todayISO(), doneBy: who });
    const unl = tasksList().filter(x => (x.deps || []).includes(id) && x.status !== "done" && (x.deps || []).every(d => !S.data.tasks[d] || S.data.tasks[d].status === "done"));
    if (unl.length) extra = " Ça débloque : " + unl.map(x => x.title).join(", ") + ".";
  }
  commit();
  celebrate(t, extra, () => { S.data.log[lid] = { ...S.data.log[lid], deleted: true }; putTask({ ...before }); commit("Annulé"); });
}
/* Points : plus une tâche est longue, plus elle rapporte ; les projets et réparations valent 1,5 fois plus que l'entretien. */
const pointsFor = (minutes, kind) => Math.round((5 + Math.round((+minutes || 15) / 6)) * (kind === "entretien" ? 1 : 1.5));
const logPts = l => l.pts ?? pointsFor(l.minutes ?? (S.data.tasks[l.taskId] || {}).duration, l.kind ?? (S.data.tasks[l.taskId] || {}).kind);
function yearPoints(year) {
  const r = { lui: 0, elodie: 0 };
  logList().filter(l => l.date.startsWith(String(year))).forEach(l => { if (l.who === "elodie") r.elodie += logPts(l); else r.lui += logPts(l); });
  return r;
}
const logList = () => Object.values(S.data.log || {}).filter(l => !l.deleted && l.date);
function weekStats(offset = 0) {
  const start = mondayOf(new Date()); start.setDate(start.getDate() - 7 * offset);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const s = iso8(start), e = iso8(end), ls = logList().filter(l => l.date >= s && l.date <= e);
  return { start: s, end: e, n: ls.length, min: ls.reduce((m, l) => m + (+l.minutes || +(S.data.tasks[l.taskId] || {}).duration || 0), 0), list: ls };
}
function weekStreak() {
  let n = 0;
  for (let w = weekStats(0).n ? 0 : 1; w < 104; w++) { if (weekStats(w).n) n++; else break; }
  return n;
}
function taskHistory(id) {
  const ds = [...new Set(logList().filter(l => l.taskId === id).map(l => l.date))].sort();
  const gaps = ds.slice(1).map((d, i) => daysBetween(ds[i], d));
  return { dates: ds, avg: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null, last30: ds.filter(d => daysBetween(d, todayISO()) < 30).length };
}
function celebrate(t, extra, undo) {
  const w = weekStats(0), goal = +S.data.settings.weeklyGoal || 10, h = taskHistory(t.id);
  let line = `${w.n}${w.n === 1 ? "re" : "e"} tâche cette semaine`;
  if (w.n === goal) line = `Objectif de la semaine atteint : ${goal} tâches !`;
  else if (w.n < goal) line += ` · encore ${goal - w.n} pour l'objectif`;
  if (t.kind === "entretien" && h.dates.length > 1) line += ` · ${h.last30} fois en 30 j` + (h.avg ? `, tous les ${h.avg} j en moyenne` : "");
  const yp = yearPoints(new Date().getFullYear()), me = S.dev.me || "lui", other = me === "lui" ? "elodie" : "lui";
  const gap = yp[me] - yp[other];
  line = `+${pointsFor(t.duration, t.kind)} points · ${playerName("lui")} ${yp.lui} – ${yp.elodie} ${playerName("elodie")}` + (gap > 0 ? " · tu mènes" : gap < 0 ? ` · encore ${-gap} pour passer devant` : " · égalité") + " · " + line;
  toast(`Bien joué ! « ${t.title} » est fait.`, { sub: line + (extra ? " ·" + extra : ""), action: "Annuler", onAction: undo, big: true, ms: 5500 });
}

/* ---------------- analyse : état, score ---------------- */
function analyze() {
  const T = tasksList(), byId = S.data.tasks, today = todayISO();
  const dependents = {};
  T.forEach(t => (t.deps || []).forEach(d => (dependents[d] = dependents[d] || []).push(t.id)));
  const unlock = (id, seen = new Set()) => { (dependents[id] || []).forEach(c => { const x = byId[c]; if (!seen.has(c) && x && !x.deleted && x.status !== "done") { seen.add(c); unlock(c, seen); } }); return seen; };
  T.forEach(t => {
    const a = {}, dur = +t.duration || 0;
    if (t.kind === "entretien") {
      const every = hasDay(t) ? 7 : (+t.everyDays || 7);
      let since = t.lastDone ? daysBetween(t.lastDone, today) : every;
      if (hasDay(t)) {
        // dernière occurrence de ce jour (aujourd'hui compris) : due si pas faite depuis
        const back = (new Date().getDay() - +t.weekday + 7) % 7;
        const last = new Date(); last.setDate(last.getDate() - back);
        const lastISO = iso8(last);
        const doneSince = t.lastDone && t.lastDone >= lastISO;
        a.dueIn = doneSince ? (back === 0 ? 7 : 7 - back) : 0;
        a.overdue = doneSince ? 0 : back;
        a.today = back === 0 && !doneSince;
        since = doneSince ? 0 : every;
      } else { a.dueIn = every - since; a.overdue = Math.max(0, -a.dueIn); }
      a.state = a.dueIn <= 0 ? "due" : "ok";
      a.score = 6 + Math.min(8, (since / every - 1) * 4) + (+t.urgency || 2) + (a.today ? 10 : 0);
      a.late = a.overdue > 0 || !!a.today;
    } else {
      a.blockers = (t.deps || []).filter(d => byId[d] && !byId[d].deleted && byId[d].status !== "done");
      a.missing = (t.materials || []).filter(m => !m.have && m.name);
      a.missingCost = a.missing.filter(m => !m.borrow).reduce((s, m) => s + (+m.cost || 0), 0);
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
      a.score = sc; a.late = u >= 3;
    }
    t._ = a;
  });
}
const isOpen = t => t._.state !== "done" && t._.state !== "ok";

/* ---------------- plan du jour ---------------- */
function whereOk(t) { const w = S.dev.ctx.where; return w === "all" || (w === "out" ? isOutdoor(t) : !isOutdoor(t)); }
function localPlan() {
  const c = S.dev.ctx, cap = c.energy === "tired" ? 45 : Infinity, me = S.dev.me;
  let left = +c.time; const out = [];
  const mine = t => !t.assignee || t.assignee === "tous" || !me || t.assignee === me;
  const ok = t => whereOk(t) && mine(t) && (+t.duration || 30) <= cap;
  const chores = tasksList().filter(t => t._.state === "due" && ok(t)).sort((a, b) => b._.score - a._.score);
  const quests = tasksList().filter(t => t._.state === "ready" && ok(t)).sort((a, b) => b._.score - a._.score);
  const pool = []; // on alterne : une corvée, puis une tâche qui fait avancer un projet
  while (chores.length || quests.length) { if (chores.length) pool.push(chores.shift()); if (quests.length) pool.push(quests.shift()); }
  tasksList().filter(t => hasDay(t) && t._.state === "due").forEach(t => { out.push({ t, min: +t.duration || 5 }); const i = pool.indexOf(t); if (i >= 0) pool.splice(i, 1); });
  for (const t of pool) { const d = +t.duration || 30; if (d <= left) { out.push({ t, min: d }); left -= d; } }
  if (!out.length && c.energy !== "tired") { const t = tasksList().filter(t => t._.state === "ready" && whereOk(t) && mine(t)).sort((a, b) => b._.score - a._.score)[0]; if (t) out.push({ t, min: left, partial: true }); }
  return out;
}

/* ---------------- planning (Gantt) ---------------- */
function mondayOf(d) { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); x.setHours(12, 0, 0, 0); return x; }
function schedule(weeks = 12) {
  const start = mondayOf(new Date()), all = tasksList();
  const maint = Math.round(all.filter(t => t.kind === "entretien").reduce((s, t) => s + (+t.duration || 0) * 7 / (hasDay(t) ? 7 : (+t.everyDays || 7)), 0));
  const capW = Math.max(30, (+S.data.settings.weeklyHours || 4) * 60);
  const todo = all.filter(t => t.kind !== "entretien" && t.status !== "done");
  const rem = Object.fromEntries(todo.map(t => [t.id, Math.max(15, +t.duration || 60)]));
  const res = {}, fin = {};
  all.forEach(t => { if (t.kind !== "entretien" && t.status === "done") fin[t.id] = -1; });
  for (let w = 0; w < weeks; w++) {
    const wEnd = new Date(start); wEnd.setDate(wEnd.getDate() + 7 * w + 6); const wEndISO = iso8(wEnd);
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

/* ---------------- achats ---------------- */
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
      it.tasks.push({ t, now });
      if (now && !m.have) { it.now = true; it.prio += t._.score + (t._.missing.length === 1 ? 4 : 0); }
    });
  });
  return Object.values(items).sort((a, b) => (b.now - a.now) || (b.prio - a.prio) || (a.cost - b.cost));
}

/* ---------------- par pièce ---------------- */
function placeStats(id) {
  const ts = tasksList().filter(t => placeOf(t) === id && isOpen(t));
  const n = s => ts.filter(t => t._.state === s).length;
  const st = { count: ts.length, due: n("due"), ready: n("ready"), buy: n("buy"), later: n("blocked") + n("wait"), late: ts.some(t => (t._.state === "due" || t._.state === "ready") && t._.late) };
  st.tone = st.late || st.due ? "due" : st.ready ? "ready" : st.buy ? "buy" : st.later ? "wait" : "";
  return st;
}
function levelCount(level) {
  const ids = Object.keys(PLACES).filter(k => PLACES[k].level === level || (level === "rdc" && k === "maison"));
  return ids.reduce((s, k) => { const st = placeStats(k); return s + st.due + st.ready + st.buy; }, 0);
}

/* ---------------- rendu : morceaux ---------------- */
function mini(name, scale = 2) { return `<span class="mini" data-sprite="${name}" data-scale="${scale}"></span>`; }
function hydrateSprites(root = document) { root.querySelectorAll("[data-sprite]").forEach(el => { if (!el.firstChild) el.appendChild(spriteCanvas(el.dataset.sprite, +el.dataset.scale || 2)); }); }
function whyLine(t) {
  const a = t._;
  if (t.kind === "entretien" && hasDay(t)) return a.state === "due" ? (a.today ? ["late", t.evening ? "Ce soir" : "Aujourd'hui"] : ["late", "Pas fait " + DAYS[+t.weekday]]) : ["", "Prochaine fois " + DAYS[+t.weekday]];
  if (t.kind === "entretien") return a.state === "due" ? (a.overdue ? ["late", "En retard de " + a.overdue + " j"] : ["", "Prévu aujourd'hui"]) : ["", a.dueIn === 1 ? "Revient demain" : "Revient dans " + a.dueIn + " j"];
  if (a.state === "blocked") return ["blocked", "Après : " + a.blockers.map(id => S.data.tasks[id].title).join(", ")];
  if (a.state === "buy") return ["buy", "Il manque : " + a.missing.map(m => m.name + (m.borrow ? " (à emprunter)" : "")).join(", ") + (a.missingCost ? " · " + fmtEur(a.missingCost) : "")];
  if (a.state === "wait") return ["wait", "Pas avant le " + fmtDate(t.waitUntil)];
  if (a.state === "done") return ["", "Terminée" + (t.doneAt ? " le " + fmtDate(t.doneAt) : "") + (t.doneBy ? " par " + playerName(t.doneBy) : "")];
  const r = [];
  if (t.status === "doing") r.push("Commencée");
  if (a.late) r.push("Urgent");
  if (a.unlocks) r.push("Débloque " + a.unlocks + " tâche" + (a.unlocks > 1 ? "s" : ""));
  return [a.late ? "late" : "", r.join(" · ")];
}
function taskRow(t, o = {}) {
  const a = t._, st = a.state, canDo = st === "ready" || st === "due" || (o.anyDo && st !== "done" && st !== "ok");
  const [wc, w] = whyLine(t);
  const meta = [o.min ? fmtMin(o.min) + (o.partial ? " pour commencer" : "") : fmtMin(t.duration), o.noPlace ? "" : placeName(placeOf(t)),
    t.kind === "entretien" ? rhythm(t) : (a.cost ? fmtEur(a.cost) : "")].filter(Boolean).join(" · ");
  const who = t.assignee === "lui" || t.assignee === "elodie" ? `<span class="who">${mini(t.assignee, 1)}</span>` : t.assignee === "tous" ? `<span class="who">${mini("lui", 1)}${mini("elodie", 1)}</span>` : "";
  return `<div class="task s-${st} ${a.late ? "late" : ""}">
    <div class="bar"></div>
    <div class="body" data-act="edit" data-id="${t.id}" role="button" tabindex="0">
      <div class="t">${esc(t.title)}${who}${st !== "done" && st !== "ok" ? `<span class="ptag">+${pointsFor(t.duration, t.kind)}</span>` : ""}</div>
      <div class="meta">${esc(meta)}</div>
      ${w ? `<div class="why ${wc}">${esc(w)}</div>` : ""}
    </div>
    ${canDo ? `<button class="check" data-act="done" data-id="${t.id}" aria-label="Fait : ${esc(t.title)}">✓</button>` : "<span></span>"}
  </div>`;
}
function guideBox(html) {
  return `<div class="guide"><div class="portrait">${mini("baloo", 3)}</div><div><div class="speaker">Baloo</div><div class="say">${html}</div></div></div>`;
}
function renderTop() {
  const me = S.dev.me || "lui", st = S.sync.state;
  const hi = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";
  $("#top").innerHTML = `<div class="face">${mini(me, 2)}</div>
    <div class="hello"><h1>${hi} ${esc(playerName(me))}</h1><div class="sub">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div></div>
    <div class="sync"><span class="dot ${st === "ok" ? "ok" : st === "err" ? "err" : st === "busy" ? "busy" : ""}"></span>${st === "ok" ? "Synchro" : st === "busy" ? "…" : st === "err" ? "Hors ligne" : "Sur ce tél."}</div>`;
  hydrateSprites($("#top"));
}

/* ---------------- vue Maison ---------------- */
function viewMaison() {
  const c = S.dev.ctx, plan = localPlan().slice(0, 5), lv = S.dev.level;
  const chip = (k, v, l) => `<button class="chip" data-ctx="${k}" data-v="${v}" aria-pressed="${String(c[k]) === String(v)}">${l}</button>`;
  const ids = Object.keys(PLACES).filter(k => PLACES[k].level === lv);
  const info = Object.fromEntries(ids.map(k => [k, placeStats(k)]));
  const listIds = (lv === "ext" ? [] : ["maison"]).concat(PLACE_ORDER.filter(k => PLACES[k].level === lv));
  const pills = st => [st.due ? `<span class="pill due">${st.due} à faire</span>` : "", st.ready ? `<span class="pill ready">${st.ready} faisable${st.ready > 1 ? "s" : ""}</span>` : "",
    st.buy ? `<span class="pill buy">${st.buy} achat${st.buy > 1 ? "s" : ""}</span>` : "", st.later ? `<span class="pill wait">${st.later} plus tard</span>` : ""].join("");
  const segCount = l => { const n = levelCount(l); return n ? `<span class="n">${n}</span>` : ""; };
  const roomPart = S.room && PLACES[S.room] ? roomPanel(S.room)
    : `<section class="card sec" style="gap:0"><div class="sec-head" style="margin-bottom:4px"><h2>Pièce par pièce</h2><span class="hint">touche une pièce</span></div>
    <div class="rooms">${listIds.filter(k => placeStats(k).count).map(k => `<button class="roomrow" data-room="${k}">
      <span class="rn">${esc(PLACES[k].name)}</span><span class="pills">${pills(placeStats(k))}</span><span class="chev">›</span></button>`).join("") || `<div class="empty">Rien à faire à ce niveau.</div>`}</div>
    ${listIds.some(k => !placeStats(k).count) ? `<div class="rooms-empty">Rien à faire : ${listIds.filter(k => !placeStats(k).count).map(k => `<button data-room="${k}">${esc(PLACES[k].name)}</button>`).join(", ")}</div>` : ""}</section>`;
  return `${syncOn() ? "" : `<button class="unsynced" data-tab-go="nous">Vos deux téléphones ne sont pas encore reliés : chacun voit seulement ses tâches. <b>Relier</b></button>`}
  <section class="card sec">
    <div class="sec-head"><h2>Aujourd'hui</h2><span class="hint">${S.dev.me ? "pour " + esc(playerName(S.dev.me)) : ""}</span></div>
    <div class="chips">${chip("time", 15, "15 min")}${chip("time", 30, "30 min")}${chip("time", 60, "1 h")}${chip("time", 120, "2 h")}${chip("time", 240, "Demi-journée")}${chip("time", 420, "Journée")}</div>
    <div class="chips">${chip("where", "all", "Partout")}${chip("where", "in", "Dedans")}${chip("where", "out", "Dehors")}${chip("energy", "normal", "En forme")}${chip("energy", "tired", "Retour de garde")}${chip("energy", "off", "Jour de récup")}</div>
    ${plan.length ? plan.map(p => taskRow(p.t, { min: p.min, partial: p.partial })).join("") : `<div class="empty">Rien de faisable avec ces critères. Regarde les achats : c'est sûrement du matériel qui bloque.</div>`}
    <a class="talk" href="${esc(talkUrl())}" target="_blank" rel="noopener">
      <span class="portrait">${mini("baloo", 2)}</span>
      <span class="tt"><b>Parler à Baloo</b><span>Dicte une idée, une tâche, un changement : Claude met l'appli à jour.</span></span>
      <span class="go">›</span></a>
    <button class="linkbtn" data-act="new" style="align-self:flex-start">+ Ajouter une tâche à la main</button>
  </section>
  <section class="sec">
    <div class="seg" role="group" aria-label="Niveau">
      <button data-level="rdc" aria-pressed="${lv === "rdc"}">RDC ${segCount("rdc")}</button>
      <button data-level="etage" aria-pressed="${lv === "etage"}">Étage ${segCount("etage")}</button>
      <button data-level="ext" aria-pressed="${lv === "ext"}">Extérieur ${segCount("ext")}</button>
    </div>
    <div class="housebox">${houseSVG(lv, info, S.room)}
      <div class="legend"><span><i style="background:var(--red)"></i>À faire</span><span><i style="background:var(--green)"></i>Faisable</span><span><i style="background:var(--amber)"></i>Achat</span><span><i style="background:var(--blue)"></i>Plus tard</span></div></div>
  </section>
  <div id="room-anchor"></div>
  ${roomPart}`;
}
function roomPanel(id) {
  const ts = tasksList().filter(t => placeOf(t) === id && t._.state !== "done");
  const g = (title, arr) => arr.length ? `<div class="group-title">${title}</div>${arr.sort((a, b) => b._.score - a._.score).map(t => taskRow(t, { noPlace: true, anyDo: true })).join("")}` : "";
  const now = ts.filter(t => t._.state === "due" || t._.state === "ready"), buy = ts.filter(t => t._.state === "buy"),
    later = ts.filter(t => t._.state === "blocked" || t._.state === "wait"), ok = ts.filter(t => t._.state === "ok");
  return `<section class="card sec">
    <div class="panel-head"><button class="linkbtn" data-act="rooms">‹ Toutes les pièces</button><button class="btn small" data-act="new" data-place="${id}">+ Ajouter ici</button></div>
    <h2>${esc(PLACES[id].name)}</h2>
    ${ts.length ? g("À faire maintenant", now) + g("Il manque du matériel", buy) + g("Plus tard", later) + (ok.length ? `<div class="group-title">Entretien à jour</div>${ok.sort((a, b) => a._.dueIn - b._.dueIn).map(t => taskRow(t, { noPlace: true })).join("")}` : "")
      : `<div class="empty">Rien de prévu ici.</div>`}
  </section>`;
}

/* ---------------- vue Tâches ---------------- */
function viewTaches() {
  const f = S.filter, me = S.dev.me;
  const filters = [["actives", "En cours"], ["ready", "Faisables"], ["buy", "Achat"], ["later", "Plus tard"], ["entretien", "Entretien"], ["moi", "Les miennes"], ["done", "Terminées"]];
  const list = tasksList().filter(t => {
    if (f === "entretien") return t.kind === "entretien";
    if (f === "moi") return isOpen(t) && (t.assignee === me || t.assignee === "tous");
    if (f === "done") return t._.state === "done";
    if (f === "later") return t._.state === "blocked" || t._.state === "wait";
    if (f === "actives") return isOpen(t);
    return t._.state === f || (f === "ready" && t._.state === "due");
  });
  const groups = {};
  list.forEach(t => (groups[placeOf(t)] = groups[placeOf(t)] || []).push(t));
  const order = { due: 0, ready: 0, buy: 1, blocked: 2, wait: 3, ok: 4, done: 5 };
  const lvName = { ext: "Extérieur", etage: "Étage", rdc: "Rez-de-chaussée", all: "" };
  return `
  <section class="sec"><div class="sec-head"><h2>Toutes les tâches</h2><a class="btn small primary" href="${esc(talkUrl())}" target="_blank" rel="noopener" style="text-decoration:none">Parler à Baloo</a></div>
    <div class="chips">${filters.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div></section>
  ${Object.keys(groups).length ? PLACE_ORDER.filter(k => groups[k]).map(k => `
    <section class="sec"><div class="sec-head"><h3>${esc(PLACES[k].name)}</h3><span class="hint">${lvName[PLACES[k].level]}</span></div>
    ${groups[k].sort((a, b) => (order[a._.state] - order[b._.state]) || (b._.score - a._.score)).map(t => taskRow(t, { noPlace: true, anyDo: true })).join("")}</section>`).join("")
    : `<div class="empty">Aucune tâche ici.</div>`}`;
}

/* ---------------- vue Achats ---------------- */
function viewAchats() {
  const all = bag(), p = S.pocket;
  const now = all.filter(b => !b.have && b.now), later = all.filter(b => !b.have && !b.now), have = all.filter(b => b.have);
  const list = p === "now" ? now : p === "later" ? later : have;
  const sum = a => a.reduce((s, b) => s + (b.borrow ? 0 : b.cost), 0);
  const row = b => `<div class="item">
    <div style="min-width:0"><div class="n">${esc(b.name)}${b.borrow ? " · à emprunter" : ""}</div>
      <div class="for">${b.tasks.map(x => esc(x.t.title) + " (" + esc(PLACES[placeOf(x.t)].short) + ")").join(" · ")}</div></div>
    <span class="num">${b.borrow ? "" : b.cost ? fmtEur(b.cost) : ""}</span>
    ${p === "have" ? `<button class="btn small" data-act="unbuy" data-key="${esc(b.key)}">Retirer</button>` : `<input type="checkbox" data-act="bought" data-key="${esc(b.key)}" aria-label="${esc(b.name)} : je l'ai">`}
  </div>`;
  const intro = { now: "Ces achats débloquent des tâches tout de suite. Les premiers servent le plus.", later: "Pour des tâches qui attendent autre chose : pas besoin de les acheter maintenant.", have: "Ce que tu as déjà pour les tâches en cours." }[p];
  return `
  <section class="sec"><h2>Achats</h2>
    <div class="tabs2"><button data-pocket="now" aria-pressed="${p === "now"}">Maintenant ${now.length}</button><button data-pocket="later" aria-pressed="${p === "later"}">Plus tard ${later.length}</button><button data-pocket="have" aria-pressed="${p === "have"}">J'ai ${have.length}</button></div>
    <div class="card"><p class="muted" style="margin:0 0 4px;font-size:.9rem">${intro}</p>
      ${list.length ? list.map(row).join("") : `<div class="empty">Rien dans cette liste.</div>`}
      ${p !== "have" && list.length ? `<div class="total"><span>Total</span><span class="num">${fmtEur(sum(list))}</span></div>` : ""}</div></section>`;
}

/* ---------------- vue Agenda ---------------- */
function viewAgenda() {
  const sc = schedule(12), cols = sc.weeks;
  const rows = Object.entries(sc.res).map(([id, r]) => ({ t: S.data.tasks[id], ...r })).sort((a, b) => a.start - b.start || a.end - b.end);
  let head = `<div class="h" style="position:sticky;left:0;z-index:2;text-align:left;padding-left:10px">Tâche</div>`;
  for (let w = 0; w < cols; w++) { const d = new Date(sc.start); d.setDate(d.getDate() + 7 * w); head += `<div class="h">${w === 0 ? "Cette<br>sem." : String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0")}</div>`; }
  const body = rows.map(r => {
    let h = `<div class="name" data-act="edit" data-id="${r.t.id}" role="button" tabindex="0" title="${esc(r.t.title)}">${esc(r.t.title)}</div>`;
    for (let w = 0; w < cols; w++) {
      const on = w >= r.start && w <= r.end;
      h += `<div class="cell">${on ? `<div class="${["gb", (r.t._.missing || []).length ? "buy" : "", w > r.start ? "cont" : "", w < r.end ? "next" : ""].join(" ")}"></div>` : ""}</div>`;
    }
    return h;
  }).join("");
  return `
  <section class="card sec">
    <h2>Temps de bricolage</h2>
    <div class="grid2"><div class="field"><label for="weekly">Heures par semaine</label><input id="weekly" type="number" min="1" max="60" value="${esc(S.data.settings.weeklyHours || 4)}"></div>
      <div class="field"><span class="flabel">Entretien estimé</span><div class="num" style="padding:10px 0">${fmtMin(sc.maint)} / sem.</div></div></div>
    <p class="muted" style="margin:0;font-size:.9rem">Les tâches sont rangées par priorité, dans l'ordre où elles doivent se faire, en respectant les dates « pas avant » et en laissant une semaine pour acheter le matériel.</p>
  </section>
  <section class="sec"><h2>12 prochaines semaines</h2>
    <div class="legend" style="padding:0"><span><i style="background:var(--green)"></i>Prête</span><span><i style="background:var(--amber)"></i>Achat avant</span></div>
    ${rows.length ? `<div class="gantt-wrap"><div class="gantt" style="grid-template-columns:150px repeat(${cols},48px)">${head}${body}</div></div>` : `<div class="empty">Aucune tâche à planifier.</div>`}
    ${sc.later.length ? `<div class="card"><h3>Au-delà de 12 semaines</h3><div style="margin-top:6px">${sc.later.map(t => esc(t.title)).join(" · ")}</div></div>` : ""}
  </section>`;
}

/* ---------------- vue Bilan ---------------- */
function viewBilan() {
  const w = weekStats(0), prev = weekStats(1), goal = +S.data.settings.weeklyGoal || 10, streak = weekStreak();
  const pct = Math.min(100, Math.round(w.n / goal * 100));
  const per = k => w.list.filter(l => l.who === k).length;
  const diff = w.n - prev.n;
  // duel de l'année
  const Y = new Date().getFullYear(), yp = yearPoints(Y), tot = yp.lui + yp.elodie;
  const lead = yp.lui === yp.elodie ? "" : yp.lui > yp.elodie ? "lui" : "elodie";
  const wp = k => w.list.filter(l => (k === "elodie") === (l.who === "elodie")).reduce((s, l) => s + logPts(l), 0);
  const py = yearPoints(Y - 1), pyWin = py.lui + py.elodie ? (py.lui === py.elodie ? "Égalité" : playerName(py.lui > py.elodie ? "lui" : "elodie")) : "";
  const daysLeft = daysBetween(todayISO(), Y + "-12-31");
  const side = k => `<div class="duelist ${lead === k ? "lead" : ""}"><div class="pic">${mini(k, 3)}</div><div class="pn">${esc(playerName(k))}</div>
    <div class="pts num">${yp[k]}</div><div class="ps">points · ${wp(k)} cette semaine</div>${lead === k ? `<span class="crown">En tête</span>` : ""}</div>`;
  const duel = `<section class="card sec duel">
    <div class="sec-head"><h2>Le duel ${Y}</h2><span class="hint">${daysLeft > 0 ? "verdict dans " + daysLeft + " j" : "verdict ce soir"}</span></div>
    <div class="duelists">${side("lui")}<div class="vs">VS</div>${side("elodie")}</div>
    <div class="split"><i style="width:${tot ? Math.round(yp.lui / tot * 100) : 50}%"></i></div>
    <p class="muted" style="margin:0;font-size:.84rem">Chaque tâche cochée rapporte des points à celui qui la coche : plus elle est longue, plus elle rapporte, et les projets valent 1,5 fois l'entretien. Le 31 décembre, celui qui a le plus de points gagne l'année.${pyWin ? ` Gagnant ${Y - 1} : <b>${esc(pyWin)}</b>.` : ""}</p>
  </section>`;
  // calendrier : 12 semaines × 7 jours
  const counts = {}; logList().forEach(l => counts[l.date] = (counts[l.date] || 0) + 1);
  const start = mondayOf(new Date()); start.setDate(start.getDate() - 7 * 11);
  let cells = "";
  for (let wk = 0; wk < 12; wk++) for (let d = 0; d < 7; d++) {
    const x = new Date(start); x.setDate(x.getDate() + wk * 7 + d); const k = iso8(x), n = counts[k] || 0;
    const fut = k > todayISO();
    cells += `<i class="hc l${fut ? "f" : Math.min(4, n)}" style="grid-column:${wk + 1};grid-row:${d + 1}" title="${fmtDate(k)} : ${n}"></i>`;
  }
  // régularité des tâches récurrentes
  const rec = tasksList().filter(t => t.kind === "entretien").map(t => ({ t, h: taskHistory(t.id) }))
    .sort((a, b) => (b.t._.state === "due") - (a.t._.state === "due") || (b.h.dates.length - a.h.dates.length));
  const recRow = ({ t, h }) => {
    const target = hasDay(t) ? 7 : (+t.everyDays || 7);
    const ok = h.avg === null ? null : h.avg <= target + Math.max(1, Math.round(target * .25));
    const dots = h.dates.slice(-8).map(() => `<i></i>`).join("");
    return `<div class="rec" data-act="edit" data-id="${t.id}" role="button" tabindex="0">
      <div class="rt"><b>${esc(t.title)}</b><span>${esc(rhythm(t))}${t.lastDone ? " · dernière fois " + (t.lastDone === todayISO() ? "aujourd'hui" : fmtDate(t.lastDone)) : ""}</span></div>
      <div class="rr">${h.avg !== null ? `<span class="pill ${ok ? "ready" : "buy"}">tous les ${h.avg} j</span>` : h.dates.length ? `<span class="pill ready">1 fois</span>` : `<span class="pill wait">à suivre</span>`}<span class="dots">${dots}</span></div></div>`;
  };
  // historique
  const byDay = {}; logList().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40).forEach(l => (byDay[l.date] = byDay[l.date] || []).push(l));
  const dayName = d => d === todayISO() ? "Aujourd'hui" : daysBetween(d, todayISO()) === 1 ? "Hier" : new Date(d + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `${duel}
  <section class="card sec">
    <div class="sec-head"><h2>Cette semaine</h2><span class="hint">${fmtDate(w.start)} – ${fmtDate(w.end)}</span></div>
    <div class="score"><div class="big num">${w.n}</div><div><b>tâche${w.n > 1 ? "s" : ""} faite${w.n > 1 ? "s" : ""}</b><span>${fmtMin(w.min)} de travail${diff > 0 ? ` · ${diff} de plus que la semaine dernière` : prev.n ? ` · semaine dernière : ${prev.n}` : ""}</span></div></div>
    <div class="goal"><div class="gbar"><i style="width:${pct}%"></i></div><span class="num">${w.n} / ${goal}</span></div>
    <div class="row" style="justify-content:space-between">
      <div class="row" style="gap:14px">${["lui", "elodie"].map(k => `<span class="who-n">${mini(k, 1)} ${esc(playerName(k))} <b class="num">${per(k)}</b></span>`).join("")}</div>
      <span class="streak">${streak ? `${streak} semaine${streak > 1 ? "s" : ""} d'affilée` : "Première semaine"}</span>
    </div>
  </section>
  <section class="card sec">
    <div class="sec-head"><h2>12 dernières semaines</h2><span class="hint">un carré = un jour</span></div>
    <div class="heat-wrap"><div class="heat-days"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div><div class="heat">${cells}</div></div>
    <div class="legend" style="padding:0"><span>Moins</span><i class="hc l0"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i><span>Plus</span></div>
  </section>
  <section class="card sec" style="gap:0">
    <div class="sec-head" style="margin-bottom:4px"><h2>Régularité de l'entretien</h2><span class="hint">rythme réel</span></div>
    ${rec.map(recRow).join("")}
  </section>
  <section class="sec">
    <h2>Historique</h2>
    ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, ls]) => `<div class="card sec" style="gap:2px"><h3 style="text-transform:capitalize">${esc(dayName(d))}</h3>
      ${ls.map(l => `<div class="hist">${mini(l.who === "elodie" ? "elodie" : "lui", 1)}<span>${esc(l.title)} <span class="ptag">+${logPts(l)}</span></span><button class="linkbtn" data-act="unlog" data-id="${l.id}" aria-label="Retirer de l'historique">Retirer</button></div>`).join("")}</div>`).join("")
      : `<div class="empty">Rien encore. Coche une tâche faite pour la voir ici.</div>`}
  </section>
  <section class="card sec"><h2>Objectif de la semaine</h2>
    <div class="row"><div class="field" style="flex:1"><label for="goal">Nombre de tâches</label><input id="goal" type="number" min="1" max="100" value="${goal}"></div></div></section>`;
}

/* ---------------- vue Nous ---------------- */
function viewNous() {
  const me = S.dev.me, week = iso8(mondayOf(new Date())), st = S.data.settings, sy = S.dev.sync;
  const card = k => {
    const n = Object.values(S.data.log).filter(l => l.who === k && l.date >= week).length;
    const open = tasksList().filter(t => (t.assignee === k || t.assignee === "tous") && isOpen(t)).length;
    return `<div class="card person ${me === k ? "me" : ""}"><div class="pic">${mini(k, 4)}</div><div class="pn">${esc(playerName(k))}</div>
      <div class="ps">${open} tâche${open > 1 ? "s" : ""} attribuée${open > 1 ? "s" : ""} · ${n} faite${n > 1 ? "s" : ""} cette semaine</div>
      <button class="btn small ${me === k ? "primary" : ""}" data-act="me" data-v="${k}">${me === k ? "Ce téléphone" : "C'est moi"}</button></div>`;
  };
  return `
  <section class="sec"><h2>Nous</h2><div class="people">${card("lui")}${card("elodie")}</div>
    <div class="card">${guideBox(`Moi, c'est Baloo. Touche « Parler à Baloo » pour ouvrir la conversation avec Claude : raconte ce que tu as en tête, je pose les questions et l'appli se met à jour.`)}</div></section>
  <section class="card sec"><h2>Prénoms</h2>
    <div class="grid2"><div class="field"><label for="name-lui">Lui</label><input id="name-lui" type="text" value="${esc(st.players?.lui?.name || "Baptiste")}"></div>
      <div class="field"><label for="name-elodie">Elle</label><input id="name-elodie" type="text" value="${esc(st.players?.elodie?.name || "Elodie")}"></div></div>
    <button class="btn small" data-act="save-names" style="align-self:flex-start">Enregistrer</button></section>
  <section class="card sec"><h2>Consignes pour Claude</h2>
    <p class="muted" style="margin:0;font-size:.9rem">Vos règles de fonctionnement, ajoutées à chaque demande envoyée à Claude.</p>
    <div class="field"><label for="guide-txt">Consignes</label><textarea id="guide-txt" placeholder="Ex : après une garde de 24 h je suis fatigué. On évite les gros achats avant la naissance.">${esc(st.guide || "")}</textarea></div>
    <button class="btn small" data-act="save-guide" style="align-self:flex-start">Enregistrer</button></section>
  <section class="card sec"><h2>Synchro entre vos téléphones</h2>
    <p class="muted" style="margin:0;font-size:.9rem">Pour que ${esc(playerName("lui"))} et ${esc(playerName("elodie"))} voient les mêmes tâches et ce que l'autre a fait, les deux téléphones partagent un fichier dans un dépôt GitHub <b>privé</b>. Sans synchro, chaque téléphone garde ses tâches pour lui.</p>
    ${syncOn() ? "" : `<ol class="steps">
      <li>Sur github.com, crée un dépôt <b>privé</b> nommé <code>maison-saucats-data</code>.</li>
      <li>Crée un jeton : Settings → Developer settings → Fine-grained tokens → Generate. Accès : seulement ce dépôt. Permission : Contents en lecture et écriture.</li>
      <li>Colle le jeton ci-dessous et touche Connecter.</li>
      <li>Touche « Lien pour l'autre téléphone » et envoie-le à l'autre : il s'ouvre et se connecte tout seul.</li></ol>`}
    <div class="grid2"><div class="field"><label for="sy-owner">Compte</label><input id="sy-owner" type="text" value="${esc(sy.owner)}" autocapitalize="off"></div>
      <div class="field"><label for="sy-repo">Dépôt privé</label><input id="sy-repo" type="text" value="${esc(sy.repo)}" autocapitalize="off"></div></div>
    <div class="field"><label for="sy-token">Jeton GitHub (reste sur ce téléphone)</label><input id="sy-token" type="password" value="${esc(sy.token)}" autocomplete="off" placeholder="github_pat_…"></div>
    <div class="row"><button class="btn small primary" data-act="sync-save">Connecter</button><button class="btn small" data-act="sync-now">Synchroniser</button>${syncOn() ? `<button class="btn small" data-act="sync-share">Lien pour l'autre téléphone</button>` : ""}</div>
    <div class="muted" style="font-size:.88rem;display:flex;gap:6px;align-items:center"><span class="dot ${S.sync.state === "ok" ? "ok" : S.sync.state === "err" ? "err" : ""}"></span>${esc(S.sync.msg)}</div></section>
  <section class="card sec"><h2>Lien de Baloo</h2>
    <p class="muted" style="margin:0;font-size:.9rem">La conversation qui s'ouvre quand on touche « Parler à Baloo ». À changer seulement si on repart d'une nouvelle conversation.</p>
    <div class="field"><label for="talk-url">Lien</label><input id="talk-url" type="url" value="${esc(talkUrl())}" autocapitalize="off"></div>
    <button class="btn small" data-act="save-talk" style="align-self:flex-start">Enregistrer</button></section>
  <section class="card sec"><h2>Rappels</h2>
    <p class="muted" style="margin:0;font-size:.9rem">Les tâches à jour fixe (poubelles…) s'affichent en tête d'« Aujourd'hui » le bon jour. Pour être prévenu même appli fermée, ajoute-les à ton agenda : le téléphone sonnera chaque semaine.</p>
    <div class="row"><button class="btn small primary" data-act="ics">Ajouter à mon agenda</button>${"Notification" in window && Notification.permission !== "granted" ? `<button class="btn small" data-act="notif">Notifications dans l'appli</button>` : ""}</div></section>
  <section class="card sec"><h2>Sauvegarde</h2>
    <div class="row"><button class="btn small" data-act="export">Exporter</button><button class="btn small" data-act="import">Importer</button><input type="file" id="import-file" accept="application/json" hidden></div></section>`;
}

/* ---------------- rendu ---------------- */
function render(keepScroll = true) {
  analyze(); renderTop();
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
  const v = { maison: viewMaison, taches: viewTaches, achats: viewAchats, agenda: viewAgenda, nous: viewNous, bilan: viewBilan }[S.tab] || viewMaison;
  const y = window.scrollY; $("#view").innerHTML = v(); if (keepScroll) window.scrollTo(0, y);
  hydrateSprites($("#view"));
  if (!S.dev.me) setTimeout(firstRun, 50);
}
function selectRoom(id) {
  S.room = id;
  if (PLACES[id] && PLACES[id].level !== "all" && PLACES[id].level !== S.dev.level) { S.dev.level = PLACES[id].level; saveDev(); }
  render();
  const a = $("#room-anchor"); if (a) a.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/* ---------------- feuilles ---------------- */
function openSheet(html) {
  $("#sheet-root").innerHTML = `<div class="sheet-bg" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  hydrateSprites($("#sheet-root"));
  return $(".sheet");
}
function closeSheet() { $("#sheet-root").innerHTML = ""; }
function placeSelect(id, v) {
  const grp = (label, lv) => `<optgroup label="${label}">${PLACE_ORDER.filter(k => PLACES[k].level === lv).map(k => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(PLACES[k].name)}</option>`).join("")}</optgroup>`;
  return `<select id="${id}"><option value="maison" ${v === "maison" ? "selected" : ""}>Toute la maison</option>${grp("Rez-de-chaussée", "rdc")}${grp("Étage", "etage")}${grp("Extérieur", "ext")}</select>`;
}

/* ---------- édition complète d'une tâche ---------- */
function openEditor(id, presetPlace) {
  const t = id ? S.data.tasks[id] : { title: "", kind: "projet", place: presetPlace || "maison", project: "", duration: 60, urgency: 2, importance: 2, deps: [], materials: [], status: "todo", everyDays: 7, lastDone: todayISO(), waitUntil: "", notes: "", assignee: "" };
  const projects = [...new Set(tasksList().map(x => x.project).filter(Boolean))];
  const others = tasksList().filter(x => x.id !== id && x.kind !== "entretien" && x.status !== "done");
  const mats = (t.materials || []).map(m => ({ ...m }));
  const sel = (n, opts, v) => `<select id="f-${n}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const lvl = [[1, "Faible"], [2, "Moyenne"], [3, "Forte"]];
  const sh = openSheet(`
    <div class="panel-head"><h2>${id ? "Modifier la tâche" : "Nouvelle tâche"}</h2><button class="btn small" data-act="close">Fermer</button></div>
    <div class="field"><label for="f-title">Intitulé</label><input id="f-title" type="text" value="${esc(t.title)}"></div>
    <div class="grid2"><div class="field"><label for="f-place">Pièce ou endroit</label>${placeSelect("f-place", placeOf(t))}</div>
      <div class="field"><label for="f-kind">Type</label>${sel("kind", Object.entries(KINDS), t.kind)}</div></div>
    <div class="grid2"><div class="field"><label for="f-assignee">Qui</label>${sel("assignee", [["", "Libre"], ["lui", playerName("lui")], ["elodie", playerName("elodie")], ["tous", "Ensemble"]], t.assignee || "")}</div>
      <div class="field" id="wrap-project"><label for="f-project">Projet</label><input id="f-project" type="text" list="dl-projects" value="${esc(t.project || "")}"><datalist id="dl-projects">${projects.map(p => `<option value="${esc(p)}">`).join("")}</datalist></div></div>
    <div class="grid3"><div class="field"><label for="f-duration">Durée (min)</label><input id="f-duration" type="number" min="5" step="5" value="${esc(t.duration || 60)}"></div>
      <div class="field"><label for="f-urgency">Urgence</label>${sel("urgency", lvl, t.urgency || 2)}</div>
      <div class="field"><label for="f-importance">Importance</label>${sel("importance", lvl, t.importance || 2)}</div></div>
    <div id="wrap-ent" class="sec"><div class="grid2"><div class="field"><label for="f-weekday">Rythme</label><select id="f-weekday"><option value="">Tous les N jours</option>${DAYS.map((d, i) => `<option value="${i}" ${hasDay(t) && +t.weekday === i ? "selected" : ""}>Chaque ${d}</option>`).join("")}</select></div>
      <div class="field" id="wrap-every"><label for="f-every">Tous les (jours)</label><input id="f-every" type="number" min="1" value="${esc(t.everyDays || 7)}"></div></div>
      <div class="field"><label for="f-last">Fait la dernière fois</label><input id="f-last" type="date" value="${esc(t.lastDone || "")}"></div></div>
    <div id="wrap-proj" class="sec" style="gap:14px">
      <div class="grid2"><div class="field"><label for="f-status">Statut</label>${sel("status", [["todo", "À faire"], ["doing", "Commencée"], ["done", "Terminée"]], t.status || "todo")}</div>
        <div class="field"><label for="f-wait">Pas avant le</label><input id="f-wait" type="date" value="${esc(t.waitUntil || "")}"></div></div>
      <div class="field"><span class="flabel">Matériel et outils</span><div id="mats" class="sec" style="gap:6px"></div>
        <button class="btn small" data-act="mat-add" style="align-self:flex-start;margin-top:6px">+ Ajouter</button></div>
      <div class="field"><span class="flabel">À faire après</span>
        ${others.length ? `<div class="deplist">${others.map(o => `<label><input type="checkbox" value="${o.id}" ${(t.deps || []).includes(o.id) ? "checked" : ""} style="accent-color:var(--accent)">${esc(o.title)}</label>`).join("")}</div>` : `<div class="muted">Aucune autre tâche.</div>`}</div>
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
  const toggle = () => { const ent = $("#f-kind").value === "entretien"; $("#wrap-ent").hidden = !ent; $("#wrap-proj").hidden = ent; $("#wrap-project").hidden = ent; $("#wrap-every").hidden = $("#f-weekday").value !== ""; };
  drawMats(); toggle();
  $("#f-kind").addEventListener("change", toggle); $("#f-weekday").addEventListener("change", toggle);
  const onField = e => { const i = e.target.dataset.m; if (i === undefined) return; const f = e.target.dataset.f; if (f === "st") { mats[i].have = e.target.value === "have"; mats[i].borrow = e.target.value === "borrow"; } else mats[i][f] = f === "cost" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; };
  sh.addEventListener("input", onField); sh.addEventListener("change", onField);
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act;
    if (act === "mat-add") { mats.push({ name: "", cost: "", have: false }); drawMats(); sh.querySelector(`[data-m="${mats.length - 1}"]`).focus(); }
    if (act === "mat-del") { mats.splice(+b.dataset.i, 1); drawMats(); }
    if (act === "del") { if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirmer la suppression"; return; } patchTask(id, { deleted: true }); closeSheet(); commit("Tâche supprimée"); }
    if (act === "save") {
      const title = $("#f-title").value.trim(); if (!title) { $("#f-title").focus(); toast("Donne un nom à la tâche."); return; }
      const kind = $("#f-kind").value, place = $("#f-place").value;
      const body = { ...(id ? S.data.tasks[id] : { id: uid(), createdAt: todayISO() }), title, kind, place, zone: placeName(place), assignee: $("#f-assignee").value,
        duration: +$("#f-duration").value || 30, urgency: +$("#f-urgency").value, importance: +$("#f-importance").value, outdoor: PLACES[place].level === "ext", notes: $("#f-notes").value.trim() };
      delete body._;
      if (kind === "entretien") Object.assign(body, { weekday: $("#f-weekday").value === "" ? null : +$("#f-weekday").value, everyDays: $("#f-weekday").value === "" ? (+$("#f-every").value || 7) : 7, lastDone: $("#f-last").value || null, project: "", deps: [], materials: [], status: "todo" });
      else Object.assign(body, { project: $("#f-project").value.trim(), status: $("#f-status").value, waitUntil: $("#f-wait").value || "",
        deps: [...sh.querySelectorAll(".deplist input:checked")].map(x => x.value),
        materials: mats.filter(m => m.name && m.name.trim()).map(m => ({ name: m.name.trim(), cost: +m.cost || 0, have: !!m.have, borrow: !!m.borrow })) });
      putTask(body); closeSheet(); commit(id ? "Tâche enregistrée" : "Tâche ajoutée");
    }
  });
}

/* ---------- Baloo pose les questions une par une ---------- */
function openWizard(place) {
  const W = { step: "title", title: "", place: place || "", kind: "", duration: 0, everyDays: 0, mats: [], matIdx: 0, deps: [], urgency: 2, importance: 2, waitUntil: "", assignee: "" };
  const opens = tasksList().filter(t => t.kind !== "entretien" && t.status !== "done");
  const sh = openSheet(`<div class="panel-head"><h2>Nouvelle tâche</h2><button class="btn small" data-act="close">Fermer</button></div>
    <div class="guide"><div class="portrait">${mini("baloo", 3)}</div><div><div class="speaker">Baloo</div><div class="say" id="wz-say"></div></div></div>
    <div id="wz-body" class="sec"></div>`);
  const say = h => { $("#wz-say").innerHTML = h; };
  const body = h => { $("#wz-body").innerHTML = h; const f = $("#wz-body input"); if (f) f.focus(); };
  const choices = (arr, act, one) => `<div class="choices ${one ? "one" : ""}">${arr.map(([v, l]) => `<button class="choice" data-act="${act}" data-v="${esc(v)}">${l}</button>`).join("")}</div>`;
  const back = `<button class="linkbtn" data-act="wz-back" style="align-self:flex-start">‹ Retour</button>`;
  const hist = [];
  const go = s => { hist.push(W.step); W.step = s; step(); };
  function step() {
    const s = W.step;
    if (s === "title") {
      say("Qu'est-ce que tu as en tête ? Dis-le simplement, je m'occupe du reste.");
      body(`<div class="field"><label for="wz-title">La tâche</label><input id="wz-title" type="text" value="${esc(W.title)}" placeholder="Ex : recoller le liège de l'entrée"></div><button class="btn primary" data-act="wz-title">Suivant</button>`);
    } else if (s === "place") {
      say(`« ${esc(W.title)} ». C'est où ?`);
      const grp = (t, lv) => `<div class="group-title">${t}</div>` + choices(PLACE_ORDER.filter(k => PLACES[k].level === lv).map(k => [k, esc(PLACES[k].name)]), "wz-place");
      body(choices([["maison", "Un peu partout dans la maison"]], "wz-place", true) + grp("Rez-de-chaussée", "rdc") + grp("Étage", "etage") + grp("Extérieur", "ext") + back);
    } else if (s === "kind") {
      say("C'est quel genre de tâche ?");
      body(choices([["projet", "Un projet, une construction"], ["reparation", "Une réparation"], ["entretien", "Une corvée qui revient"]], "wz-kind", true) + back);
    } else if (s === "every") {
      say("Elle revient tous les combien ?");
      body(choices([[1, "Tous les jours"], [2, "Tous les 2 jours"], [7, "Chaque semaine"], [14, "Toutes les 2 semaines"], [30, "Chaque mois"], [90, "Chaque trimestre"], [180, "Deux fois par an"], [365, "Une fois par an"], ["day", "Un jour précis de la semaine"]], "wz-every") + back);
    } else if (s === "weekday") {
      say("Quel jour ?");
      body(choices([1, 2, 3, 4, 5, 6, 0].map(i => [i, "Chaque " + DAYS[i]]), "wz-weekday") + back);
    } else if (s === "duration") {
      say("Ça va te prendre combien de temps, à peu près ?");
      body(choices([[15, "Un quart d'heure"], [30, "Une demi-heure"], [60, "Une heure"], [120, "Deux heures"], [240, "Une demi-journée"], [420, "Une journée"], [960, "Plusieurs jours"]], "wz-duration") + back);
    } else if (s === "mats") {
      say(W.mats.length ? `Noté : <b>${W.mats.map(m => esc(m.name)).join(", ")}</b>. Il te faut autre chose ? Pense aux outils, à la visserie, aux consommables.` : "De quoi tu as besoin ? Matériel, outils, fournitures… Ajoute-les un par un.");
      body(`<div class="field"><label for="wz-mat">Objet nécessaire</label><input id="wz-mat" type="text" placeholder="Ex : colle contact, spatule crantée"></div>
        <div class="row"><button class="btn" data-act="wz-mat-add">+ Ajouter</button><button class="btn primary" data-act="wz-mat-done" style="flex:1">${W.mats.length ? "C'est tout" : "Rien de spécial"}</button></div>${back}`);
    } else if (s === "have") {
      say(`Et <b>${esc(W.mats[W.matIdx].name)}</b>, tu l'as déjà ?`);
      body(choices([["have", "Oui, je l'ai"], ["buy", "Non, à acheter"], ["borrow", "Je peux l'emprunter"], ["unsure", "Je ne sais pas, je vérifie"]], "wz-have") + back);
    } else if (s === "cost") {
      say(`Combien coûte <b>${esc(W.mats[W.matIdx].name)}</b>, environ ?`);
      body(choices([[5, "Moins de 10 €"], [20, "Une vingtaine d'euros"], [50, "Autour de 50 €"], [100, "Une centaine d'euros"], [250, "200 à 300 €"], [500, "500 € ou plus"]], "wz-cost") +
        `<div class="row"><div class="field" style="flex:1"><label for="wz-cost-n">Montant précis (€)</label><input id="wz-cost-n" type="number" min="0"></div><button class="btn" data-act="wz-cost-n" style="align-self:flex-end">OK</button></div>${back}`);
    } else if (s === "deps") {
      say("Il faut finir une autre tâche avant de pouvoir commencer ?");
      body(opens.length ? `<div class="choices one">${opens.map(o => `<button class="choice ${W.deps.includes(o.id) ? "on" : ""}" data-act="wz-dep" data-v="${o.id}">${esc(o.title)}</button>`).join("")}</div>
        <button class="btn primary" data-act="wz-deps-done">${W.deps.length ? "Valider" : "Non, rien avant"}</button>${back}` : `<button class="btn primary" data-act="wz-deps-done">Suivant</button>`);
    } else if (s === "when") {
      say("C'est pour quand ?");
      body(choices([["3", "Urgent, cette semaine"], ["2", "Dans le mois"], ["1", "Pas pressé"], ["date", "Pas avant une date"]], "wz-when") + back);
    } else if (s === "date") {
      say("À partir de quand on peut s'y mettre ? (saison, livraison…)");
      body(`<div class="field"><label for="wz-date">Pas avant le</label><input id="wz-date" type="date" min="${todayISO()}"></div><button class="btn primary" data-act="wz-date">Suivant</button>${back}`);
    } else if (s === "importance") {
      say("Ça compte beaucoup pour vous deux ?");
      body(choices([["3", "Oui, c'est important"], ["2", "Moyennement"], ["1", "C'est du bonus"]], "wz-imp", true) + back);
    } else if (s === "who") {
      say("Qui s'en occupe ?");
      body(choices([["lui", esc(playerName("lui"))], ["elodie", esc(playerName("elodie"))], ["tous", "Ensemble"], ["", "On verra"]], "wz-who") + back);
    } else if (s === "summary") {
      const miss = W.mats.filter(m => !m.have), cost = miss.filter(m => !m.borrow).reduce((s, m) => s + (+m.cost || 0), 0), unsure = W.mats.filter(m => m.unsure);
      let v;
      if (W.waitUntil) v = `Elle attendra le <b>${fmtDate(W.waitUntil)}</b>.`;
      else if (W.deps.length) v = `Elle sera possible après : <b>${W.deps.map(d => esc(S.data.tasks[d].title)).join(", ")}</b>.`;
      else if (miss.length) v = `Il te manque <b>${miss.map(m => esc(m.name)).join(", ")}</b>${cost ? ` (≈ ${fmtEur(cost)})` : ""}. Je l'ajoute aux achats.`;
      else v = "Tu as tout ce qu'il faut : elle est <b>faisable tout de suite</b>.";
      if (unsure.length) v += ` Vérifie si tu as ${unsure.map(m => esc(m.name)).join(", ")} : en attendant je l'ai mis à acheter.`;
      say("Récap. " + v);
      body(`<div class="card" style="background:var(--panel-2)"><div style="font-weight:700">${esc(W.title)}</div>
        <div class="muted" style="font-size:.9rem;margin-top:3px">${esc([placeName(W.place), KINDS[W.kind], fmtMin(W.duration), W.kind === "entretien" ? rhythm(W) : "", W.assignee === "tous" ? "Ensemble" : W.assignee ? playerName(W.assignee) : ""].filter(Boolean).join(" · "))}</div>
        ${W.mats.length ? `<div style="margin-top:6px;font-size:.92rem">${W.mats.map(m => esc(m.name) + (m.have ? " ✓" : m.borrow ? " (emprunt)" : m.cost ? " (" + fmtEur(m.cost) + ")" : "")).join(" · ")}</div>` : ""}</div>
        <button class="btn primary" data-act="wz-save">Enregistrer la tâche</button>${back}`);
    }
  }
  function nextMat() { W.matIdx++; go(W.matIdx < W.mats.length ? "have" : "deps"); }
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, v = b.dataset.v;
    if (a === "wz-back") { if (hist.length) { W.step = hist.pop(); step(); } return; }
    if (a === "wz-title") { const t = $("#wz-title").value.trim(); if (!t) { toast("Dis-moi ce que tu as en tête."); return; } W.title = t; go(W.place ? "kind" : "place"); }
    if (a === "wz-place") { W.place = v; go("kind"); }
    if (a === "wz-kind") { W.kind = v; go(v === "entretien" ? "every" : "duration"); }
    if (a === "wz-every") { if (v === "day") return go("weekday"); W.everyDays = +v; W.weekday = null; go("duration"); }
    if (a === "wz-weekday") { W.weekday = +v; W.everyDays = 7; go("duration"); }
    if (a === "wz-duration") { W.duration = +v; go(W.kind === "entretien" ? "who" : "mats"); }
    if (a === "wz-mat-add") { const n = $("#wz-mat").value.trim(); if (n) { W.mats.push({ name: n }); step(); } }
    if (a === "wz-mat-done") { const n = $("#wz-mat").value.trim(); if (n) W.mats.push({ name: n }); W.matIdx = 0; go(W.mats.length ? "have" : "deps"); }
    if (a === "wz-have") { const m = W.mats[W.matIdx]; m.have = v === "have"; m.borrow = v === "borrow"; m.unsure = v === "unsure"; m.cost = 0; if (v === "buy" || v === "unsure") return go("cost"); nextMat(); }
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
      const t = { id: uid(), createdAt: todayISO(), title: W.title, kind: W.kind, place: W.place, zone: placeName(W.place), project: "", duration: W.duration, urgency: W.urgency, importance: W.importance,
        outdoor: PLACES[W.place].level === "ext", assignee: W.assignee, status: "todo", notes: "", deps: ent ? [] : W.deps, waitUntil: ent ? "" : W.waitUntil,
        materials: ent ? [] : W.mats.map(m => ({ name: m.name, cost: m.cost || 0, have: !!m.have, borrow: !!m.borrow })) };
      if (ent) Object.assign(t, { everyDays: W.everyDays, weekday: W.weekday ?? null, lastDone: todayISO() });
      putTask(t); closeSheet(); commit("Tâche ajoutée : " + W.title);
    }
  });
  sh.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "wz-title") { e.preventDefault(); sh.querySelector('[data-act="wz-title"]').click(); }
    if (e.target.id === "wz-mat") { e.preventDefault(); sh.querySelector('[data-act="wz-mat-add"]').click(); }
  });
  step();
}

/* ---------- pont vers Claude (sans clé API) ---------- */
function stateForClaude() {
  return tasksList().filter(t => t._.state !== "done").map(t => {
    const a = t._, o = { id: t.id, titre: t.title, type: t.kind, piece: placeOf(t), minutes: +t.duration || 0, etat: STATE_LABEL[a.state] };
    if (t.assignee) o.qui = t.assignee === "tous" ? "ensemble" : playerName(t.assignee);
    if (t.kind === "entretien") { o.rythme = rhythm(t); if (a.overdue) o.retard_jours = a.overdue; }
    else { if (a.missing.length) o.manque = a.missing.map(m => m.name + (m.cost ? " ~" + m.cost + "€" : "")); if (a.blockers.length) o.attend = a.blockers.map(b => S.data.tasks[b].title); if (t.waitUntil) o.pas_avant = t.waitUntil; if (t.project) o.projet = t.project; }
    return o;
  });
}
function claudePrompt(ask) {
  const lui = playerName("lui"), elle = playerName("elodie"), c = S.dev.ctx;
  const pieces = Object.entries(PLACES).map(([k, p]) => k + " = " + p.name).join(", ");
  return `Tu es Baloo, le guide de l'appli « Maison de Saucats » : la gestion de la maison de ${lui} et ${elle} (et de Baloo, leur berger blanc suisse), à Saucats en Gironde. Maison bois à étage : au rez-de-chaussée entrée, séjour avec cheminée, escalier et grande hauteur sous plafond (vide sur séjour), cuisine-salle à manger, couloir, 2 chambres (la 2 sert de bureau et chambre d'amis), salle d'eau, WC, buanderie-cellier ; à l'étage suite parentale avec penderie et coin coiffeuse, salle de bain, WC, coursive, terrasse du haut qui sert de salle de sport. Un bébé arrive en février 2027. Dehors : terrasse bois côté jardin (future pergola végétale devant la chambre), piscine en cours (maçonnerie faite, pisciniste au printemps 2027), mare naturelle à créer à côté, cabane en finition, allée, zone tropicale et méditerranéenne à venir, potager en permaculture, poulailler à reconstruire, puits, terrasse de l'entrée à poser, chemin d'accès, parking en granit et portail motorisé à faire. Sol sableux, Gironde.
${S.data.settings.guide ? "\nConsignes du foyer :\n" + S.data.settings.guide + "\n" : ""}
C'est ${S.dev.me ? playerName(S.dev.me) : lui} qui écrit. Aujourd'hui (${todayISO()}) : ${fmtMin(c.time)} de dispo, ${{ all: "dedans ou dehors", in: "dedans", out: "dehors" }[c.where]}, ${{ normal: "en forme", tired: "fatigué après une garde", off: "jour de récupération" }[c.energy]}.

Ma demande : ${ask || "(je t'explique dans le message suivant)"}

Tâches actuelles de l'appli (JSON) :
${JSON.stringify(stateForClaude())}

Méthode : pose-moi tes questions une par une avant de planifier. De quoi j'ai besoin (matériel, outils, consommables), est-ce que je l'ai déjà, où l'acheter ou l'emprunter, combien de temps ça prend, ce qu'il faut finir avant, l'urgence, qui s'en occupe. Tiens compte du budget, de la météo et de ce qui débloque d'autres tâches.
Quand tout est clair, donne-moi le plan, puis termine par un bloc \`\`\`json contenant un tableau des NOUVELLES tâches à ajouter dans l'appli, au format :
[{"title":"…","kind":"projet|reparation|entretien","place":"identifiant de pièce","project":"…","duration":60,"urgency":1-3,"importance":1-3,"assignee":"lui|elodie|tous|","materials":[{"name":"…","cost":20,"have":false,"borrow":false}],"deps":["id existant ou titre d'une nouvelle tâche"],"everyDays":null,"waitUntil":"AAAA-MM-JJ ou vide"}]
Identifiants de pièces : ${pieces}.`;
}
function openClaude() {
  const sh = openSheet(`
    <div class="panel-head"><h2>Demander à Claude</h2><button class="btn small" data-act="close">Fermer</button></div>
    ${guideBox("Explique ton idée. J'envoie l'état de la maison à Claude, il te pose ses questions, puis il te donne un bloc de tâches à recoller ici.")}
    <div class="field"><label for="cl-ask">Ce que tu as en tête</label><textarea id="cl-ask" placeholder="Ex : j'aimerais finir l'abri avant la naissance, mais le bois est cher. Planifie-moi ça."></textarea></div>
    <button class="btn primary" data-act="cl-go">1. Ouvrir Claude</button>
    <p class="muted" style="margin:0;font-size:.88rem">La demande est aussi copiée : si Claude s'ouvre vide, colle-la.</p>
    <div class="field"><label for="cl-back">2. Colle ici la réponse finale de Claude</label><textarea id="cl-back" placeholder="Colle tout le message, je retrouve le bloc json."></textarea></div>
    <button class="btn" data-act="cl-parse">Lire les tâches</button>
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
      $("#cl-preview").innerHTML = items.length ? `${items.map((x, i) => `<label class="task" style="grid-template-columns:auto 1fr;padding-left:12px"><input type="checkbox" data-i="${i}" checked style="width:22px;height:22px;accent-color:var(--accent)"><span class="body"><span class="t">${esc(x.title)}</span><span class="meta" style="display:block">${esc([KINDS[x.kind], PLACES[x.place] ? PLACES[x.place].name : "", fmtMin(x.duration), (x.materials || []).map(m => m.name).join(", ")].filter(Boolean).join(" · "))}</span></span></label>`).join("")}
        <button class="btn primary" data-act="cl-add">Ajouter les tâches cochées</button>` : `<div class="empty">Je ne trouve pas de bloc json valide dans ce texte.</div>`;
    }
    if (b.dataset.act === "cl-add") {
      const keep = [...sh.querySelectorAll("#cl-preview input:checked")].map(x => items[+x.dataset.i]);
      const n = addImported(keep); closeSheet(); commit(n + " tâche" + (n > 1 ? "s" : "") + " ajoutée" + (n > 1 ? "s" : ""));
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
    const kind = KINDS[x.kind] ? x.kind : "projet", ent = kind === "entretien", place = PLACES[x.place] ? x.place : (ZONE_TO_PLACE[x.zone] || "maison");
    const deps = ent ? [] : (x.deps || []).map(String).map(d => S.data.tasks[d] && !S.data.tasks[d].deleted ? d : byTitle[d.toLowerCase()]).filter(Boolean);
    const t = { id: ids[i], createdAt: todayISO(), title: String(x.title).slice(0, 140), kind, place, zone: placeName(place), project: ent ? "" : String(x.project || ""),
      duration: Math.max(5, +x.duration || 30), urgency: Math.min(3, Math.max(1, +x.urgency || 2)), importance: Math.min(3, Math.max(1, +x.importance || 2)),
      outdoor: PLACES[place].level === "ext", assignee: ["lui", "elodie", "tous"].includes(x.assignee) ? x.assignee : "", status: "todo", notes: "", deps,
      materials: ent ? [] : (x.materials || []).filter(m => m && m.name).map(m => ({ name: String(m.name), cost: +m.cost || 0, have: !!m.have, borrow: !!m.borrow })),
      waitUntil: /^\d{4}-\d{2}-\d{2}$/.test(x.waitUntil || "") ? x.waitUntil : "" };
    if (ent) Object.assign(t, { everyDays: Math.max(1, +x.everyDays || 7), lastDone: todayISO() });
    putTask(t);
  });
  return arr.length;
}

/* ---------- premier lancement ---------- */
function firstRun() {
  if ($("#sheet-root").innerHTML || S.dev.me) return;
  openSheet(`${guideBox("Bienvenue à la Maison de Saucats. Qui utilise ce téléphone ?")}
    <div class="people"><button class="card person" data-act="me" data-v="lui"><span class="pic">${mini("lui", 4)}</span><span class="pn">${esc(playerName("lui"))}</span></button>
    <button class="card person" data-act="me" data-v="elodie"><span class="pic">${mini("elodie", 4)}</span><span class="pn">${esc(playerName("elodie"))}</span></button></div>`);
}

/* ---------------- synchro GitHub ---------------- */
const b64enc = s => { const by = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = c => new TextDecoder().decode(Uint8Array.from(atob(c.replace(/\s/g, "")), ch => ch.charCodeAt(0)));
const canon = o => JSON.stringify(o, (k, v) => k === "_" ? undefined : (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v));
function mergeData(a, b) {
  if (!b) return a;
  const out = { v: Math.max(a.v || 1, b.v || 1), tasks: {}, log: Object.fromEntries([...new Set([...Object.keys(a.log || {}), ...Object.keys(b.log || {})])].map(k => { const x = a.log?.[k], y = b.log?.[k]; return [k, x && y ? (x.deleted || y.deleted ? { ...x, deleted: true } : x) : (x || y)]; })), applied: { ...(b.applied || {}), ...(a.applied || {}) }, settings: null };
  new Set([...Object.keys(a.tasks || {}), ...Object.keys(b.tasks || {})]).forEach(id => { const x = a.tasks?.[id], y = b.tasks?.[id]; out.tasks[id] = !x ? y : !y ? x : ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x); });
  out.settings = ((b.settings?.updatedAt || 0) > (a.settings?.updatedAt || 0)) ? b.settings : a.settings;
  return out;
}
const syncOn = () => S.dev.sync.token && S.dev.sync.owner && S.dev.sync.repo;
const apiUrl = () => `https://api.github.com/repos/${encodeURIComponent(S.dev.sync.owner)}/${encodeURIComponent(S.dev.sync.repo)}/contents/${S.dev.sync.path || "maison.json"}`;
const ghHeaders = () => ({ Authorization: "Bearer " + S.dev.sync.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
async function ghGet() {
  const r = await fetch(apiUrl() + "?t=" + Date.now(), { headers: ghHeaders(), cache: "no-store" });
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw { status: r.status };
  const j = await r.json();
  return { data: JSON.parse(b64dec(j.content)), sha: j.sha };
}
async function ghPut(data, sha) {
  const r = await fetch(apiUrl(), { method: "PUT", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Tâches mises à jour par " + playerName(S.dev.me || "lui"), content: b64enc(JSON.stringify(JSON.parse(canon(data)), null, 1)), ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw { status: r.status };
  return (await r.json()).content.sha;
}
let syncTimer = null, syncing = false;
function scheduleSync() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(doSync, 1500); }
function setSync(state, msg) { S.sync.state = state; S.sync.msg = msg; renderTop(); if (S.tab === "nous" && !$("#sheet-root").innerHTML && !document.activeElement?.matches("input,textarea")) render(); }
async function doSync(tries = 2) {
  if (!syncOn() || syncing) return;
  syncing = true; setSync("busy", "Synchronisation…");
  try {
    const remote = await ghGet();
    const merged = migrate(mergeData(S.data, remote.data));
    if (!remote.data || canon(merged) !== canon(remote.data)) await ghPut(merged, remote.sha);
    const changed = canon(merged) !== canon(S.data);
    S.data = merged; lsSet("maison-data", S.data);
    S.sync.dirty = false; lsSet("maison-dirty", false); syncing = false;
    setSync("ok", "Synchronisé à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    if (changed && !$("#sheet-root").innerHTML) render();
  } catch (e) {
    syncing = false;
    if ((e.status === 409 || e.status === 422) && tries > 1) return doSync(tries - 1);
    setSync("err", e.status === 401 ? "Jeton refusé : vérifie-le ou crée-en un nouveau."
      : e.status === 403 ? "Le jeton n'a pas le droit d'écrire dans ce dépôt (Contents : lecture et écriture)."
      : e.status === 404 ? "Dépôt introuvable : vérifie le nom et que le jeton y a accès."
      : "Pas de connexion : les changements restent sur ce téléphone et partiront plus tard.");
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) doSync(); });
window.addEventListener("online", () => doSync());
setInterval(() => { if (!document.hidden) doSync(); }, 90000);

/* ---------------- rappels ---------------- */
// Sans serveur, l'appli ne peut prévenir que lorsqu'elle est ouverte. Pour un rappel même appli fermée : le fichier agenda (.ics).
function remindNow() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  analyze();
  const sent = lsGet("maison-notified", {}), today = todayISO();
  tasksList().filter(t => hasDay(t) && t._.today && (!t.evening || new Date().getHours() >= 17)).forEach(t => {
    const k = t.id + today; if (sent[k]) return; sent[k] = 1;
    const body = t.notes || "C'est le jour.";
    navigator.serviceWorker?.getRegistration().then(r => r ? r.showNotification(t.title, { body, tag: k, icon: "icons/icon-192.png" }) : new Notification(t.title, { body })).catch(() => { });
  });
  lsSet("maison-notified", sent);
}
function icsFile() {
  const pad = n => String(n).padStart(2, "0"), BY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const ev = tasksList().filter(t => hasDay(t)).map(t => {
    const d = new Date(); d.setDate(d.getDate() + ((+t.weekday - d.getDay() + 7) % 7));
    const ds = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()), h = t.evening ? "200000" : "090000", he = t.evening ? "201500" : "091500";
    return ["BEGIN:VEVENT", "UID:" + t.id + "@maison-saucats", "DTSTAMP:" + ds + "T000000", "DTSTART;TZID=Europe/Paris:" + ds + "T" + h, "DTEND;TZID=Europe/Paris:" + ds + "T" + he,
      "RRULE:FREQ=WEEKLY;BYDAY=" + BY[+t.weekday], "SUMMARY:" + t.title, "DESCRIPTION:" + (t.notes || ""), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + t.title, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Maison de Saucats//FR", ...ev, "END:VCALENDAR"].join("\r\n");
}
setInterval(remindNow, 10 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) remindNow(); });

/* ---------------- événements ---------------- */
function toast(msg, o = {}) {
  const t = $("#toast");
  t.className = "toast" + (o.big ? " big" : "");
  t.innerHTML = `<div class="tm"><b>${esc(msg)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ""}</div>${o.action ? `<button class="tact">${esc(o.action)}</button>` : ""}`;
  if (o.action) t.querySelector(".tact").onclick = () => { t.hidden = true; o.onAction && o.onAction(); };
  t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, o.ms || 3200);
  if (o.big && !matchMedia("(prefers-reduced-motion: reduce)").matches) { t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }
}
const TABS = ["maison", "taches", "bilan", "achats", "agenda", "nous"];
function go(t) { if (!TABS.includes(t)) t = "maison"; S.tab = t; if (location.hash !== "#" + t) history.replaceState(null, "", "#" + t); render(false); window.scrollTo(0, 0); }

document.addEventListener("click", e => {
  const tab = e.target.closest("nav.tabs button"); if (tab) return go(tab.dataset.tab);
  const tg = e.target.closest("[data-tab-go]"); if (tg) return go(tg.dataset.tabGo);
  if (e.target.dataset && e.target.dataset.close) return closeSheet();
  const inSheet = e.target.closest(".sheet");
  const room = !inSheet && e.target.closest("[data-place],[data-room]");
  if (room && !room.matches("[data-act]")) return selectRoom(room.dataset.place || room.dataset.room);
  const lv = e.target.closest("[data-level]"); if (lv) { S.dev.level = lv.dataset.level; S.room = null; saveDev(); return render(); }
  const ctx = e.target.closest("[data-ctx]");
  if (ctx) { const k = ctx.dataset.ctx; S.dev.ctx[k] = k === "time" ? +ctx.dataset.v : ctx.dataset.v; saveDev(); return render(); }
  const f = e.target.closest("[data-filter]"); if (f) { S.filter = f.dataset.filter; return render(); }
  const p = e.target.closest("[data-pocket]"); if (p) { S.pocket = p.dataset.pocket; return render(); }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act;
  if (act === "close") closeSheet();
  else if (act === "edit") openEditor(a.dataset.id);
  else if (act === "done") { closeSheet(); completeTask(a.dataset.id); }
  else if (act === "unlog") { const l = S.data.log[a.dataset.id]; if (l) { S.data.log[a.dataset.id] = { ...l, deleted: true }; commit("Retiré de l'historique"); } }
  else if (act === "new") { closeSheet(); openEditor(null, a.dataset.place || ""); }
  else if (act === "rooms") { S.room = null; render(); }
  else if (act === "me") { S.dev.me = a.dataset.v; saveDev(); closeSheet(); render(); }
  else if (act === "unbuy") setBought(a.dataset.key, false);
  else if (act === "save-names") { S.data.settings = { ...S.data.settings, players: { lui: { name: $("#name-lui").value.trim() || "Baptiste" }, elodie: { name: $("#name-elodie").value.trim() || "Elodie" } }, updatedAt: Date.now() }; commit("Prénoms enregistrés"); }
  else if (act === "save-talk") { const u = $("#talk-url").value.trim(); if (u && !/^https:\/\/claude\.ai\//.test(u)) return toast("Le lien doit commencer par https://claude.ai/"); S.data.settings = { ...S.data.settings, talkUrl: u, updatedAt: Date.now() }; commit("Lien enregistré"); }
  else if (act === "save-guide") { S.data.settings = { ...S.data.settings, guide: $("#guide-txt").value.trim(), updatedAt: Date.now() }; commit("Consignes enregistrées"); }
  else if (act === "sync-save") { S.dev.sync = { ...S.dev.sync, owner: $("#sy-owner").value.trim(), repo: $("#sy-repo").value.trim(), token: $("#sy-token").value.trim() }; saveDev(); doSync(); }
  else if (act === "sync-now") doSync();
  else if (act === "sync-share") {
    const link = location.origin + location.pathname + "#join=" + btoa(unescape(encodeURIComponent(JSON.stringify(S.dev.sync))));
    const done = ok => toast(ok ? "Lien copié" : "Copie impossible : garde le lien affiché", { sub: "Il contient la clé du dépôt : envoie-le seulement à l'autre téléphone, en message privé.", ms: 6000 });
    navigator.clipboard?.writeText(link).then(() => done(true), () => { prompt("Lien à envoyer :", link); done(false); }) ?? (prompt("Lien à envoyer :", link), done(false));
  }
  else if (act === "export") {
    const u = URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(canon(S.data)), null, 1)], { type: "application/json" }));
    const l = document.createElement("a"); l.href = u; l.download = "maison-saucats-" + todayISO() + ".json"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  else if (act === "import") $("#import-file").click();
  else if (act === "notif") { if (!("Notification" in window)) return toast("Ce téléphone ne propose pas les notifications pour cette appli."); Notification.requestPermission().then(p => { toast(p === "granted" ? "Rappels activés quand l'appli est ouverte." : "Rappels refusés."); render(); remindNow(); }); }
  else if (act === "ics") {
    const u = URL.createObjectURL(new Blob([icsFile()], { type: "text/calendar" }));
    const l = document.createElement("a"); l.href = u; l.download = "rappels-maison-saucats.ics"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
});
document.addEventListener("change", e => {
  if (e.target.dataset.act === "bought" && e.target.checked) setBought(e.target.dataset.key, true);
  if (e.target.id === "goal") { S.data.settings = { ...S.data.settings, weeklyGoal: Math.max(1, Math.min(100, +e.target.value || 10)), updatedAt: Date.now() }; commit("Objectif enregistré"); }
  if (e.target.id === "weekly") { S.data.settings = { ...S.data.settings, weeklyHours: Math.max(1, Math.min(60, +e.target.value || 4)), updatedAt: Date.now() }; commit("Agenda recalculé"); }
  if (e.target.id === "import-file" && e.target.files[0]) e.target.files[0].text().then(txt => { try { const d = JSON.parse(txt); if (!d.tasks) throw 0; S.data = migrate(mergeData(S.data, d)); commit("Sauvegarde importée"); } catch (err) { toast("Ce fichier n'est pas une sauvegarde de l'appli."); } });
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("#sheet-root").innerHTML) closeSheet();
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.matches('[role="button"][data-act="edit"]')) { e.preventDefault(); openEditor(e.target.dataset.id); }
  else if (e.target.matches("[data-place]") && !e.target.closest(".sheet") && !e.target.matches("[data-act]")) { e.preventDefault(); selectRoom(e.target.dataset.place); }
});
function setBought(key, have) {
  tasksList().forEach(t => {
    if (!(t.materials || []).some(m => m.name && m.name.trim().toLowerCase() === key)) return;
    patchTask(t.id, { materials: t.materials.map(m => m.name && m.name.trim().toLowerCase() === key ? { ...m, have } : m) });
  });
  commit(have ? "Noté comme acheté" : "Remis dans les achats");
}
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== S.tab) { S.tab = h; render(false); } });

/* ---------------- démarrage ---------------- */
{ const h = location.hash.slice(1); if (TABS.includes(h)) S.tab = h;
  if (h.startsWith("join=")) {
    // lien envoyé par l'autre téléphone : on se branche sur le même dépôt
    try { const j = JSON.parse(decodeURIComponent(escape(atob(h.slice(5))))); if (j.token && j.owner && j.repo) { S.dev.sync = { ...S.dev.sync, ...j }; saveDev(); setTimeout(() => toast("Téléphone relié : récupération des tâches…"), 300); } } catch (e) { }
    history.replaceState(null, "", location.pathname + "#maison"); S.tab = "maison";
  }
}
render(false);
if (syncOn()) doSync();
setTimeout(remindNow, 1500);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
