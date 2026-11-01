"use strict";
/* PDF report in the Partridge Fire Safety house style (matches the 4 Cottrell Road report), built with jsPDF. */

const PDFC = { dark: [26, 45, 26], orange: [232, 100, 10], orangeTxt: [168, 67, 0], field: [246, 249, 242], line: [143, 165, 138],
  band: [232, 239, 228], rule: [201, 214, 196], text: [17, 17, 17], muted: [85, 85, 85], callout: [255, 242, 232], white: [255, 255, 255] };
const RISKC = { Trivial: [228, 239, 195], Tolerable: [243, 246, 216], Moderate: [251, 228, 160], Substantial: [244, 181, 124], Intolerable: [232, 100, 10] };
const RISK_KEY = { Trivial: "Risk to life is exceptionally low. No action needed.", Tolerable: "Existing controls are adequate. Maintain and review.",
  Moderate: "Improvements are needed to bring the risk to a tolerable level.", Substantial: "Significant improvements are required urgently.",
  Intolerable: "Unsafe for use until the risk is reduced. Immediate action." };

async function makePdf(btn) {
  if (!window.jspdf) { toast("The PDF library did not load. Reopen the app once while online."); return; }
  const old = btn.textContent; btn.textContent = "Building PDF…"; btn.disabled = true;
  try {
    let doc = await buildReport(S.job);
    if (Object.keys(doc._photoPage || {}).length) doc = await buildReport(S.job, doc._photoPage);
    const name = `${(S.job.setup.ref || "FRA").replace(/[^\w-]+/g, "_")}_${(S.job.setup.address || "report").split(",")[0].replace(/[^\w-]+/g, "_")}.pdf`;
    await download(doc.output("blob"), name);
  } catch (e) { console.error(e); toast("The PDF could not be built: " + e.message); }
  btn.textContent = old; btn.disabled = false;
}

