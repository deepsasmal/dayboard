const $ = (s) => document.querySelector(s);
/* background tabs do no clock work; everything catches up the moment the tab is seen again */
const live = (f) => () => { if (!document.hidden) f(); };
const typingNow = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable; // the note page is a contenteditable
const applyPaintHide = () => { const f = $("#paintFig"); if (!f) return; f.classList.toggle("off", !!prefs.paintHide); $("#paintBtn").tabIndex = prefs.paintHide ? -1 : 0; try { localStorage["dayboard:ph"] = prefs.paintHide ? "1" : ""; } catch {} };
try { document.body.dataset.clock = localStorage["dayboard:cs"] || "solid"; document.documentElement.style.setProperty("--gt", localStorage["dayboard:gt"] || "1"); } catch {} // no flash of the wrong clock style or glass // no flash of the wrong clock style
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = (d) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

/* ---------- storage (chrome.storage, localStorage fallback for plain-file preview) ---------- */
const store = {
  async get() {
    if (globalThis.chrome?.storage) return chrome.storage.local.get(["tasks", "projects", "notes", "saved", "links", "active", "sview", "dockSeeded", "prefs", "paint", "trash", "snaps", "meeting", "hook", "ol", "archive", "inbox"]);
    return JSON.parse(localStorage.dayboard || "{}");
  },
  set(o) {
    if (globalThis.chrome?.storage) return chrome.storage.local.set(o);
    localStorage.dayboard = JSON.stringify({ ...JSON.parse(localStorage.dayboard || "{}"), ...o });
  },
};
let archive = [], inbox = [], tasks = [], links = [], saved = [], paint = {}, trash = [], snaps = {}, projects = ["Inbox", "Work", "Personal"];
let prefs = { city: "London", clock: "24", art: "both", wx: "on", golden: "on", chime: "on", heads: "on", clockStyle: "solid", paintHide: false, favs: [], glass: 50, units: null, openDay: "on", intent: null, fresh: "on", rings: "on", birth: "", lifespan: 80, lastBackup: 0, nudgeUntil: 0, firstSeen: 0 };
const CITIES = [
  { name: "Hyderabad", lat: 17.385, lon: 78.4867, tz: "Asia/Kolkata" }, { name: "Bengaluru", lat: 12.9716, lon: 77.5946, tz: "Asia/Kolkata" },
  { name: "Mumbai", lat: 19.076, lon: 72.8777, tz: "Asia/Kolkata" }, { name: "Delhi", lat: 28.6139, lon: 77.209, tz: "Asia/Kolkata" },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, tz: "Asia/Kolkata" }, { name: "Kolkata", lat: 22.5726, lon: 88.3639, tz: "Asia/Kolkata" },
  { name: "Pune", lat: 18.5204, lon: 73.8567, tz: "Asia/Kolkata" }, { name: "Dubai", lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" },
  { name: "Singapore", lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore" }, { name: "Tokyo", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" }, { name: "London", lat: 51.5072, lon: -0.1276, tz: "Europe/London" },
  { name: "Berlin", lat: 52.52, lon: 13.405, tz: "Europe/Berlin" }, { name: "New York", lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  { name: "San Francisco", lat: 37.7749, lon: -122.4194, tz: "America/Los_Angeles" },
];
const place = () => CITIES.find((c) => c.name === prefs.city) || CITIES[0];
const ui = { renaming: null, editing: null, addCol: null, when: "all", sview: "list", proj: null, addProj: null, tag: null, pri: 2, due: null, rem: null };
const save = () => store.set({ tasks, projects, links, saved, active: ui.proj, sview: ui.sview, dockSeeded: true, prefs, paint, trash, snaps, archive });

/* ---------- shortcuts: editable, linked to projects; project-less ones are pinned in the top bar ---------- */
const SEED = [
  ["Google", "https://www.google.com", null],
  ["GitHub", "https://github.com", null],
  ["Gmail", "https://mail.google.com", null],
  ["Calendar", "https://calendar.google.com", null],
  ["Maps", "https://maps.google.com", null],
  ["Wikipedia", "https://www.wikipedia.org", "@dock"],
  ["Excalidraw", "https://excalidraw.com", "@dock"],
  ["MDN", "https://developer.mozilla.org", "@dock"],
];
const ico = (l) => (globalThis.chrome?.runtime
  ? `<img alt="" src="chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(l.url)}&size=32">`
  : `<i>${esc(l.name[0] || "?")}</i>`);
const normUrl = (s) => new URL(/^[a-z]+:\/\//i.test(s.trim()) ? s.trim() : "https://" + s.trim()).href; // throws on junk
const label = (u) => { // github.com/Org/repo/pulls -> "repo / pulls"
  const x = new URL(u), p = x.pathname.split("/").filter(Boolean), h = x.hostname.replace(/^www\./, "");
  return h === "github.com" && p.length ? p.slice(1, 3).join(" / ") || p[0] : h + (p[0] ? " / " + decodeURIComponent(p[0]).slice(0, 20) : "");
};
const hostOf = (u) => new URL(u).hostname.replace(/^www\./, "");

const isPinned = (l) => !l.proj && !l.dock;
const group = (l) => (l.dock ? "@dock" : l.proj || ""); // "" = top bar, "@dock" = bottom dock, else a project
const pill = (l) => `<span class="lk" data-lid="${l.id}" draggable="true" title="Drag to reorder"><a draggable="false" href="${esc(l.url)}">${ico(l)}${esc(l.name)}</a><button class="lx up" data-ltop="${l.id}" aria-label="Move ${esc(l.name)} to top" title="Move to top"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14M12 20V9M7 13l5-5 5 5"/></svg></button><button class="lx ed" data-ledit="${l.id}" aria-label="Edit ${esc(l.name)}" title="Edit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="lx" data-ldel="${l.id}" aria-label="Remove ${esc(l.name)}">×</button></span>`;
function renderLinks() {
  $("#links").innerHTML = links.filter(isPinned).map(pill).join("");
  $("#dock").innerHTML = links.filter((l) => l.dock).map(pill).join("") + `<button id="dockAdd" class="plus" aria-label="Add to dock" title="Add to dock">+</button>`;
  const mine = links.filter((l) => l.proj && (!ui.proj || l.proj === ui.proj));
  $("#shortcuts").className = "shortcuts " + ui.sview;
  $("#vList").setAttribute("aria-pressed", ui.sview === "list"); $("#vGrid").setAttribute("aria-pressed", ui.sview === "grid");
  $("#spTitle").textContent = ui.proj ? `${ui.proj} shortcuts` : "Shortcuts";
  $("#shortcuts").innerHTML = mine.length ? mine.map((l) =>
    `<li data-lid="${l.id}" draggable="true" title="${esc(l.name)}"><span class="grip" aria-hidden="true"></span><a draggable="false" href="${esc(l.url)}">${ico(l)}<span>${esc(l.name)}</span><small>${esc(ui.proj ? hostOf(l.url) : l.proj)}</small></a><button class="lx up" data-ltop="${l.id}" aria-label="Move ${esc(l.name)} to top" title="Move to top"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14M12 20V9M7 13l5-5 5 5"/></svg></button><button class="lx ed" data-ledit="${l.id}" aria-label="Edit ${esc(l.name)}" title="Edit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="lx" data-ldel="${l.id}" aria-label="Remove ${esc(l.name)}">×</button></li>`).join("")
    : `<li class="fe">${ui.proj ? `Nothing in ${esc(ui.proj)} yet. Press + to add a link.` : "Press + to add your first shortcut."}</li>`;
  $("#switch").innerHTML = `<option value="">All projects</option>` + projects.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#switch").value = ui.proj || "";
}
$("#switch").onchange = (e) => { ui.proj = e.target.value || null; if (ui.proj) ui.addProj = ui.proj; save(); render(); };
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ldel]"); if (!b) return;
  if (editId === b.dataset.ldel) closeForm();
  const gone = links.find((l) => l.id === b.dataset.ldel), i = links.indexOf(gone);
  links = links.filter((l) => l !== gone); save(); renderLinks();
  undoable(`Removed ${gone.name}`, () => links.splice(Math.min(i, links.length), 0, gone));
});

/* view toggle + drag to reorder (dropping on another group also moves the link into that project / the top bar) */
$("#vList").onclick = () => { ui.sview = "list"; save(); renderLinks(); };
$("#vGrid").onclick = () => { ui.sview = "grid"; save(); renderLinks(); };
let dragId = null;
const clearMarks = () => document.querySelectorAll(".before,.after,.dragging").forEach((n) => n.classList.remove("before", "after", "dragging"));
const after = (e, el) => { const r = el.getBoundingClientRect(); return el.closest(".grid, .links, .dock") ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; };
document.addEventListener("dragstart", (e) => {
  const el = e.target.closest?.("[data-lid]"); if (!el) return;
  dragId = el.dataset.lid; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); el.classList.add("dragging");
});
/* a drag hit is an item (before/after by pointer position) or the heading above the list (= very top) */
const hit = (e) => {
  const el = e.target.closest?.("[data-lid]");
  if (el) return el.dataset.lid === dragId ? [] : [el, after(e, el)];
  const first = e.target.closest?.("#spHead") && $("#shortcuts [data-lid]");
  return first && first.dataset.lid !== dragId ? [first, false] : [];
};
function moveLink(id, targetId, end) {
  const target = links.find((l) => l.id === targetId);
  const [m] = links.splice(links.findIndex((l) => l.id === id), 1);
  m.proj = target.proj; m.dock = target.dock;
  links.splice(links.indexOf(target) + (end ? 1 : 0), 0, m);
  save(); renderLinks();
}
document.addEventListener("dragover", (e) => {
  const [el, end] = dragId ? hit(e) : []; if (!el) return;
  e.preventDefault(); document.querySelectorAll(".before,.after").forEach((n) => n.classList.remove("before", "after"));
  el.classList.add(end ? "after" : "before");
});
document.addEventListener("drop", (e) => {
  const [el, end] = dragId ? hit(e) : []; if (!el) return;
  e.preventDefault(); moveLink(dragId, el.dataset.lid, end);
});
// "Move to top": front of its own group (the same project, or the top bar)
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ltop]"); if (!b) return;
  const m = links.find((l) => l.id === b.dataset.ltop), first = links.find((l) => group(l) === group(m));
  if (first !== m) moveLink(m.id, first.id, false);
});
document.addEventListener("dragend", () => { dragId = null; clearMarks(); });

const spForm = $("#spForm");
let editId = null; // set while the form is editing an existing shortcut
function openForm(l, preset) {
  editId = l?.id ?? null;
  spForm.hidden = false; $("#spAdd").setAttribute("aria-expanded", true);
  $("#spProj").innerHTML = `<option value="">Pinned (top bar)</option><option value="@dock">Dock (bottom)</option>` + projects.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#spUrl").value = l?.url ?? ""; $("#spName").value = l?.name ?? ""; $("#spProj").value = l ? group(l) : preset ?? (ui.proj || "");
  $("#spSave").textContent = l ? "Update" : "Save"; $("#spErr").hidden = true;
  spForm.scrollIntoView({ block: "center", behavior: "smooth" }); $("#spUrl").focus();
}
function closeForm() { editId = null; spForm.reset(); spForm.hidden = true; $("#spAdd").setAttribute("aria-expanded", false); }
$("#spAdd").onclick = () => (spForm.hidden || editId ? openForm() : closeForm());
spForm.onkeydown = (e) => { if (e.key === "Escape") closeForm(); }; // no `&&` return: returning false would cancel every keypress
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ledit]"); if (b) openForm(links.find((l) => l.id === b.dataset.ledit));
  if (e.target.closest("#dockAdd")) openForm(null, "@dock");
});
spForm.onsubmit = (e) => {
  e.preventDefault();
  let url; try { url = normUrl($("#spUrl").value); } catch { $("#spErr").textContent = "That does not look like a link."; $("#spErr").hidden = false; return; }
  $("#spErr").hidden = true;
  const f = { name: $("#spName").value.trim() || label(url), url, proj: $("#spProj").value && $("#spProj").value !== "@dock" ? $("#spProj").value : null, dock: $("#spProj").value === "@dock" };
  const cur = editId && links.find((l) => l.id === editId);
  cur ? Object.assign(cur, f) : links.push({ id: crypto.randomUUID(), ...f });
  save(); closeForm(); renderLinks();
};

/* search bar doubles as a launcher: type to jump to a shortcut, Enter opens it, Ctrl+Enter in a new tab */
let sel = 0, res = [];
const isGh = (q) => /^gh\s/i.test(q);
function match(q) {
  q = q.toLowerCase();
  if (!q) return links.filter((l) => l.proj && (!ui.proj || l.proj === ui.proj)).slice(0, 8);
  const terms = q.split(/\s+/);
  return links.map((l) => {
    const hay = `${l.name} ${l.proj || ""} ${l.url}`.toLowerCase();
    return terms.every((t) => hay.includes(t)) ? [l, l.name.toLowerCase().startsWith(q) ? 0 : l.proj === ui.proj ? 1 : 2] : null;
  }).filter(Boolean).sort((a, b) => a[1] - b[1]).slice(0, 6).map((x) => x[0]);
}
function drop() {
  const q = $("#q").value.trim();
  res = isGh(q) ? [] : match(q);
  sel = Math.min(sel, q ? res.length : Math.max(res.length - 1, 0));
  $("#results").innerHTML = res.map((l, i) => `<li class="${i === sel ? "on" : ""}" data-i="${i}">${ico(l)}<span>${esc(l.name)}</span><small>${esc(l.dock ? "Dock" : l.proj || "Pinned")}</small></li>`).join("")
    + (q ? `<li class="web ${sel === res.length ? "on" : ""}" data-i="${res.length}"><span>Search ${isGh(q) ? "GitHub" : "Google"} for “${esc(isGh(q) ? q.slice(3) : q)}”</span></li>` : "");
  $("#results").hidden = !$("#results").innerHTML;
}
function go(i, newTab) {
  const q = $("#q").value.trim();
  const url = i < res.length ? res[i].url : !q ? null : isGh(q) ? "https://github.com/search?q=" + encodeURIComponent(q.slice(3)) : "https://www.google.com/search?q=" + encodeURIComponent(q);
  if (url) newTab ? window.open(url, "_blank") : (location.href = url);
}
$("#q").oninput = () => { sel = 0; drop(); };
$("#q").onfocus = () => { $("#q").blur(); openPal(); }; // the top bar is a door to Spotlight
$("#q").onblur = () => setTimeout(() => ($("#results").hidden = true), 150);
$("#q").onkeydown = (e) => {
  const n = res.length + ($("#q").value.trim() ? 1 : 0);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : n - 1)) % (n || 1); drop(); }
  else if (e.key === "Escape") { $("#q").blur(); }
  else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(sel, true); }
};
$("#results").onmousedown = (e) => e.preventDefault(); // keep focus so the click lands
$("#results").onclick = (e) => { const li = e.target.closest("li"); if (li) go(+li.dataset.i, e.ctrlKey || e.metaKey); };
$("#search").onsubmit = (e) => { e.preventDefault(); go(sel, false); };
addEventListener("keydown", (e) => {
  const typing = typingNow();
  if (e.key === "/" && !typing) { e.preventDefault(); openPal(); }
  if (e.key === "a" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $("#title").focus(); } // A: add a task
});

/* ---------- hero: greeting, clock, quote ---------- */
const QUOTES = [
  ["You have power over your mind, not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
  ["We suffer more often in imagination than in reality.", "Seneca"],
  ["We are what we repeatedly do. Excellence, then, is not an act but a habit.", "Will Durant on Aristotle"],
  ["The unexamined life is not worth living.", "Socrates"],
  ["It is not that we have a short time to live, but that we waste much of it.", "Seneca"],
  ["Well begun is half done.", "Aristotle"],
  ["Iron rusts from disuse; even so does inaction spoil the intellect.", "Leonardo da Vinci"],
  ["First say to yourself what you would be; and then do what you have to do.", "Epictetus"],
  ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche"],
  ["The art of living is more like wrestling than dancing.", "Marcus Aurelius"],
  ["The beginning is the most important part of the work.", "Plato"],
  ["Nothing is so strong as gentleness, nothing so gentle as real strength.", "Michel de Montaigne"],
];
const day = Math.floor(Date.now() / 864e5);
/* ---------- quote of the day: ZenQuotes, cached per local date, local list as offline fallback ---------- */
const setQuote = ([q, a]) => { $("#quote").textContent = q; $("#author").textContent = a; };
setQuote(QUOTES[day % QUOTES.length]);
(async () => {
  const key = "dayboard:quote:" + new Date().toDateString();
  try {
    let c = localStorage[key];
    if (!c) {
      const r = await fetch("https://zenquotes.io/api/today", { signal: AbortSignal.timeout(6000) });
      const [j] = await r.json();
      if (!j?.q) return;
      Object.keys(localStorage).filter((k) => k.startsWith("dayboard:quote:")).forEach((k) => localStorage.removeItem(k));
      c = localStorage[key] = JSON.stringify([j.q, j.a]);
    }
    setQuote(JSON.parse(c));
  } catch {} // offline or rate-limited: keep the local quote
})();
/* ---------- sun: sunrise / sunset for the chosen city (a default city), computed locally (NOAA solar equations, good to a couple of minutes) ---------- */
function sunTimes(y, m, d) { // a calendar date in the chosen city -> [sunrise, sunset] in ms
  const rad = Math.PI / 180, day = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
  const P = place(), lw = rad * -P.lon, phi = rad * P.lat, e = rad * 23.4397;
  const n = Math.round((Date.UTC(y, m, d, 12) - P.lon / 15 * 36e5) / day - 0.5 + J1970 - J2000 - J0 - lw / (2 * Math.PI)); // 12:00 IST
  const approx = (Ht) => J0 + (Ht + lw) / (2 * Math.PI) + n, ds = approx(0), M = rad * (357.5291 + 0.98560028 * ds);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)), transit = (x) => J2000 + x + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const Jn = transit(ds), Js = transit(approx(w)), ms = (J) => (J + 0.5 - J1970) * day;
  return [ms(Jn - (Js - Jn)), ms(Js)];
}
const hhmm = (ms) => new Date(ms).toLocaleTimeString(prefs.clock === "12" ? "en-US" : "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: prefs.clock === "12" ? "h12" : "h23", timeZone: place().tz });
const span = (ms) => { const m = Math.max(0, Math.round(ms / 6e4)); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };
const SUN = [[0, [244, 163, 168]], [0.25, [246, 195, 120]], [0.5, [255, 216, 74]], [0.75, [255, 159, 67]], [1, [255, 107, 61]]]; // rose, peach, noon yellow, amber, orange
function sunColor(f) { // morning -> noon -> evening
  for (let i = 1; i < SUN.length; i++) if (f <= SUN[i][0]) {
    const [a, ca] = SUN[i - 1], [b, cb] = SUN[i], t = (f - a) / (b - a);
    return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(",")})`;
  }
  return `rgb(${SUN.at(-1)[1].join(",")})`;
}
const LIGHT = [[0, "244,163,168", .16, .22], [0.2, "246,195,120", .07, .14], [0.5, "255,226,140", .03, .1], [0.8, "255,150,70", .09, .2], [1, "150,90,150", .2, .22]]; // sun fraction -> wash rgb, wash alpha, glow alpha
function renderLight(f, pos) { // dawn rose, noon barely-there gold, dusk orange-violet, night indigo
  let c, a, g;
  if (f === null) [c, a, g] = ["24,34,84", .3, 0];
  else for (let i = 1; i < LIGHT.length; i++) if (f <= LIGHT[i][0]) {
    const [p, cp, ap, gp] = LIGHT[i - 1], [q, cq, aq, gq] = LIGHT[i], t = (f - p) / (q - p), mix = (x, y) => x + (y - x) * t;
    const rgb = cp.split(",").map((v, k) => Math.round(mix(+v, +cq.split(",")[k]))).join(",");
    [c, a, g] = [rgb, mix(ap, aq), mix(gp, gq)]; break;
  }
  const s = $(".light").style;
  s.setProperty("--tint", `rgba(${c},${a})`); s.setProperty("--glow", `rgba(${c},${g})`); s.setProperty("--gx", `${10 + 80 * (1 - Math.cos(Math.PI * pos)) / 2}%`);
}
/* golden hour: an alarm 30 minutes before sunset, so the note also arrives with no tab open (background.js shows it) */
let goldenKey = "";
function goldenSchedule(set) {
  if (!globalThis.chrome?.alarms) return;
  const when = set - 18e5, key = `${prefs.golden}:${when}`; if (key === goldenKey) return; goldenKey = key;
  chrome.alarms.clear("golden"); if (prefs.golden !== "off" && when > Date.now()) chrome.alarms.create("golden", { when });
}
/* ---------- moon: phase, rise and set, next phases. Standard low-precision lunar series, computed on the device (good to a few minutes), no network ---------- */
const MR = Math.PI / 180, MJD = (ms) => ms / 864e5 - .5 + 2440588 - 2451545; // days since J2000
const mRA = (l, b) => Math.atan2(Math.sin(l) * Math.cos(MR * 23.4397) - Math.tan(b) * Math.sin(MR * 23.4397), Math.cos(l));
const mDec = (l, b) => Math.asin(Math.sin(b) * Math.cos(MR * 23.4397) + Math.cos(b) * Math.sin(MR * 23.4397) * Math.sin(l));
function moonC(d) { // geocentric moon: longitude with the main perturbation terms (Meeus), latitude, distance in km
  const T = d / 36525, s = Math.sin, c = Math.cos, L = MR * (218.3164477 + 481267.88123421 * T), D = MR * (297.8501921 + 445267.1114034 * T), M = MR * (357.5291092 + 35999.0502909 * T), Mp = MR * (134.9633964 + 477198.8675055 * T), F = MR * (93.272095 + 483202.0175233 * T);
  const l = L + MR * (6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + .658314 * s(2 * D) + .213618 * s(2 * Mp) - .185116 * s(M) - .114332 * s(2 * F) + .058793 * s(2 * D - 2 * Mp) + .057066 * s(2 * D - M - Mp) + .053322 * s(2 * D + Mp) + .045758 * s(2 * D - M));
  const b = MR * (5.128122 * s(F) + .280602 * s(Mp + F) + .277693 * s(Mp - F) + .173237 * s(2 * D - F));
  return { ra: mRA(l, b), dec: mDec(l, b), dist: 385000.56 - 20905.355 * c(Mp) - 3699.111 * c(2 * D - Mp) - 2955.968 * c(2 * D) - 569.925 * c(2 * Mp), lon: l };
}
function sunC(d) { const M = MR * (357.5291 + 0.98560028 * d), C = MR * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)), L = M + C + MR * 102.9372 + Math.PI; return { ra: mRA(L, 0), dec: mDec(L, 0), lon: L }; }
const elong = (ms) => { const d = MJD(ms); return ((((moonC(d).lon - sunC(d).lon) / (2 * Math.PI)) % 1) + 1) % 1; }; // 0 new, .25 first quarter, .5 full, .75 last quarter
function moonPhase(ms) { const p = elong(ms); return { f: (1 - Math.cos(2 * Math.PI * p)) / 2, p }; } // f = lit fraction 0..1
function moonAlt(ms) { // altitude (radians, with refraction) above the chosen city's horizon
  const P = place(), phi = MR * P.lat, d = MJD(ms), c = moonC(d), H = MR * (280.16 + 360.9856235 * d) - MR * -P.lon - c.ra;
  const h = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H)), hh = Math.max(h, 0);
  return h + .0002967 / Math.tan(hh + .00312536 / (hh + .08901179));
}
let moonCache = { k: 0 };
function moonDay(now) { // rises and sets from a day ago to a day and a half ahead, so "now" always has a last and a next
  const k = Math.floor(now / 3e5), P = place().name; if (moonCache.k === k && moonCache.c === P) return moonCache.v;
  const hc = MR * .133, step = 6e5, rises = [], sets = []; let prev = moonAlt(now - 864e5) - hc;
  for (let t = now - 864e5 + step; t <= now + 36 * 36e5; t += step) { const a = moonAlt(t) - hc; if (prev < 0 && a >= 0) rises.push(t - step + step * -prev / (a - prev)); else if (prev >= 0 && a < 0) sets.push(t - step + step * prev / (prev - a)); prev = a; }
  const up = moonAlt(now) >= hc, v = { up, lastRise: rises.filter((x) => x <= now).pop() ?? null, nextRise: rises.find((x) => x > now) ?? null, nextSet: sets.find((x) => x > now) ?? null };
  v.setAfterRise = v.nextRise ? sets.find((x) => x > v.nextRise) ?? null : null; moonCache = { k, c: P, v }; return v;
}
function nextPhase(target, from) { // when the moon next reaches 0 / .25 / .5 / .75 of its way round, by ecliptic longitude (how new and full moon are defined)
  const g = (t) => ((elong(t) - target + 1.5) % 1) - .5;  let a = from, ga = g(a);
  for (let t = from + 6 * 36e5; t < from + 32 * 864e5; t += 6 * 36e5) { const gb = g(t); if (ga < 0 && gb >= 0) { let lo = t - 6 * 36e5, hi = t; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid; } return hi; } ga = gb; }
  return null;
}
const PHASES = [[.03, "New moon"], [.22, "Waxing crescent"], [.28, "First quarter"], [.47, "Waxing gibbous"], [.53, "Full moon"], [.72, "Waning gibbous"], [.78, "Last quarter"], [.97, "Waning crescent"], [1.01, "New moon"]];
const phaseName = (p) => PHASES.find(([x]) => p < x)[1];
function moonG(p, r, flip) { // a moon of radius r centred on 0,0; the terminator is an ellipse
  const k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r, wax = p < .5, sw = wax ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  const lit = p < .012 || p > .988 ? "" : `<path d="M0 ${-r}A${r} ${r} 0 0 ${wax ? 1 : 0} 0 ${r}A${rx.toFixed(2)} ${r} 0 0 ${sw} 0 ${-r}Z" fill="currentColor"/>`;
  return `<g${flip ? ' transform="scale(-1 1)"' : ""}><circle r="${r}" fill="rgba(255,255,255,.07)" stroke="currentColor" stroke-opacity=".42"/>${lit}</g>`;
}
let sunMarkup = null, iconKey = "";
function renderMoonIcon(night, now) { // after sunset the moon takes the sun's place on the arc, riding it from its real moonrise to moonset
  const icon = $("#sunIcon"); sunMarkup ??= icon.innerHTML; if (skyHold) return; // mid-event: the icon is fading out
  const { f, p } = moonPhase(now), flip = place().lat < 0, ph = Math.round(p * 300) + (flip ? "f" : "");
  if (iconKey !== "b" + ph) { $("#moonBtn svg").innerHTML = `<g transform="translate(11 11)">${moonG(p, 8, flip)}</g>`; iconKey = "b" + ph; }
  if (!night) { if (icon.dataset.m) { icon.innerHTML = sunMarkup; delete icon.dataset.m; } return; }
  if (icon.dataset.m !== ph) { icon.innerHTML = moonG(p, 9.5, flip); icon.dataset.m = ph; }
  const md = moonDay(now), pos = md.up && md.lastRise && md.nextSet ? Math.min(1, Math.max(0, (now - md.lastRise) / (md.nextSet - md.lastRise))) : 0;
  $("#sunDone").setAttribute("stroke-dasharray", `${md.up ? pos : 0} 1`);
  icon.setAttribute("transform", `translate(${120 - 108 * Math.cos(Math.PI * pos)} ${68 - 56 * Math.sin(Math.PI * pos)})`);
  $("#sun").classList.toggle("parked", !md.up);
  $("#sunLeft").textContent = !md.up && md.nextRise ? `${phaseName(p)} · rises ${hhmm(md.nextRise)}` : `${phaseName(p)} · ${Math.round(f * 100)}%`;
}
const dayTag = (ms) => { const k = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: place().tz }), n = Date.now(); return k(ms) === k(n) ? "" : k(ms) === k(n + 864e5) ? " tomorrow" : k(ms) === k(n - 864e5) ? " yesterday" : ""; };
function drawMoon() {
  const now = Date.now(), { f, p } = moonPhase(now), flip = place().lat < 0, md = moonDay(now);
  const rise = md.up ? md.lastRise : md.nextRise, set = md.up ? md.nextSet : md.setAfterRise;
  const nx = [[0, "New moon"], [.25, "First quarter"], [.5, "Full moon"], [.75, "Last quarter"]].map(([t, n]) => [n, nextPhase(t, now)]).filter((x) => x[1]).sort((a, b) => a[1] - b[1]);
  const when = (t) => { const d = Math.round((t - now) / 864e5); return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`; };
  const week = [...Array(7)].map((_, i) => { const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + i); return `<span class="${i ? "" : "now"}"><svg viewBox="-9 -9 18 18" width="22" height="22" aria-hidden="true">${moonG(moonPhase(t.getTime()).p, 7, flip)}</svg><small>${i ? t.toLocaleDateString(undefined, { weekday: "short" }) : "Today"}</small></span>`; }).join("");
  $("#moonPop").innerHTML = `<div class="mphead"><svg viewBox="-30 -30 60 60" width="84" height="84" aria-hidden="true">${moonG(p, 25, flip)}</svg><div><h3>${phaseName(p)}</h3><p>${Math.round(f * 100)}% lit</p></div></div>`
    + `<div class="mprow"><span><small>Moonrise</small><b class="mono">${rise ? hhmm(rise) + `<i>${dayTag(rise)}</i>` : "–"}</b></span><span class="r"><small>Moonset</small><b class="mono">${set ? hhmm(set) + `<i>${dayTag(set)}</i>` : "–"}</b></span></div>`
    + `<ul class="mpnext">${nx.map(([n, t]) => `<li><span>${n}</span><b>${new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</b><small>${when(t)}</small></li>`).join("")}</ul>`
    + `<div class="mpweek" aria-label="The week ahead">${week}</div>`;
}
function moonToggle(on = $("#moonPop").hidden) { if (on) drawMoon(); $("#moonPop").hidden = !on; $("#moonBtn").setAttribute("aria-expanded", on); }
$("#moonBtn").onclick = (e) => { e.stopPropagation(); moonToggle(); };
$("#sun svg").onclick = () => { if ($("#sun").classList.contains("night")) moonToggle(); };
document.addEventListener("click", (e) => { if (!$("#moonPop").hidden && !e.target.closest("#moonPop, #moonBtn, #sun svg")) moonToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#moonPop").hidden) { moonToggle(false); $("#moonBtn").focus(); } });
setInterval(live(() => { if (!$("#moonPop").hidden) drawMoon(); }), 6e4);
let skyWas = null, skyAt = 0, skyT = 0, skyHold = false;
function skyEvent(kind) { // "set" | "rise": the sun slips away and the sky warms, once; the moon (or sun) then takes its place
  if (still.matches) return;
  const b = document.body, ic = $("#sunIcon"); b.classList.remove("sky-set", "sky-rise"); void b.offsetWidth; b.classList.add("sky-" + kind);
  clearTimeout(skyT); skyT = setTimeout(() => b.classList.remove("sky-" + kind), 14500);
  skyHold = true; ic.style.transition = "opacity 2.2s ease"; ic.style.opacity = 0;
  setTimeout(() => { skyHold = false; renderSun(); ic.style.opacity = ""; setTimeout(() => (ic.style.transition = ""), 2400); }, 2300);
}
function renderSun() {
  const now = Date.now(), [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: place().tz }).format(now).split("-").map(Number);
  const [rise, set] = sunTimes(y, m - 1, d);
  let f = null, text;
  if (now < rise) text = `Sunrise in ${span(rise - now)}`;
  else if (now <= set) { f = (now - rise) / (set - rise); text = set - now <= 18e5 ? `Golden hour · ${span(set - now)} left` : `${span(set - now)} of light left`; }
  else text = `Sunrise in ${span(sunTimes(y, m - 1, d + 1)[0] - now)}`; // tomorrow's
  goldenSchedule(now < set - 18e5 ? set : sunTimes(y, m - 1, d + 1)[1]);
  $("#sunRise").textContent = hhmm(rise); $("#sunSet").textContent = hhmm(set); $("#sunLeft").textContent = text;
  const pos = f ?? (now < rise ? 0 : 1); // before sunrise: at the start, after sunset: at the end (both dimmed)
  $("#sunDone").setAttribute("stroke-dasharray", `${f ?? 0} 1`);
  $("#sunIcon").setAttribute("transform", `translate(${120 - 108 * Math.cos(Math.PI * pos)} ${68 - 56 * Math.sin(Math.PI * pos)})`);
  $("#sunIcon").style.color = f === null ? "" : sunColor(f);
  const dayNow = f !== null; if (skyWas !== null && dayNow !== skyWas && now - skyAt < 18e4 && !document.hidden && !skyHold) skyEvent(dayNow ? "rise" : "set"); skyWas = dayNow; skyAt = now; // only a change seen live, never one slept through
  $("#sun").classList.toggle("night", f === null); renderLight(f, pos); renderMoonIcon(f === null, now);
  $("#sun").setAttribute("aria-label", `${place().name}: sunrise ${hhmm(rise)}, sunset ${hhmm(set)}. ${$("#sunLeft").textContent}.`);
}
function renderWeek() { // Monday to Sunday of the current week
  const now = new Date(), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  $("#week").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i), me = d.toDateString() === now.toDateString();
    return `<li class="${me ? "today" : d < now ? "past" : ""}" ${me ? 'aria-current="date"' : ""}>${d.toLocaleDateString(undefined, { weekday: "short" })}<b>${d.getDate()}</b></li>`;
  }).join("");
}
function tick() {
  const d = new Date(), h = d.getHours();
  $("#greet").textContent = (h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + ".";
  renderWeek(); renderSun();
  $("#dateT").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const h12 = prefs.clock === "12", [, hh, mm, ap] = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: h12 ? "h12" : "h23" }).match(/(\d+):(\d+)\s?([AP]M)?/);
  $("#clock").innerHTML = `${h12 ? +hh : hh}<span>:</span>${mm}${ap ? `<small class="ampm">${ap}</small>` : ""}`;
}
tick(); setInterval(live(tick), 1e4);

