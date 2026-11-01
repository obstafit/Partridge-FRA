"""Partridge Fire Safety - Two-Flat Common Parts FRA template, v2.

Regenerates sections 2-9 of the two-flat template (pages 3-7 of v1) with six extra checks,
keeping every original field name, then splices them between the original cover/Section 1
pages and the original risk / action plan / photos / declaration / appendix pages, so the
photo buttons and signature fields are untouched.

New checks: 3.11-3.13 (arson, external bins, smoking), 6.4 (letter plates), 6.5 (routine
fire door and common-area checks), 7.11 (fire action notice / information for occupants).

Usage: python3 build_two_flat_sections.py TEMPLATE_V1.pdf OUTPUT.pdf
"""
import sys, os
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.colors import white
import build_hmo_template as H
from build_hmo_template import (Builder, DARK, ORANGE, ORANGE_TXT, FIELD, FIELD_LINE, BAND, RULE, TEXT, MUTED,
                                M, FOOT_Y, fix_radios)

TITLE = "Fire Risk Assessment  |  Common Parts  |  Two-Flat House Conversion"
FOOT = ("Regulatory Reform (Fire Safety) Order 2005  |  Methodology: BS 9792:2025  |  "
        "Common parts only - excludes the internal demise of each dwelling")
YNA = ["-", "Yes", "No", "N/A"]


