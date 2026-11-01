/* ---------------- My findings: a library of common deficiencies ----------------
   One tap fills the note on a check, and the action, priority and basis that go to the plan.
   Built-in entries are a starting point; entries Mikey saves from his own action plans
   ("Save to my findings") are listed first and live in IndexedDB store "lib". */
"use strict";

const LIB_SEED = [
  { t: "Door not self-closing", o: "Fire door does not self-close.", a: "Fit a self-closing device to BS EN 1154 and adjust so the door closes fully into its frame and latches from any angle of opening.", p: "H", b: "L", k: "door closer self-closing flat entrance" },
  { t: "Fire door wedged or held open", o: "Fire door found wedged open.", a: "Remove the wedge and keep the door closed. If it must be held open, fit a hold-open device released by the fire alarm (BS 7273-4).", p: "H", b: "L", k: "door wedged held open" },
  { t: "Door does not latch", o: "Fire door closes but does not latch.", a: "Adjust the door, closer and latch so the door closes fully and positively latches.", p: "M", b: "L", k: "door latch" },
  { t: "Intumescent strips / smoke seals missing", o: "Intumescent strips and smoke seals missing or damaged.", a: "Fit intumescent strips and smoke seals compatible with the doorset's certification.", p: "M", b: "L", k: "door seals intumescent smoke" },
  { t: "Excessive gaps around fire door", o: "Gaps around the fire door exceed tolerance.", a: "Adjust or rehang the door so the gaps meet the doorset manufacturer's data (typically 2-4 mm at the head and sides, BS 8214); replace the door if this cannot be achieved.", p: "M", b: "L", k: "door gaps" },
  { t: "Fire door damaged", o: "Fire door leaf or frame damaged.", a: "Repair the damage using the manufacturer's approved method, or replace the doorset.", p: "M", b: "L", k: "door damage leaf frame" },
  { t: "Door to protected route not fire-resisting", o: "Door opening onto the protected route is not a fire door.", a: "Replace with a certified FD30S fire doorset installed to BS 8214, or provide evidence of the existing door's fire rating.", p: "H", b: "L", k: "door rating fire-resisting protected route" },
  { t: "Fanlight / glazing not fire-rated", o: "Glazing in the protected route is not shown to be fire-resisting.", a: "Replace with fire-resisting glazing in a fire-rated glazing system, or provide evidence of its rating.", p: "M", b: "L", k: "glazing fanlight separation" },
  { t: "Unsealed service penetrations", o: "Unsealed service penetrations through fire-resisting construction.", a: "Fire-stop the penetrations with a tested product compatible with the construction, installed by a competent contractor; keep photographic evidence or a certificate.", p: "M", b: "L", k: "fire stopping penetrations compartment separation" },
  { t: "Loft hatch in protected route", o: "Loft hatch in the protected route is not fire-resisting.", a: "Replace with a fire-resisting loft hatch matching the rating of the ceiling.", p: "M", b: "L", k: "loft hatch ceiling separation" },
  { t: "Under-stair storage", o: "Combustible storage in an unenclosed under-stair space.", a: "Remove the storage, or enclose the under-stair space in fire-resisting construction with a fire door kept locked shut.", p: "M", b: "L", k: "stairs under-stair cupboard storage" },
  { t: "Combustibles in escape route", o: "Combustible items stored in the escape route.", a: "Remove all items from the escape route and keep it clear; brief residents.", p: "H", b: "L", k: "combustibles escape route storage clear" },
  { t: "E-bike / scooter charging in common parts", o: "E-bike or e-scooter stored or charged in the common parts.", a: "Stop storage and charging of e-bikes, e-scooters and batteries in the common parts; provide safe external storage if needed and tell residents in writing.", p: "H", b: "L", k: "lithium battery charging e-bike scooter" },
  { t: "Polystyrene tiles on escape route", o: "Polystyrene ceiling tiles in the escape route.", a: "Remove the polystyrene tiles and make good the ceiling.", p: "M", b: "L", k: "linings tiles surface spread" },
  { t: "Detection not to required grade", o: "Fire detection does not meet the grade and category expected for this building.", a: "Upgrade the fire detection and alarm system to the grade and category required for this building (BS 5839-6 and the benchmark guidance) and obtain the commissioning certificate.", p: "H", b: "L", k: "detection alarm grade category coverage" },
  { t: "Detector missing or faulty", o: "Smoke detector missing or not working.", a: "Replace or reinstate the detector, interlink it with the system and retest.", p: "H", b: "L", k: "detector alarm faulty missing" },
  { t: "No alarm test records", o: "No record of routine fire alarm testing.", a: "Test the fire alarm weekly (or as the system grade requires) and record each test in the fire safety logbook.", p: "M", b: "L", k: "alarm test records logbook" },
  { t: "No alarm service certificate", o: "No current fire alarm servicing certificate seen.", a: "Have the fire alarm system inspected and serviced by a competent person at the intervals recommended in BS 5839-6 for its grade, and keep the certificate.", p: "M", b: "L", k: "alarm service certificate maintenance" },
  { t: "Emergency lighting not tested", o: "No record of emergency lighting tests.", a: "Carry out monthly functional tests and an annual full-duration test (BS 5266-1) and record them in the logbook.", p: "M", b: "L", k: "emergency lighting test records" },
  { t: "Emergency light faulty", o: "Emergency light fitting faulty or not charging.", a: "Repair or replace the emergency light fitting and retest.", p: "M", b: "L", k: "emergency lighting fitting faulty" },
  { t: "Final exit needs a key", o: "Final exit door needs a key to open from inside.", a: "Replace the lock with a single-action fastening that opens from inside without a key (e.g. thumb-turn).", p: "H", b: "L", k: "final exit key lock thumb-turn" },
  { t: "Electrical intake unenclosed", o: "Electrical intake in the escape route is not enclosed.", a: "Enclose the electrical intake in a fire-resisting cupboard kept closed.", p: "M", b: "G", k: "electrical intake meter cupboard" },
  { t: "EICR not current", o: "No current satisfactory EICR seen for the landlord's installation.", a: "Obtain a satisfactory EICR (at least every 5 years for rented homes in Wales) and complete any C1/C2 remedial work.", p: "M", b: "L", k: "electrical eicr installation" },
  { t: "Gas safety record not seen", o: "No current gas safety record (CP12) seen.", a: "Provide a current gas safety record and keep it on file.", p: "M", b: "L", k: "gas safety cp12 heating" },
  { t: "No PAT records for landlord appliances", o: "No PAT records seen for landlord-supplied portable appliances.", a: "Have landlord-supplied portable appliances inspected and tested by a competent person and keep the records.", p: "L", b: "G", k: "portable appliances pat landlord-supplied" },
  { t: "Bins against the building", o: "Refuse bins stored against the building.", a: "Store bins away from the building's doors and windows, or in a secure enclosure, to reduce the arson risk.", p: "L", b: "G", k: "arson bins refuse waste external" },
  { t: "Letterbox arson risk", o: "Letterbox opens directly into the escape route.", a: "Fit a fire-retardant letterbox bag or internal letter cage.", p: "L", b: "G", k: "arson letterbox" },
  { t: "No fire safety logbook", o: "No fire safety logbook kept.", a: "Provide a fire safety logbook and record all tests, servicing, maintenance and incidents.", p: "L", b: "G", k: "logbook records management" },
  { t: "No fire action notice", o: "No fire action notice displayed.", a: "Display fire action notices in the common parts stating the evacuation strategy, and give residents written fire safety information.", p: "L", b: "G", k: "notice signage information residents evacuation" }
].map((e, i) => ({ id: "seed" + i, ...e }));

