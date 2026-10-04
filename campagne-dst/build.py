"""Génère les affiches HTML de la campagne DST (une page 1080x1350 ou 1080x1920 par fichier).
Les images pointent vers raw.githubusercontent.com pour l'import Canva."""
import os, re, sys, importlib

BASE = "https://raw.githubusercontent.com/thomasdankou-beep/loc-connect/claude/project-thread-qolnhy/campagne-dst/assets/"
HERE = os.path.dirname(os.path.abspath(__file__))

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#ccc}
.page{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:'Inter',sans-serif;color:#fff;background:#061340}
.page.story{height:1920px}
.h{font-family:'Montserrat',sans-serif;font-weight:800;line-height:.98;letter-spacing:-1.5px}
.blk{font-family:'Montserrat',sans-serif;font-weight:900}
.pf{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;letter-spacing:0}
.abs{position:absolute}
.tag{position:absolute;left:80px;top:72px;padding:12px 26px;border-radius:40px;font:700 24px 'Montserrat';letter-spacing:2px;text-transform:uppercase}
.tag.dark{background:rgba(255,255,255,.12);color:#fff;border:1.5px solid rgba(255,255,255,.35)}
.tag.light{background:#E6EEFC;color:#0062E6}
.cta{white-space:nowrap;position:absolute;left:80px;bottom:212px;background:#47B73F;color:#fff;font:800 30px 'Montserrat';letter-spacing:1px;padding:26px 46px;border-radius:60px;text-transform:uppercase}
.sig{position:absolute;left:0;right:0;bottom:0;height:172px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 80px}
.sig img{height:118px}
.sig .ct{text-align:right;color:#061340}
.sig .tel{font:800 40px 'Montserrat';letter-spacing:.5px}
.sig .web{font:600 28px 'Inter';color:#0062E6;margin-top:4px}
.demo{position:absolute;font:500 20px 'Inter';letter-spacing:.5px;opacity:.75}
.card{background:#fff;color:#061340;border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.phone{border-radius:56px;border:14px solid #0B1020;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.45);background:#000}
.phone img{width:100%;display:block}
"""

HEAD = """<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{css}{extra}</style></head><body>
<div class="page{cls}" data-document-role="page" data-label="{title}">
{body}
</div></body></html>"""


def A(name):
    return BASE + name


def sig():
    return f"""<div class="sig"><img src="{A('logo-dst.png')}" alt="Logo DST TECHNOLOGIE"><div class="ct"><div class="tel">05 03 20 6666</div><div class="web">dsttechnologie.com</div></div></div>"""


def page(title, body, extra="", story=False):
    return HEAD.format(title=title, css=CSS, extra=extra, cls=" story" if story else "", body=body)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    mod = importlib.import_module("posters_def")
    only = sys.argv[1:]
    for key, fn in mod.POSTERS.items():
        if only and key not in only:
            continue
        title, body, extra, story = fn()
        body = re.sub(r"(?<=[\w»)\.]) ([?!:;»])", "\u00a0\\1", body)
        body = body.replace("« ", "«\u00a0")
        with open(os.path.join(HERE, "posters", f"{key}.html"), "w") as f:
            f.write(page(title, body + sig(), extra, story))
        print("ok", key)
