# Partridge Fire Safety – App UI redesign

_Copied from Google Drive (Fire Risk Assessment/DESIGN-BRIEF.md, 1 Nov 2026). The amendments at the end win where they conflict._

## Objective

I want to redesign the existing Fire Risk Assessment application to give it a more premium, professional and modern appearance.

This is a visual and user-experience improvement to the existing application.

IMPORTANT: Do not rebuild the application or remove any existing functionality.

Preserve all existing assessment workflows, data structures, database connections, calculations, forms, photographs, exports and existing functionality.

Before making changes, inspect the existing codebase and understand its structure, components and styling system.

Implement the redesign within the existing architecture.

## 1. New visual identity

Develop a consistent visual identity for Partridge Fire Safety.

The application should look like a premium commercial software product designed specifically for professional fire risk assessors.

### Colour palette

- Primary charcoal: #20292D
- Secondary charcoal: #303A3E
- Primary orange: #EF650B
- Light background: #F3F4F2
- White: #FFFFFF
- Primary text: #202426
- Secondary text: #737D7A
- Success green: #21965E
- Warning amber: #E9A126
- Failure red: #D94335

Orange should be used selectively for primary actions, active navigation and important highlights. Avoid excessive orange backgrounds. Use green, amber and red consistently to communicate assessment status.

### Typography

Use a clean modern sans-serif font. Suggested font: Inter. Use consistent font weights, sizes and spacing throughout the application. Headings should be strong and clear without taking up unnecessary space.

### General appearance

- Rounded cards with consistent corner radiuses.
- Subtle shadows rather than heavy borders.
- Consistent internal padding.
- Clean spacing between sections.
- Modern icons.
- Consistent button styling.
- Clear visual hierarchy.
- Professional appearance on mobile, tablet and desktop.

Avoid excessive decorative elements.

## 2. Dashboard and assessment navigation

Redesign the dashboard to make it more visually appealing and easier to navigate. Include:

- A professional Partridge Fire Safety header and branding.
- Clear New Assessment button.
- Active assessments.
- Completed assessments.
- Assessments requiring attention.
- Assessment progress indicators.
- Property address and building type.
- Clear Continue Assessment button.
- Recent assessments.

Assessment cards should clearly display: property address, property type, date of assessment, completion percentage, current assessment stage, assessment status.

Use a compact layout that prioritises useful information.

## 3. Assessment navigation

Redesign the navigation throughout the eight assessment stages: 1 Details, 2 Building, 3 Walk-through, 4 Section checks, 5 Management, 6 Risk rating, 7 Action plan, 8 Report.

Introduce a consistent progress indicator showing all eight stages. Each stage should visually indicate: completed, current stage, not started, requires attention.

The current stage should be highlighted using the primary orange. Completed stages should use green. Outstanding stages should use neutral grey.

Make navigation compact, particularly on mobile devices. Reduce unnecessary space occupied by the existing bottom navigation.

The assessor should always understand where they are within the assessment and how much remains.

## 4. Walk-through interface

Give particular attention to redesigning the walk-through screen. This needs to be extremely practical because assessors will use it while physically inspecting buildings.

Introduce a clean location-based inspection interface. Features to retain and improve: floor selection, location selection, adding inspection items, fire door checks, fire alarm checks, emergency lighting, escape routes, final exits, fire hazards, combustible materials, additional inspection categories, photographic evidence, voice dictation, adding deficiencies.

Use clear visual status indicators: green pass, red fail, amber requires review, grey not assessed.

Make inspection categories into consistent, easy-to-use cards. Allow the assessor to see photographs associated with the relevant location. Make adding a new finding particularly prominent. The assessor must be able to navigate between floors and locations without losing entered information. Ensure the interface is practical for one-handed mobile use.

## 5. Responsive design

The application must work well across iPhone, Android, tablets and desktop computers. Prioritise mobile usability because the application will primarily be used during physical property inspections. Ensure buttons are sufficiently large for touch interaction. Avoid unnecessary scrolling and excessive screen clutter.

## 6. Implementation requirements

Before modifying the code: inspect the existing application; identify the current styling framework and component structure; identify the dashboard, navigation and walk-through components; identify any shared components that can be redesigned centrally. Implement the new design consistently rather than creating separate styling for every page.

