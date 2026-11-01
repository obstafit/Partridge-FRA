"""Partridge Fire Safety - HMO Fire Risk Assessment fillable template (v3).

Styled to match the 4 Cottrell Road report: dark green bands, orange accent rule,
pale green field boxes, Yes/No/N/A checklists with observations, section conclusions.

Usage: python3 build_hmo_template.py OUTPUT.pdf
"""
import re
import sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth

DARK = HexColor("#1a2d1a")
ORANGE = HexColor("#e8640a")
ORANGE_TXT = HexColor("#a84300")
FIELD = HexColor("#f6f9f2")
FIELD_LINE = HexColor("#8fa58a")
BAND = HexColor("#e8efe4")
RULE = HexColor("#c9d6c4")
TEXT = HexColor("#111111")
MUTED = HexColor("#555555")
CALLOUT = HexColor("#fff2e8")
RISK = {"Trivial": "#e4efc3", "Tolerable": "#f3f6d8", "Moderate": "#fbe4a0",
        "Substantial": "#f4b57c", "Intolerable": "#e8640a"}

M = 42.5          # page margin
HEADER_H = 34
FOOT_Y = 26

def P(text, size=7.6, bold=False, color=TEXT, leading=None, italic=False, align=0):
    font = "Helvetica-Bold" if bold else ("Helvetica-Oblique" if italic else "Helvetica")
    return ParagraphStyle("x", fontName=font, fontSize=size, leading=leading or size * 1.32,
                          textColor=color, alignment=align), text


