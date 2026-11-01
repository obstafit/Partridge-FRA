/* ---------------- AI assistant ----------------
   Uses the claude.ai artifact `sample` capability: only available when the app is opened
   inside Claude (it spends the assessor's own Claude usage and needs a signal). In the
   standalone PWA, or offline, the button never appears. Read-only: it never changes the job;
   the assessor can insert an answer into the field they last used. */
"use strict";

const AI = { sample: null, images: null, tools: false, turns: [], busy: null, open: false, lastField: null, pics: [] };

/* Read-only lookups the assistant can use when the summary in the prompt is not enough. They never change the job. */
const AI_TOOLS = [
  { name: "get_section", description: "Returns every check in one report section (3 hazards, 5 separation, 6 fire doors, 7 means of escape, 8 emergency lighting, 9 detection, 10 signage and firefighting, 11 management) with the assessor's answer (Yes/No/NA/blank) and observation, plus the walk-through items filed in that section with their recorded fields and result. Use it to review a section in detail.",
    inputSchema: { type: "object", properties: { n: { type: "integer", description: "Section number" } }, required: ["n"] },
    execute: ({ n }) => {
      const sec = Number(n), j = S.job;
      const checks = checkList().filter((c) => c.sec === sec).map((c) => ({ ref: c.ref, check: c.text, answer: j.checks[c.key]?.v || "", obs: (j.checks[c.key]?.obs || "").slice(0, 300) }));
      if (!checks.length) throw new Error("No such section in this job.");
      const items = j.locations.flatMap((l) => l.items.filter((it) => itemDsec(it) === sec).map((it) => ({ where: `${l.floor}, ${l.name}`, item: itemSpec(it).label, fields: it.f, note: (it.note || "").slice(0, 300), result: itemResult(it) })));
      return structuredClone({ section: sec, conclusion: j.conclusions?.["c" + sec] || "", checks, items: items.slice(0, 40) });
    } },
  { name: "get_action_plan", description: "Returns the action plan (deficiency, action, priority H/M/L, basis L/G, who, target), the interim measures, the risk rating inputs and justification, and the vulnerable-occupant answers. Use it to check consistency before the report is issued.",
    execute: () => {
      const j = S.job, r = j.risk || {};
      return structuredClone({ actions: j.actions.map((a, i) => ({ no: i + 1, ref: a.ref, deficiency: (a.deficiency || "").slice(0, 300), action: (a.action || "").slice(0, 300), priority: a.priority || "", basis: a.basis || "", who: a.who || "", target: a.target || "" })).slice(0, 40),
        interim: j.interim, rating: { likelihood: r.likelihood, consequence: r.consequence, overall: riskOf(r.likelihood, r.consequence), justification: (r.justification || "").slice(0, 800), seriousInformed: !!r.seriousInformed },
        vulnerable: P().vulnerable.map((g, i) => ({ group: g, answer: j.overview.vulnerable?.["v" + i]?.v || "" })), unansweredChecks: checkList().filter((c) => !j.checks[c.key]?.v).length });
    } }
];

const AI_RULES = `You are the on-site assistant inside Partridge Fire Safety's fire risk assessment app, used by Mikey, a qualified fire risk assessor and serving firefighter in Wales.
Rules:
- Jurisdiction is Wales. The Regulatory Reform (Fire Safety) Order 2005 applies to the common parts of flats and HMOs; the Housing Act 2004 (HHSRS) and the Management of HMOs (Wales) Regulations 2006 apply to HMOs. Do not present England-only rules (Fire Safety (England) Regulations 2022, England's Approved Document B, the Building Safety Regulator) as applying in Wales.
- Methodology is BS 9792:2025. Benchmarks: LACORS Housing - Fire Safety (2008), BS 5839-6:2019+A1:2020, Approved Document B (Wales) with the December 2025 amendments, BS 5266-1:2025, BS 8214, PAS 9980. The Building Safety (Wales) Act 2026 has Royal Assent but most of it is not yet in force.
- Only quote a clause, table or case study number when you are confident it is right; otherwise name the document and say to check it. Say plainly when you are unsure. Never invent figures.
- The assessor makes the judgement. Give guidance and options, not a verdict on the risk rating.
- Be brief and practical: he is on site on a tablet. UK English. Plain text; short paragraphs or a few "- " bullets; no headings, no tables.
- When asked to word an observation or action, write it ready to paste in the report's style: factual, specific, third person, no first person.
- You can look up a full section or the action plan with the tools provided; use them only when the summary below is not enough.
- If a photo is attached, describe only what can actually be seen and say what cannot be judged from a photo (e.g. a door's fire rating without a label or certificate).
The current job details below are context from the app.`;

