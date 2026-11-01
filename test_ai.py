import http.server, os, sys, threading, functools
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=sys.argv[1]
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT,"dist","pwa"))
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8772),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
MOCK = """
window.__calls=[];
const fake = async (input, opts) => {
  window.__calls.push({n: input.length, first: input[0].content, tools: (opts.tools||[]).map(t=>t.name), imgs: (opts.images||[]).length});
  let extra = "";
  if (opts.tools) { const s = await opts.tools[0].execute({n:6}); const a = await opts.tools[1].execute({}); extra = ` [section 6 checks: ${s.checks.length}, items: ${s.items.length}; actions: ${a.actions.length}]`; }
  const text = "Mock answer." + extra;
  opts.onText && opts.onText({text, delta: text});
  return {text, truncated:false};
};
fake.limits = async () => ({ images: {maxCount: 3, maxBytes: 5e6, mediaTypes: ["image/jpeg","image/png"]}, tools: {maxTools: 8} });
window.claude = { use: async (n) => n === "sample" ? fake : null };
"""
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":1180,"height":900}).new_page()
    pg.add_init_script(MOCK); pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8772/index.html"); pg.wait_for_selector(".jobcard"); pg.click(".jobcard"); pg.wait_for_timeout(300)
    pg.click('.rail button[data-view="checks"]'); pg.wait_for_timeout(200)
    print("Ask button:", pg.locator('.aifab').count())
    pg.locator('textarea[data-bind^="checks."]').first.click()
    pg.click('.aifab'); pg.wait_for_timeout(200)
    print("chips:", pg.locator('.aichips button').all_inner_texts())
    pg.click('.aichips button:has-text("Review before issue")'); pg.wait_for_timeout(600)
    print("reply:", pg.locator('.aim.a .aitext').last.inner_text())
    c=pg.evaluate("window.__calls[0]"); print("tools sent:", c["tools"], "| context has benchmarks:", "Benchmarks shown" in c["first"], "| last field:", "Field the assessor last used" in c["first"])
    pg.set_input_files('input[data-ai="pic"]', f"{OUT}/p0.jpg"); pg.wait_for_timeout(200)
    pg.click('.aiform button.primary'); pg.wait_for_timeout(600)
    print("photo call imgs:", pg.evaluate("window.__calls[1].imgs"))
    ins = pg.locator('[data-ai="insert"]'); print("insert buttons:", ins.count())
    ins.last.click(); pg.wait_for_timeout(200)
    print("inserted into field:", pg.locator('textarea[data-bind^="checks."]').first.input_value()[:60])
    pg.screenshot(path=f"{OUT}/ai.png")
    b.close()
srv.shutdown(); print("errors:", errs or "none")
