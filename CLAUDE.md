# Partridge FRA app: handover for Claude Code

Read this first. It is the full context from the claude.ai project "Fire risk assessment work", where the app was built (Oct to Nov 2026, up to v2.6.2).

## Who and what

- **User:** Mikey Partridge, a whole-time firefighter (South Wales Fire and Rescue Service, Cardiff). He holds a Level 4 Diploma in Fire Safety and is building **Partridge Fire Safety**, a fire risk assessment consultancy in Cardiff and South Wales.
- **He is not a developer.** Explain things in plain UK English. Don't make him run commands if you can do it. Show results as phone screenshots.
- **App:** an offline, phone- and tablet-first web app (PWA) for doing a fire risk assessment on site and producing the PDF report.
- **Law and standards:** Wales; Regulatory Reform (Fire Safety) Order 2005; Housing Act 2004 (HMOs); BS 9792:2025 (housing FRA code of practice, Type 1 to 4 assessments); BS 5839-6 (detection); BS 5266-1 (emergency lighting); the LACORS guide; Approved Document B.

### Working preferences (stated by Mikey)

- **Verify before stating.** Don't present a regulatory fact, figure or wording as certain unless it has been checked. Flag anything unchecked.
- **Keep usage lean.** He has a weekly limit and other work. Make focused changes, avoid big rewrites and re-reading huge files, and test only what changed.
- **House style:** the report follows the layout, colours and section order of his **4 Cottrell Road report (PFS001)**.
  - Risk: the BS 9792:2025 3×3 matrix.
  - Action priorities: **H** = immediate or within 1 month, **M** = within 3 months, **L** = within 12 months.
  - Basis: **L** = legal requirement, **G** = good practice.
- **Look and feel:** "cool, modern, clean and easy", like a smooth modern app, **not** "editing a Word doc". Light theme by default (used outdoors). Few taps and little typing.
- **Number of flats varies:** conversion jobs can have 2 to 8 flats in one house, so never assume two.

## Stack and layout

No framework and no npm. Plain JavaScript and HTML, assembled by a Python build script.

```
build.py                 assembles src/ into dist/  (VERSION constant; bump on every release)
src/index.html           all CSS (older styles first, then "MODERN SKIN (v3)" block with the design tokens, later additions, and the "DESIGN SYSTEM (v2.8)" block last) and placeholders
vendor/fonts/            Inter variable font, latin subset (SIL OFL 1.1); build.py inlines it in preview.html and copies it to dist/pwa (cached by the service worker)
DESIGN-BRIEF.md          Mikey's UI redesign brief and agreed amendments (staged: 1 tokens/font/cards, 2 dashboard/stepper, 3 walk-through)
src/profile_hmo.js       PROFILE_HMO: HMO checks, quick-add item types, suggested action wording, documents
src/profile_flats.js     PROFILE_FLATS: purpose-built flats (common parts)
src/profile_smallconv.js PROFILE_SMALLCONV: house converted into flats (mirrors his v3 Two/Three/Four-Flat templates)
src/app.js               state, IndexedDB storage, all screens, event handlers, readiness checks, swipe
src/library.js           "My findings": common deficiency library + user-saved entries (IndexedDB store "lib")
src/ai.js                on-site assistant; only works inside claude.ai (artifact `sample` capability)
src/pdf.js               jsPDF report builder (Cottrell Road style)
vendor/jspdf.umd.min.js  jsPDF 2.5.1, bundled for offline use
test_*.py                Playwright tests (Python)
templates/               ReportLab and PyMuPDF scripts for his fillable PDF templates (separate from the app)
```

`python3 build.py` produces two outputs:

- `dist/pwa/`: the installable app (index.html, sw.js, manifest, icons, jsPDF). **This is what gets hosted.**
- `dist/preview.html`: a single-file build, previously published as a claude.ai artifact preview. It is no longer needed once the app is hosted.

## Run and test

```
pip install playwright pillow && python -m playwright install chromium
python3 build.py
python3 test_app.py out/        # main flow, tablet + phone
python3 test_scope.py out/      # BS 9792 Types 1 to 4
python3 test_types.py out/      # building types / profile switching
python3 test_height.py out/
python3 test_report.py out/     # PDF build
python3 test_ai.py out/
python3 test_lib.py out/        # My findings + PDF size with 20 photos
python3 test_swipe.py out/      # swipe to answer
python3 test_store.py           # storage fallback when IndexedDB or localStorage is refused
```

- Each test starts its own local server on `dist/pwa`, and the argument is a screenshot output folder.
- Pass condition: the test ends with `errors: none`. `ERR_TUNNEL_CONNECTION_FAILED` console lines come from sandbox network blocks and are harmless.
- Before every release: run all the tests and take phone screenshots at 390×844 to check by eye.

## Architecture notes (the parts that bite)

- **Job model:** `S.job` holds:
  - `setup`, `overview`, `sf` (section fields)
  - `checks` (`{ "5.1": { v: "Yes"|"No"|"NA", obs, photos, act, pri, basis } }`)
  - `locations[].items[]` (walk-through quick-add items)
  - `actions[]`, `interim[]`, `risk`, `conclusions`, `docs`
- **Check keys contain a dot** (`"5.1"`). Use `splitPath`, `getPath` and `setPath`, which treat `checks.5.1.obs` correctly. A naive split on dots previously lost notes and turned No into Yes; `normalise()` repairs old jobs.
- **Profiles:**
  - `PROFILES.hmo`, `PROFILES.flats` and `PROFILES.smallconv`. Everything that varies by building type lives in the profile; `app.js` reads it.
  - Internal section keys (`${s.n}.${k}`) are stable. **Displayed** section numbers come from `dsecs()`, `checkDsec()` and `itemDsec()` (Cottrell order).
  - smallconv adds `testSchedule` (report section 13), `sectionFields` and per-flat Responsible Person blocks (`rpPerUnit`, `rpNames()`, `rpSame()`).