function aiContext() {
  const j = S.job;
  if (!j) return "No assessment is open.";
  const p = P(), st = j.setup, sc = scope(), b = bench();
  const sub = p.subtype.filter(([, , , show]) => !show || show(st)).map(([k, label]) => `${label}: ${st[k] || "-"}`).join("; ");
  const view = { setup: "Job setup", building: "Building overview", walk: "Walk-through", checks: "Section checks", management: "Management", risk: "Risk rating", actions: "Action plan", report: "Sign-off" }[S.view] || S.view;
  const lines = [
    `Building profile: ${p.title}. Building type: ${st.buildingType || "-"}. ${sub}. BS 9792 assessment type: ${st.bs9792 || "Type 1"}.`,
    `Scope: ${scopeText()}${sc.cat ? ` Height category (provisional): ${sc.cat}.` : ""}`,
    `Construction: ${j.overview?.construction || "-"}; year ${j.overview?.year || "-"}; layout: ${j.overview?.layout || "-"}; basement: ${j.overview?.basement || "-"}.`,
    "Benchmarks shown in the app:", ...b.lines.map(([k, v]) => `- ${k}: ${v}`), ...b.notes.map((n) => `- Note: ${n}`),
    `Assessor is on the ${view} screen${S.view === "checks" ? ` (section ${S.sec})` : ""}${S.view === "walk" && S.loc ? ` at location "${(j.locations.find((l) => l.id === S.loc) || {}).name || ""}"` : ""}.`
  ];
  const f = findings().slice(0, 20);
  if (f.length) lines.push("Deficiencies recorded so far:", ...f.map((x) => `- [${x.ref}] ${x.deficiency}`.slice(0, 300)));
  const r = j.risk || {};
  if (r.likelihood || r.consequence) lines.push(`Risk rating so far: likelihood ${r.likelihood || "-"}, consequence ${r.consequence || "-"}${r.justification ? `; justification: ${r.justification.slice(0, 400)}` : ""}.`);
  if (AI.lastField?.label) lines.push(`Field the assessor last used: "${AI.lastField.label}"${AI.lastField.value ? `, current text: "${AI.lastField.value.slice(0, 400)}"` : ""}.`);
  return lines.join("\n");
}

const AI_PROMPTS = [
  ["Explain the benchmark", "Explain the benchmarks for this building in plain terms and what I should be looking for on site."],
  ["Word my observation", "Help me word the observation for the field I last used, ready to paste into the report."],
  ["Suggest an action", "Suggest an action, priority (H/M/L) and basis (L legal / G good practice) for the last deficiency recorded, with a reason."],
  ["Check my rating", "Check my risk rating and justification against what has been recorded. What would a reviewer challenge?"],
  ["Review before issue", "Review this assessment before I issue it, like a technical reviewer. Look up the action plan and any sections you need. List the gaps, inconsistencies and weak justifications, most serious first, each with what to fix. Keep it short."]
];

function aiPanel() {
  const ph = AI.images ? `<label class="aipic"><input type="file" accept="${esc(AI.images.mediaTypes.join(","))}" capture="environment" data-ai="pic" hidden>Photo</label>` : "";
  return `<div class="aipanel" role="dialog" aria-label="Assistant">
    <div class="aihead"><strong>Assistant</strong><span class="muted small">Uses your Claude account. Check anything you rely on.</span><button class="ghost" data-ai="close" aria-label="Close assistant">Close</button></div>
    <div class="aimsgs" id="aimsgs">${AI.turns.length ? AI.turns.map(aiMsg).join("") : `<p class="muted small">Ask about a benchmark, a defect you've found, or how to word something. It can see this job's setup, benchmarks and findings.</p><div class="aichips">${AI_PROMPTS.map(([l], i) => `<button data-ai="chip" data-i="${i}">${esc(l)}</button>`).join("")}</div>`}</div>
    ${AI.pics.length ? `<p class="small aipics">${AI.pics.length} photo${AI.pics.length > 1 ? "s" : ""} attached <button class="ghost" data-ai="clearpics">Remove</button></p>` : ""}
    <form class="aiform" data-ai-form><textarea id="aiq" rows="2" placeholder="Ask a question" aria-label="Question"></textarea>
      <div class="airow">${ph}${micBtn("aiq")}${AI.busy ? `<button type="button" data-ai="stop">Stop</button>` : `<button class="primary">Ask</button>`}</div></form>
  </div>`;
}
function aiMsg(t, i) {
  if (t.role === "user") return `<div class="aim u">${esc(t.show || t.content)}</div>`;
  return `<div class="aim a"><div class="aitext">${esc(t.content)}</div>${t.done ? `<div class="aiact"><button class="ghost" data-ai="copy" data-i="${i}">Copy</button>${AI.lastField ? `<button class="ghost" data-ai="insert" data-i="${i}">Insert into "${esc(AI.lastField.label.slice(0, 40))}"</button>` : ""}</div>` : ""}</div>`;
}
function aiRender() {
  let host = document.getElementById("ai");
  if (!host) { host = document.createElement("div"); host.id = "ai"; document.body.appendChild(host); }
  host.innerHTML = (AI.open ? aiPanel() : "") + (AI.open || !S.job || S.view === "jobs" ? "" : `<button class="aifab" data-ai="open" aria-label="Open assistant">Ask</button>`);
  const m = document.getElementById("aimsgs"); if (m) m.scrollTop = m.scrollHeight;
}