/* ---------- generative art (offline fallback): layered ridgelines, palette follows the hour, seeded by the day ---------- */
function artFallback() {
  const h = new Date().getHours();
  // [sky top, sky bottom, sun, ridge far, ridge near]
  const P = h < 6 || h >= 21 ? ["#06070d", "#1a2238", "#cfd6ee", "#141b2e", "#0a0d16"]
    : h < 10 ? ["#2a3a66", "#e8a85c", "#fff1d6", "#4a4a6a", "#1a1a26"]
    : h < 17 ? ["#1c3a6e", "#7aa2c9", "#fff8e6", "#35527c", "#14202f"]
    : ["#1d2a5e", "#e8814c", "#ffd9a0", "#4a3a5c", "#17131c"];
  let s = day * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const ridge = (base, amp, fill, op) => {
    let d = `M0 1000`; const n = 14, ph = r() * 6;
    for (let i = 0; i <= n; i++) d += ` L${(i / n) * 1600} ${base - amp * (Math.sin(i * 0.55 + ph) * 0.6 + r() * 0.5)}`;
    return `<path d="${d} L1600 1000Z" fill="${fill}" opacity="${op}"/>`;
  };
  const stars = h < 6 || h >= 21 ? Array.from({ length: 70 }, () => `<circle cx="${r() * 1600}" cy="${r() * 450}" r="${r() * 1.3 + .3}" fill="#fff" opacity="${r() * .7}"/>`).join("") : "";
  $("#art").innerHTML = `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[0]}"/><stop offset=".75" stop-color="${P[1]}"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
    <rect width="1600" height="1000" fill="url(#sky)"/>${stars}
    <circle cx="${900 + r() * 400}" cy="${430 + r() * 80}" r="70" fill="${P[2]}" opacity=".9" filter="url(#soft)"/>
    <g class="drift">${ridge(620, 90, P[3], .55)}${ridge(720, 120, P[3], .8)}${ridge(820, 140, P[4], .9)}${ridge(920, 110, P[4], 1)}</g></svg>`;
}

