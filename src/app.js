"use strict";
/* Partridge FRA - on-site fire risk assessment app.
   Offline-first: jobs and photos live in IndexedDB on the device. */

/* ---------------- utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ukDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso.split("-").reverse().join("/") : (iso || "");
const addYear = (iso) => { if (!iso) return ""; const [y, m, dd] = iso.split("-"); return `${+y + 1}-${m}-${dd}`; };

/* Check keys contain a dot ("5.1"), so "checks.5.1.obs" must split as ["checks", "5.1", "obs"]. */
function splitPath(path) { const ks = path.split("."); return ks[0] === "checks" && ks.length >= 4 ? ["checks", ks[1] + "." + ks[2], ...ks.slice(3)] : ks; }
function getPath(obj, path) { return splitPath(path).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, val) {
  const ks = splitPath(path); let o = obj;
  ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
  o[ks[ks.length - 1]] = val;
}

/* ---------------- storage (IndexedDB, memory fallback) ---------------- */
const Store = {
  db: null, mem: { jobs: new Map(), photos: new Map(), lib: new Map() }, ok: false, ls: false, warned: false, why: "",
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open("pfs-fra", 2);
        r.onupgradeneeded = () => { ["jobs", "photos", "lib"].forEach((n) => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: "id" }); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
        setTimeout(() => rej(new Error("timeout")), 4000);
      });
      /* Some embedded viewers (e.g. the preview inside the Claude iPhone app) open the database but refuse writes. Probe once. */
      await this.tx("jobs", "readwrite", (st) => st.put({ id: "__probe" })); await this.tx("jobs", "readwrite", (st) => st.delete("__probe"));
      this.ok = true;
    } catch (e) { this.ok = false; this.why = e?.name || e?.message || "unavailable"; }
    if (!this.ok) {
      try { localStorage.setItem("pfs-probe", "1"); localStorage.removeItem("pfs-probe"); this.ls = true; } catch { this.ls = false; }
      ["jobs", "photos", "lib"].forEach((st) => this.lsAll(st).forEach((v) => this.mem[st].set(v.id, v)));
    }
  },
  lsKey: (st, id) => `pfs-${st}-${id}`,
  lsAll(st) { const out = []; if (!this.ls) return out; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(`pfs-${st}-`)) { try { out.push(JSON.parse(localStorage.getItem(k))); } catch { /* skip */ } } } } catch { /* ignore */ } return out; },
  lsPut(st, v) { if (!this.ls) return false; try { localStorage.setItem(this.lsKey(st, v.id), JSON.stringify(v)); return true; } catch { return false; } },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const s = t.objectStore(store); const r = fn(s);
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  async all(store) { if (!this.ok) return [...this.mem[store].values()]; try { return await this.tx(store, "readonly", (s) => s.getAll()); } catch (e) { return [...this.mem[store].values()]; } },
  async get(store, id) { if (!this.ok) return this.mem[store].get(id); try { return await this.tx(store, "readonly", (s) => s.get(id)); } catch (e) { return this.mem[store].get(id); } },
  async put(store, v) {
    this.mem[store].set(v.id, v);
    if (this.ok) { try { await this.tx(store, "readwrite", (s) => s.put(v)); return; } catch (e) { this.ok = false; this.why = e?.name || "write refused"; try { localStorage.setItem("pfs-probe", "1"); localStorage.removeItem("pfs-probe"); this.ls = true; } catch { this.ls = false; } } }
    const saved = this.lsPut(store, v);
    if (!saved) this.warn(store === "photos" && this.ls ? "photos" : "none");
  },
  async del(store, id) { this.mem[store].delete(id); if (this.ls) { try { localStorage.removeItem(this.lsKey(store, id)); } catch { /* ignore */ } } if (!this.ok) return; try { await this.tx(store, "readwrite", (s) => s.delete(id)); } catch (e) { /* ignore */ } },
  /* Tell the user once per session, not on every keystroke. */
  warn(kind) {
    if (this.warned === kind || this.warned === "none") return; this.warned = kind;
    S.storeWarn = kind === "photos" ? "This viewer can't store photos, so they will be lost when you close it. Export a backup before closing, or use the installed app." : "This viewer won't let the app save, so your work will be lost when you close it. Export a backup before closing, or use the installed app.";
    render(); toast(kind === "photos" ? "Photos can't be stored in this viewer. See the note on Home." : "This viewer can't save. See the note on Home.");
  },
  /* Saving via the fallback (localStorage) works, but space is small: say so once. */
  mode() { return this.ok ? "db" : this.ls ? "ls" : "none"; }
};

/* ---------------- app state ---------------- */
const S = { jobs: [], job: null, view: "jobs", loc: null, sec: 3, photoCache: new Map() };
const P = () => PROFILES[S.job?.profile || "hmo"];
let saveTimer = null;
function save() {
  if (!S.job) return;
  S.job.updated = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { Store.put("jobs", S.job); setSaved(); }, 350);
  setSaved("Saving…");
}
function setSaved(t) { const el = $("#savestate"); if (el) el.textContent = t || "Saved on this device"; }

function newJob(example) {
  const j = {
    id: uid(), profile: "hmo", created: new Date().toISOString(), updated: new Date().toISOString(), example: !!example,
    setup: { buildingType: "HMO", date: today(), review: addYear(today()), assessor: "Michael Partridge",
      quals: "Level 4 Diploma in Fire Safety", company: "Partridge Fire Safety", status: "Draft", bs9792: "Type 1" },
    overview: { vulnerable: {}, rooms: [] },
    locations: [], checks: {}, docs: {}, risk: {}, actions: [], interim: []
  };
  return j;
}

function exampleJob() {
  const j = newJob(true);
  Object.assign(j.setup, {
    address: "12 Example Terrace, Cathays, Cardiff", postcode: "CF24 0XX", ref: "PFS-EXAMPLE",
    occType: "Bedsits with cooking in rooms", storeys: "3", occupants: "6", rooms: "6", households: "6", over200: "No",
    rp: "Example Lettings Ltd", rpTel: "", rpEmail: "", agent: "", la: "Cardiff Council", licence: "Example only",
    present: "Landlord's agent", arrived: "10:00", departed: "12:15", enforcer: "South Wales Fire and Rescue Service"
  });
  Object.assign(j.overview, { construction: "Traditional masonry (brick), timber floors", year: "c. 1900", basement: "No", loft: "Yes",
    sprinkler: "None", layout: "Single protected stair from ground to second floor. Two bedsits per floor. Final exit to street." });
  const ground = { id: uid(), floor: "Ground floor", name: "Entrance hall", items: [] };
  const first = { id: uid(), floor: "First floor", name: "Landing", items: [] };
  ground.items.push({ id: uid(), k: "exit", f: { loc: "Front door", key: "Yes", fast: "Thumb-turn", sec: "Yes", out: "Yes", width: "820", sign: "Not needed" }, note: "", photos: [] });
  ground.items.push({ id: uid(), k: "comb", f: { loc: "Escape route", item: "E-bike or e-scooter", charge: "Yes", qty: "Significant", obstruct: "Yes", done: "RP to remove" }, note: "E-scooter charging in the hallway under the stairs.", photos: [] });
  first.items.push({ id: uid(), k: "door", f: { ref: "Room 3", type: "Letting room entrance", rating: "FD30S", closer: "No", latch: "No", gaps: "No", seals: "Yes", hinges: "Yes", leaf: "Yes", glazing: "None", damage: "Yes", hold: "None", sign: "Not required" }, note: "Closer removed by tenant; gap at head about 6 mm.", photos: [] });
  first.items.push({ id: uid(), k: "detector", f: { loc: "Landing", type: "Smoke (optical)", power: "Grade A system", link: "Interlinked", cond: "Yes", test: "Not tested", siting: "Yes", log: "No" }, note: "", photos: [] });
  j.locations.push(ground, first);
  j.checks["3.1"] = { v: "Yes", obs: "EICR sighted, satisfactory." };
  j.checks["3.16"] = { v: "No", obs: "E-scooter charging in the ground-floor hall." };
  return j;
}

/* ---------------- findings ---------------- */
/* An item recorded under the other building profile still keeps its spec, so nothing drops out of the findings. */
/* An item keeps the profile it was recorded under (it.p), so a building-type switch never re-reads it against a different checklist. */
function itemSpec(x) {
  const k = typeof x === "string" ? x : x?.k, p = typeof x === "object" ? x?.p : null;
  return (p && PROFILES[p]?.quickAdds.find((q) => q.k === k)) || P().quickAdds.find((q) => q.k === k) || Object.values(PROFILES).flatMap((q) => q.quickAdds).find((q) => q.k === k);
}
/* Fill in anything an older or partial saved job is missing, so no screen or the PDF can crash on it. */
function normalise(j) {
  if (!j || typeof j !== "object") return j;
  j.profile = j.profile || "hmo"; j.setup = j.setup || {}; j.overview = j.overview || {}; j.overview.vulnerable = j.overview.vulnerable || {};
  j.checks = j.checks || {};
  /* Repair answers saved by the old path bug (checks["5"]["1"] instead of checks["5.1"]). */
  Object.keys(j.checks).forEach((a) => { const v = j.checks[a]; if (/^\d+$/.test(a) && v && typeof v === "object" && !("v" in v) && !("obs" in v)) {
    Object.entries(v).forEach(([b, x]) => { if (x && typeof x === "object") { const k = a + "." + b; j.checks[k] = Object.assign({}, j.checks[k] || {}, Object.fromEntries(Object.entries(x).filter(([, y]) => y !== "" && y != null))); } });
    delete j.checks[a]; } }); j.docs = j.docs || {}; j.risk = j.risk || {}; j.actions = Array.isArray(j.actions) ? j.actions : [];
  j.interim = Array.isArray(j.interim) ? j.interim : []; j.conclusions = j.conclusions || {}; j.locations = Array.isArray(j.locations) ? j.locations : [];
  j.locations.forEach((l) => { l.items = Array.isArray(l.items) ? l.items : []; l.items.forEach((it) => { it.f = it.f || {}; it.photos = it.photos || []; }); });
  j.cover = j.cover || {}; j.photoMeta = j.photoMeta || {}; j.sf = j.sf || {};
  /* Jobs saved before the Cottrell Road order: move conclusions and action refs to the new section numbers. */
  if (!j.layout2) {
    const c = j.conclusions, map = { s3: ["c3"], s4: ["c4"], s5: ["c7"], s6: ["c5", "c6"], s7: ["c9"], s8: ["c8"], s9: ["c10"], s10: ["c11"] };
    Object.entries(map).forEach(([o, ns]) => { if (c[o]) ns.forEach((n) => { c[n] = c[n] || c[o]; }); delete c[o]; });
    try {
      const cl = checkList(j), byKey = Object.fromEntries(cl.map((x) => [x.key, x.ref]));
      j.actions.forEach((a) => { const m = /^(check|item):(.+)$/.exec(a.src || ""); if (!m) return;
        if (m[1] === "check" && byKey[m[2]]) a.ref = byKey[m[2]];
        if (m[1] === "item") { const it = j.locations.flatMap((l) => l.items).find((x) => x.id === m[2]); if (it) a.ref = String(itemDsec(it) || a.ref); } });
    } catch { /* leave refs as they were */ }
    j.layout2 = true;
  }
  return j;
}
function bench(job = S.job) {
  const b = PROFILES[job.profile || "hmo"].benchmark(Object.assign({}, job.setup, { basement: job.overview?.basement }));
  if (job.overview?.occupancy === "Short-term / transient") b.lines.push(["Short-term occupancy", "Self-catering or short-term paying guests: Grade D1, LD1 inside each unit (BS 5839-6 Table 1). Occupants are unfamiliar with the building, so signage and escape lighting carry more weight."]);
  return b;
}
function itemProblems(item) {
  const spec = itemSpec(item); if (!spec) return [];
  const out = [];
  spec.fields.forEach(([key, label, t, opts, bad]) => {
    const v = item.f?.[key];
    if (t === "yn" && v === "No") out.push(`${label}: No`);
    if (t === "yes" && v === "Yes") out.push(`${label}: Yes`);
    if (t === "sel" && bad && bad.includes(v) && !(key === "power" && /D2/.test(v) && sheltered())) out.push(`${label}: ${v}`);
  });
  if (item.k === "travel") { const d = Number(item.f?.dist); const b = bench(), two = item.f?.routes === "Alternative routes", alt = two && b.travelRefAlt, ref = alt ? b.travelRefAlt : b.travelRef;
    if (d > ref) out.push(`Travel distance ${d} m exceeds the ${ref} m reference (${alt ? "more than one direction" : two ? "LACORS 9.11; a suitable second exit may justify more, 9.12" : "one direction"})`); }
  return out;
}
function itemResult(item) {
  if (item.result) return item.result;
  if (item.k === "travel" && itemProblems(item).length) return "Review";
  return itemProblems(item).length ? "Fail" : "Pass";
}
function itemTitle(item) {
  const f = item.f || {};
  return f.ref || f.loc || f.from || f.fac || f.type || f.svc || f.dev || "";
}
/* Checks shown depend on the BS 9792 type. key is stable (position in the full list) so answers survive a type change; ref is the printed number. */
function shown(w, sc) { return !w || (w === "rooms" && sc.rooms) || (w === "intrusive" && sc.intrusive) || (w === "evidence" && !sc.rooms) || (w === "h11" && sc.h11) || (w === "h18" && sc.h18) || (w === "tempsim" && sc.tempsim) || (w === "conv" && sc.conv) || (w === "hmo" && !sc.lodgers) || (w === "nonres" && sc.nonres); }
/* Height: ADB uses top floor height; the Building Safety (Wales) Act 2026 categories use height or storeys (method still under consultation). */
function heightBand(st) {
  const h = Math.max(0, Number(st.topHeight) || 0), n = Math.max(0, parseInt(st.storeys, 10) || 0);
  if (!h && !n) return { cat: "", h11: false, h18: false };
  const c1 = h >= 18 || n >= 7, c2 = h >= 11 || n >= 5;
  /* ADB checks follow the top storey height when it is entered; storeys are only a fallback. */
  return { cat: c1 ? "Category 1" : c2 ? "Category 2" : "Category 3", h11: h ? h > 11 : n >= 5, h18: h ? h > 18 : n >= 7 };
}
/* Report layout follows the Cottrell Road order: 3 hazards, 4 people, 5 separation, 6 fire doors, 7 escape,
   8 emergency lighting, 9 detection, 10 signage and firefighting, 11 management.
   Check keys keep the profile's own section numbers (so saved answers never move); "sec" and "ref" are the display numbers. */