class Builder:
    def __init__(self, path, total_pages):
        self.c = canvas.Canvas(path, pagesize=A4)
        self.c.setTitle("HMO Fire Risk Assessment - Partridge Fire Safety")
        self.c.setAuthor("Partridge Fire Safety")
        self.total = total_pages
        self.page = 0
        self.landscape = False
        self.used = set()

    # ---------- page furniture ----------
    @property
    def W(self):
        return (landscape(A4) if self.landscape else A4)[0]

    @property
    def H(self):
        return (landscape(A4) if self.landscape else A4)[1]

    @property
    def CW(self):
        return self.W - 2 * M

    def _footer(self):
        c = self.c
        c.setStrokeColor(RULE); c.setLineWidth(0.6)
        c.line(M, FOOT_Y + 12, self.W - M, FOOT_Y + 12)
        c.setFont("Helvetica", 6.8); c.setFillColor(MUTED)
        c.drawString(M, FOOT_Y, "Regulatory Reform (Fire Safety) Order 2005  |  Housing Act 2004  |  "
                                "Methodology: BS 9792:2025  |  Partridge Fire Safety, Cardiff")
        c.drawRightString(self.W - M, FOOT_Y, f"Page {self.page} of {self.total}")

    def _header(self):
        c = self.c
        c.setFillColor(DARK); c.rect(0, self.H - HEADER_H, self.W, HEADER_H, stroke=0, fill=1)
        c.setFillColor(ORANGE); c.rect(0, self.H - HEADER_H - 3.5, self.W, 3.5, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 10)
        c.drawString(M, self.H - 21, "Fire Risk Assessment  |  House in Multiple Occupation  |  Partridge Fire Safety")

    def new_page(self, land=False, header=True):
        if self.page:
            self._footer()
            self.c.showPage()
        self.landscape = land
        self.c.setPageSize(landscape(A4) if land else A4)
        self.page += 1
        if header:
            self._header()
        self.y = self.H - HEADER_H - 3.5 - 18

    def ensure(self, h):
        if self.y - h < FOOT_Y + 24:
            self.new_page(self.landscape)

    def finish(self):
        self._footer()
        self.c.save()

    # ---------- unique field names ----------
    def nm(self, name):
        base, i = name, 2
        while name in self.used:
            name = f"{base}_{i}"; i += 1
        self.used.add(name)
        return name

    # ---------- form widgets ----------
    def text(self, name, x, y, w, h, multiline=None, size=None, value=""):
        multiline = h > 20 if multiline is None else multiline
        self.c.acroForm.textfield(
            name=self.nm(name), x=x, y=y, width=w, height=h, value=value,
            borderColor=FIELD_LINE, fillColor=FIELD, textColor=TEXT, borderWidth=0.7,
            fontName="Helvetica", fontSize=size if size is not None else (7.5 if multiline else 9),
            fieldFlags="multiline" if multiline else "", forceBorder=True)

    def combo(self, name, options, x, y, w, h=15, value="", size=8.5):
        # ReportLab cannot build a choice field with an empty value, so the blank option is a single space
        opts = [" "] + [o for o in options if o.strip()]
        self.c.acroForm.choice(
            name=self.nm(name), value=value or " ", options=opts, x=x, y=y, width=w, height=h,
            borderColor=FIELD_LINE, fillColor=FIELD, textColor=TEXT, borderWidth=0.7,
            fontName="Helvetica", fontSize=size, fieldFlags="combo", forceBorder=True)

    def radio(self, group, value, x, y, size=8):
        # radio export values become PDF names: keep them to letters, digits and underscores
        value = re.sub(r"[^A-Za-z0-9_]", "", value.replace(" ", "_")) or "opt"
        self.c.acroForm.radio(
            name=group, value=value, selected=False, x=x, y=y, size=size,
            buttonStyle="circle", shape="circle", borderColor=MUTED, fillColor=white,
            textColor=DARK, borderWidth=0.7, forceBorder=True)

    def check(self, name, x, y, size=8):
        self.c.acroForm.checkbox(
            name=self.nm(name), x=x, y=y, size=size, buttonStyle="check",
            borderColor=MUTED, fillColor=white, textColor=DARK, borderWidth=0.7, forceBorder=True)

    # ---------- text helpers ----------
    def para_h(self, text, w, size=7.6, bold=False, italic=False, leading=None):
        st, t = P(text, size, bold, italic=italic, leading=leading)
        p = Paragraph(t, st); _, h = p.wrap(w, 10000)
        return h

    def draw_para(self, text, x, top, w, size=7.6, bold=False, color=TEXT, italic=False, leading=None, align=0):
        st, t = P(text, size, bold, color, leading, italic, align)
        p = Paragraph(t, st); _, h = p.wrap(w, 10000)
        p.drawOn(self.c, x, top - h)
        return h

    def para(self, text, size=7.6, bold=False, color=TEXT, italic=False, gap=5):
        h = self.para_h(text, self.CW, size, bold, italic)
        self.ensure(h + gap)
        self.draw_para(text, M, self.y, self.CW, size, bold, color, italic)
        self.y -= h + gap

    def label(self, text, x, top):
        self.c.setFont("Helvetica", 6.6); self.c.setFillColor(MUTED)
        self.c.drawString(x, top - 7, text)

    # ---------- blocks ----------
    def section(self, num, title):
        self.ensure(60)
        self.y -= 4
        c = self.c
        c.setFillColor(DARK); c.rect(M, self.y - 22, self.CW, 22, stroke=0, fill=1)
        c.setFillColor(ORANGE); c.rect(M, self.y - 22, 5, 22, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 10)
        c.drawString(M + 14, self.y - 15, f"{num}   {title.upper()}")
        self.y -= 30

    def subhead(self, title):
        self.ensure(40)
        c = self.c
        c.setFillColor(BAND); c.rect(M, self.y - 15, self.CW, 15, stroke=0, fill=1)
        c.setFillColor(ORANGE); c.rect(M, self.y - 15, 3, 15, stroke=0, fill=1)
        c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7.8)
        c.drawString(M + 9, self.y - 10.5, title)
        self.y -= 21

    def callout(self, title, body):
        bh = self.para_h(body, self.CW - 26) + (14 if title else 0) + 14
        self.ensure(bh + 6)
        c = self.c
        c.setFillColor(CALLOUT); c.rect(M, self.y - bh, self.CW, bh, stroke=0, fill=1)
        c.setFillColor(ORANGE); c.rect(M, self.y - bh, 4, bh, stroke=0, fill=1)
        top = self.y - 7
        if title:
            c.setFillColor(ORANGE_TXT); c.setFont("Helvetica-Bold", 7.6)
            c.drawString(M + 14, top - 8, title)
            top -= 14
        self.draw_para(body, M + 14, top, self.CW - 26, 7.4)
        self.y -= bh + 8

    def fields(self, spec, h=15, gap=7):
        """spec: list of (label, weight, name, kind) where kind in text|multi|combo:<opts>|date."""
        total = sum(s[1] for s in spec)
        spacing = 10
        avail = self.CW - spacing * (len(spec) - 1)
        rowh = 9 + h
        self.ensure(rowh + gap)
        x = M
        for item in spec:
            lab, wt, name = item[0], item[1], item[2]
            kind = item[3] if len(item) > 3 else "text"
            w = avail * wt / total
            self.label(lab, x, self.y)
            fy = self.y - 9 - h
            if isinstance(kind, list):
                self.combo(name, kind, x, fy, w, h)
            else:
                self.text(name, x, fy, w, h, multiline=(kind == "multi"))
            x += w + spacing
        self.y -= rowh + gap

    def radios_inline(self, label, group, options, label_w=150, note=None):
        self.ensure(18)
        c = self.c
        c.setFont("Helvetica-Bold", 7.6); c.setFillColor(TEXT)
        c.drawString(M, self.y - 9, label)
        x = M + label_w
        for opt in options:
            self.radio(group, opt.split(":")[0].replace(" ", "_")[:24], x, self.y - 12, 9)
            c.setFont("Helvetica", 7.6); c.setFillColor(TEXT)
            c.drawString(x + 12, self.y - 9, opt)
            x += 14 + stringWidth(opt, "Helvetica", 7.6) + 14
        self.y -= 18
        if note:
            self.para(note, 6.8, italic=True, color=MUTED, gap=4)

    def checklist(self, sec, groups, obs_label="Observations / evidence"):
        """groups: list of (group title or None, [check text, ...]). Refs numbered sec.n"""
        cw = self.CW
        col = {"ref": 28, "yes": 24, "no": 24, "na": 24}
        obs_w = cw * 0.36
        chk_w = cw - col["ref"] - 72 - obs_w
        c = self.c

        def head():
            self.ensure(40)
            c.setFillColor(DARK); c.rect(M, self.y - 14, cw, 14, stroke=0, fill=1)
            c.setFillColor(white); c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(M + 14, self.y - 9.5, "Ref")
            c.drawCentredString(M + col["ref"] + chk_w / 2, self.y - 9.5, "Check (Yes = satisfactory)")
            x = M + col["ref"] + chk_w
            for t in ("Yes", "No", "N/A"):
                c.drawCentredString(x + 12, self.y - 9.5, t); x += 24
            c.drawCentredString(x + obs_w / 2, self.y - 9.5, obs_label)
            self.y -= 14

        head()
        n = 0
        for gtitle, items in groups:
            if gtitle:
                if self.y - 40 < FOOT_Y + 24:
                    self.new_page(self.landscape); head()
                c.setFillColor(BAND); c.rect(M, self.y - 13, cw, 13, stroke=0, fill=1)
                c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7)
                c.drawString(M + 5, self.y - 9, gtitle)
                self.y -= 13
            for item in items:
                n += 1
                ref = f"{sec}.{n}"
                th = self.para_h(item, chk_w - 10, 7.2)
                rh = max(25, th + 10)
                if self.y - rh < FOOT_Y + 24:
                    self.new_page(self.landscape); head()
                top = self.y
                c.setStrokeColor(RULE); c.setLineWidth(0.5)
                c.line(M, top - rh, M + cw, top - rh)
                c.setFont("Helvetica-Bold", 7.2); c.setFillColor(TEXT)
                c.drawCentredString(M + 14, top - rh / 2 - 2.5, ref)
                self.draw_para(item, M + col["ref"] + 4, top - (rh - th) / 2, chk_w - 10, 7.2)
                x = M + col["ref"] + chk_w
                g = f"c{ref.replace('.', '_')}"
                for v in ("Yes", "No", "NA"):
                    self.radio(g, v, x + 7.5, top - rh / 2 - 4.5, 9); x += 24
                self.text(f"c{ref.replace('.', '_')}_obs", x + 3, top - rh + 3, obs_w - 4, rh - 6,
                          multiline=True, size=7)
                self.y -= rh
        self.y -= 6
        return n

    def conclusion(self, sec):
        self.ensure(26)
        c = self.c
        c.setFillColor(BAND); c.rect(M, self.y - 20, self.CW, 20, stroke=0, fill=1)
        c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7.6)
        c.drawString(M + 6, self.y - 13, "Section conclusion")
        x = M + 92
        for opt in ("Satisfactory", "Action required", "Not applicable"):
            self.radio(f"s{sec}_conclusion", opt.replace(" ", "_"), x, self.y - 15, 9)
            c.setFont("Helvetica", 7.4); c.setFillColor(TEXT)
            c.drawString(x + 12, self.y - 12.5, opt)
            x += 24 + stringWidth(opt, "Helvetica", 7.4) + 6
        c.setFont("Helvetica", 7); c.setFillColor(MUTED)
        c.drawString(x + 8, self.y - 12.5, "Action plan ref(s)")
        self.text(f"s{sec}_refs", x + 72, self.y - 17, M + self.CW - (x + 72) - 4, 14)
        self.y -= 28

    def grid(self, name, cols, rows, row_h=17, row_labels=None, header_h=16, kinds=None):
        """cols: list of (header, width_weight). kinds: per-column None|'multi'|list(options)|'label'."""
        cw = self.CW
        total = sum(w for _, w in cols)
        widths = [cw * w / total for _, w in cols]
        c = self.c
        hh = max(header_h, max(self.para_h(h, w - 4, 6.8, True) for (h, _), w in zip(cols, widths)) + 6)
        whole = hh + rows * row_h + 8
        if whole < self.H - HEADER_H - 60 - FOOT_Y:
            self.ensure(whole)

        def head():
            self.ensure(hh + row_h + 4)
            c.setFillColor(DARK); c.rect(M, self.y - hh, cw, hh, stroke=0, fill=1)
            x = M
            for (h, _), w in zip(cols, widths):
                ph = self.para_h(h, w - 4, 6.8, True)
                self.draw_para(h, x + 2, self.y - (hh - ph) / 2, w - 4, 6.8, True, white, align=1)
                x += w
            self.y -= hh

        head()
        for r in range(rows):
            if self.y - row_h < FOOT_Y + 24:
                self.new_page(self.landscape); head()
            top = self.y
            c.setStrokeColor(RULE); c.setLineWidth(0.5)
            c.line(M, top - row_h, M + cw, top - row_h)
            x = M
            for ci, w in enumerate(widths):
                kind = kinds[ci] if kinds else None
                if ci == 0 and row_labels is not None:
                    lab = row_labels[r]
                    ph = self.para_h(lab, w - 8, 7.2, True)
                    self.draw_para(lab, x + 4, top - (row_h - ph) / 2, w - 8, 7.2, True)
                elif kind == "num":
                    c.setFont("Helvetica-Bold", 7.6); c.setFillColor(TEXT)
                    c.drawCentredString(x + w / 2, top - row_h / 2 - 2.5, str(r + 1))
                elif isinstance(kind, list):
                    self.combo(f"{name}_r{r+1}_c{ci+1}", kind, x + 2, top - row_h + 2.5, w - 4,
                               row_h - 5, size=7.5)
                else:
                    self.text(f"{name}_r{r+1}_c{ci+1}", x + 2, top - row_h + 2.5, w - 4, row_h - 5,
                              multiline=(kind == "multi" or row_h > 24), size=7)
                x += w
            self.y -= row_h
        self.y -= 8

    def note_box(self, name, label, h=34):
        self.ensure(h + 14)
        self.label(label, M, self.y)
        self.text(name, M, self.y - 9 - h, self.CW, h, multiline=True)
        self.y -= h + 16