/* ---------- live backdrop: public-domain paintings (The Met Open Access), slow Ken Burns drift, crossfade ---------- */
const WORKS = [
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-30758-001.jpg",
  "Aristotle with a Bust of Homer",
  "Rembrandt",
  "1653"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DT82.jpg",
  "The Rocky Mountains, Lander's Peak",
  "Albert Bierstadt",
  "1863"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-43051-001.jpg",
  "Madonna and Child Enthroned with Saints",
  "Raphael",
  "ca. 1504"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DT78.jpg",
  "Heart of the Andes",
  "Frederic Edwin Church",
  "1859"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-19299-001.jpg",
  "Venus and Adonis",
  "Titian",
  "1550s"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DP-12550-001.jpg",
  "View from Mount Holyoke, Northampton, Massachusetts, after a",
  "Thomas Cole",
  "1836"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-24049-001.jpg",
  "The Last Communion of Saint Jerome",
  "Botticelli",
  "early 1490s"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DT208249.jpg",
  "A View near Tivoli",
  "Thomas Cole",
  "1832"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP353257.jpg",
  "Young Woman with a Water Pitcher",
  "Johannes Vermeer",
  "ca. 1662"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DP-12799-001.jpg",
  "The Titan's Goblet",
  "Thomas Cole",
  "1833"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP119115.jpg",
  "The Harvesters",
  "Pieter Bruegel the Elder",
  "1565"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP130999.jpg",
  "Cypresses",
  "Vincent van Gogh",
  "1889"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-687-001.jpg",
  "The Musicians",
  "Caravaggio",
  "1597"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
  "Wheat Field with Cypresses",
  "Vincent van Gogh",
  "1889"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-14286-015.jpg",
  "The Fortune-Teller",
  "Georges de La Tour",
  "probably 1630s"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-13360-001.jpg",
  "Whalers",
  "Joseph Mallord William Turner",
  "ca. 1845"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP349564.jpg",
  "View of Toledo",
  "El Greco",
  "ca. 1599–1600"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/77J_045R2M.jpg",
  "Mont Sainte-Victoire",
  "Paul Cézanne",
  "ca. 1902–6"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP167124.jpg",
  "Mars and Venus United by Love",
  "Paolo Veronese",
  "1570s"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP164837.jpg",
  "Salisbury Cathedral from the Bishop's Grounds",
  "John Constable",
  "ca. 1825"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DP-29324-001.jpg",
  "The Abduction of the Sabine Women",
  "Nicolas Poussin",
  "probably 1633–34"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ep/web-large/DT1859.jpg",
  "Jalais Hill, Pontoise",
  "Camille Pissarro",
  "1867"
 ],
 [
  "https://images.metmuseum.org/CRDImages/rl/web-large/DP267397.jpg",
  "The Annunciation",
  "Botticelli",
  "ca. 1490"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/DT84.jpg",
  "Lake George",
  "John Frederick Kensett",
  "1869"
 ],
 [
  "https://images.metmuseum.org/CRDImages/as/web-large/DP141042.jpg",
  "Under the Wave off Kanagawa",
  "Katsushika Hokusai",
  "ca. 1830–32"
 ],
 [
  "https://images.metmuseum.org/CRDImages/ad/web-large/ap1970.58.jpg",
  "River Scene",
  "Asher Brown Durand",
  "1854"
 ]
];
/* live nature photos: Wikimedia Commons featured pictures (free licences). Fetched at most once a day, cached, mixed in with the paintings. */
const CATS = ["landscapes", "mountains", "forests", "sunsets", "nature"];
const strip = (h = "") => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
const dayKey = new Date().toDateString();
let photos = [], stale = true;
try { const c = JSON.parse(localStorage["dayboard:wiki"]); photos = c.items || []; stale = c.day !== dayKey; } catch {}
async function loadPhotos() {
  const api = (q) => fetch("https://commons.wikimedia.org/w/api.php?format=json&origin=*&" + q, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
  const cat = CATS[Math.floor(Date.now() / 864e5) % CATS.length];
  const titles = (await api(`action=query&list=categorymembers&cmtitle=Category:Featured_pictures_of_${cat}&cmtype=file&cmlimit=500`)).query.categorymembers.map((m) => m.title);
  const pick = titles.sort(() => Math.random() - 0.5).slice(0, 24);
  const r = await api(`action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${Math.max(innerWidth, screen.width) * devicePixelRatio > 2200 ? 2560 : 1920}&titles=${encodeURIComponent(pick.join("|"))}`);
  const items = Object.values(r.query.pages).map((p) => p.imageinfo?.[0])
    .filter((x) => x && x.mime === "image/jpeg" && x.width >= 3000 && x.width / x.height > 1.3 && x.width / x.height < 2.4) // HD, landscape-ish, no extreme panoramas
    .map((x) => { const m = x.extmetadata || {}, by = strip(m.Artist?.value).slice(0, 40); return [x.thumburl, strip(m.ObjectName?.value).slice(0, 56) || "Untitled", by, "", `${by ? by + " · " : ""}Wikimedia Commons`]; });
  if (items.length) { photos = items; localStorage["dayboard:wiki"] = JSON.stringify({ day: dayKey, items }); }
}
if (stale) loadPhotos().catch(() => {}); // offline or rate-limited: keep what we have
let mine = [], mineReady = false; // your own pictures (stored in IndexedDB); mine[i] = ["mine:<id>", name, "", "", "Your picture"]
const mineUrl = {}, mineRec = {};
const favs = () => prefs.favs || [];
const urlOf = (src) => (src.startsWith("mine:") ? mineUrl[src.slice(5)] : src);
/* ---------- a growing catalogue: fresh Met paintings every week; pictures you have seen fade out of rotation and come back slowly ---------- */
const DAY = 864e5, WEEK = 7 * DAY, weekNo = () => Math.floor((Date.now() / DAY + 3) / 7); // Monday-based week count
let lib = { week: -1, items: [] }; // items: [src, title, artist, date, "", metObjectID, addedAt]
try { lib = { ...lib, ...JSON.parse(localStorage["dayboard:lib"] || "{}") }; } catch {}
let seenAt = {}; try { seenAt = JSON.parse(localStorage["dayboard:seen"] || "{}"); } catch {}
const libSave = () => { try { localStorage["dayboard:lib"] = JSON.stringify(lib); } catch {} };
function markSeen(src) {
  seenAt[src] = Date.now(); const ks = Object.keys(seenAt);
  if (ks.length > 800) ks.sort((x, y) => seenAt[x] - seenAt[y]).slice(0, ks.length - 600).forEach((k) => delete seenAt[k]);
  try { localStorage["dayboard:seen"] = JSON.stringify(seenAt); } catch {}
}
const artAll = () => { const have = new Set(WORKS.map((w) => w[0])); return [...lib.items.filter((x) => !have.has(x[0])).sort((x, y) => y[6] - x[6]), ...WORKS]; }; // newest first, then the original 26
function weightOf(it) { // how likely a picture is to come up
  const s = seenAt[it[0]], cool = s ? Math.min(1, Math.max(0, (Date.now() - s - 21 * DAY) / (40 * DAY))) : 1; // not at all inside 3 weeks, fully back after about 9
  const age = it[6] ? (Date.now() - it[6]) / WEEK : it.length === 5 ? 0 : 12; // new arrivals count from the day they came; photos and yours are fresh; the original 26 act like 12-week-old pictures
  return cool / (1 + age / 5) + 0.0005; // a 5-week-old picture is half as likely as a new one, a year-old one about a tenth, and never impossible
}
function drawFrom(P, rnd, avoid) { // in "Art + Nature", nature gets about 45% of the draws however many photos the day brought
  if (prefs.art === "both" && photos.length) {
    const isPhoto = new Set(photos.map((x) => x[0])), nat = rnd() < 0.45, G = P.map((it, i) => [it, i]).filter(([it]) => isPhoto.has(it[0]) === nat);
    if (G.length) return G[pickIdx(G.map((x) => x[0]), rnd, avoid)][1];
  }
  return pickIdx(P, rnd, avoid);
}
function pickIdx(P, rnd, avoid) {
  const w = P.map((it) => (it[0] === avoid ? 0 : weightOf(it))), tot = w.reduce((x, y) => x + y, 0); let r = rnd() * tot;
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return i;
  return w.length - 1;
}
const seeded = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pool = () => { // "Art" is the whole painting catalogue; "Nature" the day's photos; "Mine" and "Favourites" are their own sets
  const a = prefs.art;
  if (a === "mine") return mine.length ? mine : artAll();
  if (a === "favs") return favs().length ? favs() : artAll();
  if (a === "photos" && photos.length) return photos;
  const art = artAll();
  if (a === "both") return [...(photos.length ? photos : []), ...art, ...mine];
  return art;
};
let artNow = null;
const slot = Math.floor(Date.now() / 108e5); // the picture changes at most every 3 hours, or on refresh
const keepArt = (key) => { try { localStorage["dayboard:art"] = JSON.stringify({ slot, key }); } catch {} };
let wi = 0;
{ // the picture for this 3-hour slot: remembered if already chosen, otherwise drawn by the weights, seeded by the slot so every tab agrees
  const P = pool(); let key = null;
  try { const a = JSON.parse(localStorage["dayboard:art"]); if (a.slot === slot) key = a.key; } catch {}
  wi = key ? P.findIndex((x) => x[0] === key) : -1;
  if (wi < 0) { wi = drawFrom(P, seeded(slot), null); keepArt(P[wi][0]); }
}
let showSeq = 0, pin = null; // pin: a wallpaper the user picked; it stays until they ask for another
try { pin = JSON.parse(localStorage["dayboard:pin"] || "null"); } catch {}
const unpin = () => { pin = null; try { localStorage.removeItem("dayboard:pin"); } catch {} };
/* a 6000px original decodes to ~100 MB; the screen can use far less, so the original is shrunk to ~1.8x the screen (cap 3600px) before it is shown */
const FIT = () => Math.min(3600, Math.max(2560, Math.round(innerWidth * (devicePixelRatio || 1) * 1.8)));
function fileSize(u8) { // width and height from a JPEG or PNG header, without decoding it
  if (u8[0] === 0x89 && u8[1] === 0x50) return [(u8[16] << 24) | (u8[17] << 16) | (u8[18] << 8) | u8[19], (u8[20] << 24) | (u8[21] << 16) | (u8[22] << 8) | u8[23]];
  if (u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  for (let i = 2; i < u8.length - 9;) { if (u8[i] !== 0xff) { i++; continue; } const m = u8[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(u8[i + 7] << 8) | u8[i + 8], (u8[i + 5] << 8) | u8[i + 6]]; i += 2 + ((u8[i + 2] << 8) | u8[i + 3]); }
  return null;
}
async function fitBlob(url) { // -> an object URL of the picture at a size worth decoding
  const r = await fetch(url); if (!r.ok) throw r.status; const b = await r.blob(), dim = fileSize(new Uint8Array(await b.slice(0, 65536).arrayBuffer()));
  let w = dim?.[0], h = dim?.[1];
  if (!w) { const bm = await createImageBitmap(b); w = bm.width; h = bm.height; bm.close(); }
  const k = Math.min(1, FIT() / w); if (k >= .95) return URL.createObjectURL(b);
  const bm = await createImageBitmap(b, { resizeWidth: Math.round(w * k), resizeHeight: Math.round(h * k), resizeQuality: "high" }), cv = new OffscreenCanvas(bm.width, bm.height);
  cv.getContext("2d").drawImage(bm, 0, 0); bm.close();
  return URL.createObjectURL(await cv.convertToBlob({ type: "image/jpeg", quality: 0.92 }));
}
const dropBlob = (o) => { if (o.dataset.blob) URL.revokeObjectURL(o.dataset.blob); };
let revealed = false;
function show(i, first, tries = 0, item) {
  const seq = ++showSeq, P = pool(), [src, title, artist, date, credit, metId] = item || P[i % P.length]; // seq: only the latest request may land, so a slow earlier image cannot replace a newer one
  const url = urlOf(src); if (!url) { if (mineReady && item) unpin(); return; } // a picture of yours that is not loaded yet (or was removed)
  const img = new Image();
  img.className = "paint";
  img.alt = "";
  img.style.setProperty("--dir", i % 2 ? 1 : -1);
  img.onload = () => {
    img.onload = null; // the full-size swap below must not run this again
    if (seq !== showSeq) return;
    const art = $("#art");
    art.querySelector("svg")?.remove();
    const old = [...art.querySelectorAll(".paint")];
    art.append(img);
    img.offsetWidth; img.classList.add("in"); if (!revealed) { revealed = true; img.classList.add("rev"); } // the first picture of a page eases out of a blur
    img.addEventListener("transitionend", () => img.classList.add("settled"), { once: true }); // once faded in, no layer hint is kept
    img.addEventListener("animationend", (e) => { if (e.animationName === "kb") img.classList.add("done"); }); // when the slow drift ends it stays where it stopped, as a still picture, not a running animation
    setTimeout(() => old.forEach((o) => { dropBlob(o); o.remove(); }), 2500);
    $("#capT").textContent = title;
    $("#capA").textContent = credit || `${artist}, ${date}`;
    artNow = { src, title, artist, date, credit, id: metId }; markSeen(src); if (!$("#story").hidden) storyOpen(); if (!$("#wpPop").hidden) wpMark();
    const hi = url.replace("/web-large/", "/original/"); // the Met's web-large copy is only ~600px wide: show it at once, then swap in the original (3000px+) when it has loaded
    if (hi !== src) { // some Met originals are huge: ask for the size first, and keep the 600px copy if it is over ~14 MB
      const plain = () => { const big = new Image(); big.onload = () => { if (img.isConnected) img.src = hi; }; big.src = hi; };
      const swap = () => fitBlob(hi).then((u) => { if (seq !== showSeq || !img.isConnected) return URL.revokeObjectURL(u); dropBlob(img); img.dataset.blob = u; img.src = u; }).catch(plain);
      fetch(hi, { method: "HEAD" }).then((r) => { if (+r.headers.get("content-length") < 14e6) swap(); }).catch(swap);
    }
  };
  img.onerror = () => { if (item) unpin(); if (tries < 3) show((wi = (wi + 1) % pool().length), first, tries + 1); else if (first) artFallback(); };
  img.src = url;
}
const drawArt = () => { const P = pool(); wi = drawFrom(P, Math.random, artNow?.src); keepArt(P[wi][0]); return wi; };
const applyArt = () => { unpin(); show(drawArt(), true); };
const next = () => { unpin(); show(drawArt()); };
pin ? show(0, true, 0, pin) : show(wi, true);
$("#refresh").onclick = (e) => {
  next();
  e.currentTarget.classList.remove("spin"); e.currentTarget.offsetWidth; e.currentTarget.classList.add("spin");
};

/* ---------- board: the task view. Columns are derived from each task (done / waiting / doing / to do), so nothing is stored twice ---------- */
const COLS = [["todo", "To do"], ["doing", "Doing"], ["waiting", "Waiting"], ["done", "Done"]];
const WHEN = [["all", "Any time"], ["today", "Today"], ["week", "Next 7 days"]];
const colOf = (t) => (t.done ? "done" : t.wait ? "waiting" : t.status === "doing" ? "doing" : "todo");
const cutoff = (k) => (k === "today" ? today() : plus(today(), 7));
const passWhen = (t) => t.done || ui.when === "all" || (t.due && t.due <= cutoff(ui.when));
const byOrd = (a, b) => (a.ord ?? 0) - (b.ord ?? 0) || a.p - b.p || (a.due || "9").localeCompare(b.due || "9");
const stamp = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ICON = {
  star: (on) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  pen: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
};
function card(t, ci) {
  if (ui.editing === t.id) {
    return `<li class="card editing"><form id="cardForm" class="cardform" data-id="${t.id}">
      <input id="ceTitle" type="text" value="${esc(t.title)}" maxlength="160" required aria-label="Title">
      <div class="ceRow"><select id="ceP" class="pill" aria-label="Priority">${[1, 2, 3].map((n) => `<option value="${n}" ${t.p === n ? "selected" : ""}>P${n}</option>`).join("")}</select>
        <select id="ceProj" class="pill" aria-label="Project">${projects.map((p) => `<option ${t.proj === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
      <label class="cl">Due<input id="ceDue" type="date" value="${t.due || ""}"></label>
      <label class="cl">Remind<input id="ceRem" type="datetime-local" value="${t.rem ? local(t.rem) : ""}"></label>
      <label class="cl">Waiting on<input id="ceWait" type="text" value="${esc(t.wait || "")}" maxlength="30" placeholder="Nobody"></label>
      <label class="cl">Tags<input id="ceTags" type="text" value="${esc(t.tags.join(" "))}" maxlength="60" placeholder="client work"></label>
      <div class="opts"><button type="button" class="pill" id="ceCancel">Cancel</button><button class="pill solid" type="submit">Save</button></div></form></li>`;
  }
  const k = colOf(t);
  return `<li class="card ${t.done ? "done" : ""}" draggable="true" data-cid="${t.id}">
    <div class="ch"><button class="check" data-done="${t.id}" aria-label="Toggle complete"></button><div class="ct">${esc(t.title)}</div></div>
    <div class="cm"><span><i class="p p${t.p}"></i>P${t.p}</span>${t.wait ? `<span class="wait">${esc(t.wait)}</span>` : ""}${t.focus && !t.done ? `<span class="wait">Pinned</span>` : ""}
      ${t.due && !t.done ? `<span>${t.wait ? "Follow up " : ""}${fmtDue(t.due)}</span>` : ""}${t.from && !t.wait && !t.done ? `<span>carried from ${fmtDue(t.from)}</span>` : ""}
      ${t.rem && !t.done ? `<span class="mono">${stamp(t.rem)}</span>` : ""}<span>${esc(t.proj)}</span>${t.tags.map((g) => `<span>#${esc(g)}</span>`).join("")}</div>
    <div class="acts">${ci > 0 ? `<button class="sn" data-cmove="${t.id}" data-dir="-1" aria-label="Move to ${COLS[ci - 1][1]}">‹</button>` : ""}${ci < 3 ? `<button class="sn" data-cmove="${t.id}" data-dir="1" aria-label="Move to ${COLS[ci + 1][1]}">›</button>` : ""}
      ${t.wait && !t.done ? `<button class="sn" data-snooze="${t.id}" title="Push follow-up 2 days">+2d</button>` : ""}
      ${t.done ? "" : `<button class="fx ${t.focus ? "on" : ""}" data-focus="${t.id}" aria-pressed="${!!t.focus}" aria-label="Pin to today's focus" title="Pin to focus (max 3)">${ICON.star(t.focus)}</button>`}
      <button class="fx" data-edit="${t.id}" aria-label="Edit task" title="Edit">${ICON.pen}</button><button class="x" data-del="${t.id}" aria-label="Delete task">×</button></div></li>`;
}
function renderBoard() {
  const base = tasks.filter((t) => (!ui.proj || t.proj === ui.proj) && (!ui.tag || t.tags.includes(ui.tag)));
  $("#views").innerHTML = WHEN.map(([k, name]) => `<button class="tab" data-w="${k}" aria-pressed="${ui.when === k}">${name}<span class="mono">${base.filter((t) => !t.done && (k === "all" || (t.due && t.due <= cutoff(k)))).length}</span></button>`).join("");
  $("#filters").innerHTML = [...new Set(open().flatMap((t) => t.tags))].map((g) => `<button class="chip ${ui.tag === g ? "on" : ""}" data-tag="${esc(g)}">#${esc(g)}</button>`).join("");
  $("#cols").innerHTML = COLS.map(([k, name], ci) => {
    let list = base.filter((t) => colOf(t) === k && passWhen(t)).sort(k === "done" ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : byOrd);
    const total = list.length; if (k === "done") list = list.slice(0, 8); // keep Done calm: the latest few
    return `<section class="col" data-col="${k}" aria-label="${name}"><header><h3>${name}</h3><span class="tools"><span class="mono">${total}</span>${k === "done" ? "" : `<button class="qa" data-qa="${k}" aria-label="Add to ${name}" title="Add to ${name}">+</button>`}</span></header><ul>`
      + (list.length ? list.map((t) => card(t, ci)).join("")
        : `<li class="cempty">${k === "todo" ? "Nothing queued. Press A to add." : k === "doing" ? "Drag a card here to start." : k === "waiting" ? "Nobody owes you anything." : "Finished tasks land here."}</li>`)
      + `</ul></section>`;
  }).join("");
  if (ui.editing) $("#ceTitle")?.focus();
}
function moveCard(id, col, at) { // at = [cardId, after?] places it next to that card; otherwise it goes to the end
  const t = tasks.find((x) => x.id === id); if (!t) return;
  if (colOf(t) !== col) {
    if (col === "waiting") {
      const who = (prompt("Waiting on whom?", t.wait || "") || "").trim(); if (!who) return;
      t.wait = who; t.done = false; t.doneAt = null; if (!t.due || t.due < today()) t.due = plus(today(), 2); // follow-up date
    } else {
      t.wait = null; t.done = col === "done"; t.doneAt = t.done ? Date.now() : null; t.status = col === "doing" ? "doing" : "todo";
    }
  } else if (!at) return;
  if (col !== "done") { // manual order: renumber the column, then slot the card in
    const L = tasks.filter((x) => x !== t && colOf(x) === col).sort(byOrd); L.forEach((x, i) => (x.ord = (i + 1) * 1000));
    const idx = at ? L.findIndex((x) => x.id === at[0]) + (at[1] ? 1 : 0) : L.length;
    t.ord = idx * 1000 + 500;
  }
  sync(t); save(); render();
}
let cardId = null;
const clearDrop = () => document.querySelectorAll(".over,.cbefore,.cafter").forEach((n) => n.classList.remove("over", "cbefore", "cafter"));
const below = (e, c) => { const r = c.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
document.addEventListener("dragstart", (e) => { const c = e.target.closest?.("[data-cid]"); if (!c) return; cardId = c.dataset.cid; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", cardId); c.classList.add("dragging"); });
document.addEventListener("dragover", (e) => {
  const col = cardId && e.target.closest?.("[data-col]"); if (!col) return;
  e.preventDefault(); clearDrop(); col.classList.add("over");
  const c = e.target.closest("[data-cid]"); if (c && c.dataset.cid !== cardId && col.dataset.col !== "done") c.classList.add(below(e, c) ? "cafter" : "cbefore");
});
document.addEventListener("drop", (e) => {
  const col = cardId && e.target.closest?.("[data-col]"); if (!col) return;
  e.preventDefault(); const c = e.target.closest("[data-cid]");
  moveCard(cardId, col.dataset.col, c && c.dataset.cid !== cardId && col.dataset.col !== "done" ? [c.dataset.cid, below(e, c)] : null);
});
document.addEventListener("dragend", () => { cardId = null; clearDrop(); document.querySelectorAll(".dragging").forEach((n) => n.classList.remove("dragging")); });
document.addEventListener("click", (e) => { // arrows on a card: a keyboard / touch friendly alternative to dragging
  const b = e.target.closest("[data-cmove]"); if (!b) return;
  const t = tasks.find((x) => x.id === b.dataset.cmove); if (t) moveCard(t.id, COLS[COLS.findIndex(([k]) => k === colOf(t)) + +b.dataset.dir][0]);
});
document.addEventListener("submit", (e) => { // inline edit of a card
  if (e.target.id !== "cardForm") return;
  e.preventDefault();
  const t = tasks.find((x) => x.id === e.target.dataset.id); if (!t) return;
  const r = $("#ceRem").value ? new Date($("#ceRem").value).getTime() : null;
  if (r && r <= Date.now() && r !== t.rem) { $("#ceRem").setCustomValidity("Pick a time a little later."); return $("#ceRem").reportValidity(); }
  t.title = $("#ceTitle").value.trim() || t.title; t.p = +$("#ceP").value; t.proj = $("#ceProj").value; t.rem = r;
  t.wait = $("#ceWait").value.trim() || null; t.due = $("#ceDue").value || (t.wait ? plus(today(), 2) : t.due);
  t.tags = [...new Set($("#ceTags").value.toLowerCase().split(/[\s,#]+/).filter(Boolean))];
  ui.editing = null; sync(t); save(); render();
});
document.addEventListener("input", (e) => e.target.id === "ceRem" && e.target.setCustomValidity(""));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.editing && e.target.closest?.("#cardForm")) { ui.editing = null; render(); } });
document.addEventListener("click", (e) => { if (e.target.id === "ceCancel") { ui.editing = null; render(); } });

/* ---------- tasks ---------- */
const ACT = /^(\s*(?:[-*]\s*)?)\[\s?\]\s*(.+)|^(\s*(?:[-*]\s*)?)(?:todo|action|ai):\s*(.+)/i; // an action line: "[ ] text", "todo: text"
const today = () => iso(new Date());
const plus = (d, n) => iso(new Date(new Date(d + "T00:00").getTime() + n * 864e5)); // YYYY-MM-DD + n days
const fmtDue = (d) => {
  const t = today(), tm = iso(new Date(Date.now() + 864e5));
  return d === t ? "Today" : d === tm ? "Tomorrow" : new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const open = () => tasks.filter((t) => !t.done);
function sync(t) { // reminders live in chrome.alarms; background.js fires the notification
  if (!globalThis.chrome?.alarms) return;
  chrome.alarms.clear("t:" + t.id);
  if (!t.done && t.rem && t.rem > Date.now()) chrome.alarms.create("t:" + t.id, { when: t.rem });
}

function render() {
  $("#projects").innerHTML = projects.map((p) => ui.renaming === p
    ? `<li class="ren"><form id="renForm"><input id="pren" value="${esc(p)}" maxlength="24" aria-label="Rename project"></form></li>`
    : `<li class="${ui.proj === p ? "on" : ""}"><button data-proj="${esc(p)}">${esc(p)}<span class="mono">${open().filter((t) => t.proj === p).length}</span></button>
        <button class="lx" data-prename="${esc(p)}" aria-label="Rename ${esc(p)}" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="lx" data-pdel="${esc(p)}" aria-label="Delete ${esc(p)}" title="Delete">×</button></li>`).join("");
  if (ui.renaming) { const i = $("#pren"); i.focus(); i.select(); }
  $("#proj").innerHTML = projects.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#proj").value = projects.includes(ui.addProj) ? ui.addProj : projects[0];
  renderLinks();

  const fl = open().filter((t) => t.focus || t.focusFor === today());
  $("#focus").innerHTML = fl.length ? fl.map((t) => `<li><button class="check" data-done="${t.id}" aria-label="Complete"></button><span>${esc(t.title)}</span>${t.wait ? `<small>${esc(t.wait)}</small>` : t.focusFor === today() && !t.focus ? `<small>your one thing</small>` : ""}</li>`).join("")
    : `<li class="fe">Star up to three tasks and they will live here.</li>`;
  renderBoard(); renderWind(); renderNudge(); renderNoteList(); reconcilePaint(); renderPaint();
  $("#sOpen").textContent = open().length;
  $("#sDue").textContent = open().filter((t) => t.due === today() && !t.wait).length;
  $("#sLate").textContent = open().filter((t) => t.from && !t.wait).length;
  if (!$("#mtgv").hidden) mtRender();
  renderIntent();
}

/* "Ship it #client !1" -> title, tags, priority */
function parse(raw, p) {
  const tags = [...raw.matchAll(/#([\w-]+)/g)].map((m) => m[1].toLowerCase());
  const pm = raw.match(/!([123])\b/), wm = raw.match(/@([\w.-]+)/); // @Priya_Nair -> "Priya Nair"
  const em = raw.match(/~(\d+(?:\.\d+)?)\s?(hr|h|min|m)?(?![\w])/i); // "~30m", "~1.5h", "~45": how long it takes
  return { title: raw.replace(/#[\w-]+|@[\w.-]+|!([123])\b|~\d+(?:\.\d+)?\s?(?:hr|h|min|m)?(?![\w])/gi, "").replace(/\s+/g, " ").trim(), p: pm ? +pm[1] : p, tags, wait: wm ? wm[1].replace(/_/g, " ") : null, est: em ? Math.max(5, Math.round(+em[1] * (/^h/i.test(em[2] || "") ? 60 : 1))) : null };
}

/* ---------- notes: every note saves as you write. The first words create it; there is no Save step. ---------- */
/* notes = a legacy unsaved draft (cur === null); a saved note is edited in place. The page stores markdown, the editor shows it live. */
let notes = "", cur = null, timer, nq = "";
const ta = $("#notes");
const status = (s) => ($("#saved").textContent = s);
const curNote = () => saved.find((n) => n.id === cur);
const titleOf = (v) => (v.split("\n").map((l) => l.replace(/^[#\s>*+-]+|^\d+[.)]\s+|^\[[ xX]\]\s*/g, "").trim()).find(Boolean) || "Untitled note").slice(0, 48);
const snippet = (v) => (v.split("\n").map((l) => l.replace(/^[#\s>*+-]+|^\d+[.)]\s+|^\[[ xX]\]\s*|[*_`]/g, "").trim()).filter(Boolean)[1] || "").slice(0, 70);
function when(ts) {
  const d = new Date(ts), t = new Date(), days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return days === 0 ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : days === 1 ? "Yesterday" : days < 7 ? d.toLocaleDateString([], { weekday: "short" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function dropEmpty() { const n = curNote(); if (n && !n.body.trim()) { saved = saved.filter((x) => x !== n); store.set({ saved }); } } // a note you opened and left blank is not kept
function showNote() {
  ta.value = curNote()?.body ?? notes;
  status("Saved");
  $("#nCount").textContent = saved.length;
  renderNoteList();
}
function renderNoteList() { // every note is listed, newest edit first; filtering by project is opt-in, never the default
  const only = ui.proj && ui.notesOnly, q = nq.trim().toLowerCase();
  const rows = saved.filter((n) => (!only || n.proj === ui.proj) && (!q || (n.title + "\n" + n.body).toLowerCase().includes(q))).sort((x, y) => y.ts - x.ts);
  $("#nCount2").textContent = saved.length || "";
  $("#nOnly").hidden = !ui.proj; $("#nOnly").textContent = ui.notesOnly ? "Show all" : `Only ${ui.proj}`; $("#nOnly").setAttribute("aria-pressed", !!ui.notesOnly);
  const fresh = !cur && !q ? `<li><button class="ni on" data-nid=""><b class="nt">${notes.trim() ? esc(titleOf(notes)) : "New note"}</b><span class="nsn"><i>Now</i>${notes.trim() ? "unsaved draft" : "start writing…"}</span></button></li>` : "";
  $("#nitems").innerHTML = fresh
    + (rows.length ? rows.map((n) => `<li><button class="ni ${n.id === cur ? "on" : ""}" data-nid="${n.id}"><b class="nt">${esc(n.title)}</b><span class="nsn"><i>${when(n.ts)}</i>${esc(snippet(n.body) || n.proj || "No other text")}</span></button><button class="lx" data-ndel="${n.id}" aria-label="Delete note" title="Delete">×</button></li>`).join("")
      : q ? `<li class="fe">No notes match “${esc(nq.trim())}”.</li>` : only ? `<li class="fe">No notes in ${esc(ui.proj)}.</li>` : "");
}
$("#nOnly").onclick = () => { ui.notesOnly = !ui.notesOnly; renderNoteList(); };
$("#nSearch").oninput = (e) => { nq = e.target.value; renderNoteList(); };
$("#nSearch").onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { e.target.value = nq = ""; renderNoteList(); } };
$("#nSavedBtn").onclick = () => { const on = $("#nlist").hidden; $("#nlist").hidden = !on; $("#nSavedBtn").setAttribute("aria-expanded", on); };
$("#nlist").onclick = (e) => {
  const d = e.target.closest("[data-ndel]"), o = e.target.closest("[data-nid]");
  if (d) {
    const n = saved.find((x) => x.id === d.dataset.ndel);
    const i = saved.indexOf(n), was = cur === n.id;
    saved = saved.filter((x) => x !== n); if (was) cur = null;
    store.set({ saved }); showNote();
    toTrash("note", n);
    undoable(`Deleted “${n.title.slice(0, 32)}”`, () => { saved.splice(Math.min(i, saved.length), 0, n); if (was) cur = n.id; trash = trash.filter((x) => x.item !== n); });
  } else if (o && (o.dataset.nid || null) !== cur) { const nid = o.dataset.nid || null; dropEmpty(); cur = nid; showNote(); ta.focus(); }
};
$("#nNew").onclick = () => { if (cur && !curNote()?.body.trim()) return ta.focus(); dropEmpty(); cur = null; showNote(); ta.focus(); }; // always lands on a blank page
ta.oninput = () => {
  const v = ta.value; status("Saving…");
  let n = curNote();
  if (!n && v.trim()) { n = { id: crypto.randomUUID(), title: titleOf(v), body: v, proj: ui.proj, ts: Date.now() }; saved.unshift(n); cur = n.id; notes = ""; } // the first words make it a note
  else if (n) { n.body = v; n.title = titleOf(v); n.ts = Date.now(); } else notes = v;
  clearTimeout(timer); timer = setTimeout(() => { store.set({ saved, notes }); status("Saved"); $("#nCount").textContent = saved.length; renderNoteList(); }, 400);
};

/* ---------- markdown: small renderer (headings, emphasis, lists, task lists, quotes, code, links) ---------- */
function inline(s) {
  const codes = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?![_\w])/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/(^|\s)([#@][\w-]+)/g, '$1<span class="mdtag">$2</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${codes[n]}</code>`);
}
const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
function mdList(items) { // items: [sourceLine, text]; indent decides nesting
  let html = "", st = [];
  for (const [ln, line] of items) {
    const [, sp, mk, txt] = line.match(LIST), ind = sp.replace(/\t/g, "  ").length;
    while (st.length && ind < st.at(-1).ind) html += `</li></${st.pop().tag}>`;
    if (st.length && ind === st.at(-1).ind) html += "</li>";
    else if (!st.length || ind > st.at(-1).ind) { const tag = /\d/.test(mk) ? "ol" : "ul"; st.push({ ind, tag }); html += `<${tag}>`; }
    const t = txt.match(/^\[( |x|X)\]\s+(.*)$/);
    html += t ? `<li class="mdtask${t[1] === " " ? "" : " mddone"}"><input type="checkbox" data-ln="${ln}" ${t[1] === " " ? "" : "checked"}> ${inline(t[2])}` : `<li>${inline(txt)}`;
  }
  while (st.length) html += `</li></${st.pop().tag}>`;
  return html;
}
function md(src) {
  const L = src.split("\n"), out = [], para = []; let i = 0, m;
  const flush = () => { if (para.length) out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para.length = 0; };
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { flush(); const code = []; i++; while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]); i++; out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`); }
    else if (!l.trim()) { flush(); i++; }
    else if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; }
    else if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { flush(); out.push("<hr>"); i++; }
    else if (/^>/.test(l)) { flush(); const q = []; while (i < L.length && /^>/.test(L[i])) q.push(L[i++].replace(/^>\s?/, "")); out.push(`<blockquote>${q.map(inline).join("<br>")}</blockquote>`); }
    else if (LIST.test(l)) { flush(); const it = []; while (i < L.length && LIST.test(L[i])) it.push([i, L[i++]]); out.push(mdList(it)); }
    else { para.push(l); i++; }
  }
  flush(); return out.join("");
}
const renderPreview = () => ($("#preview").innerHTML = md($("#notes").value) || '<p class="muted">Nothing to preview yet.</p>');
$("#preview").onclick = (e) => { // ticking a checkbox in the preview rewrites that line in the note
  const b = e.target.closest("input[data-ln]"); if (!b) return;
  const L = $("#notes").value.split("\n"); L[b.dataset.ln] = L[b.dataset.ln].replace(/\[( |x|X)\]/, (_, c) => (c === " " ? "[x]" : "[ ]"));
  $("#notes").value = L.join("\n"); $("#notes").oninput();
};

/* ---------- the page: a live editor. One <div data-t="..."> per markdown line, so headings, lists and checklists show as you type ---------- */
const ned = $("#ned"), nativeVal = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
let syncing = false;
const BLOCK = /^(li|ol|todo|quote)$/;
const mkLine = (t = "p", html = "", o = {}) => { const d = document.createElement("div"); d.dataset.t = t; if (o.d) d.dataset.d = "1"; if (o.i) d.dataset.i = o.i; d.innerHTML = html || "<br>"; return d; };
function mdToLines(src) {
  const out = []; let code = false;
  for (const l of src.split("\n")) {
    let m;
    if (/^```/.test(l)) { code = !code; continue; }
    if (code) out.push(mkLine("code", esc(l)));
    else if ((m = l.match(/^(#{1,6})\s+(.*)$/))) out.push(mkLine("h" + Math.min(3, m[1].length), inline(m[2])));
    else if ((m = l.match(/^(\s*)(?:[-*+]\s+)?\[( |x|X)\]\s+(.*)$/))) out.push(mkLine("todo", inline(m[3]), { d: m[2] !== " ", i: Math.min(3, m[1].replace(/\t/g, "  ").length >> 1) }));
    else if ((m = l.match(/^(\s*)[-*+]\s+(.*)$/))) out.push(mkLine("li", inline(m[2]), { i: Math.min(3, m[1].replace(/\t/g, "  ").length >> 1) }));
    else if ((m = l.match(/^(\s*)\d+[.)]\s+(.*)$/))) out.push(mkLine("ol", inline(m[2]), { i: Math.min(3, m[1].replace(/\t/g, "  ").length >> 1) }));
    else if ((m = l.match(/^>\s?(.*)$/))) out.push(mkLine("quote", inline(m[1])));
    else out.push(mkLine("p", l.trim() ? inline(l) : ""));
  }
  return out.length ? out : [mkLine()];
}
function inlineMd(node) {
  let s = "";
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { s += c.nodeValue; continue; }
    if (c.nodeName === "BR") continue;
    const x = inlineMd(c), t = c.nodeName; if (!x) continue;
    s += t === "B" || t === "STRONG" ? `**${x}**` : t === "I" || t === "EM" ? `*${x}*` : t === "CODE" ? `\`${x}\`` : t === "A" ? `[${x}](${c.getAttribute("href")})` : t === "S" || t === "DEL" || t === "STRIKE" ? `~~${x}~~` : x;
  }
  return s;
}
function getDoc() {
  const out = []; let code = false; const n = [0, 0, 0, 0];
  for (const l of ned.children) {
    const t = l.dataset.t || "p", i = +l.dataset.i || 0, pad = "  ".repeat(i), txt = inlineMd(l).replace(/ /g, " ");
    if (t === "code") { if (!code) out.push("```"); code = true; out.push(l.textContent.replace(/ /g, " ")); continue; }
    if (code) { out.push("```"); code = false; }
    if (t === "ol") { n[i]++; for (let k = i + 1; k < 4; k++) n[k] = 0; } else if (t !== "li" && t !== "todo") n.fill(0);
    out.push(t === "h1" ? "# " + txt : t === "h2" ? "## " + txt : t === "h3" ? "### " + txt : t === "li" ? `${pad}- ${txt}` : t === "ol" ? `${pad}${n[i]}. ${txt}` : t === "todo" ? `${pad}- [${l.dataset.d ? "x" : " "}] ${txt}` : t === "quote" ? "> " + txt : txt);
  }
  if (code) out.push("```");
  while (out.length && !out.at(-1).trim()) out.pop();
  return out.join("\n");
}
function renumber() { const n = [0, 0, 0, 0]; for (const l of ned.children) { const t = l.dataset.t, i = +l.dataset.i || 0; if (t === "ol") { n[i]++; for (let k = i + 1; k < 4; k++) n[k] = 0; l.dataset.n = n[i]; } else if (t !== "li" && t !== "todo") n.fill(0); } }
function loadDoc(v) {
  if (ned.dataset.v === v && document.activeElement === ned) return; // an echo of what you are typing
  ned.dataset.v = v; ned.replaceChildren(...mdToLines(v)); renumber();
}
Object.defineProperty(ta, "value", { get() { return nativeVal.get.call(this); }, set(v) { nativeVal.set.call(this, v); if (!syncing) loadDoc(v); } });
ta.focus = (o) => { ned.focus(o); const r = document.createRange(); r.selectNodeContents(ned.lastElementChild); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
ta.blur = () => ned.blur();
function sync() { renumber(); const v = getDoc(); ned.dataset.v = v; syncing = true; nativeVal.set.call(ta, v); syncing = false; ta.oninput(); }
const lineOf = (n) => { while (n && n.parentNode !== ned) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
const curLine = () => { const s = getSelection(); return s.rangeCount ? lineOf(s.anchorNode) : null; };
const selLines = () => { const s = getSelection(); if (!s.rangeCount) return []; const a = lineOf(s.anchorNode), b = lineOf(s.focusNode); if (!a || !b) return []; const L = [...ned.children]; let i = L.indexOf(a), k = L.indexOf(b); if (i > k) [i, k] = [k, i]; return L.slice(i, k + 1); };
function caretTo(el, end = false) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(!end); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
const setT = (l, t) => { l.dataset.t = t; if (t !== "todo") delete l.dataset.d; if (!BLOCK.test(t) || t === "quote") delete l.dataset.i; };
function atStart(l) { const s = getSelection(); if (!s.isCollapsed) return false; const r = document.createRange(); r.selectNodeContents(l); r.setEnd(s.anchorNode, s.anchorOffset); return !r.toString().length; }
function normalise() { // keep the editor a plain stack of lines
  for (const c of [...ned.childNodes]) if (c.nodeType === 3 || c.nodeName === "BR" || c.nodeName !== "DIV") { const d = mkLine("p"); if (c.nodeType === 3) d.textContent = c.nodeValue; ned.replaceChild(d, c); }
  if (!ned.children.length) { const d = mkLine(); ned.append(d); caretTo(d); }
  for (const l of ned.children) { if (!l.dataset.t) l.dataset.t = "p"; }
}
const SHORT = [[/^(#{1,3}) $/, (m) => ["h" + m[1].length]], [/^[-*] $/, () => ["li"]], [/^\d+[.)] $/, () => ["ol"]], [/^\[( |x|X)?\] $/, (m) => ["todo", m[1] === "x" || m[1] === "X"]], [/^> $/, () => ["quote"]]];
ned.addEventListener("input", (e) => {
  normalise();
  const l = curLine();
  if (l && l.dataset.t === "p" && e.inputType === "insertText" && e.data === " ") { // markdown shortcuts: "# ", "- ", "1. ", "[] ", "> "
    const txt = l.textContent.replace(/ /g, " ");
    for (const [re, f] of SHORT) { const m = txt.match(re); if (m) { const [t, d] = f(m); setT(l, t); if (d) l.dataset.d = "1"; l.innerHTML = "<br>"; caretTo(l); break; } }
  }
  sync();
});
ned.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey, l = curLine(); let handled = true;
  if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopPropagation(); return FORMAT.link(); }
  if (mod) return; // bold, italic, undo, select all: the browser's own
  if (!l) return;
  const t = l.dataset.t, empty = !l.textContent.trim();
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (t === "p" && l.textContent.trim() === "```") { setT(l, "code"); l.innerHTML = "<br>"; caretTo(l); }
    else if (t === "code") { if (empty) { setT(l, "p"); caretTo(l); } else { const n = mkLine("code"); l.after(n); caretTo(n); } }
    else if (empty && BLOCK.test(t)) { setT(l, "p"); caretTo(l); } // an empty bullet ends the list
    else if (atStart(l) && !empty) { const n = mkLine(t.startsWith("h") ? "p" : t, "", { i: +l.dataset.i }); l.before(n); }
    else {
      document.execCommand("insertParagraph"); const n = curLine();
      if (n && n !== l) { if (/^h/.test(t)) setT(n, "p"); else { setT(n, t); if (t === "todo") delete n.dataset.d; } }
    }
  } else if (e.key === "Backspace" && atStart(l) && t !== "p") { e.preventDefault(); if (+l.dataset.i > 0) l.dataset.i = +l.dataset.i - 1; else setT(l, "p"); }
  else if (e.key === "Tab" && /^(li|ol|todo)$/.test(t)) { e.preventDefault(); const i = (+l.dataset.i || 0) + (e.shiftKey ? -1 : 1); if (i >= 0 && i <= 3) l.dataset.i = i; }
  else if (e.key === "Tab") { e.preventDefault(); if (!e.shiftKey) document.execCommand("insertText", false, "  "); }
  else handled = false;
  if (handled) sync();
  if (e.key !== "Escape") e.stopPropagation(); // single-letter page shortcuts (N, F, A…) must not fire while you write
});
ned.addEventListener("paste", (e) => {
  e.preventDefault();
  const txt = (e.clipboardData.getData("text/plain") || "").replace(/\r/g, ""); if (!txt) return;
  const l = curLine();
  if (!/\n/.test(txt) || !l) return void document.execCommand("insertText", false, txt);
  const ls = mdToLines(txt); (l.textContent.trim() ? l.after(...ls) : l.replaceWith(...ls)); caretTo(ls.at(-1), true); sync();
});
ned.addEventListener("click", (e) => {
  const l = e.target.closest("#ned > div"), a = e.target.closest("a");
  if (a && (e.ctrlKey || e.metaKey)) return void window.open(a.href, "_blank", "noopener");
  if (l && l.dataset.t === "todo" && e.target === l && e.offsetX < 32 + (+l.dataset.i || 0) * 22) { if (l.dataset.d) delete l.dataset.d; else l.dataset.d = "1"; sync(); }
});
const FORMAT = {
  bold: () => document.execCommand("bold"),
  italic: () => document.execCommand("italic"),
  code: () => { const s = getSelection().toString(); document.execCommand("insertHTML", false, `<code>${esc(s || "code")}</code>&#8203;`); sync(); },
  link: () => { const s = getSelection().toString(); const u = prompt("Link address", "https://"); if (u && /^https?:\/\//i.test(u)) { document.execCommand("insertHTML", false, `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s || u)}</a>`); sync(); } },
  h: () => { const L = selLines(); const n = L.every((l) => l.dataset.t === "h1") ? "h2" : L.every((l) => l.dataset.t === "h2") ? "h3" : L.every((l) => l.dataset.t === "h3") ? "p" : "h1"; L.forEach((l) => setT(l, n)); sync(); },
};
for (const [k, t] of [["ul", "li"], ["ol", "ol"], ["task", "todo"], ["quote", "quote"]]) FORMAT[k] = () => { const L = selLines(), all = L.every((l) => l.dataset.t === t); L.forEach((l) => setT(l, all ? "p" : t)); sync(); };
document.querySelector(".tb").onmousedown = (e) => e.preventDefault(); // keep the selection in the page
document.querySelector(".tb").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; ned.focus(); FORMAT[b.dataset.f](); };

/* ---------- view modes + full screen ---------- */
let full = false;
function toggleFull(on = !full) {
  full = on; $("#notesPanel").classList.toggle("full", on); $("#nFull").setAttribute("aria-pressed", on);
  $("#nFull").title = on ? "Exit full screen (Esc)" : "Full screen";
  if (on) ta.focus();
}
$("#nFull").onclick = () => toggleFull();
$("#mtg").onclick = () => openMtg();
$("#copy").onclick = () => navigator.clipboard.writeText(ta.value).then(() => status("Copied"), () => status("Copy blocked"));
$("#extract").onclick = () => {
  const re = ACT;
  let n = 0;
  $("#notes").value = $("#notes").value.split("\n").map((line) => {
    const m = line.match(re); if (!m) return line;
    const { title, p, tags, wait } = parse(m[2] || m[4], 2);
    if (!title) return line;
    tasks.push({ id: crypto.randomUUID(), title, p, proj: projects[0], tags, wait, due: wait ? plus(today(), 2) : today(), rem: null, done: false });
    n++; return `${m[1] ?? m[3]}[x] ${m[2] || m[4]}`; // mark as extracted so a second click can't duplicate
  }).join("\n");
  if (n) { save(); $("#notes").oninput(); render(); }
  status(n ? `${n} task${n > 1 ? "s" : ""} added to Today` : "No [ ] or todo: lines found");
};
/* notes live in their own floating panel, independent of the task list */
function toggleNotes(on = $("#notesPanel").hidden, quiet = false) { // quiet: opening on page load, so no scrolling or stealing focus
  $("#notesPanel").hidden = !on; $("#notesBtn").setAttribute("aria-expanded", on);
  try { localStorage["dayboard:notes-open"] = on ? "1" : "0"; } catch {}
  if (on) { if (!quiet) { $("#notesPanel").scrollIntoView({ behavior: "smooth", block: "start" }); $("#notes").focus({ preventScroll: true }); } }
  else { toggleFull(false); $("#notes").blur(); }
}
$("#notesBtn").onclick = () => toggleNotes();
$("#notesX").onclick = () => toggleNotes(false);
try { if (localStorage["dayboard:notes-open"] !== "0") toggleNotes(true, true); } catch { toggleNotes(true, true); } // open unless you closed it
addEventListener("keydown", (e) => {
  if ((e.key === "n" || e.key === "s") && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow()) { e.preventDefault(); toggleNotes(e.key === "n" ? true : undefined); } // N opens and focuses notes, S toggles them
  if (e.key === "Escape" && !$("#notesPanel").hidden) { // Esc leaves full screen, or just steps out of the editor; closing is the Notes button or the ×
    if (full) toggleFull(false); else if (document.activeElement.closest?.("#notesPanel")) document.activeElement.blur();
  }
});

const PH = $("#title").placeholder;
$("#title").onblur = () => { if (!$("#title").value) { ui.addCol = null; $("#title").placeholder = PH; } };
$("#add").onsubmit = (e) => {
  e.preventDefault();
  const { title, p, tags: tg, wait, est } = parse($("#title").value, ui.pri);
  const rem = ui.rem, err = $("#err"), col = ui.addCol;
  if (!title) { err.textContent = "Give the task a name."; err.hidden = false; return; }
  if (rem && rem <= Date.now()) { err.textContent = "Pick a time a little later."; err.hidden = false; return; }
  let who = wait;
  if (col === "waiting" && !who) { who = (prompt("Waiting on whom?") || "").trim(); if (!who) return; }
  err.hidden = true;
  const t = { id: crypto.randomUUID(), title, p, proj: $("#proj").value, tags: tg, wait: who, due: ui.due || (who ? plus(today(), 2) : today()), rem, done: false, status: col === "doing" ? "doing" : "todo", ord: Date.now(), est };
  tasks.push(t); sync(t); save();
  e.target.reset(); ui.addProj = t.proj; ui.due = ui.rem = null; ui.addCol = null; $("#title").placeholder = PH; whenUI();
  if (!passWhen(t)) ui.when = "all"; // never hide what you just added
  render();
};
/* due / reminder: presets plus a native picker behind "Pick" */
const at = (days, h) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d.getTime(); };
const REM = { h1: () => Date.now() + 36e5, h3: () => Date.now() + 108e5, t9: () => at(1, 9) };
const local = (ms) => iso(new Date(ms)) + "T" + new Date(ms).toTimeString().slice(0, 5);
function whenUI() {
  const dd = ui.due, preset = [0, 1, 7].map((n) => iso(new Date(Date.now() + n * 864e5)));
  document.querySelectorAll("[data-due]").forEach((b) => b.classList.toggle("on", dd === preset[[0, 1, 7].indexOf(+b.dataset.due)]));
  $("#dueP").classList.toggle("on", !!dd && !preset.includes(dd));
  $("#dueP").textContent = dd && !preset.includes(dd) ? fmtDue(dd) : "Pick date";
  const known = Object.entries(REM).find(([, f]) => ui.rem && Math.abs(f() - ui.rem) < 6e4);
  document.querySelectorAll("[data-rem]").forEach((b) => b.classList.toggle("on", known?.[0] === b.dataset.rem));
  $("#remP").classList.toggle("on", !!ui.rem && !known);
  $("#remP").textContent = ui.rem && !known ? new Date(ui.rem).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Pick time";
}
$("#dueRow").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "dueP") return $("#due").showPicker();
  const v = iso(new Date(Date.now() + b.dataset.due * 864e5));
  ui.due = ui.due === v ? null : v; whenUI();
};
$("#remRow").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "remP") { $("#rem").value = local(ui.rem || Date.now() + 36e5); return $("#rem").showPicker(); }
  const v = REM[b.dataset.rem](); ui.rem = ui.rem && Math.abs(ui.rem - v) < 6e4 ? null : v; whenUI();
};
$("#due").onchange = (e) => { ui.due = e.target.value || null; whenUI(); };
$("#rem").onchange = (e) => { ui.rem = e.target.value ? new Date(e.target.value).getTime() : null; whenUI(); };
whenUI();
/* evening wind-down: after 18:00 the page warms up and counts what you did, not what is left */
function renderWind() {
  const h = new Date().getHours(), eve = h >= 18 || h < 5;
  document.body.classList.toggle("evening", eve);
  let dismissed = false; try { dismissed = localStorage["dayboard:wind"] === today(); } catch {}
  $("#wind").hidden = !eve || dismissed;
  if ($("#wind").hidden) return;
  const done = tasks.filter((t) => t.doneAt && iso(new Date(t.doneAt)) === today()).length;
  const left = open().filter((t) => t.due && t.due <= today() && !t.wait).length;
  $("#windMsg").textContent = done ? `You finished ${done} thing${done > 1 ? "s" : ""} today.` : "A quiet day is still a day.";
  $("#windSub").textContent = left ? `${left} will wait for tomorrow. That is okay.` : "Nothing is waiting on you. Rest well.";
}
$("#windNotes").onclick = () => toggleNotes(true);
$("#windX").onclick = () => { try { localStorage["dayboard:wind"] = today(); } catch {} renderWind(); };
setInterval(live(renderWind), 6e4);
$("#proj").onchange = (e) => (ui.addProj = e.target.value);
$("#pri").onclick = () => { ui.pri = (ui.pri % 3) + 1; $("#pri").textContent = "P" + ui.pri; };

document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-w],[data-edit],[data-qa],[data-done],[data-del],[data-snooze],[data-focus],[data-proj],[data-tag]")?.dataset;
  if (!d) return;
  if (d.w) ui.when = d.w;
  if (d.edit) ui.editing = d.edit;
  if (d.qa) { ui.addCol = d.qa; const el = $("#title"); el.placeholder = `Add to ${COLS.find(([k]) => k === d.qa)[1]}…`; el.focus(); return; }
  if (d.proj) { ui.proj = ui.proj === d.proj ? null : d.proj; if (ui.proj) ui.addProj = ui.proj; save(); }
  if (d.tag) ui.tag = ui.tag === d.tag ? null : d.tag;
  const t = tasks.find((x) => x.id === (d.done || d.del || d.snooze || d.focus));
  if (!t && (d.done || d.del || d.snooze || d.focus)) return;
  if (d.done) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; sync(t); save(); }
  if (d.snooze) { t.due = plus(t.due && t.due > today() ? t.due : today(), 2); save(); }
  if (d.focus) {
    if (!t.focus && open().filter((x) => x.focus).length >= 3) flash("Three is plenty for one day. Unpin one to make room.");
    else { t.focus = !t.focus; save(); }
  }
  if (d.del) {
    const i = tasks.indexOf(t); tasks = tasks.filter((x) => x !== t); sync({ ...t, done: true }); save();
    toTrash("task", t);
    undoable(`Deleted “${t.title.slice(0, 32)}”`, () => { tasks.splice(Math.min(i, tasks.length), 0, t); sync(t); trash = trash.filter((x) => x.item !== t); });
  }
  render();
});

let ft;
function flash(m) { $("#fmsg").textContent = m; clearTimeout(ft); ft = setTimeout(() => ($("#fmsg").textContent = ""), 2800); }

/* projects: add, rename (tasks and shortcuts follow), delete (they move to the first remaining project) */
const perr = (m) => { $("#perr").textContent = m; $("#perr").hidden = !m; };
$("#addProj").onsubmit = (e) => {
  e.preventDefault();
  const n = $("#pname").value.trim();
  if (!n) return;
  if (projects.includes(n)) return perr(`"${n}" already exists.`);
  perr(""); projects.push(n); save(); render(); $("#pname").value = "";
};
function renameProject(from, to) {
  to = to.trim(); ui.renaming = null;
  if (to && to !== from) {
    if (projects.includes(to)) perr(`"${to}" already exists.`);
    else {
      perr(""); projects[projects.indexOf(from)] = to;
      [...tasks, ...links, ...saved].forEach((x) => x.proj === from && (x.proj = to));
      if (ui.proj === from) ui.proj = to;
      if (ui.addProj === from) ui.addProj = to;
      save();
    }
  }
  render();
}
function deleteProject(p) {
  const nt = tasks.filter((t) => t.proj === p).length, nl = links.filter((l) => l.proj === p).length;
  const rest = projects.filter((x) => x !== p), fb = rest[0] || "Inbox";
  if (!confirm(`Delete "${p}"?` + (nt + nl ? ` Its ${nt} task${nt === 1 ? "" : "s"} and ${nl} shortcut${nl === 1 ? "" : "s"} will move to "${fb}".` : ""))) return;
  const idx = projects.indexOf(p), moved = [...tasks, ...links, ...saved].filter((x) => x.proj === p), wasActive = ui.proj === p, wasAdd = ui.addProj === p, made = !rest.length;
  perr(""); projects = rest.length ? rest : [fb];
  moved.forEach((x) => (x.proj = fb));
  if (wasActive) ui.proj = null;
  if (wasAdd) ui.addProj = fb;
  save(); render();
  undoable(`Deleted project “${p}”`, () => {
    if (made) projects = projects.filter((x) => x !== fb);
    projects.splice(Math.min(idx, projects.length), 0, p); moved.forEach((x) => (x.proj = p));
    if (wasActive) ui.proj = p; if (wasAdd) ui.addProj = p;
  });
}
document.addEventListener("click", (e) => {
  const r = e.target.closest("[data-prename]"), d = e.target.closest("[data-pdel]");
  if (r) { ui.renaming = r.dataset.prename; render(); }
  if (d) deleteProject(d.dataset.pdel);
});
document.addEventListener("submit", (e) => { if (e.target.id === "renForm") { e.preventDefault(); renameProject(ui.renaming, $("#pren").value); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.renaming && e.target.id === "pren") { ui.renaming = null; render(); } });
document.addEventListener("focusout", (e) => { if (e.target.id === "pren" && ui.renaming) { ui.renaming = null; setTimeout(render); } }); // click-away cancels

store.get().then((s) => { tasks = s.tasks || []; projects = s.projects || projects;
  paint = s.paint || {}; trash = s.trash || []; snaps = s.snaps || {}; archive = s.archive || []; inbox = s.inbox || []; bellDraw();
  prefs = { ...prefs, ...(s.prefs || {}) };
  if (!prefs.firstSeen) { prefs.firstSeen = Date.now(); s.dirty = true; }
  const t0 = today(); // nothing goes "overdue": unfinished tasks quietly move to today and remember where they came from
  tasks.forEach((t) => { if (!t.done && !t.wait && t.due && t.due < t0) { t.from = t.from || t.due; t.due = t0; s.dirty = true; } });
  const old = tasks.filter((t) => t.done && t.doneAt && t.doneAt < Date.now() - 30 * 864e5); // finished more than 30 days ago: tuck away, never delete
  if (old.length) { archive = [...old, ...archive].slice(0, 3000); tasks = tasks.filter((t) => !old.includes(t)); s.dirty = true; inboxAdd("tidy", `Tucked away ${old.length} finished task${old.length > 1 ? "s" : ""}`, "Done for over 30 days. Find them under Recover in Preferences."); }
  if (s.links) links = s.links;
  else { // first run: seed shortcuts and projects
    
    links = SEED.map(([name, url, proj]) => ({ id: crypto.randomUUID(), name, url, proj: proj === "@dock" ? null : proj, dock: proj === "@dock" }));
  }
  ui.proj = projects.includes(s.active) ? s.active : null; ui.addProj = ui.proj; ui.sview = s.sview === "grid" ? "grid" : "list";
  if (s.links && !s.dockSeeded && !links.some((l) => l.dock)) { // existing install: add the general shortcuts once
    SEED.filter((x) => x[2] === "@dock").forEach(([name, url]) => links.push({ id: crypto.randomUUID(), name, url, proj: null, dock: true }));
    store.set({ dockSeeded: true }); s.links = null;
  }
  if (!s.links || s.dirty) save(); notes = s.notes || ""; saved = s.saved || []; if (notes.trim()) { saved.unshift({ id: crypto.randomUUID(), title: titleOf(notes), body: notes, proj: null, ts: Date.now() }); notes = ""; store.set({ saved, notes }); } cur = [...saved].sort((x, y) => y.ts - x.ts)[0]?.id ?? null; mtg = s.meeting || null; hook = s.hook || null; ol = HAS_OL ? s.ol || null : null; olUI(); mtBoot(); hookUI(); mtBtn(); showNote(); render(); syncPrefsUI(); tick(); if (prefs.art !== "both" && !pin) applyArt(); takeSnap(); wxStart(); });

/* ---------- calm mode (Z) and idle fade: the interface steps back, the painting stays ---------- */
const body = document.body;
let idleT, lastWake = 0;
const isCalm = () => body.classList.contains("calm");
const busy = () => !$("#settings").hidden || typingNow();
function rest() { if (busy()) { idleT = setTimeout(rest, 5000); return; } body.classList.add("idle"); }
function wake() {
  const now = Date.now();
  if (now - lastWake < 400 && !body.classList.contains("idle")) return; // mousemove fires constantly
  lastWake = now; body.classList.remove("idle"); clearTimeout(idleT);
  idleT = setTimeout(rest, isCalm() ? 15000 : 20000);
}
["mousemove", "pointerdown", "keydown", "wheel", "touchstart", "focusin"].forEach((ev) => addEventListener(ev, wake, { passive: true }));
function setCalm(on) {
  body.classList.toggle("calm", on); $("#calm").setAttribute("aria-pressed", on);
  try { localStorage["dayboard:calm"] = on ? "1" : ""; } catch {}
  if (on) { clearTimeout(idleT); body.classList.add("idle"); } else wake();
}
$("#calm").onclick = () => setCalm(!isCalm());
addEventListener("keydown", (e) => { if (e.key === "z" && !e.ctrlKey && !e.metaKey && !typingNow()) setCalm(!isCalm()); });
try { if (localStorage["dayboard:calm"]) setCalm(true); else wake(); } catch { wake(); }

/* ---------- settings: export / import backup ---------- */
const msg = (m) => ($("#setMsg").textContent = m);
let incoming = null;
function toggleSettings(on = $("#settings").hidden) {
  $("#settings").hidden = !on; $("#gear").setAttribute("aria-expanded", on); if (on) { renderRecover(); storyClose(); wpToggle(false); }
  if (!on) { $("#importBox").hidden = true; incoming = null; msg(""); }
  renderNudge();
}

document.addEventListener("click", (e) => { if (!$("#settings").hidden && !e.target.closest("#settings, #gear, #menu, #bkPop")) toggleSettings(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#settings").hidden) toggleSettings(false); });

function exportBackup() {
  const data = { app: "dayboard", version: 1, exportedAt: new Date().toISOString(), tasks, projects, links, saved, notes, paint, sview: ui.sview, prefs: { city: prefs.city, clock: prefs.clock, art: prefs.art } };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `dayboard-backup-${iso(new Date())}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  prefs.lastBackup = Date.now(); save(); syncPrefsUI(); renderNudge();
  msg(`Exported ${tasks.length} task${tasks.length === 1 ? "" : "s"}, ${saved.length} note${saved.length === 1 ? "" : "s"} and ${links.length} shortcuts.`);
}
$("#exportBtn").onclick = exportBackup;

/* a backup is untrusted input: keep only known fields, with safe shapes, before anything touches the page */
const okId = (x) => typeof x === "string" && /^[\w-]{1,64}$/.test(x);
const ymd = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const num = (n) => (Number.isFinite(n) ? n : null);
const str = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
function clean(d) {
  if (!d || typeof d !== "object" || !["tasks", "links", "projects", "saved"].some((k) => Array.isArray(d[k]))) return null;
  const arr = (a, ok) => (Array.isArray(a) ? a.filter((x) => x && typeof x === "object" && ok(x)) : []);
  return {
    tasks: arr(d.tasks, (x) => okId(x.id) && str(x.title, 1)).map((x) => ({
      id: x.id, title: str(x.title, 160), p: [1, 2, 3].includes(+x.p) ? +x.p : 2, proj: str(x.proj, 24) || "Inbox",
      tags: Array.isArray(x.tags) ? x.tags.filter((g) => typeof g === "string").map((g) => g.slice(0, 24)).slice(0, 10) : [],
      wait: str(x.wait, 30) || null, est: num(x.est), due: ymd(x.due), from: ymd(x.from), rem: num(x.rem), done: !!x.done, doneAt: num(x.doneAt),
      focus: !!x.focus, status: x.status === "doing" ? "doing" : "todo", ord: num(x.ord) ?? 0, sortedAt: ymd(x.sortedAt), focusFor: ymd(x.focusFor),
    })),
    links: arr(d.links, (x) => okId(x.id) && /^https?:\/\//i.test(x.url) && str(x.name, 1)).map((x) => ({
      id: x.id, name: str(x.name, 32), url: x.url.slice(0, 2000), proj: str(x.proj, 24) || null, dock: !!x.dock,
    })),
    saved: arr(d.saved, (x) => okId(x.id) && typeof x.body === "string").map((x) => ({
      id: x.id, title: str(x.title, 48) || "Untitled note", body: x.body.slice(0, 200000), proj: str(x.proj, 24) || null, ts: num(x.ts) ?? Date.now(),
    })),
    projects: Array.isArray(d.projects) ? [...new Set(d.projects.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim().slice(0, 24)))] : [],
    notes: str(d.notes, 200000),
    paint: d.paint && typeof d.paint === "object" ? Object.fromEntries(Object.entries(d.paint).filter(([k, v]) => ymd(k) && Array.isArray(v)).slice(-120)
      .map(([k, v]) => [k, v.filter((s) => s && okId(s.id) && Number.isFinite(s.ts)).map((s) => ({ id: s.id, ts: s.ts, p: [1, 2, 3].includes(+s.p) ? +s.p : 2 }))])) : {},
    prefs: d.prefs && typeof d.prefs === "object" ? {
      city: CITIES.some((c) => c.name === d.prefs.city) ? d.prefs.city : undefined,
      clock: ["12", "24"].includes(d.prefs.clock) ? d.prefs.clock : undefined,
      art: ["both", "paintings", "photos"].includes(d.prefs.art) ? d.prefs.art : undefined,
    } : {},
  };
}
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { incoming = f.size < 20e6 ? clean(JSON.parse(await f.text())) : null; } catch { incoming = null; }
  if (!incoming) { $("#importBox").hidden = true; return msg("That does not look like a Dayboard backup."); }
  msg(""); $("#importBox").hidden = false;
  $("#importInfo").textContent = `${f.name}: ${incoming.tasks.length} tasks, ${incoming.saved.length} notes, ${incoming.links.length} shortcuts, ${incoming.projects.length} projects.`;
};
$("#impCancel").onclick = () => { $("#importBox").hidden = true; incoming = null; };
function applyImport(mode) {
  const d = incoming; if (!d) return;
  if (mode === "replace" && !confirm("Replace everything in Dayboard with this backup?")) return;
  const merge = (a, b) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];
  if (mode === "replace") { tasks = d.tasks; links = d.links; saved = d.saved; projects = d.projects; notes = d.notes; paint = d.paint; cur = null; Object.assign(prefs, Object.fromEntries(Object.entries(d.prefs).filter(([, v]) => v !== undefined))); }
  else { tasks = merge(tasks, d.tasks); links = merge(links, d.links); saved = merge(saved, d.saved); projects = [...new Set([...projects, ...d.projects])]; if (!notes.trim()) notes = d.notes;
    for (const [day, list] of Object.entries(d.paint)) paint[day] = [...(paint[day] || []), ...list.filter((s) => !(paint[day] || []).some((x) => x.id === s.id))]; }
  [...tasks, ...links, ...saved].forEach((x) => x.proj && !projects.includes(x.proj) && projects.push(x.proj)); // nothing may point at a missing project
  if (!projects.length) projects.push("Inbox");
  if (ui.proj && !projects.includes(ui.proj)) ui.proj = null;
  if (!projects.includes(ui.addProj)) ui.addProj = null;
  tasks.forEach((t) => sync(t)); save(); store.set({ notes }); showNote(); render(); syncPrefsUI(); tick(); if (mode === "replace") applyArt();
  $("#importBox").hidden = true; incoming = null;
  msg(`${mode === "replace" ? "Replaced with" : "Merged"} ${d.tasks.length} tasks, ${d.saved.length} notes and ${d.links.length} shortcuts.`);
}
$("#impMerge").onclick = () => applyImport("merge");
$("#impReplace").onclick = () => applyImport("replace");

/* ---------- preferences: city, clock, background source ---------- */
const ago = (ms) => { const d = Math.floor((Date.now() - ms) / 864e5); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
$("#prefCity").innerHTML = CITIES.map((c) => `<option>${esc(c.name)}</option>`).join("");
/* glass: 0 = solid .. 50 = as designed .. 100 = nearly clear; every panel's fill is multiplied by --gt */
const glassK = (v) => (v <= 50 ? 1 + (50 - v) / 50 * .6 : 1 - (v - 50) / 50 * .72);
function applyGlass() { const k = glassK(Number.isFinite(prefs.glass) ? prefs.glass : 50).toFixed(3); document.documentElement.style.setProperty("--gt", k); try { localStorage["dayboard:gt"] = k; } catch {} }
$("#prefGlass").oninput = (e) => { prefs.glass = +e.target.value; applyGlass(); };
$("#prefGlass").onchange = () => save();
function syncPrefsUI() {
  $("#prefCity").value = place().name; $("#prefGlass").value = Number.isFinite(prefs.glass) ? prefs.glass : 50; applyGlass();
  applyPaintHide();
  document.body.dataset.clock = prefs.clockStyle || "solid"; try { localStorage["dayboard:cs"] = prefs.clockStyle || "solid"; } catch {}
  for (const [id, key] of [["prefClock", "clock"], ["prefArt", "art"], ["wpArt", "art"], ["prefWx", "wx"], ["prefGolden", "golden"], ["prefChime", "chime"], ["prefHeads", "heads"], ["prefClockStyle", "clockStyle"], ["prefOpenDay", "openDay"], ["prefFresh", "fresh"], ["prefRings", "rings"]]) document.querySelectorAll(`#${id} [data-v]`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === prefs[key]));
  $("#backupInfo").textContent = prefs.lastBackup ? `Last backup: ${ago(prefs.lastBackup)}.` : "No backup yet.";
}
$("#prefCity").onchange = (e) => { prefs.city = e.target.value; save(); renderSun(); syncPrefsUI(); wxFetch(); };
$("#prefGolden").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.golden = b.dataset.v; save(); syncPrefsUI(); goldenKey = ""; renderSun(); };
$("#prefChime").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.chime = b.dataset.v; save(); syncPrefsUI(); if (prefs.chime === "on") chime(); };
$("#prefHeads").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.heads = b.dataset.v; save(); syncPrefsUI(); };
$("#prefClockStyle").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.clockStyle = b.dataset.v; save(); syncPrefsUI(); };
$("#prefRings").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.rings = b.dataset.v; save(); syncPrefsUI(); renderRings(); };
$("#prefFresh").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.fresh = b.dataset.v; save(); syncPrefsUI(); if (prefs.fresh === "on") libFetch().catch(() => {}); };
$("#prefOpenDay").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.openDay = b.dataset.v; save(); syncPrefsUI(); };
$("#prefWx").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.wx = b.dataset.v; save(); syncPrefsUI(); wxStart(); };
$("#prefClock").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; prefs.clock = b.dataset.v; save(); tick(); syncPrefsUI(); };
const setArt = (v) => { // Art, Nature or both; Nature needs the day's photos, which load once a day
  prefs.art = v; save(); applyArt(); syncPrefsUI();
  if (typeof wpRender === "function" && !$("#wpPop").hidden) wpRender();
  if ((v === "photos" || v === "both") && !photos.length) return loadPhotos().then(() => { applyArt(); if (!$("#wpPop").hidden) wpRender(); }).catch(() => {});
};
$("#prefArt").onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) setArt(b.dataset.v); };

/* ---------- weekly backup nudge: a quiet dot on the gear and one line, at most once a week ---------- */
function renderNudge() {
  const t = Date.now(), base = Math.max(prefs.lastBackup || 0, hook?.on ? hook.last || 0 : 0) || prefs.firstSeen || t;
  const due = tasks.length + saved.length > 0 && t - base > 7 * 864e5 && t > (prefs.nudgeUntil || 0);
  $("#nudge").hidden = !(due && $("#settings").hidden && !document.body.classList.contains("calm"));
  $("#gear").classList.toggle("dot", due); $("#bk").classList.toggle("dot", due);
}
$("#nudgeGo").onclick = exportBackup;
$("#nudgeLater").onclick = () => { prefs.nudgeUntil = Date.now() + 7 * 864e5; save(); renderNudge(); };
setInterval(live(renderNudge), 6e4);

/* ---------- undo: every delete can be taken back for a few seconds ---------- */
let undoT, undoFn = null;
function undoable(label, fn) {
  undoFn = fn; $("#undoMsg").textContent = label; $("#undo").hidden = false;
  clearTimeout(undoT); undoT = setTimeout(() => { $("#undo").hidden = true; undoFn = null; }, 15000);
}
$("#undoBtn").onclick = () => {
  const f = undoFn; undoFn = null; $("#undo").hidden = true; clearTimeout(undoT); if (!f) return;
  f(); save(); showNote(); render();
};

/* ---------- other tabs and the quick-capture window write to the same storage: pick their changes up ---------- */
function externalUpdate(next) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b); let changed = false;
  if (next.tasks && !same(next.tasks, tasks)) { tasks = next.tasks; changed = true; }
  if (next.links && !same(next.links, links)) { links = next.links; changed = true; }
  if (next.saved && !same(next.saved, saved)) { saved = next.saved; changed = true; }
  if (next.projects && !same(next.projects, projects)) { projects = next.projects; changed = true; }
  if (next.paint && !same(next.paint, paint)) { paint = next.paint; changed = true; }
  if (typeof next.notes === "string" && next.notes !== notes && document.activeElement !== ned) { notes = next.notes; changed = true; } // another tab's scratchpad
  if (next.trash && !same(next.trash, trash)) { trash = next.trash; changed = true; }
  if ("hook" in next && !same(next.hook, hook)) { hook = next.hook; hookUI(); renderNudge(); }
  if (next.prefs && !same({ ...prefs, ...next.prefs }, prefs)) { Object.assign(prefs, next.prefs); changed = true; }
  if (changed) { showNote(); render(); syncPrefsUI(); tick(); }
}
if (globalThis.chrome?.storage?.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local") externalUpdate(Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, v.newValue]))); });
addEventListener("storage", (e) => { if (e.key === "dayboard" && e.newValue) { try { externalUpdate(JSON.parse(e.newValue)); } catch {} } }); // plain-page preview

/* ---------- sort my head: one task at a time, four gentle answers ---------- */
const SORT = { today: [1, 0], drop: [-1, 0], later: [0, -1], wait: [0, 1] }; // fly-off directions (drag directions match)
let sq = [], sHist = [], sCount = {}, sSkipped = new Set(), sFrom = null, sDrag = null;
const sEls = new Map();

function openSort() {
  sq = tasks.filter((t) => colOf(t) === "todo" && (!ui.proj || t.proj === ui.proj) && (!t.sortedAt || (t.sortedAt < today() && t.due && t.due <= today()))).sort(byOrd).map((t) => t.id);
  sHist = []; sCount = { today: 0, later: 0, wait: 0, drop: 0 }; sSkipped = new Set(); sFrom = document.activeElement;
  $("#sortPeople").innerHTML = [...new Set(tasks.map((t) => t.wait).filter(Boolean))].map((n) => `<option value="${esc(n)}">`).join("");
  $("#sort").hidden = false; document.body.classList.add("sorting");
  $("#sortStage").innerHTML = ""; sEls.clear(); sortLayout(); $("#sort").focus?.();
}
function closeSort() {
  $("#sort").hidden = true; document.body.classList.remove("sorting"); $("#sortWait").hidden = true; $("#sortStage").innerHTML = ""; sEls.clear();
  render(); try { sFrom?.focus?.(); } catch {}
}
const sTask = (id) => tasks.find((t) => t.id === id);
function sCard(t) {
  const el = document.createElement("div"); el.className = "scard"; el.dataset.id = t.id;
  el.innerHTML = `<small>${esc(t.proj)}${t.from ? ` · carried from ${fmtDue(t.from)}` : ""}${t.tags.length ? " · " + t.tags.map((g) => "#" + esc(g)).join(" ") : ""}</small>
    <h3>${esc(t.title)}</h3><p><i class="p p${t.p}"></i>P${t.p}${t.due ? ` · ${fmtDue(t.due)}` : ""}</p>`;
  return el;
}
function sortLayout() { // keep up to three cards in the DOM; depth classes do the stacking, CSS does the motion
  const done = !sq.length || sq.every((id) => sSkipped.has(id)), ids = done ? [] : sq.slice(0, 3), stage = $("#sortStage");
  for (const [id, el] of sEls) if (!ids.includes(id) && !el.classList.contains("leaving")) { el.remove(); sEls.delete(id); }
  ids.forEach((id, i) => {
    let el = sEls.get(id);
    if (!el) { const t = sTask(id); if (!t) return; el = sCard(t); el.style.opacity = "0"; el.dataset.d = 2; stage.append(el); sEls.set(id, el); el.offsetWidth; el.style.opacity = ""; }
    el.dataset.d = i;
  });
  $("#sortActions").hidden = done || !$("#sortWait").hidden; $("#sortKeys").hidden = done;
  const front = sEls.get(sq[0]); if (front) front.setAttribute("aria-live", "polite");
  if (done) sortEnd();
}
function sortEnd() {
  const stage = $("#sortStage"); stage.querySelectorAll(".send").forEach((n) => n.remove());
  const n = sCount, parts = [["today", "for today"], ["later", "for later"], ["wait", "waiting"], ["drop", "let go"]].filter(([k]) => n[k]).map(([k, w]) => `${n[k]} ${w}`);
  const none = !sHist.length && !sq.length, rest = sq.length;
  const end = document.createElement("div"); end.className = "send";
  end.innerHTML = `<h3>${none ? "Nothing to sort." : rest ? "These can wait." : "That is clear."}</h3>
    <p>${none ? "Your head is already clear." : "Nothing else is asking for you right now."}</p>${parts.length ? `<small>${parts.join("  ·  ")}</small>` : ""}
    <div class="opts"><button type="button" id="sendDone" class="pill solid">Back to the board</button>${sHist.length ? `<button type="button" id="sendUndo" class="pill">Undo last</button>` : ""}</div>`;
  stage.append(end); $("#sendDone").focus();
}
function fly(el, kind) { // send the front card off in the direction of the answer
  if (!el) return; el.classList.add("leaving"); el.classList.remove("drag");
  for (const [id, e] of sEls) if (e === el) sEls.delete(id); // a fresh card is made if this task comes round again
  const [dx, dy] = SORT[kind] || [0, 0.15];
  el.style.transition = "transform .42s cubic-bezier(.5,0,.75,0), opacity .34s ease";
  el.style.transform = `translate(${dx * 110}vw, ${dy * 80}vh) rotate(${dx * 14}deg)`; el.style.opacity = "0";
  setTimeout(() => el.remove(), 440);
}
function sortDecide(kind, who) {
  const id = sq[0], t = sTask(id), el = sEls.get(id); if (!t) { sq.shift(); return sortLayout(); }
  const before = JSON.parse(JSON.stringify(t)), idx = tasks.indexOf(t);
  if (kind === "today") t.due = today();
  else if (kind === "later") t.due = plus(today(), 7);
  else if (kind === "wait") { t.wait = who; t.due = plus(today(), 2); }
  else if (kind === "drop") { tasks = tasks.filter((x) => x !== t); toTrash("task", before); }
  if (kind !== "skip") { sCount[kind]++; if (kind !== "drop") { t.from = null; t.sortedAt = today(); } sync(t); } else sSkipped.add(id);
  sHist.push({ id, kind, before, idx });
  sq.shift(); if (kind === "skip") sq.push(id);
  fly(el, kind); save(); renderBoard(); sortLayout();
}
function sortUndo() {
  const h = sHist.pop(); if (!h) return;
  if (h.kind === "skip") { sq = sq.filter((x) => x !== h.id); sSkipped.delete(h.id); }
  else {
    if (h.kind === "drop") { tasks.splice(Math.min(h.idx, tasks.length), 0, h.before); trash = trash.filter((x) => x.item.id !== h.id); }
    else { const i = tasks.findIndex((x) => x.id === h.id); if (i >= 0) tasks[i] = h.before; }
    sCount[h.kind]--;
  }
  sq.unshift(h.id); sSkipped.delete(h.id); $("#sortStage").querySelector(".send")?.remove(); $("#sortWait").hidden = true;
  tasks.forEach((t) => t.id === h.id && sync(t)); save(); renderBoard(); sortLayout();
}
function sortChoose(kind) {
  if (!sq.length || sq.every((id) => sSkipped.has(id))) return;
  if (kind !== "wait") return sortDecide(kind);
  $("#sortWait").hidden = false; $("#sortActions").hidden = true; $("#sortKeys").hidden = true; $("#sw").value = ""; $("#sw").focus();
}
const waitBack = () => { $("#sortWait").hidden = true; sortLayout(); };

$("#sortBtn").onclick = openSort;
$("#sortX").onclick = closeSort;
$("#swBack").onclick = waitBack;
$("#sortWait").onsubmit = (e) => { e.preventDefault(); const who = $("#sw").value.trim(); if (!who) return; $("#sortWait").hidden = true; sortDecide("wait", who); };
$("#sort").addEventListener("click", (e) => {
  const a = e.target.closest("[data-sa]"); if (a) return sortChoose(a.dataset.sa);
  if (e.target.id === "sendDone") closeSort(); else if (e.target.id === "sendUndo") sortUndo();
});

/* drag the front card: right = today, left = let go, up = later, down = waiting */
const hintKeys = Object.keys(SORT);
function sortHints(dx, dy) {
  const p = { today: dx / 110, drop: -dx / 110, later: -dy / 110, wait: dy / 110 };
  hintKeys.forEach((k) => { const el = document.querySelector(`.sdir[data-k="${k}"]`), v = Math.max(0, Math.min(1, p[k])); el.style.opacity = v ? 0.35 + 0.65 * v : ""; el.style.transform = v ? `scale(${1 + 0.12 * v})` : ""; });
}
$("#sortStage").addEventListener("pointerdown", (e) => {
  const el = e.target.closest('.scard[data-d="0"]'); if (!el || e.button) return;
  sDrag = { el, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; el.setPointerCapture(e.pointerId); el.classList.add("drag");
});
$("#sortStage").addEventListener("pointermove", (e) => {
  if (!sDrag) return; sDrag.dx = e.clientX - sDrag.x; sDrag.dy = e.clientY - sDrag.y;
  sDrag.el.style.transform = `translate(${sDrag.dx}px, ${sDrag.dy}px) rotate(${sDrag.dx * 0.035}deg)`; sortHints(sDrag.dx, sDrag.dy);
});
const dragEnd = () => {
  if (!sDrag) return; const { el, dx, dy } = sDrag; sDrag = null; sortHints(0, 0);
  const kind = Math.abs(dx) >= Math.abs(dy) ? (dx > 110 ? "today" : dx < -110 ? "drop" : null) : (dy < -110 ? "later" : dy > 110 ? "wait" : null);
  el.classList.remove("drag"); el.style.transform = "";            // springs back unless it was a clear answer
  if (kind) sortChoose(kind);
};
$("#sortStage").addEventListener("pointerup", dragEnd);
$("#sortStage").addEventListener("pointercancel", dragEnd);

/* keys: captured first, so the page's own shortcuts (S, Z, N, /) stay quiet while sorting */
addEventListener("keydown", (e) => {
  if ($("#sort").hidden) return;
  if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); return $("#sortWait").hidden ? closeSort() : waitBack(); }
  if (e.target.id === "sw") return; // typing a name
  e.stopPropagation();
  if (e.ctrlKey || e.metaKey) { if (e.key.toLowerCase() === "z") { e.preventDefault(); sortUndo(); } return; }
  const k = { 1: "today", ArrowRight: "today", 2: "later", ArrowUp: "later", 3: "wait", ArrowDown: "wait", 4: "drop", ArrowLeft: "drop", " ": "skip" }[e.key];
  if (k) { e.preventDefault(); sortChoose(k); } else if (e.key === "Backspace") { e.preventDefault(); sortUndo(); }
}, true);
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !typingNow() && $("#sort").hidden) { e.preventDefault(); openSort(); } });

/* ---------- paint the day: each finished task adds a brushstroke, coloured by the time of day it was finished ---------- */
function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function reconcilePaint() { // strokes follow the tasks: finished adds one, un-finishing takes it back, deleting a finished task keeps it
  let changed = false;
  for (const t of tasks) if (t.done && t.doneAt) {
    const d = iso(new Date(t.doneAt)), day = (paint[d] ||= []);
    if (!day.some((s) => s.id === t.id)) { day.push({ id: t.id, ts: t.doneAt, p: t.p }); changed = true; }
  }
  for (const d of Object.keys(paint)) {
    const keep = paint[d].filter((s) => { const t = tasks.find((x) => x.id === s.id); return !t || (t.done && t.doneAt && iso(new Date(t.doneAt)) === d); });
    if (keep.length !== paint[d].length) { paint[d] = keep; changed = true; }
    if (!paint[d].length) { delete paint[d]; changed = true; }
  }
  const old = Object.keys(paint).sort().slice(0, -90); old.forEach((d) => delete paint[d]); // keep about three months
  if (changed || old.length) save();
}
const dayWork = (d) => WORKS[hash(d) % WORKS.length]; // today's real painting: one of the museum works, chosen by the date
const artImgs = new Map();
function artImg(url, onload) {
  let im = artImgs.get(url);
  if (!im) { im = new Image(); im.src = url; artImgs.set(url, im); }
  if (im.complete && im.naturalWidth) return im;
  im.addEventListener("load", onload, { once: true }); return null;
}
function paintOn(cv, strokes, grow, day) { // the painting waits under a mist; every finished task clears a patch of it
  const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(w * dpr), H = Math.round(h * dpr); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"), list = [...strokes].sort((a, b) => a.ts - b.ts), im = artImg(dayWork(day)[0], () => paintOn(cv, strokes, false, day));
  const draw = (p) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#121212"; ctx.fillRect(0, 0, W, H);
    if (!im) return;
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), sw = W / k, sh = H / k, sx = (im.naturalWidth - sw) / 2, sy = (im.naturalHeight - sh) / 2;
    ctx.filter = `blur(${Math.max(4, H * 0.05)}px) brightness(.4) saturate(.6)`; ctx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H); ctx.filter = "none"; // the veiled painting
    if (!list.length) return;
    const m = document.createElement("canvas"); m.width = W; m.height = H; const mc = m.getContext("2d");
    list.forEach((s, i) => { // a soft clearing per finished task; bigger for higher priority
      const r = rng(hash(s.id)), x = (0.12 + r() * 0.76) * W, y = (0.15 + r() * 0.7) * H, R = Math.max(0.01, ({ 1: 0.3, 2: 0.25, 3: 0.2 }[s.p] || 0.25) * Math.sqrt(W * H) * (i === list.length - 1 ? p : 1)); // about ten tasks clear most of it
      const g = mc.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.55, "rgba(0,0,0,.92)"); g.addColorStop(1, "rgba(0,0,0,0)");
      mc.fillStyle = g; mc.beginPath(); mc.arc(x, y, R, 0, 7); mc.fill();
    });
    const sc = document.createElement("canvas"); sc.width = W; sc.height = H; const sctx = sc.getContext("2d");
    sctx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H); sctx.globalCompositeOperation = "destination-in"; sctx.drawImage(m, 0, 0); // sharp painting, only where the mist is gone
    ctx.drawImage(sc, 0, 0);
  };
  cancelAnimationFrame(cv._raf);
  if (!grow || !list.length) return draw(1);
  const t0 = performance.now(), step = (now) => { const k = Math.min(1, (now - t0) / 1400); draw(1 - Math.pow(1 - k, 3)); if (k < 1) cv._raf = requestAnimationFrame(step); };
  cv._raf = requestAnimationFrame(step); // the newest patch clears over a moment
}
let paintN = null;
function renderPaint() {
  const day = paint[today()] || [], grow = paintN !== null && day.length > paintN; paintN = day.length;
  paintOn($("#paintCanvas"), day, grow, today());
  const [, title, artist] = dayWork(today()), tip = `Today's painting: ${title}, ${artist}. It clears as you finish things. Click to see your days.`;
  $("#paintBtn").title = tip; $("#paintBtn").setAttribute("aria-label", tip); $("#paintCap").textContent = `${title} · ${artist.split(" ").slice(-1)[0]}`;
}
addEventListener("resize", () => renderPaint());
const dayLabel = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
function openDays() {
  const ds = [...new Set([today(), ...Object.keys(paint)])].sort().reverse().slice(0, 30);
  $("#daysGrid").innerHTML = ds.map((d) => `<figure><button type="button" class="dfig" data-d="${d}" aria-label="Open ${esc(dayWork(d)[1])}"><canvas class="dcv" data-d="${d}" aria-hidden="true"></canvas></button><figcaption>${d === today() ? "Today" : dayLabel(d)}<small>${esc(dayWork(d)[1])}</small></figcaption></figure>`).join("");
  $("#days").hidden = false; document.body.classList.add("sorting");
  document.querySelectorAll(".dcv").forEach((cv) => paintOn(cv, paint[cv.dataset.d] || [], false, cv.dataset.d));
  if (!Object.keys(paint).length) $("#daysGrid").insertAdjacentHTML("afterend", `<p class="rsub dempty">Finish something and your first painting begins.</p>`);
  $("#days").focus();
}
function closeDays() { $("#days").hidden = true; document.body.classList.remove("sorting"); document.querySelector(".dempty")?.remove(); }
$("#paintBtn").onclick = () => openLb(today());
$("#daysGrid").onclick = (e) => { const b = e.target.closest(".dfig"); if (b) openLb(b.dataset.d); };
$("#daysBtn").onclick = () => { toggleSettings(false); openDays(); }; $("#daysBtn").onclick = () => { toggleSettings(false); openDays(); }; $("#daysX").onclick = closeDays;