function stampText(iso) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
  const t = new Date(iso); if (isNaN(t)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

/* Every photo in the job, in report order, numbered P1, P2... */
function photoRegister(job) {
  const prof = PROFILES[job.profile || "hmo"], meta = job.photoMeta || {}, out = [];
  const actNo = (pred) => { const i = job.actions.findIndex(pred); return i >= 0 ? String(i + 1) : ""; };
  job.locations.forEach((l) => l.items.forEach((it) => (it.photos || []).forEach((id) => {
    const sp = itemSpec(it), pr = itemProblems(it);
    out.push({ id, loc: meta[id]?.loc || `${l.floor}, ${l.name}${itemTitle(it) ? " - " + itemTitle(it) : ""}`, act: actNo((a) => a.src === "item:" + it.id || (a.photos || []).includes(id)) || (sp ? `Obs ${itemDsec(it)}` : ""),
      shows: meta[id]?.cap || `${sp?.label || "Item"}${pr.length ? ": " + pr[0] + (pr.length > 1 ? ` (+${pr.length - 1} more)` : "") : ""}`, taken: meta[id]?.taken });
  })));
  /* General photos of a location (walk-through camera button). */
  job.locations.forEach((l) => (l.photos || []).forEach((id) => out.push({ id, loc: meta[id]?.loc || `${l.floor}, ${l.name}`, act: "", shows: meta[id]?.cap || `General view: ${l.name}`, taken: meta[id]?.taken })));
  checkList(job).forEach((c) => (job.checks[c.key]?.photos || []).forEach((id) => out.push({ id, loc: meta[id]?.loc || `Check ${c.ref}`,
    act: actNo((a) => a.src === "check:" + c.key || (a.photos || []).includes(id)) || `Obs ${c.ref}`, shows: meta[id]?.cap || (job.checks[c.key].obs || c.text).slice(0, 90), taken: meta[id]?.taken })));
  Object.entries(job.docs || {}).forEach(([k, v]) => (v.photos || []).forEach((id) => out.push({ id, loc: "Documents", act: "",
    shows: meta[id]?.cap || `Document: ${prof.documents[Number(k.slice(1))] || ""}`, taken: meta[id]?.taken })));
  /* Photos attached directly to an action (not via a walk-through item). */
  const seen = new Set(out.map((p) => p.id));
  job.actions.forEach((a, i) => (a.photos || []).forEach((id) => { if (seen.has(id)) return; seen.add(id);
    out.push({ id, loc: meta[id]?.loc || `Action ${i + 1}`, act: String(i + 1), shows: meta[id]?.cap || (a.deficiency || "").slice(0, 80), taken: meta[id]?.taken }); }));
  out.forEach((p, i) => { p.ref = "P" + (i + 1); });
  return out;
}

async function buildReport(job, pageMap) {
  const { jsPDF } = window.jspdf;
  const d = new jsPDF({ unit: "pt", format: "a4" });
  const M = 42.5, FOOT = 30;
  const PW = () => d.internal.pageSize.getWidth(), PH = () => d.internal.pageSize.getHeight(), CW = () => PW() - 2 * M;
  const st = job.setup, prof = PROFILES[job.profile || "hmo"], sc = scope(job), o = job.overview || {};
  const UN = units(job);
  const U = prof.unit;
  let y = 0, headerTitle = "";
  const col = (c) => d.setTextColor(...c), fill = (c) => d.setFillColor(...c), draw = (c) => d.setDrawColor(...c);
  const font = (w = "normal", s = 8) => { d.setFont("helvetica", w); d.setFontSize(s); };
  const lines = (t, w, s = 8, wt = "normal") => { font(wt, s); return d.splitTextToSize(String(t ?? ""), Math.max(10, w)); };
  const lh = (s) => s * 1.28;
  const bottom = () => PH() - FOOT - 22;

  const scopeLabel = sc.joint ? "Whole House" : sc.rooms ? `Common Parts and ${U.Cap}s` : "Common Parts";
  const SHORT = { "Converted house - meets 1991 Building Regulations or later": "Converted House (1991 Standard)", "Converted house - below 1991 standard": "Converted House (pre-1991)",
    "Shared house (one joint tenancy, shared kitchen)": "Shared House", "Purpose-built block": "Purpose-Built Block of Flats", "Owner-occupied house with lodgers": "House with Lodgers" };
  const NUMW = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  const subLabel = job.profile === "smallconv" ? `${NUMW[parseInt(st.flats, 10) || 2] || st.flats}-Flat House Conversion` : SHORT[st[prof.subtypeKey]] || String(st[prof.subtypeKey] || prof.title).replace(/\s*\(.*?\)\s*/g, " ").trim();
  const mainTitle = `Fire Risk Assessment  |  ${scopeLabel}  |  ${subLabel}`;
  const legal = sc.joint ? (sc.lodgers ? "Housing Act 2004 (HHSRS)" : "Housing Act 2004  |  Management of HMOs (Wales) Regulations 2006") : "Regulatory Reform (Fire Safety) Order 2005";
  const footScope = sc.joint ? "Whole house assessed" : sc.rooms ? `Common parts and a sample of the ${U.many}` : `Common parts only - excludes the internal demise of each ${U.one}`;

  function header(title = mainTitle) {
    headerTitle = title;
    fill(PDFC.dark); d.rect(0, 0, PW(), 34, "F"); fill(PDFC.orange); d.rect(0, 34, PW(), 3.5, "F");
    col(PDFC.white); font("bold", 10); d.text(lines(title, PW() - 2 * M - 70, 10, "bold")[0], M, 21);
    y = 56;
  }
  /* A new page keeps the current orientation unless told otherwise, so a landscape table continues in landscape. */
  function newPage(orient, title) { d.addPage("a4", orient || (PW() > PH() ? "landscape" : "portrait")); header(title || headerTitle || mainTitle); }
  function ensure(h) { if (y + h > bottom()) newPage(); }
  function para(t, s = 7.8, wt = "normal", c = PDFC.text, gap = 5) {
    const ls = lines(t, CW(), s, wt);
    col(c); font(wt, s);
    ls.forEach((l) => { if (y + lh(s) > bottom()) { newPage(); col(c); font(wt, s); } d.text(l, M, y + s); y += lh(s); }); y += gap;
  }
  /* rich paragraph: [[text, bold?], ...] on one flow */
  function section(n, title) {
    ensure(130); y += 4; fill(PDFC.dark); d.rect(M, y, CW(), 22, "F"); fill(PDFC.orange); d.rect(M, y, 5, 22, "F");
    col(PDFC.white); font("bold", 10); d.text(`${n}   ${title.toUpperCase()}`, M + 14, y + 15); y += 30;
  }
  function subhead(t) {
    ensure(80); fill(PDFC.band); d.rect(M, y, CW(), 15, "F"); fill(PDFC.orange); d.rect(M, y, 3, 15, "F");
    col(PDFC.dark); font("bold", 7.8); d.text(t, M + 9, y + 10.5); y += 21;
  }
  function callout(title, body) {
    const ls = lines(body, CW() - 24, 7.6); const h = 20 + ls.length * lh(7.6) + 6;
    ensure(Math.min(h, 200)); fill(PDFC.callout); d.rect(M, y, CW(), h, "F"); fill(PDFC.orange); d.rect(M, y, 4, h, "F");
    col(PDFC.orangeTxt); font("bold", 7.8); d.text(title.toUpperCase(), M + 14, y + 13);
    col(PDFC.text); font("normal", 7.6); ls.forEach((l, i) => d.text(l, M + 14, y + 25 + i * lh(7.6))); y += h + 8;
  }
  function box(x, yy, w, h, text, s = 8, opts = {}) {
    fill(opts.fill || PDFC.field); draw(PDFC.line); d.setLineWidth(0.6); d.rect(x, yy, w, h, "FD");
    if (text) { col(opts.color || PDFC.text); font(opts.bold ? "bold" : "normal", s); lines(text, w - 6, s, opts.bold ? "bold" : "normal").slice(0, Math.max(1, Math.floor((h - 3) / lh(s)))).forEach((l, i) => d.text(l, x + 3, yy + s + 2.5 + i * lh(s))); }
  }
  function kv(pairs, cols = 2) {
    const gap = 10, w = (CW() - gap * (cols - 1)) / cols;
    for (let i = 0; i < pairs.length; i += cols) {
      const row = pairs.slice(i, i + cols);
      const h = Math.max(...row.map(([, v]) => Math.max(16, lines(v || "", w - 8, 8.6).length * lh(8.6) + 6)));
      if (h + 14 > bottom() - 80) {
        /* Very long text: flow each value through as many boxes and pages as it needs. */
        row.forEach(([k, v]) => {
          let ls = lines(v || "", CW() - 8, 8.6), first = true;
          while (ls.length) {
            if (bottom() - y < 60) newPage();
            const fit = Math.max(1, Math.floor((bottom() - y - 30) / lh(8.6)));
            const part = ls.slice(0, fit); ls = ls.slice(fit);
            col(PDFC.muted); font("normal", 6.6); d.text(first ? k : k + " (continued)", M, y + 6);
            const bh = part.length * lh(8.6) + 6; fill(PDFC.field); draw(PDFC.line); d.setLineWidth(0.6); d.rect(M, y + 9, CW(), bh, "FD");
            col(PDFC.text); font("normal", 8.6); part.forEach((l, n) => d.text(l, M + 3, y + 9 + 8.6 + 2.5 + n * lh(8.6)));
            y += bh + 15; first = false;
          }
        });
        continue;
      }
      ensure(h + 14);
      row.forEach(([k, v], j) => {
        const x = M + j * (w + gap); col(PDFC.muted); font("normal", 6.6); d.text(k, x, y + 6);
        box(x, y + 9, w, h, v || "", 8.6);
      });
      y += h + 15;
    }
  }
  function radio(x, yy, on) {
    draw([110, 110, 110]); d.setLineWidth(0.7); fill(PDFC.white); d.circle(x, yy, 3.6, "FD");
    if (on) { fill(PDFC.dark); d.circle(x, yy, 1.9, "F"); }
  }
  function radioRow(label, opts, val, xLabelW = 100) {
    ensure(18); col(PDFC.dark); font("bold", 7.8); d.text(label, M, y + 9);
    let x = M + xLabelW; font("normal", 7.6);
    opts.forEach((op) => { radio(x + 4, y + 6.5, val === op); col(PDFC.text); font("normal", 7.6); d.text(op, x + 11, y + 9); x += 18 + d.getTextWidth(op) + 6; });
    y += 18;
  }
  /* Generic table. cols: [{h, w, align, kind}] kind: "box" draws a field box in the cell; "radio" draws a radio (value true/false).
     rows: arrays of cells (string or {t, bold, color, fill, on}) or {group}. Rows taller than a page are split across pages. */
  function table(cols, rows, opts = {}) {
    const tw = cols.reduce((a, c) => a + c.w, 0), ws = cols.map((c) => CW() * c.w / tw), fs = opts.size || 7.3;
    /* Header font shrinks so no word is split across lines. */
    const hfs = cols.map((c, i) => { let f = 6.6; font("bold", f); while (f > 5 && String(c.h).split(/\s+/).some((w) => d.getTextWidth(w) > ws[i] - 4)) { f -= 0.3; font("bold", f); } return f; });
    const hdr = () => {
      const hh = Math.max(14, ...cols.map((c, i) => lines(c.h, ws[i] - 4, hfs[i], "bold").length * lh(hfs[i]) + 6));
      fill(PDFC.dark); d.rect(M, y, CW(), hh, "F"); col(PDFC.white);
      let x = M; cols.forEach((c, i) => { lines(c.h, ws[i] - 4, hfs[i], "bold").forEach((l, n) => { font("bold", hfs[i]); d.text(l, x + ws[i] / 2, y + 9.5 + n * lh(hfs[i]), { align: "center" }); }); x += ws[i]; });
      y += hh;
    };
    const prep = (r) => r.map((c) => (c && typeof c === "object") ? c : { t: c });
    const cellLines = (cells) => cells.map((c, i) => cols[i].kind === "radio" ? [] : lines(c.t ?? "", ws[i] - (cols[i].kind === "box" ? 10 : 8), fs, c.bold ? "bold" : "normal"));
    const first = rows.find((r) => !r.group);
    const fh = first ? Math.min(120, Math.max(opts.minH || 18, ...cellLines(prep(first)).map((l) => l.length * lh(fs) + 9))) : 20;
    ensure(30 + fh); hdr();
    rows.forEach((r) => {
      if (r.group) { if (y + 30 > bottom()) { newPage(); hdr(); } fill(PDFC.band); d.rect(M, y, CW(), 13, "F"); col(PDFC.dark); font("bold", 7); d.text(r.group, M + 5, y + 9); y += 13; return; }
      const cells = prep(r); let ls = cellLines(cells);
      while (true) {
        const room = bottom() - y;
        const need = Math.max(opts.minH || 18, ...ls.map((l) => l.length * lh(fs) + 9));
        if (need > room && need <= bottom() - 90) { newPage(); hdr(); continue; }
        if (need > room && room < 60) { newPage(); hdr(); continue; }
        const fit = Math.max(1, Math.floor((Math.min(need, room) - 9) / lh(fs) + 0.05));
        const h = Math.min(need, room);
        let x = M;
        cells.forEach((c, i) => {
          const part = ls[i].slice(0, fit), k = cols[i].kind;
          if (k === "box") { fill(c.fill || PDFC.field); draw(PDFC.line); d.setLineWidth(0.5); d.rect(x + 2, y + 2.5, ws[i] - 4, h - 5, "FD"); }
          else if (c.fill) { fill(c.fill); d.rect(x + 1, y + 1, ws[i] - 2, h - 2, "F"); }
          if (k === "radio") radio(x + ws[i] / 2, y + 9.5, !!c.on);
          col(c.color || PDFC.text); font(c.bold ? "bold" : "normal", fs);
          part.forEach((l, n) => { const yy = y + 4.5 + fs + n * lh(fs); if (cols[i].align === "center") d.text(l, x + ws[i] / 2, yy, { align: "center" }); else d.text(l, x + (k === "box" ? 5 : 4), yy); });
          x += ws[i];
        });
        draw(PDFC.rule); d.setLineWidth(0.5); d.line(M, y + h, M + CW(), y + h); y += h;
        ls = ls.map((l) => l.slice(fit));
        if (!ls.some((l) => l.length)) break;
        newPage(); hdr();
      }
    });
    y += 8;
  }
  /* Photos are kept at up to 1600 px for evidence; the report only needs about 2x the printed size,
     so each image is downscaled before it goes into the PDF. Keeps reports small enough to email. */
  async function shrinkFor(data, w, h) {
    if (!data) return data;
    const target = Math.round(Math.max(w, h) * 2.2);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data; });
      const sc = Math.min(1, target / Math.max(img.width, img.height));
      if (sc > 0.9 && data.length < 300000) return data;
      const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      return cv.toDataURL("image/jpeg", 0.7);
    } catch (e) { return data; }
  }
  async function placeImage(id, x, yy, w, h) {
    const data = await shrinkFor(await photoData(id), w, h); if (!data) return false;
    const ip = d.getImageProperties(data); const s = Math.min((w - 6) / ip.width, (h - 6) / ip.height);
    d.addImage(data, "JPEG", x + (w - ip.width * s) / 2, yy + (h - ip.height * s) / 2, ip.width * s, ip.height * s);
    return true;
  }

  const photos = photoRegister(job);
  const photoRefs = (pred) => { const r = photos.filter(pred).map((p) => p.ref); if (!r.length) return ""; return r.length > 2 ? `${r[0]}-${r[r.length - 1]}` : r.join(", "); };
  const rating = riskOf(job.risk.likelihood, job.risk.consequence);

  /* ---------- cover ---------- */
  fill(PDFC.dark); d.rect(0, 0, PW(), 170, "F"); fill(PDFC.orange); d.rect(0, 170, PW(), 5, "F");
  col(PDFC.white); font("bold", 30); d.text("FIRE RISK ASSESSMENT", M, 78);
  font("normal", 13); d.text(`${scopeLabel}  |  ${lines(subLabel, CW() - 140, 13)[0]}`, M, 104);
  font("normal", 7.6); d.text(`${legal}  |  Methodology: ${prof.standard}`, M, 132);
  y = 192;
  const boxH = 270;
  fill(PDFC.field); draw(PDFC.line); d.setLineWidth(0.8); d.rect(M, y, CW(), boxH, "FD");
  const cover = job.cover?.photos?.[0];
  if (!cover || !(await placeImage(cover, M, y, CW(), boxH))) { col(PDFC.muted); font("italic", 8); d.text("Front elevation photograph not added", PW() / 2, y + boxH / 2, { align: "center" }); }
  y += boxH + 16;
  col(PDFC.orange); font("bold", 7.2); d.text("PREMISES", M, y); y += 6;
  box(M, y, CW() * 0.76, 34, ""); box(M + CW() * 0.78, y + 12, CW() * 0.22, 22, "");
  col(PDFC.text); font("normal", 12); lines(st.address || "", CW() * 0.76 - 10, 12).slice(0, 2).forEach((l, n) => d.text(l, M + 5, y + 15 + n * 14));
  col(PDFC.muted); font("normal", 6.6); d.text("Postcode", M + CW() * 0.78, y + 8); col(PDFC.text); font("normal", 12); d.text(st.postcode || "", M + CW() * 0.78 + 5, y + 28);
  y += 48; draw(PDFC.rule); d.line(M, y, PW() - M, y); y += 12;
  col(PDFC.orange); font("bold", 7.2); d.text("ASSESSMENT DETAILS", M, y); y += 4;
  kv([[prof.subtypeLabel, st[prof.subtypeKey]], ["Responsible Person(s)", rpNames(job)], ["Assessor", st.assessor], ["Qualifications / membership", st.quals],
    ["Date of assessment", ukDate(st.date)], ["Next review due", ukDate(st.review)], ["Report reference", st.ref], ["Overall risk rating", rating]]);
  { const msg = sc.joint ? (sc.lodgers ? "House with lodgers: the Fire Safety Order does not normally apply. Whole house assessed." : "Shared house on one joint tenancy: the Fire Safety Order does not apply (LACORS 35.5). Whole house assessed.") : sc.rooms ? `${sc.type}: common parts and a sample of the ${U.many}.` : `Common parts only. This assessment excludes the internal demise of each ${U.one}.`;
    ensure(30); fill(PDFC.callout); d.rect(M, y + 4, CW(), 24, "F"); fill(PDFC.orange); d.rect(M, y + 4, 4, 24, "F"); col(PDFC.orangeTxt); font("bold", 7.8); d.text(msg, M + 14, y + 19); y += 34; }

  /* ---------- intro + section 1 ---------- */
  newPage();
  col(PDFC.dark); font("bold", 17); d.text(`FIRE RISK ASSESSMENT - ${scopeLabel.toUpperCase()}`, M, y + 8); y += 20;
  col(PDFC.muted); font("normal", 9); d.text(`${subLabel}  |  ${prof.title}`, M, y + 4); y += 14;
  para(sc.joint ? `Framework: ${sc.why} The assessment applies ${prof.standard} as the methodology to inform the duties under the ${sc.law}.`
    : `Framework: this assessment is carried out under the Regulatory Reform (Fire Safety) Order 2005 (the Order) and applies ${prof.standard} as the methodology framework. It is a BS 9792 ${sc.type} assessment.`);
  callout(sc.joint ? "Scope - whole house" : sc.rooms ? `Scope - common parts and ${U.many}` : "Scope - common parts only", scopeText(job));
  para(`${job.profile !== "hmo" ? "Approved Document B (Wales), LACORS Housing - Fire Safety" : "LACORS Housing - Fire Safety"} and ${prof.detectionStd} are used as benchmarks for a building of this type. Benchmarks are applied as guidance, not rigid standards; departures are justified in the risk rating section.`);
  para("Key: Yes = satisfactory. No = deficiency (listed in the action plan). N/A = not applicable, or not established at the visit.", 7.2, "italic", PDFC.muted);
  section(1, "Premises details");
  kv([["Time arrived", st.arrived], ["Time departed", st.departed], ["Enforcing authority", st.enforcer], ["Person present / access provided by", st.present],
    ["BS 9792 type of assessment", st.bs9792 || "Type 1"], ["Report status", st.status]].concat(sc.cat ? [["Building Safety (Wales) Act 2026 category (provisional)", sc.cat]] : []));
  const lic = prof.licensing && !sc.lodgers;
  subhead(lic ? "HMO classification and licensing" : "Building classification");
  kv(prof.subtype.filter(([, , , show]) => !show || show(st)).map(([k, label]) => [label, st[k]]).concat(lic ? [["HMO licence number", st.licence], ["Licence expiry", ukDate(st.licenceExp)], ["Local authority", st.la], ["Rent Smart Wales ref", st.rsw]] : []));
  subhead("Construction and layout");
  kv([["Approx. year built", o.year], ["Main structure and walls", o.construction], ["Roof", o.roof], ["Floors", o.floors], ["Basement / cellar", o.basement], ["Loft conversion", o.loft], ["Sprinklers / suppression", o.sprinkler], ["Cladding or attachments", o.cladding]]);
  kv([["Layout and common parts", o.layout]], 1);
  ensure(110);
  if (!UN) { fill(PDFC.dark); d.rect(M, y, CW(), 16, "F"); col(PDFC.white); font("bold", 7.6); d.text(sc.joint ? "LANDLORD / PERSON MANAGING THE HOUSE" : "RESPONSIBLE PERSON (identified at time of assessment)", M + 6, y + 11); y += 20; }
  if (UN) {
    (rpSame(st) ? ["All flats"] : UN).forEach((u, i) => { const k = "rp" + (i + 1);
      ensure(150); fill(PDFC.dark); d.rect(M, y, CW(), 16, "F"); col(PDFC.white); font("bold", 7.6); d.text(`RESPONSIBLE PERSON - ${u.toUpperCase()} (identified at time of assessment)`, M + 6, y + 11); y += 20;
      kv([["Name", st[k]], ["Status at date of assessment", st[k + "Status"]], [`${u} at date of assessment`, st[k + "Occ"]], ["Telephone", st[k + "Tel"]], ["Email", st[k + "Email"]], ["Address for service (if different)", st[k + "Addr"]]], 3);
      kv([["Basis on which the RP was identified", st[k + "Basis"]]], 1); });
    if (st.rp || st.agent) kv([["Managing agent or other Responsible Person", [st.rp, st.agent].filter(Boolean).join("; ")]], 1);
    kv([["Fire history", o.fires]], 1);
  } else {
  kv([["Name", st.rp], ["Managing agent (if different)", st.agent], ["Telephone", st.rpTel], ["Email", st.rpEmail]]);
  kv([["Basis on which identified", st.rpBasis], ["Fire history", o.fires]], 2);
  }
  para(`${sc.joint ? "Landlord" : "Responsible Person (RP)"}: identified from the information available at the time of the assessment. Where this is not the right person, they should pass the report to the person in control of the premises.`, 7, "italic", PDFC.muted);

  /* ---------- section 2 ---------- */
  section(2, "Limitations and liability");
  para(`2.1 Basis of the assessment. This assessment reflects the conditions observed on the date of the visit recorded in Section 1. It is based on a visual, ${sc.intrusive ? "intrusive (sampled)" : "non-intrusive"} inspection. Fire safety conditions can change after that date.`);
  para(`2.2 Scope. ${scopeText(job)} It excludes areas not accessible at the time of the assessment, listed below; a follow-up check of those areas is included in the action plan.`);
  kv([["Areas not accessible or not inspected at the time of the assessment", job.notAccessed]], 1);
  subhead("Documents provided by the Responsible Person");
  const docSt = (r) => ["Sighted", "Not sighted", "N/A"].map((v) => ({ on: r.s === v }));
  table([{ h: "Document", w: 4 }, { h: "Sighted", w: 0.7, kind: "radio" }, { h: "Not sighted", w: 0.8, kind: "radio" }, { h: "N/A", w: 0.55, kind: "radio" }, { h: "Date or reference", w: 2.6, kind: "box" }],
    prof.documents.map((doc, i) => [doc, i]).filter(([doc]) => !(sc.lodgers && /licen/i.test(doc))).map(([doc, i]) => { const r = job.docs?.["d" + i] || {}; return [doc, ...docSt(r), r.ref || ""]; }), { size: 7 });
  para("Documents are recorded as sighted only. Their validity, completeness and compliance have not been verified by the assessor.", 7, "italic", PDFC.muted);
  if (job.docsOther) kv([["Other documents or information (or stated as not available)", job.docsOther]], 1);
  para(sc.joint ? `2.3 Responsibility. As the Fire Safety Order does not apply, responsibility for fire safety rests with the ${sc.lodgers ? "owner" : "landlord or person managing the house"} under the ${sc.law}. The assessor's role is limited to identifying and reporting findings based on the inspection carried out.`
    : `2.3 Responsibility. Overall responsibility for fire safety at the premises rests with the Responsible Person under the Regulatory Reform (Fire Safety) Order 2005${prof.licensing ? " and, for an HMO, the Housing Act 2004 and the Management of Houses in Multiple Occupation (Wales) Regulations 2006" : " as amended by the Fire Safety Act 2021"}. The assessor's role is limited to identifying and reporting findings based on the inspection carried out.`);
  para("2.4 Liability. The assessor accepts no liability for: (a) fire safety failures at the premises; (b) management decisions; (c) works carried out by others after the date of the assessment; or (d) non-implementation of the recommendations by the Responsible Person.");
  ensure(16); { const yy = y; draw(PDFC.line); d.setLineWidth(0.7); d.rect(M, yy + 1, 8, 8); if (st.scopeExplained) { col(PDFC.dark); font("bold", 8); d.text("x", M + 2.2, yy + 7.6); } col(PDFC.text); font("normal", 7.6); d.text("Scope and limitations explained to the person(s) present and to the Responsible Person on receipt of the report.", M + 14, yy + 8); y += 16; }

  /* ---------- check sections ---------- */
  const cl = checkList(job);
  const bm = bench(job);
  /* Benchmark lines shown at the top of each section, by display section (Cottrell Road order). */
  const BM_KEYS = { 3: ["Cellar"], 5: ["Separation", "Fire resistance", "External walls", "Non-residential use", "Cellar / basement", "Basement"], 6: ["Flat entrance doors"],
    7: ["Escape route", "Escape route and separation", "Travel distance"], 8: ["Emergency lighting"], 9: ["Detection", "Manual call points", "Maisonettes", "Short-term occupancy"], 10: ["Firefighting", "Smoke ventilation"] };
  const SPEC_SHORT = (lab) => lab.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  async function checkSection(n) {
    const s = dsecs(job).find((x) => x.n === n); if (!s) return;
    section(n, s.title);
    const bl = bm.lines.filter(([k]) => (BM_KEYS[n] || []).includes(k));
    if (bl.length) callout("Standard / benchmark", bl.map(([k, v]) => `${k}: ${v}`).join("\n"));
    if (n === 9) kv([[`Detection inside ${U.many} confirmed by`, o.detInside], [`${U.Cap}s entered`, o.roomsEntered || (sc.rooms ? "" : "None (not in scope)")]]);
    let lastG; const rows = [];
    cl.filter((c) => c.sec === n).forEach((c) => {
      if (c.group && c.group !== lastG) rows.push({ group: c.group }); lastG = c.group;
      const v = job.checks[c.key] || {};
      const ev = !sc.rooms && !v.obs && (prof.roomChecks || []).includes(c.key) ? `${U.Cap}s not entered: confirmed by evidence.` : "";
      rows.push([{ t: c.ref, bold: true }, c.text, { on: v.v === "Yes" }, { on: v.v === "No" }, { on: v.v === "NA" }, { t: (v.obs || "") + (v.v ? ev : ""), fill: v.v === "No" ? PDFC.callout : null }]);
    });
    if (rows.length) table([{ h: "Ref", w: 0.55, align: "center" }, { h: "Check (Yes = satisfactory)", w: 4.0 }, { h: "Yes", w: 0.4, kind: "radio" }, { h: "No", w: 0.4, kind: "radio" }, { h: "N/A", w: 0.4, kind: "radio" }, { h: "Observations / evidence", w: 3.3, kind: "box" }], rows);
    { const sf = (prof.sectionFields || {})[n] || []; if (sf.length) { const short = sf.filter(([, , o]) => o !== "area"), long = sf.filter(([, , o]) => o === "area");
      if (short.length) kv(short.map(([k, lab]) => [lab, job.sf?.[k]]), 2); if (long.length) kv(long.map(([k, lab]) => [lab, job.sf?.[k]]), 1); } }
    /* Walk-through items: one schedule per item type, like the Cottrell Road door table. */
    const groups = {};
    job.locations.forEach((l) => l.items.forEach((it) => { const sp = itemSpec(it); if (sp && itemDsec(it) === n) { const gk = (it.p || job.profile) + ":" + it.k; (groups[gk] = groups[gk] || []).push({ it, l, sp }); } }));
    for (const k of Object.keys(groups)) {
      const g = groups[k], sp = g[0].sp;
      const locKey = sp.fields.find(([fk, , t]) => t === "text" && /^(loc|ref|from|fac|svc|dev)$/.test(fk))?.[0];
      const fieldsAll = sp.fields.filter(([fk]) => fk !== locKey && g.some(({ it }) => it.f?.[fk]));
      const parts = Math.max(1, Math.ceil(fieldsAll.length / 7)), per = Math.ceil(fieldsAll.length / parts) || 1;
      for (let c0 = 0; c0 < Math.max(1, fieldsAll.length); c0 += per) {
        const fields = fieldsAll.slice(c0, c0 + per);
        ensure(170); subhead(`${sp.label} schedule${parts > 1 ? ` (${c0 / per + 1} of ${parts})` : ""}`);
        const cols = [{ h: "Location", w: 1.5, kind: "box" }, ...fields.map(([, lab]) => ({ h: SPEC_SHORT(lab), w: 0.85, kind: "box" })), { h: "Result", w: 0.6, align: "center" }, { h: "Comments", w: 2, kind: "box" }];
        table(cols, g.map(({ it, l }) => {
          const r = itemResult(it), pr = itemProblems(it), refs = photoRefs((p) => (it.photos || []).includes(p.id));
          return [`${l.floor}, ${l.name}${l.area === "Letting" ? ` (${U.one})` : ""}${locKey && it.f?.[locKey] ? " - " + it.f[locKey] : ""}`,
            ...fields.map(([fk, lab, t, , bad]) => { const v = it.f?.[fk] || ""; const isBad = (t === "yn" && v === "No") || (t === "yes" && v === "Yes") || (t === "sel" && bad && bad.includes(v)); return { t: v, fill: isBad ? PDFC.callout : null, color: isBad ? PDFC.orangeTxt : null }; }),
            { t: r, bold: true, color: r === "Fail" ? PDFC.orangeTxt : PDFC.text }, c0 + per >= fieldsAll.length ? [pr.join("; "), it.note, refs ? `Photos ${refs}` : ""].filter(Boolean).map((x) => String(x).trim().replace(/\.+$/, "")).join(". ") : "Continued below"];
        }), { size: 6.6 });
      }
    }
    /* Section conclusion */
    const c = job.conclusions?.["c" + n];
    const refs = job.actions.map((a, i) => ({ a, i })).filter(({ a }) => String(a.ref).split(/[.,\s-]/)[0] === String(n)).map(({ i }) => "A" + (i + 1));
    ensure(28); fill(PDFC.band); d.rect(M, y, CW(), 24, "F"); col(PDFC.dark); font("bold", 7.8); d.text("Section conclusion", M + 6, y + 15);
    let x = M + 92; ["Satisfactory", "Action required", "Not applicable"].forEach((op) => { radio(x + 4, y + 12.5, c === op); col(PDFC.text); font("normal", 7.6); d.text(op, x + 11, y + 15); x += 22 + d.getTextWidth(op); });
    col(PDFC.muted); font("normal", 6.8); d.text("Action plan ref(s)", M + CW() - 170, y + 15); box(M + CW() - 100, y + 4, 94, 16, refs.join(", "), 7.6);
    y += 32;
  }
  await checkSection(3);
  section(4, "People at risk");
  kv([["Occupancy type", o.occupancy], ["Sleeping risk", o.sleep]]);
  table([{ h: "Group", w: 4 }, { h: "Yes", w: 0.5, kind: "radio" }, { h: "No", w: 0.5, kind: "radio" }, { h: "Not known", w: 0.7, kind: "radio" }, { h: "Notes and arrangements", w: 3.6, kind: "box" }],
    prof.vulnerable.map((g, i) => { const v = o.vulnerable?.["v" + i] || {}; return [g, { on: v.v === "Yes" }, { on: v.v === "No" }, { on: v.v === "Not known" }, v.n || ""]; }), { size: 7 });
  { const c = job.conclusions?.c4; if (c) { ensure(24); fill(PDFC.band); d.rect(M, y, CW(), 22, "F"); col(PDFC.dark); font("bold", 7.8); d.text("Section conclusion", M + 6, y + 14); col(PDFC.text); font("normal", 7.6); d.text(c, M + 100, y + 14); y += 30; } }
  for (const n of [5, 6, 7, 8, 9, 10, 11]) await checkSection(n);
  /* Sections after the checks are numbered on from the last check section (12 for HMO and flats, 10 for the two-flat template). */
  const RN = Math.max(...dsecs(job).map((x) => x.n)) + 1;

  /* ---------- risk rating ---------- */
  /* ---------- testing schedule ---------- */
  if (!prof.testSchedule) {
  subhead("Testing and maintenance schedule");
  table([{ h: "System", w: 3 }, { h: "Standard", w: 2.4 }, { h: "Routine", w: 3 }], job.profile !== "hmo" ? [
    ["Emergency lighting", "BS 5266-1:2025", "Monthly functional test; annual full-duration test"],
    ["Flat entrance and communal fire doors", "BS 8214:2026", "Routine checks of communal doors; periodic checks of flat entrance doors"],
    ["Smoke ventilation (AOV / vents)", "Manufacturer / installer", "Routine operation test; annual service by a competent person"],
    ["Dry / wet riser (where fitted)", "BS 9990", "6-monthly visual inspection; annual pressure test"],
    ["Communal fire alarm or detection (where fitted)", "BS 5839-1:2025 / BS 5839-6", "Weekly test, 6-monthly service by a competent person"],
    ["Evacuation alert system (where fitted)", "BS 8629", "Routine tests and servicing as BS 8629"],
    ["Electrical installation, common parts (EICR)", "BS 7671", "At the interval stated on the EICR (normally 5 years)"]] : [
    ["Fire alarm system (Grade A)", "BS 5839-1:2025 / BS 5839-6", "Weekly test, 6-monthly service by a competent person"],
    ["Smoke and heat alarms (Grade D)", "BS 5839-6:2019+A1:2020", "Monthly test; replace alarms per manufacturer"],
    ["Emergency lighting", "BS 5266-1:2025", "Monthly functional test; annual full-duration test"],
    ["Fire extinguishers and blankets", "BS 5306-3", "Monthly visual check; annual service"],
    ["Fire doors", "BS 8214:2026", "Routine checks of closers, seals and gaps; periodic inspection"],
    ["Electrical installation (EICR)", "BS 7671", "At the interval stated on the EICR (normally 5 years)"],
    ["Gas safety record", "Gas Safety (Installation and Use) Regs 1998", "Annually"]]);
  }

  newPage("portrait");
  section(RN, "Risk rating and action plan");
  subhead(`${RN}.1 Risk rating (BS 9792:2025)`);
  radioRow("Step 1: likelihood of fire", ["Low", "Medium", "High"], job.risk.likelihood, 150);
  para("Low = abnormally low for this type of premises. Medium = typical for this type of premises. High = serious shortcomings in the control of fire hazards.", 6.8, "italic", PDFC.muted);
  radioRow("Step 2: likely consequences of fire", CONS, job.risk.consequence, 150);
  para("Slight = serious injury or death unlikely. Moderate = serious injury possible, multiple fatalities unlikely. Extreme = one or more occupants likely to be seriously injured or killed.", 6.8, "italic", PDFC.muted);
  ensure(90);
  const mw = CW() / 4; fill(PDFC.dark); d.rect(M, y, CW(), 15, "F"); col(PDFC.white); font("bold", 7.2);
  ["Likelihood of fire", ...CONS].forEach((h, i) => d.text(h, M + mw * i + mw / 2, y + 10.5, { align: "center" })); y += 15;
  Object.entries(MATRIX).forEach(([l, row]) => {
    fill(PDFC.band); d.rect(M, y, mw, 17, "F"); col(PDFC.dark); font("bold", 7.4); d.text(l, M + mw / 2, y + 11.5, { align: "center" });
    row.forEach((v, i) => {
      const sel = job.risk.likelihood === l && job.risk.consequence === CONS[i];
      fill(RISKC[v]); d.rect(M + mw * (i + 1), y, mw, 17, "F");
      if (sel) { draw(PDFC.dark); d.setLineWidth(2); d.rect(M + mw * (i + 1) + 1, y + 1, mw - 2, 15); d.setLineWidth(0.5); }
      col(v === "Intolerable" ? PDFC.white : PDFC.text); font(sel || v === "Intolerable" ? "bold" : "normal", 7.4); d.text(v, M + mw * (i + 1) + mw / 2, y + 11.5, { align: "center" });
    });
    y += 17;
  });
  y += 4; para("Matrix: BS 9792:2025 example risk level estimator (three likelihood levels, three consequence levels, five risk levels).", 6.8, "italic", PDFC.muted);
  radioRow("Step 3: overall fire risk", Object.keys(RISKC), rating, 150);
  table([{ h: "Risk level", w: 1.2 }, { h: "Meaning", w: 6 }], Object.keys(RISKC).map((k) => [{ t: k, bold: true, fill: RISKC[k], color: k === "Intolerable" ? PDFC.white : PDFC.text }, RISK_KEY[k]]), { size: 7, minH: 14 });
  kv([["Assessor justification for the overall rating", job.risk.justification], ["Departures from recognised standards accepted without upgrade, with the reason for accepting them", job.risk.departures]], 1);
  kv([["Residual likelihood", job.risk.resLike], ["Residual consequence", job.risk.resCons], ["Predicted residual rating", riskOf(job.risk.resLike, job.risk.resCons)]], 3);
  ensure(16); { const yy = y; draw(PDFC.line); d.setLineWidth(0.7); d.rect(M, yy + 1, 8, 8); if (job.risk.seriousInformed) { col(PDFC.dark); font("bold", 8); d.text("x", M + 2.2, yy + 7.6); } col(PDFC.text); font("bold", 7.6); d.text("Serious risk to persons identified: the Responsible Person was informed before the assessor left the premises.", M + 14, yy + 8); y += 18; }

  /* ---------- action plan (landscape, boxed rows like the Cottrell Road report) ---------- */
  newPage("landscape");
  subhead(`${RN}.2 Action plan`);
  const due = (a) => a.target || ({ H: "1 month", M: "3 months", L: "12 months" }[a.priority] || "");
  table([{ h: "No.", w: 0.35, align: "center" }, { h: "Ref", w: 0.5, kind: "box" }, { h: "Deficiency identified", w: 3.2, kind: "box" }, { h: "Recommended action", w: 3.2, kind: "box" },
    { h: "Priority", w: 0.55, kind: "box", align: "center" }, { h: "Basis", w: 0.5, kind: "box", align: "center" }, { h: "Responsible Person", w: 1.2, kind: "box" }, { h: "Target date", w: 0.8, kind: "box" },
    { h: "Photo ref(s)", w: 0.75, kind: "box" }, { h: "Date closed", w: 0.7, kind: "box" }],
    (job.actions.length ? job.actions : [{}]).map((a, i) => {
      const it = a.src?.startsWith("item:") ? a.src.slice(5) : null;
      const refs = photoRefs((p) => (a.photos || []).includes(p.id) || (it && job.locations.some((l) => l.items.some((x) => x.id === it && (x.photos || []).includes(p.id)))));
      return job.actions.length ? [{ t: String(i + 1), bold: true }, a.ref || "", a.deficiency || "", a.action || "", { t: a.priority || "", bold: true }, a.basis || "", a.who || st.rp || "", due(a), refs, a.closed || ""]
        : ["", "", "No actions are needed beyond maintaining the existing standard of fire precautions.", "", "", "", "", "", "", ""];
    }), { minH: 60, size: 7.2 });
  para(`Priority: ${prof.priorities.map((p) => `${p.k} = ${p.label} (${p.time.toLowerCase()})`).join("  |  ")}.  Basis: L = legal requirement${sc.joint ? ` (${sc.law})` : " under the Order"}  |  G = good practice.`, 7, "italic", PDFC.muted);

  if (job.interim.length) newPage("portrait");
  if (job.interim.length) {
    subhead(`${RN}.3 Interim measures`);
    table([{ h: "Action ref", w: 0.8, align: "center" }, { h: "Interim measure", w: 5, kind: "box" }, { h: "Responsible Person", w: 1.5, kind: "box" }, { h: "Date in place", w: 1, kind: "box" }],
      job.interim.map((m) => [m.ref || "", m.measure || "", m.who || "", m.date || ""]));
  }
  if (!job.interim.length) newPage("portrait");
  /* ---------- photographic evidence register ---------- */
  if (photos.length) {
    section(RN + 1, "Photographic evidence");
    para("Photographs supporting each deficiency in the action plan are referenced below and shown in Appendix A. Date and time are when each photograph was taken.", 7.6);
    table([{ h: "Photo ref", w: 0.7, kind: "box" }, { h: "Action no.", w: 0.7, kind: "box" }, { h: "Location", w: 2, kind: "box" }, { h: "What the photograph shows", w: 3.2, kind: "box" }, { h: "Date / time", w: 1.2, kind: "box" }, { h: "File / folder ref", w: 1.2, kind: "box" }],
      photos.map((p) => [p.ref, p.act, p.loc, p.shows, stampText(p.taken), pageMap?.[p.ref] ? `Appendix A, p.${pageMap[p.ref]}` : "Appendix A"]), { size: 7 });
  }

  /* ---------- declaration ---------- */
  ensure(380); section(photos.length ? RN + 2 : RN + 1, "Declaration and sign-off");
  para(`I confirm that this assessment was carried out ${sc.joint ? `to inform the duties under the ${sc.law} (the Fire Safety Order does not apply)` : "under the Regulatory Reform (Fire Safety) Order 2005"}, applying ${prof.standard} as the methodology framework, and that it records the conditions observed during the visual inspection on the date shown. It is subject to the limitations and liability statement in Section 2.`);
  kv([["Assessor name", st.assessor], ["Company", st.company], ["Qualifications / membership", st.quals], ["Assessor signature", ""]]);
  kv([["Date of assessment", ukDate(st.date)], ["Date of report", ukDate(st.reportDate)], ["Review due", ukDate(st.review)]], 3);
  para("Review annually, or sooner after any significant change to the premises, occupants or fire safety arrangements.", 6.8, "italic", PDFC.muted);
  if (st.checker) kv([["Report checked by", st.checker], ["Checker qualifications", st.checkerQuals]]);
  ensure(110);
  { const acks = UN ? UN.map((u, i) => [`RESPONSIBLE PERSON ACKNOWLEDGEMENT - ${u.toUpperCase()}`, [rpVal(st, i + 1), rpVal(st, i + 1, "Status")].filter(Boolean).join(", ")])
      : [[sc.joint ? "LANDLORD ACKNOWLEDGEMENT" : "RESPONSIBLE PERSON ACKNOWLEDGEMENT", st.rp || ""]];
    const per = Math.min(2, acks.length), gap = 14, w = (CW() - gap * (per - 1)) / per;
    let y0 = y;
    acks.forEach(([title, who], k) => { if (k % per === 0) { if (k) y += 6; ensure(140); y0 = y; } const x = M + (k % per) * (w + gap); let yy = y0;
      fill(PDFC.dark); d.rect(x, yy, w, 16, "F"); col(PDFC.white); font("bold", per > 1 ? 6.8 : 7.6); d.text(title, x + 6, yy + 11); yy += 22;
      col(PDFC.muted); font("normal", 6.6); d.text("Name and capacity", x, yy + 6); box(x, yy + 9, w * (per > 1 ? 1 : 0.6), 18, who, 8.4); yy += 34;
      col(PDFC.muted); font("normal", 6.6); d.text("Signature", x, yy + 6); d.text("Date", x + w * (per > 1 ? 0.6 : 0.42), yy + 6);
      box(x, yy + 9, w * (per > 1 ? 0.55 : 0.38), 34, ""); box(x + w * (per > 1 ? 0.6 : 0.42), yy + 9, w * (per > 1 ? 0.4 : 0.2), 18, ""); yy += 50;
      draw(PDFC.line); d.setLineWidth(0.7); d.rect(x, yy + 1, 8, 8); col(PDFC.text); font("normal", 7.4); d.text("Report received and Section 2 explained", x + 14, yy + 8); yy += 20;
      if (k % per === per - 1 || k === acks.length - 1) y = yy; }); }
  para("This document remains the property of the assessor. It should be kept at the premises and made available to the enforcing authority on request.", 7, "italic", PDFC.muted);

  /* ---------- Recommended testing and maintenance schedule (v3 two/three/four-flat templates, section 13) ---------- */
  if (prof.testSchedule) {
    newPage("portrait");
    section((photos.length ? RN + 2 : RN + 1) + 1, "Recommended testing and maintenance schedule");
    para("For the Responsible Person. This is recommended practice for the systems found in the common parts; the Responsible Person remains responsible for carrying out and recording the checks (Section 2.3). Rows that do not apply at this property are left unticked. Record each test in the log below. Frequencies follow the standards named.", 7.4);
    table([{ h: "Applies", w: 0.6, kind: "radio" }, { h: "System", w: 2.1 }, { h: "Standard", w: 2 }, { h: "Routine", w: 4.3 }],
      prof.testSchedule.map(([sys, std, routine, applies]) => [{ on: !!applies(job) }, { t: sys, bold: true }, std, routine]), { size: 7.2 });
    subhead("Record of tests and checks");
    table([{ h: "Date", w: 1, kind: "box" }, { h: "System", w: 1.8, kind: "box" }, { h: "Test or check carried out", w: 2.6, kind: "box" }, { h: "Result / defects found", w: 2.6, kind: "box" }, { h: "Done by", w: 1.2, kind: "box" }],
      Array.from({ length: 12 }, () => ["", "", "", "", ""]), { minH: 22 });
  }

  /* ---------- Appendix A: photographs, four to a page with captions ---------- */
  const photoPage = {};
  if (photos.length) {
    const apx = "Fire Risk Assessment  |  Appendix A - Photographic Evidence";
    const slotW = (CW() - 14) / 2, slotH = 196;
    for (let i = 0; i < photos.length; i++) {
      if (i % 4 === 0) {
        newPage("portrait", apx);
        const w = CW(); [["Premises address", st.address, 0, 0.5], ["Report ref", st.ref, 0.52, 0.13], ["Date of assessment", ukDate(st.date), 0.66, 0.13], ["Assessor", st.assessor, 0.8, 0.2]]
          .forEach(([k, v, x0, ww]) => { col(PDFC.muted); font("normal", 6.4); d.text(k, M + w * x0, y); box(M + w * x0, y + 3, w * ww - 2, 14, v || "", 7.6); });
        y += 34;
      }
      const p = photos[i], cx = M + (i % 2) * (slotW + 14), cy = y + Math.floor((i % 4) / 2) * (slotH + 82);
      photoPage[p.ref] = d.getNumberOfPages();
      fill(PDFC.field); draw(PDFC.line); d.setLineDashPattern([2, 1.5], 0); d.setLineWidth(0.6); d.rect(cx, cy, slotW, slotH, "FD"); d.setLineDashPattern([], 0);
      await placeImage(p.id, cx, cy, slotW, slotH);
      let yy = cy + slotH + 4;
      [["Photo ref", p.ref, 0, 0.14], ["Action no.", p.act, 0.15, 0.14], ["Date / time taken", stampText(p.taken) || "Not recorded", 0.30, 0.30], ["Location", p.loc, 0.61, 0.39]].forEach(([k, v, x0, ww]) => { col(PDFC.muted); font("normal", 6.2); d.text(k, cx + slotW * x0, yy + 5); box(cx + slotW * x0, yy + 7, slotW * ww - 2, 20, v || "", 6.6); });
      yy += 31; col(PDFC.muted); font("normal", 6.2); d.text("What the photograph shows", cx, yy + 5); box(cx, yy + 7, slotW, 24, p.shows, 7);
      if (i % 4 === 3) y = PH();
    }
  }

  /* footers */
  const n = d.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    d.setPage(p); const pw = PW(), ph = PH();
    draw(PDFC.rule); d.setLineWidth(0.6); d.line(M, ph - FOOT - 10, pw - M, ph - FOOT - 10);
    col(PDFC.muted); font("normal", 6.6);
    d.text(lines(`${legal}  |  Methodology: ${prof.standard}  |  ${footScope}`, pw - 2 * M - 70, 6.6)[0], M, ph - FOOT + 2);
    d.text(`Page ${p} of ${n}`, pw - M, ph - FOOT + 2, { align: "right" });
  }
  d._photoPage = photoPage;
  d.setProperties({ title: `Fire Risk Assessment - ${st.address || ""}`, author: st.assessor || "Partridge Fire Safety", creator: "Partridge FRA app" });
  return d;
}