const DSECS = [{ n: 3, src: 3 }, { n: 5, src: 6, part: "sep", title: "Structural separation and compartmentation" }, { n: 6, src: 6, part: "door", title: "Fire doors" },
  { n: 7, src: 5 }, { n: 8, src: 8 }, { n: 9, src: 7 }, { n: 10, src: 9 }, { n: 11, src: 10 }];
const SRC2D = { 3: 3, 5: 7, 7: 9, 8: 8, 9: 10, 10: 11 };
const DOOR_ITEMS = ["door", "flatdoor", "hold"];
function dsecs(job = S.job) {
  const prof = PROFILES[job?.profile || "hmo"];
  return DSECS.map((d) => { const s = prof.sections.find((x) => x.n === d.src); if (!s) return null;
    if (d.part === "door" && !s.groups.some(([g, items]) => /door/i.test(g || "") || items.some((it) => /\bdoors?\b/i.test(typeof it === "string" ? it : it.t)))) return null;
    return { n: d.n, src: d.src, part: d.part, title: (prof.dTitles || {})[d.n] || d.title || s.title, management: !!s.management }; }).filter(Boolean);
}
function checkDsec(isec, group, text) { return isec === 6 ? (/door/i.test(group || "") || /\bdoors?\b/i.test(text) ? 6 : 5) : (SRC2D[isec] || isec); }
function itemDsec(it) { const sp = itemSpec(it); if (!sp) return 0; return sp.sec === 6 ? (DOOR_ITEMS.includes(it.k) ? 6 : 5) : (SRC2D[sp.sec] || sp.sec); }
function checkList(job = S.job) {
  const sc = scope(job), prof = PROFILES[job.profile || "hmo"], raw = [];
  prof.sections.forEach((s) => { let k = 0; s.groups.forEach(([g, items, gw]) => items.forEach((it) => { k++; const o = typeof it === "string" ? { t: it } : it; if (!shown(o.when || gw, sc)) return; raw.push({ key: `${s.n}.${k}`, isec: s.n, sec: checkDsec(s.n, g, o.t), group: g, text: o.t }); })); });
  const out = [];
  DSECS.forEach((d) => { let n = 0; raw.filter((c) => c.sec === d.n).forEach((c) => { n++; out.push({ ...c, ref: `${d.n}.${n}` }); }); });
  return out;
}
/* Section checks differ by profile, so each profile keeps its own answers. */
function switchProfile(job, to) {
  const from = job.profile || "hmo"; if (from === to) return;
  job.locations.forEach((l) => l.items.forEach((it) => { it.p = it.p || from; }));
  job.checksBy = job.checksBy || {}; job.checksBy[from] = job.checks; job.checks = job.checksBy[to] || {}; delete job.checksBy[to];
  job.conclusions = job.conclusions || {}; job.profile = to;
}
function profileFor(bt) { return /converted|two-flat/i.test(bt || "") ? "smallconv" : /flats/i.test(bt || "") ? "flats" : "hmo"; }
/* Responsible Person names for the cover and sign-off (one per flat where the profile asks for that). */
function units(job = S.job) { const p = PROFILES[job.profile || "hmo"]; return typeof p.rpPerUnit === "function" ? p.rpPerUnit(job.setup || {}) : p.rpPerUnit || null; }
/* One Responsible Person for every flat unless "Same Responsible Person for all flats" is set to No. */
function rpSame(st) { return st.rpSame !== "No"; }
function rpVal(st, i, suffix = "") { return st["rp" + (rpSame(st) ? 1 : i) + suffix] || ""; }
function rpNames(job = S.job) { const u = units(job), st = job.setup; if (!u) return st.rp || "";
  return [...new Set(u.map((x, i) => rpVal(st, i + 1)).filter(Boolean))].join("; ") || st.rp || ""; }
function findings() {
  const out = [];
  checkList().forEach((c) => { const v = S.job.checks[c.key]; if (v?.v === "No") out.push({ src: "check:" + c.key, ref: c.ref, deficiency: `${v.obs ? v.obs.replace(/\.?\s*$/, ". ") : ""}Check ${c.ref} not met: ${c.text}`, text: c.text.replace(/\.$/, "").replace(/^./, (x) => x.toLowerCase()), sec: c.sec, action: v.act, priority: v.pri, basis: v.basis, photos: v.photos }); });
  S.job.locations.forEach((l) => l.items.forEach((it) => {
    const r = itemResult(it);
    if (r === "Fail" || r === "Review") {
      const spec = itemSpec(it);
      const probs = itemProblems(it).join("; ");
      out.push({ src: "item:" + it.id, ref: `${itemDsec(it)}`, action: suggestAction(it), deficiency: `${spec.label} - ${l.floor}, ${l.name}${itemTitle(it) ? " (" + itemTitle(it) + ")" : ""}: ${probs}${it.note ? ". " + it.note : ""}`, sec: itemDsec(it), photos: it.photos });
    }
  }));
  return out;
}
function suggestAction(it) {
  const sug = P().suggest || {}, out = [];
  itemSpec(it).fields.forEach(([key, , t, , bad]) => {
    const v = it.f?.[key];
    const failed = (t === "yn" && v === "No") || (t === "yes" && v === "Yes") || (t === "sel" && bad && bad.includes(v));
    if (failed && sug[it.k + "." + key] && !out.includes(sug[it.k + "." + key])) out.push(sug[it.k + "." + key]);
  });
  if (it.k === "travel" && itemProblems(it).length && sug["travel.dist"]) out.push(sug["travel.dist"]);
  return out.join(" ");
}
function pendingFindings() { const have = new Set(S.job.actions.map((a) => a.src)); return findings().filter((f) => !have.has(f.src)); }

/* risk */
const MATRIX = { Low: ["Trivial", "Tolerable", "Moderate"], Medium: ["Tolerable", "Moderate", "Substantial"], High: ["Moderate", "Substantial", "Intolerable"] };
const CONS = ["Slight harm", "Moderate harm", "Extreme harm"];
function scope(job = S.job) {
  const s = job.setup, t = s.bs9792 || "Type 1";
  const hmo = (job.profile || "hmo") === "hmo", lodgers = hmo && (s.occType || "").startsWith("Owner-occupied");
  /* joint = whole house assessed and the Fire Safety Order does not apply (joint-tenancy shared house, or owner-occupier with lodgers) */
  const joint = lodgers || (hmo && (s.occType || "").startsWith("Shared house") && s.jointTenancy === "Yes");
  const why = lodgers ? "Owner-occupied house with lodgers: normally a private dwelling, outside the Fire Safety Order and outside the HMO definition (Housing Act 2004 Schedule 14; LACORS A.37). Check the number of lodgers against the current HMO regulations."
    : "Shared house let on one joint tenancy with possession of the whole house: the Fire Safety Order does not apply (LACORS para 35.5).";
  const law = lodgers ? "Housing Act 2004 (HHSRS)" : "Housing Act 2004 (HHSRS) and the Management of Houses in Multiple Occupation (Wales) Regulations 2006";
  const hb = heightBand(s);
  return { type: t, conv: job.profile === "flats" && /^Converted/.test(s.flatsType || ""), tempsim: job.profile === "flats" && s.strategy === "Temporary simultaneous", joint, lodgers, why, law, fso: !joint, nonres: s.nonres === "Yes", h11: hb.h11, h18: hb.h18, cat: ((job.profile === "flats" || job.profile === "smallconv") && hb.cat) || "", rooms: joint || t === "Type 3" || t === "Type 4", intrusive: t === "Type 2" || t === "Type 4" };
}
function scopeText(job = S.job) {
  const sc = scope(job);
  if (sc.joint) return `${sc.why} The assessment covers the whole house to inform the ${sc.lodgers ? "owner's" : "landlord's"} duties under the ${sc.law}${sc.lodgers ? "" : " and HMO licensing"}.`;
  const pr = PROFILES[job.profile || "hmo"], u = pr.unit, need = pr.needsUnitDetection(job.setup);
  if (!sc.rooms) return `${sc.type}: common parts only${sc.intrusive ? ", with intrusive sampling" : ", non-intrusive"}. The inside of each ${u.one} is not entered. ${u.Cap} entrance doors are assessed from the common side${need ? `, and detection inside the ${u.many} is confirmed by evidence, as BS 9792 expects for this building` : ""}.`;
  return `${sc.type}: common parts and a sample of the ${u.many}${sc.intrusive ? ", with intrusive sampling" : ", non-intrusive"}. Record which ${u.many} were entered.`;
}
function sheltered(job = S.job) { return job?.profile === "flats" && job.setup?.flatsType === "Sheltered housing"; }
function riskOf(l, c) { return (MATRIX[l] && CONS.indexOf(c) >= 0) ? MATRIX[l][CONS.indexOf(c)] : ""; }

/* ---------------- photos ---------------- */
/* Photos: the date and time taken (from the camera's EXIF data, else the file time) are burnt onto the image
   and kept in job.photoMeta, so the report can show them. */
async function addPhotos(files, target) {
  for (const file of files) {
    try {
      const exif = await exifTaken(file);
      const taken = exif || (file.lastModified ? new Date(file.lastModified) : new Date());
      const data = await shrink(file, stampLabel(taken));
      const p = { id: uid(), data, taken: taken.toISOString() };
      await Store.put("photos", p); S.photoCache.set(p.id, data);
      S.job.photoMeta = S.job.photoMeta || {}; S.job.photoMeta[p.id] = { taken: p.taken, src: exif ? "camera" : "file" };
      target.photos = target.photos || []; target.photos.push(p.id);
    } catch (e) { toast("That photo could not be read."); }
  }
  save();
}
function stampLabel(t) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}${S.job?.setup?.ref ? "  " + S.job.setup.ref : ""}`;
}
/* Minimal EXIF reader: DateTimeOriginal (0x9003) or DateTime (0x0132) from a JPEG. Returns a Date or null. */
async function exifTaken(file) {
  try {
    if (!/jpe?g/i.test(file.type || file.name || "")) return null;
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const m = v.getUint16(o), len = v.getUint16(o + 2);
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = (x) => v.getUint16(x, le), u32 = (x) => v.getUint32(x, le);
        const str = (x, n) => { let r = ""; for (let i = 0; i < n - 1; i++) r += String.fromCharCode(v.getUint8(x + i)); return r; };
        const tag = (ifd, want) => { const n = u16(t + ifd); for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12; if (u16(e) === want) return e; } return 0; };
        const ifd0 = u32(t + 4);
        const sub = tag(ifd0, 0x8769);
        let e = sub ? tag(u32(sub + 8), 0x9003) : 0; if (!e) e = tag(ifd0, 0x0132);
        if (!e) return null;
        const m2 = str(t + u32(e + 8), 20).match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (!m2) return null;
        const dt = new Date(+m2[1], m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6]);
        return isNaN(dt) || m2[1] === "0000" ? null : dt;
      }
      if ((m & 0xFF00) !== 0xFF00) break;
      o += 2 + len;
    }
  } catch { /* no EXIF */ }
  return null;
}
function shrink(file, stamp) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        const g = cv.getContext("2d"); g.drawImage(img, 0, 0, cv.width, cv.height);
        if (stamp) {
          const fs = Math.max(14, Math.round(Math.min(cv.width, cv.height) * 0.035));
          g.font = `600 ${fs}px Arial, Helvetica, sans-serif`;
          const w = g.measureText(stamp).width, pad = Math.round(fs * 0.45);
          g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(cv.width - w - pad * 3, cv.height - fs - pad * 3, w + pad * 2, fs + pad * 2);
          g.fillStyle = "#ffb27a"; g.textBaseline = "top"; g.fillText(stamp, cv.width - w - pad * 2, cv.height - fs - pad * 2);
        }
        res(cv.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
async function photoData(id) {
  if (S.photoCache.has(id)) return S.photoCache.get(id);
  const p = await Store.get("photos", id); if (p) S.photoCache.set(id, p.data); return p?.data;
}
function photoStrip(ids, owner) {
  const thumbs = (ids || []).map((id) => `<button type="button" class="thumb" data-act="photo-view" data-id="${id}" aria-label="View photo"><img data-photo="${id}" alt=""></button>`).join("");
  return `<div class="photos">${thumbs}<label class="addphoto"><input type="file" accept="image/*" capture="environment" multiple data-photo-for="${esc(owner)}" hidden>+ Photo</label></div>`;
}
async function hydratePhotos(root = document) {
  for (const img of root.querySelectorAll("img[data-photo]")) { if (!img.src) img.src = (await photoData(img.dataset.photo)) || ""; }
}

/* ---------------- dictation ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function micBtn(target) { return SR ? `<button type="button" class="mic" data-act="dictate" data-target="${esc(target)}" aria-label="Dictate">Dictate</button>` : ""; }
function dictate(btn) {
  const ta = document.getElementById(btn.dataset.target); if (!ta || !SR) return;
  try {
    const r = new SR(); r.lang = "en-GB"; r.interimResults = false;
    btn.classList.add("on"); btn.textContent = "Listening…";
    r.onresult = (e) => { const t = [...e.results].map((x) => x[0].transcript).join(" "); ta.value = (ta.value ? ta.value.trimEnd() + " " : "") + t; ta.dispatchEvent(new Event("input", { bubbles: true })); };
    r.onend = r.onerror = () => { btn.classList.remove("on"); btn.textContent = "Dictate"; };
    r.start();
  } catch (e) { toast("Dictation is not available here. Use the microphone key on the keyboard."); }
}

/* ---------------- field helpers ---------------- */
function inp(path, label, opts = {}) {
  const v = getPath(S.job, path) ?? "";
  const id = "f_" + path.replace(/\W/g, "_");
  const wide = opts.wide ? " wide" : "";
  if (opts.options && !opts.select && opts.options.length <= 5 && opts.options.every((o) => o.length <= 30)) {
    return `<div class="fld${opts.options.join("").length > 40 ? " wide" : wide}"><span>${label}</span>${seg(path, opts.options, "chips")}</div>`;
  }
  if (opts.options) {
    return `<label class="fld${wide}"><span>${label}</span><select id="${id}" data-bind="${path}"><option value=""></option>${opts.options.map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  }
  if (opts.area) return `<label class="fld wide"><span>${label}</span><textarea id="${id}" data-bind="${path}" rows="${opts.rows || 3}">${esc(v)}</textarea>${micBtn(id)}</label>`;
  return `<label class="fld${wide}"><span>${label}</span><input id="${id}" data-bind="${path}" type="${opts.type || "text"}" value="${esc(v)}"${opts.inputmode ? ` inputmode="${opts.inputmode}"` : ""}></label>`;
}
function seg(path, options, cls = "") {
  const v = getPath(S.job, path) ?? "";
  return `<div class="seg ${cls}" role="group">${options.map((o) => `<button type="button" data-act="seg" data-path="${path}" data-val="${esc(o)}" class="${o === v ? "on" : ""}${o === "No" ? " neg" : ""}">${esc(o === "NA" ? "N/A" : o)}</button>`).join("")}</div>`;
}