/* ---------- lightbox: the whole painting, and full screen if you like ---------- */
let lbDays = [], lbIdx = 0, lbMistOn = false, lbBig = "", lbT;
function openLb(day) {
  lbDays = [...new Set([today(), ...Object.keys(paint)])].sort().reverse().slice(0, 30); lbIdx = Math.max(0, lbDays.indexOf(day));
  $("#lb").hidden = false; document.body.classList.add("sorting"); showLb(); $("#lb").focus();
}
function showLb() {
  const day = lbDays[lbIdx], [src, title, artist, date] = dayWork(day), img = $("#lbImg"), mist = $("#lbMist");
  $("#lbTitle").textContent = title; $("#lbMeta").textContent = `${artist}, ${date}  ·  ${day === today() ? "Today" : dayLabel(day)}`;
  $("#lbPrev").hidden = lbIdx >= lbDays.length - 1; $("#lbNext").hidden = lbIdx <= 0;
  clearTimeout(lbT); mist.style.transition = "none"; mist.style.opacity = "0"; lbMistOn = false; lbBig = "";
  img.onload = () => { // the first load is the small copy; the original swaps in quietly afterwards
    if (img.src === lbBig) return;
    $("#lbFrame").style.setProperty("--ar", img.naturalWidth / img.naturalHeight);
    requestAnimationFrame(() => {
      paintOn(mist, paint[day] || [], false, day); mist.style.opacity = "1"; mist.offsetWidth; mist.style.transition = ""; lbMistOn = true;
      lbT = setTimeout(() => { mist.style.opacity = "0"; lbMistOn = false; lbMistLabel(); }, 1100); // the mist lifts to show the whole painting
      lbMistLabel();
    });
    const big = src.replace("/web-large/", "/original/");
    if (big !== src) { const hi = new Image(); hi.onload = () => { if (lbDays[lbIdx] === day) { lbBig = big; img.src = big; } }; hi.src = big; }
  };
  img.src = src;
}
const lbMistLabel = () => ($("#lbMistBtn").textContent = lbMistOn ? "Show full painting" : "Show my day");
const lbRepaint = () => { if (!$("#lb").hidden) { const d = lbDays[lbIdx]; paintOn($("#lbMist"), paint[d] || [], false, d); } };
function closeLb() { if (document.fullscreenElement) document.exitFullscreen?.(); $("#lb").classList.remove("big"); $("#lbFull").textContent = "Full screen"; $("#lb").hidden = true; if ($("#days").hidden) document.body.classList.remove("sorting"); }
$("#lbX").onclick = closeLb;
$("#lbMistBtn").onclick = () => { clearTimeout(lbT); lbMistOn = !lbMistOn; $("#lbMist").style.opacity = lbMistOn ? "1" : "0"; lbMistLabel(); };
$("#lbPrev").onclick = () => { if (lbIdx < lbDays.length - 1) { lbIdx++; showLb(); } };
$("#lbNext").onclick = () => { if (lbIdx > 0) { lbIdx--; showLb(); } };
const lbBigOn = () => $("#lb").classList.contains("big");
async function lbFullToggle() { // fill the whole window first (always works), then ask the browser for the whole screen
  const lb = $("#lb");
  if (lbBigOn() || document.fullscreenElement) { lb.classList.remove("big"); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); }
  else { lb.classList.add("big"); try { await lb.requestFullscreen(); } catch {} }
  $("#lbFull").textContent = lbBigOn() ? "Exit full screen" : "Full screen"; setTimeout(lbRepaint, 200);
}
$("#lbFull").onclick = lbFullToggle;
$("#lbFrame").ondblclick = () => { if (!lbBigOn()) lbFullToggle(); };
$("#lbFrame").onclick = () => { if (lbBigOn()) lbFullToggle(); };
$("#lbDays").onclick = () => { closeLb(); openDays(); };
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) { $("#lb").classList.remove("big"); $("#lbFull").textContent = "Full screen"; } setTimeout(lbRepaint, 200); }); // Esc out of real full screen returns to the normal view
addEventListener("resize", () => setTimeout(lbRepaint, 150));
addEventListener("keydown", (e) => { // lightbox keys: arrows between days, F for full screen
  if ($("#lb").hidden) return;
  if (e.key === "ArrowLeft") $("#lbPrev").click(); else if (e.key === "ArrowRight") $("#lbNext").click(); else if (e.key.toLowerCase() === "f") lbFullToggle();
}, true);

