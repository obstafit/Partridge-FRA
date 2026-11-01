/* Template profile: HMO, BS 9792:2025 (Wales).
   Everything that varies by building type lives here: checks, quick-add fields,
   documents, benchmarks. The app reads this object and never hard-codes content. */
"use strict";

const YN = { t: "yn" };   // Yes / No / N/A, "No" is a deficiency

const PROFILE_HMO = {
  id: "hmo-bs9792-2025",
  name: "HMO",
  title: "House in Multiple Occupation",
  unit: { one: "letting", many: "lettings", Cap: "Letting" },
  licensing: true,
  /* Sub-type questions on the Setup screen: [key, label, options or "num" or "", show(setup)?] */
  subtype: [
    ["occType", "Occupation type", ["Shared house (one joint tenancy, shared kitchen)", "Bedsits with cooking in rooms", "Bedsits with shared kitchen", "Mixed bedsits and flats", "Flat in multiple occupation", "Supported housing (shared)", "Owner-occupied house with lodgers"]],
    ["jointTenancy", "One joint tenancy, whole house?", ["Yes", "No"], (st) => (st.occType || "").startsWith("Shared house")],
    ["storeys", "Storeys (count the ground floor, not a basement)", ["1", "2", "3", "4", "5", "6", "7", "8 or more"]],
    ["occupants", "Occupants", "num"], ["rooms", "Lettable rooms", "num"], ["households", "Households", "num"],
    ["over200", "Any floor over 200 m²", ["Yes", "No"]],
    ["bedrooms", "Bedrooms", "num", (st) => (st.occType || "").startsWith("Supported")],
    ["nonres", "Shop or other non-residential use in the building", ["No", "Yes"]]
  ],
  subtypeLabel: "HMO type", subtypeKey: "occType",
  /* BS 9792: detection inside dwellings is considered in every FRA of an HMO. */
  needsUnitDetection: () => true,
  standard: "BS 9792:2025",
  legislation: "Regulatory Reform (Fire Safety) Order 2005 | Housing Act 2004",
  detectionStd: "BS 5839-6:2019+A1:2020",

  priorities: [
    { k: "H", label: "High", time: "Immediate / within 1 month" },
    { k: "M", label: "Medium", time: "Within 3 months" },
    { k: "L", label: "Low", time: "Within 12 months" }
  ],

  vulnerable: [
    "Older occupants (reduced mobility or awareness)", "Physical mobility impairment", "Visual impairment",
    "Hearing impairment (alarm audibility concern)", "Cognitive impairment or dementia",
    "Occupants affected by medication, alcohol or drugs", "Children present",
    "First language not English", "Unfamiliar with the building layout", "PEEP or evacuation arrangements needed"
  ],

  documents: [
    "HMO licence and licence conditions", "Rent Smart Wales registration / licence",
    "Building control completion certificate", "EICR - common parts and landlord supplies",
    "Gas safety record (CP12)", "Fire alarm certificate (BS 5839-6 / BS 5839-1)",
    "Emergency lighting certificate and test records (BS 5266-1)", "Fire door certification / inspection records",
    "Fire suppression system certificate", "PAT records (landlord-supplied appliances)",
    "Fire safety logbook", "Previous fire risk assessment and action plan"
  ],

  /* Suggested action wording, keyed "quickAdd.field". Drafted into the action plan; always edit to suit. */
  suggest: {
    "unit.det": "Install detection in the letting to the benchmark for this HMO (heat or multi-sensor where there is cooking) and interlink as required.",
    "unit.test": "Repair or replace the faulty alarm in the letting and retest.",
    "unit.cook": "Move the cooking appliance away from the room exit door.",
    "unit.door": "Repair the letting entrance door so it self-closes and latches.",
    "unit.elec": "Remove overloaded adaptors and damaged leads; have the installation checked by an electrician if needed.",
    "unit.charge": "Stop charging e-bikes, e-scooters and large batteries in the letting; provide safe charging arrangements.",
    "unit.heat": "Remove the unsafe heater or naked-flame source and brief the tenant.",
    "unit.win": "Provide a suitable escape window or a protected route that does not rely on it.",
    "sample.find": "Fire-stop or reinstate the construction at the location opened to restore the expected fire resistance; extend the survey if the defect may be repeated elsewhere.",
    "sample.made": "Make good the opening to restore fire resistance.",
    "door.rating": "Replace with a certified FD30S fire doorset installed to BS 8214, or provide evidence of the existing door's rating.",
    "door.closer": "Fit a self-closing device to BS EN 1154 and adjust so the door closes and latches from any angle.",
    "door.latch": "Adjust the door, closer and latch so the door closes fully and latches.",
    "door.gaps": "Adjust or rehang the door so the gaps meet the doorset manufacturer's data (typically 2-4 mm at the head and sides, BS 8214); replace the door if this cannot be achieved.",
    "door.seals": "Fit intumescent strips and smoke seals compatible with the doorset's certification.",
    "door.hinges": "Fit three fire-rated hinges to BS EN 1935 with all screws present and tight.",
    "door.leaf": "Repair or replace the damaged leaf or frame to restore fire resistance.",
    "door.glazing": "Replace the glazing with fire-resisting glass and the correct fire-rated glazing system.",
    "door.damage": "Repair the damage using the manufacturer's approved method, or replace the doorset.",
    "door.hold": "Link the hold-open device to the fire alarm (BS 7273-4) or remove it.",
    "door.sign": "Fit 'Fire door keep shut' signage (BS 5499 / BS EN ISO 7010).",
    "detector.power": "Replace with mains-powered detection with a tamper-proof standby supply: Grade D1 is the minimum for rented premises (BS 5839-6 Table 1). D2 is acceptable in sheltered housing units; override the result if so.",
    "detector.link": "Interlink the detector with the rest of the system and confirm by test.",
    "detector.cond": "Clean, clear or replace the detector; replace any detector past its expiry date.",
    "detector.test": "Repair or replace the faulty detector and retest the system.",
    "detector.siting": "Resite the detector in line with BS 5839-6 Clause 11.",
    "detector.log": "Start a test log and record routine tests.",
    "el.cond": "Repair or replace the emergency light fitting.",
    "el.led": "Investigate the charge fault and repair or replace the fitting; retest.",
    "el.cover": "Add emergency lighting to cover stairs, changes of direction and the final exit (BS 5266-1:2025).",
    "el.monthly": "Carry out and log monthly functional tests.",
    "el.annual": "Carry out and log an annual full-duration test.",
    "travel.dist": "Justify the distance in the risk rating, or provide additional measures such as enhanced detection or an alternative route.",
    "escape.prot": "Provide a 30-minute protected route as required by the benchmark for this HMO.",
    "escape.clear": "Remove all items from the escape route and keep it clear.",
    "extstair.cond": "Repair the external stair, treads, handrails and guarding.",
    "extstair.clear": "Keep the external stair clear and treat slip hazards.",
    "extstair.open": "Protect openings next to the external stair with fire-resisting construction, or provide an alternative route.",
    "extstair.exit": "Make sure the external stair leads to a place of safety.",
    "extstair.lit": "Provide lighting (and emergency lighting where needed) to the external stair.",
    "lift.shaft": "Make good the lift shaft and doors so they maintain the protected route.",
    "lift.notice": "Display a notice at each lift landing not to use the lift in a fire.",
    "lift.service": "Arrange the lift's thorough examination and service.",
    "lift.switch": "Have the firefighting or evacuation lift controls repaired and tested.",
    "escape.inner": "Stop using the inner room for sleeping or as a habitable room, or make it acceptable: provide an alternative exit, or an escape window where the floor is not more than 4.5 m above ground; adequate automatic detection; and a fire-resisting door (typically FD30S) between the inner and outer rooms (LACORS 12.2).",
    "escape.lining": "Remove polystyrene tiles or other rapid flame-spread linings from the escape route.",
    "stairs.store": "Remove items stored on or under the stairs; enclose any under-stair cupboard in fire-resisting construction.",
    "stairs.prot": "Enclose the stair in 30-minute fire-resisting construction with fire doors to risk rooms.",
    "comb.charge": "Stop charging e-bikes, e-scooters and batteries in the common parts; provide a safe external store if needed.",
    "comb.qty": "Remove the stored combustibles from the common parts.",
    "comb.obstruct": "Remove the obstruction from the escape route.",
    "firestop.cond": "Fire-stop the penetration with a tested product compatible with the construction.",
    "firestop.survey": "Commission a fire-stopping survey by a competent contractor.",
    "comp.def": "Repair the construction to restore its fire resistance.",
    "comp.roof": "Extend the compartment wall through the roof void, or commission a survey.",
    "elec.frc": "Enclose the electrical intake in a fire-resisting cupboard kept closed.",
    "elec.cond": "Have a qualified electrician inspect and repair the equipment.",
    "elec.clear": "Remove combustibles from around the electrical equipment.",
    "elec.eicr": "Complete the remedial work listed on the EICR and obtain a satisfactory report.",
    "exit.key": "Replace the lock with a single-action fastening openable from inside without a key (e.g. thumb-turn).",
    "exit.sec": "Remove additional bolts or chains that hinder escape.",
    "exit.out": "Clear the external route from the final exit to a place of safety.",
    "alarm.mcp": "Install manual call points at storey exits and final exits (BS 5839-6 18.2).",
    "alarm.panel": "Have the fire alarm engineer clear the fault and restore all zones; log the visit.",
    "alarm.how": "Confirm interlinking by a witnessed test and record it.",
    "alarm.meter": "Rewire the common-parts alarm supply from the landlord's permanent supply."
  },

  /* Checks that depend on seeing inside the lettings. In a Type 1 or 2 assessment they are confirmed by
     evidence (certificate, RP statement, witnessed test) rather than inspection. */
  roomChecks: ["3.9", "5.9", "5.10", "7.4", "7.5", "7.10", "7.11"],
  suggestExtra: {},

  /* Section checks. Numbering matches the HMO template v3 (sections 3, 5-10). */
  sections: [
    { n: 3, title: "Fire hazards and their control", groups: [
      ["Ignition sources", [
        "Fixed electrical installation has a current satisfactory EICR.",
        "Landlord-supplied portable appliances are in good condition, with PAT records where appropriate.",
        "Cooking facilities are suitable, in good condition, and not on or beside the escape route.",
        "Heating is maintained (gas safety record current); no unsafe portable heaters in use.",
        "Smoking is controlled; no evidence of smoking in the common parts.",
        "No evidence of candles, incense or other naked flames left unattended.",
        "Arson risk is controlled: secure entrance, letterbox protection where needed, no fire load left outside."]],
      ["Fuel sources", [
        "Building fabric in the common parts does not present an unusual fire load.",
        "Landlord-supplied furniture and furnishings are in good condition and meet the furniture fire safety regulations.",
        "No personal possessions are stored in the common parts or escape routes.",
        "Shared kitchens are free of excessive combustibles near cooking appliances.",
        "Waste and recycling are stored externally or in a suitable enclosed store.",
        "Bicycles and mobility scooters are not stored in the escape route.",
        "External combustibles are kept away from the building and its openings."]],
      ["Modern and emerging hazards", [
        "Lithium-ion batteries and chargers are used safely; nothing is charged in the escape route.",
        "E-bikes and e-scooters are not stored or charged in the common parts or escape routes.",
        "Any EV charging point is suitably installed and sited away from escape routes.",
        "Any solar PV installation has accessible isolation, and the inverter location is known.",
        "No evidence of multiple devices left charging unattended overnight in the common parts."]],
      ["Inside the lettings sampled (Type 3 / 4)", [
        "No overloaded sockets, daisy-chained extension leads or damaged wiring in the lettings sampled.",
        "Cooking appliances in bedsits are sited away from the room exit door.",
        "No unsafe heaters, candles or smoking materials evident in the lettings sampled.",
        "No e-bike, e-scooter or battery charging in the lettings sampled."], "rooms"]
    ]},
    { n: 5, title: "Means of escape", groups: [
      ["Escape route", [
        "The escape route is a protected route where the benchmark requires it.",
        "An alternative escape route, secondary means of escape or lobby protection is provided where the storey height requires it.",
        "Travel distances are within the benchmark, or the departure is justified.",
        "Smoke ventilation at the head of the stair, where provided, is unobstructed and working.",
        "Rooms open directly onto the escape route; no unprotected inner rooms.",
        "The escape route is clear of obstructions and storage along its full length.",
        "Stairs, landings, handrails and floor coverings are in sound condition.",
        "Wall and ceiling linings show no rapid flame-spread risk (e.g. polystyrene tiles).",
        "Escape windows, where relied upon, are suitable, openable and unobstructed.",
        "Letting room doors can be opened from inside without a key."]],
      ["Final exit", [
        "The final exit opens easily in the direction of escape, without a key, using a single fastening.",
        "The final exit leads directly to a place of safety; the external route is clear.",
        "Security fittings do not hinder escape.",
        "An assembly point is identified and known to occupants."]],
      ["Inside the lettings sampled (Type 3 / 4)", [
        "Escape from each letting sampled reaches the protected route without passing through a risk room.",
        "Escape windows from lettings, where relied on, open fully and are of a suitable size."], "rooms"]
    ]},
    { n: 6, title: "Fire doors and compartmentation", groups: [
      ["Fire doors", [
        "Kitchen doors onto the escape route are fire doors to the benchmark and self-closing.",
        "Letting room doors onto the escape route are fire doors to the benchmark and self-closing.",
        "Fire door certification has been sighted.",
        "Gaps are within tolerance; intumescent strips and smoke seals are intact.",
        "No fire door is wedged open, damaged, or has its closer removed.",
        "Fire door signage is displayed where appropriate."]],
      ["Compartmentation and fire stopping", [
        "Walls and ceilings enclosing the escape route are intact.",
        "Service penetrations through fire-resisting construction are fire-stopped.",
        "Loft hatches, downlights and other ceiling openings in the escape route are fire-resisting.",
        "Cupboards and meter enclosures on the escape route are fire-resisting and kept closed.",
        "Any basement or cellar is separated from the ground-floor escape route.",
        "The roof void has been inspected, or the reason for non-access is recorded.",
        "No alterations are apparent that could have compromised fire separation."]],
      ["Regulation 37A (Wales) - evidence only", [
        "Where Regulation 37A applies, evidence of suppression or building control confirmation has been sighted."]],
      ["Inside the lettings sampled (Type 3 / 4)", [
        "Letting entrance doors close and latch fully from inside; closer, seals and leaf are in good condition.",
        "No openings or alterations inside the lettings that breach the separation from the escape route."], "rooms"],
      ["Intrusive sampling (Type 2 / 4)", [
        "Sample openings were made by a contractor; each location and finding is recorded.",
        "Fire stopping and cavity barriers behind linings are adequate at the locations opened.",
        "Separating walls and floors achieve the expected fire resistance at the locations opened.",
        "Openings were made good to restore fire resistance after inspection."], "intrusive"]
    ]},
    { n: 7, title: "Fire detection and alarm", groups: [
      [null, [
        "System grade and category meet the benchmark for this HMO type and storey height.",
        "Smoke detection in every escape route circulation area and landing.",
        "Heat detection in every kitchen and communal kitchen.",
        "Detection in the principal habitable room and every communal lounge.",
        "Bedsits with cooking have heat or multi-sensor detection.",
        "Detection is interlinked, or a mixed system is correctly arranged.",
        "Mains-powered with standby supply; common-parts alarms not on a tenant's prepayment meter.",
        "Manual call points are provided where required and unobstructed.",
        "The control panel (Grade A) is near the entrance, shows normal, and identifies the unit in alarm.",
        "The alarm gives at least 85 dB(A) at each bedroom doorway with the door open, unless a sounder or interlinked alarm is in the room (BS 5839-6 13.2e). Consider higher levels where occupants may not wake.",
        "Carbon monoxide alarms are provided where combustion appliances are present.",
        "Routine testing is carried out and logged.",
        "Servicing by a competent person is in date.",
        "An installation or commissioning certificate has been sighted."]],
      ["Detection inside the lettings - evidence (Type 1 / 2)", [
        "Detection inside the lettings is confirmed by certificate, Responsible Person statement or tenant confirmation."], "evidence"],
      ["Inside the lettings sampled (Type 3 / 4)", [
        "Detection in each letting sampled is present, working and of the expected type.",
        "Bedsits with cooking have a working heat or multi-sensor alarm (tested).",
        "The alarm is audible inside the lettings sampled with the door closed."], "rooms"]
    ]},
    { n: 8, title: "Emergency lighting", groups: [
      [null, [
        "Emergency lighting is provided where the route is long, complex, or lacks borrowed light.",
        "Luminaires cover stairs, changes of level and direction, landings and final exits.",
        "Illumination appears adequate along the escape route.",
        "Duration is adequate for sleeping premises (normally 3 hours).",
        "Luminaires are in good condition; charge indicators normal.",
        "Monthly functional tests are carried out and logged.",
        "Annual full-duration tests are carried out and logged.",
        "An installation or periodic certificate (BS 5266-1) has been sighted."]]
    ]},
    { n: 9, title: "Firefighting equipment and signage", groups: [
      ["Firefighting equipment", [
        "A fire blanket is provided in each shared kitchen and each bedsit with cooking.",
        "Where provided, a multi-purpose extinguisher is sited on each floor of the common parts.",
        "Extinguisher types suit the hazard and are within service date (BS 5306-3)."]],
      ["Signs and notices", [
        "A fire action notice is displayed prominently in the common parts.",
        "Fire exit signs are provided where the route is complex or there is a secondary escape.",
        "Fire door signs are on fire doors and cupboards.",
        "No-smoking signs are displayed in the common parts."]]
    ]},
    { n: 10, title: "Management of fire safety", management: true, groups: [
      ["Information and procedures", [
        "Written fire emergency plan and fire safety information are given to tenants.",
        "Tenants are briefed on fire procedures at move-in.",
        "A fire safety logbook is kept (tests, inspections, false alarms, works).",
        "Routine inspections of the common parts, fire doors and escape routes are carried out.",
        "Contractors and hot work are controlled.",
        "There is co-operation and co-ordination with any other Responsible Persons."]],
      ["Compliance records", [
        { t: "HMO licence conditions relating to fire safety are met.", when: "hmo" },
        { t: "Management of HMOs (Wales) Regulations 2006 duties are met.", when: "hmo" },
        "Gas safety record (CP12) is current.",
        "EICR is current and satisfactory.",
        "PAT records are kept for landlord-supplied appliances.",
        "Previous FRA action plan items have been completed.",
        "The fire risk assessment is reviewed at least annually, or sooner after a significant change."]]
    ]}
  ],

  /* Quick-add items. Field types: yn (Yes/No/N/A, No = deficiency), yes (Yes/No/N/A, Yes = deficiency),
     sel (options; bad = options that are deficiencies), num, text. sec = report section it files into. */
  quickAdds: [
    { k: "door", label: "Fire door", sec: 6, front: true, fields: [
      ["ref", "Door reference / location", "text"],
      ["type", "Door type", "sel", ["Letting room entrance", "Kitchen", "Stair enclosure", "Riser / cupboard", "Final exit", "Other"]],
      ["rating", "Rating evidenced", "sel", ["FD30S", "FD30", "FD60S", "Not evidenced", "Not a fire door"], ["Not evidenced", "Not a fire door"]],
      ["closer", "Self-closer fitted and working (BS EN 1154)", "yn"],
      ["latch", "Closes and latches fully", "yn"],
      ["gaps", "Gaps to manufacturer's data (typically 2-4 mm head and sides; threshold per data sheet)", "yn"],
      ["seals", "Intumescent strips and smoke seals intact", "yn"],
      ["hinges", "Three hinges, screws tight, no wear (BS EN 1935)", "yn"],
      ["leaf", "Leaf and frame sound", "yn"],
      ["glazing", "Glazing", "sel", ["None", "Fire-rated, correctly beaded", "Not fire-rated or damaged"], ["Not fire-rated or damaged"]],
      ["damage", "Free of holes, splits, missing ironmongery or alterations", "yn"],
      ["hold", "Hold-open device", "sel", ["None", "Fitted - linked to alarm", "Fitted - not linked"], ["Fitted - not linked"]],
      ["sign", "Signage (BS 5499)", "sel", ["Present", "Not required", "Missing"], ["Missing"]]
    ]},
    { k: "detector", label: "Detector", sec: 7, front: true, fields: [
      ["loc", "Location", "text"],
      ["type", "Type", "sel", ["Smoke (optical)", "Smoke (ionisation)", "Heat", "Multi-sensor", "CO fire detector"]],
      ["power", "Power", "sel", ["Mains + tamper-proof battery (D1)", "Mains + replaceable battery (D2)", "Battery only (F)", "Grade A system"], ["Battery only (F)", "Mains + replaceable battery (D2)"]],
      ["link", "Interlinking", "sel", ["Interlinked", "Not interlinked - by design (mixed system)", "Not interlinked - should be"], ["Not interlinked - should be", "No"]],
      ["cond", "Undamaged, unobstructed and in date", "yn"],
      ["test", "Test result", "sel", ["Tested - sounded", "Tested - failed", "Not tested"], ["Tested - failed"]],
      ["siting", "Sited correctly (ceiling, 300 mm from walls and lights)", "yn"],
      ["log", "Test log kept", "yn"]
    ]},
    { k: "el", label: "Emergency light", sec: 8, front: true, fields: [
      ["loc", "Location", "text"],
      ["type", "Type", "sel", ["Non-maintained", "Maintained", "Exit sign"]],
      ["dur", "Duration", "sel", ["3 hours", "1 hour", "Not known"]],
      ["cond", "Fitting in good condition", "yn"],
      ["led", "Charge indicator normal", "yn"],
      ["cover", "Covers stairs, changes of direction and final exit", "yn"],
      ["monthly", "Monthly test logged", "yn"],
      ["annual", "Annual full-duration test logged", "yn"]
    ]},
    { k: "travel", label: "Travel distance", sec: 5, front: true, fields: [
      ["from", "From", "text"], ["to", "To (place of relative safety or final exit)", "text"],
      ["dist", "Measured distance (m)", "num"],
      ["routes", "Escape", "sel", ["Single direction", "Alternative routes"]]
    ]},
    { k: "escape", label: "Escape route", sec: 5, front: true, fields: [
      ["loc", "Section of route", "text"],
      ["prot", "Protected route", "sel", ["Yes", "Partial", "No"], ["No", "Partial"]],
      ["clear", "Clear of obstructions", "yn"],
      ["dead", "No excessive dead end", "yn"],
      ["inner", "No unprotected inner rooms", "yn"],
      ["lining", "Linings acceptable (no polystyrene tiles or foam)", "yn"],
      ["light", "Lighting adequate", "yn"]
    ]},
    { k: "stairs", label: "Stairs", sec: 5, fields: [
      ["loc", "Stair", "text"], ["width", "Width (mm)", "num"],
      ["prot", "Protected enclosure", "sel", ["Yes", "Partial", "No"], ["No", "Partial"]],
      ["rails", "Handrails and treads sound", "yn"],
      ["store", "Nothing stored on or under the stairs", "yn"],
      ["base", "Basement stair separated", "sel", ["Yes", "No", "No basement"], ["No"]],
      ["el", "Emergency lighting coverage", "yn"]
    ]},
    { k: "comb", label: "Combustibles", sec: 3, front: true, fields: [
      ["loc", "Location", "sel", ["Escape route", "Under stairs", "Riser / cupboard", "Plant / meter area", "External"]],
      ["item", "Item", "sel", ["Bikes", "E-bike or e-scooter", "Rubbish / recycling", "Furniture", "Stored goods", "Flammable liquids", "Other"]],
      ["charge", "Charging observed", "yes"],
      ["qty", "Quantity", "sel", ["Minor", "Significant", "Excessive"], ["Significant", "Excessive"]],
      ["obstruct", "Obstructs escape", "yes"],
      ["done", "Action", "sel", ["Removed on the day", "RP to remove", "Management control"]]
    ]},
    { k: "firestop", label: "Fire stopping", sec: 6, fields: [
      ["loc", "Location", "text"],
      ["el", "Element", "sel", ["Wall", "Floor", "Ceiling", "Riser", "Above door", "Service duct"]],
      ["pen", "Penetration", "sel", ["Cables", "Pipes", "Ducts", "Trunking", "Other"]],
      ["cond", "Condition", "sel", ["Sealed", "Gap / unsealed", "Damaged", "Unknown"], ["Gap / unsealed", "Damaged"]],
      ["survey", "Specialist survey needed", "yes"]
    ]},
    { k: "comp", label: "Compartmentation", sec: 6, fields: [
      ["loc", "Location", "text"],
      ["el", "Element", "sel", ["Escape route enclosure", "Wall between units", "Floor", "Loft hatch", "Riser", "Ceiling / roof void", "High-hazard room"]],
      ["cons", "Construction", "sel", ["Masonry", "Plasterboard", "Lath and plaster", "Timber", "Other"]],
      ["def", "Defects", "sel", ["None", "Holes or damage", "Missing boards", "Non-rated hatch or opening", "Gaps at junctions"], ["Holes or damage", "Missing boards", "Non-rated hatch or opening", "Gaps at junctions"]],
      ["roof", "Walls carried through roof void", "sel", ["Yes", "No", "Not accessed", "N/A"], ["No"]]
    ]},
    { k: "elec", label: "Electrical panel", sec: 3, fields: [
      ["loc", "Location", "text"],
      ["type", "Type", "sel", ["Consumer unit", "Distribution board", "Meter cupboard"]],
      ["encl", "Enclosure", "sel", ["Metal (non-combustible)", "Plastic"]],
      ["frc", "Fire-resisting enclosure where on escape route", "yn"],
      ["cond", "No damage, scorching or exposed conductors", "yn"],
      ["clear", "Clear of combustibles", "yn"],
      ["eicr", "EICR result", "sel", ["Satisfactory", "Unsatisfactory", "Not sighted"], ["Unsatisfactory"]]
    ]},
    { k: "iso", label: "Isolation", sec: 3, fields: [
      ["svc", "Service", "sel", ["Gas", "Electric", "Water", "PV / battery"]],
      ["loc", "Location", "text"], ["label", "Labelled", "yn"], ["acc", "Accessible", "yn"]
    ]},
    { k: "exit", label: "Final exit", sec: 5, front: true, fields: [
      ["loc", "Exit", "text"],
      ["key", "Opens from inside without a key", "yn"],
      ["fast", "Fastening", "sel", ["Thumb-turn", "Push bar", "Push pad", "Key lock", "Other"], ["Key lock"]],
      ["sec", "No extra bolts or chains hindering escape", "yn"],
      ["out", "Clear route to a place of safety outside", "yn"],
      ["width", "Clear width (mm)", "num"],
      ["sign", "Signage", "sel", ["Present", "Not needed", "Missing"], ["Missing"]]
    ]},
    { k: "width", label: "Door width", sec: 5, fields: [
      ["loc", "Door", "text"], ["type", "Type", "sel", ["Storey exit", "Final exit", "Route door"]],
      ["w", "Clear width (mm)", "num"], ["occ", "Occupants served", "num"]
    ]},
    { k: "ext", label: "Extinguisher / blanket", sec: 9, fields: [
      ["loc", "Location", "text"],
      ["type", "Type", "sel", ["Fire blanket", "Water", "Foam", "CO2", "Dry powder", "Wet chemical", "Water mist"]],
      ["suit", "Suitable for the hazard", "yn"], ["mount", "Mounted and signed", "yn"],
      ["svc", "Last service date", "text"], ["cond", "Good condition, pin and seal intact", "yn"]
    ]},
    { k: "sign", label: "Signage", sec: 9, fields: [
      ["loc", "Location", "text"],
      ["type", "Sign", "sel", ["Fire action notice", "Escape route", "Final exit", "Fire door keep shut", "No smoking", "Floor identification"]],
      ["present", "Present where needed", "yn"], ["correct", "Correct pictogram and direction (BS EN ISO 7010)", "yn"],
      ["vis", "Visible and lit", "yn"]
    ]},
    { k: "alarm", label: "Alarm panel / call points", sec: 7, fields: [
      ["panel", "Panel status", "sel", ["Normal", "Fault showing", "Zones disabled", "No panel (Grade D)"], ["Fault showing", "Zones disabled"]],
      ["mcp", "Manual call points", "sel", ["Provided", "Not required", "Missing"], ["Missing"]],
      ["heat", "Heat detection in kitchens", "yn"], ["co", "CO alarms where needed", "yn"],
      ["aud", "Audible in rooms with doors closed", "yn"],
      ["how", "Interlinking confirmed by", "sel", ["Witnessed test", "Installer certificate", "RP statement", "Not confirmed"], ["Not confirmed"]],
      ["meter", "Not on a tenant's prepayment meter", "yn"]
    ]},
    { k: "supp", label: "Suppression", sec: 6, fields: [
      ["type", "System", "sel", ["Sprinklers BS 9251", "Sprinklers BS EN 12845", "Water mist", "Kitchen suppression"]],
      ["valve", "Valve set accessible and open", "yn"], ["stock", "Nothing stored close to heads", "yn"],
      ["cert", "Service records sighted", "yn"]
    ]},
    { k: "smoke", label: "Smoke vent / AOV", sec: 5, fields: [
      ["loc", "Location", "text"], ["type", "Type", "sel", ["AOV", "Manual vent", "Mechanical extract"]],
      ["cond", "Unobstructed and working", "yn"], ["cert", "Test records sighted", "yn"]
    ]},
    { k: "ffac", label: "Firefighting facility", sec: 9, fields: [
      ["fac", "Facility", "sel", ["Dry riser", "Wet riser", "Firefighting lift", "Firefighter's switch", "Premises information box"]],
      ["acc", "Accessible and signed", "yn"], ["cert", "Test records sighted", "yn"]
    ]},
    { k: "unit", label: "Letting inspection", sec: 7, front: true, when: "rooms", fields: [
      ["ref", "Letting", "text"],
      ["det", "Detection in the letting", "sel", ["Smoke and heat", "Heat or multi-sensor only", "Smoke only", "None"], ["None"]],
      ["test", "Tested", "sel", ["Sounded", "Failed", "Not tested"], ["Failed"]],
      ["cook", "Cooking", "sel", ["None in room", "In room - away from door", "In room - near door"], ["In room - near door"]],
      ["door", "Entrance door closes and latches from inside", "yn"],
      ["elec", "No overloaded sockets or damaged leads", "yn"],
      ["charge", "E-bike, e-scooter or battery charging in the room", "yes"],
      ["heat", "Unsafe heaters, candles or smoking evident", "yes"],
      ["win", "Escape window", "sel", ["Not relied on", "Suitable", "Not suitable"], ["Not suitable"]]
    ]},
    { k: "sample", label: "Intrusive sample", sec: 6, front: true, when: "intrusive", fields: [
      ["loc", "Location opened", "text"],
      ["el", "Element", "sel", ["Wall", "Floor", "Ceiling", "Riser", "Above door", "Roof void"]],
      ["find", "Finding", "sel", ["Adequate", "Gaps / missing fire stopping", "Cavity barrier missing", "Combustible materials found", "Below expected fire resistance"], ["Gaps / missing fire stopping", "Cavity barrier missing", "Combustible materials found", "Below expected fire resistance"]],
      ["made", "Made good after inspection", "yn"]
    ]},
    { k: "extstair", label: "External escape stair", sec: 5, fields: [
      ["loc", "Location", "text"],
      ["cond", "Structure sound; treads, handrails and guarding secure", "yn"],
      ["clear", "Clear of obstructions, ice and slip hazards", "yn"],
      ["open", "Windows and doors next to the stair would not expose users to fire, or are fire-resisting", "yn"],
      ["exit", "Leads to a place of safety", "yn"],
      ["lit", "Lit for use at night", "yn"]
    ]},
    { k: "lift", label: "Lift", sec: 9, fields: [
      ["loc", "Lift / location", "text"],
      ["type", "Type", "sel", ["Passenger", "Firefighting", "Evacuation", "Platform / stair lift"]],
      ["shaft", "Lift shaft and doors maintain the protected route", "yn"],
      ["notice", "Fire notice: do not use in a fire (unless an evacuation or firefighting lift)", "yn"],
      ["service", "Thorough examination and service in date", "yn"],
      ["switch", "Firefighting or evacuation controls work (where fitted)", "yn"]
    ]},
    { k: "hold", label: "Hold-open / locks", sec: 6, nonHousing: true, fields: [
      ["dev", "Device", "sel", ["Magnetic hold-open", "Free-swing closer", "Electronic lock", "Fire shutter", "Fire curtain"]],
      ["linked", "Linked to the fire alarm (BS 7273)", "yn"], ["rel", "Releases on alarm", "yn"]
    ]},
    { k: "refuge", label: "Refuge / disabled escape", sec: 5, nonHousing: true, fields: [
      ["loc", "Location", "text"], ["comm", "Two-way communication working", "yn"], ["sign", "Protected and signed", "yn"]
    ]}
  ],

  /* Benchmarks for the selected HMO sub-type. Sources: LACORS case studies D4-D9 and Tables C4/C5,
     BS 5839-6:2019+A1:2020 Table 1 and footnotes, higher of the two applied. */
  benchmark(s) {
    const storeys = parseInt(s.storeys, 10) || 0;
    const occ = Number(s.occupants) || 0;
    const big = s.over200 === "Yes";
    const type = s.occType || "";
    const shared = type.startsWith("Shared house");
    const sharedSmall = shared && occ > 0 && occ <= 6;
    const small = storeys <= 2 && !big;
    const out = { lines: [], travelRef: 9, mcp: "", notes: [] };
    if (shared && !occ) out.notes.push("Occupants not entered: the higher (HMO) benchmark is used until you enter it.");
    if (!storeys || !type) {
      out.lines.push(["Benchmarks", "Enter occupation type and storeys on the Setup screen."]);
      return out;
    }
    let det, esc, el;
    if (sharedSmall) {
      if (storeys <= 3) det = "Grade D1, LD2: smoke in escape route at every level, heat in kitchen, smoke in lounge and any cellar (interlinked).";
      else if (storeys === 4) det = big ? "Grade A, LD1 (BS 5839-6 Table 1: rented 4+ storey house with a floor over 200 m²)." : "Grade D1, LD1: detection in all rooms except bathrooms (BS 5839-6 Table 1, rented 4+ storey house).";
      else det = "Grade A, LD1 (higher of LACORS Grade A LD2 and BS 5839-6 LD1).";
      if (storeys <= 2) esc = "No full 30-min route needed if sound traditional construction and route not through risk rooms; close-fitting doors, or escape windows (LACORS D4).";
      else if (storeys <= 4) esc = "30-min protected route, FD30 doors to risk rooms, smoke seals not required (LACORS D5). Low-risk 3-storey: 20-min existing construction with solid self-closing doors may be accepted.";
      else if (storeys === 5) esc = "30-min protected route, FD30S with smoke seals to all risk rooms; lobby protection to all floors except the top floor, or secondary escape from the top floor; lateral fire separation of the top floor from the rest of the house (LACORS D6).";
      else esc = "30-min protected route, FD30S with smoke seals to all risk rooms; lobby protection to all floors except the top floor AND secondary escape from the top two floors; lateral fire separation of the top two floors from the rest of the house (LACORS D6).";
    } else {
      if (shared) out.notes.push("Shared house with more than six occupants: BS 5839-6 treats it as an HMO, so HMO benchmarks apply.");
      if (small) det = "Grade D1, LD2 for the whole HMO; LACORS mixed system: interlinked common parts, heat alarm in each bedsit with cooking, separate smoke alarm in each bedsit.";
      else det = "Mixed system: communal areas Grade A, LD2 sited to BS 5839-1 Category L2 (heat in communal kitchens, heat or smoke in lounges); bedsits with cooking D1, LD1 with heat or multi-sensor; bedsits without cooking D1, LD1; units of two or more rooms D1, LD2 (BS 5839-6 Table 1). LACORS mixed systems use a separate non-interlinked smoke alarm in each bedsit.";
      if (storeys <= 2) esc = "30-min protected route, FD30S to all risk rooms; escape windows from all bedsits may be accepted in normal-risk 2-storey (LACORS D7).";
      else if (storeys <= 4) esc = "30-min protected route, FD30S to all risk rooms; travel not excessive (LACORS D8).";
      else esc = (storeys === 5 ? "30-min protected route, FD30S to all risk rooms; lobby protection to all floors except the top floor, or secondary escape from the top floor" : "30-min protected route, FD30S to all risk rooms; lobby protection to all floors except the top floor AND secondary escape from the top two floors") + "; 30-min separation between units throughout, and across the stair between the second and third and the fourth and fifth floors (LACORS D9).";
    }
    if (type.startsWith("Supported")) {
      const beds = Number(s.bedrooms) || 0;
      det = storeys >= 2 && (beds > 4 || !beds) ? "Grade A, LD1 (BS 5839-6 Table 1: supported housing of two or more storeys with more than four bedrooms)." : "Grade D1, LD1 (BS 5839-6 Table 1: supported housing, single storey or not more than four bedrooms).";
      if (!beds && storeys >= 2) out.notes.push("Bedrooms not entered: the higher supported-housing benchmark is used.");
      out.notes.push("Supported housing: record staffing levels and residents' ability to respond and evacuate (BS 9792 12.1a; NFCC Fire safety in specialised housing).");
    }
    if (storeys <= 2) el = "Conventional lighting; emergency lighting only if the route is long, complex or lacks borrowed light.";
    else if (storeys <= 4) el = "Emergency lighting may be appropriate if the route is long or complex, or lacks borrowed light.";
    else el = storeys >= 7 ? "Emergency escape lighting expected (LACORS recommends it for all HMOs of five or six storeys)." : "Emergency escape lighting recommended (all HMOs of five or six storeys).";
    const mcpNeeded = !(sharedSmall || small);
    out.mcp = sharedSmall && storeys >= 5 ? "Consider: very large shared houses (normally four or more storeys above the ground floor) need call points if a shouted warning would not be heard by everyone (BS 5839-6 18.2a)." : mcpNeeded ? "Required: at storey exits and final exits, max 45 m travel, 1.2 m high (BS 5839-6 18.2)." :
      "Not required for this HMO type (BS 5839-6 18.2b).";
    if (type === "Flat in multiple occupation") {
      det = "Grade D1, LD2 (BS 5839-6 Table 1, existing HMO of one or two storeys), which is higher than LACORS D13/D14 (Grade D, LD3: interlinked smoke alarms in the flat's hallway or escape route at each level, heat alarm in the kitchen, smoke alarm in any communal lounge).";
      esc = storeys <= 1 ? "No full 30-min protected route needed within the flat, but sound traditional construction, a route not through risk rooms and sound close-fitting doors; FD30S flat entrance door; travel not excessive (LACORS D13)."
        : "No full 30-min protected route needed within the flat, but sound traditional construction, a route not through risk rooms and sound close-fitting doors; FD30S flat entrance door; travel not excessive (LACORS D14).";
      if (storeys > 2) out.notes.push("LACORS D13/D14 cover flats in multiple occupation on one or two storeys. Over two storeys, assess as a bedsit-type HMO of the same height.");
      out.notes.push("Flat in multiple occupation: the block's common parts are the freeholder's responsibility; co-operate with that Responsible Person.");
    }
    if (type.startsWith("Owner-occupied")) {
      det = (storeys <= 2 ? (big ? "Grade D2, LD3" : "Grade F2, LD3") : storeys === 3 ? (big ? "Grade D2, LD2" : "Grade F2, LD2") : (big ? "Grade A, LD2" : "Grade D2, LD2"))
        + " (BS 5839-6 Table 1, existing owner-occupied house; note C includes lodgers). Mains-powered interlinked alarms (D1/D2, LD2) are better practice.";
      el = "Conventional lighting; emergency lighting is not normally expected in a single-family dwelling.";
      out.mcp = "Not required (single-family dwelling; BS 5839-6 18.2a only for very large houses).";
      esc = "Single-family dwelling standards apply; advise on a safe route, escape windows from upper rooms and interlinked alarms.";
      out.notes.push("Owner-occupied house with lodgers: normally outside the HMO definition and the Fire Safety Order. The assessment is advice to the owner.");
    }
    if (storeys >= 7) out.notes.push("LACORS case studies stop at six storeys. For seven or more, assess against BS 9792 with reference to Approved Document B and record the basis; Grade A detection and emergency lighting are expected.");
    if (/^Supported/.test(type) && /Grade A/.test(det)) out.mcp = "Consider manual call points with a Grade A system (BS 5839-6 18.2a, Note 1).";
    out.lines.push(["Detection", det], ["Escape route", esc], ["Emergency lighting", el],
      ["Manual call points", out.mcp],
      ["Travel distance", "No fixed maximum. 9 m from a room exit to a place of relative safety is the reference; over 9 m is flagged to justify or act (LACORS 9.11)."],
      ["Firefighting", "Fire blanket in each shared kitchen and bedsit with cooking; multi-purpose extinguisher on each floor of the common parts recommended."]);
    if (s.basement === "Yes") out.lines.push(["Cellar / basement", sharedSmall && storeys <= 2
      ? "Ideally 30-min separation between the basement and ground floor with a 30-min door at the head of the basement stairs; in a low-risk shared house of no more than two other storeys, sound existing construction and solid self-closing doors may be accepted (LACORS 10.2-10.3). Habitable basement: separate exit, escape windows or a 30-min route (LACORS 10.6)."
      : "Full 30-min separation between the basement and ground floor, with a self-closing FD30S door at the head of the basement stairs (LACORS 10.4). Habitable basement: separate exit, escape windows to all habitable rooms, or a 30-min protected route to the ground floor (LACORS 10.6)."]);
    if (s.nonres === "Yes") out.lines.push(["Non-residential use", "Generally 60-min imperforate separation between the two uses; 30 min may be accepted for lower-risk premises with automatic detection in the commercial part linked to the residential system (LACORS 31.2)."]);
    return out;
  }
};

/* Shop or other non-residential use in the same building: extra checks when setup.nonres is Yes. */
const NONRES_GROUPS = {
  6: ["Non-residential part of the building", [
    "Fire-resisting separation between the non-residential part and the residential part is intact, with no unprotected openings.",
    "The residential escape route does not pass through, or open into, the non-residential part.",
    "Services and voids passing between the two parts are fire stopped."], "nonres"],
  7: ["Non-residential part of the building", [
    "Fire in the non-residential part will be detected and residents warned where separation does not make this unnecessary."], "nonres"],
  10: ["Non-residential part of the building", [
    "The Responsible Persons (or landlord and the occupier of the non-residential part) co-operate and co-ordinate fire safety measures (Fire Safety Order article 22 where the Order applies).",
    "The non-residential part has its own fire risk assessment (PAS 79-1) and shares relevant findings.",
    "Out-of-hours security and arson risk of the non-residential part are managed."], "nonres"]
};
function addNonres(prof) { prof.sections.forEach((s) => { if (NONRES_GROUPS[s.n]) s.groups.push(NONRES_GROUPS[s.n]); }); }
addNonres(PROFILE_HMO);
const PROFILES = { hmo: PROFILE_HMO };
