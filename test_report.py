import http.server, os, sys, threading, functools
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=sys.argv[1]
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT,"dist","pwa"))
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8771),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":1180,"height":900},accept_downloads=True,timezone_id="Europe/London").new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8771/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
    pg.fill('#f_setup_ref','PFS002'); pg.dispatch_event('#f_setup_ref','input')
    pg.click('.rail button[data-view="walk"]'); pg.wait_for_timeout(100)
    pg.locator('[data-act="qa-edit"]').first.click(); pg.wait_for_timeout(150)
    pg.set_input_files('.sheet input[type=file]', [f"{OUT}/p0.jpg", f"{OUT}/p1.jpg", f"{OUT}/p2.jpg"]); pg.wait_for_timeout(1500)
    pg.click('.sheet button.primary'); pg.wait_for_timeout(200)
    # caption one photo
    pg.click('.rail button[data-view="walk"]'); pg.locator('[data-act="qa-edit"]').first.click(); pg.wait_for_timeout(150)
    pg.locator('.sheet [data-act="photo-view"]').first.click(); pg.wait_for_timeout(300)
    print("viewer:", pg.locator('.sheet .muted.small').last.inner_text())
    pg.locator('input[data-bind^="photoMeta"]').fill("Whole door, closed; closer missing"); pg.dispatch_event('input[data-bind^="photoMeta"]','input')
    pg.screenshot(path=f"{OUT}/viewer.png")
    pg.wait_for_timeout(1500); pg.keyboard.press("Escape"); pg.goto("http://127.0.0.1:8771/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.evaluate("() => { S.view = \'setup\'; render(); }")
    pg.click('.rail button[data-view="actions"]'); pg.wait_for_timeout(100)
    if pg.locator('[data-act="draft-actions"]').count(): pg.click('[data-act="draft-actions"]'); pg.wait_for_timeout(150)
    pg.click('.rail button[data-view="risk"]'); pg.click('.seg button[data-val="Medium"]'); pg.click('.seg button[data-val="Moderate harm"]')
    pg.click('.rail button[data-view="report"]'); pg.wait_for_timeout(100)
    print("warnings:", pg.locator(".pending li").all_inner_texts())
    with pg.expect_download(timeout=60000) as dl: pg.click('[data-act="pdf"]')
    dl.value.save_as(f"{OUT}/report.pdf")
    # robustness: partial job
    r=pg.evaluate("() => { const j = normalise({id:'x', setup:{}}); return Object.keys(j).join(',') }"); print("normalise:", r)
    b.close()
srv.shutdown(); print("errors:", errs or "none")