/* ---------------- views ---------------- */
/* The assessment is one linear flow of eight steps. This list drives the side rail (tablet), the step bar (phone),
   the Overview checklist and the heading on every screen, so the numbering is the same everywhere. */
const STEPS = [
  ["setup", "Details", "before"], ["building", "Building", "before"],
  ["walk", "Walk-through", "site"], ["checks", "Section checks", "site"], ["management", "Management", "site"],
  ["risk", "Risk rating", "write"], ["actions", "Action plan", "write"], ["report", "Report", "write"]];
const PHASES = { before: "Before you start", site: "On site", write: "Write-up" };
const NAV = [["home", "Overview"], ...STEPS.map(([k, l]) => [k, l])];
const stepNo = (k) => STEPS.findIndex(([s]) => s === k) + 1;
const stepName = (k) => (NAV.find(([s]) => s === k) || [])[1] || "";
function head(k, lead) { return `<header class="stephead"><p class="eyebrow">Step ${stepNo(k)} of ${STEPS.length}</p><h2 class="h">${esc(stepName(k))}</h2>${lead ? `<p class="muted lead">${lead}</p>` : ""}</header>`; }
function nextBtn(k) { const n = STEPS[stepNo(k)]; return n ? `<div class="next"><button class="primary" data-act="nav" data-view="${n[0]}">Next: ${esc(n[1])} ${ico("next")}</button></div>` : ""; }
/* A collapsible card. Its open/closed state survives re-renders (S.open, set by the toggle listener). */
function grp(key, title, summary, body, def = false) {
  const open = S.open?.[key] ?? def;
  return `<details class="group" data-open="${key}"${open ? " open" : ""}><summary><span><strong>${esc(title)}</strong>${summary ? `<small>${summary}</small>` : ""}</span>${ico("next")}</summary><div class="groupbody">${body}</div></details>`;
}
function filled(paths) { const n = paths.filter((p) => String(getPath(S.job, p) ?? "").trim()).length; return n === paths.length ? `<b class="okc">✓ Complete</b>` : `${n} of ${paths.length} filled in`; }
function withJob(j, fn) { const o = S.job; S.job = j; try { return fn(); } finally { S.job = o; } }

function render() {
  const app = $("#app");
  if (!S.job || S.view === "jobs") { app.innerHTML = viewJobs(); bindCommon(); return; }
  const v = { home: viewHome, setup: viewSetup, building: viewBuilding, walk: viewWalk, checks: viewChecks, management: viewManagement, risk: viewRisk, actions: viewActions, report: viewReport }[S.view] || viewHome;
  const pr = progress(), i = stepNo(S.view), prev = i > 1 ? STEPS[i - 2] : null, next = STEPS[i] || null;
  app.innerHTML = `
  <div class="shell">
    <header class="top"><div class="topin">
      <button class="back" data-act="go-jobs" aria-label="All jobs">All jobs</button>
      <div class="jobtitle"><strong>${esc(S.job.setup.address || "New assessment")}</strong><span>${esc(S.job.setup.ref || "")}${S.job.example ? " · Example" : ""}</span></div>
      <span id="savestate" class="saved">Saved on this device</span>
    </div></header>
    <nav class="rail" aria-label="Assessment steps">${NAV.map(([k, l]) => { const p = pr[k], n = stepNo(k);
      return `<button data-act="nav" data-view="${k}" class="${S.view === k ? "on" : ""}${p?.done ? " done" : ""}"${S.view === k ? ' aria-current="page"' : ""}><i>${k === "home" ? ico("grid") : p?.done ? "✓" : n}</i><span>${l}</span>${k === "actions" && pr.pend ? `<b class="badge">${pr.pend}</b>` : ""}</button>`; }).join("")}</nav>
    <main class="main">${v()}</main>
    <nav class="stepbar" aria-label="Steps">
      <button data-act="nav" data-view="home" class="sb-home${S.view === "home" ? " on" : ""}">${ico("grid")}<span>Overview</span></button>
      ${prev ? `<button data-act="nav" data-view="${prev[0]}" class="sb-prev" aria-label="Back to ${esc(prev[1])}">${ico("back")}</button>` : "<span></span>"}
      <button data-act="nav" data-view="home" class="sb-now" aria-label="Show all steps"><small>${i ? `Step ${i} of ${STEPS.length}` : `${pr.done} of ${STEPS.length} steps done`}</small><strong>${esc(i ? stepName(S.view) : "Overview")}</strong><span class="sb-dots">${STEPS.map(([k]) => `<i class="${pr[k].done ? "d" : ""}${k === S.view ? " c" : ""}"></i>`).join("")}</span></button>
      ${next ? `<button data-act="nav" data-view="${next[0]}" class="sb-next">${esc(next[1])} ${ico("next")}</button>` : "<span></span>"}
    </nav>
  </div>`;
  bindCommon(); hydratePhotos();
  requestAnimationFrame(() => { document.querySelectorAll(".tabs button.on, .locpills button.on").forEach((b) => b.scrollIntoView({ inline: "center", block: "nearest" })); });
}

function viewJobs() {
  const list = S.jobs.slice().sort((a, b) => b.updated.localeCompare(a.updated));
  return `<div class="jobs">
    <div class="brand"><div class="brandin"><div><p class="eyebrow">Partridge Fire Safety</p><h1>Fire risk assessments</h1>
      <p class="lede">Works without signal. Jobs and photos stay on this device until you export them.</p></div>
      <button class="primary" data-act="new-job">${ico("plus")} New assessment</button></div></div>
    <div class="jobsbody">
      <ul class="joblist">${list.length ? list.map((j) => {
        let pr; try { pr = withJob(j, () => progress(j)); } catch { pr = { pct: 0, done: 0, next: "setup" }; }
        const rating = riskOf(j.risk.likelihood, j.risk.consequence);
        return `<li><button class="jobcard" data-act="open-job" data-id="${j.id}">
          <span class="jc-main"><strong>${esc(j.setup.address || "Untitled assessment")}</strong>
          <span class="muted">${esc(j.setup.occType || j.setup.buildingType || "")}${j.setup.storeys ? " · " + esc(j.setup.storeys) + " storeys" : ""}${j.setup.date ? " · " + ukDate(j.setup.date) : ""}</span>
          <span class="jc-prog"><span class="bar"><i style="width:${Math.round(pr.pct * 100)}%"></i></span><small>${pr.done === STEPS.length ? "All steps complete" : `${pr.done} of ${STEPS.length} steps done · next: ${esc(stepName(pr.next))}`}</small></span></span>
          <span class="jc-meta">${j.example ? `<em class="pill">Example</em>` : ""}${rating ? `<em class="pill r-${rating}">${rating}</em>` : ""}${ico("next")}</span>
        </button></li>`; }).join("") : `<li class="empty">No assessments yet. Start one with New assessment.</li>`}</ul>
      <div class="backup"><h2>Backup</h2><p class="muted">Export saves every job and photo to one file. Keep a copy off the device.</p>
        <div class="row"><button data-act="export-all">Export all jobs</button><label class="btn"><input type="file" accept="application/json,.json" data-act-change="import" hidden>Import backup</label></div>
        ${Store.ok ? "" : `<p class="warn">This browser is not letting the app store data. Anything you enter will be lost when the page closes; export before leaving.</p>`}
      </div>
    </div></div>`;
}

function viewSetup() {
  const s = "setup.", st = S.job.setup, prof = P(), u = units(), sc = scope();
  const sub = prof.subtype.filter(([, , , show]) => !show || show(st));
  const rpBody = (u ? `<div class="grid">${inp(s + "rpSame", "Same Responsible Person for all flats?", { options: ["Yes", "No"] })}</div>`
      + (rpSame(st) ? u.slice(0, 1) : u).map((un, i) => { const k = s + "rp" + (i + 1); return `<h3>${rpSame(st) ? "All flats" : esc(un)}</h3><div class="grid">${inp(k, "Name", { wide: true })}${inp(k + "Status", "Status at date of assessment", { options: ["Landlord / owner", "Tenant", "Managing agent", "Other"] })}${inp(k + "Occ", rpSame(st) ? "Flats at date of assessment" : `${esc(un)} at date of assessment`, { options: ["Occupied", "Vacant", "Not known"] })}${inp(k + "Tel", "Telephone", { type: "tel" })}${inp(k + "Email", "Email", { type: "email" })}${inp(k + "Addr", "Address for service (if different)", { wide: true })}${inp(k + "Basis", "Basis on which identified", { wide: true })}</div>`; }).join("")
      + `<h3>Managing agent or other Responsible Person (if any)</h3>` : "")
    + `<div class="grid">${inp(s + "rp", u ? "Name (leave blank if none)" : "Name", { wide: true })}${inp(s + "rpTel", "Telephone", { type: "tel" })}${inp(s + "rpEmail", "Email", { type: "email" })}${inp(s + "rpBasis", "Basis on which identified", { wide: true })}${inp(s + "agent", "Managing agent (if different)", { wide: true })}</div>`;
  const lic = prof.licensing && !sc.lodgers;
  return `<section class="pane">${head("setup", "Only the first card is needed to start. The rest can be filled in at any time.")}
  <div class="grid">${inp(s + "address", "Premises address", { wide: true })}${inp(s + "postcode", "Postcode")}
  ${inp(s + "buildingType", "Building type", { options: ["HMO", "Block of flats (common parts)", "House converted into flats", "Commercial unit", "Industrial building", "Mixed use"] })}
  ${sub.map(([k, label, opts], i) => inp(s + k, label, Array.isArray(opts) ? { options: opts, wide: i === 0 } : { inputmode: "numeric" })).join("")}
  ${inp(s + "bs9792", "BS 9792 assessment type", { options: prof.types || ["Type 1", "Type 2", "Type 3", "Type 4"] })}</div>
  ${/^(Commercial|Industrial|Mixed)/.test(st.buildingType || "") ? `<p class="note">The PAS 79-1 profile for non-housing buildings is not built yet. For flats or an HMO above a shop, choose Flats or HMO and answer "Shop or other non-residential use".</p>` : ""}
  <p class="note"><strong>Scope.</strong> ${esc(scopeText())}${sc.cat ? ` <strong>Height:</strong> ${esc(sc.cat)} (Building Safety (Wales) Act 2026, provisional)${sc.h18 ? "; over 18 m checks added" : sc.h11 ? "; 11 m+ checks added" : ""}.` : ""}${prof.typesNote ? ` ${esc(prof.typesNote)}` : ""}</p>
  ${grp("s-rp", "Responsible Person", rpNames() ? esc(rpNames()) : "Not added yet", rpBody, !rpNames())}
  ${lic ? grp("s-lic", "HMO licensing", filled([s + "licence", s + "licenceExp", s + "licenceHolder", s + "la", s + "rsw"]), `<div class="grid">${inp(s + "licence", "HMO licence number")}${inp(s + "licenceExp", "Licence expiry", { type: "date" })}${inp(s + "licenceHolder", "Licence holder")}${inp(s + "la", "Local authority")}${inp(s + "rsw", "Rent Smart Wales ref")}</div>`) : ""}
  ${grp("s-visit", "Visit", filled([s + "date", s + "arrived", s + "departed", s + "present", s + "enforcer"]), `<div class="grid">${inp(s + "date", "Date of assessment", { type: "date" })}${inp(s + "arrived", "Time arrived", { type: "time" })}${inp(s + "departed", "Time departed", { type: "time" })}${inp(s + "present", "Person present / access by")}${inp(s + "enforcer", "Enforcing authority")}</div>`)}
  ${grp("s-report", "Report reference and assessor", `${esc(st.ref || "No reference yet")} · ${esc(st.assessor || "No assessor")}`, `<div class="grid">${inp(s + "ref", "Report reference")}${inp(s + "review", "Next review due", { type: "date" })}${inp(s + "assessor", "Assessor")}${inp(s + "quals", "Qualifications")}${inp(s + "company", "Company")}</div>`)}
  ${nextBtn("setup")}</section>`;
}

