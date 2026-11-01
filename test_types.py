import http.server, os, sys, threading, functools
from playwright.sync_api import sync_playwright
def pick(pg, sel, val=None, index=None):
    """Choose an option whether the field is a drop-down or tap chips."""
    path = sel.lstrip('#').replace('f_setup_', 'setup.', 1).replace('f_overview_', 'overview.', 1)
    pg.evaluate("""([sel, path, val, index]) => { const el = document.querySelector(sel);
      if (el && el.tagName === 'SELECT') { if (index !== null) el.selectedIndex = index; else el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
      const bs = [...document.querySelectorAll(`[data-path="${path}"]`)]; const b = index !== null ? bs[index - 1] : bs.find((x) => x.dataset.val === val);
      if (!b) throw new Error('no option ' + path + ' ' + val); if (!b.classList.contains('on')) b.click(); }""", [sel, path, val, index])

ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT,"dist","pwa"))
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8767),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
def counts(pg):
    pg.click('.rail button[data-view="checks"]'); pg.wait_for_timeout(80)
    return [pg.inner_text(f'.tabs button[data-n="{n}"] small') for n in (3,5,6,7)]
def qas(pg):
    pg.click('.rail button[data-view="walk"]'); pg.wait_for_timeout(80)
    return pg.locator('.qabtn').all_inner_texts()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1180,"height":900},accept_downloads=True); pg=ctx.new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8767/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
    for t in ["Type 1","Type 2","Type 3","Type 4"]:
        pg.click('.rail button[data-view="setup"]'); pick(pg,'#f_setup_bs9792',t); pg.wait_for_timeout(100)
        print("HMO",t,counts(pg), [q for q in qas(pg) if "inspection" in q or "Intrusive" in q])
    # answers keep across type change
    pg.click('.rail button[data-view="checks"]'); pg.click('.tabs button[data-n="3"]'); print("3.1 kept:", pg.locator('.check').first.locator('button.on').all_inner_texts())
    # switch to flats
    pg.click('.rail button[data-view="setup"]'); pick(pg,'#f_setup_buildingType','Block of flats (common parts)'); pg.wait_for_timeout(150)
    pick(pg,'#f_setup_flatsType','Purpose-built block'); pg.wait_for_timeout(100)
    pick(pg,'#f_setup_bs9792','Type 1'); pg.wait_for_timeout(100)
    print("flats setup heading:", pg.locator('h3, .group summary strong').all_inner_texts()[:3]); print("scope:", pg.inner_text('.note')[:140])
    pg.screenshot(path=f"{OUT}/flats_setup.png", full_page=True)
    print("flats T1", counts(pg), qas(pg)[:4])
    pg.click('.rail button[data-view="building"]'); pg.wait_for_timeout(80); pg.screenshot(path=f"{OUT}/flats_building.png", full_page=True)
    pg.click('.rail button[data-view="report"]'); pg.wait_for_timeout(80); print("warn:", pg.locator(".pending li").all_inner_texts())
    with pg.expect_download() as dl: pg.click('[data-act="pdf"]')
    dl.value.save_as(f"{OUT}/flats_t1.pdf")
    pg.click('.rail button[data-view="setup"]'); pick(pg,'#f_setup_bs9792','Type 4'); pg.wait_for_timeout(100)
    print("flats T4", counts(pg), [q for q in qas(pg) if "inspection" in q or "Intrusive" in q])
    b.close()
srv.shutdown(); print("errors:", errs or "none")