/* ---------- wrap up the day: tomorrow's one thing, leave what is circling, then a quiet sunset ---------- */
let wStep = 1, wPick = null, wOne = null;
function openWrap() {
  wStep = 1; wPick = null; wOne = null; $("#wrapNew").value = ""; $("#wrapDump").value = "";
  const rank = (t) => (t.status === "doing" ? 0 : t.focus ? 1 : t.due && t.due <= today() ? 2 : 3);
  const cands = tasks.filter((t) => !t.done && !t.wait && (!ui.proj || t.proj === ui.proj)).sort((a, b) => rank(a) - rank(b) || byOrd(a, b)).slice(0, 6);
  $("#wrapPick").innerHTML = cands.length ? cands.map((t) => `<li><button type="button" class="ritem" data-id="${t.id}" aria-pressed="false"><span>${esc(t.title)}</span><small>${esc(t.proj)}</small></button></li>`).join("") : "";
  $("#wrap").hidden = false; document.body.classList.add("sorting"); wShow(1);
}
function wShow(n) {
  wStep = n; document.querySelectorAll("#wrap .rstep").forEach((s) => (s.hidden = +s.dataset.s !== n));
  document.querySelectorAll("#wrap .rdots i").forEach((d, i) => d.classList.toggle("on", i < n));
  if (n === 1) $("#wrapNew").focus(); else if (n === 2) $("#wrapDump").focus(); else wRecap();
}
function wRecap() {
  const done = tasks.filter((t) => t.doneAt && iso(new Date(t.doneAt)) === today()).length;
  $("#wrapSum").textContent = (done ? `You finished ${done} thing${done > 1 ? "s" : ""} today.` : "A quiet day is still a day.") + (prefs.intent?.day === today() ? ` This morning you wanted today to feel: “${prefs.intent.text}”.` : "") + (wOne ? ` Tomorrow: ${wOne}.` : "");
  paintOn($("#wrapCanvas"), paint[today()] || [], false, today()); $("#wrapGo").focus();
}
function wApplyOne() { // step 1: set tomorrow's one thing (a task you pick, or a new one)
  const tmr = plus(today(), 1), typed = $("#wrapNew").value.trim(); let t = null;
  if (typed) {
    const q = parse(typed, 2);
    t = { id: crypto.randomUUID(), title: q.title || typed, p: q.p, proj: ui.proj || ui.addProj || projects[0], tags: q.tags, wait: null, due: tmr, rem: null, done: false, status: "todo", ord: Date.now() };
    tasks.push(t);
  } else if (wPick) t = tasks.find((x) => x.id === wPick);
  if (!t) return;
  tasks.forEach((x) => x !== t && x.focusFor === tmr && delete x.focusFor);
  t.focusFor = tmr; if (!t.due || t.due < tmr) t.due = tmr; wOne = t.title; save(); render();
}
function wApplyDump() { // step 2: action lines become tomorrow's tasks; the whole thing is kept as a note
  const text = $("#wrapDump").value.trim(); if (!text) return;
  const re = /^(\s*(?:[-*]\s*)?)\[\s?\]\s*(.+)|^(\s*(?:[-*]\s*)?)(?:todo|action|ai):\s*(.+)/i, tmr = plus(today(), 1);
  const body = text.split("\n").map((line) => {
    const m = line.match(re); if (!m) return line;
    const q = parse(m[2] || m[4], 2); if (!q.title) return line;
    tasks.push({ id: crypto.randomUUID(), title: q.title, p: q.p, proj: ui.proj || ui.addProj || projects[0], tags: q.tags, wait: q.wait, due: tmr, rem: null, done: false, status: "todo", ord: Date.now() });
    return `${m[1] ?? m[3]}[x] ${m[2] || m[4]}`;
  }).join("\n");
  saved.unshift({ id: crypto.randomUUID(), title: `Shutdown · ${dayLabel(today())}`, body, proj: ui.proj, ts: Date.now() });
  save(); showNote(); render();
}
function closeWrap() { $("#wrap").hidden = true; document.body.classList.remove("sorting"); }
function goRest() {
  closeWrap(); try { localStorage["dayboard:wind"] = today(); } catch {} renderWind();
  const r = $("#rest"); r.hidden = false; r.classList.remove("on"); r.querySelector(".rsun").style.animation = "none"; r.offsetWidth; r.querySelector(".rsun").style.animation = "";
  requestAnimationFrame(() => r.classList.add("on")); r._since = Date.now(); document.body.classList.add("sorting");
}
function wakeRest(e) { const r = $("#rest"); if (r.hidden) return; e.stopPropagation(); if (Date.now() - r._since < 1800) return; r.classList.remove("on"); document.body.classList.remove("sorting"); setTimeout(() => (r.hidden = true), 900); }
["keydown", "pointerdown"].forEach((ev) => addEventListener(ev, wakeRest, true));

$("#wrapPick").onclick = (e) => {
  const b = e.target.closest(".ritem"); if (!b) return;
  const on = b.getAttribute("aria-pressed") !== "true";
  document.querySelectorAll(".ritem").forEach((x) => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", on); wPick = on ? b.dataset.id : null; if (on) $("#wrapNew").value = "";
};
$("#wrapNew").oninput = () => { if ($("#wrapNew").value) { wPick = null; document.querySelectorAll(".ritem").forEach((x) => x.setAttribute("aria-pressed", "false")); } };
$("#wrap").addEventListener("click", (e) => {
  const b = e.target.closest("[data-r]"); if (!b) return; const k = b.dataset.r;
  if (k === "back") return wShow(wStep - 1);
  if (k === "go") return goRest();
  if (k === "next") { if (wStep === 1) wApplyOne(); if (wStep === 2) wApplyDump(); }
  wShow(wStep + 1);
});
$("#wrapNew").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); wApplyOne(); wShow(2); } });
$("#wrapBtn").onclick = openWrap; $("#windWrap").onclick = openWrap; $("#wrapX").onclick = closeWrap;

/* these overlays take the keyboard: the page's own shortcuts stay quiet, Esc steps out */
addEventListener("keydown", (e) => {
  const open = !$("#lb").hidden ? () => (document.fullscreenElement || lbBigOn() ? lbFullToggle() : closeLb()) : !$("#wrap").hidden ? closeWrap : !$("#days").hidden ? closeDays : !$("#mtgv").hidden ? closeMtg : !$("#openday").hidden ? closeOpenDay : !$("#breath").hidden ? closeBreath : !$("#timev").hidden ? closeTime : !$("#cal").hidden ? closeCal : null; if (!open) return;
  if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); return open(); }
  if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.stopPropagation();
}, true);
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.metaKey && !typingNow() && $("#wrap").hidden && $("#sort").hidden && $("#days").hidden) { e.preventDefault(); openWrap(); }
});

/* ---------- recover: 30 days of deleted notes and tasks, and a snapshot taken at the first open of each day ---------- */
function toTrash(kind, item) {
  trash.unshift({ kind, item: JSON.parse(JSON.stringify(item)), at: Date.now() });
  trash = trash.filter((x) => Date.now() - x.at < 30 * 864e5).slice(0, 100); save();
}
function takeSnap() { // the state at the start of today is also the end of yesterday
  const d = today(); if (snaps[d] || !(tasks.length || saved.length || notes.trim())) return;
  snaps[d] = JSON.parse(JSON.stringify({ tasks, saved, notes }));
  snaps = Object.fromEntries(Object.keys(snaps).sort().slice(-8).map((k) => [k, snaps[k]])); save();
}
function renderRecover() {
  const items = trash.filter((x) => Date.now() - x.at < 30 * 864e5);
  $("#trashList").innerHTML = items.length ? items.slice(0, 20).map((x, i) => `<li><span>${x.kind === "note" ? "Note" : "Task"} · ${esc((x.item.title || "").slice(0, 34))}</span><button type="button" class="pill" data-tr="${i}">Restore</button></li>`).join("") : `<li class="rnone">Nothing deleted recently.</li>`;
  $("#archList").innerHTML = archive.length ? archive.slice(0, 20).map((t, i) => `<li><span>${esc((t.title || "").slice(0, 34))}</span><button type="button" class="pill" data-ar="${i}">Reopen</button></li>`).join("") + (archive.length > 20 ? `<li class="rnone">${archive.length - 20} older</li>` : "") : `<li class="rnone">Nothing tucked away yet.</li>`;
  const days = Object.keys(snaps).sort().reverse();
  $("#snapList").innerHTML = days.length ? days.map((d) => `<li><span>Start of ${esc(dayLabel(d))} · ${snaps[d].saved.length} notes · ${snaps[d].tasks.length} tasks</span><button type="button" class="pill" data-snap="${d}">Restore missing</button></li>`).join("") : `<li class="rnone">The first snapshot is taken the next time you open a tab.</li>`;
}
$("#trashList").onclick = (e) => {
  const b = e.target.closest("[data-tr]"); if (!b) return;
  const live = trash.filter((x) => Date.now() - x.at < 30 * 864e5), x = live[+b.dataset.tr]; if (!x) return;
  if (x.kind === "note") saved.unshift(x.item); else { tasks.push(x.item); sync(x.item); }
  trash = trash.filter((y) => y !== trash.find((z) => z.at === x.at && z.item.id === x.item.id)); save(); showNote(); render(); renderRecover(); msg(`Restored “${(x.item.title || "").slice(0, 30)}”.`);
};
$("#archList").onclick = (e) => {
  const b = e.target.closest("[data-ar]"); const t = b && archive[+b.dataset.ar]; if (!t) return;
  archive = archive.filter((x) => x !== t); Object.assign(t, { done: false, doneAt: null, due: today(), status: "todo" }); tasks.push(t); sync(t);
  save(); render(); renderRecover(); msg(`Reopened “${(t.title || "").slice(0, 30)}”.`);
};
$("#snapList").onclick = (e) => { // non-destructive: only brings back what is missing now
  const b = e.target.closest("[data-snap]"); if (!b) return; const s = snaps[b.dataset.snap]; if (!s) return; let n = 0;
  for (const x of s.saved || []) if (!saved.some((y) => y.id === x.id)) { saved.push(x); n++; }
  for (const t of s.tasks || []) if (!tasks.some((y) => y.id === t.id)) { tasks.push(t); sync(t); n++; }
  if (!notes.trim() && s.notes) { notes = s.notes; n++; store.set({ notes }); }
  save(); showNote(); render(); msg(n ? `Brought back ${n} missing item${n > 1 ? "s" : ""}.` : "Nothing was missing.");
};

/* ---------- meeting: notes on the left, tasks on the right; action lines become tasks ---------- */
let mtg = null, mtT, mtDue = "today"; // mtg = { id, title, with, body, start, end?, loc?, proj } while a meeting is running (survives closing the tab)
const mtKeep = () => store.set({ meeting: mtg });
const mtDueDate = () => ({ today: today(), tomorrow: plus(today(), 1), week: plus(today(), 7) })[mtDue];
const mtBtn = () => { $("#mtgBtn").classList.toggle("live", !!mtg); $("#mtgBtn").textContent = mtg ? "Meeting · live" : "Meeting"; };
const actText = (m) => (m[2] || m[4]).replace(/^(?:todo|action|ai):\s*/i, ""); // "[ ] todo: x" -> "x"
const mtLines = () => mtg.body.split("\n").map((l, i) => ({ i, m: l.match(ACT) })).filter((x) => x.m);
function mtMake(raw) { // one task from "Send deck @Priya #client !1"
  const { title, p, tags, wait, est } = parse(raw, 2); if (!title) return null;
  const t = { id: crypto.randomUUID(), title, p, proj: mtg.proj, tags, wait, est, due: wait ? plus(today(), 2) : mtDueDate(), rem: null, done: false, mid: mtg.id };
  tasks.push(t); return t;
}
function mtTaken(lineIdx) { // mark the line as taken so it can't be added twice
  const ls = mtg.body.split("\n"), m = ls[lineIdx].match(ACT);
  ls[lineIdx] = `${m[1] ?? m[3]}[x] ${m[2] || m[4]}`; mtg.body = ls.join("\n"); $("#mtText").value = mtg.body;
}
function mtRender() {
  if (!mtg) return;
  const acts = mtLines().filter((x) => parse(actText(x.m), 2).title), made = tasks.filter((t) => t.mid === mtg.id);
  $("#mtN").textContent = acts.length || ""; $("#mtCount").textContent = acts.length + made.length || "";
  $("#mtActs").innerHTML = acts.length ? acts.map((x) => { const q = parse(actText(x.m), 2);
    return `<li><span>${esc(q.title)}</span><small class="${q.wait ? "w" : ""}">${q.wait ? "waiting on " + esc(q.wait) : q.tags.map((g) => "#" + esc(g)).join(" ")}${q.p === 1 ? " !1" : ""}</small><button type="button" class="pill" data-mta="${x.i}">Add</button></li>`; }).join("")
    : `<li class="none">Write a line starting with [ ] and it shows up here.</li>`;
  const row = (t) => `<li class="${t.done ? "done" : ""}"><button class="check" data-done="${t.id}" aria-label="Toggle complete"></button><span>${esc(t.title)}</span><small class="${t.wait ? "w" : ""}">${t.wait ? "waiting on " + esc(t.wait) : esc(fmtDue(t.due))}</small></li>`;
  $("#mtMade").innerHTML = made.length ? made.map(row).join("") : `<li class="none">Nothing added yet.</li>`;
  const rest = open().filter((t) => t.proj === mtg.proj && t.mid !== mtg.id).sort((a, b) => (a.due || "9").localeCompare(b.due || "9") || a.p - b.p);
  $("#mtOpenH").textContent = `Open in ${mtg.proj} · ${rest.length}`;
  $("#mtOpen").innerHTML = rest.length ? rest.slice(0, 12).map(row).join("") + (rest.length > 12 ? `<li class="none">and ${rest.length - 12} more on the board</li>` : "") : `<li class="none">Nothing open in ${esc(mtg.proj)}.</li>`;
}
function openMtg() {
  if (!mtg) { mtg = { id: crypto.randomUUID(), title: "", with: "", body: "", start: Date.now(), proj: ui.proj || projects[0] }; mtKeep(); }
  if (!projects.includes(mtg.proj)) mtg.proj = projects[0];
  $("#mtProj").innerHTML = projects.map((p) => `<option>${esc(p)}</option>`).join(""); $("#mtProj").value = mtg.proj;
  $("#mtTitle").value = mtg.title; $("#mtWith").value = mtg.with; $("#mtText").value = mtg.body;
  mtPane("notes"); $("#mtgv").hidden = false; document.body.classList.add("sorting"); mtBtn(); mtRender();
  (mtg.title ? $("#mtText") : $("#mtTitle")).focus();
}
function closeMtg() { $("#mtgv").hidden = true; document.body.classList.remove("sorting"); mtKeep(); }
function mtPane(p) { $("#mtgv .mtbody").dataset.p = p; document.querySelectorAll("#mtTabs [data-p]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.p === p)); }
function mtInput() { clearTimeout(mtT); mtT = setTimeout(mtKeep, 400); mtRender(); }
$("#mtTitle").oninput = (e) => { mtg.title = e.target.value; mtInput(); };
$("#mtWith").oninput = (e) => { mtg.with = e.target.value; mtInput(); };
$("#mtText").oninput = () => { mtg.body = $("#mtText").value; mtInput(); };
$("#mtProj").onchange = (e) => { mtg.proj = e.target.value; mtInput(); };
$("#mtTabs").onclick = (e) => { const b = e.target.closest("[data-p]"); if (b) mtPane(b.dataset.p); };
$("#mtDue").onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; mtDue = b.dataset.d; document.querySelectorAll("#mtDue [data-d]").forEach((x) => x.setAttribute("aria-pressed", x === b)); };
$("#mtX").onclick = closeMtg;
$("#mtgBtn").onclick = openMtg; $("#mtg").onclick = openMtg;
$("#mtActs").onclick = (e) => {
  const b = e.target.closest("[data-mta]"); if (!b) return;
  const i = +b.dataset.mta, m = mtg.body.split("\n")[i]?.match(ACT); if (!m) return;
  if (mtMake(actText(m))) { mtTaken(i); save(); mtKeep(); render(); }
};
$("#mtAdd").onkeydown = (e) => {
  if (e.key !== "Enter") return; e.preventDefault();
  const v = e.target.value.trim(); if (!v) return;
  mtg.body += `${mtg.body && !mtg.body.endsWith("\n") ? "\n" : ""}- [ ] ${v}\n`; $("#mtText").value = mtg.body; e.target.value = ""; mtInput();
};
$("#mtgv .mtq").onclick = (e) => {
  const b = e.target.closest("[data-ins]"); if (!b) return;
  const el = $("#mtText"), at = el.selectionStart, ls = el.value.lastIndexOf("\n", at - 1) + 1, pre = at === ls ? "" : "\n";
  el.setRangeText(pre + b.dataset.ins, at, at, "end"); el.focus(); el.oninput();
};
$("#mtText").onkeydown = (e) => { // Enter on a checklist line starts the next one; Enter on an empty one ends the list
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  const el = e.target, at = el.selectionStart, ls = el.value.lastIndexOf("\n", at - 1) + 1, line = el.value.slice(ls, at), m = line.match(/^(\s*)- \[ \] (.*)$/);
  if (!m || el.selectionEnd !== at) return; e.preventDefault();
  if (m[2]) el.setRangeText(`\n${m[1]}- [ ] `, at, at, "end"); else el.setRangeText("", ls, at, "end");
  el.oninput();
};
$("#mtEnd").onclick = () => {
  const prev = JSON.parse(JSON.stringify(mtg)), made = [];
  mtLines().forEach(({ i }) => { const m = mtg.body.split("\n")[i].match(ACT), t = mtMake(actText(m)); if (t) { made.push(t); mtTaken(i); } });
  const title = mtg.title.trim() || "Meeting";
  let note = null;
  if (mtg.body.trim() || mtg.title.trim()) {
    const when = `${new Date(mtg.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${hhmm(mtg.start)}`;
    const line = [when + (mtg.end ? ` – ${hhmm(mtg.end)}` : ""), mtg.loc, mtg.with.trim() && "With " + mtg.with.trim()].filter(Boolean).join(" · ");
    const head = `# ${title}\n*${line}*\n\n`;
    note = { id: crypto.randomUUID(), title: title.slice(0, 48), body: head + mtg.body.replace(/^\s*- \[ \]\s*$\n?/gm, "").trim() + "\n", proj: mtg.proj, ts: Date.now() }; saved.unshift(note);
  }
  mtg = null; store.set({ meeting: null, saved }); save(); closeMtg(); mtBtn(); showNote(); render();
  undoable(`${note ? "Saved to Notes" : "Meeting ended"} · ${made.length} task${made.length === 1 ? "" : "s"} added`, () => {
    tasks = tasks.filter((t) => !made.includes(t)); saved = saved.filter((x) => x !== note); mtg = prev; mtKeep(); openMtg();
  });
};
$("#mtDiscard").onclick = () => {
  const prev = mtg; if (prev.body.trim()) toTrash("note", { id: crypto.randomUUID(), title: prev.title.trim() || "Meeting", body: prev.body, proj: prev.proj, ts: Date.now() });
  mtg = null; mtKeep(); closeMtg(); mtBtn(); render();
  undoable("Meeting discarded", () => { mtg = prev; mtKeep(); openMtg(); });
};
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && $("#mtgv").hidden && $("#sort").hidden && $("#wrap").hidden && $("#lb").hidden) { e.preventDefault(); openMtg(); } });

/* ---------- focus mode (F) ---------- */
const zenOpen = () => ["#sort", "#wrap", "#days", "#lb", "#mtgv", "#openday", "#breath", "#timev", "#cal"].some((s) => !$(s).hidden) || document.body.classList.contains("looking");
function setZen(on = !body.classList.contains("zen")) { body.classList.toggle("zen", on); scrollTo(0, 0); }
$("#zenBtn").onclick = () => setZen(true); $("#zenRow").onclick = () => setTimeout(() => setZen(true), 60); $("#zenExit").onclick = () => setZen(false);
addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || typingNow() || zenOpen()) return;
  if (e.key.toLowerCase() === "f") { e.preventDefault(); setZen(); } else if (e.key === "Escape" && body.classList.contains("zen")) setZen(false);
});

/* ---------- spotlight (Ctrl+K): shortcuts, projects, notes, tasks and every command in one box; anything else becomes a task ---------- */
const palCmds = () => [
  [mtg ? "Resume meeting" : "Start meeting", "meeting notes tasks standup", "M", openMtg],
  ["Open notes", "notes scratchpad write", "N", () => toggleNotes(true)],
  ["New note", "note write blank", "", () => { toggleNotes(true); $("#nNew").click(); }],
  ["Focus mode", "focus zen clock fullscreen", "F", () => setZen(true)],
  ["Sort my head", "triage sort declutter", "T", openSort],
  ["Wrap up the day", "wrap shutdown end of day", "E", openWrap],
  ["Calm mode", "calm quiet fade", "Z", () => setCalm(!isCalm())],
  ["Life in weeks", "time life weeks dots years lived remaining mortality", "W", () => setTimeout(() => openTime("life"), 60)],
  ["Year in dots", "time year days dots left progress", "", () => setTimeout(() => openTime("year"), 60)],
  ["Sky: preview sunset", "sunset sky glow evening preview", "", () => setTimeout(() => skyEvent("set"), 120)],
  ["Sky: preview sunrise", "sunrise sky glow morning preview", "", () => setTimeout(() => skyEvent("rise"), 120)],
  ["Notifications", "notifications inbox bell alerts reminders heads-up", "", () => setTimeout(() => EXT && bellToggle(true), 60)],
  ["Moon phase", "moon phase lunar full new crescent night moonrise moonset", "", () => setTimeout(() => moonToggle(true), 60)],
  ["Weather", "weather temperature forecast rain sky", "", () => setTimeout(() => wxToggle(true), 60)],
  ["Temperature: switch °C / °F", "fahrenheit celsius units temperature degrees", "", () => { prefs.units = useF() ? "c" : "f"; save(); renderWx(); }],
  ["Calendar", "calendar month festivals holidays india diwali holi meetings", "C", () => setTimeout(() => openCal(), 60)],
  ["Calendar: week view", "week calendar meetings schedule timeline agenda", "", () => setTimeout(() => { calMode = "week"; try { localStorage["dayboard:calmode"] = "week"; } catch {} openCal(); }, 60)],
  ...(HAS_OL ? [["Refresh meetings", "outlook meetings calendar sync refresh reload", "", () => (ol?.url ? mtRefresh(true) : toggleSettings(true))]] : []),
  ["One minute breath", "breathe breath pause calm minute reset", "B", () => setTimeout(openBreath, 60)],
  ["Open the day", "morning ritual start begin day intention breathe", "O", () => setTimeout(openDay, 60)],
  ["Look closer", "zoom detail picture painting closer magnify", "L", () => setTimeout(lookStart, 60)],
  ["Hide or show the small painting", "painting hide show unhide small widget day mist", "", () => { prefs.paintHide = !prefs.paintHide; save(); applyPaintHide(); }],
  ["Change painting", "art background refresh next another picture", "", () => $("#refresh").click()],
  ["Your days", "paintings gallery history", "", openDays],
  ["Export backup", "export save download backup file local", "", exportBackup],
  ["Import backup", "import restore upload backup", "", () => { toggleSettings(true); $("#importFile").click(); }],
  ["Send backup to Discord now", "discord webhook backup auto", "", () => { toggleSettings(true); hookNow(); }],
  ["Weather: preview rain", "weather rain drizzle", "", () => wxShow("rain")],
  ["Weather: preview heavy rain", "weather storm thunder heavy", "", () => wxShow("storm")],
  ["Weather: preview snow", "weather snow", "", () => wxShow("snow")],
  ["Weather: preview mist", "weather fog mist", "", () => wxShow("mist")],
  ["Weather: preview clouds", "weather clouds overcast", "", () => wxShow("clouds")],
  ["Weather: back to the real sky", "weather live real clear", "", () => wxShow(null)],
  ["Settings", "preferences city options", "", () => toggleSettings(true)],
  ["Use 24-hour clock", "clock time format", "", () => $("#prefClock [data-v='24']").click()],
  ["Use 12-hour clock", "clock time format am pm", "", () => $("#prefClock [data-v='12']").click()],
  ["Save wallpaper", "wallpaper download save picture image background hd", "", wpSave],
  ["Wallpaper: art", "wallpaper background art paintings", "", () => setArt("paintings")],
  ["Wallpaper: nature", "wallpaper background nature photos", "", () => setArt("photos")],
  ["Wallpaper: art and nature", "wallpaper background both", "", () => setArt("both")],
  ["Wallpaper: my pictures", "wallpaper background mine own upload photos", "", () => setArt("mine")],
  ["Wallpaper: favourites", "wallpaper background favourites favorites hearts liked", "", () => setArt("favs")],
  ["Favourite this wallpaper", "wallpaper heart favourite favorite like keep", "", () => $("#wpFav").click()],
  ["Glass transparency: reset", "glass transparency frosted clear solid default", "", () => { prefs.glass = 50; save(); syncPrefsUI(); }],
  ["Clock style: frosted", "clock style frosted glass", "", () => $("#prefClockStyle [data-v='frosted']").click()],
  ["Clock style: thin", "clock style thin light", "", () => $("#prefClockStyle [data-v='thin']").click()],
  ["Clock style: solid", "clock style solid bold", "", () => $("#prefClockStyle [data-v='solid']").click()],
];
/* desktop apps: only apps that register a link scheme can be opened from a page (no terminal / file manager without a helper) */
const OS = /win/i.test(navigator.userAgentData?.platform || navigator.platform) ? "win" : /linux/i.test(navigator.userAgentData?.platform || navigator.platform) ? "linux" : "other";
const palApps = () => [
  ["Open VS Code", "vscode code editor", "vscode://", ["win", "linux", "other"]],
  ["Open Claude desktop app", "claude code anthropic app", "claude://", ["win", "linux", "other"]],
  ["Open Microsoft Teams app", "teams msteams chat meeting app", "msteams:", ["win"]],
  ["Open Windows Settings", "settings control panel system preferences", "ms-settings:", ["win"]],
].filter((a) => a[3].includes(OS)).map(([l, k, url]) => [l, k, "", () => { location.href = url; }, "Desktop app"]);
let palRows = [], palSel = 0;
function palBuild(q) {
  q = q.trim(); const ql = q.toLowerCase(), terms = ql.split(/\s+/).filter(Boolean);
  const hit = (s) => terms.every((t) => s.toLowerCase().includes(t)), first = (s) => (s.toLowerCase().startsWith(ql) ? 0 : 1);
  const pick = (rows, n) => (q ? rows.filter((r) => hit(r.l + " " + (r.k || ""))).sort((a, b) => first(a.l) - first(b.l)) : rows).slice(0, n);
  const cmds = [...palCmds(), ...palApps()].map(([l, k, key, run, s]) => ({ ico: "›", l, k, s: s || (key ? `Press ${key}` : "Command"), run }));
  const projs = [{ ico: "#", l: "All projects", k: "project switch", s: "Project", run: () => { ui.proj = null; save(); render(); } },
    ...projects.map((p) => ({ ico: "#", l: p, k: "project switch go", s: "Project", run: () => { ui.proj = p; ui.addProj = p; save(); render(); } }))];
  const lks = links.map((l) => ({ html: ico(l), l: l.name, k: `${l.proj || ""} ${l.url}`, s: l.dock ? "Dock" : l.proj || "Pinned", run: (nt) => (nt ? window.open(l.url, "_blank") : (location.href = l.url)) }));
  const nts = saved.map((n) => ({ ico: "¶", l: n.title, k: n.body, s: "Note", run: () => { toggleNotes(true, true); cur = n.id; showNote(); $("#notesPanel").scrollIntoView({ behavior: "smooth" }); $("#notes").focus({ preventScroll: true }); } }));
  const tks = open().map((t) => ({ ico: "○", l: t.title, k: `${t.proj} ${t.tags.join(" ")} ${t.wait || ""}`, s: `Task · ${t.proj}`, run: () => { ui.editing = t.id; ui.when = "all"; render(); $("#cols").scrollIntoView({ behavior: "smooth" }); } }));
  const body = q.replace(/^(\+|add\s|task\s)\s*/i, ""), intent = body !== q, p = parse(body, 2), proj = ui.proj || projects[0];
  const add = p.title && { ico: "+", cls: "add", l: `Add task “${p.title}”`, s: `${p.wait ? "waiting on " + p.wait : proj}${p.p === 1 ? " · !1" : ""}`, run: () => {
    const t = { id: crypto.randomUUID(), title: p.title, p: p.p, proj, tags: p.tags, wait: p.wait, due: p.wait ? plus(today(), 2) : today(), rem: null, done: false, status: "todo", ord: Date.now() };
    tasks.push(t); save(); render();
    undoable(`Added “${t.title.slice(0, 32)}” to ${proj}`, () => { tasks = tasks.filter((x) => x !== t); });
  } };
  const ENG = [ // typed prefix -> where the rest of the line goes
    { n: "Google", ico: "G", re: /^(?:g|google)\s+/i, url: "https://www.google.com/search?q=", s: "Web search" },
    { n: "ChatGPT", ico: "✦", re: /^(?:(?:gpt|chatgpt|chat|ask)\s+|\?\s*)/i, url: "https://chatgpt.com/?q=", s: "Starts a new chat" },
    { n: "Claude", ico: "✦", re: /^(?:claude)\s+/i, url: "https://claude.ai/new?q=", s: "Starts a new chat" },
  ];
  const eng = (e, text) => ({ ico: e.ico, cls: "web", l: `${e.n === "Google" ? "Search Google for" : "Ask " + e.n}: ${text}`, s: e.s, run: (nt) => { const u = e.url + encodeURIComponent(text); nt ? window.open(u, "_blank") : (location.href = u); } });
  const pre = ENG.find((e) => e.re.test(q) && q.replace(e.re, "").trim()), webs = q ? ENG.map((e) => eng(e, q)) : [];
  if (!q) return [...pick(cmds, 7), ...lks.filter((r, i) => !ui.proj || links[i].proj === ui.proj).slice(0, 5)];
  const main = [...pick(cmds, 5), ...pick(projs, 3), ...pick(lks, 5)];
  if (pre) { const t = q.replace(pre.re, "").trim(); return [eng(pre, t), ...ENG.filter((e) => e !== pre).map((e) => eng(e, t))]; }
  return intent ? [add, ...main] : [...main, add, ...pick(nts, 3), ...pick(tks, 4), ...webs].filter(Boolean);
}
function palDraw() {
  $("#palList").innerHTML = palRows.map((r, i) => `<li class="${i === palSel ? "on" : ""} ${r.cls || ""}" data-i="${i}" role="option">${r.html || `<b class="pi">${esc(r.ico)}</b>`}<span>${esc(r.l)}</span><small>${esc(r.s)}</small></li>`).join("");
  $("#palList").children[palSel]?.scrollIntoView({ block: "nearest" });
}
function openPal() { if (zenOpen()) return; $("#pal").hidden = false; $("#palQ").value = ""; palSel = 0; palRows = palBuild(""); palDraw(); $("#palQ").focus(); }
const closePal = () => { document.activeElement?.blur?.(); $("#pal").hidden = true; };
function palRun(i, nt) { const r = palRows[i]; if (!r) return; closePal(); r.run(nt); }
$("#palQ").oninput = () => { palSel = 0; palRows = palBuild($("#palQ").value); palDraw(); };
$("#palQ").onkeydown = (e) => {
  e.stopPropagation();
  if (e.key === "Escape") { e.preventDefault(); closePal(); }
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); palSel = (palSel + (e.key === "ArrowDown" ? 1 : palRows.length - 1)) % (palRows.length || 1); palDraw(); }
  else if (e.key === "Enter") { e.preventDefault(); palRun(palSel, e.ctrlKey || e.metaKey); }
};
$("#palList").onmousedown = (e) => e.preventDefault();
$("#palList").onclick = (e) => { const li = e.target.closest("li"); if (li) palRun(+li.dataset.i, e.ctrlKey || e.metaKey); };
$("#pal").onmousedown = (e) => { if (e.target === $("#pal")) closePal(); };
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey) && !e.altKey) { e.preventDefault(); e.stopPropagation(); $("#pal").hidden ? openPal() : closePal(); } }, true);

/* ---------- automatic backup: background.js posts a daily export to the user's Discord webhook ---------- */
let hook = null; // { url, on, last, hash, err }; the URL is a secret, so it is never shown again or exported
const HOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const hookSay = (m) => ($("#hookMsg").textContent = m);
function hookUI() {
  const on = !!hook?.url; $("#hookUrl").placeholder = on ? "Webhook saved (hidden)" : "https://discord.com/api/webhooks/…";
  $("#hookOn").textContent = on ? "Replace" : "Turn on"; $("#hookNow").hidden = $("#hookOff").hidden = !on;
  hookSay(!on ? "" : hook.err ? `Last attempt failed: ${hook.err}` : hook.last ? `On. Last backup sent ${new Date(hook.last).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.` : "On. The first backup goes out shortly.");
}
async function hookNow() { // asks background.js to post a backup now; resolves { ok, msg }
  let r;
  if (!globalThis.chrome?.runtime?.sendMessage) r = { ok: false, msg: "This works in the installed extension only." };
  else {
    hookSay("Sending…");
    r = await chrome.runtime.sendMessage({ type: "backup-now" }).catch((e) => ({ ok: false, msg: `No answer from the extension's background worker (${e.message}). Reload Dayboard at chrome://extensions, then try again.` }));
  }
  hookSay(r.msg); return r;
}
$("#hookOn").onclick = async () => {
  const url = $("#hookUrl").value.trim(); if (!HOOK_RE.test(url)) return hookSay("That does not look like a Discord webhook URL.");
  hook = { url, on: true, hash: "", last: 0, err: "" }; $("#hookUrl").value = ""; await store.set({ hook }); hookUI(); await hookNow();
};
$("#hookNow").onclick = hookNow;
$("#hookOff").onclick = async () => { hook = null; await store.set({ hook: null }); hookUI(); hookSay("Removed. Delete the webhook in Discord too if you like."); };