# ======================================================================
def build(path, total):
    b = Builder(path, total)
    c = b.c
    YNA = ["-", "Yes", "No", "N/A"]

    # ---------------- COVER ----------------
    b.new_page(header=False)
    W, H = b.W, b.H
    c.setFillColor(DARK); c.rect(0, H - 170, W, 170, stroke=0, fill=1)
    c.setFillColor(ORANGE); c.rect(0, H - 175, W, 5, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 30)
    c.drawString(M, H - 78, "FIRE RISK ASSESSMENT")
    c.setFont("Helvetica", 13)
    c.drawString(M, H - 104, "House in Multiple Occupation (HMO)  |  Partridge Fire Safety")
    c.setFont("Helvetica", 7.6)
    c.drawString(M, H - 132, "Regulatory Reform (Fire Safety) Order 2005  |  Housing Act 2004  |  "
                             "Methodology: BS 9792:2025  |  Benchmark: LACORS Housing - Fire Safety")
    # photo box
    top = H - 192
    c.setStrokeColor(FIELD_LINE); c.setFillColor(FIELD); c.setLineWidth(0.8)
    c.rect(M, top - 300, b.CW, 300, stroke=1, fill=1)
    c.setFillColor(MUTED); c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(W / 2, top - 150, "Front elevation photograph")
    c.setFont("Helvetica", 6.8)
    c.drawCentredString(W / 2, top - 162, "Add an image here (Acrobat: Edit PDF > Add Image)")
    b.y = top - 314
    c.setFillColor(ORANGE); c.setFont("Helvetica-Bold", 7.2)
    c.drawString(M, b.y, "PREMISES"); b.y -= 8
    b.text("cover_address", M, b.y - 36, b.CW * 0.76, 36, multiline=True, size=12)
    b.label("Postcode", M + b.CW * 0.78, b.y - 14)
    b.text("cover_postcode", M + b.CW * 0.78, b.y - 36, b.CW * 0.22, 18, size=12)
    b.y -= 50
    c.setStrokeColor(RULE); c.line(M, b.y, W - M, b.y); b.y -= 12
    c.setFillColor(ORANGE); c.setFont("Helvetica-Bold", 7.2)
    c.drawString(M, b.y, "ASSESSMENT DETAILS"); b.y -= 8
    b.fields([("HMO type", 1, "cover_hmo_type",
               ["Section 254 HMO - standard test", "Section 254 HMO - self-contained flat test",
                "Section 254 HMO - converted building test", "Section 257 HMO - converted block of flats",
                "Shared house (no more than six occupants)"]),
              ("Responsible Person(s)", 1, "cover_rp")], h=16)
    b.fields([("Assessor", 1, "cover_assessor"), ("Qualifications / membership", 1, "cover_quals")], h=16)
    b.fields([("Date of assessment", 1, "cover_date"), ("Next review due", 1, "cover_review")], h=16)
    b.fields([("Report reference", 1, "cover_ref"),
              ("Overall risk rating", 1, "cover_rating",
               ["Trivial", "Tolerable", "Moderate", "Substantial", "Intolerable"])], h=16)
    b.para("Overall risk rating is selected once Section 11 is complete.", 6.8, italic=True, color=MUTED)
    b.y -= 4
    b.callout(None, "<b>Report status</b> is set below. The BS 9792:2025 type of assessment (Type 1 to 4) "
                    "and its scope are recorded in Section 1.")
    b.label("Report status", M, b.y + 4)
    b.combo("cover_status", ["Draft", "Final", "Review"], M + 60, b.y - 9, 120, 14)

    # ---------------- INTRO + SECTION 1 ----------------
    b.new_page()
    c.setFillColor(DARK); c.setFont("Helvetica-Bold", 17)
    c.drawString(M, b.y - 10, "FIRE RISK ASSESSMENT - HMO"); b.y -= 18
    c.setFont("Helvetica", 9); c.setFillColor(MUTED)
    c.drawString(M, b.y - 6, "House in multiple occupation  |  Full template"); b.y -= 18
    b.para("<b>Framework:</b> this assessment is carried out under the <b>Regulatory Reform (Fire Safety) "
           "Order 2005</b> (the Order) for the common parts, and applies <b>BS 9792:2025</b> as the methodology. "
           "LACORS <i>Housing - Fire Safety</i> and BS 5839-6 are used as benchmarks for an HMO of this type. "
           "Benchmarks are applied as guidance, not as rigid standards; departures are justified in Section 11.")
    b.callout("SCOPE",
              "The scope depends on the BS 9792 assessment type selected below. Type 1 covers the common parts "
              "only and is non-intrusive. Types 3 and 4 also include the letting rooms or dwellings. Areas not "
              "accessed are listed in Section 2.")
    b.para("<i><b>Key:</b> Yes = satisfactory. No = deficiency (listed in the Action Plan, Section 11). "
           "N/A = not applicable, or not established at the visit.</i>", 7.2)

    b.section(1, "Premises details")
    b.para("<i>Address, date, assessor and report reference are entered on the cover page.</i>", 7, color=MUTED)
    b.fields([("Time arrived", 1, "s1_arrived"), ("Time departed", 1, "s1_departed"),
              ("Company", 2, "s1_company")])
    b.fields([("Enforcing authority", 1, "s1_enforcer"),
              ("Person present / access provided by", 1, "s1_present")])
    b.radios_inline("BS 9792 type of assessment", "s1_bs9792_type",
                    ["Type 1", "Type 2", "Type 3", "Type 4"], label_w=128,
                    note="Type 1: common parts, non-intrusive. Type 2: common parts, intrusive (sampling). "
                         "Type 3: common parts and dwellings, non-intrusive. Type 4: as Type 3, intrusive.")
    b.subhead("HMO classification and licensing")
    b.fields([("Number of storeys", 1, "s1_storeys"), ("Lettable rooms", 1, "s1_rooms"),
              ("Number of occupants", 1, "s1_occupants"), ("Households", 1, "s1_households"),
              ("Any floor over 200 m²", 1, "s1_over200", ["Yes", "No"])])
    b.fields([("Occupation type", 2, "s1_occ_type",
               ["Shared house (one joint tenancy, shared kitchen)", "Bedsits with cooking in rooms",
                "Bedsits with shared kitchen", "Mixed bedsits and flats", "Converted self-contained flats (s257)"]),
              ("Local authority", 1, "s1_la"), ("LA reference", 1, "s1_la_ref")])
    b.fields([("HMO licence number", 1, "s1_licence"), ("Licence expiry", 1, "s1_licence_exp"),
              ("Licence holder", 1, "s1_licence_holder"), ("Rent Smart Wales ref", 1, "s1_rsw")])
    b.subhead("Construction and layout")
    b.fields([("Approx. year built", 1, "s1_year"), ("Main structure (e.g. masonry, timber frame)", 2, "s1_structure"),
              ("External walls / cladding", 2, "s1_walls")])
    b.fields([("Roof type and covering", 1, "s1_roof"), ("Floor construction", 1, "s1_floors"),
              ("Basement / cellar", 1, "s1_basement", ["None", "Yes - separated", "Yes - not separated", "Not known"]),
              ("Loft conversion", 1, "s1_loft", ["No", "Yes", "Not known"])])
    b.fields([("Sprinkler / suppression system", 1, "s1_sprinkler",
               ["None", "Sprinklers BS 9251", "Sprinklers BS EN 12845", "Water mist", "Not known"]),
              ("Source of construction information (observed, records, RP)", 2, "s1_source")])
    b.fields([("Internal layout and common parts (entrance, hall, stairs, landings, kitchens, final exits)",
               1, "s1_layout", "multi")], h=40)
    b.ensure(215)
    b.subhead("Responsible Person and managing agent")
    # two side-by-side boxes
    for side, (title, key) in enumerate([("RESPONSIBLE PERSON", "rp"), ("MANAGING AGENT (if different)", "agent")]):
        pass
    bw = (b.CW - 12) / 2
    b.ensure(178)
    top = b.y
    for i, (title, key) in enumerate([("RESPONSIBLE PERSON (identified at time of assessment)", "rp"),
                                      ("MANAGING AGENT (if different)", "agent")]):
        x0 = M + i * (bw + 12)
        c.setFillColor(DARK); c.rect(x0, top - 15, bw, 15, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 7.4); c.drawString(x0 + 6, top - 10.5, title)
        c.setStrokeColor(FIELD_LINE); c.setLineWidth(0.6); c.rect(x0, top - 170, bw, 155, stroke=1, fill=0)
        yy = top - 22
        for lab, nmx, h in [("Name / organisation", "name", 15), ("Telephone", "tel", 15),
                            ("Email", "email", 15), ("Address for service", "addr", 15),
                            ("Basis on which identified (e.g. licence, title, tenancy agreement)", "basis", 26)]:
            b.label(lab, x0 + 6, yy)
            b.text(f"s1_{key}_{nmx}", x0 + 6, yy - 9 - h, bw - 12, h, multiline=h > 20)
            yy -= 9 + h + 6
    b.y = top - 178
    b.para("<i><b>Responsible Person (RP):</b> the person with control of the premises under the Order, normally the "
           "landlord or licence holder of an HMO. Where more than one RP is identified, each must co-operate and "
           "co-ordinate with the others.</i>", 6.8, color=MUTED)
    b.subhead("Fire history")
    b.fields([("Previous fires or incidents", 1, "s1_fires", ["None known", "Yes - see details"]),
              ("Details", 3, "s1_fires_detail")])

    # ---------------- SECTION 2 ----------------
    b.section(2, "Limitations and liability")
    b.para("<b>2.1 Basis of the assessment.</b> This assessment reflects the conditions observed on the "
           "<b>date of the visit</b> recorded in Section 1. It is based on a visual, non-intrusive inspection "
           "unless a Type 2 or Type 4 assessment is recorded. Fire safety conditions can change after that date.")
    b.para("<b>2.2 Scope.</b> The assessment is limited to the areas set by the BS 9792 assessment type. It "
           "<b>excludes areas that were not accessible at the time of the assessment</b>, which are listed below. "
           "No comment is made on the condition of those areas, and a follow-up check is included in the action plan.")
    b.note_box("s2_not_accessed", "Areas not accessible or not inspected at the time of the assessment", 34)
    b.subhead("Documents provided by the Responsible Person")
    docs = ["HMO licence and licence conditions", "Rent Smart Wales registration / licence",
            "Building control completion certificate",
            "EICR - common parts and landlord supplies", "Gas safety record (CP12)",
            "Fire alarm certificate (BS 5839-6 / BS 5839-1)",
            "Emergency lighting certificate and test records (BS 5266-1)",
            "Fire door certification / inspection records", "Fire suppression system certificate (if installed)",
            "PAT records (landlord-supplied appliances)", "Fire safety logbook",
            "Previous fire risk assessment and action plan", ""]
    cw = b.CW
    wd = [cw * 0.40, cw * 0.30, cw * 0.30]

    def doc_head():
        b.ensure(30)
        c.setFillColor(DARK); c.rect(M, b.y - 14, cw, 14, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(M + wd[0] / 2, b.y - 9.5, "Document")
        c.drawCentredString(M + wd[0] + wd[1] / 2, b.y - 9.5, "Status")
        c.drawCentredString(M + wd[0] + wd[1] + wd[2] / 2, b.y - 9.5, "Date or reference")
        b.y -= 14
    doc_head()
    for i, d in enumerate(docs):
        if b.y - 18 < FOOT_Y + 24:
            b.new_page(); doc_head()
        top = b.y
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - 18, M + cw, top - 18)
        if d:
            c.setFont("Helvetica", 7.2); c.setFillColor(TEXT); c.drawString(M + 4, top - 11.5, d)
        else:
            b.text(f"s2_doc{i+1}_name", M + 2, top - 16, wd[0] - 4, 14)
        x = M + wd[0] + 6
        for opt in ("Sighted", "Not sighted", "N/A"):
            b.radio(f"s2_doc{i+1}", opt.replace(" ", "_"), x, top - 13.5, 8.5)
            c.setFont("Helvetica", 7); c.setFillColor(TEXT); c.drawString(x + 11, top - 11.5, opt)
            x += 18 + stringWidth(opt, "Helvetica", 7) + 6
        b.text(f"s2_doc{i+1}_ref", M + wd[0] + wd[1] + 2, top - 16, wd[2] - 4, 14, size=7.5)
        b.y -= 18
    b.y -= 4
    b.para("<i>Documents are recorded as sighted only. Their validity, completeness and compliance have not been "
           "verified by the assessor.</i>", 6.8, color=MUTED)
    b.note_box("s2_other_docs", "Other documents or information provided (or stated as not available)", 22)
    b.para("<b>2.3 Responsibility. Overall responsibility for fire safety at the premises rests with the Responsible "
           "Person</b> under the Regulatory Reform (Fire Safety) Order 2005 and, for an HMO, the Housing Act 2004 and "
           "the Management of Houses in Multiple Occupation (Wales) Regulations 2006. The assessor's role is limited to "
           "<b>identifying and reporting findings based on the inspection carried out</b>.")
    b.para("<b>2.4 Liability.</b> The assessor accepts no liability for: (a) fire safety failures at the premises; "
           "(b) management decisions; (c) works carried out by others after the date of the assessment; or "
           "(d) non-implementation of the recommendations by the Responsible Person.")
    b.ensure(16)
    b.check("s2_scope_explained", M, b.y - 10)
    c.setFont("Helvetica", 7.4); c.setFillColor(TEXT)
    c.drawString(M + 13, b.y - 8, "Scope and limitations explained to the person(s) present and to the "
                                  "Responsible Person on receipt of the report")
    b.y -= 20
    b.subhead("2.5 Legislation and standards applied")
    stds = ["Regulatory Reform (Fire Safety) Order 2005", "Fire Safety Act 2021 (external walls, flat entrance doors)",
            "Housing Act 2004 and HHSRS", "Management of HMOs (Wales) Regulations 2006",
            "Renting Homes (Wales) Act 2016", "Building Safety (Wales) Act 2026",
            "BS 9792:2025 Fire risk assessment - Housing", "LACORS Housing - Fire Safety guide",
            "BS 5839-6:2019+A1:2020 Fire detection in domestic premises", "BS 5839-1:2025 Fire detection (Grade A systems)",
            "BS 5266-1:2025 Emergency lighting", "BS 8214:2026 Fire door assemblies",
            "BS 5306-3 Portable extinguishers - maintenance", "BS 9251 / BS EN 12845 Sprinklers",
            "Approved Document B (Wales) and Regulation 37A", "BS 5499 / BS EN ISO 7010 Safety signs"]
    half = (len(stds) + 1) // 2
    rows = max(half, len(stds) - half)
    b.ensure(rows * 10 + 6)
    for i, s in enumerate(stds):
        col_i, row_i = divmod(i, half)
        x = M + 4 + col_i * (b.CW / 2)
        yy = b.y - 8 - row_i * 10
        c.setFillColor(ORANGE); c.rect(x, yy + 1.5, 3, 3, stroke=0, fill=1)
        c.setFillColor(TEXT); c.setFont("Helvetica", 7.2); c.drawString(x + 8, yy, s)
    b.y -= rows * 10 + 10

    # ---------------- SECTION 3 ----------------
    b.section(3, "Fire hazards and their control")
    b.para("Ignition sources, fuel and modern hazards in the common parts, and in letting rooms where the assessment "
           "type includes them. The likelihood of fire is rated in Section 11.")
    b.checklist(3, [
        ("Ignition sources", [
            "Fixed electrical installation has a current satisfactory EICR (date recorded in Section 2).",
            "Landlord-supplied portable appliances are in good condition, with PAT records where appropriate.",
            "Cooking facilities are suitable, in good condition, and not sited on or beside the escape route.",
            "Heating is maintained (gas safety record current); no unsafe portable heaters in use.",
            "Smoking is controlled; no evidence of smoking in the common parts.",
            "No evidence of candles, incense or other naked flames left unattended.",
            "Arson risk is controlled: secure entrance, letterbox protection where needed, no fire load left outside."]),
        ("Fuel sources", [
            "Building fabric in the common parts does not present an unusual fire load (e.g. exposed timber linings).",
            "Landlord-supplied furniture and furnishings are in good condition and meet the furniture fire safety regulations.",
            "No personal possessions are stored in the common parts or escape routes.",
            "Shared kitchens are free of excessive combustibles near cooking appliances.",
            "Waste and recycling are stored externally or in a suitable enclosed store.",
            "Bicycles and mobility scooters are not stored in the escape route.",
            "External combustibles (bins, fencing, stored items) are kept away from the building and its openings."]),
        ("Modern and emerging hazards", [
            "Lithium-ion batteries and chargers are used safely; nothing is charged in the escape route.",
            "E-bikes and e-scooters are not stored or charged in the common parts or escape routes.",
            "Any EV charging point is suitably installed and sited away from escape routes.",
            "Any solar PV installation has accessible isolation, and the inverter location is known.",
            "No evidence of multiple devices left charging unattended overnight in the common parts."]),
    ])
    b.note_box("s3_further", "Further comments on fire hazards", 26)
    b.conclusion(3)

    # ---------------- SECTION 4 ----------------
    b.section(4, "People at risk")
    b.fields([("Occupancy type", 1, "s4_occ",
               ["Permanent tenants", "Students", "Short-term / transient", "Supported or vulnerable tenants", "Mixed"]),
              ("Occupancy hours", 1, "s4_hours", ["24-hour", "Primarily evening and night", "Primarily daytime"]),
              ("Sleeping risk present", 1, "s4_sleep", ["Yes - all floors", "Yes - some floors", "No"])])
    b.subhead("Vulnerable persons (as disclosed by the Responsible Person or observed)")
    groups = ["Older occupants (reduced mobility or awareness)", "Physical mobility impairment",
              "Visual impairment", "Hearing impairment (alarm audibility concern)",
              "Cognitive impairment or dementia", "Occupants affected by medication, alcohol or drugs",
              "Children present", "Occupants whose first language is not English",
              "Occupants unfamiliar with the building layout", "PEEP or evacuation arrangements needed"]
    wd2 = [cw * 0.40, cw * 0.27, cw * 0.33]

    def vp_head():
        b.ensure(30)
        c.setFillColor(DARK); c.rect(M, b.y - 14, cw, 14, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(M + wd2[0] / 2, b.y - 9.5, "Group")
        c.drawCentredString(M + wd2[0] + wd2[1] / 2, b.y - 9.5, "Present")
        c.drawCentredString(M + wd2[0] + wd2[1] + wd2[2] / 2, b.y - 9.5, "Notes and arrangements")
        b.y -= 14
    vp_head()
    for i, gname in enumerate(groups):
        if b.y - 19 < FOOT_Y + 24:
            b.new_page(); vp_head()
        top = b.y
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, top - 19, M + cw, top - 19)
        c.setFont("Helvetica", 7.2); c.setFillColor(TEXT); c.drawString(M + 4, top - 12, gname)
        x = M + wd2[0] + 6
        for opt in ("Yes", "No", "Not known"):
            b.radio(f"s4_vp{i+1}", opt.replace(" ", "_"), x, top - 14, 8.5)
            c.setFont("Helvetica", 7); c.setFillColor(TEXT); c.drawString(x + 11, top - 12, opt)
            x += 18 + stringWidth(opt, "Helvetica", 7) + 6
        b.text(f"s4_vp{i+1}_notes", M + wd2[0] + wd2[1] + 2, top - 17, wd2[2] - 4, 15, size=7.5)
        b.y -= 19
    b.y -= 8
    b.ensure(12 * 17 + 70)
    b.subhead("Room and tenancy schedule")
    b.grid("s4_rooms", [("Room", 0.6), ("Floor", 0.9), ("Occupants", 0.8), ("Lockable door", 0.9),
                        ("Cooking in room", 0.9), ("Opens onto escape route", 1.1), ("Notes", 2.6)],
           12, row_h=17, kinds=["num", None, None, ["Yes", "No"], ["Yes", "No"], ["Yes", "No"], None])
    b.conclusion(4)

    # ---------------- SECTION 5 ----------------
    b.section(5, "Means of escape")
    b.para("Benchmark: LACORS <i>Housing - Fire Safety</i> case studies for this HMO type and storey height, applied "
           "under BS 9792:2025. LACORS sets no fixed maximum travel distance; 9 m from a room exit to a place of "
           "relative safety is a reference. Any distance over that is justified or actioned.")
    b.radios_inline("Evacuation strategy", "s5_strategy", ["Simultaneous (interlinked alarm)", "Stay put", "Other"],
                    label_w=100)
    b.fields([("Number of staircases", 1, "s5_stairs"), ("Final exits", 1, "s5_exits"),
              ("Final exit clear width (mm)", 1, "s5_exit_width"), ("Final exit door and lock type", 2, "s5_exit_lock")])
    b.subhead("Floor-by-floor escape and travel distance")
    floors = ["Basement / cellar", "Ground floor", "First floor", "Second floor", "Third floor", "Fourth floor",
              "Loft / attic"]
    b.grid("s5_floors", [("Floor", 1.3), ("Protected route", 1.0), ("Travel distance (m)", 0.9),
                         ("Benchmark (m)", 0.9), ("Within limit or justified", 1.1), ("Smoke vent", 0.9),
                         ("Notes (state where measured to)", 2.6)],
           len(floors), row_h=18, row_labels=floors,
           kinds=["label", ["Yes", "No", "Partial", "N/A"], None, None, ["Yes", "No", "Justified"],
                  ["AOV", "Manual", "None", "N/A"], None])
    b.checklist(5, [
        ("Escape route", [
            "The escape route is a protected route where the benchmark requires it (30-minute construction, fire doors to risk rooms).",
            "An alternative escape route, secondary means of escape or lobby protection is provided where the storey height requires it.",
            "Travel distances are within the benchmark, or the departure is justified in Section 11.",
            "Smoke ventilation at the head of the stair, where provided, is unobstructed and working.",
            "Rooms open directly onto the escape route; there are no inner rooms, or inner rooms are suitably protected.",
            "The escape route is clear of obstructions and storage along its full length.",
            "Stairs, landings, handrails and floor coverings are in sound condition.",
            "Wall and ceiling linings show no rapid flame-spread risk (e.g. polystyrene tiles, exposed foam).",
            "Escape windows, where relied upon, are suitable, openable and unobstructed.",
            "Letting room doors can be opened from inside without a key (e.g. thumb-turn)."]),
        ("Final exit", [
            "The final exit opens easily in the direction of escape, from inside, without a key, using a single fastening.",
            "The final exit leads directly to a place of safety; the external route is safe and unobstructed.",
            "Security fittings (entry system, extra bolts, chains) do not hinder escape.",
            "An assembly point is identified and known to occupants."]),
    ])
    b.conclusion(5)

    # ---------------- SECTION 6 ----------------
    b.section(6, "Fire doors and compartmentation")
    b.callout("STANDARD - FIRE DOORS",
              "Doors onto the escape route from letting rooms, kitchens and risk rooms should be fire doors to the "
              "benchmark for this HMO type (FD30 or FD30S, self-closing). Fire resistance is evidenced by testing to "
              "BS EN 1634 or BS 476-22; self-closers to BS EN 1154; hinges to BS EN 1935; installation and "
              "maintenance to BS 8214:2026.")
    b.subhead("Fire door inspection log")
    b.grid("s6_doors", [("Door location", 2.0), ("Rating evidenced", 0.9), ("Smoke seals", 0.8),
                        ("Self-closer", 0.8), ("Closes and latches", 0.8), ("Leaf, glazing, frame sound", 0.9),
                        ("3 hinges", 0.7), ("Gaps in tolerance", 0.8), ("Comments", 2.0)],
           10, row_h=18,
           kinds=[None, ["FD30S", "FD30", "FD60S", "Not evidenced", "Not a fire door"], YNA, YNA, YNA, YNA, YNA, YNA, None])
    b.checklist(6, [
        ("Fire doors", [
            "Kitchen doors onto the escape route are fire doors to the benchmark and self-closing.",
            "Letting room doors onto the escape route are fire doors to the benchmark and self-closing.",
            "Fire door certification (third-party label, plug or documentary evidence) has been sighted.",
            "Leaf-to-frame gaps are within tolerance; intumescent strips and smoke seals are present and intact.",
            "No fire door is wedged open, damaged, or has its self-closing device removed or disabled.",
            "Fire door signage (Fire door keep shut / Keep locked) is displayed where appropriate."]),
        ("Compartmentation and fire stopping", [
            "Walls and ceilings enclosing the escape route are intact, with no holes, gaps or missing boards.",
            "Service penetrations through fire-resisting construction are visibly fire-stopped.",
            "Loft hatches, recessed downlights and other ceiling openings in the escape route are fire-resisting.",
            "Cupboards and meter enclosures on the escape route are fire-resisting and kept closed.",
            "Any basement or cellar is separated from the ground-floor escape route.",
            "The roof void has been inspected, or the reason for non-access is recorded.",
            "No alterations are apparent that could have compromised fire separation."]),
        ("Regulation 37A (Wales) - evidence only", [
            "Where the HMO was created by a material change of use since Regulation 37A applied, evidence of automatic "
            "suppression (BS 9251 / BS 8458 certificate) or building control confirmation that it was not required has been sighted."]),
    ])
    b.conclusion(6)

    # ---------------- SECTION 7 ----------------
    b.section(7, "Fire detection and alarm")
    b.para("Standard: BS 5839-6:2019+A1:2020 (Table 1 and footnotes), with LACORS as the HMO benchmark; Grade A "
           "systems to BS 5839-1:2025. The higher of the two benchmarks is applied for the HMO type and storey height.")
    b.fields([("Grade and category (e.g. Grade A, LD2)", 1, "s7_grade"), ("Benchmark for this HMO", 1, "s7_benchmark"),
              ("Edition applied", 1, "s7_edition")])
    b.fields([("Mixed system (communal + units)", 1, "s7_mixed", ["Yes", "No"]),
              ("How interlinking was confirmed", 2, "s7_interlink",
               ["Witnessed test", "Installer certificate", "RP statement", "Not confirmed"]),
              ("Control panel location", 1, "s7_cie")])
    b.checklist(7, [
        (None, [
            "System grade and category meet the benchmark for this HMO type and storey height.",
            "Smoke detection in every escape route circulation area and landing.",
            "Heat detection in every kitchen and communal kitchen.",
            "Detection in the principal habitable room and every communal lounge.",
            "Bedsits with cooking have heat or multi-sensor detection.",
            "Detection is interlinked so an alarm anywhere sounds throughout, or a mixed system is correctly arranged.",
            "Detectors are mains-powered with standby supply; common-parts alarms are not supplied through a tenant's prepayment meter.",
            "Manual call points are provided where required (storey exits and final exits) and unobstructed.",
            "The control panel (Grade A) is in the common area near the entrance and shows normal, with zones or unit identification.",
            "The alarm is audible in all letting rooms with doors closed (85 dB(A) at bedroom doors).",
            "Carbon monoxide alarms are provided where combustion appliances are present.",
            "Routine testing is carried out and logged (weekly for Grade A, monthly for Grade D).",
            "Servicing by a competent person is in date (Grade A: 6-monthly).",
            "An installation or commissioning certificate has been sighted."]),
    ])
    b.conclusion(7)

    # ---------------- SECTION 8 ----------------
    b.section(8, "Emergency lighting")
    b.para("Standard: BS 5266-1:2025. Emergency lighting is expected where the escape route is long or complex, or has "
           "no effective borrowed light, and is recommended in all HMOs of five or six storeys (LACORS).")
    b.fields([("Type provided", 1, "s8_type", ["Maintained", "Non-maintained", "Mixed", "None"]),
              ("Rated duration", 1, "s8_duration", ["1 hour", "3 hours", "Not known"]),
              ("Lux reading (if measured)", 1, "s8_lux"), ("Night-time conditions: assessor note", 2, "s8_night")])
    b.checklist(8, [
        (None, [
            "Emergency lighting is provided where the route is long, complex, or lacks effective borrowed light.",
            "Luminaires are sited at stairs, changes of level and direction, landings and final exits.",
            "Illumination appears adequate along the escape route.",
            "Duration is adequate for sleeping premises (normally 3 hours).",
            "Luminaires are in good condition and charge indicators show normal operation.",
            "Monthly functional tests are carried out and logged.",
            "Annual full-duration tests are carried out and logged.",
            "An installation or periodic certificate (BS 5266-1) has been sighted."]),
    ])
    b.conclusion(8)

    # ---------------- SECTION 9 ----------------
    b.section(9, "Firefighting equipment and signage")
    b.checklist(9, [
        ("Firefighting equipment", [
            "A fire blanket is provided in each shared kitchen and each bedsit with cooking.",
            "Where provided, a multi-purpose extinguisher is sited on each floor of the common parts.",
            "Extinguisher types suit the hazard and are within service date (BS 5306-3)."]),
        ("Signs and notices", [
            "A fire action notice is displayed prominently in the common parts.",
            "Fire exit signs are provided where the escape route is complex or there is a secondary means of escape.",
            "Fire door signs (Keep shut / Keep locked) are on fire doors and cupboards.",
            "No-smoking signs are displayed in the common parts."]),
    ])
    b.conclusion(9)

    # ---------------- SECTION 10 ----------------
    b.section(10, "Management of fire safety")
    b.checklist(10, [
        ("Information and procedures", [
            "Written fire emergency plan and fire safety information are given to tenants.",
            "Tenants are briefed on fire procedures at move-in.",
            "A fire safety logbook is kept (tests, inspections, false alarms, works).",
            "Routine inspections of the common parts, fire doors and escape routes are carried out.",
            "Contractors and hot work are controlled (permit to work where appropriate).",
            "There is co-operation and co-ordination with any other Responsible Persons."]),
        ("Compliance records", [
            "HMO licence conditions relating to fire safety are met.",
            "Management of HMOs (Wales) Regulations 2006 duties are met.",
            "Gas safety record (CP12) is current.",
            "EICR is current and satisfactory.",
            "PAT records are kept for landlord-supplied appliances.",
            "Previous FRA action plan items have been completed.",
            "The fire risk assessment is reviewed at least annually, or sooner after a significant change."]),
    ])
    b.conclusion(10)

    # ---------------- SECTION 11 ----------------
    b.section(11, "Risk rating and action plan")
    b.subhead("11.1 Risk rating (BS 9792:2025)")
    b.radios_inline("Step 1: likelihood of fire", "s11_likelihood", ["Low", "Medium", "High"], label_w=140)
    b.para("Low = abnormally low for this type of premises. Medium = typical for this type of premises. "
           "High = serious shortcomings in the control of fire hazards.", 6.8, italic=True, color=MUTED)
    b.radios_inline("Step 2: likely consequences of fire", "s11_consequence",
                    ["Slight harm", "Moderate harm", "Extreme harm"], label_w=140)
    b.para("Slight = serious injury or death unlikely. Moderate = serious injury possible, multiple fatalities unlikely. "
           "Extreme = one or more occupants likely to be seriously injured or killed.", 6.8, italic=True, color=MUTED)
    # matrix
    b.ensure(80)
    mx = [("Low", ["Trivial", "Tolerable", "Moderate"]), ("Medium", ["Tolerable", "Moderate", "Substantial"]),
          ("High", ["Moderate", "Substantial", "Intolerable"])]
    colw = b.CW / 4
    c.setFillColor(DARK); c.rect(M, b.y - 15, b.CW, 15, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 7.2)
    for i, h in enumerate(["Likelihood of fire", "Slight harm", "Moderate harm", "Extreme harm"]):
        c.drawCentredString(M + colw * i + colw / 2, b.y - 10.5, h)
    b.y -= 15
    for lk, vals in mx:
        c.setFillColor(BAND); c.rect(M, b.y - 17, colw, 17, stroke=0, fill=1)
        c.setFillColor(DARK); c.setFont("Helvetica-Bold", 7.4); c.drawCentredString(M + colw / 2, b.y - 11.5, lk)
        for i, v in enumerate(vals):
            c.setFillColor(HexColor(RISK[v])); c.rect(M + colw * (i + 1), b.y - 17, colw, 17, stroke=0, fill=1)
            c.setFillColor(white if v == "Intolerable" else TEXT); c.setFont("Helvetica-Bold" if v == "Intolerable" else "Helvetica", 7.4)
            c.drawCentredString(M + colw * (i + 1) + colw / 2, b.y - 11.5, v)
        c.setStrokeColor(white); c.setLineWidth(1); c.line(M, b.y - 17, M + b.CW, b.y - 17)
        b.y -= 17
    b.y -= 4
    b.para("Matrix: BS 9792:2025 example risk level estimator (three likelihood levels, three consequence levels, "
           "five risk levels).", 6.8, italic=True, color=MUTED)
    b.radios_inline("Step 3: overall fire risk", "s11_overall",
                    ["Trivial", "Tolerable", "Moderate", "Substantial", "Intolerable"], label_w=110)
    defs = [("Trivial", "Risk to life is exceptionally low. No action needed."),
            ("Tolerable", "Existing controls are adequate. Maintain and review."),
            ("Moderate", "Improvements are needed to bring the risk to a tolerable level."),
            ("Substantial", "Significant improvements are required urgently."),
            ("Intolerable", "The premises are unsafe for occupation until the risk is reduced. Immediate action.")]
    b.ensure(len(defs) * 13 + 6)
    for k, v in defs:
        c.setFillColor(HexColor(RISK[k])); c.rect(M, b.y - 12, 70, 12, stroke=0, fill=1)
        c.setFillColor(white if k == "Intolerable" else TEXT); c.setFont("Helvetica-Bold", 7.2)
        c.drawString(M + 5, b.y - 8.5, k)
        c.setFillColor(TEXT); c.setFont("Helvetica", 7.2); c.drawString(M + 78, b.y - 8.5, v)
        b.y -= 13
    b.y -= 6
    b.note_box("s11_justification", "Assessor justification for the overall rating", 40)
    b.note_box("s11_departures", "Departures from recognised standards accepted without upgrade, with the reason for accepting them", 30)
    b.subhead("Post-remediation predicted risk")
    b.fields([("Residual likelihood", 1, "s11_res_like", ["Low", "Medium", "High"]),
              ("Residual consequence", 1, "s11_res_cons", ["Slight harm", "Moderate harm", "Extreme harm"]),
              ("Predicted residual rating", 1, "s11_res_rating",
               ["Trivial", "Tolerable", "Moderate", "Substantial", "Intolerable"])])
    b.ensure(30)
    b.check("s11_serious_informed", M, b.y - 10)
    b.draw_para("<b>Serious risk to persons identified: the Responsible Person was informed before the assessor "
                "left the premises</b>, and any interim measures are recorded below. The report is issued without "
                "delay and is not held back pending completion of works.", M + 13, b.y - 2, b.CW - 13, 7.4)
    b.y -= 30

    # ---- action plan (landscape) ----
    b.new_page(land=True)
    b.subhead("11.2 Action plan")
    b.para("<b>Priority:</b> H = High (immediate / within 1 month)  |  M = Medium (within 3 months)  |  "
           "L = Low (within 12 months).   <b>Basis:</b> L = legal requirement under the Order  |  G = good practice.   "
           "Photo ref(s) link each deficiency to Section 12.", 7.2)
    b.grid("s11_action", [("No.", 0.35), ("Ref", 0.5), ("Deficiency identified", 3.0), ("Action required", 3.0),
                          ("Priority", 0.75), ("Basis", 0.6), ("Responsible Person", 1.3), ("Target date", 0.95),
                          ("Photo ref(s)", 0.9), ("Date closed", 0.85)],
           12, row_h=52, kinds=["num", None, "multi", "multi", ["H", "M", "L"], ["L", "G"], None, None, None, None])
    b.subhead("11.3 Interim measures (until the actions above are completed)")
    b.grid("s11_interim", [("No.", 0.35), ("Action ref", 0.6), ("Interim measure", 5.5), ("Responsible Person", 1.5),
                           ("Date in place", 1.0), ("Date removed", 1.0)],
           4, row_h=30, kinds=["num", None, "multi", None, None, None])

    # ---------------- SECTION 12 ----------------
    b.new_page()
    b.section(12, "Photographic evidence")
    b.para("Photographs supporting each deficiency in the action plan are referenced below and shown in Appendix A "
           "or in the file reference given.")
    b.grid("s12_photos", [("Photo ref", 0.8), ("Action no.", 0.7), ("Location", 1.6), ("What the photograph shows", 3.2),
                          ("Date / time", 1.0), ("File / folder ref", 1.3)], 20, row_h=17)

    # ---------------- SECTION 13 ----------------
    b.ensure(11 * 25 + 80)
    b.section(13, "Testing and maintenance schedule")
    systems = [("Fire alarm system (Grade A)", "BS 5839-1:2025 / BS 5839-6"),
               ("Interlinked smoke and heat alarms (Grade D)", "BS 5839-6:2019+A1:2020"),
               ("Carbon monoxide alarms", "BS EN 50291 / BS EN 50292"),
               ("Emergency lighting", "BS 5266-1:2025"),
               ("Fire extinguishers and blankets", "BS 5306-3"),
               ("Fire doors (inspection)", "BS 8214:2026"),
               ("Electrical installation (EICR)", "BS 7671"),
               ("Gas safety record (CP12)", "Gas Safety (Installation and Use) Regs 1998"),
               ("Portable appliances (PAT)", "IET Code of Practice"),
               ("Sprinkler / suppression system", "BS 9251 / BS EN 12845"),
               ("Smoke ventilation (AOV)", "BS EN 12101 / BS 9999")]
    b.grid("s13_tm", [("System", 3.0), ("Standard", 1.4), ("Last service", 1.0), ("Next due", 1.0),
                      ("Contractor / notes", 2.2)], len(systems), row_h=25,
           row_labels=[f"{s[0]}<br/><font size=6.2 color='#555555'>{s[1]}</font>" for s in systems],
           kinds=["label", None, None, None, None])

    # ---------------- SECTION 14 ----------------
    b.section(14, "Declaration and sign-off")
    b.para("I confirm that this assessment was carried out under the Regulatory Reform (Fire Safety) Order 2005, applying "
           "BS 9792:2025 as the methodology, and that it records the conditions observed on the date shown. It is subject "
           "to the limitations and liability statement in Section 2.")
    b.fields([("Assessor name", 1, "s14_assessor"), ("Qualifications / membership", 1, "s14_quals"),
              ("Company", 1, "s14_company")])
    b.fields([("Date of assessment", 1, "s14_date"), ("Date of report", 1, "s14_report_date"),
              ("Review due (annually or sooner on any significant change)", 1, "s14_review")])
    b.fields([("Report checked by", 1, "s14_checker"), ("Checker qualifications", 1, "s14_checker_quals"),
              ("Assessor signature (sign last: signing locks the report)", 1, "s14_sig")], h=22)
    b.ensure(146)
    bw = (b.CW - 12) / 2
    top = b.y
    for i, (title, key) in enumerate([("RESPONSIBLE PERSON ACKNOWLEDGEMENT", "rp"),
                                      ("MANAGING AGENT ACKNOWLEDGEMENT (if applicable)", "agent")]):
        x0 = M + i * (bw + 12)
        c.setFillColor(DARK); c.rect(x0, top - 15, bw, 15, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Helvetica-Bold", 7.4); c.drawString(x0 + 6, top - 10.5, title)
        c.setStrokeColor(FIELD_LINE); c.setLineWidth(0.6); c.rect(x0, top - 136, bw, 121, stroke=1, fill=0)
        yy = top - 22
        for lab, nmx, h in [("Name and capacity", "name", 15), ("Signature", "sig", 20), ("Date", "date", 15)]:
            b.label(lab, x0 + 6, yy); b.text(f"s14_{key}_{nmx}", x0 + 6, yy - 9 - h, bw - 12, h); yy -= 9 + h + 5
        b.check(f"s14_{key}_received", x0 + 6, top - 131)
        c.setFont("Helvetica", 7); c.setFillColor(TEXT)
        c.drawString(x0 + 19, top - 129, "Report received and Section 2 explained")
    b.y = top - 146
    b.ensure(5 * 18 + 80)
    b.subhead("Review history")
    b.grid("s14_reviews", [("Review date", 1.0), ("Assessor", 1.3), ("Review trigger", 1.4),
                           ("Reviews since full FRA", 0.9), ("Summary of changes", 3.4)], 5, row_h=18,
           kinds=[None, None, ["Annual review", "Material alteration", "Change of occupancy", "After a fire",
                               "Enforcement / licensing", "Other"], None, None])
    b.para("<i>This document remains the property of the assessor. It should be kept at the premises and made available "
           "to the enforcing authority on request.</i>", 6.8, color=MUTED)

    # ---------------- APPENDIX A ----------------
    for pg in range(3):
        b.new_page()
        if pg == 0:
            b.section("A", "Appendix - photographic evidence sheet")
            b.para("Photographs are cross-referenced to the action plan by photo reference and action number.")
        avail = b.y - (FOOT_Y + 30)
        slot = (avail - 10) / 2
        for k in range(2):
            n = pg * 2 + k + 1
            top = b.y
            img_h = slot - 46
            c.setStrokeColor(FIELD_LINE); c.setFillColor(FIELD); c.setLineWidth(0.7)
            c.rect(M, top - img_h, b.CW, img_h, stroke=1, fill=1)
            c.setFillColor(MUTED); c.setFont("Helvetica-Oblique", 8)
            c.drawCentredString(b.W / 2, top - img_h / 2, f"Photograph {n} - place image here")
            b.y = top - img_h - 6
            b.fields([("Photo ref", 1, f"apx_p{n}_ref"), ("Action no.", 1, f"apx_p{n}_action"),
                      ("Location", 3, f"apx_p{n}_loc"), ("Caption", 6, f"apx_p{n}_caption")], h=15, gap=4)
            b.y -= 8
    b.finish()
    return b.page


def fix_radios(path):
    """ReportLab draws radio circles at the wrong size; redraw them with PyMuPDF, then
    reset every group to unselected (PyMuPDF's update() switches the last button on)."""
    import pymupdf
    d = pymupdf.open(path)
    parents = set()
    for p in d:
        for w in p.widgets():
            if w.field_type_string == "RadioButton":
                w.border_color = (0.333, 0.333, 0.333)
                w.fill_color = (1, 1, 1)
                w.border_width = 0.7
                w.update()
    for p in d:
        for w in p.widgets():
            if w.field_type_string == "RadioButton":
                d.xref_set_key(w.xref, "AS", "/Off")
                par = d.xref_get_key(w.xref, "Parent")
                if par[0] == "xref":
                    parents.add(int(par[1].split()[0]))
    for x in parents:
        d.xref_set_key(x, "V", "/Off")
    tmp = path + ".tmp"
    d.save(tmp, garbage=3, deflate=True)
    d.close()
    import os
    os.replace(tmp, path)


if __name__ == "__main__":
    out = sys.argv[1]
    n = build(out, 99)
    build(out, n)
    fix_radios(out)
    print("pages:", n)