Do not: remove existing functionality; change assessment calculations; change risk-rating logic; remove existing fields; alter database structures unnecessarily; break existing PDF generation; remove photographic evidence; change existing assessment data; introduce dummy data into the real application.

Keep all existing functionality working.

## 7. Development approach

Work in stages. Stage 1: redesign the visual identity and shared styling. Stage 2: redesign the dashboard and assessment navigation. Stage 3: redesign the walk-through interface.

After each stage: check the application still runs; check existing functionality remains intact; check mobile responsiveness; resolve any visual inconsistencies; report which files have been changed.

Do not undertake a complete rebuild. The finished application should feel like a premium professional fire safety assessment product, with a simple, modern interface that makes completing an FRA quicker and easier.

---

## Amendments (agreed with Claude, 1 Nov 2026). Where these conflict with the brief above, these win.

Read CLAUDE.md first. Mockups: ChatGPT's 9-screen concept (main reference), Real.Inspect and Opendoor Key Agent (photo capture only).

### A. Things the mockups got wrong. Do not copy these.

1. **Risk rating.** The mockup's "Low Risk / Slight harm unlikely" is not Mikey's method. Keep the BS 9792:2025 3x3 matrix and its outcomes exactly as they are now: Trivial, Tolerable, Moderate, Substantial, Intolerable, from likelihood x consequence, with the justification field and the existing override warnings. Restyle it only.
2. **Section checks.** The mockup's "3.1 Fire hazards and control? Are fire hazards identified and adequately controlled?" is a made-up summary question. Keep the real check wording and numbering from the profiles. Keep swipe-to-answer, My findings, quick phrases and dictation on the one-at-a-time card.
3. **Logo.** The bird logo in the mockup is AI-generated. Use Mikey's real Partridge Fire Safety logo; ask him for the file. Do not invent one.
4. **Drop-downs.** The mockup's Details screen uses drop-downs. The app deliberately changed short option lists to tap chips because they are faster. Keep the chips.
5. **Dashboard numbers.** Counts such as "12 Active / 8 Ready to review" must come from real jobs. No sample numbers or photos in the real app. The example job may stay as it is now.

### B. Things to adopt.

1. **Palette:** as listed in the brief. It is close to the current one, so switch the tokens in the "MODERN SKIN (v3)" block of src/index.html in one place.
2. **Font:** Inter is fine, but the app must work offline. Bundle the Inter woff2 files in the app and add them to the service worker cache. Do not load them from Google Fonts. The system font is an acceptable fallback.
3. **Stage progress:** a compact 8-stage stepper along the top of each job (green done, orange current, grey not started, amber needs attention). Keep the bottom tab bar but make it slimmer. The stepper and the tab bar must not both take up a lot of space on a phone.
4. **Walk-through:** floor pills, a location photo header with a photo count, and inspection categories as cards with Pass/Fail/Review/Not assessed status. "Add finding" should be a prominent full-width button. This matches the backlog items "one big camera button" and photos per location. The Opendoor camera-first flow ("take several photos, review grid, then answer") is a good model.
5. **Action plan:** High/Medium/Low count tiles at the top, and collapsible action cards with priority pills. This is already on the backlog.
6. **Report screen:** a cover preview with the property photo and a checklist of what is included, then Export PDF. Keep the current readiness checklist above it.
7. **Dashboard:** Continue Assessment card, active, needs-attention and completed groups, and job cards showing address, type, date, % complete, current stage and status.

### C. Do not.

- Use a dark theme by default. Real.Inspect's black and orange look is hard to read outdoors; the light theme is the default, and dark stays optional.
- Change the PDF report styling. It follows the Cottrell Road (PFS001) house style and is separate from the app's look.
- Break anything covered by the test_*.py tests. Run them all after each stage and take phone screenshots at 390x844.

### D. Order of work. Keep to Mikey's limited weekly usage.

Stage 1 (tokens, font, cards and buttons), then Stage 2 (dashboard and stepper), then Stage 3 (walk-through). After each stage, show Mikey phone screenshots and get his OK before going on.