/* ---------- quick backup button: save a file, or send to Discord, in one click ---------- */
let bkT;
function bkSay(m, err) { const el = $("#bkMsg"); el.textContent = m; el.classList.toggle("err", !!err); clearTimeout(bkT); bkT = setTimeout(bkInfo, 5000); }
function bkInfo() {
  $("#bkMsg").classList.remove("err");
  $("#bkMsg").textContent = !hook?.url ? "Discord is not set up yet." : hook.err ? `Last Discord attempt failed: ${hook.err}` : hook.last ? `Discord: last sent ${new Date(hook.last).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. It also goes out daily.` : "Discord is on. The first backup goes out shortly.";
}
function bkToggle(on = $("#bkPop").hidden) { $("#bkPop").hidden = !on; $("#bk").setAttribute("aria-expanded", on); if (on) { toggleSettings(false); storyClose(); wpToggle(false); bkInfo(); } }
$("#bk").onclick = () => bkToggle();
document.addEventListener("click", (e) => { if (!$("#bkPop").hidden && !e.target.closest("#bkPop, #bk")) bkToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#bkPop").hidden) bkToggle(false); });
const bkFlash = (b) => { b.classList.add("ok"); setTimeout(() => b.classList.remove("ok"), 2200); };
$("#bkFile").onclick = () => { exportBackup(); bkFlash($("#bkFile")); bkSay("Saved a backup file to your Downloads folder."); };
$("#bkHook").onclick = async () => {
  if (!hook?.url) { bkToggle(false); toggleSettings(true); $("#hookUrl").focus(); return; } // not set up: take them to the one field they need
  const b = $("#bkHook"); b.disabled = true; $("#gear").classList.add("busy"); bkSay("Sending to Discord…");
  const r = await hookNow(); b.disabled = false; $("#gear").classList.remove("busy");
  if (r.ok) bkFlash(b); bkSay(r.msg, !r.ok);
};

/* ---------- weather: the real sky over the chosen city, drawn on the background only (Open-Meteo, free, no key) ---------- */
const wxCv = $("#wx"), wxX = wxCv.getContext("2d"), still = matchMedia("(prefers-reduced-motion: reduce)");
let wxData = null, wxPrev = null, wxKind = "clear", wxRaf = 0, wxLast = 0, wxP = [], wxFlash = 0, wxNext = 0; // wxPrev: a preview picked from Spotlight (not saved)
const wxKindOf = (code, cloud) => [95, 96, 99].includes(code) ? "storm" : [65, 67, 82].includes(code) ? "heavy" : [61, 63, 66, 80, 81].includes(code) ? "rain" : code >= 51 && code <= 57 ? "drizzle"
  : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow" : code === 45 || code === 48 ? "mist" : cloud >= 60 ? "clouds" : "clear";
function wxSeed() {
  const W = wxCv.width = innerWidth, H = wxCv.height = innerHeight, rnd = Math.random;
  const n = { drizzle: 70, rain: 170, heavy: 280, storm: 280, snow: 100, mist: 6, clouds: 5 }[wxKind] || 0;
  wxP = Array.from({ length: n }, () => wxKind === "mist" || wxKind === "clouds" ? { x: rnd() * W, y: (wxKind === "mist" ? .35 + rnd() * .6 : rnd()) * H, r: (.25 + rnd() * .3) * W, v: (6 + rnd() * 10) * (rnd() < .5 ? -1 : 1), a: .5 + rnd() * .5 }
    : wxKind === "snow" ? { x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 2, v: 25 + rnd() * 30, ph: rnd() * 6.28 }
    : { x: rnd() * (W + 150), y: rnd() * H, l: (wxKind === "drizzle" ? 8 : 12) + rnd() * 14, v: (wxKind === "drizzle" ? 520 : 760) + rnd() * 480 });
}
function wxFrame(t) {
  wxRaf = 0; if (document.hidden || wxKind === "clear") return;
  const dt = Math.min((t - wxLast) / 1e3 || 0, .05), W = wxCv.width, H = wxCv.height, x = wxX; wxLast = t; x.clearRect(0, 0, W, H);
  if (wxKind === "mist" || wxKind === "clouds") { // soft light drifts (mist) or soft cloud shadows (clouds)
    const rgb = wxKind === "mist" ? "235,240,245" : "0,0,0", a0 = wxKind === "mist" ? .1 : .14;
    for (const p of wxP) {
      p.x += p.v * dt; if (p.x > W + p.r) p.x = -p.r; else if (p.x < -p.r) p.x = W + p.r;
      const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(${rgb},${a0 * p.a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
  } else if (wxKind === "snow") {
    x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath();
    for (const p of wxP) { p.y += p.v * dt; p.ph += dt; const px = p.x + Math.sin(p.ph) * 14; x.moveTo(px + p.r, p.y); x.arc(px, p.y, p.r, 0, 6.28); if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; } }
    x.fill();
  } else { // rain: thin slanted streaks
    x.strokeStyle = wxKind === "drizzle" ? "rgba(215,228,255,.2)" : "rgba(215,228,255,.28)"; x.lineWidth = 1; x.beginPath();
    for (const p of wxP) {
      x.moveTo(p.x, p.y); x.lineTo(p.x - p.l * .18, p.y + p.l); p.y += p.v * dt; p.x -= p.v * dt * .18;
      if (p.y > H) { p.y = -p.l; p.x = Math.random() * (W + 150); }
    }
    x.stroke();
    if (wxKind === "storm") { // a rare, soft flash far away
      if (t > wxNext) { wxFlash = .09; wxNext = t + 9e3 + Math.random() * 14e3; }
      if (wxFlash > .004) { x.fillStyle = `rgba(235,240,255,${wxFlash})`; x.fillRect(0, 0, W, H); wxFlash *= .93; }
    }
  }
  wxRaf = requestAnimationFrame(wxFrame);
}
function wxStart() {
  cancelAnimationFrame(wxRaf); wxRaf = 0;
  wxKind = prefs.wx === "off" || still.matches ? "clear" : wxPrev || (wxData ? wxKindOf(wxData.code, wxData.cloud) : "clear");
  if (wxKind === "clear") { wxCv.width = wxCv.height = 0; return; } // no sky effect: no pixels held
  wxCv.width = innerWidth; wxCv.height = innerHeight; // resizing also clears the last frame
  wxSeed(); wxNext = performance.now() + 4e3; wxRaf = requestAnimationFrame(wxFrame);
}
function wxShow(kind) { wxPrev = kind; if (prefs.wx === "off" && kind) { prefs.wx = "on"; save(); syncPrefsUI(); } wxStart(); }
/* what the sky is doing, in words and a small line icon; temperatures in C or F (follows your region until you choose) */
const WXI = { clear: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>', night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  partly: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.95A4.8 4.8 0 0 0 9 13.5 3.25 3.25 0 0 0 9 20z"/>', clouds: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5 4.25 4.25 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>', storm: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M12.5 14l-2.5 4h3l-2 4"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01" stroke-width="2.4"/>', mist: '<path d="M4 9h16M6 13h12M4 17h16"/>' };
const wxIcon = (code, day = true, s = 16) => { const k = code <= 1 ? (day ? "clear" : "night") : code === 2 ? "partly" : code === 3 ? "clouds" : code === 45 || code === 48 ? "mist" : code >= 95 ? "storm" : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow" : "rain"; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WXI[k]}</svg>`; };
const wxWords = (c) => ({ 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" })[c] || "Clear";
const useF = () => (prefs.units || (/^America\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone) && /^en-US/.test(navigator.language) ? "f" : "c")) === "f";
const deg = (c) => (c == null ? "–" : Math.round(useF() ? c * 9 / 5 + 32 : c) + "°");
const wxKm = (k) => (useF() ? `${Math.round(k * .621)} mph` : `${Math.round(k)} km/h`);
const wxDay = (k) => wxData?.daily?.[k];
function renderWx() {
  const w = wxData, chip = $("#wxChip"); if (!w?.v) return void (chip.hidden = true);
  chip.innerHTML = `${wxIcon(w.code, w.day)}<span>${deg(w.temp)}</span>`; chip.hidden = false; chip.title = `${wxWords(w.code)}, ${deg(w.temp)}`;
  if (!$("#wxPop").hidden) drawWx(); if (!$("#cal").hidden) drawCal();
}
function drawWx() {
  const w = wxData; if (!w?.v) return;
  const hrs = (w.hours || []).filter((_, i) => i % 2 === 0).slice(0, 6), days = Object.entries(w.daily || {}).slice(1, 6), td = w.daily?.[Object.keys(w.daily || {})[0]];
  const hh = (s) => hhmm(new Date(s).getTime());
  $("#wxPop").innerHTML = `<div class="mphead"><span class="wxbig">${wxIcon(w.code, w.day, 44)}</span><div><h3>${deg(w.temp)} · ${esc(wxWords(w.code))}</h3><p>Feels ${deg(w.feels)}${td ? ` · ${deg(td.hi)} / ${deg(td.lo)}` : ""}</p></div></div>`
    + `<div class="mprow"><span><small>Rain</small><b class="mono">${w.rain != null ? w.rain + "%" : "–"}</b></span><span><small>Humidity</small><b class="mono">${w.hum ?? "–"}%</b></span><span class="r"><small>Wind</small><b class="mono">${wxKm(w.wind ?? 0)}</b></span></div>`
    + (hrs.length ? `<div class="wxhrs">${hrs.map((x, i) => `<span><small>${i ? hh(x.t) : "Now"}</small>${wxIcon(x.c, x.d, 18)}<b>${deg(x.T)}</b></span>`).join("")}</div>` : "")
    + (days.length ? `<ul class="wxdays">${days.map(([k, v]) => `<li><span>${new Date(k + "T00:00").toLocaleDateString(undefined, { weekday: "short" })}</span>${wxIcon(v.c, true, 16)}<small>${v.p >= 30 ? v.p + "%" : ""}</small><b>${deg(v.hi)}</b><i>${deg(v.lo)}</i></li>`).join("")}</ul>` : "");
}
function wxToggle(on = $("#wxPop").hidden) { if (on) drawWx(); $("#wxPop").hidden = !on; $("#wxChip").setAttribute("aria-expanded", on); }
$("#wxChip").onclick = (e) => { e.stopPropagation(); wxToggle(); };
document.addEventListener("click", (e) => { if (!$("#wxPop").hidden && !e.target.closest("#wxPop, #wxChip")) wxToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#wxPop").hidden) { wxToggle(false); $("#wxChip").focus(); } });
const wxApply = () => { wxStart(); renderWx(); };
async function wxFetch() {
  const P = place(); let stale = null;
  try { const c = JSON.parse(localStorage["dayboard:wx"]); if (c.v === 2 && c.city === P.name) { stale = c; if (Date.now() - c.t < 18e5) { wxData = c; return wxApply(); } } } catch {}
  try {
    const q = `latitude=${P.lat}&longitude=${P.lon}&timezone=auto&forecast_days=8&forecast_hours=14&current=temperature_2m,apparent_temperature,weather_code,cloud_cover,relative_humidity_2m,wind_speed_10m,is_day`
      + `&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(10000) }).then((x) => x.json()), c = r.current, d = r.daily;
    wxData = { v: 2, city: P.name, t: Date.now(), code: c.weather_code, cloud: c.cloud_cover, temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m, wind: c.wind_speed_10m, day: !!c.is_day, rain: d.precipitation_probability_max?.[0] ?? null,
      hours: r.hourly.time.map((t, i) => ({ t, T: r.hourly.temperature_2m[i], c: r.hourly.weather_code[i], d: !!r.hourly.is_day[i] })),
      daily: Object.fromEntries(d.time.map((k, i) => [k, { c: d.weather_code[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], p: d.precipitation_probability_max[i] }])) };
    try { localStorage["dayboard:wx"] = JSON.stringify(wxData); } catch {}
  } catch { if (stale) wxData = stale; } // offline: keep the last sky
  wxApply();
}
addEventListener("resize", () => { clearTimeout(wxRz); wxRz = setTimeout(wxStart, 250); }); let wxRz;
document.addEventListener("visibilitychange", () => { if (!document.hidden && wxKind !== "clear" && !wxRaf) wxRaf = requestAnimationFrame(wxFrame); });
wxFetch(); setInterval(wxFetch, 18e5);

/* ---------- the story behind the picture: Met record -> Wikidata -> Wikipedia, fetched once and kept ---------- */
const MET_ID = {"DP-30758-001":437394,"DT82":10154,"DP-43051-001":437372,"DT78":10481,"DP-19299-001":437826,"DP-12550-001":10497,"DP-24049-001":435728,"DT208249":10500,"DP353257":437881,"DP-12799-001":10499,"DP119115":435809,"DP130999":437980,"DP-687-001":435844,"DP-42549-001":436535,"DP-14286-015":436838,"DP-13360-001":437854,"DP349564":436575,"77J_045R2M":435878,"DP167124":437891,"DP164837":435922,"DP-29324-001":437329,"DT1859":437299,"DP267397":459016,"DT84":11311,"DP141042":39799,"ap1970.58":10796};
const storyEl = $("#story");
const sj = (u) => fetch(u, { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
async function storyData(stem, metId) {
  let cache = {}; try { cache = JSON.parse(localStorage["dayboard:story"] || "{}"); } catch {}
  if (cache[stem]) return cache[stem];
  const metGet = () => sj(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${metId}`);
  const o = await metGet().catch(() => new Promise((r) => setTimeout(r, 1200)).then(metGet)), d = { met: o.objectURL, medium: o.medium, dims: (o.dimensions || "").split(" (")[0], gallery: o.GalleryNumber, credit: o.creditLine };
  const q = (o.objectWikidata_URL || "").split("/").pop();
  try {
    if (q) {
      const t = (await sj(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${q}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`)).entities[q]?.sitelinks?.enwiki?.title;
      if (t) { const s = await sj("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t.replace(/ /g, "_"))); d.text = s.extract; d.wiki = s.content_urls?.desktop?.page; }
    }
  } catch {} // no article, or Wikipedia is busy: the Met facts are still worth showing
  cache[stem] = d; try { localStorage["dayboard:story"] = JSON.stringify(cache); } catch {}
  return d;
}
const trimText = (t = "") => (t.length < 520 ? t : t.slice(0, 520).replace(/[^.!?]*$/, "").trim() || t.slice(0, 520) + "…");
async function storyOpen() {
  const a = artNow; if (!a) return;
  const stem = (a.src.match(/\/([^/]+)\.jpg$/) || [])[1], head = `<h3>${esc(a.title)}</h3><p class="stby">${esc(a.credit || [a.artist, a.date].filter(Boolean).join(", "))}</p>`;
  storyEl.hidden = false; $("#capBtn").setAttribute("aria-expanded", "true");
  if (a.src.startsWith("mine:")) { storyEl.innerHTML = head + `<p class="stx">One of your own pictures.</p>`; return; }
  const metId = MET_ID[stem] || a.id, skey = MET_ID[stem] ? stem : "id" + a.id;
  if (!metId) { storyEl.innerHTML = head + `<p class="stx">A photograph from Wikimedia Commons, chosen from its featured pictures.</p>`; return; }
  storyEl.innerHTML = head + `<p class="stx">Looking it up…</p>`;
  let d; try { d = await storyData(skey, metId); } catch { if (artNow === a) storyEl.innerHTML = head + `<p class="stx">The story could not be loaded just now. Check your connection and try again.</p>`; return; }
  if (artNow !== a || storyEl.hidden) return;
  const facts = [d.medium, d.dims, d.gallery ? `On view in Gallery ${d.gallery}` : "Not on view right now"].filter(Boolean).join(" · ");
  storyEl.innerHTML = head + (d.text ? `<p class="stx">${esc(trimText(d.text))}</p>` : "") + `<p class="stm">${esc(facts)}${d.credit ? `<br>${esc(d.credit)}` : ""}</p>`
    + `<p class="stl">${d.wiki ? `<a href="${esc(d.wiki)}" target="_blank" rel="noopener">Read more</a>` : ""}<a href="${esc(d.met)}" target="_blank" rel="noopener">See it at the Met</a></p>`;
}
function storyClose() { storyEl.hidden = true; $("#capBtn").setAttribute("aria-expanded", "false"); }
$("#capBtn").onclick = () => { if (!storyEl.hidden) return storyClose(); bkToggle(false); toggleSettings(false); wpToggle(false); storyOpen(); };
document.addEventListener("click", (e) => { if (!storyEl.hidden && !e.target.closest("#story, #capBtn")) storyClose(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !storyEl.hidden) storyClose(); });

/* ---------- wallpaper picker: browse every picture, tap one to set it, heart the ones you love, add your own ---------- */
const wpEl = $("#wpPop"), thumbOf = (s) => s.replace(/\/\d+px-([^/?]+)(\?.*)?$/, "/330px-$1$2"); // Commons only serves standard widths, 330px is one; the Met's web-large is already small
let wpT, wpList = [];
const HEART = '<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.7-9.4-9.4C1.2 7.7 3.2 4.5 6.6 4.5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.4 0 5.4 3.2 4 6.6-1.9 4.7-9.4 9.4-9.4 9.4z"/></svg>';
const isNew = (it) => it[6] && Date.now() - it[6] < 8 * 864e5;
const isFav = (src) => favs().some((f) => f[0] === src);
function wpSay(m, err) { const el = $("#wpMsg"); el.textContent = m; el.classList.toggle("err", !!err); clearTimeout(wpT); wpT = setTimeout(() => (el.textContent = ""), 5000); }
function wpMark() {
  document.querySelectorAll("#wpGrid .wpt").forEach((b) => { const on = artNow && wpList[+b.dataset.i]?.[0] === artNow.src; b.classList.toggle("on", !!on); b.setAttribute("aria-selected", !!on); });
  document.querySelectorAll("#wpGrid .wph").forEach((b) => { const on = isFav(wpList[+b.dataset.i]?.[0]); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  $("#wpName").textContent = artNow ? `${artNow.title} · ${artNow.credit || artNow.artist}${pin ? " · pinned" : ""}` : "";
  $("#wpFav").setAttribute("aria-pressed", !!artNow && isFav(artNow.src)); $("#wpFav").disabled = !artNow;
  $("#wpNext span").textContent = pin ? "Resume rotation" : "Another";
  document.querySelectorAll("#wpArt [data-v]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === prefs.art));
}
function wpRender() {
  wpList = pool(); $("#wpBar").hidden = prefs.art !== "mine";
  const none = (m) => { $("#wpGrid").innerHTML = `<p class="wpnone">${m}</p>`; wpMark(); };
  if (prefs.art === "photos" && !photos.length) return none("Nature photos load once a day. One moment…");
  if (prefs.art === "mine" && !mine.length) return none(mineReady ? "Add your own pictures: a place you love, a photo you took. They stay in this browser only." : "Loading your pictures…");
  if (prefs.art === "favs" && !favs().length) return none("Tap the heart on any wallpaper and it lands here. Rotation then uses only these.");
  $("#wpGrid").innerHTML = wpList.map(([src, title, artist, , credit], i) => `<div class="wpc"><button type="button" class="wpt" data-i="${i}" role="option" title="${esc(title)} · ${esc(credit || artist)}"><img loading="lazy" decoding="async" alt="" src="${esc(thumbOf(urlOf(src) || ""))}"><span>${esc(title)}</span>${isNew(wpList[i]) ? "<em class=\"wpnew\">New</em>" : ""}</button><button type="button" class="wph" data-i="${i}" aria-label="Favourite" title="Favourite">${HEART}</button>${src.startsWith("mine:") ? `<button type="button" class="wpx" data-i="${i}" aria-label="Remove this picture" title="Remove">×</button>` : ""}</div>`).join("");
  wpMark();
}
function toggleFav(item) { // a favourite keeps the whole entry, so a nature photo stays even after the daily set changes
  if (!item) return;
  prefs.favs = isFav(item[0]) ? favs().filter((f) => f[0] !== item[0]) : [...favs(), item];
  save(); if (prefs.art === "favs" && !prefs.favs.length) { wpRender(); applyArt(); } else if (prefs.art === "favs") wpRender(); else wpMark();
}
function wpToggle(on = wpEl.hidden) {
  wpEl.hidden = !on; $("#wp").setAttribute("aria-expanded", on);
  if (!on) return void $("#wpGrid").replaceChildren(); // the thumbnails are decoded pictures: let them go
  toggleSettings(false); bkToggle(false); storyClose(); $("#wpMsg").textContent = ""; wpRender();
  if (prefs.art === "photos" && !photos.length) loadPhotos().then(() => { applyArt(); wpRender(); }).catch(() => {});
  setTimeout(() => $("#wpGrid .wpt.on")?.scrollIntoView({ block: "center" }), 50);
}
function wpSave() {
  const a = artNow; if (!a) return wpSay("Nothing to save yet.", true);
  const clean = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
  if (a.src.startsWith("mine:")) { const l = document.createElement("a"); l.href = urlOf(a.src); l.download = `${clean(a.title)}.jpg`; l.click(); return wpSay("Saved."); }
  const url = a.src.replace("/web-large/", "/original/"), name = `Dayboard/${clean(a.title)}${a.artist ? " - " + clean(a.artist) : ""}.jpg`;
  if (!globalThis.chrome?.downloads) { window.open(url, "_blank"); return wpSay("Opened the full picture. Right-click to save it."); }
  chrome.downloads.download({ url, filename: name, conflictAction: "uniquify" }, (id) => wpSay(id === undefined ? "Chrome could not save it. Try again." : "Saving to Downloads / Dayboard…", id === undefined));
}
/* your own pictures live in IndexedDB (shrunk to 2560px), so they never leave this browser */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("dayboard", 1); r.onupgradeneeded = () => r.result.createObjectStore("pics", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbDo = (mode, fn) => idb().then((db) => new Promise((res, rej) => { const t = db.transaction("pics", mode), q = fn(t.objectStore("pics")); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }));
const mineSync = () => (mine = Object.values(mineRec).sort((a, b) => a.ts - b.ts).map((r) => ["mine:" + r.id, r.name, "", "", "Your picture"]));
function mineAdd(rec) { mineRec[rec.id] = rec; mineUrl[rec.id] = mineUrl[rec.id] || URL.createObjectURL(rec.blob); mineSync(); }
function mineAfter() { // a picture of yours may be what should be showing
  if (pin?.[0].startsWith("mine:")) show(0, true, 0, pin); else if (prefs.art === "mine" || prefs.art === "favs") show(wi, true);
  if (!wpEl.hidden) wpRender();
}
idbDo("readonly", (s) => s.getAll()).then((all) => { all.forEach(mineAdd); mineReady = true; mineAfter(); }).catch(() => { mineReady = true; });
async function picsAdd(files) {
  const list = [...files].filter((f) => f.type.startsWith("image/")); if (!list.length) return wpSay("Those are not pictures.", true);
  if (mine.length + list.length > 40) return wpSay("That is a lot. Keep it to 40 pictures.", true);
  let n = 0; wpSay("Adding…");
  for (const f of list) {
    try {
      const bmp = await createImageBitmap(f), k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9)), rec = { id: crypto.randomUUID(), name: f.name.replace(/\.[^.]+$/, "").slice(0, 48) || "My picture", blob, ts: Date.now() + n };
      await idbDo("readwrite", (s) => s.put(rec)); mineAdd(rec); n++;
    } catch {}
  }
  wpRender(); wpSay(n ? `Added ${n} picture${n === 1 ? "" : "s"}.` : "Could not read those files.", !n);
  if (n && prefs.art === "mine") applyArt();
}
function mineRemove(src) {
  const id = src.slice(5), rec = mineRec[id], was = favs().find((f) => f[0] === src); if (!rec) return;
  delete mineRec[id]; mineSync();
  idbDo("readwrite", (s) => s.delete(id)); if (pin?.[0] === src) unpin(); if (was) { prefs.favs = favs().filter((f) => f[0] !== src); save(); }
  wpRender(); undoable(`Removed “${rec.name.slice(0, 28)}”`, () => { mineAdd(rec); idbDo("readwrite", (s) => s.put(rec)); if (was) { prefs.favs = [...favs(), was]; save(); } wpRender(); });
}
$("#wp").onclick = () => wpToggle();
$("#wpArt").onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) setArt(b.dataset.v); };
// extension pages forbid inline handlers, and load/error do not bubble: listen in the capture phase
$("#wpGrid").addEventListener("load", (e) => e.target.classList?.add("ok"), true);
$("#wpGrid").addEventListener("error", (e) => e.target.closest?.(".wpc")?.remove(), true);
$("#wpGrid").onclick = (e) => {
  const i = e.target.closest("[data-i]")?.dataset.i, item = wpList[+i]; if (!item) return;
  if (e.target.closest(".wph")) return toggleFav(item);
  if (e.target.closest(".wpx")) return mineRemove(item[0]);
  pin = item; try { localStorage["dayboard:pin"] = JSON.stringify(item); } catch {}
  show(0, false, 0, item); wpSay("Set. It stays until you pick another or resume rotation.");
};
$("#wpFav").onclick = () => artNow && toggleFav(wpList.find((w) => w[0] === artNow.src) || pool().find((w) => w[0] === artNow.src) || [artNow.src, artNow.title, artNow.artist, artNow.date, artNow.credit || "", artNow.id]);
$("#wpAdd").onclick = () => $("#wpFile").click();
$("#wpFile").onchange = (e) => { picsAdd(e.target.files); e.target.value = ""; };
wpEl.addEventListener("dragover", (e) => { e.preventDefault(); wpEl.classList.add("drop"); });
wpEl.addEventListener("dragleave", (e) => { if (!wpEl.contains(e.relatedTarget)) wpEl.classList.remove("drop"); });
wpEl.addEventListener("drop", (e) => { e.preventDefault(); wpEl.classList.remove("drop"); picsAdd(e.dataTransfer.files); });
$("#wpSave").onclick = wpSave;
$("#wpNext").onclick = () => { next(); setTimeout(wpMark, 800); }; // next() also lifts a pinned wallpaper; not refresh.click(): that synthetic click would count as "outside" and close this panel
// composedPath, not target.closest: the grid redraws during a click (remove, un-heart), which detaches the clicked button before this runs
document.addEventListener("click", (e) => { if (!wpEl.hidden && !e.composedPath().some((n) => ["wpPop", "wp", "undo"].includes(n.id))) wpToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !wpEl.hidden) wpToggle(false); });

/* ---------- the corner menu: one icon, everything else behind it ---------- */
const menuEl = $("#menu");
function menuToggle(on = menuEl.hidden) {
  menuEl.hidden = !on; $("#gear").setAttribute("aria-expanded", on);
  if (on) { toggleSettings(false); bkToggle(false); wpToggle(false); storyClose(); menuEl.querySelector(".mrow")?.focus({ preventScroll: true }); }
}
$("#gear").onclick = () => menuToggle();
$("#prefsBtn").onclick = () => toggleSettings(true);
menuEl.addEventListener("click", (e) => { if (e.target.closest(".mrow")) menuToggle(false); }); // after the row's own action has run
document.addEventListener("click", (e) => { if (!menuEl.hidden && !e.target.closest("#menu, #gear")) menuToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menuEl.hidden) { menuToggle(false); $("#gear").focus(); } });

/* ---------- look closer: the picture slowly moves in on a detail, the interface steps aside ---------- */
const LOOK = {"DP-30758-001":[[53,33,"Aristotle, lost in thought, lit from the side."],[20,41,"His hand rests on the bust of Homer."]],"DT82":[[61,70,"A waterfall tumbles into the still lake."],[88,82,"A camp of tepees and figures by the water."]],"DP-43051-001":[[47,60,"The child, held in his mother's arm."],[51,14,"God the Father, above, raises a hand."]],"DT78":[[58,78,"A waterfall catching the light."],[15,30,"A snow-capped peak glows in the distance."]],"DP-19299-001":[[17,36,"A small cupid, half asleep in the corner."],[9,16,"A quiver of arrows hangs in the shadows."]],"DP-12550-001":[[64,76,"The river bends in a great oxbow."],[23,22,"A storm clears over the valley."],[15,55,"A bare, shattered tree leans over the slope."]],"DP-24049-001":[[49,27,"Palm fronds rise behind the altar."],[66,36,"A red lamp hangs above."],[55,57,"The priest offers the wafer."]],"DT208249":[[73,17,"A ruined tower, wrapped in ivy."],[57,64,"An old aqueduct crosses the plain."],[24,36,"Mountains dissolve into cloud."]],"DP353257":[[45,32,"A white linen cap catches the window light."],[68,63,"Her hand rests on a brass pitcher."]],"DP-12799-001":[[62,27,"Tiny sails and buildings on the water inside the cup."],[88,45,"Water spills over the rim."]],"DP119115":[[66,80,"Harvesters rest and eat in the shade."],[19,74,"Reapers swing their scythes through the wheat."],[25,38,"A distant bay and village beyond the fields."]],"DP130999":[[86,11,"A crescent moon among swirling clouds."],[45,40,"Thick brushstrokes shape the cypress."],[30,88,"Wild flowers in the foreground, in thick paint."]],"DP-687-001":[[41,17,"The lute player's gaze meets yours."],[24,65,"A lute, held in warm light."],[57,66,"A page of handwritten music."]],"DP-42549-001":[[84,45,"Dark cypresses flame up from the field."],[32,22,"Clouds thick with paint."],[35,82,"A field of ripe wheat."]],"DP-14286-015":[[78,20,"The fortune-teller's lined face under a white turban."],[57,52,"A palm held out to be read."],[35,20,"A young man in a lace collar."]],"DP-13360-001":[[52,50,"A ship dissolves into the mist."],[24,66,"A dark shape breaks the swell."]],"DP349564":[[68,32,"The cathedral spire rises from the town."],[62,12,"Storm clouds break over the city."],[38,60,"A bridge reaches toward the town."]],"77J_045R2M":[[46,18,"Mont Sainte-Victoire, built from patches of blue."],[40,62,"A small farmhouse among the fields."]],"DP167124":[[80,55,"A grey horse bows its head."],[93,83,"A winged cupid in the corner."],[70,12,"Autumn leaves frame the scene."]],"DP164837":[[60,30,"The cathedral spire reaches into the clouds."],[76,83,"Cows cool off in the water."],[13,77,"Two small figures in the grounds."]],"DP-29324-001":[[13,18,"A figure in a red cloak watches from the steps."],[37,86,"A small child crawls through the chaos."],[22,50,"A woman in blue, swept off her feet."]],"DT1859":[[36,58,"White houses sit on the hillside."],[59,72,"A figure in white stands on the sunlit path."],[60,10,"Clouds build above the hills."]],"DP267397":[[35,52,"An angel arrives, wings still open."],[75,50,"Mary bows her head, hands crossed."],[48,35,"Light from a small arched window."]],"DT84":[[20,63,"A wooded island rests on still water."],[68,38,"Mountains soften into haze."],[34,66,"A tiny islet far out on the water."]],"DP141042":[[62,69,"Mount Fuji, small and calm, beyond the wave."],[47,30,"Foam fingers curl at the crest."],[13,68,"A boat rides the swell."]],"ap1970.58":[[45,74,"Cattle wander down a sunlit track."],[66,22,"A great tree gathers the light."],[22,58,"A distant lake fades into pale hills."]]};
const LOOK_Z = 2.4;
let lookOn = false, lookN = -1, lookT, lookEnd;
function lookSpot() { // the next detail as viewport pixels, plus its caption; nature photos and your own pictures get a quiet drift to a third of the frame
  const a = artNow, img = [...document.querySelectorAll("#art .paint")].pop(); if (!a || !img?.naturalWidth) return null;
  const stem = (a.src.match(/\/([^/]+)\.jpg$/) || [])[1], list = LOOK[stem];
  lookN = (lookN + 1) % (list ? list.length : 4);
  const [px, py, cap] = list ? list[lookN] : [[33, 36], [67, 36], [33, 66], [67, 66]][lookN].concat("");
  const W = innerWidth, H = innerHeight, s = Math.max(W / img.naturalWidth, H / img.naturalHeight); // object-fit: cover
  const vx = px / 100 * img.naturalWidth * s - (img.naturalWidth * s - W) / 2, vy = py / 100 * img.naturalHeight * s - (img.naturalHeight * s - H) / 2;
  const ox = Math.min(Math.max(vx, W * .1), W * .9), oy = Math.min(Math.max(vy, H * .1), H * .9), z = LOOK_Z - 1;
  const tx = Math.min(Math.max(W / 2 - ox, -(W - ox) * z), ox * z), ty = Math.min(Math.max(H / 2 - oy, -(H - oy) * z), oy * z); // never reveal the edge of the picture
  return { ox, oy, tx, ty, cap };
}
function lookGo() {
  const s = lookSpot(); if (!s) return lookStop();
  const art = $("#art"), cap = $("#lookCap"); cap.classList.remove("on"); clearTimeout(lookT); clearTimeout(lookEnd);
  art.style.transition = "transform 7s cubic-bezier(.3,.05,.2,1)"; art.style.transformOrigin = `${s.ox}px ${s.oy}px`; art.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${LOOK_Z})`;
  lookT = setTimeout(() => { cap.innerHTML = `${s.cap ? esc(s.cap) : ""}<small>${s.cap ? "" : esc(artNow.title) + " · "}Esc to return · L for another</small>`; cap.classList.add("on"); }, 5500);
  lookEnd = setTimeout(lookStop, 45e3); // it always comes back by itself
}
function lookStart() {
  if (lookOn || zenOpen() || !artNow) return; lookOn = true; lookN = -1;
  ["#menu", "#wpPop", "#bkPop", "#story", "#settings"].forEach((s) => { $(s).hidden = true; });
  document.body.classList.add("looking"); lookGo();
}
function lookStop() {
  if (!lookOn) return; lookOn = false; clearTimeout(lookT); clearTimeout(lookEnd);
  const art = $("#art"); $("#lookCap").classList.remove("on"); document.body.classList.remove("looking");
  art.style.transition = "transform 2.6s cubic-bezier(.3,.05,.2,1)"; art.style.transform = "none";
  setTimeout(() => { if (!lookOn) { art.style.transition = ""; art.style.transformOrigin = ""; } }, 2700);
}
addEventListener("keydown", (e) => {
  if (lookOn) { // the picture has the keyboard
    e.preventDefault(); e.stopPropagation();
    if (e.key.toLowerCase() === "l" || e.key === "ArrowRight") lookGo(); else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length < 12 && !/^(Shift|Control|Alt|Meta)$/.test(e.key)) lookStop();
    return;
  }
  if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && !zenOpen()) { e.preventDefault(); lookStart(); }
}, true);
document.addEventListener("click", () => { if (lookOn) lookStop(); }, true);
$("#lookBtn").onclick = () => setTimeout(lookStart, 60); // let the menu close first
addEventListener("resize", () => { if (lookOn) lookStop(); });

/* ---------- open the day: one slow breath, one line about how you want today to feel, one thing ---------- */
let oStep = 1, oPick = null;
function renderIntent() {
  const t = prefs.intent?.day === today() ? prefs.intent.text : "";
  $("#intent").hidden = !t; $("#intent").textContent = t ? `Today: ${t}` : "";
}
function oShow(n) {
  oStep = n; document.querySelectorAll("#openday .rstep").forEach((s) => (s.hidden = +s.dataset.s !== n));
  document.querySelectorAll("#openday .rdots i").forEach((d, i) => d.classList.toggle("on", i < n));
  if (n === 1) { const b = $("#openday .obreath"); b.style.animation = "none"; b.offsetWidth; b.style.animation = ""; $("#openday [data-s='1'] .solid").focus(); }
  else if (n === 2) $("#oIntent").focus(); else $("#oNew").focus();
}
function openDay() {
  if (!$("#openday").hidden) return;
  try { localStorage["dayboard:opened"] = today(); } catch {} // shown at most once a day, even if skipped
  oPick = null; $("#oNew").value = ""; $("#oIntent").value = prefs.intent?.day === today() ? prefs.intent.text : "";
  const h = new Date().getHours(); $("#oGreet").textContent = h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
  const rank = (t) => (t.status === "doing" ? 0 : t.focus ? 1 : t.due && t.due <= today() ? 2 : 3);
  const cands = tasks.filter((t) => !t.done && !t.wait && (!ui.proj || t.proj === ui.proj)).sort((a, b) => rank(a) - rank(b) || byOrd(a, b)).slice(0, 6);
  $("#oPick").innerHTML = cands.length ? cands.map((t) => `<li><button type="button" class="ritem" data-id="${t.id}" aria-pressed="${t.focusFor === today()}"><span>${esc(t.title)}</span><small>${esc(t.proj)}</small></button></li>`).join("") : `<li class="rnone">Nothing queued yet. Write one below, or begin without.</li>`;
  oPick = cands.find((t) => t.focusFor === today())?.id || null;
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: place().tz }).format(Date.now()).split("-").map(Number), set = sunTimes(y, m - 1, d)[1];
  $("#oGold").textContent = Date.now() < set ? `Golden hour begins around ${hhmm(set - 18e5)}. Sunset is at ${hhmm(set)}.` : "";
  ["#menu", "#wpPop", "#bkPop", "#story", "#settings"].forEach((s) => { $(s).hidden = true; });
  $("#openday").hidden = false; document.body.classList.add("sorting"); oShow(1);
}
function closeOpenDay() { $("#openday").hidden = true; document.body.classList.remove("sorting"); }
function oFinish(withOne) {
  const intent = $("#oIntent").value.trim();
  prefs.intent = intent ? { day: today(), text: intent } : null;
  if (withOne) {
    const typed = $("#oNew").value.trim(); let t = null;
    if (typed) { const q = parse(typed, 2); t = { id: crypto.randomUUID(), title: q.title || typed, p: q.p, proj: ui.proj || ui.addProj || projects[0], tags: q.tags, wait: null, due: today(), rem: null, done: false, status: "todo", ord: Date.now() }; tasks.push(t); }
    else if (oPick) t = tasks.find((x) => x.id === oPick);
    if (t) { tasks.forEach((x) => x !== t && x.focusFor === today() && delete x.focusFor); t.focusFor = today(); if (!t.due || t.due > today()) t.due = today(); }
  }
  save(); render(); closeOpenDay();
}
$("#openday").onclick = (e) => {
  const b = e.target.closest("[data-o]"); if (!b) return;
  ({ skip: () => closeOpenDay(), next: () => oShow(oStep + 1), back: () => oShow(oStep - 1), skip3: () => oFinish(false), go: () => oFinish(true) })[b.dataset.o]?.();
};
$("#oPick").onclick = (e) => {
  const b = e.target.closest(".ritem"); if (!b) return; const on = b.getAttribute("aria-pressed") !== "true";
  document.querySelectorAll("#oPick .ritem").forEach((x) => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", on); oPick = on ? b.dataset.id : null; if (on) $("#oNew").value = "";
};
$("#oNew").oninput = () => { if ($("#oNew").value) { oPick = null; document.querySelectorAll("#oPick .ritem").forEach((x) => x.setAttribute("aria-pressed", "false")); } };
$("#oIntent").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); oShow(3); } };
$("#oNew").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); oFinish(true); } };
$("#openX").onclick = closeOpenDay;
$("#openDayBtn").onclick = () => setTimeout(openDay, 60);
$("#intent").onclick = () => { openDay(); oShow(2); };
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "o" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && !zenOpen() && $("#openday").hidden) { e.preventDefault(); openDay(); } });
// the first tab of a morning offers it once; a minute after load, never over something you are doing
setTimeout(() => {
  let seen = ""; try { seen = localStorage["dayboard:opened"] || ""; } catch {}
  const h = new Date().getHours();
  if (prefs.openDay !== "off" && seen !== today() && h >= 4 && h < 12 && !zenOpen() && !document.body.classList.contains("zen") && !typingNow()) openDay();
}, 1800);

