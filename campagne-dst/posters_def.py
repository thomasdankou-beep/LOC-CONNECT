"""Les 30 affiches de la campagne DST TECHNOLOGIE. Chaque fonction renvoie (titre, corps HTML, css en plus, format story)."""
from build import A

def ico(name, w, h=None):
    return f'<img src="{A("ico-" + name + ".png")}" style="width:{w}px;height:{h or w}px;flex:none">'


LOCK = ico("lock-green", 44)


def chk(s=34, c=None, w=None):
    return ico("chk-green", s)


def crs(s=34, c=None):
    return ico("crs-grey", s)


def arrow(w=120, c="#4D9BFF"):
    return ico("arrow-light" if c == "#4D9BFF" else "arrow-blue", w, int(w / 3))


def search_ico(s=40, c="#5A6785"):
    return ico("search-grey" if c == "#5A6785" else "search-light", s)


NIGHT = "background:radial-gradient(900px 700px at 85% 5%,#0B3FB0 0%,rgba(10,42,122,0) 62%),radial-gradient(800px 800px at 0% 95%,#0A2A7A 0%,rgba(6,19,64,0) 60%),#061340;"
NIGHT2 = "background:radial-gradient(1000px 800px at 50% 45%,#0A3BA8 0%,rgba(6,19,64,0) 65%),#061340;"
LIGHT = "background:#F3F6FC;"
WHITE = "background:#FFFFFF;"


def bg(style):
    return f'<div class="abs" style="left:0;top:0;width:1080px;height:1350px;{style}"></div>'


def phone(img, left, top, w, h, extra="", pos="top"):
    return f'<div class="phone abs" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;{extra}"><img src="{A(img)}" style="width:100%;height:100%;object-fit:cover;object-position:{pos}"></div>'


def laptop(img, left, top, w, extra=""):
    sh = int(w * 0.625)
    return f'''<div class="abs" style="left:{left}px;top:{top}px;width:{w}px;{extra}">
<div style="margin:0 auto;width:{int(w*0.86)}px;height:{int(sh*0.86)}px;border:12px solid #0B1020;border-bottom-width:16px;border-radius:22px 22px 0 0;overflow:hidden;background:#000"><img src="{A(img)}" style="width:100%;height:100%;object-fit:cover;object-position:top"></div>
<div style="width:{w}px;height:22px;background:#C9D1DE;border-radius:0 0 26px 26px"></div></div>'''


def text(left, top, width, inner):
    return f'<div class="abs" style="left:{left}px;top:{top}px;width:{width}px">{inner}</div>'


def demo(left, top, color="#fff"):
    return f'<div class="demo" style="left:{left}px;top:{top}px;color:{color}">Exemple de démonstration</div>'


def tag(label, dark=True):
    return f'<div class="tag {"dark" if dark else "light"}">{label}</div>'


def cta(label):
    return f'<div class="cta">{label}</div>'


SUB = "font-size:38px;line-height:1.3;"
BLUE_L = "#4D9BFF"


# ---------------- SEMAINE 1 ----------------
def j01():
    b = bg(NIGHT) + tag("30 jours · On vous montre")
    b += '<div class="abs" style="left:60px;top:140px;width:960px;height:420px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,98,230,.55),rgba(0,98,230,0))"></div>'
    b += f'''<div class="abs" style="left:80px;top:250px;width:920px;height:150px;background:#fff;border-radius:80px;display:flex;align-items:center;padding:0 52px;gap:26px;border:8px solid #2E7BFF">
  {LOCK}<span style="font:700 60px 'Montserrat';color:#061340;letter-spacing:-1px">votre-entreprise<span style="color:#0062E6">.com</span></span></div>'''
    b += text(80, 500, 920, f'<div class="h" style="font-size:94px">VOTRE ENTREPRISE,<br><span style="color:{BLUE_L}">À VOTRE ADRESSE.</span></div><div style="margin-top:44px;{SUB}color:#C9D6F2">Les réseaux vous prêtent une place.<br><b style="color:#fff">Un site vous en donne une.</b></div>')
    return "J01 - Votre entreprise, à votre adresse", b + cta("Parlons de votre projet"), "", False


def bubble(t, side="l", dark=False):
    bgc = "#fff" if not dark else "#DCF8C6"
    al = "flex-start" if side == "l" else "flex-end"
    return f'<div style="display:flex;justify-content:{al}"><div style="background:{bgc};color:#111B21;border-radius:18px;padding:12px 18px;font:500 22px Inter;max-width:270px;box-shadow:0 2px 4px rgba(0,0,0,.08)">{t}</div></div>'


def chat_phone(left, top, w=330, h=560, msgs=None, header="Messages clients", badge=None, rot=0):
    msgs = msgs or []
    inner = "".join(f'<div style="margin-top:12px">{m}</div>' for m in msgs)
    bd = f'<div style="margin-left:auto;background:#0062E6;color:#fff;font:700 20px Inter;border-radius:20px;padding:4px 12px">{badge}</div>' if badge else ""
    return f'''<div class="phone abs" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;background:#EFE7DE;transform:rotate({rot}deg)">
<div style="background:#1F2C34;color:#fff;padding:22px 20px;display:flex;align-items:center;gap:12px;font:600 22px Inter"><div style="width:40px;height:40px;border-radius:50%;background:#8A94A6"></div>{header}{bd}</div>
<div style="padding:4px 16px">{inner}</div></div>'''


