from build import A

LOCK = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#47B73F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
CHECK = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'
CROSS = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'


def chk(s=34, c="#47B73F"):
    return CHECK.format(s=s, c=c)


def crs(s=34, c="#8A94A6"):
    return CROSS.format(s=s, c=c)


NIGHT_BG = "background:radial-gradient(900px 700px at 80% 10%,#0A3BA8 0%,rgba(10,42,122,0) 60%),radial-gradient(800px 800px at 0% 90%,#0A2A7A 0%,rgba(6,19,64,0) 60%),#061340;"


def j01():
    body = f"""
<div class="abs" style="inset:0;{NIGHT_BG}"></div>
<div class="tag dark">30 jours · On vous montre</div>
<div class="abs" style="left:150px;top:300px;width:780px;height:300px;border-radius:50%;background:#0062E6;opacity:.35;filter:blur(90px)"></div>
<div class="abs" style="left:80px;top:250px;width:920px;height:150px;background:#fff;border-radius:80px;display:flex;align-items:center;padding:0 52px;gap:26px;box-shadow:0 0 0 10px rgba(0,98,230,.35),0 30px 80px rgba(0,98,230,.55)">
  {LOCK}<span style="font:700 60px 'Montserrat';color:#061340;letter-spacing:-1px">votre-entreprise<span style="color:#0062E6">.com</span></span></div>
<div class="abs" style="left:540px;top:400px;width:3px;height:120px;background:linear-gradient(#0062E6,rgba(0,98,230,0))"></div>
<div class="abs" style="left:80px;top:560px;width:920px">
<div class="h" style="font-size:94px">VOTRE ENTREPRISE,<br> <span style="color:#4D9BFF">À VOTRE ADRESSE.</span></div>
<div style="margin-top:44px;font-size:40px;line-height:1.3;color:#C9D6F2">Les réseaux vous prêtent une place.<br><b style="color:#fff">Un site vous en donne une.</b></div></div>
<div class="cta">Parlons de votre projet</div>
"""
    return "J01 - Votre entreprise, à votre adresse", body, "", False


def j05():
    body = f"""
<img class="abs" src="{A('real-salon.jpg')}" style="left:0;top:0;width:1080px;height:1350px;object-fit:cover;object-position:50% 20%">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(6,19,64,.94) 0%,rgba(6,19,64,.78) 30%,rgba(6,19,64,0) 55%,rgba(6,19,64,0) 70%,rgba(6,19,64,.55) 100%)"></div>
<div class="tag dark">Salons de beauté</div>
<div class="abs" style="left:80px;top:170px;width:920px">
<div class="h" style="font-size:96px">VOS CLIENTES RÉSERVENT.<br><span style="color:#4D9BFF">VOUS COIFFEZ.</span></div>
<div style="margin-top:36px;width:620px;font-size:36px;line-height:1.3;color:#DCE6FA">Rendez-vous et acompte en ligne, sans répondre à 30 messages.</div></div>
<div class="card abs" style="left:520px;top:700px;width:480px;padding:30px 34px">
  <div style="display:flex;align-items:center;gap:14px"><div style="width:52px;height:52px;border-radius:50%;background:#E8F6E6;display:flex;align-items:center;justify-content:center">{chk(30)}</div><div style="font:800 28px 'Montserrat'">Rendez-vous confirmé</div></div>
  <div style="margin-top:20px;font:600 30px 'Inter'">Tresses · samedi 10:00</div>
  <div style="margin-top:10px;font:500 24px 'Inter';color:#5A6785">Acompte 5 000 FCFA versé via Wave</div>
</div>
<div class="demo" style="left:520px;top:940px;color:#fff">Exemple de démonstration</div>
<div class="cta">Découvrez la démo salon</div>
"""
    return "J05 - Salon de beauté", body, "", False


POSTERS = {"j01": j01, "j05": j05}