function viewBuilding() {
  const o = "overview.", bm = bench(), pr = P(), V = S.job.overview.vulnerable || {};
  const picked = pr.vulnerable.map((g, i) => [g, i]).filter(([, i]) => V["v" + i]?.v === "Yes");
  const none = pr.vulnerable.every((g, i) => V["v" + i]?.v === "No");
  return `<section class="pane">${head("building")}
  <div class="fld wide cover"><span>Front of the building (report cover photo)</span>${photoStrip(S.job.cover?.photos, "cover:x")}</div>
  <details class="bench"${window.innerWidth > 760 ? " open" : ""}><summary><h3>Benchmarks for this building</h3></summary>${bm.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}
  <dl>${bm.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  <p class="src">${S.job.profile !== "hmo" ? "BS 9792:2025; Approved Document B Vol 2 (Wales); LACORS Table C4; BS 5839-6:2019+A1:2020." : "LACORS Housing - Fire Safety case studies D4-D9 and Tables C4-C5; BS 5839-6:2019+A1:2020 Table 1."} Benchmarks are guidance for normal risk; go higher where the occupants or layout warrant it.</p></details>
  <h3>Construction</h3><div class="grid">${inp(o + "year", "Approx. year built")}${inp(o + "construction", "Main structure and walls", { wide: true })}
  ${inp(o + "basement", "Basement / cellar", { options: ["No", "Yes"] })}${inp(o + "loft", "Loft conversion", { options: ["No", "Yes"] })}
  ${inp(o + "sprinkler", "Sprinklers / suppression", { options: ["None", "Sprinklers BS 9251", "Sprinklers BS EN 12845", "Water mist", "Not known"] })}
  ${inp(o + "layout", "Layout and common parts", { area: true })}</div>
  ${grp("b-more", "More construction details", filled([o + "roof", o + "floors", o + "cladding", o + "fires"]), `<div class="grid">${inp(o + "roof", "Roof")}${inp(o + "floors", "Floors")}${inp(o + "cladding", "Cladding or attachments")}${inp(o + "fires", "Fire history", { area: true, rows: 2 })}</div>`)}
  <h3>Occupants</h3><div class="grid">${inp(o + "occupancy", "Occupancy type", { options: ["Permanent tenants", "Students", "Short-term / transient", "Supported or vulnerable tenants", "Mixed"] })}
  ${inp(o + "sleep", "Sleeping risk", { options: ["Yes - all floors", "Yes - some floors", "No"] })}
  <div class="fld wide"><span>Vulnerable occupants: tap any that apply</span><div class="chipset vul">${pr.vulnerable.map((g, i) => `<button type="button" data-act="vul" data-i="${i}" class="${V["v" + i]?.v === "Yes" ? "on" : ""}">${esc(g)}</button>`).join("")}<button type="button" data-act="vulnone" class="${none ? "on" : ""}">None known</button></div></div>
  ${picked.map(([g, i]) => inp(`overview.vulnerable.v${i}.n`, `${esc(g)}: notes and arrangements`, { wide: true })).join("")}</div>
  <h3>Inside the ${P().unit.many}</h3><div class="grid">${inp(o + "detInside", `Detection inside ${P().unit.many} confirmed by`, { options: [`Witnessed in ${P().unit.many} entered`, "Installer certificate", "Responsible Person statement", "Tenant confirmation", "Not confirmed"] })}
  ${inp(o + "roomsEntered", scope().rooms ? `${P().unit.Cap}s entered` : `${P().unit.Cap}s entered (none for this type)`, {})}</div>
  ${nextBtn("building")}</section>`;
}

function viewWalk() {
  const locs = S.job.locations;
  if (!S.loc || !locs.find((l) => l.id === S.loc)) S.loc = locs[0]?.id || null;
  const loc = locs.find((l) => l.id === S.loc);
  const sc = scope(), qa = P().quickAdds.filter((q) => (!q.nonHousing || S.showAll) && shown(q.when, sc));
  return `<section class="pane walk">${head("walk", "Add each location as you reach it, then tap what you find there.")}
  <div class="walkgrid">
    <aside class="locs"><h3>Locations</h3>
      <ul>${locs.map((l) => { const f = l.items.filter((it) => itemResult(it) !== "Pass").length; return `<li><button data-act="loc" data-id="${l.id}" class="${l.id === S.loc ? "on" : ""}"><span>${esc(l.name)}${l.area === "Letting" ? ` <em class="pill">${P().unit.Cap}</em>` : ""}</span><small>${esc(l.floor)} · ${l.items.length}${f ? ` · <b class="neg">${f} to act</b>` : ""}</small></button></li>`; }).join("")}</ul>
      <form class="addloc" data-form="addloc"><select id="nl_floor" aria-label="Floor">${["Basement", "Ground floor", "First floor", "Second floor", "Third floor", "Fourth floor", "Fifth floor", "Loft", "External"].map((f) => `<option>${f}</option>`).join("")}</select>
      <select id="nl_area" aria-label="Area"><option>Common part</option><option value="Letting"${scope().rooms ? "" : " disabled"}>${P().unit.Cap}</option></select>
      <input id="nl_name" placeholder="Room or area, e.g. Landing" aria-label="Location name" required><button class="primary">Add location</button>
      ${scope().rooms ? "" : `<p class="muted small">${esc(scope().type)}: ${P().unit.many} are not entered. Record ${P().unit.one} entrance doors from the common side.</p>`}</form>
    </aside>
    <div class="locbody">${loc ? `
      <div class="locpills" role="tablist" aria-label="Locations">${locs.map((l) => { const f = l.items.filter((it) => itemResult(it) !== "Pass").length; return `<button role="tab" aria-selected="${l.id === S.loc}" class="${l.id === S.loc ? "on" : ""}" data-act="loc" data-id="${l.id}"><small>${esc(l.floor)}</small>${esc(l.name)}${f ? `<b class="dot">${f}</b>` : ""}</button>`; }).join("")}<button class="addpill" data-act="locsheet" aria-label="Add a location">${ico("plus")}</button></div>
      <div class="lochead"><div><p class="eyebrow">${esc(loc.floor)}</p><h3>${esc(loc.name)}</h3></div><button class="ghost danger" data-act="del-loc" data-id="${loc.id}">Remove location</button></div>
      <div class="qa">${qa.filter((q) => q.front).map((q) => `<button class="qabtn" data-act="qa" data-k="${q.k}">${ico(QA_ICON[q.k] || "plus")}<span>${esc(QA_SHORT[q.k] || q.label)}</span></button>`).join("")}
        <details class="more"><summary>More items</summary><div class="qa">${qa.filter((q) => !q.front).map((q) => `<button class="qabtn" data-act="qa" data-k="${q.k}">+ ${esc(q.label)}</button>`).join("")}
        <label class="tog"><input type="checkbox" data-act-change="showall"${S.showAll ? " checked" : ""}> Show non-housing items</label></div></details></div>
      <ul class="items">${loc.items.map((it) => { const r = itemResult(it), sp = itemSpec(it), pr = itemProblems(it); return `<li class="item r-${r}">
        <button class="itemmain" data-act="qa-edit" data-id="${it.id}"><span class="tag">${esc(sp?.label)}</span><strong>${esc(itemTitle(it) || sp?.label)}</strong>
        <span class="muted">${pr.length ? esc(pr.join("; ")) : "No deficiencies recorded"}</span></button><span class="res">${r}</span></li>`; }).join("") || `<li class="empty">Nothing recorded here yet. Tap an item above as you come to it.</li>`}</ul>
      <div class="next"><button data-act="nav" data-view="checks">Section checks</button></div>` : `<div class="empty big">Add the first location to start the walk-through. Record doors, detectors and lights as you pass them.</div>`}
    </div></div></section>`;
}