const LIB = { mine: [] };
async function libLoad() { LIB.mine = ((await Store.all("lib")) || []).sort((a, b) => (b.n || 0) - (a.n || 0)); }
function libAll() { return [...LIB.mine.map((e) => ({ ...e, mine: true })), ...LIB_SEED]; }
const LIB_STOP = new Set("the a an and or of to in on is are be with for not no any all from by at as that this its it there where has have been fire record records current seen building where appropriate".split(" "));
const libWords = (s) => (s || "").toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 2 && !LIB_STOP.has(w));
/* Rank entries by word overlap with the context (the check text), own entries first on ties. */
function libRank(ctx) {
  const cw = new Set(libWords(ctx));
  return libAll().map((e) => ({ e, s: libWords(e.t + " " + e.k + " " + e.o).filter((w) => cw.has(w)).length + (e.mine ? 0.5 : 0) }))
    .sort((x, y) => y.s - x.s).map((x) => x.e);
}
function libSheet(ctxText, mode, key) {
  S.libCtx = { mode, key };
  const list = libRank(ctxText);
  openSheet(`<div class="sheet" role="dialog" aria-modal="true" aria-label="My findings"><div class="sheetin lib">
    <div class="sheethead"><h3>My findings</h3><button type="button" class="ghost" data-act="close-sheet">Cancel</button></div>
    <div class="libsearch"><input id="libq" type="search" placeholder="Search findings" autocomplete="off"></div>
    <ul class="liblist">${list.map((e) => `<li data-s="${esc((e.t + " " + e.o + " " + e.a + " " + (e.k || "")).toLowerCase())}"><button type="button" class="libpick" data-act="libpick" data-id="${e.id}">
      <span><strong>${esc(e.t)}</strong><small>${esc(e.a)}</small></span><em class="lpri lpri-${e.p || "x"}">${e.p || "–"}</em></button>${e.mine ? `<button type="button" class="ghost libdel" data-act="libdel" data-id="${e.id}" aria-label="Delete">✕</button>` : ""}</li>`).join("")}</ul>
  </div></div>`);
  $("#libq").addEventListener("input", (ev) => { const q = ev.target.value.toLowerCase().trim().split(/\s+/); document.querySelectorAll(".liblist li").forEach((li) => { li.hidden = !q.every((w) => li.dataset.s.includes(w)); }); });
}
async function libPick(id) {
  const e = libAll().find((x) => x.id === id); if (!e) return;
  const c = S.libCtx || {};
  if (c.mode === "check") {
    const v = S.job.checks[c.key] || (S.job.checks[c.key] = {});
    v.v = "No"; v.obs = (v.obs ? v.obs.replace(/\s*$/, " ") : "") + e.o; v.act = e.a; v.pri = e.p; v.basis = e.b;
    /* If this finding is already in the plan, update its wording there too. */
    const ex = S.job.actions.find((x) => x.src === "check:" + c.key); if (ex) { ex.action = e.a; if (!ex.priority) ex.priority = e.p; if (!ex.basis) ex.basis = e.b; }
  } else {
    S.job.actions.push({ src: "manual:" + uid(), ref: "", deficiency: e.o, action: e.a, priority: e.p || "", basis: e.b || "", who: rpNames() || "", target: "", photos: [] });
  }
  if (e.mine) { const m = LIB.mine.find((x) => x.id === id); m.n = (m.n || 0) + 1; Store.put("lib", m); }
  closeSheet(); save(); render(); toast(c.mode === "check" ? "Finding added. Action and priority go to the plan." : "Action added.");
}
async function libSaveAction(i) {
  const a = S.job.actions[i]; if (!a || !(a.action || "").trim()) { toast("Write the action first."); return; }
  const o = (a.deficiency || "").replace(/\s*Check [\d.]+ not met:.*$/s, "").replace(/^[^:]{0,80} - [^:]*:\s*/, "").trim() || a.deficiency || "";
  const t = (o.split(/[.;]/)[0] || a.action).slice(0, 60);
  if (LIB.mine.some((x) => x.a === a.action)) { toast("Already in My findings."); return; }
  const e = { id: "my" + uid(), t, o: /[.]$/.test(o) ? o : o + ".", a: a.action, p: a.priority || "", b: a.basis || "", k: "", n: 0 };
  LIB.mine.unshift(e); await Store.put("lib", e); toast("Saved to My findings.");
}
async function libDelete(id) { LIB.mine = LIB.mine.filter((x) => x.id !== id); await Store.del("lib", id); document.querySelector(`[data-id="${id}"].libdel`)?.closest("li")?.remove(); toast("Removed from My findings."); }
