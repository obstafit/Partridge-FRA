/* Template profile: blocks of flats and house conversions (common parts), BS 9792:2025 (Wales).
   Shares the quick-add field specs with the HMO profile and adds flat-specific items. */
"use strict";

const PROFILE_FLATS = (() => {
  const base = PROFILE_HMO.quickAdds.filter((q) => !["unit", "sample"].includes(q.k)).map((q) => JSON.parse(JSON.stringify(q)));
  const door = base.find((q) => q.k === "door");
  door.fields.find((f) => f[0] === "type")[3] = ["Flat entrance", "Stair enclosure", "Lobby / corridor", "Riser / cupboard", "Bin / plant room", "Final exit", "Other"];
  const quickAdds = [
    { k: "flatdoor", label: "Flat entrance door", sec: 6, front: true, fields: [
      ["ref", "Flat number", "text"],
      ["orig", "Door", "sel", ["Original", "Replaced - certified", "Replaced - not evidenced"], ["Replaced - not evidenced"]],
      ["rating", "Rating evidenced", "sel", ["FD30S", "FD30", "Notional / older fire door", "Not evidenced", "Not a fire door"], ["Not evidenced", "Not a fire door"]],
      ["closer", "Self-closing (BS EN 1154) and closes fully", "yn"],
      ["hinges", "Three hinges, sound and secure", "yn"],
      ["gaps", "Gaps within tolerance (typically 2-4 mm; threshold per data sheet)", "yn"],
      ["seals", "Intumescent strips and smoke seals intact", "yn"],
      ["letter", "Letter plate", "sel", ["None", "Fire-rated flap", "Not fire-rated"], ["Not fire-rated"]],
      ["damage", "Free of damage and alterations", "yn"],
      ["key", "Opens from inside without a key", "yn"]
    ]},
    ...base.map((q) => q.k === "door" ? door : q),
    { k: "unit", label: "Flat inspection", sec: 7, front: true, when: "rooms", fields: [
      ["ref", "Flat", "text"],
      ["det", "Detection in the flat", "sel", ["Smoke and heat (LD2)", "Smoke in hall only (LD3)", "None"], ["None"]],
      ["test", "Tested", "sel", ["Sounded", "Failed", "Not tested"], ["Failed"]],
      ["hall", "Protected entrance hall or alternative exit", "yn"],
      ["inner", "No inner rooms used for sleeping without an alternative exit", "yn"],
      ["door", "Entrance door self-closes and latches (inside face)", "yn"],
      ["alter", "No alterations breaching the separation from the common parts", "yn"],
      ["hoard", "Hoarding or excessive fire load evident", "yes"],
      ["charge", "E-bike or e-scooter charging evident", "yes"]
    ]},
    { k: "sample", label: "Intrusive sample", sec: 6, front: true, when: "intrusive", fields: PROFILE_HMO.quickAdds.find((q) => q.k === "sample").fields },
    { k: "riser", label: "Service riser", sec: 6, fields: [
      ["loc", "Riser / floor", "text"],
      ["door", "Riser door fire-resisting and locked", "yn"],
      ["stop", "Fire stopping at floor levels intact", "yn"],
      ["store", "No storage in the riser", "yn"]
    ]},
    { k: "eas", label: "Evacuation alert system", sec: 9, nonHousing: false, fields: [
      ["panel", "Control panel at fire service entry level, normal", "yn"],
      ["comm", "Commissioning records sighted (BS 8629)", "yn"],
      ["test", "Testing and maintenance records sighted", "yn"]
    ]}
  ];
  quickAdds.forEach((q) => { if (["supp", "smoke", "ffac"].includes(q.k)) q.front = false; });

  return {
    id: "flats-bs9792-2025",
    name: "Flats",
    title: "Block of Flats - Common Parts",
    standard: "BS 9792:2025",
    legislation: "Regulatory Reform (Fire Safety) Order 2005 | Fire Safety Act 2021",
    detectionStd: "BS 5839-6:2019+A1:2020",
    unit: { one: "flat", many: "flats", Cap: "Flat" },
    licensing: false,
    subtype: [
      ["flatsType", "Building", ["Purpose-built block", "Converted house - meets 1991 Building Regulations or later", "Converted house - below 1991 standard", "Sheltered housing"]],
      ["storeys", "Storeys (count the ground floor, not a basement)", "num"],
      ["flats", "Number of flats", "num"],
      ["topHeight", "Top floor height above ground (m)", "num"],
      ["sprinklered", "Sprinklers throughout", ["No", "Yes", "Not known"]],
      ["nonres", "Shop or other non-residential use in the building", ["No", "Yes"]],
      ["maisonettes", "Any maisonettes (flats on two levels)", ["No", "Yes"]],
      ["strategy", "Evacuation strategy", ["Stay put", "Simultaneous", "Temporary simultaneous"]],
      ["smallStair", "Small single-stair building with no lobby protection (ADB Diagram 9)", ["No", "Yes"]]
    ],
    subtypeLabel: "Building", subtypeKey: "flatsType",
    /* BS 9792 15.2: detection inside flats is considered in Type 3/4 for purpose-built blocks,
       and in every FRA for houses converted to flats. */
    needsUnitDetection: (st) => /^(Converted|Sheltered)/.test(st.flatsType || ""),

    priorities: PROFILE_HMO.priorities,
    vulnerable: PROFILE_HMO.vulnerable,
    documents: [
      "Building control completion certificate / fire strategy", "External wall information (FRAEW / PAS 9980) if relevant",
      "EICR - common parts and landlord supplies", "Fire door inspection records (flat entrance and communal doors)",
      "Emergency lighting certificate and test records (BS 5266-1)", "Smoke ventilation / AOV service records",
      "Fire alarm certificate (if a communal system is fitted)", "Dry / wet riser test records",
      "Evacuation alert system records (BS 8629)", "Lift service records (firefighting lift)",
      "Fire safety information given to residents", "Previous fire risk assessment and action plan"
    ],
    roomChecks: ["7.4"],
    suggest: Object.assign({}, PROFILE_HMO.suggest, {
      "flatdoor.orig": "Provide evidence of the replacement door's certification, or replace it with a certified FD30S fire doorset installed to BS 8214.",
      "flatdoor.rating": "Replace with a certified FD30S fire doorset installed to BS 8214, or provide evidence of the door's rating.",
      "flatdoor.closer": "Fit or adjust a self-closing device to BS EN 1154 so the door closes and latches.",
      "flatdoor.gaps": "Adjust or rehang the door so the gaps meet the doorset manufacturer's data (typically 2-4 mm at the head and sides, BS 8214); replace the door if this cannot be achieved.",
      "flatdoor.hinges": "Fit three fire-rated hinges to BS EN 1935 with all screws present.",
      "flatdoor.seals": "Fit intumescent strips and smoke seals compatible with the doorset.",
      "flatdoor.letter": "Fit a fire-rated letter plate or seal the opening.",
      "flatdoor.damage": "Repair the door using the manufacturer's approved method, or replace the doorset.",
      "flatdoor.key": "Replace the lock with one openable from inside without a key.",
      "unit.det": "Provide detection within the flat to BS 5839-6 for the tenure and the benchmark for this building.",
      "unit.hall": "Provide a protected entrance hall or an alternative exit from the flat.",
      "unit.inner": "Stop using the inner room for sleeping, or provide an alternative exit.",
      "unit.alter": "Reinstate the fire separation between the flat and the common parts.",
      "unit.hoard": "Engage the resident and relevant agencies to reduce the fire load; consider enhanced detection.",
      "riser.door": "Fit a fire-resisting, lockable door to the riser and keep it locked.",
      "riser.stop": "Fire-stop the riser at each floor level.",
      "riser.store": "Remove stored items from the riser.",
      "eas.panel": "Have the evacuation alert system serviced and faults cleared.",
      "eas.comm": "Obtain commissioning records for the evacuation alert system.",
      "eas.test": "Put routine testing and maintenance of the evacuation alert system in place."
    }),
    quickAdds,

    sections: [
      { n: 3, title: "Fire hazards and their control", groups: [
        ["Common parts", [
          "Electrical intake and meters in the common parts are enclosed and in good condition; EICR current.",
          "The common parts are free of stored combustibles and residents' belongings.",
          "Bin stores and refuse areas are managed, separated from the building where needed, and secure.",
          "Arson risk is controlled: secure entrances, letterbox protection where needed, no external fire load.",
          "No evidence of smoking in the common parts.",
          "Mobility scooters, e-bikes and e-scooters are not stored or charged in the common parts.",
          "Lightning protection, where fitted, is maintained.",
          "Contractors working in the common parts are controlled (hot work permits)."]],
        ["Inside the flats sampled (Type 3 / 4)", [
          "No hoarding or excessive fire load in the flats sampled.",
          "No e-bike or e-scooter charging in the flats sampled that would put the escape route at risk."], "rooms"]
      ]},
      { n: 5, title: "Means of escape", groups: [
        ["Common escape routes", [
          "The common stair(s) are protected and lead to a final exit.",
          "Lobby or corridor protection between flats and the stair is as designed and intact.",
          "Travel distance in the common parts is within ADB Table 1 (7.5 m one direction, 30 m more than one), or the departure is justified.",
          "Common corridors are subdivided where required and the doors work.",
          "The common parts are clear of obstructions along their full length.",
          "Doors on escape routes open easily without a key and in the direction of escape where needed.",
          "Wall and ceiling linings in the common parts show no rapid flame-spread risk.",
          "The evacuation strategy is suitable for the building and its condition."]],
        ["Final exits", [
          "Final exits open easily from inside without a key and lead to a place of safety.",
          "External routes from final exits are safe and clear."]],
        ["Inside the flats sampled (Type 3 / 4)", [
          "Flats sampled have a protected entrance hall or an alternative exit.",
          "No inner rooms are used for sleeping without an alternative exit.",
          "Flat entrance doors open from inside without a key."], "rooms"]
      ]},
      { n: 6, title: "Fire doors and compartmentation", groups: [
        ["Flat entrance and communal doors", [
          "Flat entrance doors sampled are fire-resisting and self-closing (record the doors sampled).",
          "Replacement flat entrance doors have evidence of certification.",
          "Letter plates are fire-rated where fitted.",
          "Communal fire doors (stair, lobby, corridor) are self-closing and in good condition.",
          "Riser, cupboard and plant room doors are fire-resisting and kept locked.",
          "A programme of fire door checks is in place."]],
        ["Compartmentation", [
          "Separating construction between flats and the common parts is intact as far as visible.",
          "A sample of service risers was opened and fire stopping is adequate.",
          "A sample of false ceiling tiles was lifted where present.",
          "The roof void has been inspected, or the reason for non-access is recorded.",
          "External walls: traditional masonry without risky attachments, or an FRAEW (PAS 9980) is in place or recommended."]],
        ["Inside the flats sampled (Type 3 / 4)", [
          "No alterations inside the flats sampled breach the separation from the common parts."], "rooms"],
        ["Intrusive sampling (Type 2 / 4)", [
          "Sample openings were made by a contractor; each location and finding is recorded.",
          "Fire stopping and cavity barriers are adequate at the locations opened.",
          "Separating walls and floors achieve the expected fire resistance at the locations opened.",
          "Openings were made good to restore fire resistance after inspection."], "intrusive"],
        ["Regulation 37A (Wales) - automatic fire suppression (evidence only)", [
          "The conversion to flats is confirmed as a material change of use (from the Responsible Person or building control records).",
          "Evidence has been sighted that automatic fire suppression was provided (BS 9251 or BS 8458 certificate), or that Regulation 37A was considered and not required (building control confirmation).",
          "Where a suppression system is installed, maintenance and servicing records have been sighted."], "conv"]
      ]},
      { n: 7, title: "Fire detection and alarm", groups: [
        [null, [
          "Any fire alarm in the common parts is compatible with the evacuation strategy (none for stay put).",
          "Detection provided for smoke control or lift control works and is maintained.",
          "Where a communal system is needed (e.g. conversions below standard), grade and category meet the benchmark.",
          "Detection inside the flats is in place: observed (Type 3 / 4) or confirmed by evidence."]],
        ["Inside the flats sampled (Type 3 / 4)", [
          "Smoke alarms in the flats sampled are present, mains-powered and working.",
          "Heat detection in kitchens of the flats sampled where the benchmark requires it."], "rooms"]
      ]},
      { n: 8, title: "Emergency lighting", groups: [
        [null, [
          "Emergency lighting covers internal escape routes, or its absence is justified by good borrowed light.",
          "Luminaires cover stairs, changes of level and direction, and final exits.",
          "Luminaires are in good condition; charge indicators normal.",
          "Monthly functional and annual full-duration tests are logged (BS 5266-1:2025)."]]
      ]},
      { n: 9, title: "Signage and firefighting facilities", groups: [
        ["Signs and notices", [
          "Fire action notices state the evacuation strategy for this building.",
          "Fire door signs are displayed; riser and cupboard doors say keep locked.",
          "Fire exit signs are provided where the route is not obvious."]],
        ["Facilities for the fire and rescue service", [
          "Smoke ventilation (AOV or openable vents) is unobstructed, working and serviced.",
          "Dry or wet risers, where fitted, are accessible and tested (dry riser expected where the top floor is over 18 m).",
          "Any evacuation alert system (BS 8629) is commissioned, tested and maintained.",
          "Information for the fire and rescue service is available at the entrance where provided."]],
        ["Top storey over 11 m", [
          "Floor identification and flat indicator signs are provided in stairs and lobbies (ADB Wales 18.16; required for new work, good practice for existing).",
          "A secure information box with building information for the fire and rescue service is provided (ADB Wales 18.22; required for new work, good practice for existing).",
          "The evacuation strategy has been reviewed for the building's height and condition."], "h11"],
        ["Top storey over 18 m", [
          "Firefighting shaft (stair, lobby and smoke vent) is intact and unobstructed.",
          "Rising main inlet is accessible, signed and visible from the fire appliance access point.",
          "Firefighting lift operates, its switch is accessible, and it is maintained.",
          "An evacuation alert system to BS 8629 is provided (ADB Wales 18.20; required for new work, good practice for existing)."], "h18"]
      ]},
      { n: 10, title: "Management of fire safety", management: true, groups: [
        [null, [
          "Residents are given fire safety information, including the evacuation strategy.",
          "Routine inspections of the common parts are carried out and recorded.",
          "Testing and maintenance of fire safety systems is carried out by competent persons.",
          "Flat entrance door checks are carried out and recorded.",
          "Alterations by leaseholders or tenants are controlled.",
          "There is co-operation and co-ordination between Responsible Persons (freeholder, managing agent, commercial occupiers).",
          "Previous FRA action plan items have been completed.",
          "The fire risk assessment is reviewed at a suitable interval and after significant change."]],
        ["Temporary simultaneous evacuation", [
          "Interim measures (waking watch and/or common alarm) are in place, staffed or tested, and logged.",
          "Residents have been told about the change of strategy and what to do.",
          "There is a dated plan to remedy the reason stay put is not supported, and the interim measures are reviewed."], "tempsim"]
      ]}
    ],

    benchmark(s) {
      const t = s.flatsType || "", st = String(s.storeys || ""), h = Number(s.topHeight) || 0, hb = heightBand(s);
      const out = { lines: [], travelRef: s.smallStair === "Yes" ? 4.5 : 7.5, travelRefAlt: 30, mcp: "", notes: [] };
      const conv = t.startsWith("Converted"), n = Number(st) || 0;
      if (!t) { out.lines.push(["Benchmarks", "Choose the building type on the Setup screen."]); return out; }
      const low = Number(st) > 0 && Number(st) <= 2;
      let det;
      if (t.includes("below 1991")) det = low ? "Mixed system: Grade D, LD2 in the common parts with a heat detector in each flat's room or lobby opening onto the escape route (interlinked); a separate Grade D, LD3 smoke alarm in each flat (LACORS Table C4)."
        : "Mixed system: Grade A, LD2 in the common parts with a heat detector in each flat's room or lobby opening onto the escape route (interlinked); a separate Grade D, LD3 smoke alarm in each flat (LACORS Table C4).";
      else if (t === "Sheltered housing") det = "Flats: Grade D2, LD2 in existing schemes (LD1 when upgraded or rewired). Communal areas: Grade A to BS 5839-1 L4 or L5 based on the fire risk assessment; detection normally covers communal lounges, kitchens and laundries; call points only if there is smoke detection in the common parts (BS 5839-6 Table 1, 18.2c). Check alarm transmission to the monitoring centre (20.2c).";
      else if (s.strategy === "Simultaneous") det = "Simultaneous evacuation selected: a communal fire alarm system is needed to support it. Record why stay put is not supported. Inside each flat: rented flats Grade D1, LD2 (BS 5839-6 Table 1).";
      else if (s.strategy === "Temporary simultaneous") det = "Temporary simultaneous evacuation: interim measures (common alarm and/or waking watch) are in place until the reason for leaving stay put is remedied; review regularly (NFCC Simultaneous Evacuation Guidance).";
      else det = "Stay put: no fire alarm in the common parts (BS 9792 15.2; BS 5839-6). Detection only for smoke or lift control. Inside each flat: rented flats Grade D1, LD2 (BS 5839-6 Table 1), checked in a Type 3 / 4 assessment.";
      out.lines.push(["Detection", det],
        ...(conv && !t.includes("below 1991") ? [["Escape route and separation", "Converted to the 1991 Building Regulations standard and still meeting it: no additional measures expected unless the flats are occupied differently or a new risk has been introduced (LACORS para 37). Confirm the conversion standard, e.g. from the completion certificate."]] : []),
        ...(conv && t.includes("below 1991") ? [["Escape route and separation", n >= 5 ? "30-min protected route, FD30S doors to rooms opening onto it, FD30 doors (no closers) to risk rooms within flats; 30-min separation between flats throughout, and across the stair between the first and second and fourth and fifth floors (LACORS D12)." : n >= 3 ? "30-min protected route, FD30S doors to rooms opening onto it; sound conventional doors within flats. 30-min separation between flats is ideal; on risk assessment existing sound traditional construction with compensatory detection may be accepted (LACORS D11)." : "30-min protected route, FD30S doors to rooms opening onto it; sound conventional doors within flats; 30-min separation between flats. A lower standard of route may be accepted with suitable escape windows from bedrooms and living rooms (LACORS D10)."]] : []),
        ["Flat entrance doors", "Fire-resisting and self-closing; FD30S for replacements (BS 8214:2026). Older doors that met standards when built can remain acceptable on a risk basis."],
        ["Travel distance", "Flat entrance door to the common stair or stair lobby: 7.5 m in one direction (4.5 m in a small single-stair building without lobby smoke control), 30 m in more than one direction (Approved Document B Vol 2, Wales, Table 1)."],
        ["Smoke ventilation", "As designed for the building; a small single-stair building without lobbies needs an AOV at the head of the stair (ADB Diagram 9)."],
        ["Emergency lighting", "On internal escape routes unless justified by good borrowed light (BS 9792; BS 5266-1:2025)."],
        ["Fire resistance", conv ? "Converted house: 30 minutes between flats and to the common escape route is the LACORS benchmark (D10-D12); new-build periods in ADB Table A2 are not applied to existing conversions." : h ? "New-build reference only: " + (h <= 5 ? "Top floor not more than 5 m: elements of structure 30 min" : h <= 18 ? "Top floor not more than 18 m: elements of structure 60 min" : h <= 30 ? "Top floor not more than 30 m: elements of structure 90 min" : s.sprinklered === "Yes" ? "Top floor over 30 m: 120 min, sprinklers required" : "Top floor over 30 m: not permitted without sprinklers (120 min with)") + " (ADB Vol 2 Wales, Table A2). Compartment floors between flats are expected to match." : "Enter the top floor height on Setup."],
        ["Firefighting", h > 50 ? "Top floor over 50 m: wet rising main, firefighting shaft and firefighting lift expected (ADB)." : h > 18 ? "Top floor over 18 m: rising main and firefighting shaft with firefighting lift expected (ADB); check test records." : "Rising main and firefighting shaft normally expected only where the top floor is over 18 m (ADB)."],
        ["External walls", "Traditional masonry without risky attachments: normally acceptable. Otherwise consider an FRAEW to PAS 9980 (BS 9792)."]);
      if (hb.cat) out.lines.unshift(["Height category", `${hb.cat} under the Building Safety (Wales) Act 2026 (provisional: most of the Act is not yet in force and the height method is under consultation).`]);
      if (t === "Sheltered housing") out.notes.push("Sheltered housing: record residents' ability to respond and evacuate, warden or monitoring arrangements, and any person-centred measures (BS 9792; NFCC Fire safety in specialised housing).");
      if (conv && t.includes("below 1991") && n > 6) out.notes.push("LACORS Table C4 and case studies D10-D12 stop at six storeys. Above that, assess against BS 9792 with reference to Approved Document B and record the basis.");
      if (t.includes("below 1991") && (s.strategy || "Stay put") === "Stay put") out.notes.push("The LACORS mixed system sounds throughout the common parts. Check the stay put strategy is consistent with the alarm and the condition of the separation.");
      if (t.includes("below 1991")) out.notes.push("Converted below 1991 Building Regulations standard: if under two-thirds of the flats are owner-occupied it is a section 257 HMO under the Housing Act 2004. A stay put strategy may not be supported.");
      if (s.maisonettes === "Yes") out.lines.push(["Maisonettes", "Inside each rented maisonette with any floor above 4.5 m: Grade D1, LD2 with an alternative means of escape, LD1 without one (BS 5839-6 Table 1)."]);
      if (s.basement === "Yes") out.lines.push(["Basement", "30-min separation between the basement and the ground floor with a self-closing FD30S door at the head of the basement stair (LACORS 10.4). Habitable basement: separate exit, escape windows, or a 30-min protected route (LACORS 10.6)."]);
      if (s.nonres === "Yes") out.lines.push(["Non-residential use", "Generally 60-min imperforate separation between the two uses; 30 min may be accepted for lower-risk premises with automatic detection in the commercial part linked to the residential system (LACORS 31.2)."]);
      return out;
    }
  };
})();

addNonres(PROFILE_FLATS);
PROFILES.flats = PROFILE_FLATS;