- **PDF numbering:** the risk, photos and declaration sections are numbered dynamically: `RN` is the highest display section + 1. Photos are shrunk before they go into the PDF (`shrinkFor`); in testing, 20 photos at 1600 px gave a 1.5 MB PDF.
- **Storage:**
  - IndexedDB `pfs-fra` v2, with stores `jobs`, `photos` and `lib`.
  - On open, the app does a test write. If writes are refused (as in the claude.ai iPhone preview), it falls back to localStorage; if that is refused too, it keeps everything in memory and shows one warning banner on Home (`S.storeWarn`).
  - The app calls `navigator.storage.persist()` on boot.
- **UI (v2.7 usability pass):**
  - One linear flow of eight steps, defined once in `STEPS` (`app.js`): Details, Building, Walk-through, Section checks, Management, Risk rating, Action plan, Report. The side rail (tablet), the phone step bar (`.stepbar`: Overview, back, current step, Next), the Overview checklist and each screen's heading (`head()`) all read it, so numbering is the same everywhere. The old phone tab bar is gone.
  - `progress()` gives each step `pct`, `done` and a plain-words `line`; the Overview and the job list cards show it. `readiness()` holds the pre-issue checks (used by the Report step and progress).
  - Rarely needed detail sits in collapsible cards (`grp()`); open/closed state survives re-renders via `S.open` (and `S.openAct` for action cards), set by a capture-phase `toggle` listener.
  - Guided one-at-a-time checks (`guidedBlock`): swipe right = Yes and move on, swipe left = No and open the note. Swipe code sits just before `IN_PREVIEW` in `app.js`.
  - Short option lists render as chips (`seg(..., "chips")`). The tests use a `pick()` helper for this. Test photos `out/p0-2.jpg` are generated, not committed.
- **Readiness checklist** (`viewReport`): a list of warnings, each of which jumps to the step concerned.
- **Toast:** hidden with opacity and visibility (a v2.6.2 fix; sliding it alone left it stuck over the tab bar). Anything new that is fixed or positioned near the bottom must not cover the tab bar, and a `will-change` on cards has done this before.
- **Service worker** cache name is `pfs-fra-<VERSION>`. Bump the version so phones pick up updates; an installed app needs opening twice to update.

## Immediate next steps

1. `git init`, commit, and push to a private GitHub repo (for example `partridge-fra-app`). Ignore `dist/`, `__pycache__/` and the test output folders.
2. Host `dist/pwa`. Recommended: a GitHub Actions workflow that runs `python3 build.py` and deploys `dist/pwa` to GitHub Pages. Another option is Netlify.
   - Note: a free GitHub plan only allows Pages from a private repo on paid plans. Check this, and either make the repo public (the code holds no client data) or use Netlify or Cloudflare Pages.
   - Then help Mikey install it from Safari: Share → Add to Home Screen.
3. Once hosted, real jobs should be done in the installed app, not the claude.ai preview, which has limited storage. Remind him to export a backup after each job.

## Backlog (agreed or suggested, not yet built)

**Accuracy (do first):**
- A contradiction check, e.g. a walk-through detector item against the interlinking check.
- A stronger warning when a section is concluded Satisfactory with failed items. There is a basic warning in readiness already.

**Speed:**
- Undo button after a swipe. Mikey asked how to go back; for now, Back is a tap.
- Smooth screen transitions that keep the scroll position.
- Re-assessment that starts from last year's job: previous answers shown, one tap for "no change".
- One big camera button: take photos now, sort them into locations later.

**Visual:**
- Grouped cards on the Setup and Building screens, with "More details" collapsed and an "x of 5 key details" indicator.
- Collapsible action cards.
- PDF cover preview and a sticky "Create PDF" button.
- Job list cards with a risk-colour edge and a progress ring.

**Bigger features:**
- Floor-plan pins (photo or sketch of the plan, with numbered findings that appear in the report).
- Photo markup (arrows and circles).

**Library:** the 29 built-in "My findings" entries need Mikey to review the wording. The "EICR at least every 5 years for rented homes in Wales" entry has not been verified.

## Research notes (28 Oct 2026)

- **Competitors:** AssessHub (floor-plan pins, AI drafting; a reviewer reports saving "2 hours a day" on writing), FireCheckr (AI drafts from notes; claims 50% less writing time), SafetyCulture, GoAudits, Mobiess, ClickFRA, and a BS 9792 iPad app.
- **Snagging apps:** Fieldwire and PlanRadar (plan pins, defect templates, photo markup).
- **Performance:** measured at 4× CPU throttling, the app loads in under 1 s and each screen renders in under 20 ms. Performance is not the bottleneck; taps and typing are.

## templates/ (fillable PDF templates, not part of the app)

- `build_hmo_template.py` builds the HMO fillable PDF (ReportLab). It uses `fit_text()` to shrink text to fit cells; always measure string width before placing text.
- `build_two_flat_sections.py` regenerates sections of the Two-Flat conversion template and splices them into the original PDF with PyMuPDF. Usage: `python3 build_two_flat_sections.py <original.pdf> <out.pdf>`.
  - Use separate document handles: PyMuPDF only copies a source's form fields once.
  - Signature widgets come across twice, renamed `name [xref]`; delete the duplicates.
  - Footers are renumbered with redactions.
- **Current templates (Mikey's PC):** `G:\My Drive\Fire Risk Assessment\1 - Templates\`, containing the Two-, Three- and Four-Flat Common Parts FRA Template v3. **Two-Flat v3 is the reference** for the app's smallconv profile.