/* ---------- the weekly fetch: ~two dozen new public-domain landscape paintings from the Met, kept in a library of up to 300 ---------- */
const THEMES = ["landscape", "river", "sea", "mountain", "garden", "sunset", "village", "forest", "winter", "harbor", "pasture", "sky", "lake", "bridge", "orchard", "moonlight", "coast", "meadow", "waterfall", "evening"];
let libBusy = false;
async function libFetch() {
  const wk = weekNo(); if (libBusy || prefs.fresh === "off" || (lib.week === wk && (lib.n || 0) >= 20) || Date.now() < (lib.retryAt || 0)) return; libBusy = true;
  const get = (u) => fetch(u, { signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const base = "https://collectionapi.metmuseum.org/public/collection/v1", have = new Set([...lib.items.map((x) => x[5]), ...Object.values(MET_ID)]);
  const good = (o) => o.isPublicDomain && /paint/i.test(o.classification || "") && /\/web-large\//.test(o.primaryImageSmall || "") && !have.has(o.objectID) && (() => { const m = (o.measurements || []).find((x) => x.elementName === "Overall")?.elementMeasurements; const r = m && m.Width / m.Height; return r >= 1.2 && r <= 2.5; })(); // wallpaper-shaped only
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const commit = (items) => { // saved theme by theme, so closing the tab mid-way keeps what has arrived
    lib.n = (lib.week === wk ? lib.n || 0 : 0) + items.length; lib.items = [...items, ...lib.items].slice(0, 300); lib.week = wk; libSave(); // the oldest arrivals drop off the end
    if (!wpEl.hidden && (prefs.art === "paintings" || prefs.art === "both")) wpRender();
  };
  let total = lib.week === wk ? lib.n || 0 : 0, calls = 0;
  try {
    for (let t = 0; t < 8 && total < 24 && calls < 150; t++) { // a week-shuffled theme each round; museum highlights first (far better hit rate), then the wider collection
      const theme = THEMES[(wk * 7 + t * 3) % THEMES.length], hl = t < 3 ? "&isHighlight=true" : "";
      const q = `${base}.1/search?q=${theme}&medium=Paintings&hasImages=true&isPublicDomain=true${hl}&limit=100`;
      const first = await get(q); calls++; if (!first.total) continue;
      const r = first.total > 100 ? await get(`${q}&offset=${Math.floor(Math.random() * (first.total - 100))}`) : first; calls++;
      const ids = (r.objectIDs || []).filter((id) => !have.has(id)).sort(() => Math.random() - 0.5).slice(0, 40), got = [];
      for (let i = 0; i < ids.length && got.length < 9 && calls < 150; i += 3) { // three at a time, a short pause between: about seven requests a second
        const batch = await Promise.allSettled(ids.slice(i, i + 3).map((id) => get(`${base}/objects/${id}`))); calls += batch.length;
        const slow = batch.some((x) => x.status === "rejected" && (x.reason === 403 || x.reason === 429)); // the server asked us to slow down
        for (const x of batch) { const o = x.status === "fulfilled" ? x.value : null; if (!o || got.length >= 9 || !good(o)) continue; have.add(o.objectID); got.push([o.primaryImageSmall, (o.title || "Untitled").slice(0, 90), o.artistDisplayName || o.culture || "Unknown artist", o.objectDate || "", "", o.objectID, Date.now()]); }
        if (slow) { if (got.length) commit(got); throw 429; } // keep what arrived, stop, try later
        await pause(250);
      }
      if (got.length) { commit(got); total += got.length; }
    }
  } catch (e) { if (e === 403 || e === 429) { lib.retryAt = Date.now() + 40 * 6e4; libSave(); } } // blocked or offline: what has arrived is kept, and it tries again later
  libBusy = false;
}
setTimeout(() => libFetch().catch(() => {}), 3500); setInterval(() => libFetch().catch(() => {}), 20 * 6e4);

/* ---------- time rings: how much of today, this week, this month and this year has passed ---------- */
const RING = [["Day", 1], ["Week", .9], ["Month", .76], ["Year", .62]]; // name, intensity: the nearer the cycle, the brighter
function leftText(ms) {
  if (ms >= 2 * 864e5) return `${Math.round(ms / 864e5)} days left`;
  if (ms >= 36e5) return `${Math.floor(ms / 36e5)}h ${String(Math.floor(ms / 6e4) % 60).padStart(2, "0")}m left`;
  return `${Math.max(1, Math.round(ms / 6e4))}m left`;
}
function timeFractions(now = new Date()) { // how far through the day, week (Mon-Sun), month and year we are, and the length of each in days
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), sod = new Date(y, m, d), dayF = (now - sod) / 864e5;
  const dim = new Date(y, m + 1, 0).getDate(), diy = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365, doy = Math.round((sod - new Date(y, 0, 1)) / 864e5);
  return [[dayF, 1], [((now.getDay() + 6) % 7 + dayF) / 7, 7], [(d - 1 + dayF) / dim, dim], [(doy + dayF) / diy, diy]];
}
const RING_R = [72, 57, 42, 27], RING_W = 11; // px in the 164px square
let ringHot = -1, ringFr = null;
function drawRims(cv, fr, k = 1) { // the glass edge of each ring, and a bead at the head of each arc (the frosted bands themselves are CSS)
  const S = 164, dpr = Math.min(devicePixelRatio || 1, 2); cv.width = S * dpr; cv.height = S * dpr;
  const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, S, S);
  const c = S / 2, start = -Math.PI / 2;
  fr.forEach(([f], i) => {
    const dim = ringHot < 0 || ringHot === i ? 1 : .3, hot = ringHot === i, I = RING[i][1] * dim, r = RING_R[i], h = RING_W / 2, a1 = start + Math.max(f * k, .004) * Math.PI * 2;
    x.lineWidth = hot ? 1.6 : 1; x.strokeStyle = `rgba(255,255,255,${.16 * dim})`; for (const rr of [r - h, r + h]) { x.beginPath(); x.arc(c, c, rr, 0, Math.PI * 2); x.stroke(); } // the groove's edges
    const g = x.createConicGradient(start, c, c), head = Math.min(Math.max(f * k, .004), .999);
    g.addColorStop(0, `rgba(255,255,255,${.12 * I})`); g.addColorStop(head, `rgba(255,255,255,${.85 * I})`); g.addColorStop(Math.min(head + .0001, 1), "rgba(255,255,255,0)");
    x.strokeStyle = g; for (const rr of [r - h, r + h]) { x.beginPath(); x.arc(c, c, rr, start, a1); x.stroke(); } // brighter along the arc
    x.shadowColor = "rgba(255,255,255,.8)"; x.shadowBlur = hot ? 16 : 9; x.fillStyle = `rgba(255,255,255,${.95 * I})`; x.beginPath(); x.arc(c + r * Math.cos(a1), c + r * Math.sin(a1), h * (hot ? .85 : .62), 0, Math.PI * 2); x.fill(); x.shadowBlur = 0;
  });
}
let ringsShown = false;
function renderRings() {
  const el = $("#rings"); el.hidden = prefs.rings === "off"; if (el.hidden) return;
  const fr = timeFractions();
  if (!el.firstChild) el.innerHTML = `<span class="rdisc">${RING.map(([, I], i) => `<i class="rt" data-i="${i}" style="--r:${RING_R[i]}px"></i><i class="rf" data-i="${i}" style="--r:${RING_R[i]}px;--k:${I};--f:0"></i>`).join("")}<canvas class="rcv"></canvas><span class="rmid"><b></b></span></span><ul class="rleg">${RING.map(([n, I], i) => `<li data-i="${i}"><i style="background:rgba(255,255,255,${(.25 + .7 * I).toFixed(2)})"></i><b>${n}</b><span></span></li>`).join("")}</ul>`;
  const cv = el.querySelector("canvas"), bands = el.querySelectorAll(".rf"); el.dataset.f = fr.map(([f]) => f.toFixed(4)).join(" ");
  el.querySelectorAll(".rleg span").forEach((s, i) => (s.textContent = leftText((1 - fr[i][0]) * fr[i][1] * 864e5)));
  el.setAttribute("aria-label", "Time passing. " + fr.map(([f], i) => `${RING[i][0]} ${Math.round(f * 100)} percent`).join(", "));
  ringFr = fr; rmid();
  const paint = (k) => { bands.forEach((n, i) => n.style.setProperty("--f", Math.max(fr[i][0] * k, .004).toFixed(4))); drawRims(cv, fr, k); };
  if (ringsShown) return paint(1);
  ringsShown = true; const t0 = performance.now(); // the first time, the rings sweep in
  const step = (t) => { const k = Math.min(1, (t - t0) / 1200); paint(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const rmid = () => { const b = $("#rings .rmid b"); if (b && ringFr) b.textContent = `${Math.round(ringFr[ringHot < 0 ? 0 : ringHot][0] * 100)}%`; }; // the middle shows the day, or the ring you point at
function setRingHot(i) { // light one ring (and its legend row), dim the others
  if (i === ringHot) return; ringHot = i; rmid(); const el = $("#rings"); el.classList.toggle("hovering", i >= 0);
  el.querySelectorAll(".rdisc i").forEach((n) => n.classList.toggle("hot", +n.dataset.i === i)); el.querySelectorAll(".rleg li").forEach((n) => n.classList.toggle("hot", +n.dataset.i === i));
  if (ringFr) drawRims(el.querySelector("canvas"), ringFr, 1);
}
{
  const el = $("#rings");
  el.addEventListener("pointerover", (e) => { const li = e.target.closest(".rleg li"); if (li) setRingHot(+li.dataset.i); });
  el.addEventListener("pointermove", (e) => { // over the rings themselves: whichever band the pointer is on
    const d = e.target.closest(".rdisc"); if (!d) return; const r = d.getBoundingClientRect(), dist = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    const i = RING_R.findIndex((rr) => Math.abs(dist - rr) <= RING_W / 2 + 3); setRingHot(i);
  });
  el.addEventListener("pointerleave", () => setRingHot(-1));
}
renderRings(); setInterval(live(renderRings), 3e4);
$("#rings").onclick = () => openTime();

/* ---------- the time view: every week of a long life as a dot, and the year as one dot per day ---------- */
let tWH = "", tTab = "life", tGeo = null, tEditing = false; // tEditing: changing the birth date without losing the saved one until you submit
try { tTab = localStorage["dayboard:ttab"] === "year" ? "year" : "life"; } catch {}
const fmtD = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
function closeTime() { tEditing = false; document.activeElement?.blur?.(); $("#timev").hidden = true; document.body.classList.remove("sorting"); $("#tTip").hidden = true; }
function openTime(tab) {
  if (tab) tTab = tab; try { localStorage["dayboard:ttab"] = tTab; } catch {}
  ["#menu", "#wpPop", "#bkPop", "#story", "#settings"].forEach((s) => { $(s).hidden = true; });
  $("#timev").hidden = false; document.body.classList.add("sorting"); drawTime(); $("#timev").focus();
}
function drawTime() {
  document.querySelectorAll("#tTabs [data-t]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === tTab));
  const need = tTab === "life" && (!prefs.birth || tEditing); $("#tSetup").hidden = !need; $("#tWrap").style.visibility = need ? "hidden" : "visible";
  if (need) { $("#tTitle").textContent = "Every week of a life"; $("#tSub").textContent = "One dot for each week. A quiet way to see how much room there is. When were you born?"; $("#tNote").textContent = ""; $("#tNow").hidden = true; $("#tBirth").focus(); document.querySelectorAll("#tSpan [data-y]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.y === (prefs.lifespan || 80))); if (prefs.birth) $("#tBirth").value = prefs.birth; return; }
  requestAnimationFrame(() => (tTab === "life" ? drawLife() : drawYear()));
}
function setupCanvas() {
  const w = $("#tWrap"), cv = $("#tCv"), dpr = Math.min(devicePixelRatio || 1, 2), W = w.clientWidth, H = w.clientHeight;
  tWH = W + "x" + H; cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); return { x, W, H };
}
function drawLife() {
  const birth = new Date(prefs.birth + "T00:00"), years = prefs.lifespan || 80, weeksLived = Math.floor((Date.now() - birth) / (7 * 864e5)), total = years * 52;
  const { x, W, H } = setupCanvas(), left = 30, gap = 0.55, cell = Math.min((W - left) / 52, H / (years + gap * (years / 10 - 1)));
  const px = (c) => left + (W - left - cell * 52) / 2 + c * cell + cell / 2, py = (r) => (H - cell * (years + gap * (years / 10 - 1))) / 2 + (r + gap * Math.floor(r / 10)) * cell + cell / 2, rad = Math.max(1.2, cell * 0.34);
  x.font = `${Math.max(9, Math.min(11, cell * 1.2))}px system-ui,sans-serif`; x.textBaseline = "middle"; x.fillStyle = "rgba(255,255,255,.45)";
  for (let r = 0; r < years; r += 10) { x.textAlign = "right"; x.fillText(String(r), px(0) - cell, py(r)); }
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / 52), c = i % 52; x.beginPath(); x.arc(px(c), py(r), rad, 0, 6.2832);
    x.fillStyle = i < weeksLived ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.14)"; x.fill();
  }
  const cur = weeksLived < total ? weeksLived : null, now = $("#tNow"); now.hidden = cur === null;
  if (cur !== null) { now.style.left = `${px(cur % 52)}px`; now.style.top = `${py(Math.floor(cur / 52))}px`; }
  tGeo = { kind: "life", px, py, cell, left, years, birth, weeksLived, total };
  const age = Math.floor((Date.now() - birth) / (365.25 * 864e5));
  $("#tTitle").textContent = "Every week of a life"; $("#tSub").textContent = `${weeksLived.toLocaleString()} weeks lived. About ${Math.max(0, total - weeksLived).toLocaleString()} more if you reach ${years}. The glowing dot is this week.`;
  $("#tNote").innerHTML = `Age ${age}. Each dot is one week, each row one year. <button type="button" class="linkbtn" id="tChange">Change</button>`;
}
function drawYear() {
  const now = new Date(), y = now.getFullYear(), { x, W, H } = setupCanvas(), left = 44, cell = Math.min((W - left) / 31, H / 12.6);
  const sx = left + (W - left - cell * 31) / 2, sy = (H - cell * 12) / 2, rad = Math.max(2, cell * 0.34), today = Math.floor((new Date(y, now.getMonth(), now.getDate()) - new Date(y, 0, 1)) / 864e5);
  const px = (c) => sx + c * cell + cell / 2, py = (r) => sy + r * cell + cell / 2;
  x.font = `${Math.max(10, Math.min(12, cell * .45))}px system-ui,sans-serif`; x.textBaseline = "middle"; x.textAlign = "right"; let idx = 0, cur = null;
  for (let m = 0; m < 12; m++) {
    x.fillStyle = "rgba(255,255,255,.5)"; x.fillText(new Date(y, m, 1).toLocaleDateString(undefined, { month: "short" }), sx - 8, py(m));
    for (let d = 0; d < new Date(y, m + 1, 0).getDate(); d++, idx++) {
      x.beginPath(); x.arc(px(d), py(m), rad, 0, 6.2832); x.fillStyle = idx < today ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.14)"; x.fill();
      if (idx === today) cur = [px(d), py(m)];
    }
  }
  const diy = idx, left_ = diy - today - 1, now_ = $("#tNow"); now_.hidden = !cur; if (cur) { now_.style.left = `${cur[0]}px`; now_.style.top = `${cur[1]}px`; }
  tGeo = { kind: "year", px, py, cell, y, sx };
  $("#tTitle").textContent = `${y}, one dot a day`; $("#tSub").textContent = `Day ${today + 1} of ${diy}. ${left_} days still ahead in ${y}. The glowing dot is today.`; $("#tNote").textContent = "";
}
function tipAt(e) {
  if (!tGeo) return; const r = $("#tCv").getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, g = tGeo; let text = "";
  if (g.kind === "life") {
    let best = null; for (let row = 0; row < g.years && !best; row++) if (Math.abs(g.py(row) - my) <= g.cell * .6) best = row;
    const col = Math.round((mx - g.px(0)) / g.cell); if (best !== null && col >= 0 && col < 52) { const i = best * 52 + col, s = new Date(g.birth.getTime() + i * 7 * 864e5); text = `Week of ${fmtD(s)} · age ${best}`; }
  } else {
    const m = Math.round((my - g.py(0)) / g.cell), d = Math.round((mx - g.px(0)) / g.cell); if (m >= 0 && m < 12 && d >= 0 && d < new Date(g.y, m + 1, 0).getDate()) text = new Date(g.y, m, d + 1).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  const t = $("#tTip"); t.hidden = !text; if (text) { t.textContent = text; t.style.left = `${Math.min(mx + 14, r.width - 180)}px`; t.style.top = `${Math.max(4, my - 34)}px`; }
}
$("#tCv").addEventListener("mousemove", tipAt); $("#tCv").addEventListener("mouseleave", () => ($("#tTip").hidden = true));
$("#tTabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) openTime(b.dataset.t); };
$("#tSpan").onclick = (e) => { const b = e.target.closest("[data-y]"); if (!b) return; prefs.lifespan = +b.dataset.y; document.querySelectorAll("#tSpan [data-y]").forEach((x) => x.setAttribute("aria-pressed", x === b)); save(); if (prefs.birth) drawTime(); };
$("#tSetup").onsubmit = (e) => { e.preventDefault(); const v = $("#tBirth").value; if (!v || new Date(v) > new Date()) return; prefs.birth = v; prefs.lifespan = prefs.lifespan || 80; tEditing = false; save(); drawTime(); };
$("#tNote").onclick = (e) => { if (e.target.closest("#tChange")) { tEditing = true; drawTime(); } };
$("#timeX").onclick = closeTime;
$("#timeBtn").onclick = () => setTimeout(() => openTime(), 60);
/* the title text above the canvas can reflow the box after drawing; redraw whenever its real size differs from what we drew for, so the today dot never drifts */
new ResizeObserver(() => { const w = $("#tWrap"); if (!$("#timev").hidden && w.clientWidth + "x" + w.clientHeight !== tWH) drawTime(); }).observe($("#tWrap"));
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && !zenOpen()) { e.preventDefault(); openTime(); } });

