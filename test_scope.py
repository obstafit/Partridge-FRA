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
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8766),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1180,"height":900},accept_downloads=True); pg=ctx.new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8766/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
    pg.screenshot(path=f"{OUT}/setup_type1.png")
    pg.click('.rail button[data-view="walk"]'); pg.wait_for_timeout(100)
    print("letting disabled (Type 1):", pg.eval_on_selector('#nl_area option:nth-child(2)','o=>o.disabled'))
    pg.click('.rail button[data-view="checks"]'); pg.click('.tabs button[data-n="9"]'); pg.wait_for_timeout(100)
    print("evidence hints:", pg.locator(".evid").count())
    pg.screenshot(path=f"{OUT}/checks_type1.png")
    pg.click('.rail button[data-view="report"]'); pg.wait_for_timeout(100)
    print("warnings:", pg.locator(".pending li").all_inner_texts())
    with pg.expect_download() as dl: pg.click('[data-act="pdf"]')
    dl.value.save_as(f"{OUT}/type1.pdf")
    pg.click('.rail button[data-view="setup"]'); pick(pg,'#f_setup_bs9792','Type 3'); pg.wait_for_timeout(150)
    print("scope note (Type 3):", pg.inner_text(".note")[:90])
    pg.click('.rail button[data-view="walk"]'); pg.wait_for_timeout(100)
    print("letting disabled (Type 3):", pg.eval_on_selector('#nl_area option:nth-child(2)','o=>o.disabled'))
    pg.click('.rail button[data-view="setup"]'); pick(pg,'#f_setup_occType','Shared house (one joint tenancy, shared kitchen)'); pg.wait_for_timeout(150)
    pick(pg,'#f_setup_jointTenancy','Yes'); pg.wait_for_timeout(150)
    print("scope note (joint):", pg.inner_text(".note")[:110]); pg.screenshot(path=f"{OUT}/setup_joint.png")
    b.close()
srv.shutdown(); print("errors:", errs or "none")