def j02():
    b = bg(LIGHT) + tag("Le saviez-vous ?", dark=False)
    b += text(80, 160, 920, f'<div class="h" style="font-size:76px;color:#061340">WHATSAPP NE DOIT PAS ÊTRE VOTRE <span style="color:#0062E6">SEULE VITRINE.</span></div><div style="margin-top:24px;font-size:32px;line-height:1.3;color:#33415F">Gardez WhatsApp pour parler. <b style="color:#061340">Ajoutez un site pour vendre.</b></div>')
    msgs = [bubble("C'est combien ?"), bubble("C'est dispo en noir ?"), bubble("Vous livrez à Yopougon ?"), bubble("Allô ?? Vous êtes là ?")]
    b += chat_phone(120, 500, 320, 440, msgs, "Clients", "+27", rot=-6)
    b += '<div class="abs" style="left:225px;top:930px;width:110px;height:34px;background:#C9D1DE;border-radius:50%"></div>'
    b += laptop("d-perruques-shop.jpg", 500, 560, 500)
    b += '<div class="abs" style="left:470px;top:900px;width:560px;height:30px;background:radial-gradient(closest-side,rgba(6,19,64,.18),rgba(6,19,64,0))"></div>'
    b += text(110, 985, 340, '<div style="font:700 24px Montserrat;color:#5A6785;text-align:center;letter-spacing:1px">POUR DISCUTER</div>')
    b += text(500, 985, 500, '<div style="font:700 24px Montserrat;color:#0062E6;text-align:center;letter-spacing:1px">POUR VENDRE</div>')
    return "J02 - WhatsApp ne doit pas être votre seule vitrine", b + cta("Discutez avec DST"), "", False