async function aiAsk(q, show) {
  if (!AI.sample || AI.busy || !q.trim()) return;
  AI.turns.push({ role: "user", content: q.trim(), show });
  const reply = { role: "assistant", content: "Thinking...", done: false };
  AI.turns.push(reply);
  const ctl = new AbortController(); AI.busy = ctl; aiRender();
  const history = AI.turns.slice(0, -1).filter((t) => t.role === "user" || t.done).slice(-10).map((t) => ({ role: t.role, content: t.content }));
  const input = [{ role: "user", content: AI_RULES + "\n\n" + aiContext() }, ...history];
  const pics = AI.pics; AI.pics = [];
  try {
    await AI.sample(input, { ...(AI.tools ? { tools: AI_TOOLS } : { cache: false }), signal: ctl.signal, ...(pics.length ? { images: pics } : {}), onText: ({ text }) => {
      reply.content = text; const el = document.querySelector("#aimsgs .aim.a:last-child .aitext"); if (el) { el.textContent = text; el.parentElement.parentElement.scrollTop = 1e9; } } });
    reply.done = true;
  } catch (e) {
    const msg = { cancelled: "", not_granted: "The assistant was not allowed for this app. You can allow it from the artifact's permissions menu.", sampling_disabled: "The assistant is not available on this account.", rate_limited: "Too many questions for now. Try again in a few minutes.", session_expired: "Sign in to Claude again, then retry.", refused: "That question could not be answered. Try rewording it.", image_rejected: "That photo could not be used. Try a different one.", prompt_too_large: "This job has too much text to send at once. Ask about one item.", tools_unavailable: "Detailed look-ups are not available here; ask again and it will use the summary.", images_unavailable: "Photos cannot be sent from here." }[e?.code];
    reply.content = (e?.code === "refused" ? "" : (e?.text || "")) + (msg === "" ? "" : `\n\n${msg ?? "The assistant could not answer (connection problem). Try again."}`).trim();
    if (!reply.content.trim()) { AI.turns.splice(-2, 2); } else reply.done = true;
    if (e?.code === "tools_unavailable") AI.tools = false;
    if (e?.code === "images_unavailable") AI.images = null;
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e?.code)) { AI.sample = null; AI.open = false; toast(msg || "The assistant is not available here."); }
  } finally { AI.busy = null; aiRender(); }
}

/* Remember the last field the assessor typed in, so an answer can be inserted there. */
document.addEventListener("focusin", (e) => {
  const t = e.target;
  const textish = (x) => x.tagName === "TEXTAREA" || (x.tagName === "INPUT" && /^(text|search|)$/.test(x.type || ""));
  if (!textish(t) || !(t.matches?.("[data-bind]") || t.closest?.("#sheet"))) return;
  const lab = t.closest("label, .fld, .qf, .check")?.querySelector("span, p")?.textContent || t.getAttribute("aria-label") || t.placeholder || "field";
  AI.lastField = { el: t, label: lab.trim().replace(/\s+/g, " "), get value() { return t.value; } };
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-ai]"); if (!b) return;
  const a = b.dataset.ai;
  if (a === "open") { AI.open = true; aiRender(); document.getElementById("aiq")?.focus(); }
  if (a === "close") { AI.open = false; aiRender(); }
  if (a === "stop") AI.busy?.abort();
  if (a === "chip") { const [l, q] = AI_PROMPTS[+b.dataset.i]; aiAsk(q, l); }
  if (a === "clearpics") { AI.pics = []; aiRender(); }
  if (a === "copy") { try { await navigator.clipboard.writeText(AI.turns[+b.dataset.i].content); toast("Copied."); } catch { toast("Could not copy. Select the text instead."); } }
  if (a === "insert") {
    const f = AI.lastField, txt = AI.turns[+b.dataset.i].content;
    if (!f?.el?.isConnected) { toast("That field is no longer on screen. Open it, tap into it, then try again."); return; }
    f.el.value = f.el.value ? f.el.value.replace(/\s*$/, "") + "\n" + txt : txt;
    f.el.dispatchEvent(new Event("input", { bubbles: true })); toast("Inserted. Edit it as needed.");
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset?.ai === "pic" && e.target.files?.length) { AI.pics = [...AI.pics, ...e.target.files].slice(0, AI.images?.maxCount || 1); aiRender(); }
});
document.addEventListener("submit", (e) => {
  if (!e.target.matches("[data-ai-form]")) return;
  e.preventDefault(); const q = document.getElementById("aiq"); let v = q.value; q.value = "";
  if (!v.trim() && AI.pics.length) v = "Describe what this photo shows that matters for the fire risk assessment, what cannot be judged from a photo, and suggest a short caption for the report.";
  aiAsk(v);
}, true);

/* The assistant only appears where the viewer can run it. */
(async () => {
  try {
    if (!window.claude?.use) return;
    const s = await window.claude.use("sample");
    if (!s) return;
    AI.sample = s;
    try { const lim = await s.limits(); AI.images = lim?.images || null; AI.tools = !!lim?.tools; } catch { AI.images = null; AI.tools = false; }
    aiRender();
    const r = render; render = function () { r(); aiRender(); };
  } catch { /* not available: no assistant */ }
})();
