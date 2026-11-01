import http.server, threading, functools, sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8796),functools.partial(Q,directory=__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)),"dist","pwa"))); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.on("pageerror",lambda e: errs.append(str(e))); cdp=ctx.new_cdp_session(pg)
    def swipe(x0,y0,x1,y1,steps=8,shot=None):
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":x0,"y":y0}]})
        for i in range(1,steps+1):
            cdp.send("Input.dispatchTouchEvent",{"type":"touchMove","touchPoints":[{"x":x0+(x1-x0)*i/steps,"y":y0+(y1-y0)*i/steps}]}); pg.wait_for_timeout(16)
        if shot: pg.screenshot(path=shot)
        cdp.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]}); pg.wait_for_timeout(450)
    st=lambda: pg.evaluate("()=>{const c=checkList().filter(c=>c.sec===S.sec)[S.gi]; return {gi:S.gi, key:c&&c.key, v:c&&(S.job.checks[c.key]||{}).v}}")
    pg.goto("http://127.0.0.1:8796/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{S.view='checks';render()}"); pg.wait_for_timeout(300)
    print("hint shown:", pg.locator(".swipehint").is_visible())
    s0=st(); swipe(100,500,330,505,shot=f"{OUT}/swipe_yes.png"); s1=st()
    print("right swipe:", s0, "->", s1, "| answered:", pg.evaluate("(k)=>S.job.checks[k].v", s0["key"]))
    swipe(300,500,60,505,shot=f"{OUT}/swipe_no.png"); s2=st()
    print("left swipe:", s2, "| note box visible:", pg.locator(".gobs textarea").is_visible())
    pg.screenshot(path=f"{OUT}/swipe_after_no.png")
    s3=st(); swipe(150,500,190,505); print("short swipe ignored:", st()==s3)
    y=pg.evaluate("()=>scrollY"); swipe(200,600,205,300); print("vertical drag does not answer:", st()==s3)
    print("hint gone after first swipe:", pg.locator(".swipehint").count()==0)
    pg.click('.stepbar .sb-next', timeout=5000); print("step bar tappable after swipes:", pg.evaluate("()=>S.view")=="management")
    b.close()
srv.shutdown(); print("errors:", errs or "none")
