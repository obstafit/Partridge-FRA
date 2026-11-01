import http.server, threading, functools, sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else "/tmp"
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8795),functools.partial(Q,directory=__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)),"dist","pwa"))); threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8795/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.wait_for_timeout(200)
    print("persist asked:", pg.evaluate("()=>S.persisted"))
    pg.click('.tabbar button[data-view="checks"]'); pg.wait_for_timeout(200)
    # find an unanswered check and open library
    pg.click('.gmore [data-act="libopen"]'); pg.wait_for_timeout(200)
    first=pg.locator('.libpick strong').first.inner_text(); print("top suggestion for this check:", first, "| check:", pg.evaluate("()=>{const c=checkList().filter(c=>c.sec===S.sec)[S.gi];return c.text}"))
    pg.fill('#libq','wedged'); pg.wait_for_timeout(100)
    vis=pg.evaluate("()=>[...document.querySelectorAll('.liblist li')].filter(l=>!l.hidden).map(l=>l.querySelector('strong').textContent)"); print("search 'wedged':", vis)
    pg.screenshot(path=f"{OUT}/lib_sheet.png")
    pg.locator('.liblist li:not([hidden]) .libpick').first.click(); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/lib_card.png")
    key=pg.evaluate("()=>Object.keys(S.job.checks).find(k=>S.job.checks[k].act)"); print("check set:", pg.evaluate("(k)=>S.job.checks[k]",key))
    pg.click('.tabbar button[data-view="actions"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="draft-actions"]'); pg.wait_for_timeout(200)
    a=pg.evaluate("(k)=>S.job.actions.find(a=>a.src==='check:'+k)",key); print("drafted action:", a["action"][:70], a["priority"], a["basis"])
    # save an action to My findings, then reload and confirm it persists
    pg.evaluate("()=>{S.job.actions[0].action='Test custom wording for my library.'; S.job.actions[0].priority='M'; render();}")
    pg.click('[data-act="libsave"][data-i="0"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="libopen"]:not([data-key])'); pg.wait_for_timeout(200)
    print("mine first:", pg.locator('.libpick small').first.inner_text()[:40], "| has delete:", pg.locator('.libdel').count())
    pg.click('.libpick >> nth=0'); pg.wait_for_timeout(200); print("actions now:", pg.evaluate("()=>S.job.actions.length"))
    pg.screenshot(path=f"{OUT}/lib_actions.png")
    pg.reload(); pg.wait_for_selector(".jobcard"); pg.wait_for_timeout(300); print("library after reload:", pg.evaluate("()=>LIB.mine.length"))
    # PDF size with 20 large photos
    pg.click(".jobcard"); pg.wait_for_timeout(200)
    r=pg.evaluate("""async()=>{ const ids=[]; let raw=0;
      for(let i=0;i<20;i++){ const cv=document.createElement('canvas'); cv.width=1600; cv.height=1200; const g=cv.getContext('2d');
        const gr=g.createLinearGradient(0,0,1600,1200); gr.addColorStop(0,'#8a7'); gr.addColorStop(1,'#345'); g.fillStyle=gr; g.fillRect(0,0,1600,1200);
        for(let k=0;k<4000;k++){ g.fillStyle=`hsl(${Math.random()*360},40%,${30+Math.random()*40}%)`; g.fillRect(Math.random()*1600,Math.random()*1200,6+Math.random()*30,6+Math.random()*30); }
        const data=cv.toDataURL('image/jpeg',0.72); raw+=data.length*0.75; const id='t'+i; await Store.put('photos',{id,data}); S.photoCache.set(id,data); ids.push(id); }
      const ks=checkList().slice(0,20); ks.forEach((c,i)=>{ S.job.checks[c.key]={v:'No',obs:'test',photos:[ids[i]]}; });
      let doc=await buildReport(S.job); if(Object.keys(doc._photoPage||{}).length) doc=await buildReport(S.job,doc._photoPage);
      return {rawMB:(raw/1e6).toFixed(1), pdfMB:(doc.output('blob').size/1e6).toFixed(1)}; }""")
    print("20 photos: originals", r["rawMB"], "MB -> PDF", r["pdfMB"], "MB")
    b.close()
srv.shutdown(); print("errors:", errs or "none")
