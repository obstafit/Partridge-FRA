import http.server, threading, functools, sys
from playwright.sync_api import sync_playwright
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8797),functools.partial(Q,directory=__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)),"dist","pwa"))); threading.Thread(target=srv.serve_forever,daemon=True).start()
BLOCK_IDB="IDBObjectStore.prototype.put=function(){throw new DOMException('refused','UnknownError')};"
BLOCK_LS="Storage.prototype.setItem=function(){throw new DOMException('no','SecurityError')};"
errs=[]
def run(p, init, label):
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True); ctx.add_init_script(init); pg=ctx.new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    toasts=[]; pg.expose_function("logToast", lambda m: toasts.append(m))
    pg.goto("http://127.0.0.1:8797/index.html"); pg.wait_for_selector(".jobcard")
    pg.evaluate("()=>{const o=toast; window.toast=(m)=>{logToast(m);o(m)}}")
    print(label, "| mode:", pg.evaluate("()=>Store.mode()"))
    pg.click('[data-act="new-job"]'); pg.wait_for_timeout(300)
    f=pg.locator('#f_setup_address')
    for ch in "12 Test Street": f.type(ch, delay=20)
    pg.wait_for_timeout(800)
    print("  save-failure messages while typing 14 characters:", sum('save' in t.lower() for t in toasts), toasts[:2])
    pg.evaluate("()=>{S.view='home';render()}"); pg.wait_for_timeout(100)
    print("  warning on Home:", pg.locator('.storewarn').count(), (pg.locator('.storewarn span').inner_text()[:60] if pg.locator('.storewarn').count() else ''))
    pg.reload(); pg.wait_for_selector(".jobcard"); pg.wait_for_timeout(300)
    print("  job kept after reload:", "12 Test Street" in pg.inner_text("body"))
    b.close()
with sync_playwright() as p:
    run(p, "", "Normal phone")
    run(p, BLOCK_IDB, "Database refused (like your preview)")
    run(p, BLOCK_IDB+BLOCK_LS, "All storage refused")
srv.shutdown(); print("errors:", errs or "none")
