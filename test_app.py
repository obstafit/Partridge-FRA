"""Smoke test: serve dist/pwa, click through every screen, add an item, build the PDF."""
import http.server, os, sys, threading, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, "dist", "pwa"))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
errors = []

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp, scheme in [("tablet", {"width": 1180, "height": 820}, "light"), ("phone", {"width": 400, "height": 860}, "dark")]:
        ctx = b.new_context(viewport=vp, color_scheme=scheme, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
        pg.on("console", lambda m: m.type == "error" and errors.append(f"{name} console: {m.text}"))
        pg.goto("http://127.0.0.1:8765/index.html")
        pg.wait_for_selector(".jobcard")
        pg.screenshot(path=f"{OUT}/{name}_01_jobs.png")
        pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
        for i, view in enumerate(["setup", "building", "walk", "checks", "management", "risk", "actions", "report"], 2):
            if name == "phone": pg.evaluate(f"() => {{ S.view = '{view}'; render(); }}")
            else: pg.click(f'.rail button[data-view="{view}"]')
            pg.wait_for_timeout(150)
            if name == "tablet" and view == "walk":
                pg.click('.qabtn[data-k="el"]')
                pg.fill("#q_loc", "Second floor landing")
                pg.click('.qf button[data-act="qseg"][data-k="cond"][data-val="Yes"]')
                pg.click('.qf button[data-act="qseg"][data-k="led"][data-val="No"]')
                pg.screenshot(path=f"{OUT}/{name}_sheet.png")
                pg.click(".sheetfoot .primary")
                pg.wait_for_timeout(200)
            if name == "tablet" and view == "risk":
                pg.click('button[data-path="risk.likelihood"][data-val="Medium"]')
                pg.click('button[data-path="risk.consequence"][data-val="Moderate harm"]')
                pg.fill('[data-bind="risk.justification"]', "Typical likelihood for a bedsit HMO; protected stair but door defects.")
            if name == "tablet" and view == "actions":
                if pg.query_selector('[data-act="draft-actions"]'):
                    pg.click('[data-act="draft-actions"]')
                    pg.wait_for_timeout(150)
            pg.screenshot(path=f"{OUT}/{name}_{i:02d}_{view}.png", full_page=(name == "tablet"))
        if name == "tablet":
            with pg.expect_download() as dl:
                pg.click('[data-act="pdf"]')
            dl.value.save_as(f"{OUT}/report.pdf")
        ctx.close()
    b.close()
srv.shutdown()
print("errors:", errors or "none")