def j03():
    b = bg(WHITE)
    b += '<div class="abs" style="left:0;top:330px;width:540px;height:848px;background:#E9ECF1"></div>'
    b += '<div class="abs" style="left:540px;top:330px;width:540px;height:848px;background:#061340"></div>'
    b += tag("Avant / Après", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:80px;color:#061340">MÊME ENTREPRISE. <span style="color:#0062E6">AUTRE DIMENSION.</span></div>')
    b += text(80, 380, 400, '<div style="font:800 34px Montserrat;color:#8A94A6;letter-spacing:4px">AVANT</div>')
    note = "".join(f'<div style="border-bottom:2px solid #C5D3E8;height:44px;font:400 22px \'Space Mono\';color:#59627A;padding-top:10px">{t}</div>' for t in ["Awa · 2 perruques ?", "Fatou · payé ??", "Rappeler Mme K.", "Livraison... ?", ""])
    b += f'<div class="abs" style="left:80px;top:450px;width:380px;height:290px;background:#FFFDF5;border-radius:10px;padding:20px 26px;transform:rotate(-3deg);border-left:10px solid #E0B4B4">{note}</div>'
    items_av = ["Commandes dans un cahier", "Messages perdus", "Paiement à la livraison"]
    b += text(80, 790, 420, "".join(f'<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;font:600 27px Inter;color:#59627A">{crs(30)}{t}</div>' for t in items_av))
    b += text(600, 380, 420, '<div style="font:800 34px Montserrat;color:#4D9BFF;letter-spacing:4px">APRÈS</div>')
    b += phone("m-perruques-shop.jpg", 620, 450, 240, 330, "border-width:10px;border-radius:36px")
    b += '<div class="demo" style="left:880px;top:735px;width:150px;color:#9FB4DA;font-size:18px">Exemple de démonstration</div>'
    items_ap = ["Commandes en ligne", "Paiement mobile money", "Clients organisés"]
    b += text(600, 820, 440, "".join(f'<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;font:600 27px Inter;color:#fff">{chk(30)}{t}</div>' for t in items_ap))
    return "J03 - Avant / Après", b + cta("Votre projet commence ici"), "", False


def j04():
    b = bg(NIGHT) + tag("Le saviez-vous ?")
    b += text(80, 160, 920, f'<div class="h" style="font-size:88px">4 RAISONS D\'AVOIR <span style="color:{BLUE_L}">VOTRE SITE.</span></div><div style="margin-top:24px;font-size:34px;color:#C9D6F2">Et aucune n\'est « faire comme tout le monde ».</div>')
    rs = [("Être trouvé", "sur Google, pas seulement sur les réseaux."), ("Rassurer", "avant même le premier message."), ("Vendre", "même quand vous dormez."), ("S'organiser", "clients et commandes enfin rangés.")]
    for i, (t, d) in enumerate(rs):
        b += f'''<div class="card abs" style="left:{80+i*40}px;top:{440+i*150}px;width:800px;height:130px;display:flex;align-items:center;gap:30px;padding:0 36px">
<div class="blk" style="font-size:72px;color:#0062E6;width:60px">{i+1}</div><div><div style="font:800 34px Montserrat">{t}</div><div style="font:500 26px Inter;color:#5A6785;margin-top:4px">{d}</div></div></div>'''
    return "J04 - 4 raisons d'avoir votre site", b + cta("Demandez votre devis"), "", False


def j05():
    b = f'<img class="abs" src="{A("real-salon.jpg")}" style="left:0;top:0;width:1080px;height:1350px;object-fit:cover;object-position:50% 20%">'
    b += '<div class="abs" style="left:0;top:0;width:1080px;height:1350px;background:linear-gradient(180deg,rgba(6,19,64,.94) 0%,rgba(6,19,64,.8) 32%,rgba(6,19,64,0) 56%,rgba(6,19,64,0) 68%,rgba(6,19,64,.6) 100%)"></div>'
    b += tag("Salons de beauté")
    b += text(80, 165, 920, f'<div class="h" style="font-size:96px">VOS CLIENTES RÉSERVENT.<br><span style="color:{BLUE_L}">VOUS COIFFEZ.</span></div><div style="margin-top:34px;width:640px;font-size:36px;line-height:1.3;color:#DCE6FA">Rendez-vous et acompte en ligne, sans répondre à 30 messages.</div>')
    b += f'''<div class="card abs" style="left:520px;top:690px;width:480px;padding:30px 34px">
  <div style="display:flex;align-items:center;gap:14px"><div style="width:52px;height:52px;border-radius:50%;background:#E8F6E6;display:flex;align-items:center;justify-content:center">{chk(30)}</div><div style="font:800 28px Montserrat">Rendez-vous confirmé</div></div>
  <div style="margin-top:20px;font:600 30px Inter">Tresses · samedi 10:00</div>
  <div style="margin-top:10px;font:500 24px Inter;color:#5A6785">Acompte 5 000 FCFA versé via Wave</div></div>'''
    b += demo(520, 945)
    return "J05 - Salon de beauté", b + cta("Découvrez la démo salon"), "", False


def j06():
    b = bg("background:linear-gradient(160deg,#FFFFFF 0%,#EEF2FA 100%);") + tag("Vendeuses de perruques", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:80px;color:#061340">VOS PERRUQUES MÉRITENT UNE <span class="pf" style="color:#0062E6;font-size:92px">vraie</span> BOUTIQUE.</div><div style="margin-top:22px;font-size:30px;line-height:1.3;color:#33415F">Catalogue, panier, paiement mobile money. Même à 23h.</div>')
    b += f'<div class="abs" style="left:430px;top:530px;width:570px;height:470px;border-radius:30px;overflow:hidden"><img src="{A("real-perruques.jpg")}" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%"></div>'
    b += phone("m-perruques-shop.jpg", 110, 510, 280, 500, "", "top")
    b += demo(110, 1020, "#5A6785")
    return "J06 - Vendeuse de perruques", b + cta("Créez votre boutique"), ".cta{left:auto;right:80px}", False


def j07():
    b = bg(NIGHT)
    b += f'<img class="abs" src="{A("real-restaurant.jpg")}" style="left:0;top:0;width:1080px;height:660px;object-fit:cover;object-position:50% 50%">'
    b += '<div class="abs" style="left:0;top:380px;width:1080px;height:330px;background:linear-gradient(180deg,rgba(6,19,64,0),#061340)"></div>'
    b += tag("Restaurants")
    b += f'''<div class="abs" style="left:610px;top:170px;width:380px;background:#fff;color:#111;padding:28px 30px 34px;transform:rotate(4deg);font-family:'Space Mono',monospace;border-radius:6px">
<div style="font-weight:700;font-size:24px;text-align:center">VOTRE RESTAURANT</div>
<div style="border-top:2px dashed #999;margin:14px 0"></div>
<div style="font-size:22px;line-height:1.6">Commande à emporter<br>2 plats<br>Payée avec Orange Money</div>
<div style="border-top:2px dashed #999;margin:14px 0"></div>
<div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:24px;color:#2E8B2A">{chk(30)} Envoyée en cuisine</div></div>'''
    b += demo(640, 590)
    b += text(80, 640, 920, f'<div class="h" style="font-size:84px">LA COMMANDE ARRIVE.<br><span style="color:{BLUE_L}">DÉJÀ PAYÉE.</span></div><div style="margin-top:26px;font-size:32px;line-height:1.3;color:#C9D6F2">Menu en ligne, commande à emporter,<br>paiement mobile money.</div>')
    return "J07 - Restaurant", b + cta("Parlons de votre menu"), "", False


# ---------------- SEMAINE 2 ----------------
def j08():
    b = bg(NIGHT) + tag("Événementiel & décoration")
    b += text(80, 160, 920, f'<div class="h" style="font-size:64px">VOS PLUS BEAUX ÉVÉNEMENTS NE DISPARAISSENT <span style="color:{BLUE_L}">PLUS EN 24H.</span></div><div style="margin-top:22px;font-size:30px;line-height:1.3;color:#C9D6F2">Une galerie en ligne qui vous présente, et des demandes de devis qui arrivent seules.</div>')
    b += f'''<div class="abs" style="left:80px;top:550px;width:780px;height:430px;background:#fff;border-radius:20px;overflow:hidden">
<div style="height:50px;background:#E7ECF5;display:flex;align-items:center;gap:10px;padding:0 20px"><span style="width:14px;height:14px;border-radius:50%;background:#C5CEDC"></span><span style="width:14px;height:14px;border-radius:50%;background:#C5CEDC"></span><span style="width:14px;height:14px;border-radius:50%;background:#C5CEDC"></span><span style="margin-left:20px;background:#fff;border-radius:14px;padding:4px 18px;font:500 18px Inter;color:#5A6785">votre-evenement.com/galerie</span></div>
<img src="{A("real-evenementiel.jpg")}" style="width:100%;height:380px;object-fit:cover"></div>'''
    b += f'''<div class="card abs" style="left:600px;top:810px;width:400px;padding:24px 28px">
<div style="font:800 24px Montserrat;color:#0062E6">NOUVELLE DEMANDE DE DEVIS</div>
<div style="margin-top:10px;font:600 28px Inter">Mariage · 250 invités</div><div style="margin-top:6px;font:500 22px Inter;color:#5A6785">Samedi 14 novembre</div></div>'''
    b += demo(600, 1000)
    return "J08 - Prestataire événementiel", b + cta("Demandez votre devis"), "", False


def j09():
    b = f'<img class="abs" src="{A("real-boutique.jpg")}" style="left:0;top:0;width:1080px;height:1350px;object-fit:cover;object-position:50% 40%">'
    b += '<div class="abs" style="left:0;top:0;width:1080px;height:1350px;background:linear-gradient(180deg,rgba(6,19,64,.95) 0%,rgba(6,19,64,.75) 40%,rgba(6,19,64,.55) 100%)"></div>'
    for i in range(14):
        b += f'<div class="abs" style="left:0;top:{480+i*24}px;width:560px;height:14px;background:#7D8698;opacity:.55"></div>'
    b += '<div class="abs" style="left:0;top:816px;width:560px;height:10px;background:#3A4357"></div>'
    b += tag("Boutiques")
    b += text(80, 160, 920, f'<div class="h" style="font-size:70px">LE RIDEAU SE BAISSE.<br><span style="color:{BLUE_L}">LA BOUTIQUE RESTE OUVERTE.</span></div>')
    b += phone("m-boutique.jpg", 640, 510, 300, 500)
    b += '<div class="abs" style="left:590px;top:490px;background:#47B73F;color:#fff;font:800 28px Montserrat;padding:12px 26px;border-radius:30px;letter-spacing:2px">● OUVERT</div>'
    b += text(80, 860, 520, '<div style="font-size:32px;line-height:1.3;color:#DCE6FA">Votre boutique en ligne vend pendant que vous rentrez chez vous.</div>')
    b += demo(700, 1020)
    return "J09 - Boutique", b + cta("Créez votre boutique en ligne"), "", False


def j10():
    b = bg(WHITE)
    b += f'<img class="abs" src="{A("closing-photo.jpg")}" style="left:560px;top:0;width:520px;height:1178px;object-fit:cover;object-position:40% 30%">'
    b += tag("Entreprises de services", dark=False)
    b += text(80, 170, 460, '<div class="h" style="font-size:70px;color:#061340">VOTRE CLIENT VOUS JUGE <span style="color:#0062E6">AVANT</span> DE VOUS APPELER.</div><div style="margin-top:34px;font-size:32px;line-height:1.35;color:#33415F">Un site clair qui présente vos services et fixe les rendez-vous.</div>')
    b += f'''<div class="card abs" style="left:420px;top:780px;width:420px;padding:24px 28px;border:1px solid #E3E8F2">
<div style="display:flex;gap:12px;align-items:center"><div style="width:46px;height:46px;border-radius:12px;background:#E6EEFC;display:flex;align-items:center;justify-content:center;font:800 18px Montserrat;color:#0062E6">RDV</div><div style="font:800 26px Montserrat">Rendez-vous demandé</div></div>
<div style="margin-top:12px;font:500 24px Inter;color:#5A6785">Mardi 9:30 · Devis bureaux</div><div style="margin-top:10px;font:500 16px Inter;color:#8A94A6">Exemple de démonstration</div></div>'''
    return "J10 - Entreprise de services", b + cta("Parlons de votre projet"), "", False


def j11():
    b = bg(WHITE) + tag("Le saviez-vous ?", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:72px;color:#061340">VOTRE CONCURRENT EST PEUT-ÊTRE DÉJÀ <span style="color:#0062E6">SUR GOOGLE.</span></div><div style="margin-top:20px;font-size:32px;color:#33415F">Et vous, à quelle place êtes-vous ?</div>')
    res = ""
    for i in range(3):
        res += f'''<div style="margin-top:22px"><div style="width:{300-i*40}px;height:16px;border-radius:8px;background:#C5CEDC"></div><div style="margin-top:12px;width:{560-i*60}px;height:26px;border-radius:8px;background:#8EB4F0"></div><div style="margin-top:10px;width:{680-i*30}px;height:16px;border-radius:8px;background:#E3E8F2"></div></div>'''
    b += f'''<div class="abs" style="left:80px;top:470px;width:920px;height:540px;background:#F3F6FC;border-radius:28px;padding:34px 40px">
<div style="background:#fff;border-radius:40px;height:76px;display:flex;align-items:center;gap:18px;padding:0 30px;border:2px solid #E3E8F2">{search_ico(34)}<span style="font:500 30px Inter;color:#061340">salon de coiffure Cocody</span></div>
{res}
<div style="margin-top:28px;border:4px dashed #0062E6;border-radius:18px;height:84px;display:flex;align-items:center;justify-content:center;font:800 32px Montserrat;color:#0062E6">Votre entreprise ici ?</div></div>'''
    return "J11 - Votre concurrent est déjà sur Google", b + cta("Soyez trouvé"), "", False


def j12():
    b = bg(NIGHT2)
    b += '<div class="blk abs" style="left:0;top:40px;width:1080px;text-align:center;font-size:760px;line-height:1;color:#0F2E85">?</div>'
    chips = [("traiteur Yopougon", 90, 170), ("perruque livraison Abidjan", 470, 260), ("plombier Marcory", 120, 380), ("location voiture Cocody", 520, 470), ("salon tresses Riviera", 70, 560), ("décoratrice mariage", 560, 650)]
    for t, x, y in chips:
        b += f'<div class="abs" style="left:{x}px;top:{y}px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.35);border-radius:40px;padding:14px 26px;display:flex;gap:12px;align-items:center;font:500 26px Inter;color:#fff">{search_ico(26,"#9FC2FF")}{t}</div>'
    b += text(80, 760, 920, f'<div class="h" style="font-size:66px">COMBIEN DE CLIENTS VOUS CHERCHENT <span style="color:{BLUE_L}">SANS VOUS TROUVER ?</span></div><div style="margin-top:22px;font-size:30px;line-height:1.3;color:#C9D6F2">Personne ne peut vous donner ce chiffre. Mais vous pouvez le faire baisser.</div>')
    b += tag("Question du jour")
    return "J12 - Combien de clients vous cherchent", b + cta("Contactez-nous"), ".cta{bottom:200px}", False


def j13():
    b = bg("background:linear-gradient(170deg,#061340 0%,#0A2A7A 60%,#0062E6 140%);") + tag("Démo · E-commerce")
    b += text(80, 160, 920, '<div class="h" style="font-size:88px">CHOISI.<br>COMMANDÉ. <span style="color:#47B73F">PAYÉ.</span></div><div style="margin-top:20px;font-size:30px;line-height:1.3;color:#C9D6F2">Paiement Wave, Orange Money, MTN et Moov Money.</div>')
    b += phone("m-perruques-shop.jpg", 80, 560, 270, 420, "border-width:10px;border-radius:40px")
    b += phone("m-boutique.jpg", 405, 540, 270, 440, "border-width:10px;border-radius:40px")
    b += f'''<div class="phone abs" style="left:730px;top:560px;width:270px;height:420px;border-width:10px;border-radius:40px;background:#fff;color:#061340;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px">
<div style="width:96px;height:96px;border-radius:50%;background:#E8F6E6;display:flex;align-items:center;justify-content:center">{chk(60)}</div>
<div style="margin-top:18px;font:800 26px Montserrat">Paiement reçu</div><div style="margin-top:8px;font:500 20px Inter;color:#5A6785">via Wave</div><div style="margin-top:14px;font:600 18px Inter;color:#0062E6">Reçu envoyé sur WhatsApp</div></div>'''
    for i, t in enumerate(["1 · Le client choisit", "2 · Il commande", "3 · Il paie"]):
        b += f'<div class="abs" style="left:{80+i*325}px;top:995px;width:270px;text-align:center;font:700 24px Montserrat;color:#fff">{t}</div>'
    b += demo(80, 1040, "#9FB4DA")
    return "J13 - Site e-commerce", b + cta("Créez votre boutique"), ".cta{bottom:200px;left:auto;right:80px}", False


def j14():
    b = bg(WHITE) + tag("Démo · Réservation", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:62px;color:#061340">VOTRE AGENDA SE REMPLIT <span style="color:#0062E6">PENDANT QUE VOUS TRAVAILLEZ.</span></div><div style="margin-top:20px;font-size:30px;color:#33415F">Vos clients choisissent le créneau, vous recevez la réservation.</div>')
    days = "LMMJVSD"
    cells = ""
    booked = {(0, 0): "09:00", (2, 1): "10:00", (4, 0): "11:30", (5, 2): "14:00", (1, 3): "16:00", (5, 0): "09:30", (3, 2): "15:00"}
    head = "".join(f'<div style="width:112px;text-align:center;font:700 26px Montserrat;color:#5A6785">{d}</div>' for d in days)
    for r in range(4):
        row = ""
        for c in range(7):
            k = (c, r)
            if k in booked:
                row += f'<div style="width:112px;height:96px;border-radius:16px;background:#47B73F;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 22px Inter">{booked[k]}<span style="font:500 15px Inter">Réservé</span></div>'
            else:
                row += '<div style="width:112px;height:96px;border-radius:16px;background:#F3F6FC"></div>'
        cells += f'<div style="display:flex;gap:12px;margin-top:12px">{row}</div>'
    b += f'<div class="abs" style="left:80px;top:470px;width:920px;padding:30px 20px;background:#fff;border:2px solid #E3E8F2;border-radius:28px"><div style="display:flex;gap:12px">{head}</div>{cells}</div>'
    b += demo(80, 990, "#5A6785")
    return "J14 - Site de réservation", b + cta("Discutez avec DST"), ".cta{bottom:200px;left:auto;right:80px}", False


# ---------------- SEMAINE 3 ----------------
def j15():
    b = bg(NIGHT) + tag("Démo · Site vitrine")
    b += text(80, 160, 920, f'<div class="h" style="font-size:92px">VOTRE CARTE DE VISITE, <span style="color:{BLUE_L}">EN MIEUX.</span></div><div style="margin-top:24px;font-size:32px;line-height:1.3;color:#C9D6F2">Un site vitrine moderne et rapide, qui présente tout ce que vous faites.</div>')
    b += '''<div class="abs" style="left:80px;top:560px;width:300px;height:180px;background:#fff;border-radius:12px;transform:rotate(-8deg);padding:26px;color:#061340">
<div style="font:800 24px Montserrat">VOTRE ENTREPRISE</div><div style="margin-top:6px;font:500 16px Inter;color:#5A6785">Directeur général</div>
<div style="margin-top:34px;height:8px;width:160px;background:#E3E8F2;border-radius:4px"></div><div style="margin-top:10px;height:8px;width:120px;background:#E3E8F2;border-radius:4px"></div></div>'''
    b += f'<div class="abs" style="left:300px;top:760px">{arrow(130)}</div>'
    b += laptop("d-home.jpg", 440, 520, 580)
    b += text(80, 900, 900, "".join(f'<span style="display:inline-flex;gap:10px;align-items:center;margin-right:30px;font:600 28px Inter">{chk(28)}{t}</span>' for t in ["Vos services", "Vos réalisations", "Contact en 1 clic"]))
    return "J15 - Site vitrine", b + cta("Demandez votre devis"), "", False


def j16():
    b = bg(WHITE) + tag("Image de marque", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:76px;color:#061340">VOTRE IMAGE MÉRITE MIEUX QU\'UN <span style="color:#0062E6">SIMPLE STATUT.</span></div><div style="margin-top:22px;font-size:30px;color:#33415F">24 heures, puis plus rien. Votre site, lui, reste.</div>')
    ring = f'<div style="position:relative;width:300px;height:300px">{ico("ring-24h", 300)}<div style="position:absolute;left:0;top:105px;width:300px;text-align:center;font:800 48px Montserrat;color:#8A94A6">24 h</div><div style="position:absolute;left:0;top:170px;width:300px;text-align:center;font:500 24px Inter;color:#8A94A6">puis disparaît</div></div>'
    b += f'<div class="abs" style="left:110px;top:620px">{ring}</div>'
    b += f'<div class="abs" style="left:430px;top:755px">{arrow(110,"#0062E6")}</div>'
    b += phone("m-home.jpg", 640, 560, 290, 470)
    b += text(110, 950, 300, '<div style="text-align:center;font:700 24px Montserrat;color:#8A94A6;letter-spacing:1px">UN STATUT</div>')
    return "J16 - Votre image mérite mieux qu'un statut", b + cta("Passez au niveau supérieur"), "", False


def j17():
    b = bg(NIGHT) + tag("Vous avez dit…")
    b += '<div class="abs" style="left:80px;top:200px;background:#E7ECF5;color:#061340;border-radius:48px 48px 48px 8px;padding:44px 56px;font:800 72px Montserrat;letter-spacing:-1px">« J\'ai déjà<br>Instagram. »</div>'
    b += '<div class="abs" style="left:300px;top:540px;width:700px;background:#0062E6;color:#fff;border-radius:48px 48px 8px 48px;padding:44px 52px"><div style="font:800 54px Montserrat;line-height:1.05">Parfait.</div><div style="margin-top:18px;font:600 36px Inter;line-height:1.3">Instagram attire les regards. Votre site vend, encaisse et range vos commandes.</div></div>'
    b += '<div class="abs" style="left:300px;top:935px;font:500 24px Inter;color:#9FB4DA">DST TECHNOLOGIE · à l\'instant</div>'
    return "J17 - Objection : j'ai déjà Instagram", b + cta("Parlons-en"), ".cta{left:auto;right:80px}", False


def j18():
    b = bg(WHITE) + tag("Vous avez dit…", dark=False)
    b += text(80, 180, 920, '<div class="h" style="font-size:64px;color:#8A94A6;text-decoration:line-through;text-decoration-color:#0062E6;text-decoration-thickness:8px">« UN SITE, C\'EST TROP CHER. »</div>')
    b += text(80, 340, 920, '<div style="font:700 36px Montserrat;color:#061340">Site vitrine à partir de</div><div class="blk" style="font-size:190px;color:#061340;letter-spacing:-6px;line-height:1;margin-top:10px">50 000</div><div class="blk" style="font-size:90px;color:#0062E6;letter-spacing:-2px">FCFA</div>')
    b += '<div class="abs" style="left:700px;top:330px;background:#47B73F;color:#fff;font:800 28px Montserrat;padding:12px 26px;border-radius:30px;transform:rotate(6deg)">PRIX PROMO</div>'
    b += text(80, 740, 920, '<div style="font-size:30px;line-height:1.4;color:#33415F">Offre valable jusqu\'au 31 décembre 2026.<br>Boutique, réservation, paiement ? Devis détaillé selon votre besoin.</div>')
    return "J18 - Objection : un site coûte trop cher", b + cta("Demandez votre devis"), "", False


def j19():
    b = bg(NIGHT) + tag("Vous avez dit…")
    b += text(80, 160, 920, f'<div class="h" style="font-size:60px">27 MESSAGES NON LUS.<br><span style="color:{BLUE_L}">OU 1 COMMANDE PAYÉE.</span></div>')
    msgs = [bubble("C'est combien ?"), bubble("Vous livrez ?"), bubble("J'ai envoyé par Wave"), bubble("Allô ?? Vous êtes là ?"), bubble("Bon, je vais voir ailleurs")]
    b += chat_phone(90, 400, 380, 590, msgs, "Clients · 23:52", "27")
    rows = "".join(f'<div style="margin-top:24px;display:flex;gap:14px;align-items:center;font:600 26px Inter"><div style="width:46px;height:46px;border-radius:50%;background:#E8F6E6;display:flex;align-items:center;justify-content:center">{chk(28)}</div>{t}</div>' for t in ["Commandée par la cliente", "Payée avec Wave", "Reçu envoyé sur WhatsApp", "Vous validez et livrez"])
    b += f'''<div class="phone abs" style="left:610px;top:400px;width:380px;height:590px;background:#fff;color:#061340;padding:40px 30px">
<div style="font:800 30px Montserrat">Commande reçue</div><div style="margin-top:6px;font:500 22px Inter;color:#5A6785">23:47 · Perruque lace frontal</div>{rows}</div>'''
    b += demo(610, 1000, "#9FB4DA")
    b += text(80, 310, 920, '<div style="font-size:32px;color:#C9D6F2">Votre site répond aux questions. WhatsApp garde la relation.</div>')
    return "J19 - Objection : mes clients me contactent sur WhatsApp", b + cta("Discutez avec DST"), ".cta{bottom:200px}", False


def j20():
    b = bg(NIGHT) + tag("Notre méthode")
    b += text(80, 160, 920, f'<div class="h" style="font-size:80px">DE VOTRE IDÉE À <span style="color:{BLUE_L}">VOTRE SITE EN LIGNE.</span></div><div style="margin-top:20px;font-size:32px;color:#C9D6F2">4 étapes. Votre validation à chacune.</div>')
    st = [("IDÉE", "On écoute votre activité."), ("DESIGN", "On dessine votre solution."), ("DÉVELOPPEMENT", "On la construit, vous validez."), ("MISE EN LIGNE", "Et on reste à vos côtés.")]
    b += '<div class="abs" style="left:139px;top:510px;width:6px;height:430px;background:linear-gradient(#0062E6,#47B73F);border-radius:3px"></div>'
    for i, (t, d) in enumerate(st):
        col = "#47B73F" if i == 3 else "#0062E6"
        b += f'''<div class="abs" style="left:92px;top:{470+i*140}px;display:flex;align-items:center;gap:36px">
<div class="blk" style="width:100px;height:100px;border-radius:50%;background:{col};border:6px solid #061340;display:flex;align-items:center;justify-content:center;font-size:36px">0{i+1}</div>
<div><div style="font:800 40px Montserrat;letter-spacing:1px">{t}</div><div style="font:500 28px Inter;color:#C9D6F2;margin-top:4px">{d}</div></div></div>'''
    return "J20 - Le processus DST", b + cta("Votre projet commence ici"), ".cta{left:auto;right:80px}", False


def j21():
    b = bg(WHITE) + tag("Checklist", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:76px;color:#061340">5 CHOSES QU\'UN SITE PRO <span style="color:#0062E6">DOIT AVOIR.</span></div><div style="margin-top:18px;font-size:32px;color:#33415F">Votre site actuel les a-t-il toutes ?</div>')
    b += phone("m-home.jpg", 390, 440, 300, 580)
    left = [(1, "Un message clair en 3 secondes", 520), (2, "Un bouton de contact visible", 760), (3, "Parfait sur mobile", 960)]
    right = [(4, "Des photos de qualité", 600), (5, "Une présence sur Google", 860)]
    for n, t, y in left:
        b += f'<div class="abs" style="left:80px;top:{y}px;width:290px;text-align:right"><div class="blk" style="display:inline-flex;width:52px;height:52px;border-radius:50%;background:#0062E6;color:#fff;align-items:center;justify-content:center;font-size:26px">{n}</div><div style="margin-top:8px;font:700 26px Inter;color:#061340;line-height:1.25">{t}</div></div><div class="abs" style="left:300px;top:{y+26}px;width:110px;height:3px;background:#0062E6"></div>'
    for n, t, y in right:
        b += f'<div class="abs" style="left:710px;top:{y}px;width:290px"><div class="blk" style="display:inline-flex;width:52px;height:52px;border-radius:50%;background:#0062E6;color:#fff;align-items:center;justify-content:center;font-size:26px">{n}</div><div style="margin-top:8px;font:700 26px Inter;color:#061340;line-height:1.25">{t}</div></div><div class="abs" style="left:670px;top:{y+26}px;width:100px;height:3px;background:#0062E6"></div>'
    return "J21 - 5 éléments d'un site professionnel", b + cta("Faites vérifier votre projet"), ".cta{bottom:200px}", False


# ---------------- SEMAINE 4 ----------------
def j22():
    b = bg(NIGHT) + tag("À éviter")
    b += text(80, 160, 920, f'<div class="h" style="font-size:84px">3 ERREURS QUI FONT <span style="color:{BLUE_L}">FUIR VOS CLIENTS.</span></div><div style="margin-top:20px;font-size:32px;color:#C9D6F2">La bonne nouvelle : elles se corrigent toutes.</div>')
    errs = [("Pas de prix affiché.", "Il faut demander, alors on va voir ailleurs."), ("Pas de réponse le soir.", "Le message de 22h devient une vente perdue."), ("Des photos floues.", "On doute du sérieux avant d'acheter.")]
    for i, (t, d) in enumerate(errs):
        b += f'''<div class="card abs" style="left:80px;top:{480+i*175}px;width:920px;height:150px;display:flex;align-items:center;gap:30px;padding:0 36px">
<div class="blk" style="font-size:64px;color:#0062E6;width:90px">0{i+1}</div><div style="flex:1"><div style="font:800 32px Montserrat">{t}</div><div style="font:500 25px Inter;color:#5A6785;margin-top:6px">{d}</div></div>
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font:700 16px Inter;color:#2E8B2A;text-align:center">{chk(40)}Corrigé<br>par un site</div></div>'''
    return "J22 - 3 erreurs qui font perdre des clients", b + cta("Parlons de votre projet"), "", False


def j23():
    b = bg(NIGHT) + tag("Le saviez-vous ?")
    b += text(80, 160, 920, f'<div class="h" style="font-size:84px">GOOGLE EST LE NOUVEAU <span style="color:{BLUE_L}">BOUCHE-À-OREILLE.</span></div><div style="margin-top:22px;font-size:32px;line-height:1.3;color:#C9D6F2">Quand on cherche un service, on demande d\'abord à son téléphone.</div>')
    pills = "".join(f'<span style="background:#E6EEFC;color:#0062E6;border-radius:30px;padding:10px 22px;font:700 22px Inter">{t}</span>' for t in ["Site web", "Appeler", "Itinéraire"])
    b += f'''<div class="abs" style="left:80px;top:520px;width:920px;height:440px;background:#fff;border-radius:44px;padding:40px 44px;color:#061340">
<div style="background:#F3F6FC;border-radius:40px;height:80px;display:flex;align-items:center;gap:18px;padding:0 30px">{search_ico(34)}<span style="font:500 32px Inter">traiteur près de moi</span></div>
<div style="margin-top:30px;border:3px solid #0062E6;border-radius:24px;padding:26px 30px">
<div style="font:800 34px Montserrat">Votre entreprise</div><div style="margin-top:6px;font:500 24px Inter;color:#2E8B2A">Ouvert · Cocody, Abidjan</div>
<div style="margin-top:18px;display:flex;gap:14px">{pills}</div></div></div>'''
    b += '<div class="abs" style="left:180px;top:950px;width:0;height:0;border-left:40px solid transparent;border-right:40px solid transparent;border-top:50px solid #fff"></div>'
    return "J23 - Pourquoi être visible sur Google", b + cta("Soyez trouvé sur Google"), ".cta{left:auto;right:80px}", False


def j24():
    b = bg(NIGHT2) + tag("Mobile d'abord")
    b += text(80, 160, 920, f'<div class="h" style="font-size:80px">VOS CLIENTS VOUS DÉCOUVRENT <span style="color:{BLUE_L}">AVEC LE POUCE.</span></div>')
    b += phone("m-salon.jpg", 560, 400, 400, 640)
    b += '<div class="abs" style="left:640px;top:880px;width:120px;height:120px;border-radius:50%;border:5px solid rgba(255,255,255,.9);background:rgba(255,255,255,.25)"></div><div class="abs" style="left:605px;top:845px;width:190px;height:190px;border-radius:50%;border:3px solid rgba(255,255,255,.4)"></div>'
    b += text(80, 470, 440, '<div style="font-size:34px;line-height:1.35;color:#C9D6F2">Un site pensé d\'abord pour le téléphone :</div>' + "".join(f'<div style="margin-top:22px;display:flex;gap:14px;align-items:center;font:700 32px Inter">{chk(32)}{t}</div>' for t in ["rapide", "clair", "facile à commander", "léger en données"]))
    b += demo(560, 1050, "#9FB4DA")
    return "J24 - Mobile-first", b + cta("Créez votre site"), "", False


def j25():
    b = bg(LIGHT)
    b += f'<img class="abs" src="{A("portrait-pro.jpg")}" style="left:560px;top:0;width:520px;height:1178px;object-fit:cover;object-position:50% 25%">'
    b += '<div class="abs" style="left:540px;top:0;width:120px;height:1178px;background:linear-gradient(90deg,#F3F6FC,rgba(243,246,252,0))"></div>'
    b += tag("Crédibilité", dark=False)
    b += '<div class="abs" style="left:80px;top:205px;width:6px;height:120px;background:#0062E6"></div>'
    b += text(110, 200, 440, '<div class="h" style="font-size:62px;color:#061340">LA CONFIANCE SE GAGNE <span class="pf" style="color:#0062E6;font-size:74px">avant</span> LE PREMIER RENDEZ-VOUS.</div><div style="margin-top:40px;width:400px;font-size:32px;line-height:1.35;color:#33415F">Un site professionnel parle pour vous quand vous n\'êtes pas là.</div>')
    return "J25 - Crédibilité professionnelle", b + cta("Contactez-nous"), "", False


def j26():
    b = bg("background:radial-gradient(900px 600px at 50% 35%,#0A2A7A 0%,rgba(6,19,64,0) 70%),#040C2C;") + tag("24h/24")
    for x, y, s in [(140, 160, 4), (900, 220, 3), (300, 90, 3), (760, 120, 5), (980, 480, 3), (60, 520, 4), (520, 60, 3)]:
        b += f'<div class="abs" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px;border-radius:50%;background:#fff;opacity:.7"></div>'
    b += '<div class="blk abs" style="left:0;top:170px;width:1080px;text-align:center;font-size:270px;color:#4D9BFF;letter-spacing:-8px">23:47</div>'
    b += f'''<div class="abs" style="left:190px;top:500px;width:700px;background:#fff;color:#061340;border-radius:28px;padding:24px 30px;display:flex;gap:20px;align-items:center">
<div style="width:64px;height:64px;border-radius:16px;background:#061340;display:flex;align-items:center;justify-content:center">{chk(38)}</div>
<div><div style="font:800 28px Montserrat">Nouvelle commande</div><div style="font:500 24px Inter;color:#5A6785;margin-top:4px">Payée via Wave · votre-boutique.com</div></div></div>'''
    b += demo(190, 640, "#9FB4DA")
    b += text(80, 720, 920, f'<div class="h" style="font-size:86px;text-align:center">VOUS DORMEZ.<br><span style="color:{BLUE_L}">VOTRE SITE VEND.</span></div><div style="margin-top:22px;text-align:center;font-size:32px;color:#C9D6F2">Commandes, réservations et paiements, à toute heure.</div>')
    return "J26 - Disponible 24h/24", b + cta("Discutez avec DST"), ".cta{left:50%;transform:translateX(-50%)}", False


def j27():
    b = bg(NIGHT) + tag("Transformation digitale")
    b += text(80, 160, 920, f'<div class="h" style="font-size:92px">DU CAHIER AU <span style="color:{BLUE_L}">TABLEAU DE BORD.</span></div><div style="margin-top:22px;font-size:32px;line-height:1.3;color:#C9D6F2">Commandes, clients, paiements et rendez-vous, enfin au même endroit.</div>')
    for i, t in enumerate(["Cahier", "Excel", "Messages"]):
        b += f'<div class="abs" style="left:80px;top:{560+i*130}px;width:220px;height:100px;border-radius:20px;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font:700 30px Montserrat;color:#AAB5CC">{t}</div>'
    b += f'<div class="abs" style="left:320px;top:700px">{arrow(110)}</div>'
    b += laptop("d-gestion.jpg", 450, 560, 570)
    b += demo(450, 960, "#9FB4DA")
    return "J27 - Transformation digitale", b + cta("Faites passer votre entreprise au digital"), ".cta{font-size:26px}", False


def j28():
    b = bg(WHITE) + tag("Guide", dark=False)
    b += text(80, 160, 920, '<div class="h" style="font-size:84px;color:#061340">QUEL SITE POUR <span style="color:#0062E6">VOTRE ACTIVITÉ ?</span></div><div style="margin-top:18px;font-size:32px;color:#33415F">Trois besoins, trois solutions.</div>')
    cols = [("Être présenté", "SITE VITRINE", "m-home.jpg", "#061340"), ("Vendre des produits", "E-COMMERCE", "m-perruques-shop.jpg", "#0062E6"), ("Prendre des rendez-vous", "RÉSERVATION", "m-salon.jpg", "#47B73F")]
    for i, (need, sol, img, c) in enumerate(cols):
        x = 80 + i * 315
        b += f'''<div class="abs" style="left:{x}px;top:450px;width:290px;height:560px;border-radius:28px;border:3px solid {c};background:#fff;overflow:hidden">
<div style="padding:24px 22px 0"><div style="font:600 22px Inter;color:#5A6785">Vous voulez…</div><div style="font:800 28px Montserrat;color:#061340;line-height:1.1;margin-top:6px;height:64px">{need}</div>
<div style="margin-top:14px;background:{c};color:#fff;font:800 22px Montserrat;border-radius:20px;padding:8px 14px;display:inline-block">{sol}</div></div>
<div style="margin:24px auto 0;width:220px;height:340px;border-radius:30px 30px 0 0;border:8px solid #0B1020;border-bottom:0;overflow:hidden"><img src="{A(img)}" style="width:100%;object-fit:cover;object-position:top"></div></div>'''
    b += text(560, 1030, 440, '<div style="font:700 26px Inter;color:#0062E6;text-align:right">Pas sûr ? On vous conseille.</div>')
    return "J28 - Quel type de site pour vous", b + cta("Demandez conseil"), ".cta{bottom:200px}", False


def j29():
    b = bg(NIGHT) + tag("DST TECHNOLOGIE · Votre partenaire digital")
    b += text(80, 160, 920, f'<div class="h" style="font-size:84px">VENDEZ.<br>RÉSERVEZ.<br><span class="pf" style="color:{BLUE_L};font-size:96px">Encaissez.</span></div><div style="margin-top:20px;font-size:30px;line-height:1.3;color:#C9D6F2">Sites web, boutiques en ligne, réservation et paiement mobile money pour votre entreprise.</div>')
    b += laptop("d-home.jpg", 80, 620, 600)
    b += phone("m-perruques-shop.jpg", 720, 590, 240, 400, "border-width:10px;border-radius:38px")
    b += f'<div class="card abs" style="left:520px;top:930px;padding:16px 22px;display:flex;gap:12px;align-items:center;font:700 22px Inter">{chk(26)}Rendez-vous réservé</div>'
    b += f'<div class="card abs" style="left:820px;top:860px;padding:16px 22px;display:flex;gap:12px;align-items:center;font:700 22px Inter">{chk(26)}Payé · Wave</div>'
    b += '<div class="abs" style="left:80px;top:540px;background:#47B73F;color:#fff;border-radius:20px;padding:14px 24px;font:800 26px Montserrat">Site vitrine dès 50 000 FCFA <span style="font:500 20px Inter">· offre jusqu\'au 31/12/2026</span></div>'
    b += text(80, 1010, 420, '<div style="font:600 20px Inter;color:#9FB4DA;line-height:1.5">Sites web · E-commerce · Réservation · Paiement en ligne · Digitalisation · SEO</div>')
    return "J29 - Grande affiche commerciale", b + cta("Demandez votre devis"), ".cta{left:auto;right:80px;bottom:200px}", False


def j30():
    b = bg(NIGHT2) + tag("Jour 30")
    b += text(80, 230, 920, f'<div class="h" style="font-size:70px;text-align:center">PRÊT À DIGITALISER<br><span style="color:{BLUE_L}">VOTRE ENTREPRISE ?</span></div>')
    b += '<div class="abs" style="left:250px;top:470px;width:580px;height:290px;border-radius:150px;background:radial-gradient(closest-side,rgba(71,183,63,.55),rgba(71,183,63,0))"></div>'
    b += '<div class="abs" style="left:310px;top:500px;width:460px;height:230px;border-radius:120px;background:#47B73F;border:8px solid #fff"></div>'
    b += '<div class="abs" style="left:560px;top:525px;width:180px;height:180px;border-radius:50%;background:#fff"></div>'
    b += '<div class="blk abs" style="left:350px;top:570px;font-size:76px;color:#fff">ON</div>'
    b += text(80, 800, 920, '<div style="text-align:center;font-size:34px;color:#C9D6F2">On commence par un échange. Simple, sans engagement.</div><div style="margin-top:26px;text-align:center;font:800 54px Montserrat">05 03 20 6666</div>')
    return "J30 - Prêt à digitaliser votre entreprise", b + cta("Contactez DST TECHNOLOGIE"), ".cta{left:50%;transform:translateX(-50%)}", False


POSTERS = {f"j{i:02d}": globals()[f"j{i:02d}"] for i in range(1, 31)}