class TwoFlat(Builder):
    def __init__(self, path, total, first_page):
        super().__init__(path, total)
        self.c.setTitle("Fire Risk Assessment - Common Parts - Two-Flat House Conversion")
        self.page = first_page - 1
        self.started = False

    def _header(self):
        c = self.c
        c.setFillColor(DARK); c.rect(0, self.H - H.HEADER_H, self.W, H.HEADER_H, stroke=0, fill=1)
        c.setFillColor(ORANGE); c.rect(0, self.H - H.HEADER_H - 3.5, self.W, 3.5, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 10)
        c.drawString(M, self.H - 21, TITLE)

    def _footer(self):
        c = self.c
        c.setStrokeColor(RULE); c.setLineWidth(0.6)
        c.line(M, FOOT_Y + 12, self.W - M, FOOT_Y + 12)
        c.setFont("Helvetica", 6.8); c.setFillColor(MUTED)
        c.drawString(M, FOOT_Y, FOOT)
        c.drawRightString(self.W - M, FOOT_Y, f"Page {self.page} of {self.total}")

    def new_page(self, land=False, header=True):
        if self.started:
            self._footer(); self.c.showPage()
        self.started = True
        self.landscape = land
        self.c.setPageSize(H.landscape(H.A4) if land else H.A4)
        self.page += 1
        if header:
            self._header()
        self.y = self.H - H.HEADER_H - 3.5 - 18

    def section(self, num, title):
        self.ensure(170)  # keep a section heading with its opening content
        super().section(num, title)

    def choice(self, name, options, x, y, w, h, value):
        self.c.acroForm.choice(name=self.nm(name), value=value, options=options, x=x, y=y, width=w, height=h,
                               borderColor=FIELD_LINE, fillColor=FIELD, textColor=TEXT, borderWidth=0.7,
                               fontName="Helvetica", fontSize=7.5, fieldFlags="combo", forceBorder=True)

    # Yes / No / N/A checklist with the v1 field names: s{sec}_{nn}_check and s{sec}_{nn}_obs
    def checks(self, sec, groups, start=1):
        cw = self.CW; c = self.c
        obs_w = cw * 0.36; chk_w = cw - 28 - 72 - obs_w

        def head():
            self.ensure(80)
            c.setFillColor(DARK); c.rect(M, self.y - 14, cw, 14, stroke=0, fill=1)
            c.setFillColor(white); c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(M + 14, self.y - 9.5, "Ref")
            c.drawCentredString(M + 28 + chk_w / 2, self.y - 9.5, "Check (Yes = satisfactory)")
            x = M + 28 + chk_w
            for t in ("Yes", "No", "N/A"):
                c.drawCentredString(x + 12, self.y - 9.5, t); x += 24
            c.drawCentredString(x + obs_w / 2, self.y - 9.5, "Observations / evidence")
            self.y -= 14

        head(); n = start - 1
        for gtitle, items in groups:
            if gtitle:
                if self.y - 40 < FOOT_Y + 24:
                    self.new_page(); head()
                c.setFillColor(BAND); c.rect(M, self.y - 13, cw, 13, stroke=0, fill=1)
                c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7)
                c.drawString(M + 5, self.y - 9, gtitle)
                self.y -= 13
            for item in items:
                n += 1
                th = self.para_h(item, chk_w - 10, 7.2); rh = max(24, th + 10)
                if self.y - rh < FOOT_Y + 24:
                    self.new_page(); head()
                top = self.y
                c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - rh, M + cw, top - rh)
                c.setFont("Helvetica-Bold", 7.2); c.setFillColor(TEXT)
                c.drawCentredString(M + 14, top - rh / 2 - 2.5, f"{sec}.{n}")
                self.draw_para(item, M + 32, top - (rh - th) / 2, chk_w - 10, 7.2)
                x = M + 28 + chk_w
                for v in ("Yes", "No", "NA"):
                    self.radio(f"s{sec}_{n:02d}_check", v, x + 7.5, top - rh / 2 - 4.5, 9); x += 24
                self.text(f"s{sec}_{n:02d}_obs", x + 3, top - rh + 3, obs_w - 4, rh - 6, multiline=True, size=7)
                self.y -= rh
        self.y -= 6
        return n

    def concl(self, sec):
        self.ensure(26); c = self.c
        c.setFillColor(BAND); c.rect(M, self.y - 20, self.CW, 20, stroke=0, fill=1)
        c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7.6); c.drawString(M + 6, self.y - 13, "Section conclusion")
        x = M + 92
        for lab, val in (("Satisfactory", "Satisfactory"), ("Action required", "ActionRequired"), ("Not applicable", "NotApplicable")):
            self.radio(f"s{sec}_conclusion", val, x, self.y - 15, 9)
            c.setFont("Helvetica", 7.4); c.setFillColor(TEXT); c.drawString(x + 12, self.y - 12.5, lab)
            x += 24 + stringWidth(lab, "Helvetica", 7.4) + 6
        c.setFont("Helvetica", 7); c.setFillColor(MUTED); c.drawString(x + 8, self.y - 12.5, "Action plan ref(s)")
        self.text(f"s{sec}_actionrefs", x + 72, self.y - 17, M + self.CW - (x + 72) - 4, 14)
        self.y -= 28

    def radio_row(self, label, group, opts, label_w=150, extra=None):
        """opts: [(label, value)]. extra: (label, name) for a text field to the right."""
        self.ensure(22); c = self.c
        c.setFont("Helvetica-Bold", 7.6); c.setFillColor(TEXT); c.drawString(M, self.y - 9, label)
        x = M + label_w
        for lab, val in opts:
            self.radio(group, val, x, self.y - 12, 9)
            c.setFont("Helvetica", 7.6); c.setFillColor(TEXT); c.drawString(x + 12, self.y - 9, lab)
            x += 26 + stringWidth(lab, "Helvetica", 7.6)
        if extra:
            lab, name = extra
            c.setFont("Helvetica", 6.6); c.setFillColor(MUTED); c.drawString(x + 4, self.y - 2, lab)
            self.text(name, x + 4, self.y - 16, M + self.CW - x - 4, 13)
        self.y -= 22

    def box_field(self, label, name, h):
        self.note_box(name, label, h)


def bold_lead(lead, rest):
    return f"<b>{lead}</b> {rest}"