/* ---------- calendar: a month grid with the famous Indian festivals, from Google's public "Holidays in India" calendar ---------- */
/* FEST-BEGIN */
const FEST = [ // [pattern in the feed, name shown]: only the well-known festivals, not every observance
  [/new year's day/i, "New Year's Day"], [/^makar sankranti/i, "Makar Sankranti"], [/^pongal/i, "Pongal"], [/lohri/i, "Lohri"], [/vasant panchami/i, "Vasant Panchami"], [/republic day/i, "Republic Day"],
  [/maha shivaratri/i, "Maha Shivaratri"], [/^holi$/i, "Holi"], [/ugadi/i, "Ugadi"], [/gudi padwa/i, "Gudi Padwa"], [/ramzan id|eid al-fitr|eid-ul-fitr/i, "Eid al-Fitr"], [/rama navami/i, "Ram Navami"],
  [/mahavir jayanti/i, "Mahavir Jayanti"], [/good friday/i, "Good Friday"], [/^easter( sunday)?$/i, "Easter"], [/vaisakhi|baisakhi/i, "Baisakhi"], [/^vishu/i, "Vishu"], [/bahag bihu/i, "Bihu"], [/buddha purnima/i, "Buddha Purnima"],
  [/bakrid|eid al-adha/i, "Bakrid"], [/muharram/i, "Muharram"], [/rath yatra/i, "Rath Yatra"], [/independence day/i, "Independence Day"], [/^onam/i, "Onam"], [/raksha bandhan/i, "Raksha Bandhan"],
  [/^janmashtami$/i, "Janmashtami"], [/ganesh chaturthi/i, "Ganesh Chaturthi"], [/gandhi jayanti/i, "Gandhi Jayanti"], [/first day of sharad navratri/i, "Navratri begins"], [/first day of durga puja/i, "Durga Puja begins"],
  [/maha ashtami/i, "Maha Ashtami"], [/maha navami/i, "Maha Navami"], [/dussehra|vijayadashami/i, "Dussehra"], [/karaka chaturthi|karwa chauth/i, "Karwa Chauth"], [/diwali|deepavali/i, "Diwali"], [/govardhan puja/i, "Govardhan Puja"],
  [/bhai du[jy]|bhai dooj/i, "Bhai Dooj"], [/chhat|chhath/i, "Chhath Puja"], [/guru nanak jayanti/i, "Guru Nanak Jayanti"], [/guru go[bv]ind singh jayanti/i, "Guru Gobind Singh Jayanti"], [/milad un-nabi/i, "Milad-un-Nabi"], [/^christmas$/i, "Christmas"],
];
function festParse(ics) { // iCal text -> { "YYYY-MM-DD": [[name, isPublicHoliday, isTentative]] }
  const out = {}, text = ics.replace(/\r?\n[ \t]/g, "");
  for (const ev of text.split("BEGIN:VEVENT").slice(1)) {
    const d = ev.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/), s = ev.match(/SUMMARY:(.*)/); if (!d || !s || +d[1] < 2024 || +d[1] > 2031) continue;
    const raw = s[1].replace(/\r/g, "").trim(), tent = /\(tentative\)/i.test(raw), hit = FEST.find(([re]) => re.test(raw.replace(/\s*\(tentative\)/i, ""))); if (!hit) continue;
    const key = `${d[1]}-${d[2]}-${d[3]}`; (out[key] ||= []); if (!out[key].some((x) => x[0] === hit[1])) out[key].push([hit[1], /DESCRIPTION:Public holiday/i.test(ev) ? 1 : 0, tent ? 1 : 0]);
  }
  return out;
}
/* FEST-END */
const FEST_FALLBACK = {"2026-01-01":[["New Year's Day",0,0]],"2026-01-14":[["Pongal",0,0],["Makar Sankranti",0,0]],"2026-01-23":[["Vasant Panchami",0,0]],"2026-01-26":[["Republic Day",1,0]],"2026-02-15":[["Maha Shivaratri",0,0]],"2026-03-04":[["Holi",1,0]],"2026-03-19":[["Gudi Padwa",0,0],["Ugadi",0,0]],"2026-03-21":[["Eid al-Fitr",1,0]],"2026-03-26":[["Ram Navami",1,0]],"2026-03-31":[["Mahavir Jayanti",1,0]],"2026-04-03":[["Good Friday",1,0]],"2026-04-14":[["Baisakhi",0,0],["Vishu",0,0]],"2026-04-15":[["Bihu",0,0]],"2026-05-01":[["Buddha Purnima",1,0]],"2026-05-28":[["Bakrid",1,0]],"2026-06-26":[["Muharram",1,0]],"2026-07-16":[["Rath Yatra",0,0]],"2026-08-15":[["Independence Day",1,0]],"2026-08-26":[["Onam",0,0],["Milad-un-Nabi",1,0]],"2026-08-28":[["Raksha Bandhan",0,0]],"2026-09-04":[["Janmashtami",1,0]],"2026-09-14":[["Ganesh Chaturthi",0,0]],"2026-10-02":[["Gandhi Jayanti",1,0]],"2026-10-11":[["Navratri begins",0,0]],"2026-10-17":[["Durga Puja begins",0,0]],"2026-10-19":[["Maha Ashtami",0,0]],"2026-10-20":[["Dussehra",1,0]],"2026-10-29":[["Karwa Chauth",0,0]],"2026-11-08":[["Diwali",1,0]],"2026-11-09":[["Govardhan Puja",0,0]],"2026-11-11":[["Bhai Dooj",0,0]],"2026-11-15":[["Chhath Puja",0,0]],"2026-11-24":[["Guru Nanak Jayanti",1,0]],"2026-12-25":[["Christmas",1,0]],"2027-01-01":[["New Year's Day",0,0]],"2027-01-14":[["Makar Sankranti",0,0]],"2027-01-15":[["Pongal",0,0],["Guru Gobind Singh Jayanti",0,0]],"2027-01-26":[["Republic Day",1,0]],"2027-02-11":[["Vasant Panchami",0,0]],"2027-03-06":[["Maha Shivaratri",0,0]],"2027-03-10":[["Eid al-Fitr",1,1]],"2027-03-22":[["Holi",1,0]],"2027-03-26":[["Good Friday",1,0]],"2027-04-07":[["Ugadi",0,0],["Gudi Padwa",0,0]],"2027-04-14":[["Vishu",0,0],["Baisakhi",0,0]],"2027-04-15":[["Ram Navami",1,0],["Bihu",0,0]],"2027-04-19":[["Mahavir Jayanti",1,0]],"2027-05-17":[["Bakrid",1,1]],"2027-05-20":[["Buddha Purnima",1,0]],"2027-06-16":[["Muharram",1,1]],"2027-07-05":[["Rath Yatra",0,0]],"2027-08-15":[["Independence Day",1,0],["Milad-un-Nabi",1,1]],"2027-08-17":[["Raksha Bandhan",0,0]],"2027-08-25":[["Janmashtami",1,0]],"2027-09-04":[["Ganesh Chaturthi",0,0]],"2027-09-12":[["Onam",0,0]],"2027-09-30":[["Navratri begins",0,0]],"2027-10-02":[["Gandhi Jayanti",1,0]],"2027-10-05":[["Durga Puja begins",0,0]],"2027-10-07":[["Maha Ashtami",0,0]],"2027-10-08":[["Maha Navami",0,0]],"2027-10-09":[["Dussehra",1,0]],"2027-10-18":[["Karwa Chauth",0,0]],"2027-10-29":[["Diwali",1,0]],"2027-10-30":[["Govardhan Puja",0,0]],"2027-10-31":[["Bhai Dooj",0,0]],"2027-11-04":[["Chhath Puja",0,0]],"2027-11-14":[["Guru Nanak Jayanti",1,0]],"2027-12-25":[["Christmas",1,0]]}; // 2026 and 2027, bundled so the calendar works offline
let fest = { ...FEST_FALLBACK }, festTried = false;
try { const c = JSON.parse(localStorage["dayboard:fest"] || "null"); if (c?.data) fest = { ...fest, ...c.data }; } catch {}
async function festLoad() { // the full feed once a month; failure just keeps what we have
  let t = 0; try { t = JSON.parse(localStorage["dayboard:fest"] || "{}").t || 0; } catch {}
  if (festTried || Date.now() - t < 30 * 864e5) return; festTried = true;
  try {
    const r = await fetch("https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics", { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw r.status;
    const data = festParse(await r.text()); if (!Object.keys(data).length) throw 0;
    fest = { ...FEST_FALLBACK, ...data }; try { localStorage["dayboard:fest"] = JSON.stringify({ t: Date.now(), data }); } catch {}
    if (!$("#cal").hidden) drawCal();
  } catch {}
}
/* ---------- meetings: Outlook's published ICS link, read-only (extension only; ics.js parses it) ---------- */
let ol = null, mt = { ev: [], at: 0, err: "" }, mtBusy = false;
const HAS_OL = !!globalThis.chrome?.runtime?.id && !!globalThis.ICS;
try { const c = JSON.parse(localStorage["dayboard:mtgs"] || "null"); if (c?.ev) mt = { ev: c.ev, at: c.at || 0, err: "" }; } catch {}
const dkey = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lday = (ms) => { const d = new Date(ms); return dkey(d.getFullYear(), d.getMonth(), d.getDate()); };
const dayStart = (k) => new Date(k + "T00:00").getTime();
const evOn = (k) => { const a = dayStart(k), b = new Date(a).setDate(new Date(a).getDate() + 1); return mt.ev.filter((e) => e.s < b && (e.e > a || e.s >= a)).sort((x, y) => (y.ad - x.ad) || x.s - y.s); };
const durText = (e) => { if (e.ad) { const n = Math.max(1, Math.round((e.e - e.s) / 864e5)); return n > 1 ? `${n} days` : "All day"; } const m = Math.round((e.e - e.s) / 6e4); return !m ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; };
const inText = (ms) => { const m = Math.max(1, Math.round(ms / 6e4)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${Math.round(m / 1440)} d`; };
const agoText = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const olSay = (s, bad) => { const m = $("#olMsg"); if (m) { m.textContent = s; m.classList.toggle("bad", !!bad); } };
function olUI() {
  $("#olSec").hidden = !HAS_OL; $("#calRefresh").hidden = !ol?.url;
  $("#olUrl").placeholder = ol ? "Link saved (hidden)" : "https://outlook.office365.com/owa/calendar/…/calendar.ics";
  $("#olOn").textContent = ol ? "Replace" : "Connect"; $("#olNow").hidden = $("#olOff").hidden = !ol;
  if (ol) olSay(mt.err ? `Last refresh failed: ${mt.err}` : mt.at ? `${mt.ev.length} events. Updated ${agoText(mt.at)}.` : "Connected. Reading your calendar…", !!mt.err); else olSay("");
}
function mtChanged() { olUI(); renderNextMtg(); mtSchedule(); if (!$("#cal").hidden) drawCal(); }
async function mtRefresh(manual) {
  if (!ol?.url || mtBusy) return; mtBusy = true; $("#calRefresh").classList.add("busy"); if (manual) olSay("Refreshing…");
  try {
    const r = await fetch(ol.url, { cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw { msg: r.status === 404 ? "Outlook says the link no longer exists. Publish the calendar again and paste the new link." : r.status === 401 || r.status === 403 ? "Outlook refused the link." : `Outlook answered ${r.status}.` };
    const txt = await r.text(); if (!/BEGIN:VCALENDAR/.test(txt)) throw { msg: "That link did not return a calendar. Use the ICS link, not the HTML one." };
    const t = Date.now(), ev = ICS.parse(txt, t - 35 * 864e5, t + 200 * 864e5).slice(0, 2500);
    mt = { ev, at: Date.now(), err: "" }; try { localStorage["dayboard:mtgs"] = JSON.stringify({ ev, at: mt.at }); } catch {}
  } catch (e) { mt.err = e.msg || (e.name === "TimeoutError" ? "Outlook took too long to answer." : "Could not reach Outlook. Showing the last copy."); }
  finally { mtBusy = false; $("#calRefresh").classList.remove("busy"); mtChanged(); }
}
function mtBoot() { if (ol?.url && Date.now() - mt.at > 10 * 6e4) mtRefresh(false); renderNextMtg(); mtSchedule(); }
setInterval(() => { if (ol?.url) { if (Date.now() - mt.at > 15 * 6e4) mtRefresh(false); renderNextMtg(); } }, 3e4);
$("#olOn").onclick = async () => {
  let u = $("#olUrl").value.trim().replace(/^webcal:/i, "https:").replace(/\/calendar\.html(\?.*)?$/i, "/calendar.ics"), url;
  try { url = new URL(u); } catch { return olSay("That does not look like a link.", true); }
  if (url.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return olSay("The link must start with https.", true);
  if (/\.html?$/i.test(url.pathname)) return olSay("That is the web view. Paste the ICS link (it ends in .ics).", true);
  if (globalThis.chrome?.permissions) { // asked first, in the same moment as the click: an await before it would drop the user gesture Chrome requires
    const o = [url.protocol + "//" + url.hostname + "/*"]; let why = "";
    const ok = await chrome.permissions.request({ origins: o }).catch((e) => { why = e?.message || ""; return false; }); // resolves true at once when already granted
    if (!ok) return olSay(`Chrome did not give Dayboard access to ${url.hostname}${why ? ` (${why})` : ""}. Click Connect again and choose Allow.`, true);
  }
  ol = { url: url.href }; $("#olUrl").value = ""; mt = { ev: [], at: 0, err: "" }; await store.set({ ol }); olUI(); await mtRefresh(true);
  if (!mt.err) olSay(`Connected. ${mt.ev.length} events read.`);
};
$("#olNow").onclick = () => mtRefresh(true);
$("#olOff").onclick = async () => { ol = null; mt = { ev: [], at: 0, err: "" }; try { localStorage.removeItem("dayboard:mtgs"); } catch {} await store.set({ ol: null }); mtChanged(); olSay("Removed. Delete the published link in Outlook too if you like."); };
$("#calRefresh").onclick = () => mtRefresh(true);
/* the line under the greeting: the next meeting, or how long you are free before it. Free time offers one task that fits. */
let nm = null, freeSkip = new Set();
function nextState(now) {
  const eod = new Date().setHours(23, 59, 59, 999), hr = new Date(now).getHours();
  const L = mt.ev.filter((e) => !e.ad && !e.free && e.e > now && e.s <= eod).sort((x, y) => x.s - y.s), cur = L.find((e) => e.s <= now);
  if (cur) return { k: "now", e: cur };
  const e = L[0];
  if (e) { const gap = e.s - now; return gap < 10 * 6e4 ? { k: "soon", e } : gap >= 30 * 6e4 && hr >= 8 && hr < 19 ? { k: "free", e, gap } : { k: "next", e }; }
  return mt.at && hr >= 16 && hr < 21 ? { k: "clear", gap: eod - now } : null;
}
function renderNextMtg() {
  const b = $("#nextMtg"); if (!ol?.url) { nm = null; return void (b.hidden = true); }
  const now = Date.now(); nm = nextState(now);
  if (!nm) { b.hidden = true; if (!$("#freeCard").hidden) freeToggle(false); return; }
  const { k, e } = nm, gap5 = nm.gap && Math.floor(nm.gap / 3e5) * 3e5;
  b.textContent = k === "now" ? `Now · ${e.t} · until ${hhmm(e.e)}` : k === "soon" ? `${e.t} · in ${inText(e.s - now)}` : k === "free" ? `${durText({ s: 0, e: gap5 })} free · until ${e.t}, ${hhmm(e.s)}` : k === "clear" ? "Free for the rest of the day" : e.s - now < 60 * 6e4 ? `${e.t} · in ${inText(e.s - now)}` : `Next · ${e.t} · ${hhmm(e.s)}`;
  b.classList.toggle("soon", k === "soon" || k === "now"); b.classList.toggle("free", k === "free" || k === "clear");
  b.dataset.e = e?.id || ""; b.dataset.d = e ? lday(e.s) : ""; b.title = k === "free" || k === "clear" ? "A task that fits" : "Open your calendar"; b.hidden = false;
  if (!$("#freeCard").hidden) drawFree();
}
const estOf = (t) => t.est || 30;
function suggest(minutes) { // one open task: overdue first, then due today, then by priority; it should fit the gap when we know how long it takes
  const td = today(), rank = (t) => (t.from || (t.due && t.due < td) ? 0 : t.due === td ? 1 : t.due ? 2 + (new Date(t.due) - new Date(td)) / 864e5 : 99);
  const c = open().filter((t) => !t.wait && !freeSkip.has(t.id)).sort((x, y) => rank(x) - rank(y) || x.p - y.p || (y.status === "doing") - (x.status === "doing") || (x.ord || 0) - (y.ord || 0));
  return c.find((t) => estOf(t) <= minutes) || null;
}
function drawFree() {
  if (!nm || (nm.k !== "free" && nm.k !== "clear")) return;
  const now = Date.now(), gap = Math.floor(nm.gap / 3e5) * 3e5, min = Math.round(gap / 6e4), t = suggest(min);
  const meta = t ? [t.proj, t.from ? "overdue" : t.due === today() ? "due today" : t.due ? fmtDue(t.due) : "", t.est ? `~${t.est >= 60 && t.est % 60 === 0 ? t.est / 60 + "h" : t.est + "m"}` : ""].filter(Boolean).join(" · ") : "";
  $("#freeCard").innerHTML = `<div class="frhead"><h3>${durText({ s: 0, e: gap })} free</h3><p>${nm.k === "free" ? `until ${esc(nm.e.t)} at ${hhmm(nm.e.s)}` : "for the rest of the day"}</p></div>`
    + (t ? `<div class="frtask"><b>${esc(t.title)}</b><small>${esc(meta)}</small></div><div class="ractions"><button type="button" class="pill" data-fr="another">Another</button><button type="button" class="pill solid" data-fr="start" data-id="${t.id}">${t.status === "doing" ? "Carry on" : "Start this"}</button></div>`
      : `<p class="frnone">${freeSkip.size ? "That is everything for now." : "Nothing is waiting. Enjoy the gap."}</p>${freeSkip.size ? `<div class="ractions"><button type="button" class="pill" data-fr="reset">Show again</button></div>` : ""}`);
}
function freeToggle(on = $("#freeCard").hidden) { if (on) drawFree(); $("#freeCard").hidden = !on; $("#nextMtg").setAttribute("aria-expanded", on); }
$("#nextMtg").onclick = (e) => {
  e.stopPropagation(); const d = e.currentTarget.dataset;
  if (nm && (nm.k === "free" || nm.k === "clear")) return freeToggle();
  openCal(d.d, d.e);
};
$("#freeCard").onclick = (e) => {
  const b = e.target.closest("[data-fr]"); if (!b) return; e.stopPropagation();
  if (b.dataset.fr === "another") { const t = suggest(Math.round(nm.gap / 6e4)); if (t) freeSkip.add(t.id); drawFree(); }
  else if (b.dataset.fr === "reset") { freeSkip.clear(); drawFree(); }
  else if (b.dataset.fr === "start") {
    const t = tasks.find((x) => x.id === b.dataset.id); if (!t) return; const was = t.status;
    t.status = "doing"; save(); render(); freeToggle(false);
    undoable(`Started “${t.title.slice(0, 32)}”`, () => { t.status = was || "todo"; });
  }
};
document.addEventListener("click", (e) => { if (!$("#freeCard").hidden && !e.target.closest("#freeCard, #nextMtg")) freeToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#freeCard").hidden) { freeToggle(false); $("#nextMtg").focus(); } });

/* ---------- calendar (month and week) with festivals, due tasks and meetings ---------- */
let calY = 0, calM = 0, calSel = "", calEv = "", calMode = "month";
try { calMode = localStorage["dayboard:calmode"] === "week" ? "week" : "month"; } catch {}
function openCal(day, evId) {
  const t = day ? new Date(day + "T00:00") : new Date(); calY = t.getFullYear(); calM = t.getMonth(); calSel = day || dkey(t.getFullYear(), t.getMonth(), t.getDate()); calEv = evId || "";
  ["#menu", "#wpPop", "#bkPop", "#story", "#settings"].forEach((s) => { $(s).hidden = true; });
  $("#cal").hidden = false; document.body.classList.add("sorting"); drawCal(); $("#cal").focus(); festLoad();
  if (calEv && $("#calDay .mt.open")) $("#calDay .mt.open").scrollIntoView({ block: "nearest" });
  if (ol?.url && Date.now() - mt.at > 5 * 6e4) mtRefresh(false);
}
function closeCal() { document.activeElement?.blur?.(); $("#cal").hidden = true; document.body.classList.remove("sorting"); }
const weekStart = (k) => { const d = new Date(k + "T00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
function drawCal() {
  const wk = calMode === "week"; document.querySelectorAll("#calMode [data-m]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === calMode));
  $("#calGrid").hidden = wk; $("#calWeek").hidden = !wk; $("#calRefresh").hidden = !ol?.url;
  $("#calRefresh").title = mt.err ? `Refresh meetings. Last try failed: ${mt.err}` : mt.at ? `Refresh meetings. Updated ${agoText(mt.at)}.` : "Refresh meetings";
  $("#calRefresh").classList.toggle("bad", !!mt.err);
  const dueOn = {}; open().forEach((t) => { if (t.due) (dueOn[t.due] ||= []).push(t); });
  if (wk) drawWeek(dueOn); else drawMonth(dueOn);
  drawCalSide(dueOn);
}
function drawMonth(dueOn) {
  const first = new Date(calY, calM, 1), lead = (first.getDay() + 6) % 7, todayK = today(), now = new Date();
  const cwStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)); // this week's Monday, to tint the current week's row
  $("#calTitle").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => `<div class="calwd" role="columnheader">${w}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(calY, calM, 1 - lead + i), k = dkey(d.getFullYear(), d.getMonth(), d.getDate()), f = fest[k] || [], inM = d.getMonth() === calM, wkd = (d.getDay() + 6) % 7 >= 5, tk = dueOn[k] || [], me = ol?.url ? evOn(k).filter((e) => !e.free || e.ad) : [];
    const cw = d >= cwStart && d < new Date(cwStart.getFullYear(), cwStart.getMonth(), cwStart.getDate() + 7);
    const chips = me.slice(0, 2).map((e) => `<span class="mc${e.ad ? " ad" : ""}${e.tent ? " tent" : ""}">${e.ad ? "" : `<i>${hhmm(e.s)}</i> `}${esc(e.t)}</span>`).join("") + (me.length > 2 ? `<span class="mc more">+${me.length - 2} more</span>` : "");
    html += `<button type="button" class="calc${inM ? "" : " out"}${wkd ? " wknd" : ""}${k === todayK ? " today" : ""}${f.length ? " fest" : ""}${f.some((x) => x[1]) ? " pub" : ""}${k === calSel ? " sel" : ""}${cw ? " cw" : ""}" data-d="${k}" role="gridcell" aria-label="${esc(d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}${f.length ? ". " + esc(f.map((x) => x[0]).join(", ")) : ""}${me.length ? `. ${me.length} meeting${me.length > 1 ? "s" : ""}` : ""}"><b>${d.getDate()}</b>${f.length ? `<span class="fn">${esc(f[0][0])}${f.length > 1 ? `<small>+ ${esc(f[1][0])}${f.length > 2 ? " …" : ""}</small>` : ""}</span>` : ""}${chips}${me.length ? `<span class="mcount" aria-hidden="true">${me.length}</span>` : ""}${tk.length ? `<span class="tdots" aria-hidden="true">${tk.slice(0, 3).map(() => "<i></i>").join("")}</span>` : ""}</button>`;
  }
  $("#calGrid").innerHTML = html;
}
const HR = 48; // px per hour in the week grid
function drawWeek(dueOn) {
  const ws = weekStart(calSel), days = [...Array(7)].map((_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; }), keys = days.map((d) => dkey(d.getFullYear(), d.getMonth(), d.getDate()));
  const we = days[6], sameM = ws.getMonth() === we.getMonth();
  $("#calTitle").textContent = `${ws.getDate()}${sameM ? "" : " " + ws.toLocaleDateString(undefined, { month: "short" })} – ${we.getDate()} ${we.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
  const meet = ol?.url, per = keys.map((k) => (meet ? evOn(k) : []).filter((e) => !e.free || e.ad)), todayK = today();
  let lo = 8, hi = 19;
  per.forEach((L, i) => L.filter((e) => !e.ad).forEach((e) => { const a = Math.max(e.s, dayStart(keys[i])), z = Math.min(e.e, dayStart(keys[i]) + 864e5); lo = Math.min(lo, Math.floor((a - dayStart(keys[i])) / 36e5)); hi = Math.max(hi, Math.ceil((z - dayStart(keys[i])) / 36e5)); }));
  hi = Math.min(24, Math.max(hi, lo + 6)); lo = Math.max(0, Math.min(lo, hi - 6));
  const now = Date.now();
  let head = `<i></i>` + days.map((d, i) => { const f = fest[keys[i]] || []; return `<button type="button" class="wkd${keys[i] === todayK ? " today" : ""}${keys[i] === calSel ? " sel" : ""}${(d.getDay() + 6) % 7 >= 5 ? " wknd" : ""}" data-d="${keys[i]}"><small>${d.toLocaleDateString(undefined, { weekday: "short" })}</small><b>${d.getDate()}</b>${wxDay(keys[i]) ? `<span class="wkw">${wxIcon(wxDay(keys[i]).c, true, 12)}${deg(wxDay(keys[i]).hi)}</span>` : ""}${f.length ? `<span class="wkf">${esc(f[0][0])}</span>` : ""}</button>`; }).join("");
  const adRow = per.some((L) => L.some((e) => e.ad)) ? `<div class="wkad"><i>all day</i>${per.map((L) => `<div>${L.filter((e) => e.ad).map((e) => `<button type="button" class="mc ad${e.id === calEv ? " on" : ""}" data-e="${esc(e.id)}" data-d="${lday(e.s)}">${esc(e.t)}</button>`).join("")}</div>`).join("")}</div>` : "";
  const hrs = [...Array(hi - lo)].map((_, i) => `<span style="top:${i * HR}px">${hhmm(new Date(2000, 0, 1, lo + i).getTime())}</span>`).join("");
  const cols = per.map((L, i) => {
    const t0 = dayStart(keys[i]), ev = L.filter((e) => !e.ad).map((e) => ({ e, a: Math.max(e.s, t0), z: Math.min(Math.max(e.e, e.s + 15 * 6e4), t0 + 864e5) })), lane = [], out = [];
    let g = [], gEnd = 0; const close = () => { const n = Math.max(1, ...g.map((x) => x.l + 1)); g.forEach((x) => (x.n = n)); out.push(...g); g = []; };
    for (const x of ev) { if (g.length && x.a >= gEnd) { close(); lane.length = 0; gEnd = 0; } let l = lane.findIndex((z) => z <= x.a); if (l < 0) l = lane.length; lane[l] = x.z; x.l = l; g.push(x); gEnd = Math.max(gEnd, x.z); } if (g.length) close();
    const blocks = out.map((x) => { const top = (x.a - t0) / 36e5 * HR - lo * HR, ht = Math.max(22, (x.z - x.a) / 36e5 * HR - 2), e = x.e;
      return `<button type="button" class="wke${e.tent ? " tent" : ""}${e.e < now ? " past" : ""}${e.s <= now && e.e > now ? " live" : ""}${e.id === calEv ? " on" : ""}" data-e="${esc(e.id)}" data-d="${keys[i]}" style="top:${top}px;height:${ht}px;left:calc(${x.l / x.n * 100}% + 1px);width:calc(${100 / x.n}% - 3px)"><b>${esc(e.t)}</b>${ht > 34 && x.n === 1 ? `<small>${hhmm(e.s)} – ${hhmm(e.e)}</small>` : ""}</button>`; }).join("");
    const nowLine = keys[i] === todayK && now >= t0 + lo * 36e5 && now < t0 + hi * 36e5 ? `<u class="wknow" style="top:${(now - t0) / 36e5 * HR - lo * HR}px"></u>` : "";
    return `<div class="wkcol${keys[i] === todayK ? " today" : ""}${keys[i] === calSel ? " sel" : ""}" data-d="${keys[i]}">${blocks}${nowLine}</div>`;
  }).join("");
  $("#calWeek").innerHTML = `<div class="wkh">${head}</div>${adRow}<div class="wkgrid" style="height:${(hi - lo) * HR}px"><div class="wkhrs">${hrs}</div>${cols}</div>${meet || !HAS_OL ? "" : `<p class="calsrc">Add your Outlook calendar link in Preferences to see meetings here.</p>`}`;
}
function evDetail(e) {
  const now = Date.now(), when = e.ad ? new Date(e.s).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + (e.e - e.s > 864e5 ? ` to ${new Date(e.e - 864e5).toLocaleDateString(undefined, { day: "numeric", month: "long" })}` : "")
    : `${new Date(e.s).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${hhmm(e.s)} – ${hhmm(e.e)}`;
  const state = e.ad ? "" : e.s <= now && e.e > now ? `In progress, ends in ${inText(e.e - now)}` : e.s > now ? `Starts in ${inText(e.s - now)}` : "Ended";
  const link = /^https:\/\//i.test(e.join) ? `<a class="pill solid" href="${esc(e.join)}" target="_blank" rel="noopener">Join meeting</a>` : "";
  const bits = [e.loc && `<p><span>Where</span>${esc(e.loc)}</p>`, e.org && `<p><span>Organiser</span>${esc(e.org)}</p>`, e.n > 1 && `<p><span>Invited</span>${e.n} people</p>`, e.tent && `<p><span>Status</span>Tentative</p>`, e.free && `<p><span>Shown as</span>Free</p>`].filter(Boolean).join("");
  return `<div class="mtd"><p class="mtw">${esc(when)}${durText(e) && !e.ad ? ` · ${durText(e)}` : ""}</p>${state ? `<p class="mts">${esc(state)}</p>` : ""}${bits}${e.desc ? `<div class="mtdesc">${esc(e.desc)}</div>` : ""}<div class="mta">${link}<button type="button" class="pill" data-mnotes="${esc(e.id)}">Take notes</button></div></div>`;
}
function drawCalSide(dueOn) {
  const sd = new Date(calSel + "T00:00"), f = fest[calSel] || [], tk = (dueOn || {})[calSel] || [], me = ol?.url ? evOn(calSel) : [];
  const wd = wxDay(calSel);
  $("#calDayH").innerHTML = esc(sd.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })) + (wd ? `<span class="calwx">${wxIcon(wd.c, true, 13)}${deg(wd.hi)} / ${deg(wd.lo)}</span>` : "");
  const mrows = me.map((e) => `<li class="mt${e.id === calEv ? " open" : ""}${!e.ad && e.e < Date.now() ? " past" : ""}" data-e="${esc(e.id)}" tabindex="0" role="button" aria-expanded="${e.id === calEv}"><b>${e.ad ? "All day" : hhmm(e.s)}</b><span class="mtl">${esc(e.t)}<small>${e.ad ? "" : `${hhmm(e.s)} – ${hhmm(e.e)} · `}${durText(e)}${e.loc ? ` · ${esc(e.loc)}` : ""}${e.tent ? " · tentative" : ""}</small>${e.id === calEv ? evDetail(e) : ""}</span></li>`).join("");
  $("#calDay").innerHTML = (f.map((x) => `<li><b></b><span>${esc(x[0])}<small>${x[1] ? "Public holiday" : "Festival"}${x[2] ? " · date may shift with the moon" : ""}</small></span></li>`).join("")
    + mrows + tk.map((t) => `<li><b>Due</b><span>${esc(t.title)}<small>${esc(t.proj)}</small></span></li>`).join("")) || `<li class="none">Nothing marked for this day.</li>`;
  const mo = Object.keys(fest).filter((k) => k.startsWith(`${calY}-${String(calM + 1).padStart(2, "0")}-`)).sort();
  $("#calMonthH").textContent = `Festivals in ${new Date(calY, calM, 1).toLocaleDateString(undefined, { month: "long" })}`;
  $("#calMonth").innerHTML = mo.length ? mo.map((k) => `<li class="btn" data-d="${k}"><b>${+k.slice(8)}</b><span>${esc(fest[k].map((x) => x[0]).join(" · "))}<small>${new Date(k + "T00:00").toLocaleDateString(undefined, { weekday: "long" })}</small></span></li>`).join("") : `<li class="none">No major festivals this month.</li>`;
  $("#calSrc").textContent = "Festival dates: Google’s public Holidays in India calendar. Lunar festivals can shift by a day." + (ol?.url ? ` Meetings: your Outlook calendar${mt.at ? `, updated ${agoText(mt.at)}` : ""}${mt.err ? ` (last refresh failed: ${mt.err})` : ""}.` : "");
}
function calGo(dm) {
  if (calMode === "week") { const d = new Date(calSel + "T00:00"); d.setDate(d.getDate() + 7 * dm); calSel = dkey(d.getFullYear(), d.getMonth(), d.getDate()); calY = d.getFullYear(); calM = d.getMonth(); }
  else { const d = new Date(calY, calM + dm, 1); calY = d.getFullYear(); calM = d.getMonth(); const sel = new Date(calSel + "T00:00"); if (sel.getMonth() !== calM || sel.getFullYear() !== calY) calSel = dkey(calY, calM, 1); }
  calEv = ""; drawCal();
}
$("#calPrev").onclick = () => calGo(-1); $("#calNext").onclick = () => calGo(1); $("#calToday").onclick = () => openCal(); $("#calX").onclick = closeCal;
$("#calMode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; calMode = b.dataset.m; try { localStorage["dayboard:calmode"] = calMode; } catch {} drawCal(); };
function mtFor(id) { // "Take notes": Meeting view, filled in from the calendar entry
  const e = mt.ev.find((x) => x.id === id); if (!e) return;
  if (!mtg || (!mtg.body.trim() && !mtg.title.trim())) {
    const who = [...new Set([e.org, ...(e.att || [])].filter(Boolean))].join(", ");
    mtg = { id: crypto.randomUUID(), title: e.t.slice(0, 80), with: who.length > 160 ? who.slice(0, 157) + "…" : who, body: "", start: e.s, end: e.ad ? 0 : e.e, loc: e.loc || "", proj: ui.proj || projects[0] }; mtKeep();
  }
  closeCal(); openMtg();
}
$("#cal").addEventListener("click", (e) => {
  const mn = e.target.closest("[data-mnotes]"); if (mn) return mtFor(mn.dataset.mnotes);
  if (e.target.closest("a")) return;
  const ev = e.target.closest("[data-e]");
  if (ev) { calEv = calEv === ev.dataset.e && ev.closest("#calDay") ? "" : ev.dataset.e; if (ev.dataset.d) calSel = ev.dataset.d; drawCal(); if (calEv) $("#calDay .mt.open")?.scrollIntoView({ block: "nearest" }); return; }
  const b = e.target.closest("[data-d]"); if (!b) return; calSel = b.dataset.d; calEv = ""; const d = new Date(calSel + "T00:00"); if (d.getMonth() !== calM || d.getFullYear() !== calY) { calY = d.getFullYear(); calM = d.getMonth(); } drawCal();
});
$("#cal").addEventListener("keydown", (e) => { const li = e.target.closest?.("#calDay .mt"); if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); li.click(); } });
$("#weekRow").onclick = () => openCal(); $("#weekRow").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCal(); } };
addEventListener("keydown", (e) => {
  if (!$("#cal").hidden) { // the calendar has the arrow keys
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); e.stopPropagation(); calGo(-1); } else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); e.stopPropagation(); calGo(1); } else if (e.key === "Home") { e.preventDefault(); openCal(); }
    return;
  }
  if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && !zenOpen()) { e.preventDefault(); openCal(); }
}, true);

/* ---------- hide / show the small painting under the sun arc ---------- */
try { if (localStorage["dayboard:ph"]) { prefs.paintHide = true; applyPaintHide(); } } catch {} // no flash of the painting before your choice loads
$("#paintHide").onclick = (e) => { e.stopPropagation(); prefs.paintHide = true; save(); applyPaintHide(); };
$("#paintShow").onclick = () => { prefs.paintHide = false; save(); applyPaintHide(); };

// one minute breath: 7 slow cycles of the same 8s orb, then it closes itself
let breathT = null;
function closeBreath() { clearInterval(breathT); $("#breath").hidden = true; document.body.classList.remove("sorting"); }
function openBreath() {
  if (!$("#breath").hidden) return;
  const b = $("#breath .obreath"); b.style.animation = "none"; b.offsetWidth; b.style.animation = "";
  $("#breath").hidden = false; document.body.classList.add("sorting"); $("#breath").focus();
  let left = 56; $("#breathLeft").textContent = left + "s";
  breathT = setInterval(() => { left--; $("#breathLeft").textContent = left + "s"; if (left <= 0) closeBreath(); }, 1000);
}
$("#breathX").onclick = closeBreath;
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey && !e.altKey && !typingNow() && !zenOpen()) { e.preventDefault(); openBreath(); } });

document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); renderRings(); renderWind(); renderNudge(); renderNextMtg(); } });

/* ---------- notifications: a bell with the last two weeks of nudges, meeting heads-ups and tidy-ups, and a soft chime ---------- */
const EXT = !!globalThis.chrome?.runtime?.id;
const KIND = { meeting: "Meeting", task: "Reminder", golden: "Light", tidy: "Tidy" };
function inboxAdd(kind, title, body) { // page-made entries are silent; the background adds the ones that chime
  if (!EXT) return; inbox.unshift({ id: crypto.randomUUID(), ts: Date.now(), kind, title, body, read: false }); store.set({ inbox: inbox.slice(0, 100) }); bellDraw();
}
let ac = null;
function chime() { // two soft sine notes, a quiet fifth apart; if the browser has not allowed sound yet it simply stays silent
  try {
    ac ||= new AudioContext(); if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime + 0.02;
    [[880, 0], [1318.5, 0.16]].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.05, t0 + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.3);
      o.start(t0 + d); o.stop(t0 + d + 1.4);
    });
  } catch {}
}
function bellDraw() {
  $("#bellWrap").hidden = !EXT; if (!EXT) return;
  const n = inbox.filter((x) => !x.read).length, b = $("#bellN"); b.hidden = !n; b.textContent = n > 9 ? "9+" : n; $("#bellBtn").setAttribute("aria-label", n ? `Notifications, ${n} new` : "Notifications");
  if (!$("#inboxPop").hidden) inboxDraw();
}
function inboxDraw() {
  const week = inbox.filter((x) => Date.now() - x.ts < 7 * 864e5), c = {}; week.forEach((x) => (c[x.kind] = (c[x.kind] || 0) + 1));
  const sum = Object.entries(c).map(([k, v]) => `${v} ${(KIND[k] || k).toLowerCase()}${v > 1 && k !== "tidy" && k !== "golden" ? "s" : ""}`).join(" · ");
  $("#inboxPop").innerHTML = `<div class="ibhead"><h3>Notifications</h3>${inbox.length ? `<button type="button" class="linkbtn" id="ibClear">Clear</button>` : ""}</div>` + (inbox.length
    ? `<p class="ibsum">${week.length} this week${sum ? ` · ${esc(sum)}` : ""}</p><ul class="iblist">${inbox.slice(0, 30).map((x) => `<li class="${x.unread ? "new" : ""}" data-k="${esc(x.kind)}"><div><b>${esc(x.title)}</b><span>${esc(x.body || "")}</span></div><small>${agoText(x.ts)}</small>${x.kind === "meeting" && /^https:/i.test(x.join || "") ? `<a class="pill" href="${esc(x.join)}">Join</a>` : ""}</li>`).join("")}</ul>`
    : `<p class="ibnone">All quiet. Reminders, meeting heads-ups and tidy-ups will show up here.</p>`);
}
function bellToggle(on = $("#inboxPop").hidden) {
  if (on) { inboxDraw(); inbox.forEach((x) => { x.unread = !x.read; }); inboxDraw(); if (inbox.some((x) => !x.read)) { inbox.forEach((x) => (x.read = true)); store.set({ inbox }); } $("#bellN").hidden = true; }
  $("#inboxPop").hidden = !on; $("#bellBtn").setAttribute("aria-expanded", on);
  if (!on) inbox.forEach((x) => delete x.unread);
}
$("#bellBtn").onclick = (e) => { e.stopPropagation(); bellToggle(); };
$("#inboxPop").onclick = (e) => { if (e.target.id === "ibClear") { inbox = []; store.set({ inbox }); bellDraw(); } };
document.addEventListener("click", (e) => { if (!$("#inboxPop").hidden && !e.target.closest("#inboxPop, #bellBtn")) bellToggle(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#inboxPop").hidden) { bellToggle(false); $("#bellBtn").focus(); } });
if (EXT) chrome.storage.onChanged.addListener((ch, area) => { // the background wrote something: update the bell, and chime once for each new alert
  if (area !== "local" || !ch.inbox) return;
  const was = new Set(inbox.map((x) => x.id)); inbox = ch.inbox.newValue || [];
  const fresh = inbox.filter((x) => x.ding && !was.has(x.id) && !x.read);
  bellDraw(); if (fresh.length && prefs.chime !== "off") chime();
});
function mtSchedule() { // alarms for the next 48 h of meetings, 15 minutes ahead; also the windows other reminders wait out
  if (!EXT || !ol?.url) return;
  const now = Date.now(), LEAD = 15 * 6e4, ev = mt.ev.filter((e) => !e.ad && !e.free && !e.cancelled && e.e > now && e.s < now + 48 * 36e5).sort((a, b) => a.s - b.s);
  const next = {}; for (const e of ev) if (e.s - LEAD > now) next[`m:${e.id}:${e.s}`] = { id: e.id, t: (e.t || "Meeting").slice(0, 80), s: e.s, j: /^https:/i.test(e.join || "") ? e.join : "" };
  chrome.storage.local.set({ mnext: next, mwin: ev.map((e) => [e.s, e.e]) });
  chrome.alarms.getAll().then((all) => {
    all.forEach((a) => { if (a.name.startsWith("m:") && !next[a.name]) chrome.alarms.clear(a.name); });
    Object.keys(next).forEach((n) => { if (!all.some((a) => a.name === n)) chrome.alarms.create(n, { when: next[n].s - LEAD }); });
  });
}
