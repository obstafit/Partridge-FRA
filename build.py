"""Build the Partridge FRA app.

dist/pwa/      installable offline web app (host the folder on any HTTPS static host)
dist/preview.html   single-file preview for publishing as a claude.ai artifact
"""
import json, os, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, DIST = os.path.join(ROOT, "src"), os.path.join(ROOT, "dist")
VERSION = "2.8.0"

def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()

FONT = os.path.join(ROOT, "vendor", "fonts", "inter-latin-wght-normal.woff2")

def fontface(src):
    """Inter (SIL OFL 1.1, vendor/fonts), bundled so the app looks the same offline. Latin subset, variable weight."""
    return ('@font-face{font-family:"Inter";font-style:normal;font-display:swap;font-weight:100 900;src:url(' + src + ') format("woff2");'
            'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}')

def assemble(jspdf_tag, pwa_head="", font_src="inter-latin-wght-normal.woff2"):
    html = read("index.html").replace("/*FONTFACE*/", fontface(font_src))
    html = html.replace("/*PROFILE*/", read("profile_hmo.js") + "\n" + read("profile_flats.js") + "\n" + read("profile_smallconv.js"))
    html = html.replace("/*APP*/", read("app.js") + "\n" + read("library.js") + "\n" + read("ai.js"))
    html = html.replace("/*PDF*/", read("pdf.js"))
    html = html.replace("<!--JSPDF-->", jspdf_tag)
    html = html.replace("<!--PWA_HEAD-->", pwa_head)
    return html

def icon(size, path):
    im = Image.new("RGB", (size, size), (32, 41, 45))
    d = ImageDraw.Draw(im)
    d.rectangle([0, int(size * 0.74), size, int(size * 0.79)], fill=(239, 101, 11))
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.3))
    except OSError:
        f = ImageFont.load_default()
    t = "FRA"
    w = d.textlength(t, font=f)
    d.text(((size - w) / 2, size * 0.3), t, font=f, fill=(255, 255, 255))
    im.save(path)

def main():
    shutil.rmtree(DIST, ignore_errors=True)
    pwa = os.path.join(DIST, "pwa")
    os.makedirs(pwa)
    shutil.copy(os.path.join(ROOT, "vendor", "jspdf.umd.min.js"), pwa)
    shutil.copy(FONT, pwa); shutil.copy(os.path.join(ROOT, "vendor", "fonts", "Inter-OFL.txt"), pwa)
    icon(192, os.path.join(pwa, "icon-192.png"))
    icon(512, os.path.join(pwa, "icon-512.png"))
    head = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">\n'
            '<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'body{margin:0}[hidden]{display:none!important}*,*::before,*::after{box-sizing:border-box}img{max-width:100%}</style>')
    body = assemble('<script src="jspdf.umd.min.js"></script>', head)
    doc = ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           + body.replace("<style>", "<style>", 1) + "\n</html>\n")
    with open(os.path.join(pwa, "index.html"), "w", encoding="utf-8") as f:
        f.write(doc)
    manifest = {"name": "Partridge FRA", "short_name": "Partridge FRA", "start_url": "./", "scope": "./",
                "display": "standalone", "orientation": "any", "background_color": "#F3F4F2", "theme_color": "#20292D",
                "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
    with open(os.path.join(pwa, "manifest.webmanifest"), "w") as f:
        json.dump(manifest, f, indent=2)
    sw = f"""const CACHE = "pfs-fra-{VERSION}";
const SHELL = ["./", "index.html", "jspdf.umd.min.js", "inter-latin-wght-normal.woff2", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {{
  const req = e.request; if (req.method !== "GET") return;
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || fetch(req).then((res) => {{
    if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes("fonts.g"))) {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }}
    return res;
  }}).catch(() => caches.match("index.html"))));
}});
"""
    with open(os.path.join(pwa, "sw.js"), "w") as f:
        f.write(sw)
    with open(os.path.join(pwa, "README.txt"), "w") as f:
        f.write("Partridge FRA app v" + VERSION + "\n\nHost this folder on any HTTPS static host (for example Netlify Drop:"
                " drag the folder onto app.netlify.com/drop). Open the address on the tablet, then use the browser's"
                " 'Install app' or 'Add to Home Screen'. After the first visit it works with no signal.\n"
                "Jobs and photos are stored on the tablet. Use Export all jobs regularly to keep a backup.\n")
    import base64
    with open(FONT, "rb") as f:
        font_uri = "data:font/woff2;base64," + base64.b64encode(f.read()).decode()
    preview = assemble('<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>', font_src=font_uri)
    with open(os.path.join(DIST, "preview.html"), "w", encoding="utf-8") as f:
        f.write(preview)
    shutil.make_archive(os.path.join(DIST, "Partridge-FRA-app"), "zip", pwa)
    print("built", VERSION)

if __name__ == "__main__":
    main()