def build(path, total, first_page=3):
    b = TwoFlat(path, total, first_page)
    c = b.c
    b.new_page()

    # ---------------- 2 LIMITATIONS AND LIABILITY ----------------
    b.section(2, "Limitations and liability")
    b.para(bold_lead("2.1 Basis of the assessment.", "This assessment reflects the conditions observed on the date of the visit recorded in Section 1. It is based on a visual, non-intrusive inspection. Fire safety conditions can change after that date."))
    b.para(bold_lead("2.2 Scope.", "The assessment is limited to the common parts as defined in this document and excludes the internal demise of each dwelling. It also excludes areas that were not accessible at the time of the assessment, which are listed below. No comment is made on the condition of those areas."))
    b.box_field("Areas not accessible or not inspected at the time of the assessment", "lim_noaccess", 36)
    b.subhead("Documents provided by the Responsible Person")
    docs = ["Rent Smart Wales registration / licence (landlord or agent)", "Building control completion certificate for the conversion",
            "EICR - common parts and intake supplies", "Electrical installation certificate(s) for the conversion works",
            "Gas safety record (if gas serves the common area)", "Fire alarm installation certificate (BS 5839-6)",
            "Emergency lighting certificate (BS 5266-1)", "Fire door certification", "Fire suppression system certificate (if installed)",
            "Previous fire risk assessment and action plan", None]
    cw = b.CW; dw, sw = cw * 0.44, cw * 0.27; rw = cw - dw - sw; rh = 16
    b.ensure(16 + rh * len(docs))
    c.setFillColor(DARK); c.rect(M, b.y - 15, cw, 15, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(M + dw / 2, b.y - 10, "Document"); c.drawCentredString(M + dw + sw / 2, b.y - 10, "Status")
    c.drawCentredString(M + dw + sw + rw / 2, b.y - 10, "Date or reference"); b.y -= 15
    for i, dname in enumerate(docs, 1):
        top = b.y
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - rh, M + cw, top - rh)
        if dname:
            c.setFont("Helvetica", 7.2); c.setFillColor(TEXT); c.drawString(M + 4, top - 10.5, dname)
        else:
            b.text("docs_other_name", M + 2, top - rh + 2.5, dw - 6, rh - 5, size=7)
        x = M + dw + 4
        for lab, val in (("Sighted", "Sighted"), ("Not sighted", "NotSighted"), ("N/A", "NA")):
            b.radio(f"docs_{i:02d}_status", val, x, top - 12.5, 8)
            c.setFont("Helvetica", 6.8); c.setFillColor(TEXT); c.drawString(x + 10.5, top - 10.5, lab)
            x += 18 + stringWidth(lab, "Helvetica", 6.8)
        b.text(f"docs_{i:02d}_ref", M + dw + sw + 2, top - rh + 2.5, rw - 4, rh - 5, size=7)
        b.y -= rh
    b.y -= 6
    b.para("Documents are recorded as sighted only. Their validity, completeness and compliance have not been verified by the assessor.", 6.8, italic=True, color=MUTED, gap=4)
    b.box_field("Other documents or information provided (or stated as not available)", "lim_docs", 26)
    b.para(bold_lead("2.3 Responsibility.", "Overall responsibility for fire safety at the premises rests with the Responsible Person under the Regulatory Reform (Fire Safety) Order 2005. The assessor's role is limited to identifying and reporting findings based on the visual inspection carried out."))
    b.para(bold_lead("2.4 Liability.", "The assessor accepts no liability for: (a) fire safety failures at the premises; (b) management decisions; (c) works carried out by others after the date of the assessment; or (d) non-implementation of the recommendations by the Responsible Person."))
    b.ensure(18); b.check("lim_explained", M, b.y - 11, 9)
    c.setFont("Helvetica", 7.6); c.setFillColor(TEXT)
    c.drawString(M + 14, b.y - 8.5, "Scope and limitations explained to the person(s) present and to each Responsible Person on receipt of the report")
    b.y -= 20

    # ---------------- 3 FIRE HAZARDS ----------------
    b.section(3, "Fire hazards - common area")
    b.para("This section is limited to storage, meters and electrical intake equipment, arson and smoking in and around the common area. Hazards inside each dwelling are outside the scope of this assessment. The likelihood of fire is rated in Section 10.")
    b.checks(3, [
        ("Storage in the common parts", [
            "Common parts are kept free of stored combustible items (boxes, furniture, clothing, bedding and similar).",
            "Cycles, prams, mobility scooters and similar items are not stored in the escape route.",
            "E-bikes, e-scooters and lithium-ion batteries are not stored or charged in the common parts.",
            "Waste, recycling and refuse are not kept in the common parts (or are in a suitable external or enclosed store).",
            "Cupboards opening onto the common parts (including under the stairs) are not used to store combustibles, or are fire-resisting and kept closed."]),
        ("Meters and electrical intake equipment in the common area", [
            "Gas and electricity meters, consumer units and intake equipment in the common parts are enclosed with a close-fitting door or cover.",
            "Where meters or intake equipment are in, or open onto, the escape route, the enclosure is fire-resisting (typically 30 minutes) and kept closed.",
            "Meters and intake equipment show no visible damage, scorching or overheating, exposed conductors or unprotected cabling.",
            "Nothing is stored in, on top of, or against meter cupboards and intake equipment.",
            "Gas and electricity isolation points are accessible and clearly identified."]),
        ("Arson and smoking", [
            "The entrance door is kept secure, and the letter box (if fitted) does not create an arson risk to the hall (for example an anti-arson letter box or internal cage where the risk is higher).",
            "Bins, recycling and other combustibles outside are kept away from the building, its doors and windows.",
            "There is no evidence of smoking in the common parts."]),
    ])
    b.box_field("Further comments on common-area hazards", "s3_comments", 30)
    b.concl(3)

    # ---------------- 4 PEOPLE AT RISK ----------------
    b.section(4, "People at risk")
    b.para("Limited to the occupants of both flats and their visitors. Information is as disclosed by the Responsible Person; the flats themselves are not inspected.")
    cols = [("Group", 1.6), ("Approx. number", 0.8), ("Asleep (night use)", 0.7), ("Reduced mobility", 0.7), ("Hearing or vision impairment", 0.8),
            ("Children (under 16)", 0.7), ("Unfamiliar with building", 0.8), ("Notes", 2.4)]
    tot = sum(w for _, w in cols); ws = [cw * w / tot for _, w in cols]; rh = 24; hh = 26
    b.ensure(hh + 3 * rh + 10)
    c.setFillColor(DARK); c.rect(M, b.y - hh, cw, hh, stroke=0, fill=1)
    x = M
    for (hd, _), w in zip(cols, ws):
        ph = b.para_h(hd, w - 4, 6.8, True); b.draw_para(hd, x + 2, b.y - (hh - ph) / 2, w - 4, 6.8, True, white, align=1); x += w
    b.y -= hh
    for r, lab in enumerate(["Occupants of Flat 1", "Occupants of Flat 2", "Visitors (guests, carers, trades)"], 1):
        top = b.y; c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - rh, M + cw, top - rh)
        b.draw_para(lab, M + 4, top - (rh - b.para_h(lab, ws[0] - 8, 7.2, True)) / 2, ws[0] - 8, 7.2, True)
        x = M + ws[0]
        b.text(f"people_{r}_num", x + 3, top - rh + 4, ws[1] - 6, rh - 8, size=8); x += ws[1]
        for k in range(1, 6):
            b.check(f"people_{r}_f{k}", x + ws[1 + k] / 2 - 4.5, top - rh / 2 - 4.5, 9); x += ws[1 + k]
        b.text(f"people_{r}_notes", x + 3, top - rh + 3, ws[7] - 6, rh - 6, multiline=True, size=7)
        b.y -= rh
    b.y -= 8
    b.radio_row("Occupants known to need assistance to leave the building", "s4_assist", [("Yes", "Yes"), ("No", "No"), ("Not known", "Unknown")], 230,
                ("Details disclosed (if any)", "s4_assist_notes"))
    b.concl(4)

    # ---------------- 5 STRUCTURAL SEPARATION ----------------
    b.section(5, "Structural separation between the two flats")
    b.para("Standards: compartmentation between Flat 1 and Flat 2 is assessed against BS 9999 or Approved Document B Volume 1 (Wales), as applicable to the conversion.")
    b.radio_row("Guidance applied", "s5_guidance", [("BS 9999", "BS9999"), ("Approved Document B Volume 1 (Wales)", "ADBVol1"), ("Other", "Other")], 80,
                ("Edition / amendments", "s5_edition"))
    n = b.checks(5, [
        ("Conversion records and evidence of integrity", [
            "Building Regulations approval and completion records for the conversion, including the fire separation design, have been sighted.",
            "Evidence of the integrity of the separating construction is available (design or building control records, previous survey, fire-stopping certificates, or visual inspection)."]),
        ("Separating construction - visual, non-intrusive", [
            "The separating floor between the flats shows no visible gaps, damage or openings where it meets walls (as seen from the common parts).",
            "Ceilings and soffits in the common parts, including the underside of the stairs, are continuous and undamaged.",
            "Walls and partitions between the common parts and each flat are intact, run to floor and ceiling, and show no unsealed gaps.",
            "Service penetrations (pipes, cables, ducts) through the separating construction are visibly fire-stopped.",
            "There are no recessed downlights, loft hatches or other openings in the common-part ceilings that compromise fire separation (unless fire-resisting).",
            "Where there is a pitched roof, the roof void above the common parts has been inspected (or the reason for non-access is recorded).",
            "Any glazing or vision panels in separating construction are fire-resisting.",
            "No alterations since the conversion that could affect fire separation are apparent."]),
    ])
    b.fields([("Fire resistance period required (minutes) and source", 1, "s5_period_req"), ("Period evidenced or observed", 1, "s5_period_obs")])
    b.radio_row("Reason to suspect deficiencies in the separating construction", "s5_type2",
                [("Yes - recommend a Type 2 FRA or specialist survey", "Yes"), ("No", "No")], 230)
    b.callout("FLAG - REGULATION 37A (WELSH BUILDING REGULATIONS)",
              "Regulation 37A of the Building Regulations 2010, as it applies in Wales, may require an automatic fire suppression system because the conversion to two flats is a material change of use. This should be confirmed with building control. The assessor records the evidence seen only; compliance with the Building Regulations is determined by building control. Any installation inside the flats is outside the scope of this common parts assessment.")
    b.checks(5, [("Regulation 37A - automatic fire suppression (evidence only)", [
        "The conversion to two flats is confirmed as a material change of use (from the Responsible Person or building control records).",
        "Evidence has been sighted that automatic fire suppression was provided (BS 9251 or BS 8458 certificate), or that Regulation 37A was considered and not required (building control confirmation).",
        "Where a suppression system is installed, maintenance and servicing records have been sighted."])], start=n + 1)
    b.box_field("Evidence sighted / suppression determination (describe), or action needed", "s5_37a_evidence", 30)
    b.concl(5)

    # ---------------- 6 FIRE DOORS ----------------
    b.section(6, "Fire doors onto the common parts")
    b.callout("STANDARD - FD30S SELF-CLOSING FIRE DOORS",
              "Doors from each flat (and any shared cupboard or meter enclosure) onto the common parts should be <b>FD30S</b>: 30 minutes fire resistance with smoke control, self-closing. Fire resistance is demonstrated by testing to <b>BS EN 1634</b> (Part 1 for fire resistance, Part 3 for smoke leakage). Self-closing devices must conform to <b>BS EN 1154</b>; hinges to BS EN 1935; fire door assemblies are installed and maintained in line with BS 8214.")
    cols = [("Door", 1.7), ("FD30S rating evidenced", 0.62), ("Smoke seals fitted", 0.62), ("Self-closer fitted (BS EN 1154)", 0.62), ("Closes and latches fully", 0.62),
            ("Three hinges (BS EN 1935)", 0.62), ("Gaps within tolerance", 0.62), ("Leaf, glazing and frame sound", 0.62), ("Comments", 2.0)]
    tot = sum(w for _, w in cols); ws = [cw * w / tot for _, w in cols]; rh = 20; hh = 34
    b.ensure(hh + 5 * rh + 10)
    c.setFillColor(DARK); c.rect(M, b.y - hh, cw, hh, stroke=0, fill=1)
    x = M
    for (hd, _), w in zip(cols, ws):
        ph = b.para_h(hd, w - 4, 6.6, True); b.draw_para(hd, x + 2, b.y - (hh - ph) / 2, w - 4, 6.6, True, white, align=1); x += w
    b.y -= hh
    for r, lab in enumerate(["Flat 1 entrance door", "Flat 2 entrance door", "Meter / shared cupboard door", "Other (specify)", "Other (specify)"], 1):
        top = b.y; c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - rh, M + cw, top - rh)
        x = M
        b.text(f"doors_{r}_loc", x + 2, top - rh + 3, ws[0] - 4, rh - 6, size=7, value=lab); x += ws[0]
        for k in range(1, 8):
            b.choice(f"doors_{r}_c{k}", YNA, x + 2, top - rh + 3, ws[k] - 4, rh - 6, "-"); x += ws[k]
        b.text(f"doors_{r}_comment", x + 2, top - rh + 3, ws[8] - 4, rh - 6, size=7)
        b.y -= rh
    b.y -= 8
    b.checks(6, [(None, [
        "Fire door certification (third-party label, plug or documentary evidence) has been sighted for each flat entrance door.",
        "No fire door is wedged open, or has its self-closing device removed or disabled.",
        "Fire door signage (Fire door keep shut / Keep locked) is displayed on cupboards and enclosures where appropriate.",
        "Letter plates in the flat entrance doors (if fitted) are fire-rated and close fully, so they do not reduce the door's fire resistance.",
        "The Responsible Person has a routine of fire door and common-area checks, and the checks are recorded."])])
    b.concl(6)

    # ---------------- 7 MEANS OF ESCAPE ----------------
    b.section(7, "Means of escape through the shared area")
    b.radio_row("Evacuation strategy", "s7_evac", [("Simultaneous (interlinked alarm)", "Simultaneous"), ("Stay put", "StayPut"), ("Other", "Other")], 90,
                ("Notes", "s7_evac_notes"))
    cols = [("Escape route", 2.3), ("Travel distance (m)", 0.7), ("Benchmark (m)", 0.7), ("Benchmark source", 1.3), ("Within limit?", 0.7), ("Notes (state where measured to)", 2.0)]
    tot = sum(w for _, w in cols); ws = [cw * w / tot for _, w in cols]; rh = 20; hh = 24
    b.ensure(hh + 3 * rh + 10)
    c.setFillColor(DARK); c.rect(M, b.y - hh, cw, hh, stroke=0, fill=1)
    x = M
    for (hd, _), w in zip(cols, ws):
        ph = b.para_h(hd, w - 4, 6.8, True); b.draw_para(hd, x + 2, b.y - (hh - ph) / 2, w - 4, 6.8, True, white, align=1); x += w
    b.y -= hh
    for r, lab in enumerate(["Flat 1 entrance door to stair head / final exit", "Flat 2 entrance door to stair head / final exit", "Other (specify)"], 1):
        top = b.y; c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - rh, M + cw, top - rh)
        x = M
        b.text(f"route_{r}_name", x + 2, top - rh + 3, ws[0] - 4, rh - 6, size=7, value=lab); x += ws[0]
        for k, nm in ((1, "dist"), (2, "bench"), (3, "src")):
            b.text(f"route_{r}_{nm}", x + 2, top - rh + 3, ws[k] - 4, rh - 6, size=7); x += ws[k]
        b.choice(f"route_{r}_ok", YNA, x + 2, top - rh + 3, ws[4] - 4, rh - 6, "-"); x += ws[4]
        b.text(f"route_{r}_notes", x + 2, top - rh + 3, ws[5] - 4, rh - 6, size=7)
        b.y -= rh
    b.y -= 8
    b.checks(7, [
        ("Common escape route", [
            "The common escape route is clear of obstructions and storage along its full length.",
            "Stairs, landings, handrails and floor coverings are in sound condition, with no trip hazards.",
            "Escape from each flat leads to the final exit without passing through the other flat or through a room.",
            "Flat entrance doors can be opened from the inside without a key (for example a thumb-turn).",
            "Wall and ceiling linings in the common parts show no obvious rapid flame-spread risk (for example polystyrene tiles or exposed foam)."]),
        ("Final exit", [
            "The final exit door opens easily in the direction of escape.",
            "The final exit can be opened from the inside without a key, using a single fastening (for example a thumb-turn).",
            "The final exit leads directly to a place of safety (street or open space), not into an enclosed or locked area.",
            "The threshold, any step and the external route from the final exit are safe and unobstructed (bins, cycles, vehicles).",
            "Security fittings (entry system, additional bolts, chains) do not hinder escape."]),
        ("Fire safety information", [
            "A fire action notice or written fire safety information tells the occupants what to do in a fire, consistent with the evacuation strategy."]),
    ])
    b.fields([("Final exit clear width (mm)", 0.8, "s7_exit_width"), ("Final exit door and lock type", 1.2, "s7_exit_type"),
              ("Description of external route to place of safety", 2, "s7_exit_desc")])
    b.concl(7)

    # ---------------- 8 EMERGENCY LIGHTING ----------------
    b.section(8, "Emergency lighting")
    b.para("<b>Standard: BS 5266-1.</b> Emergency lighting is expected on the common escape route where there is no borrowed natural light. Borrowed light is not available after dark, so also consider whether loss of the normal lighting would leave any part of the route in darkness.")
    b.checks(8, [(None, [
        "Borrowed natural light is sufficient to see the whole common escape route (stairs, landings and final exit) in daylight.",
        "Where borrowed natural light is not sufficient, emergency lighting is provided on the common escape route.",
        "Luminaires are sited at stairs and changes of level, changes of direction, landings and the final exit.",
        "The lighting appears to give at least the BS 5266-1 minimum illumination along the centre line of the route (1 lux).",
        "Luminaires are in good condition and charge indicators show normal operation.",
        "A commissioning or installation certificate and testing records (BS 5266-1) have been sighted."])])
    b.fields([("Type provided (maintained / non-maintained, self-contained)", 1.4, "s8_type"), ("Lux reading (if measured)", 0.8, "s8_lux"),
              ("Night-time conditions: assessor note", 1.6, "s8_night")])
    b.concl(8)

    # ---------------- 9 FIRE DETECTION ----------------
    b.section(9, "Fire detection and alarm")
    b.para("<b>Standard: BS 5839-6</b> (fire detection and fire alarm systems for domestic premises). Interlinked detection is expected between the two flats and the common parts. Detection inside the flats is not inspected; findings reflect what is observed in the common parts and what the Responsible Person or installer evidence confirms.")
    b.fields([("Grade and category (BS 5839-6, e.g. D1 / LD2)", 1.2, "s9_grade"), ("Edition applied", 0.8, "s9_edition"), ("How interlinking was confirmed", 1.6, "s9_how")])
    b.checks(9, [(None, [
        "Fire detection is provided in the common parts (hall, stairs and landings).",
        "Detection is interlinked between Flat 1, Flat 2 and the common parts, so that activation in any one area sounds the alarm in all.",
        "Interlinking has been confirmed by a witnessed test, installer certificate or the Responsible Person's statement (see below).",
        "Alarms are audible throughout the common parts and in both flats (as confirmed by the Responsible Person or occupants).",
        "Detectors are mains-powered with a standby supply, as appropriate to the grade of system.",
        "Detectors are in date, undamaged, unobstructed and not disabled or covered.",
        "An installation or commissioning certificate (BS 5839-6) has been sighted.",
        "Arrangements for regular testing and servicing are in place and known to the occupants."])])
    b.concl(9)
    b.finish()
    return b.page - first_page + 1


