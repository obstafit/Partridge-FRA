/* Template profile: two-flat house conversion, common parts (Partridge short-form template v2).
   Checks, numbering and extra fields follow the Two-Flat Common Parts FRA template v2 line for line:
   3 hazards, 4 people, 5 separation, 6 fire doors, 7 escape, 8 emergency lighting, 9 detection.
   Internal section numbers follow the shared app layout (6 = separation + doors, 5 = escape, 7 = detection). */
"use strict";

const PROFILE_SMALLCONV = (() => {
  const CONV = { "Meets 1991 Building Regulations or later": "Converted house - meets 1991 Building Regulations or later", "Below 1991 standard": "Converted house - below 1991 standard" };
  return {
    id: "smallconv-pfs-v2",
    name: "House conversion",
    title: "House Converted into Flats",
    standard: "BS 9792:2025",
    legislation: "Regulatory Reform (Fire Safety) Order 2005",
    detectionStd: "BS 5839-6:2019+A1:2020",
    unit: { one: "flat", many: "flats", Cap: "Flat" },
    licensing: false,
    types: ["Type 1", "Type 2"],
    typesNote: "Types 3 and 4 include the dwellings and are outside the scope of this template.",
    /* One Responsible Person block and acknowledgement per flat. */
    rpPerUnit: (st) => Array.from({ length: Math.min(8, Math.max(2, parseInt(st.flats, 10) || 2)) }, (_, i) => `Flat ${i + 1}`),
    subtype: [
      ["convType", "Conversion standard", ["Meets 1991 Building Regulations or later", "Below 1991 standard"]],
      ["flats", "Number of flats", ["2", "3", "4", "5", "6", "7", "8"]],
      ["storeys", "Storeys (count the ground floor, not a basement)", "num"],
      ["topHeight", "Top floor height above ground (m)", "num"],
      ["convYear", "Year of conversion to flats", "num"],
      ["strategy", "Evacuation strategy", ["Simultaneous", "Stay put", "Temporary simultaneous"]],
      ["smallStair", "Small single-stair building with no lobby protection (ADB Diagram 9)", ["No", "Yes"]],
      ["sprinklered", "Sprinklers (Regulation 37A)", ["No", "Yes - in the flats", "Yes - throughout", "Not known"]],
      ["nonres", "Shop or other non-residential use in the building", ["No", "Yes"]]
    ],
    subtypeLabel: "Conversion", subtypeKey: "convType",
    dTitles: { 5: "Structural separation between the flats", 6: "Fire doors onto the common parts" },
    needsUnitDetection: () => true,
    priorities: PROFILE_HMO.priorities,
    vulnerable: PROFILE_HMO.vulnerable,
    documents: [
      "Rent Smart Wales registration / licence (landlord or agent)", "Building control completion certificate for the conversion",
      "EICR - common parts and intake supplies", "Electrical installation certificate(s) for the conversion works",
      "Gas safety record (if gas serves the common area)", "Fire alarm installation certificate (BS 5839-6)",
      "Emergency lighting certificate (BS 5266-1)", "Fire door certification", "Fire suppression system certificate (if installed)",
      "Previous fire risk assessment and action plan"
    ],
    roomChecks: [],
    /* Section 13 of the v3 template: recommended testing and maintenance schedule for the Responsible Person.
       [system, standard, routine, applies(job)] - "Applies" is ticked from what was recorded on the job. */
    testSchedule: [
      ["Fire alarm - Grade A", "BS 5839-6 (Table 3)", "Weekly test; service every 6 months by a competent person.", (j) => /grade\s*a\b/i.test(j.sf?.s9_grade || "")],
      ["Smoke and heat alarms - Grades C, D and F", "BS 5839-6 (Table 3, cl. 25.2)", "Test monthly with the test button on every alarm; on interlinked alarms check that all alarms sound. Replace internal batteries or alarms as the manufacturer advises, or on a low-battery warning.", (j) => !/grade\s*a\b/i.test(j.sf?.s9_grade || "") || /[cdf]\s*\d/i.test(j.sf?.s9_grade || "")],
      ["Emergency lighting", "BS 5266-8 (BS EN 50172)", "Monthly short function test; annual full-duration test. Keep a log of tests and defects.", (j) => !!(j.sf?.s8_type || "").trim() || j.locations.some((l) => l.items.some((it) => it.k === "el"))],
      ["Fire doors", "BS 8214 (installation and maintenance); BS 9792 example regime", "Check self-closers, seals, hinges and gaps monthly and that doors are never wedged open; full inspection of each door and its hardware every 6 months.", () => true],
      ["Automatic fire suppression (sprinklers), if installed", "BS 9251", "As set out in the installer's maintenance certificate; keep the servicing records.", (j) => /^yes/i.test(j.setup?.sprinklered || "")],
      ["Fixed electrical installation (EICR)", "BS 7671", "At the interval stated on the report (normally every 5 years for rented homes) and after any significant alteration.", () => true],
      ["Gas safety record, if gas serves the building", "Gas Safety (Installation and Use) Regulations 1998", "Annually.", (j) => j.docs?.d4?.s && j.docs.d4.s !== "N/A"]
    ],
    suggest: PROFILE_FLATS.suggest,
    quickAdds: PROFILE_FLATS.quickAdds,

    /* Extra fields shown on the Section checks screen and printed under each section's checks (job.sf). */
    sectionFields: {
      3: [["s3_comments", "Further comments on common-area hazards", "area"]],
      5: [["s5_guidance", "Guidance applied", ["BS 9999", "Approved Document B Volume 1 (Wales)", "Other"]], ["s5_edition", "Edition / amendments"],
        ["s5_period_req", "Fire resistance period required (minutes) and source"], ["s5_period_obs", "Period evidenced or observed"],
        ["s5_type2", "Reason to suspect deficiencies in the separating construction", ["No", "Yes - recommend a Type 2 FRA or specialist survey"]],
        ["s5_37a_evidence", "Regulation 37A: evidence sighted / suppression determination, or action needed", "area"]],
      7: [["s7_evac_notes", "Evacuation strategy: notes"], ["s7_exit_width", "Final exit clear width (mm)"], ["s7_exit_type", "Final exit door and lock type"],
        ["s7_exit_desc", "Description of external route to place of safety", "area"]],
      8: [["s8_type", "Type provided (maintained / non-maintained, self-contained)"], ["s8_lux", "Lux reading (if measured)"], ["s8_night", "Night-time conditions: assessor note", "area"]],
      9: [["s9_grade", "Grade and category (BS 5839-6, e.g. D1 / LD2)"], ["s9_edition", "Edition applied"], ["s9_how", "How interlinking was confirmed"]]
    },

    sections: [
      { n: 3, title: "Fire hazards - common area", groups: [
        ["Storage in the common parts", [
          "Common parts are kept free of stored combustible items (boxes, furniture, clothing, bedding and similar).",
          "Cycles, prams, mobility scooters and similar items are not stored in the escape route.",
          "E-bikes, e-scooters and lithium-ion batteries are not stored or charged in the common parts.",
          "Waste, recycling and refuse are not kept in the common parts (or are in a suitable external or enclosed store).",
          "Cupboards opening onto the common parts (including under the stairs) are not used to store combustibles, or are fire-resisting and kept closed."]],
        ["Meters and electrical intake equipment in the common area", [
          "Gas and electricity meters, consumer units and intake equipment in the common parts are enclosed with a close-fitting door or cover.",
          "Where meters or intake equipment are in, or open onto, the escape route, the enclosure is fire-resisting (typically 30 minutes) and kept closed.",
          "Meters and intake equipment show no visible damage, scorching or overheating, exposed conductors or unprotected cabling.",
          "Nothing is stored in, on top of, or against meter cupboards and intake equipment.",
          "Gas and electricity isolation points are accessible and clearly identified."]],
        ["Arson and smoking", [
          "The entrance door is kept secure, and the letter box (if fitted) does not create an arson risk to the hall (for example an anti-arson letter box or internal cage where the risk is higher).",
          "Bins, recycling and other combustibles outside are kept away from the building, its doors and windows.",
          "There is no evidence of smoking in the common parts."]]
      ]},
      { n: 6, title: "Structural separation between the flats", groups: [
        ["Conversion records and evidence of integrity", [
          "Building Regulations approval and completion records for the conversion, including the fire separation design, have been sighted.",
          "Evidence of the integrity of the separating construction is available (design or building control records, previous survey, fire-stopping certificates, or visual inspection)."]],
        ["Separating construction - visual, non-intrusive", [
          "The separating floor(s) between the flats show no visible gaps, damage or openings where it meets walls (as seen from the common parts).",
          "Ceilings and soffits in the common parts, including the underside of the stairs, are continuous and undamaged.",
          "Walls and partitions between the common parts and each flat are intact, run to floor and ceiling, and show no unsealed gaps.",
          "Service penetrations (pipes, cables, ducts) through the separating construction are visibly fire-stopped.",
          "There are no recessed downlights, loft hatches or other openings in the common-part ceilings that compromise fire separation (unless fire-resisting).",
          "Where there is a pitched roof, the roof void above the common parts has been inspected (or the reason for non-access is recorded).",
          "Any glazing or vision panels in separating construction are fire-resisting.",
          "No alterations since the conversion that could affect fire separation are apparent."]],
        ["Regulation 37A - automatic fire suppression (evidence only)", [
          "The conversion to flats is confirmed as a material change of use (from the Responsible Person or building control records).",
          "Evidence has been sighted that automatic fire suppression was provided (BS 9251 or BS 8458 certificate), or that Regulation 37A was considered and not required (building control confirmation).",
          "Where a suppression system is installed, maintenance and servicing records have been sighted."]],
        ["Fire doors onto the common parts", [
          "Fire door certification (third-party label, plug or documentary evidence) has been sighted for each flat entrance door.",
          "No fire door is wedged open, or has its self-closing device removed or disabled.",
          "Fire door signage (Fire door keep shut / Keep locked) is displayed on cupboards and enclosures where appropriate.",
          "Letter plates in the flat entrance doors (if fitted) are fire-rated and close fully, so they do not reduce the door's fire resistance.",
          "The Responsible Person has a routine of fire door and common-area checks, and the checks are recorded."]],
        ["Intrusive sampling (Type 2)", [
          "Sample openings were made by a contractor; each location and finding is recorded.",
          "Fire stopping and cavity barriers are adequate at the locations opened.",
          "Separating walls and floors achieve the expected fire resistance at the locations opened.",
          "Openings were made good to restore fire resistance after inspection."], "intrusive"]
      ]},
      { n: 5, title: "Means of escape through the shared area", groups: [
        ["Common escape route", [
          "The common escape route is clear of obstructions and storage along its full length.",
          "Stairs, landings, handrails and floor coverings are in sound condition, with no trip hazards.",
          "Escape from each flat leads to the final exit without passing through the other flat or through a room.",
          "Flat entrance doors can be opened from the inside without a key (for example a thumb-turn).",
          "Wall and ceiling linings in the common parts show no obvious rapid flame-spread risk (for example polystyrene tiles or exposed foam)."]],
        ["Final exit", [
          "The final exit door opens easily in the direction of escape.",
          "The final exit can be opened from the inside without a key, using a single fastening (for example a thumb-turn).",
          "The final exit leads directly to a place of safety (street or open space), not into an enclosed or locked area.",
          "The threshold, any step and the external route from the final exit are safe and unobstructed (bins, cycles, vehicles).",
          "Security fittings (entry system, additional bolts, chains) do not hinder escape."]],
        ["Fire safety information", [
          "A fire action notice or written fire safety information tells the occupants what to do in a fire, consistent with the evacuation strategy."]]
      ]},
      { n: 8, title: "Emergency lighting", groups: [
        [null, [
          "Borrowed natural light is sufficient to see the whole common escape route (stairs, landings and final exit) in daylight.",
          "Where borrowed natural light is not sufficient, emergency lighting is provided on the common escape route.",
          "Luminaires are sited at stairs and changes of level, changes of direction, landings and the final exit.",
          "The lighting appears to give at least the BS 5266-1 minimum illumination along the centre line of the route (1 lux).",
          "Luminaires are in good condition and charge indicators show normal operation.",
          "A commissioning or installation certificate and testing records (BS 5266-1) have been sighted."]]
      ]},
      { n: 7, title: "Fire detection and alarm", groups: [
        [null, [
          "Fire detection is provided in the common parts (hall, stairs and landings).",
          "Detection is interlinked between all the flats and the common parts, so that activation in any one area sounds the alarm in all.",
          "Interlinking has been confirmed by a witnessed test, installer certificate or the Responsible Person's statement.",
          "Alarms are audible throughout the common parts and in every flat (as confirmed by the Responsible Person or occupants).",
          "Detectors are mains-powered with a standby supply, as appropriate to the grade of system.",
          "Detectors are in date, undamaged, unobstructed and not disabled or covered.",
          "An installation or commissioning certificate (BS 5839-6) has been sighted.",
          "Arrangements for regular testing and servicing are in place and known to the occupants."]]
      ]}
    ],

    benchmark(s) {
      const b = PROFILE_FLATS.benchmark(Object.assign({}, s, { flatsType: CONV[s.convType] || "", flats: s.flats || "2" }));
      if (!s.convType) b.lines = [["Benchmarks", "Choose the conversion standard on the Setup screen."]];
      b.lines.push(["Separation", "Compartmentation between the flats is assessed against BS 9999 or Approved Document B Volume 1 (Wales), as applicable to the conversion. Regulation 37A (Wales) may require automatic fire suppression for the change of use: confirm with building control."]);
      return b;
    }
  };
})();

PROFILES.smallconv = PROFILE_SMALLCONV;
