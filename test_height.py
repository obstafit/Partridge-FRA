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
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8768),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":1180,"height":900},accept_downloads=True).new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8768/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
    pick(pg,'#f_setup_buildingType','Block of flats (common parts)'); pg.wait_for_timeout(100)
    pick(pg,'#f_setup_flatsType',index=3); pg.wait_for_timeout(100)
    for st,ht in [("3","6"),("5","12"),("8","22")]:
        pg.fill('#f_setup_storeys',st); pg.dispatch_event('#f_setup_storeys','change'); pg.wait_for_timeout(80)
        pg.fill('#f_setup_topHeight',ht); pg.dispatch_event('#f_setup_topHeight','change'); pg.wait_for_timeout(80)
        note=pg.inner_text('.note'); i=note.find('Height'); 
        pg.click('.rail button[data-view="checks"]'); pg.wait_for_timeout(80)
        c9=pg.inner_text('.tabs button[data-n="9"] small')
        pg.click('.rail button[data-view="building"]'); pg.wait_for_timeout(80)
        bm=pg.inner_text('.bench dl')
        print(st,ht,"|",note[i:i+90] if i>=0 else "no height","| s9",c9,"|",[l for l in bm.split("\n") if "Category" in l or "min" in l or "riser" in l.lower()][:3])
        pg.click('.rail button[data-view="setup"]'); pg.wait_for_timeout(80)
    pg.click('.rail button[data-view="report"]'); 
    with pg.expect_download() as dl: pg.click('[data-act="pdf"]')
    dl.value.save_as(f"{OUT}/conv_8storey.pdf")
    b.close()
srv.shutdown(); print("errors:", errs or "none")