def splice(v1, built, out):
    """Original pages 1-2 + rebuilt sections + original pages 8-11; renumber every footer."""
    import pymupdf
    v = pymupdf.open(v1); new = pymupdf.open(built)
    total = 2 + new.page_count + (v.page_count - 7)
    # A fresh document avoids PyMuPDF renaming fields that clash with the removed pages' fields.
    src = pymupdf.open()
    src.insert_pdf(v, from_page=0, to_page=1)
    src.insert_pdf(new)
    v2 = pymupdf.open(v1)  # a second handle: PyMuPDF copies a source's form fields only once
    src.insert_pdf(v2, from_page=7, to_page=v2.page_count - 1)
    import re
    for p in src:  # signature fields can come across twice, once renamed "name [xref]": drop the renamed copies
        for w in list(p.widgets()):
            if re.search(r" \[\d+\]$", w.field_name or ""):
                p.delete_widget(w)
    for i, p in enumerate(src):
        for blk in p.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                for sp in ln["spans"]:
                    if sp["text"].startswith("Page ") and " of " in sp["text"] and sp["bbox"][1] > p.rect.height - 50:
                        r = pymupdf.Rect(sp["bbox"]); p.add_redact_annot(r + (-2, -1, 2, 1), fill=(1, 1, 1))
                        p.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
                        txt = f"Page {i + 1} of {total}"
                        w = pymupdf.get_text_length(txt, "helv", sp["size"])
                        p.insert_text((r.x1 - w, sp["origin"][1]), txt, fontname="helv", fontsize=sp["size"], color=(0.333, 0.333, 0.333))
    src.set_metadata({**v.metadata, "title": "Fire Risk Assessment - Common Parts - Two-Flat House Conversion (Short Form) v2",
                      "creator": "FRA template generator v2"})
    src.save(out, garbage=3, deflate=True)
    return total


if __name__ == "__main__":
    v1, out = sys.argv[1], sys.argv[2]
    tmp = out + ".sections.pdf"
    n = build(tmp, 99)
    total = 2 + n + 4
    build(tmp, total)
    fix_radios(tmp)
    t = splice(v1, tmp, out)
    os.remove(tmp)
    print("section pages:", n, "total pages:", t)