function itemForm(item, locId) {
  const spec = itemSpec(item);
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(spec.label)}"><form class="sheetin" data-form="item" data-id="${item.id}" data-loc="${locId}">
    <div class="sheethead"><h3>${esc(spec.label)}</h3><span class="muted">Files into section ${itemDsec(item)}</span><button type="button" class="ghost" data-act="close-sheet">Cancel</button></div>
    <div class="sheetbody">${spec.fields.some(([, , t]) => t === "yn" || t === "yes") ? `<div class="qf wide allok"><button type="button" data-act="allok">✓ All satisfactory</button><small class="muted">Sets every Yes/No question to its OK answer. Change any that aren't.</small></div>` : ""}${spec.fields.map(([k, label, t, opts, bad]) => {
      const v = item.f?.[k] ?? ""; const id = "q_" + k;
      if (t === "yn" || t === "yes") return `<div class="qf"><span>${esc(label)}</span><div class="seg">${["Yes", "No", "N/A"].map((o) => `<button type="button" data-act="qseg" data-k="${k}" data-val="${o}" class="${v === o ? "on" : ""}${(t === "yn" && o === "No") || (t === "yes" && o === "Yes") ? " neg" : ""}">${o}</button>`).join("")}</div><input type="hidden" name="${k}" value="${esc(v)}"></div>`;
      if (t === "sel" && opts.length <= 7) return `<div class="qf wide"><span>${esc(label)}</span><div class="chipset">${opts.map((o) => `<button type="button" data-act="qseg" data-k="${k}" data-val="${esc(o)}" class="${o === v ? "on" : ""}${bad && bad.includes(o) ? " neg" : ""}">${esc(o)}</button>`).join("")}</div><input type="hidden" name="${k}" value="${esc(v)}"></div>`;
      if (t === "sel") return `<label class="qf"><span>${esc(label)}</span><select id="${id}" name="${k}"><option value=""></option>${opts.map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
      return `<label class="qf"><span>${esc(label)}</span><input id="${id}" name="${k}" value="${esc(v)}"${t === "num" ? ` inputmode="decimal"` : ""}></label>`;
    }).join("")}
      <label class="qf wide"><span>Note</span><textarea id="q_note" name="note" rows="3">${esc(item.note || "")}</textarea>${micBtn("q_note")}</label>
      <div class="qf wide"><span>Result</span><div class="chipset">${[["", "Auto"], ["Pass", "Pass"], ["Fail", "Fail"], ["Review", "Review"], ["Note only", "Note only"]].map(([val, lab]) => `<button type="button" data-act="qseg" data-k="result" data-val="${val}" class="${(item.result || "") === val ? "on" : ""}">${lab}</button>`).join("")}</div><input type="hidden" name="result" value="${esc(item.result || "")}"></div>
      <div class="qf wide"><span>Photos</span>${photoStrip(item.photos, "item:" + item.id)}</div>
    </div>
    <div class="sheetfoot">${item._new ? "" : `<button type="button" class="ghost danger" data-act="del-item" data-id="${item.id}" data-loc="${locId}">Delete</button>`}${item._new ? `<button name="again" value="1">Save & add another</button>` : ""}<button class="primary">Save</button></div>
  </form></div>`;
}


/* ---------------- icons (inline, stroke) ---------------- */
const ICON = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  setup: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  building: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5h6v5M8 11h2M14 11h2"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M11 21l2-6 3 3v3M9 13l2-5 4 2 2 3M8 10l-2 4"/>',
  checks: '<path d="M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3"/><path d="M12 7h8M12 14h8M12 21h8"/>',
  management: '<path d="M7 3h10v4H7z"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 12h8M8 16h6"/>',
  risk: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/><circle cx="12" cy="18" r="1.5"/>',
  actions: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  door: '<path d="M6 21V4h12v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12.5" r="1"/>',
  detector: '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="2.5"/><path d="M9 20h6"/>',
  light: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>',
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  flame: '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 2 2 2 5 2 8 0 3-2 6-6 6z"/>',
  wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>',
  exit: '<path d="M14 4h6v16h-6"/><path d="M4 12h10M10 8l4 4-4 4"/>',
  ext: '<path d="M9 8h6v13H9z"/><path d="M10 8V5h4v3M14 5l4-2M12 12v4"/>',
  plug: '<path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  lift: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/>',
  sign: '<rect x="3" y="6" width="18" height="10" rx="1.5"/><path d="M7 11h6M11 8l3 3-3 3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', list: '<path d="M4 6h16M4 12h16M4 18h16"/>', cards: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5V3h8v2"/>'
};
const QA_ICON = { door: "door", flatdoor: "door", hold: "door", detector: "detector", alarm: "bell", el: "light", travel: "ruler", escape: "route", stairs: "stairs", extstair: "stairs",
  comb: "flame", firestop: "wall", comp: "wall", riser: "wall", sample: "wall", elec: "plug", iso: "plug", exit: "exit", width: "ruler", ext: "ext", supp: "ext", sign: "sign", lift: "lift", unit: "home" };
const QA_SHORT = { flatdoor: "Flat door", detector: "Alarm", el: "Light", travel: "Travel", escape: "Route", exit: "Exit", comb: "Storage", firestop: "Fire stopping", unit: "Inside flat", sample: "Sample", extstair: "Ext. stair" };
const ico = (k, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ""}</svg>`;

/* ---------------- job overview: progress through the eight steps ---------------- */
/* Each step: pct (0-1, drives the bars), done (ticked), line (what is left, in plain words). */
function progress(job = S.job) {
  const st = job.setup, prof = PROFILES[job.profile || "hmo"], cl = checkList(job);
  const msec = (dsecs(job).find((s) => s.management) || {}).n;
  const cks = cl.filter((c) => c.sec !== msec), mck = cl.filter((c) => c.sec === msec);
  const ans = (l) => l.filter((c) => job.checks[c.key]?.v).length;
  const no = cks.filter((c) => job.checks[c.key]?.v === "No").length;
  const items = job.locations.reduce((a, l) => a + l.items.length, 0), fails = job.locations.reduce((a, l) => a + l.items.filter((it) => itemResult(it) !== "Pass").length, 0);
  const miss = [!st.address && "address", !st[prof.subtypeKey] && prof.subtypeLabel.toLowerCase(), !rpNames(job) && "Responsible Person", !st.date && "date"].filter(Boolean);
  const bNeed = [["construction", job.overview.construction], ["layout", job.overview.layout], ["occupancy", job.overview.occupancy]]
    .concat(prof.needsUnitDetection(st) ? [[`detection inside the ${prof.unit.many}`, job.overview.detInside]] : []);
  const bMiss = bNeed.filter(([, v]) => !v).map(([k]) => k);
  const docs = prof.documents.filter((d, i) => job.docs?.["d" + i]?.s).length, mTot = prof.documents.length + mck.length, mDone = docs + ans(mck);
  const r = riskOf(job.risk.likelihood, job.risk.consequence), pend = pendingFindings().length, fnd = findings().length;
  const inc = job.actions.filter((a) => !a.priority || !a.basis || !(a.action || "").trim()).length;
  const warn = readiness().length;
  const out = {
    setup: { pct: 1 - miss.length / 4, line: miss.length ? `Add the ${miss.join(", ")}` : "Done" },
    building: { pct: 1 - bMiss.length / bNeed.length, line: bMiss.length ? `Add the ${bMiss.join(", ")}` : "Done" },
    walk: { pct: items ? 1 : 0, line: items ? `${items} item${items > 1 ? "s" : ""} in ${job.locations.length} location${job.locations.length > 1 ? "s" : ""}${fails ? ` · ${fails} to act on` : ""}` : "Nothing recorded yet" },
    checks: { pct: cks.length ? ans(cks) / cks.length : 0, line: `${ans(cks)} of ${cks.length} answered${no ? ` · ${no} deficienc${no > 1 ? "ies" : "y"}` : ""}` },
    management: { pct: mTot ? mDone / mTot : 1, line: mDone === mTot ? "Done" : `${docs} of ${prof.documents.length} documents · ${ans(mck)} of ${mck.length} checks` },
    risk: { pct: r ? (job.risk.justification ? 1 : 0.6) : 0, line: r ? (job.risk.justification ? r : `${r} · add your reasons`) : "Not rated yet" },
    actions: { pct: pend || inc ? 0.5 : (job.actions.length || (fnd === 0 && ans(cks) > 0)) ? 1 : 0,
      line: pend ? `${pend} finding${pend > 1 ? "s" : ""} to add to the plan` : inc ? `${inc} action${inc > 1 ? "s" : ""} to finish` : job.actions.length ? `${job.actions.length} action${job.actions.length > 1 ? "s" : ""}` : "No findings yet" },
    report: { pct: warn ? Math.max(0.1, 1 - warn / 15) : 1, line: warn ? `${warn} thing${warn > 1 ? "s" : ""} to check before issue` : "Ready to issue" }
  };
  STEPS.forEach(([k]) => { out[k].done = out[k].pct >= 1; });
  out.done = STEPS.filter(([k]) => out[k].done).length;
  out.pct = STEPS.reduce((a, [k]) => a + Math.min(1, out[k].pct), 0) / STEPS.length;
  out.next = (STEPS.find(([k]) => !out[k].done) || ["report"])[0];
  out.pend = pend; out.findings = fnd;
  return out;
}
function viewHome() {
  const pr = progress(), st = S.job.setup, r = riskOf(S.job.risk.likelihood, S.job.risk.consequence);
  const nk = pr.next, all = pr.done === STEPS.length;
  const photos = Object.keys(S.job.photoMeta || {}).length;
  let lastPh;
  return `<section class="pane home">
    ${S.storeWarn ? `<div class="storewarn" role="alert"><span>${esc(S.storeWarn)}</span><button type="button" class="ghost" data-act="export-job">Export backup</button><button type="button" class="ghost" data-act="dismiss-warn" aria-label="Dismiss">✕</button></div>` : ""}
    <div class="hero"><div class="herotxt"><p class="eyebrow">${esc(P().title)}${st.bs9792 ? " · " + esc(st.bs9792) : ""}</p><h2>${esc(st.address || "New assessment")}</h2>
      <p class="muted">${esc(st.ref || "No reference yet")}${st.date ? " · " + esc(ukDate(st.date)) : ""}</p></div>
      ${r ? `<em class="pill r-${r}">${r}</em>` : ""}
      <div class="hprog"><div class="hbar"><i style="width:${Math.round(pr.pct * 100)}%"></i></div><small><b>${pr.done} of ${STEPS.length} steps complete</b> · ${Math.round(pr.pct * 100)}%</small></div></div>
    <button class="primary carry" data-act="nav" data-view="${nk}">${ico(nk)}<span><small>${all ? "All steps complete" : `Continue · step ${stepNo(nk)}`}</small>${esc(stepName(nk))}: ${esc(pr[nk].line)}</span>${ico("next")}</button>
    <div class="stats"><div><b>${pr.findings}</b><small>Deficienc${pr.findings === 1 ? "y" : "ies"}</small></div><div><b>${S.job.actions.length}</b><small>Action${S.job.actions.length === 1 ? "" : "s"}</small></div><div><b>${photos}</b><small>Photo${photos === 1 ? "" : "s"}</small></div></div>
    <ol class="steplist">${STEPS.map(([k, l, ph], i) => { const p = pr[k], h = ph !== lastPh ? `<li class="phase">${PHASES[ph]}</li>` : ""; lastPh = ph;
      return `${h}<li><button class="step${p.done ? " done" : p.pct > 0 ? " part" : ""}${k === nk && !all ? " nextup" : ""}" data-act="nav" data-view="${k}"><span class="sn">${p.done ? "✓" : i + 1}</span><span class="st"><strong>${esc(l)}</strong><small>${esc(p.line)}</small>${!p.done && p.pct > 0 ? `<span class="bar"><i style="width:${Math.round(p.pct * 100)}%"></i></span>` : ""}</span>${ico("next")}</button></li>`; }).join("")}</ol>
  </section>`;
}

/* ---------------- checks, one at a time ---------------- */
const PHRASES = ["Clear on the day of the assessment.", "Visual inspection only.", "Certificate sighted (date / reference): ", "Confirmed by the Responsible Person.",
  "Not inspected: inside the flats, outside the scope.", "Not present at this property.", "Photo taken.", "Recommend specialist inspection."];
function guidedBlock(s) {
  const items = checkList().filter((c) => c.sec === s.n);
  if (S.gi == null || S.gi > items.length) { const f = items.findIndex((c) => !S.job.checks[c.key]?.v); S.gi = f < 0 ? items.length : f; }
  const done = items.filter((c) => S.job.checks[c.key]?.v).length;
  const bar = `<div class="gprog"><span class="bar"><i style="width:${items.length ? Math.round(done / items.length * 100) : 0}%"></i></span><small>${done}/${items.length}</small></div>`;
  if (S.gi >= items.length) {
    const secs = dsecs().filter((x) => !x.management), i = secs.findIndex((x) => x.n === s.n), nx = secs[i + 1];
    return `${bar}<div class="gcard end"><h3>Section ${s.n} done</h3><p class="muted">${done}/${items.length} answered${items.some((c) => S.job.checks[c.key]?.v === "No") ? " · deficiencies go to the action plan" : ""}.</p>
      ${((P().sectionFields || {})[s.n] || []).length ? `<div class="grid">${P().sectionFields[s.n].map(([k, lab, o]) => inp("sf." + k, lab, Array.isArray(o) ? { options: o, wide: true } : o === "area" ? { area: true, rows: 2 } : {})).join("")}</div>` : ""}
      <div class="concl"><span>Section conclusion</span>${seg(`conclusions.c${s.n}`, ["Satisfactory", "Action required", "Not applicable"])}</div>
      <div class="gnav"><button data-act="gstep" data-d="-1">${ico("back")} Back</button>${nx ? `<button class="primary" data-act="sec" data-n="${nx.n}">Section ${nx.n}: ${esc(nx.title)} ${ico("next")}</button>` : `<button class="primary" data-act="nav" data-view="management">Management ${ico("next")}</button>`}</div></div>`;
  }
  const c = items[S.gi], v = S.job.checks[c.key] || {}, id = "gobs_" + c.key.replace(".", "_");
  const evid = !scope().rooms && (P().roomChecks || []).includes(c.key) ? `<p class="evid">${esc(scope().type)}: inside the ${P().unit.many} is not inspected. Say how this was confirmed.</p>` : "";
  return `${bar}<div class="gcard${v.v === "No" ? " isno" : ""}">
    ${c.group ? `<p class="eyebrow">${esc(c.group)}</p>` : ""}<p class="gref">${c.ref}</p><p class="gtext">${esc(c.text)}</p>${evid}
    <div class="gans">${["Yes", "No", "NA"].map((o) => `<button type="button" class="${v.v === o ? "on " : ""}${o === "No" ? "neg" : o === "Yes" ? "pos" : ""}" data-act="gans" data-key="${c.key}" data-val="${o}">${o === "NA" ? "N/A" : o}</button>`).join("")}</div>
    <div class="gobs${v.v === "No" || v.obs || S.gnote ? "" : " hide"}"><textarea id="${id}" rows="3" placeholder="${v.v === "No" ? "What is wrong, where, and what was seen" : "Observations / evidence"}" data-bind="checks.${c.key}.obs">${esc(v.obs || "")}</textarea>
      <div class="chips">${PHRASES.map((p, i) => `<button type="button" data-act="phrase" data-id="${id}" data-i="${i}">${esc(p.replace(/: $/, ""))}</button>`).join("")}</div>
      <div class="gtools"><button type="button" class="libbtn" data-act="libopen" data-key="${c.key}">${ico("list")} My findings</button>${micBtn(id)}${photoStrip(v.photos, "check:" + c.key)}</div>${v.act ? `<p class="libact"><b>Action${v.pri ? " · " + v.pri : ""}:</b> ${esc(v.act)}</p>` : ""}</div>
    ${v.v === "No" || v.obs || S.gnote ? "" : `<div class="gmore"><button type="button" class="ghost" data-act="gnote">+ Note or photo</button><button type="button" class="ghost" data-act="libopen" data-key="${c.key}">${ico("list")} Pick a finding</button></div>`}
    <div class="gnav"><button data-act="gstep" data-d="-1"${S.gi ? "" : " disabled"}>${ico("back")} Back</button><button data-act="gstep" data-d="1">${v.v ? "Next" : "Skip"} ${ico("next")}</button></div>
    ${swipedBefore() ? "" : `<p class="swipehint">Tip: swipe the card right for <b>Yes</b>, left for <b>No</b></p>`}
  </div>`;
}

function viewChecks() {
  const secs = dsecs().filter((s) => !s.management);
  if (!secs.find((s) => s.n === S.sec)) S.sec = secs[0].n;
  if (S.guided == null) S.guided = window.innerWidth <= 760;
  return `<section class="pane">${head("checks")}
  <div class="tabs">${secs.map((s) => { const st = secStatus(s); return `<button data-act="sec" data-n="${s.n}" class="${S.sec === s.n ? "on" : ""}">${s.n}. ${esc(s.title)}<small>${st}</small></button>`; }).join("")}</div>
  <div class="modeswitch" role="group" aria-label="View"><button class="${S.guided ? "on" : ""}" data-act="gmode" data-on="1">${ico("cards")} One at a time</button><button class="${S.guided ? "" : "on"}" data-act="gmode" data-on="0">${ico("list")} Whole list</button></div>
  ${S.guided ? guidedBlock(secs.find((s) => s.n === S.sec)) : checksBlock(secs.find((s) => s.n === S.sec))}</section>`;
}
function secStatus(s) {
  const refs = checkList().filter((c) => c.sec === s.n); const done = refs.filter((c) => S.job.checks[c.key]?.v).length;
  const no = refs.filter((c) => S.job.checks[c.key]?.v === "No").length;
  return `${done}/${refs.length}${no ? ` · ${no} No` : ""}`;
}
function checksBlock(s) {
  const items = checkList().filter((c) => c.sec === s.n);
  const qa = S.job.locations.flatMap((l) => l.items.filter((it) => itemDsec(it) === s.n).map((it) => ({ it, l })));
  let lastG;
  const left = items.filter((c) => !S.job.checks[c.key]?.v).length;
  return `<p class="muted">Yes = satisfactory. No = deficiency (goes to the action plan). N/A = not applicable or not established.</p>
  ${left ? `<div class="row"><button data-act="rest-yes" data-n="${s.n}">Mark the ${left} unanswered as Yes</button></div>` : ""}
  <ol class="checks">${items.map((c) => {
    const g = c.group !== lastG && c.group ? `<li class="grp">${esc(c.group)}</li>` : ""; lastG = c.group;
    const v = S.job.checks[c.key] || {}, id = "obs_" + c.key.replace(".", "_");
    return `${g}<li class="check ${v.v === "No" ? "isno" : ""}"><div class="ck"><b>${c.ref}</b><p>${esc(c.text)}${!scope().rooms && (P().roomChecks || []).includes(c.key) ? `<span class="evid">${esc(scope().type)}: inside the ${P().unit.many} is not inspected. Note how this was confirmed.</span>` : ""}</p>${seg(`checks.${c.key}.v`, ["Yes", "No", "NA"])}</div>
    ${v.v === "No" || v.obs ? "" : `<button type="button" class="ghost addnote" data-act="shownote" data-id="${id}">+ Note</button>`}<div class="ckobs${v.v === "No" || v.obs ? "" : " hide"}"><textarea id="${id}" rows="1" placeholder="Observations / evidence" data-bind="checks.${c.key}.obs">${esc(v.obs || "")}</textarea>${micBtn(id)}</div></li>`; }).join("")}</ol>
  ${qa.length ? `<h3>Walk-through items filed here</h3><ul class="items small">${qa.map(({ it, l }) => `<li class="item r-${itemResult(it)}"><span class="itemmain"><span class="tag">${esc(itemSpec(it).label)}</span><strong>${esc(l.floor)} · ${esc(l.name)}</strong><span class="muted">${esc(itemProblems(it).join("; ") || "No deficiencies recorded")}</span></span><span class="res">${itemResult(it)}</span></li>`).join("")}</ul>` : ""}
  ${((P().sectionFields || {})[s.n] || []).length ? `<div class="grid">${P().sectionFields[s.n].map(([k, lab, o]) => inp("sf." + k, lab, Array.isArray(o) ? { options: o, wide: o.some((x) => x.length > 30) } : o === "area" ? { area: true, rows: 2 } : {})).join("")}</div>` : ""}
  <div class="concl"><span>Section conclusion</span>${seg(`conclusions.c${s.n}`, ["Satisfactory", "Action required", "Not applicable"])}</div>`;
}

function viewManagement() {
  const m = dsecs().find((s) => s.management);
  return `<section class="pane">${head("management", "Usually done with the Responsible Person at the start or end of the visit.")}
  <h3>Documents from the Responsible Person</h3><p class="muted small">Mark each one. For documents you saw, add the date or reference and a photo if useful.</p>
  <div class="docs">${P().documents.map((d, i) => [d, i]).filter(([d]) => !(scope().lodgers && /licen/i.test(d))).map(([d, i]) => { const r = S.job.docs?.["d" + i] || {};
    return `<div class="docrow"><span>${esc(d)}</span>${seg(`docs.d${i}.s`, ["Sighted", "Not sighted", "N/A"])}${r.s === "Sighted" ? `<input aria-label="Date or reference" placeholder="Date or reference" data-bind="docs.d${i}.ref" value="${esc(r.ref || "")}"><div class="dphoto">${photoStrip(r.photos, "doc:d" + i)}</div>` : ""}</div>`; }).join("")}</div>
  ${grp("m-other", "Other documents and areas not inspected", filled(["docsOther", "notAccessed"]), `<div class="grid">${inp("docsOther", "Other documents or information (or stated as not available)", { area: true, rows: 2 })}${inp("notAccessed", "Areas not accessible or not inspected", { area: true, rows: 2 })}</div>`)}
  ${m ? `<h3>${m.n}. ${esc(m.title)}</h3>${checksBlock(m)}` : ""}
  ${nextBtn("management")}</section>`;
}

function viewRisk() {
  const r = S.job.risk, rating = riskOf(r.likelihood, r.consequence), res = riskOf(r.resLike, r.resCons);
  const opt = (path, list) => `<div class="seg choice" role="group">${list.map(([v, d]) => `<button type="button" data-act="seg" data-path="${path}" data-val="${esc(v)}" class="${getPath(S.job, path) === v ? "on" : ""}"><strong>${esc(v)}</strong><small>${esc(d)}</small></button>`).join("")}</div>`;
  const f = findings().length, hi = S.job.actions.filter((a) => a.priority === "H").length;
  const matrix = `<div class="matrix" role="table" aria-label="Risk matrix"><div class="mh"></div>${CONS.map((c) => `<div class="mh">${c}</div>`).join("")}
    ${Object.entries(MATRIX).map(([l, row]) => `<div class="mh">${l}</div>${row.map((v, i) => `<div class="mc r-${v}${r.likelihood === l && r.consequence === CONS[i] ? " sel" : ""}">${v}</div>`).join("")}`).join("")}</div>`;
  return `<section class="pane">${head("risk", `Two choices give the overall rating (BS 9792:2025 risk level estimator). So far: ${f} deficienc${f === 1 ? "y" : "ies"} recorded${hi ? `, ${hi} high priority` : ""}.`)}
  <h3>1. How likely is a fire?</h3>${opt("risk.likelihood", [["Low", "Unusually low for this type of building"], ["Medium", "Typical for this type of building"], ["High", "Serious shortcomings in controlling fire hazards"]])}
  <h3>2. How serious would the consequences be?</h3>${opt("risk.consequence", [["Slight harm", "Serious injury or death unlikely"], ["Moderate harm", "Serious injury possible; multiple deaths unlikely"], ["Extreme harm", "One or more occupants likely to be seriously injured or killed"]])}
  <div class="result ${rating ? "r-" + rating : ""}"><small>Overall fire risk</small><strong>${rating || "Make both choices above"}</strong>${rating ? `<span>${esc(RISK_KEY[rating])}</span>` : ""}</div>
  <div class="grid">${inp("risk.justification", "Why this rating? (printed in the report)", { area: true })}</div>
  ${/^(Substantial|Intolerable)$/.test(rating) || r.seriousInformed ? `<label class="tick"><input type="checkbox" data-bind-check="risk.seriousInformed"${r.seriousInformed ? " checked" : ""}> Serious risk to persons identified: the Responsible Person was informed before I left the premises.</label>` : ""}
  ${grp("r-more", "Departures and residual risk", res ? `Residual risk after actions: ${res}` : filled(["risk.departures", "risk.resLike", "risk.resCons"]), `<div class="grid">${inp("risk.departures", "Departures from standards accepted, with reasons", { area: true })}${inp("risk.resLike", "Residual likelihood", { options: ["Low", "Medium", "High"] })}${inp("risk.resCons", "Residual consequence", { options: CONS })}<div class="fld"><span>Predicted residual rating</span><div class="pillout">${res ? `<em class="pill r-${res}">${res}</em>` : "-"}</div></div></div>`)}
  ${grp("r-matrix", "Show the risk matrix", "", matrix)}
  ${nextBtn("risk")}</section>`;
}

function viewActions() {
  const pend = pendingFindings(), pri = P().priorities;
  const due = (a) => a.target || ({ H: "within 1 month", M: "within 3 months", L: "within 12 months" }[a.priority] || "");
  const first = (t) => (t || "").replace(/\s+/g, " ").trim().slice(0, 120);
  S.openAct = S.openAct || {};
  return `<section class="pane">${head("actions", `Priority: ${pri.map((p) => `<b>${p.k}</b> ${p.time.toLowerCase()}`).join(" · ")}. Basis: <b>L</b> legal requirement${scope().joint ? ` (${esc(scope().law)})` : ""}, <b>G</b> good practice.`)}
  ${pend.length ? `<div class="pending"><span><strong>${pend.length} new finding${pend.length > 1 ? "s" : ""}</strong> from the walk-through and checks ${pend.length > 1 ? "are" : "is"} not in the plan yet.</span><button class="primary" data-act="draft-actions">Add to the plan</button></div>` : ""}
  ${S.job.actions.length ? `<ol class="actions">${S.job.actions.map((a, i) => { const inc = !a.priority || !a.basis || !(a.action || "").trim(), open = S.openAct[a.src] ?? inc;
    return `<li class="action${inc ? " inc" : ""}"><details data-acts="${esc(a.src)}"${open ? " open" : ""}><summary><b class="anum">${i + 1}</b><em class="lpri lpri-${a.priority || "x"}">${a.priority || "?"}</em><span class="atxt"><strong>${esc(first(a.deficiency) || "New action")}</strong><small>${a.ref ? `Ref ${esc(a.ref)} · ` : ""}${inc ? "Needs a priority, basis and action" : `${a.basis === "L" ? "Legal requirement" : "Good practice"} · ${esc(due(a))}`}</small></span>${ico("next")}</summary>
    <div class="abody">
      <div class="ahead"><span class="lbl">Priority</span>${seg(`actions.${i}.priority`, ["H", "M", "L"], "pri")}<span class="lbl">Basis</span>${seg(`actions.${i}.basis`, ["L", "G"])}</div>
      <div class="grid">${inp(`actions.${i}.deficiency`, "Deficiency found", { area: true, rows: 2 })}${inp(`actions.${i}.action`, "Action required", { area: true, rows: 2 })}</div>
      <details class="amore"><summary>Responsible Person, target date and date closed</summary><div class="grid">${inp(`actions.${i}.who`, "Responsible Person")}${inp(`actions.${i}.target`, "Target date (blank = by priority)")}${inp(`actions.${i}.closed`, "Date closed")}</div></details>
      ${a.photos?.length ? `<div class="photos">${a.photos.map((id) => `<button type="button" class="thumb" data-act="photo-view" data-id="${id}"><img data-photo="${id}" alt=""></button>`).join("")}</div>` : ""}
      <div class="arow"><button class="ghost libsave" data-act="libsave" data-i="${i}">☆ Save to My findings</button><button class="ghost danger" data-act="del-action" data-i="${i}">Remove</button></div>
    </div></details></li>`; }).join("")}</ol>`
    : `<div class="empty">No actions yet. Answers of No in the checks, and walk-through items that fail, are offered here to add.</div>`}
  <div class="row"><button class="primary" data-act="libopen">${ico("list")} Add from My findings</button><button data-act="add-action">${ico("plus")} Write an action</button></div>
  ${grp("a-interim", "Interim measures", S.job.interim.length ? `${S.job.interim.length} recorded` : "Only needed where an action can't be done quickly", `<ol class="actions">${S.job.interim.map((m, i) => `<li class="action pad"><div class="grid">${inp(`interim.${i}.ref`, "Action ref")}${inp(`interim.${i}.measure`, "Interim measure", { area: true, rows: 2 })}${inp(`interim.${i}.who`, "Responsible Person")}${inp(`interim.${i}.date`, "Date in place")}</div><button class="ghost danger" data-act="del-interim" data-i="${i}">Remove</button></li>`).join("")}</ol><div class="row"><button data-act="add-interim">${ico("plus")} Add interim measure</button></div>`, S.job.interim.length > 0)}
  ${nextBtn("actions")}</section>`;
}

/* Everything worth checking before the report is issued (Report step and the Overview). */
function readiness() {
  const rating = riskOf(S.job.risk.likelihood, S.job.risk.consequence);
  const unanswered = checkList().filter((c) => !S.job.checks[c.key]?.v).length;
  const pend = pendingFindings().length;
  const warn = [];
  if (!S.job.setup.address) warn.push("Premises address is blank.");
  if (!rating) warn.push("Overall risk rating is not set.");
  if (!S.job.risk.justification) warn.push("Risk rating has no justification.");
  if (pend) warn.push(`${pend} finding${pend > 1 ? "s are" : " is"} not in the action plan.`);
  if (!scope().rooms && S.job.locations.some((l) => l.area === "Letting")) warn.push(`${P().unit.Cap}s are recorded as locations, but a ${scope().type} assessment does not enter them. Change the assessment type or remove those locations.`);
  if (P().needsUnitDetection(S.job.setup) && !S.job.overview.detInside) warn.push(`Say how detection inside the ${P().unit.many} was confirmed (Building screen). BS 9792 expects this for this building.`);
  const other = S.job.locations.flatMap((l) => l.items).filter((it) => (it.p || S.job.profile) !== S.job.profile);
  if (other.length) warn.push(`${other.length} walk-through item${other.length > 1 ? "s were" : " was"} recorded under the other building type (${[...new Set(other.map((it) => itemSpec(it)?.label))].join(", ")}). They are still reported; check they still apply.`);
  if (!scope().rooms && (S.job.overview.roomsEntered || "").trim()) warn.push(`${P().unit.Cap}s entered are recorded, but a ${scope().type} assessment does not enter them. Change the type to 3 or 4, or clear that field.`);
  /* Does the rating fit what was found? */
  const r = S.job.risk, hiActs = S.job.actions.filter((a) => a.priority === "H").length, vul = Object.values(S.job.overview.vulnerable || {}).some((v) => v?.v === "Yes");
  if (hiActs && /^(Trivial|Tolerable)$/.test(rating)) warn.push(`${hiActs} High-priority action${hiActs > 1 ? "s" : ""} but an overall rating of ${rating}. Check the rating or the priorities.`);
  if (/^(Substantial|Intolerable)$/.test(rating) && !r.seriousInformed) warn.push(`Rated ${rating}: tick that the Responsible Person was told before you left, and record interim measures.`);
  if (/^(Substantial|Intolerable)$/.test(rating) && !S.job.interim.length) warn.push(`Rated ${rating} with no interim measures recorded.`);
  if (vul && r.consequence === "Slight harm") warn.push("Vulnerable occupants are recorded but consequence is Slight harm. Check this is justified.");
  if (rating === "Trivial" && findings().length) warn.push(`Rated Trivial with ${findings().length} deficiencies recorded. Check the rating.`);
  /* Plausibility of the building figures */
  const stS = S.job.setup, hgt = Number(stS.topHeight), nst = parseInt(stS.storeys, 10);
  if (stS.topHeight !== undefined && stS.topHeight !== "" && !(hgt >= 0)) warn.push("Top floor height must be zero or more.");
  if (hgt > 0 && nst > 0 && (hgt > nst * 4.5 || hgt < (nst - 1) * 2.2)) warn.push(`A top floor at ${hgt} m does not fit ${nst} storeys. Check both on the Setup screen; they set the height category and checks.`);
  const badNum = S.job.locations.flatMap((l) => l.items).filter((it) => Object.entries(it.f || {}).some(([k, v]) => itemSpec(it)?.fields.find((f) => f[0] === k)?.[2] === "num" && v !== "" && !(Number(v) >= 0))).length;
  if (badNum) warn.push(`${badNum} walk-through item${badNum > 1 ? "s have" : " has"} a measurement that is not a positive number.`);
  const dS = S.job.setup;
  if (S.job.interim.some((m) => !(m.measure || "").trim())) warn.push("An interim measure row is empty. Fill it in or remove it.");
  if (/^(Substantial|Intolerable)$/.test(rating) && !S.job.actions.length) warn.push(`Rated ${rating} but the action plan is empty.`);
  if (dS.reportDate && dS.date && dS.reportDate < dS.date) warn.push("The report date is before the assessment date.");
  if (dS.review && dS.date && dS.review <= dS.date) warn.push("The review date is not after the assessment date.");
  if (scope().rooms && !scope().joint && !(S.job.overview.roomsEntered || "").trim()) warn.push(`${scope().type} includes ${P().unit.many}: record which ${P().unit.many} were entered (Building screen).`);
  dsecs().forEach((sec) => { if (S.job.conclusions?.["c" + sec.n] === "Satisfactory" && (checkList().some((c) => c.sec === sec.n && S.job.checks[c.key]?.v === "No") || findings().some((f) => f.sec === sec.n))) warn.push(`Section ${sec.n} is concluded Satisfactory but has deficiencies recorded.`); });
  const liveSrc = new Set(findings().map((f) => f.src));
  const orphan = S.job.actions.filter((a) => /^(check|item):/.test(a.src || "") && !liveSrc.has(a.src)).length;
  if (orphan) warn.push(`${orphan} action${orphan > 1 ? "s come" : " comes"} from a finding that no longer exists (deleted, changed to Yes, or from the other building type). Check or remove ${orphan > 1 ? "them" : "it"}.`);
  if (stS.topHeight !== undefined && stS.topHeight !== "" && hgt === 0 && nst > 1) warn.push(`Top floor height is 0 m but the building has ${nst} storeys.`);
  const noNote = checkList().filter((c) => S.job.checks[c.key]?.v === "No" && !(S.job.checks[c.key].obs || "").trim()).length;
  if (noNote) warn.push(`${noNote} check${noNote > 1 ? "s" : ""} answered No with no note of what was found (Section checks).`);
  if (!P().documents.some((d, i) => S.job.docs?.["d" + i]?.s)) warn.push("No documents recorded as sighted, not sighted or N/A (Management).");
  if (!S.job.setup.reportDate) warn.push("Date of report is blank (below).");
  if (!S.job.setup.arrived || !S.job.setup.departed) warn.push("Time arrived or departed is blank (Setup).");
  const noWho = S.job.actions.filter((a) => !(a.who || "").trim()).length;
  if (noWho) warn.push(`${noWho} action${noWho > 1 ? "s have" : " has"} no Responsible Person (Action plan).`);
  if ((P().sectionFields || {})[9]?.some(([k]) => k === "s9_grade") && !(S.job.sf?.s9_grade || "").trim()) warn.push("Fire alarm grade and category are blank (Section checks, section 9).");
  const blankAct = S.job.actions.filter((a) => !a.priority || !a.basis || !(a.action || "").trim()).length;
  if (blankAct) warn.push(`${blankAct} action${blankAct > 1 ? "s have" : " has"} no priority, basis or action text (Action plan screen).`);
  if (unanswered) warn.push(`${unanswered} section checks are unanswered (printed with no answer ticked).`);
  return warn;
}

/* Which step fixes a readiness warning. */
function warnStep(w) { return /Section checks|section checks|unanswered/.test(w) ? "checks" : /Action plan|action plan|action/i.test(w) && !/risk/i.test(w) ? "actions" : /risk|Rated|rating/i.test(w) ? "risk" : /Management|documents/i.test(w) ? "management" : /Building/.test(w) ? "building" : /Setup|address|Time arrived|Top floor|storeys/i.test(w) ? "setup" : /walk-through|locations/i.test(w) ? "walk" : /report/i.test(w) ? "report" : ""; }
function viewReport() {
  const warn = readiness(), by = {};
  warn.forEach((w) => { const k = warnStep(w) || "report"; (by[k] = by[k] || []).push(w); });
  const list = STEPS.filter(([k]) => by[k]).map(([k, l]) => `<p class="rgrp">${esc(l)}</p><ul>${by[k].map((w) => k === "report" ? `<li><div class="noj"><span class="x">!</span><span>${esc(w)}</span></div></li>` : `<li><button data-act="nav" data-view="${k}"><span class="x">!</span><span>${esc(w)}</span>${ico("next")}</button></li>`).join("")}</ul>`).join("");
  return `<section class="pane">${head("report")}
  ${warn.length ? `<div class="ready"><h3>${warn.length} thing${warn.length > 1 ? "s" : ""} to check before you issue</h3><p class="muted small">You can make a draft PDF at any time. Tap an item to go to it.</p>${list}</div>`
    : `<div class="ready ok"><h3>✓ Ready to issue</h3><p class="muted">All the checks the app can make are complete. Read the PDF through before sending it.</p></div>`}
  <div class="grid">${inp("setup.status", "Report status", { options: ["Draft", "Final", "Review"] })}${inp("setup.reportDate", "Date of report", { type: "date" })}${inp("setup.review", "Review due", { type: "date" })}${inp("setup.checker", "Report checked by")}${inp("setup.checkerQuals", "Checker qualifications")}</div>
  <label class="tick"><input type="checkbox" data-bind-check="setup.scopeExplained"${S.job.setup.scopeExplained ? " checked" : ""}> Scope and limitations explained to the person present and to the Responsible Person.</label>
  <div class="row big"><button class="primary" data-act="pdf">${ico("report")} Create PDF report</button><button data-act="export-job">Export this job</button></div>
  <p class="muted small">The PDF follows the Partridge report layout: cover, sections with observations, walk-through findings, risk rating, action plan, photo appendix and declaration.</p>
  ${grp("rep-del", "Delete this assessment", "", `<p class="muted small">This removes the job and its photos from this device. Export it first if you may need it.</p><button class="ghost danger" data-act="del-job">Delete this assessment</button>`)}</section>`;
}

/* ---------------- events ---------------- */
function bindCommon() {}
/* Keep collapsible cards open or closed across re-renders. toggle does not bubble, so listen in the capture phase. */
document.addEventListener("toggle", (e) => { const d = e.target; if (!d.dataset) return;
  if (d.dataset.open) { S.open = S.open || {}; S.open[d.dataset.open] = d.open; }
  if (d.dataset.acts) { S.openAct = S.openAct || {}; S.openAct[d.dataset.acts] = d.open; } }, true);

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.bind === "setup.date" && S.job && S._prevDate === undefined) S._prevDate = S.job.setup.date || "";
  if (t.dataset.bind && S.job) { setPath(S.job, t.dataset.bind, t.value); save();
    if (t.dataset.bind.startsWith("setup.address")) { const jt = $(".jobtitle strong"); if (jt) jt.textContent = t.value || "New assessment"; }
    if (t.tagName === "TEXTAREA") autosize(t); }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  /* Moving the assessment date moves the review date with it, unless the review date was set by hand. */
  if (t.dataset.bind === "setup.date" && t.value) { const old = S._prevDate ?? ""; S._prevDate = undefined; if (!S.job.setup.review || S.job.setup.review === addYear(old)) { S.job.setup.review = addYear(t.value); const r = $("#f_setup_review"); if (r) r.value = S.job.setup.review; } save(); }
  if (t.dataset.bind && t.tagName === "SELECT") { setPath(S.job, t.dataset.bind, t.value); if (t.dataset.bind === "setup.buildingType") switchProfile(S.job, profileFor(t.value)); save(); if (/^setup\.(occType|flatsType|convType|flats|nonres|maisonettes|strategy|storeys|topHeight|occupants|over200|buildingType|bs9792|jointTenancy|sprinklered)|overview\.basement|risk\./.test(t.dataset.bind)) render(); }
  if (t.dataset.bind && t.tagName === "INPUT" && /^setup\.(storeys|topHeight)$/.test(t.dataset.bind)) render();
  if (t.dataset.bindCheck) { setPath(S.job, t.dataset.bindCheck, t.checked); save(); }
  if (t.dataset.actChange === "showall") { S.showAll = t.checked; render(); }
  if (t.dataset.actChange === "navsel") { S.view = t.value; render(); window.scrollTo(0, 0); }
  if (t.dataset.actChange === "locsel") { S.loc = t.value; render(); }
  if (t.dataset.actChange === "import" && t.files[0]) importBackup(t.files[0]);
  if (t.dataset.photoFor) {
    const [kind, id] = t.dataset.photoFor.split(":");
    if (kind === "item") { const it = sheetItem; if (it) { await addPhotos(t.files, it); const strip = t.closest(".qf"); strip.innerHTML = `<span>Photos</span>${photoStrip(it.photos, "item:" + it.id)}`; hydratePhotos(strip); } }
    if (kind === "cover") { const c = S.job.cover = S.job.cover || {}; c.photos = []; await addPhotos([t.files[0]], c); render(); }
    if (kind === "doc") { const d = S.job.docs[id] = S.job.docs[id] || {}; await addPhotos(t.files, d); render(); }
    if (kind === "check") { const c = S.job.checks[id] = S.job.checks[id] || {}; await addPhotos(t.files, c); S.gnote = true; render(); }
  }
});

let sheetItem = null;
document.addEventListener("submit", async (e) => {
  const f = e.target; e.preventDefault();
  if (f.dataset.form === "addloc") {
    const name = $("#nl_name").value.trim(); if (!name) return;
    const l = { id: uid(), floor: $("#nl_floor").value, area: $("#nl_area")?.value || "Common part", name, items: [] };
    if (f.closest("#sheet")) closeSheet();
    S.job.locations.push(l); S.loc = l.id; save(); render(); toast(`${l.floor} · ${l.name} added`);
    setTimeout(() => $("#nl_floor") && ($("#nl_floor").value = l.floor), 0);
  }
  if (f.dataset.form === "item") {
    const loc = S.job.locations.find((l) => l.id === f.dataset.loc); const it = sheetItem;
    const fd = new FormData(f); it.f = {};
    itemSpec(it).fields.forEach(([k]) => { it.f[k] = fd.get(k) || ""; });
    it.note = fd.get("note") || ""; it.result = fd.get("result") || "";
    if (it._new) { delete it._new; loc.items.push(it); }
    const again = e.submitter?.name === "again";
    closeSheet(); save(); render(); toast(`${itemSpec(it).label} saved (${itemResult(it)})`);
    if (again) { const f2 = Object.assign({}, it.f), rk = ["ref", "loc", "from", "fac", "svc", "dev"].find((k) => f2[k]);
      if (rk) f2[rk] = f2[rk].replace(/(\d+)(?!.*\d)/, (n) => String(+n + 1)) === f2[rk] ? "" : f2[rk].replace(/(\d+)(?!.*\d)/, (n) => String(+n + 1));
      sheetItem = { id: uid(), k: it.k, p: it.p, f: f2, note: "", photos: [], _new: true }; openSheet(itemForm(sheetItem, f.dataset.loc)); }
  }
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act;
  if (a === "new-job") { const j = newJob(); S.jobs.push(j); S.job = j; S.view = "setup"; S.loc = null; await Store.put("jobs", j); render(); }
  if (a === "open-job") { S.job = normalise(S.jobs.find((j) => j.id === b.dataset.id)); S.view = "home"; S.loc = null; render(); }
  if (a === "go-jobs") { S.view = "jobs"; render(); }
  if (a === "nav") { S.view = b.dataset.view; render(); window.scrollTo(0, 0); }
  if (a === "seg") { const cur = getPath(S.job, b.dataset.path); setPath(S.job, b.dataset.path, cur === b.dataset.val ? "" : b.dataset.val); save();
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b && cur !== b.dataset.val));
    const li = b.closest(".check"); if (li) { li.classList.toggle("isno", getPath(S.job, b.dataset.path) === "No");
      if (getPath(S.job, b.dataset.path) === "No") { li.querySelector(".ckobs")?.classList.remove("hide"); li.querySelector(".addnote")?.remove(); li.querySelector("textarea")?.focus(); } }
    if (b.dataset.path === "setup.buildingType") { switchProfile(S.job, profileFor(getPath(S.job, b.dataset.path))); render(); }
    else if (/^(risk\.|setup\.|overview\.basement|sf\.|docs\.|actions\.\d+\.(priority|basis))/.test(b.dataset.path)) render(); else if (S.view === "checks" || S.view === "management") { const t = $(".tabs button.on small"); if (t) t.textContent = secStatus(dsecs().find((s) => s.n === S.sec) || {}); } }
  if (a === "loc") { S.loc = b.dataset.id; render(); }
  if (a === "shownote") { const t = document.getElementById(b.dataset.id); t?.parentElement.classList.remove("hide"); b.remove(); t?.focus(); }
  if (a === "locsheet") {
    const FL = ["Basement", "Ground floor", "First floor", "Second floor", "Third floor", "Fourth floor", "Fifth floor", "Loft", "External"];
    const last = S.job.locations[S.job.locations.length - 1], nf = last ? FL[Math.min(FL.length - 2, Math.max(1, FL.indexOf(last.floor) + 1))] : "Ground floor";
    const NAMES = ["Entrance hall", "Hall", "Landing", "Stairs", "Corridor", "Meter cupboard", "Bin store", "Final exit", "External"];
    openSheet(`<div class="sheet" role="dialog" aria-modal="true" aria-label="Add location"><form class="sheetin" data-form="addloc">
      <div class="sheethead"><h3>New location</h3><button type="button" class="ghost" data-act="close-sheet">Cancel</button></div>
      <div class="sheetbody"><div class="qf wide"><span>Floor</span><div class="chipset">${FL.map((f) => `<button type="button" data-act="pickchip" data-target="nl_floor" data-val="${f}" class="${f === nf ? "on" : ""}">${f}</button>`).join("")}</div><input type="hidden" id="nl_floor" value="${nf}"></div>
        ${scope().rooms ? `<div class="qf wide"><span>Area</span><div class="chipset">${["Common part", "Letting"].map((f, i) => `<button type="button" data-act="pickchip" data-target="nl_area" data-val="${f}" class="${i ? "" : "on"}">${f === "Letting" ? P().unit.Cap : f}</button>`).join("")}</div><input type="hidden" id="nl_area" value="Common part"></div>` : ""}
        <div class="qf wide"><span>Name</span><div class="chipset">${NAMES.map((n) => `<button type="button" data-act="pickchip" data-target="nl_name" data-val="${n}">${n}</button>`).join("")}</div><input id="nl_name" placeholder="Or type a name" required></div></div>
      <div class="sheetfoot"><button class="primary">Add location</button></div></form></div>`); }
  if (a === "pickchip") { const t = document.getElementById(b.dataset.target); if (t) t.value = b.dataset.val; b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); }
  if (a === "newloc") { const f = document.getElementById("nl_name"); f?.scrollIntoView({ block: "center" }); f?.focus(); }
  if (a === "rest-yes") { const n = Number(b.dataset.n), rest = checkList().filter((c) => c.sec === n && !S.job.checks[c.key]?.v);
    confirmThen(b, `Tap again: mark ${rest.length} as Yes (check them as you go)`, () => { rest.forEach((c) => { S.job.checks[c.key] = Object.assign(S.job.checks[c.key] || {}, { v: "Yes" }); }); save(); render(); toast(`${rest.length} checks marked Yes.`); }); }
  if (a === "del-loc") { confirmThen(b, "Tap again to remove this location and its items", () => { S.job.locations = S.job.locations.filter((l) => l.id !== b.dataset.id); S.loc = null; save(); render(); }); }
  if (a === "qa") { sheetItem = { id: uid(), k: b.dataset.k, p: S.job.profile || "hmo", f: {}, note: "", photos: [], _new: true }; openSheet(itemForm(sheetItem, S.loc)); }
  if (a === "qa-edit") { const loc = S.job.locations.find((l) => l.id === S.loc); sheetItem = loc.items.find((i) => i.id === b.dataset.id); openSheet(itemForm(sheetItem, S.loc)); }
  if (a === "allok") { const form = b.closest("form"), sp = itemSpec(sheetItem);
    sp.fields.forEach(([k, , t]) => { if (t !== "yn" && t !== "yes") return; const want = t === "yn" ? "Yes" : "No", inpt = form.querySelector(`input[type=hidden][name="${k}"]`); if (!inpt) return; inpt.value = want;
      form.querySelectorAll(`[data-act="qseg"][data-k="${k}"]`).forEach((x) => x.classList.toggle("on", x.dataset.val === want)); }); }
  if (a === "qseg") { const inpt = b.closest(".qf").querySelector("input[type=hidden]"); const on = inpt.value === b.dataset.val; inpt.value = on ? "" : b.dataset.val;
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", !on && x === b)); }
  if (a === "close-sheet") closeSheet();
  if (a === "vul") { const k = "v" + b.dataset.i, V = S.job.overview.vulnerable = S.job.overview.vulnerable || {}; V[k] = Object.assign(V[k] || {}, { v: V[k]?.v === "Yes" ? "" : "Yes" }); save(); render(); }
  if (a === "vulnone") { const V = S.job.overview.vulnerable = S.job.overview.vulnerable || {}, all = P().vulnerable.every((g, i) => V["v" + i]?.v === "No");
    P().vulnerable.forEach((g, i) => { V["v" + i] = Object.assign(V["v" + i] || {}, { v: all ? "" : "No" }); }); save(); render(); }
  if (a === "dismiss-warn") { S.storeWarn = ""; render(); }
  if (a === "del-item") { confirmThen(b, "Tap again to delete", () => { const loc = S.job.locations.find((l) => l.id === b.dataset.loc); loc.items = loc.items.filter((i) => i.id !== b.dataset.id); closeSheet(); save(); render(); }); }
  if (a === "dictate") dictate(b);
  if (a === "sec") { S.sec = Number(b.dataset.n); S.gi = null; S.gnote = false; render(); window.scrollTo(0, 0); }
  if (a === "gmode") { S.guided = b.dataset.on === "1"; S.gi = null; render(); }
  if (a === "gstep") { S.gi = Math.max(0, (S.gi || 0) + Number(b.dataset.d)); S.gnote = false; render(); }
  if (a === "gnote") { S.gnote = true; render(); document.querySelector(".gobs textarea")?.focus(); }
  if (a === "phrase") { const t = document.getElementById(b.dataset.id); if (t) { const p = PHRASES[+b.dataset.i]; t.value = (t.value ? t.value.replace(/\s*$/, " ") : "") + p; t.dispatchEvent(new Event("input", { bubbles: true })); t.focus(); } }
  if (a === "gans") { const k = b.dataset.key, cur = S.job.checks[k]?.v, val = cur === b.dataset.val ? "" : b.dataset.val;
    S.job.checks[k] = Object.assign(S.job.checks[k] || {}, { v: val }); save();
    if (val && val !== "No" && !S.gnote) { b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); setTimeout(() => { S.gi = (S.gi || 0) + 1; render(); }, 220); }
    else { render(); if (val === "No") document.querySelector(".gobs textarea")?.focus(); } }
  if (a === "draft-actions") { pendingFindings().forEach((f) => S.job.actions.push({ src: f.src, ref: f.ref, deficiency: f.deficiency, action: f.action || (f.src.startsWith("check:") ? `Rectify so that: ${f.text}` : ""), priority: f.priority || "", basis: f.basis || "", who: rpNames() || "", target: "", photos: f.photos || [] })); save(); render(); toast("Findings added. Check each action, priority and basis."); }
  if (a === "libopen") { const c = b.dataset.key ? checkList().find((x) => x.key === b.dataset.key) : null; libSheet(c ? c.text : "", c ? "check" : "action", b.dataset.key); }
  if (a === "libpick") await libPick(b.dataset.id);
  if (a === "libdel") await libDelete(b.dataset.id);
  if (a === "libsave") await libSaveAction(+b.dataset.i);
  if (a === "add-action") { S.job.actions.push({ src: "manual:" + uid(), ref: "", deficiency: "", action: "", priority: "", basis: "", who: rpNames() || "", target: "", photos: [] }); save(); render(); }
  if (a === "del-action") { confirmThen(b, "Tap again to remove", () => { S.job.actions.splice(Number(b.dataset.i), 1); save(); render(); }); }
  if (a === "add-interim") { S.job.interim.push({}); save(); render(); }
  if (a === "del-interim") { S.job.interim.splice(Number(b.dataset.i), 1); save(); render(); }
  if (a === "photo-view") { const id = b.dataset.id, d = await photoData(id); if (d) { const m = S.job?.photoMeta?.[id] || {};
    openViewer(`<div class="sheet" role="dialog" aria-modal="true"><div class="sheetin photo"><img src="${d}" alt="Photo">
      <div class="sheetbody"><p class="muted small">${m.taken ? `Taken ${esc(stampLabel(new Date(m.taken)).split("  ")[0])}${m.src === "file" ? " (from the file time; the camera did not record one)" : ""}` : "Time not recorded (photo added before time stamps)"}</p>
      <label class="qf wide"><span>What the photograph shows (report caption)</span><input data-bind="photoMeta.${id}.cap" value="${esc(m.cap || "")}" placeholder="e.g. Gap at the head, with gap gauge"></label></div>
      <div class="sheetfoot"><button type="button" class="ghost danger" data-act="photo-del" data-id="${id}">Delete photo</button><button type="button" class="primary" data-act="close-viewer">Done</button></div></div></div>`); } }
  if (a === "close-viewer") { $("#viewer")?.remove(); }
  if (a === "photo-del") confirmThen(b, "Tap again to delete this photo", async () => {
    const id = b.dataset.id, drop = (o) => { if (o?.photos) o.photos = o.photos.filter((x) => x !== id); };
    S.job.locations.forEach((l) => l.items.forEach(drop)); Object.values(S.job.docs || {}).forEach(drop); Object.values(S.job.checks || {}).forEach(drop); drop(S.job.cover); S.job.actions.forEach(drop); if (sheetItem) drop(sheetItem);
    delete S.job.photoMeta?.[id]; try { await Store.del("photos", id); } catch { /* already gone */ } S.photoCache.delete(id);
    $("#viewer")?.remove(); document.querySelectorAll(`[data-id="${id}"].thumb`).forEach((t) => t.remove()); save(); toast("Photo deleted.");
  });
  if (a === "pdf") makePdf(b);
  if (a === "export-job") exportJobs([S.job]);
  if (a === "export-all") exportJobs(S.jobs);
  if (a === "del-job") { confirmThen(b, "Tap again to delete permanently", async () => { await Store.del("jobs", S.job.id); S.jobs = S.jobs.filter((j) => j.id !== S.job.id); S.job = null; S.view = "jobs"; render(); }); }
});

function confirmThen(btn, msg, fn) {
  if (btn.dataset.armed) { fn(); return; }
  const old = btn.textContent; btn.dataset.armed = "1"; btn.textContent = msg; btn.classList.add("armed");
  setTimeout(() => { if (btn.isConnected) { btn.textContent = old; delete btn.dataset.armed; btn.classList.remove("armed"); } }, 3500);
}
function openSheet(html) { closeSheet(); const d = document.createElement("div"); d.id = "sheet"; d.innerHTML = html; document.body.appendChild(d); hydratePhotos(d); const f = d.querySelector("select, input:not([type=hidden]), textarea"); }
function closeSheet() { $("#sheet")?.remove(); $("#viewer")?.remove(); }
/* The photo viewer sits above any open form, so viewing a photo never loses an unsaved item. */
function openViewer(html) { $("#viewer")?.remove(); const d = document.createElement("div"); d.id = "viewer"; d.innerHTML = html; document.body.appendChild(d); }
function autosize(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 260) + "px"; }
let toastT;
function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

/* ---------------- backup ---------------- */
async function exportJobs(jobs) {
  const ids = new Set(); jobs.forEach((j) => { (j.cover?.photos || []).forEach((p) => ids.add(p)); j.actions.forEach((a) => (a.photos || []).forEach((p) => ids.add(p))); Object.values(j.checks || {}).forEach((c) => (c.photos || []).forEach((p) => ids.add(p))); j.locations.forEach((l) => l.items.forEach((i) => (i.photos || []).forEach((p) => ids.add(p)))); Object.values(j.docs || {}).forEach((d) => (d.photos || []).forEach((p) => ids.add(p))); });
  const photos = {}; for (const id of ids) photos[id] = await photoData(id);
  const blob = new Blob([JSON.stringify({ app: "pfs-fra", version: 1, exported: new Date().toISOString(), jobs, photos })], { type: "application/json" });
  download(blob, `PFS-FRA-backup-${today()}.json`);
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text()); if (d.app !== "pfs-fra") throw new Error();
    for (const [id, data] of Object.entries(d.photos || {})) if (data) { await Store.put("photos", { id, data }); S.photoCache.set(id, data); }
    let n = 0; for (const j of d.jobs.map(normalise)) { await Store.put("jobs", j); const i = S.jobs.findIndex((x) => x.id === j.id); if (i >= 0) S.jobs[i] = j; else S.jobs.push(j); n++; }
    render(); toast(`Imported ${n} assessment${n === 1 ? "" : "s"}.`);
  } catch (e) { toast("That file is not a Partridge FRA backup."); }
}
async function download(blob, name) {
  // In the claude.ai preview, files go through the viewer's download capability; elsewhere, a normal download.
  if (window.claude?.use) {
    const dl = await window.claude.use("downloads");
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); toast("Saved."); }
      catch (e) { if (e?.code !== "declined") toast("The file could not be saved here."); }
      return;
    }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------------- swipe to answer (one-at-a-time checks) ----------------
   Right = Yes and move on; left = No and open the note. N/A stays a tap.
   touch-action: pan-y on the card lets the page still scroll vertically. */
function swipedBefore() { try { return localStorage.getItem("pfs-swiped") === "1"; } catch { return false; } }
let SW = null;
document.addEventListener("touchstart", (e) => {
  const c = e.target.closest(".gcard:not(.end)");
  if (!c || e.touches.length > 1 || e.target.closest("textarea, input, select, .gobs, .gtools, .chips, .photos")) { SW = null; return; }
  SW = { c, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: null };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!SW) return;
  const dx = e.touches[0].clientX - SW.x, dy = e.touches[0].clientY - SW.y;
  if (SW.lock == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) SW.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
  if (SW.lock !== "x") return;
  SW.dx = dx; SW.c.style.transition = "none";
  SW.c.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
  SW.c.dataset.swipe = dx > 80 ? "yes" : dx < -80 ? "no" : "";
}, { passive: true });
document.addEventListener("touchend", () => {
  if (!SW) return; const { c, dx, lock } = SW; SW = null;
  if (lock !== "x") return;
  c.style.transition = "transform .22s ease, opacity .22s ease";
  if (Math.abs(dx) < 80) { c.style.transform = ""; c.dataset.swipe = ""; return; }
  swipeAnswer(c, dx > 0 ? "Yes" : "No");
});
function swipeAnswer(c, val) {
  const k = c.querySelector('[data-act="gans"]')?.dataset.key; if (!k) return;
  S.job.checks[k] = Object.assign(S.job.checks[k] || {}, { v: val }); save();
  try { localStorage.setItem("pfs-swiped", "1"); } catch { /* ignore */ }
  try { navigator.vibrate?.(val === "No" ? [20, 40, 20] : 15); } catch { /* not supported (iPhone) */ }
  if (val === "Yes") {
    c.style.transform = "translateX(120vw) rotate(12deg)"; c.style.opacity = "0";
    setTimeout(() => { S.gi = (S.gi || 0) + 1; S.gnote = false; render(); document.querySelector(".gcard")?.classList.add("enter"); }, 200);
  } else {
    c.style.transform = ""; setTimeout(() => { render(); toast("Marked No. Add what you found, or pick a finding."); }, 180);
  }
}
const IN_PREVIEW = /claude\.ai|claudeusercontent|anthropic/.test(location.hostname);

/* ---------------- boot ---------------- */
(async function boot() {
  /* Light by default (the app is used outdoors); dark only when chosen. */
  try { document.documentElement.dataset.theme = localStorage.getItem("pfs-theme") || "light"; } catch { document.documentElement.dataset.theme = "light"; }
  await Store.open();
  /* Ask the browser to keep this app's data: without it, iOS can clear an unused home-screen app's storage, and any browser may when space runs low. */
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) S.persisted = await navigator.storage.persist(); else S.persisted = true; } catch { /* not supported */ }
  try { await libLoad(); } catch { /* library optional */ }
  S.jobs = ((await Store.all("jobs")) || []).map(normalise);
  if (!S.jobs.length) { const ex = exampleJob(); S.jobs.push(ex); await Store.put("jobs", ex); }
  render();
  if ("serviceWorker" in navigator && !IN_PREVIEW && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
