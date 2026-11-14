"""Ověření Plošňáka v prohlížečích.

Spuštění z kořene repozitáře:  python3 plosnak/testy/prohlizec.py [adresar_na_snimky]
Chromium desktop 1280 px, Chromium mobil 390 px s dotyky přes CDP, WebKit.
"""
import functools, http.server, sys, threading, os, time
from playwright.sync_api import sync_playwright

KOREN = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SNIMKY = sys.argv[1] if len(sys.argv) > 1 else '/tmp/plosnak'
os.makedirs(SNIMKY, exist_ok=True)

class Tichy(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


handler = functools.partial(Tichy, directory=KOREN)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/plosnak/'

chyby = []
REFERENCE = ['zvedni', 'krok', 'krok', 'krok', 'poloz']


def ops(page):
    return [u['op'] for u in page.evaluate('Plosnak.program')]


def otevri(browser, **kw):
    ctx = browser.new_context(**kw)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and chyby.append(f'{kw.get("viewport")}: {m.text}'))
    page.on('pageerror', lambda e: chyby.append(f'{kw.get("viewport")}: {e}'))
    page.goto(URL)
    page.wait_for_function('window.Plosnak')
    return ctx, page


def pockej_konec(page, timeout=8000):
    page.wait_for_function('Plosnak.beh && Plosnak.beh.hotovo', timeout=timeout)


def over(podminka, zprava):
    if not podminka:
        chyby.append(zprava)
        print('  CHYBA:', zprava)
    else:
        print('  ok:', zprava)


def desktop(p):
    print('Chromium desktop 1280')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 800})
    page.screenshot(path=f'{SNIMKY}/d-01-start.png')
    for op in REFERENCE:
        page.click(f'#paleta .blok[data-op="{op}"]')
    over(ops(page) == REFERENCE, 'klepnutí v paletě skládá program')
    page.click('#spust')
    page.wait_for_timeout(1000)
    page.screenshot(path=f'{SNIMKY}/d-02-beh.png')
    pockej_konec(page)
    over(page.evaluate('Plosnak.beh.konec.uspech'), 'referenční řešení uspěje v prohlížeči')
    page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
    page.screenshot(path=f'{SNIMKY}/d-03-splneno.png')
    ulozeno = page.evaluate("JSON.parse(localStorage.getItem('malycz.plosnak.v1'))")
    over(ulozeno['levely']['1.1']['nejlepsi'] == {'bloky': 5, 'kroky': 5}, 'nejlepší výsledek uložen')
    page.click('[data-akce="zpet"]')

    # přetažení myší: krok z palety na začátek programu, pak řádek ven = smazání
    page.click('#zastav')
    src = page.locator('#paleta .blok[data-op="krok"]').bounding_box()
    dst = page.locator('#program .blok').first.bounding_box()
    page.mouse.move(src['x'] + 20, src['y'] + 20)
    page.mouse.down()
    page.mouse.move(src['x'] - 60, src['y'] + 30, steps=5)
    page.mouse.move(dst['x'] + 40, dst['y'] + 6, steps=8)
    page.screenshot(path=f'{SNIMKY}/d-04-tah.png')
    page.mouse.up()
    over(ops(page) == ['krok'] + REFERENCE, 'přetažení z palety vloží na místo')
    row = page.locator('#program .blok').first.bounding_box()
    page.mouse.move(row['x'] + 60, row['y'] + 20)
    page.mouse.down()
    page.mouse.move(row['x'] - 300, row['y'] + 300, steps=10)
    page.mouse.up()
    over(ops(page) == REFERENCE, 'vytažení řádku ven ho smaže')

    # chybný program: pád z cestičky, okamžitá rychlost
    page.click('#vymaz')
    for op in ['zvedni', 'krok', 'krok', 'krok', 'krok']:
        page.click(f'#paleta .blok[data-op="{op}"]')
    page.click('#rychlost [data-r="1"]')
    page.click('#spust')
    pockej_konec(page)
    page.wait_for_timeout(600)
    over(page.evaluate('Plosnak.vis.poza') == 'visi', 'pád: panáček visí')
    over('Spadl' in page.inner_text('#stav'), 'pád: stavový řádek')
    page.screenshot(path=f'{SNIMKY}/d-05-pad.png')

    # chybný program: drží součástku na konci
    page.locator('#program .blok').last.click()
    page.click('#program .blok.vybrany .smaz')
    page.click('#rychlost [data-r="0"]')
    page.click('#spust')
    pockej_konec(page)
    over('drží propojku' in page.inner_text('#stav'), 'drží na konci: hláška')
    page.screenshot(path=f'{SNIMKY}/d-06-drzi.png')

    # krokování
    page.click('#zastav')
    page.click('#krok')
    page.wait_for_timeout(450)
    over(page.evaluate('Plosnak.beh.takt') == 1 and not page.evaluate('Plosnak.beh.bezi'), 'krok po kroku')
    over(page.locator('#program .blok.aktivni').count() == 1, 'běžící blok svítí')
    page.click('#krok'); page.wait_for_timeout(150)
    page.screenshot(path=f'{SNIMKY}/d-07-krokovani.png')

    # program přežije znovunačtení
    page.reload(); page.wait_for_function('window.Plosnak')
    over(ops(page) == ['zvedni', 'krok', 'krok', 'krok'], 'program uložen v localStorage')
    over('Nejlepší' in page.inner_text('#lv-cile'), 'nejlepší výsledek zobrazen')
    ctx.close(); b.close()


def dotyk(cdp, typ, x, y):
    body = [] if typ == 'touchEnd' else [{'x': x, 'y': y, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 1}]
    cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': body})


def tukni(cdp, page, sel):
    page.locator(sel).scroll_into_view_if_needed()
    b = page.locator(sel).bounding_box()
    x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    dotyk(cdp, 'touchStart', x, y); dotyk(cdp, 'touchEnd', x, y)
    page.wait_for_timeout(60)


def mobil(p):
    print('Chromium mobil 390, dotyky')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    cdp = ctx.new_cdp_session(page)
    page.screenshot(path=f'{SNIMKY}/m-01-start.png', full_page=True)
    sirka = page.evaluate('document.documentElement.scrollWidth')
    over(sirka <= 390, f'bez vodorovného posuvníku ({sirka} px)')
    for op in REFERENCE:
        tukni(cdp, page, f'#paleta .blok[data-op="{op}"]')
    over(ops(page) == REFERENCE, 'ťukání v paletě skládá program')
    # tah prstem: krok z palety mezi řádek 1 a 2
    src = page.locator('#paleta .blok[data-op="krok"]').bounding_box()
    r2 = page.locator('#program .blok').nth(1).bounding_box()
    x, y = src['x'] + 30, src['y'] + 20
    dotyk(cdp, 'touchStart', x, y)
    for i in range(1, 11):
        dotyk(cdp, 'touchMove', x + (r2['x'] + 60 - x) * i / 10, y + (r2['y'] + 5 - y) * i / 10)
    page.screenshot(path=f'{SNIMKY}/m-02-tah.png')
    dotyk(cdp, 'touchEnd', 0, 0)
    page.wait_for_timeout(80)
    over(ops(page) == ['zvedni', 'krok'] + REFERENCE[1:], 'tah prstem vloží blok na místo')
    # smazání přes × u vybraného řádku
    tukni(cdp, page, '#program .blok:nth-child(2)')
    tukni(cdp, page, '#program .blok.vybrany .smaz')
    over(ops(page) == REFERENCE, 'smazání přes × dotykem')
    tukni(cdp, page, '#rychlost [data-r="4"]')
    tukni(cdp, page, '#spust')
    pockej_konec(page)
    over(page.evaluate('Plosnak.beh.konec.uspech'), 'mobil: řešení uspěje')
    page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
    page.screenshot(path=f'{SNIMKY}/m-03-splneno.png', full_page=True)
    ctx.close(); b.close()


def webkit(p):
    print('WebKit 1280')
    b = p.webkit.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 800})
    for op in REFERENCE:
        page.click(f'#paleta .blok[data-op="{op}"]')
    page.click('#spust')
    page.wait_for_timeout(900)
    page.screenshot(path=f'{SNIMKY}/w-01-beh.png')
    pockej_konec(page)
    over(page.evaluate('Plosnak.beh.konec.uspech'), 'WebKit: řešení uspěje')
    page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
    page.screenshot(path=f'{SNIMKY}/w-02-splneno.png')
    ctx.close(); b.close()

    print('WebKit mobil 390 (iPhone)')
    b = p.webkit.launch()
    ctx, page = otevri(b, **p.devices['iPhone 13'])
    page.tap('#paleta .blok[data-op="zvedni"]')
    page.tap('#paleta .blok[data-op="krok"]')
    over(ops(page) == ['zvedni', 'krok'], 'WebKit: ťukání v paletě')
    page.screenshot(path=f'{SNIMKY}/w-03-iphone.png', full_page=True)
    ctx.close(); b.close()


RESENI = {
    '1.1': REFERENCE,
    '1.2': ['zvedni', 'krok', 'krok', 'vpravo', 'krok', 'krok', 'poloz'],
    '1.3': (['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo'] * 3)[:24],
    '1.4': ['zvedni', 'skoc', 'skoc', 'skoc', 'poloz'],
}


def levely(p):
    print('Chromium desktop: postup levely 1.1 až 1.4')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 800})
    over(page.locator('#levely button:disabled').count() == page.locator('#levely button').count() - 1, 'zamčené všechny kromě 1.1')
    for i, (lid, prg) in enumerate(RESENI.items()):
        over(page.evaluate('Plosnak.level') == lid, f'načten level {lid}')
        page.screenshot(path=f'{SNIMKY}/l-{lid}-start.png')
        for op in prg:
            page.click(f'#paleta .blok[data-op="{op}"]')
        if lid == '1.4':
            page.click('#rychlost [data-r="1"]')
            page.click('#spust')
            page.wait_for_timeout(560)
            page.screenshot(path=f'{SNIMKY}/l-1.4-skok.png')
        else:
            page.click('#rychlost [data-r="0"]')
            page.click('#spust')
        pockej_konec(page)
        over(page.evaluate('Plosnak.beh.konec.uspech'), f'{lid}: referenční řešení uspěje')
        page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
        page.screenshot(path=f'{SNIMKY}/l-{lid}-splneno.png')
        if i < 3:
            page.click('[data-akce="dalsi"]')
    over(page.locator('#levely .hotovo').count() == 4, 'levely kapitoly 1 označené jako splněné')
    # 1.4: skok o krok dřív = pád
    page.click('[data-akce="zpet"]')
    page.click('#vymaz')
    for op in ['zvedni', 'krok', 'skoc']:
        page.click(f'#paleta .blok[data-op="{op}"]')
    page.click('#rychlost [data-r="1"]')
    page.click('#spust')
    pockej_konec(page)
    page.wait_for_timeout(500)
    over(page.evaluate('Plosnak.vis.poza') == 'visi', '1.4: předčasný skok skončí pádem')
    page.screenshot(path=f'{SNIMKY}/l-1.4-pad.png')
    # přepnutí zpět na 1.2 přes výběr levelů
    page.click('#levely [data-level="1.2"]')
    over(page.evaluate('Plosnak.level') == '1.2' and ops(page) == RESENI['1.2'], 'výběr levelu vrátí uložený program')
    page.reload(); page.wait_for_function('window.Plosnak')
    over(page.evaluate('Plosnak.level') == '1.2', 'aktuální level přežije znovunačtení')
    ctx.close(); b.close()


def mobil_dlouhy(p):
    print('Chromium mobil 390: dlouhý program v 1.3')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    page.evaluate("""localStorage.setItem('malycz.plosnak.v1', JSON.stringify({aktualni: '1.3', levely: {
      '1.1': {splneno: true}, '1.2': {splneno: true}}}))""")
    page.reload(); page.wait_for_function('window.Plosnak')
    over(page.evaluate('Plosnak.level') == '1.3', 'mobil: otevřen 1.3')
    cdp = ctx.new_cdp_session(page)
    for op in RESENI['1.3']:
        tukni(cdp, page, f'#paleta .blok[data-op="{op}"]')
    over(ops(page) == RESENI['1.3'], 'mobil: 24 bloků naťukáno')
    # švih po řádcích programu posune stránku
    page.evaluate('window.scrollTo(0, 0)')
    r = page.locator('#program .blok').nth(2).bounding_box()
    x, y = r['x'] + r['width'] / 2, r['y'] + 10
    dotyk(cdp, 'touchStart', x, y)
    for i in range(1, 9):
        dotyk(cdp, 'touchMove', x, y - i * 40)
        page.wait_for_timeout(16)
    dotyk(cdp, 'touchEnd', 0, 0)
    page.wait_for_timeout(400)
    sy = page.evaluate('window.scrollY')
    over(sy > 100, f'švih po programu posune stránku (scrollY {sy})')
    over(ops(page) == RESENI['1.3'], 'švih program nezmění')
    # podržení a tah: první řádek (zvedni) za třetí
    r1 = page.locator('#program .blok').nth(0).bounding_box()
    r4 = page.locator('#program .blok').nth(3).bounding_box()
    x, y = r1['x'] + r1['width'] / 2, r1['y'] + 20
    dotyk(cdp, 'touchStart', x, y)
    page.wait_for_timeout(450)
    for i in range(1, 11):
        dotyk(cdp, 'touchMove', x, y + (r4['y'] + 4 - y) * i / 10)
        page.wait_for_timeout(16)
    page.screenshot(path=f'{SNIMKY}/m-04-podrzeni.png')
    dotyk(cdp, 'touchEnd', 0, 0)
    page.wait_for_timeout(80)
    over(ops(page)[:4] == ['krok', 'krok', 'zvedni', 'poloz'], f'podržení a tah přesune řádek ({ops(page)[:4]})')
    # podržení bez pohybu nic nesmaže
    n = len(ops(page))
    r1 = page.locator('#program .blok').nth(1).bounding_box()
    dotyk(cdp, 'touchStart', r1['x'] + 60, r1['y'] + 20)
    page.wait_for_timeout(450)
    dotyk(cdp, 'touchEnd', 0, 0)
    page.wait_for_timeout(80)
    over(len(ops(page)) == n, 'podržení bez pohybu nic nesmaže')
    page.screenshot(path=f'{SNIMKY}/m-05-dlouhy.png', full_page=True)
    # během běhu se stránka nesmí sama posouvat k zvýrazněnému bloku
    page.evaluate('window.scrollTo(0, 0)')
    tukni(cdp, page, '#rychlost [data-r="4"]')
    tukni(cdp, page, '#spust')
    pockej_konec(page, 15000)
    sy = page.evaluate('window.scrollY')
    over(sy == 0, f'mobil: běh programu neposouvá stránku (scrollY {sy})')
    ctx.close(); b.close()

    print('Chromium desktop 1280x700: dlouhý program se posouvá uvnitř')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 700})
    page.evaluate("""localStorage.setItem('malycz.plosnak.v1', JSON.stringify({aktualni: '1.3', levely: {
      '1.1': {splneno: true}, '1.2': {splneno: true}}}))""")
    page.reload(); page.wait_for_function('window.Plosnak')
    for op in RESENI['1.3']:
        page.click(f'#paleta .blok[data-op="{op}"]')
    page.evaluate('window.scrollTo(0, 0); document.getElementById("program").scrollTop = 0')
    page.click('#rychlost [data-r="4"]')
    page.click('#spust')
    pockej_konec(page, 15000)
    over(page.evaluate('window.scrollY') == 0, 'desktop: stránka zůstala nahoře')
    over(page.evaluate('document.getElementById("program").scrollTop') > 0, 'desktop: program se posunul uvnitř')
    ctx.close(); b.close()


RESENI2 = {
    '2.1': [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
    '2.2': [['stale', ['zvedni', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz',
                       'vlevo', ['opakuj', 3, ['krok', 'vlevo', 'krok', 'vpravo']], 'vpravo']]],
    '2.3': [['stale', ['zvedni', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'krok']]],
    '2.4': [['opakuj', 4, ['krok', 'krok', 'zvedni', 'vpravo', 'vpravo', 'krok', 'krok', 'poloz', 'vpravo']]],
}


def normal(prg):
    out = []
    for u in prg:
        if isinstance(u, str):
            out.append({'op': u})
        elif u[0] == 'opakuj':
            out.append({'op': 'opakuj', 'n': u[1], 'telo': normal(u[2])})
        elif u[0] == 'kdyz':
            out.append({'op': 'kdyz', 'podminka': u[1], 'telo': normal(u[2]), 'jinak': normal(u[3])})
        else:
            out.append({'op': u[0], 'telo': normal(u[1])})
    return out


def sestav(page, prg, klik):
    """Složí program přes rozhraní: paleta, výběr počtu, klepnutí na patu smyčky."""
    for u in prg:
        if isinstance(u, str):
            klik(f'#paleta .blok[data-op="{u}"]')
            continue
        klik(f'#paleta .blok[data-op="{u[0]}"]')
        sid = page.get_attribute('#program .hlava.vybrany', 'data-id')
        if u[0] == 'kdyz':
            klik(f'#program .hlava[data-id="{sid}"] .podminka-n')
            klik(f'#program .hlava[data-id="{sid}"] .volba-p [data-p="{u[1]}"]')
            sestav(page, u[2], klik)
            klik(f'#program .jinak-hlava[data-id="{sid}"]')
            sestav(page, u[3], klik)
            klik(f'#program .pata[data-id="{sid}"]')
            continue
        if u[0] == 'opakuj':
            klik(f'#program .hlava[data-id="{sid}"] .pocet-n')
            klik(f'#program .hlava[data-id="{sid}"] .volba-n [data-n="{u[1]}"]')
        sestav(page, u[2] if u[0] == 'opakuj' else u[1], klik)
        klik(f'#program .pata[data-id="{sid}"]')


ODEMCENO = """localStorage.setItem('malycz.plosnak.v1', JSON.stringify({aktualni: '2.1', levely: {
  '1.1': {splneno: true}, '1.2': {splneno: true}, '1.3': {splneno: true}, '1.4': {splneno: true}}}))"""


def kapitola2(p):
    print('Chromium desktop: kapitola 2')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 900})
    page.evaluate(ODEMCENO)
    page.reload(); page.wait_for_function('window.Plosnak')
    for i, (lid, prg) in enumerate(RESENI2.items()):
        over(page.evaluate('Plosnak.level') == lid, f'načten level {lid}')
        sestav(page, prg, page.click)
        over(page.evaluate('Plosnak.program') == normal(prg), f'{lid}: program složený přes rozhraní')
        page.screenshot(path=f'{SNIMKY}/k2-{lid}-program.png')
        if lid == '2.2':
            for _ in range(4):
                page.click('#krok'); page.wait_for_timeout(450)
            over(page.locator('#program .smycka.bezi-smycka').count() == 2, '2.2: obě běžící smyčky zvýrazněné')
            over(page.inner_text('#program .smycka .smycka .kolo') == '1/3', '2.2: počítadlo kola vnitřní smyčky')
            page.screenshot(path=f'{SNIMKY}/k2-2.2-krokovani.png')
            page.click('#zastav')
        page.click('#rychlost [data-r="4"]')
        page.click('#spust')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{SNIMKY}/k2-{lid}-beh.png')
        page.click('#rychlost [data-r="0"]')
        pockej_konec(page, 15000)
        over(page.evaluate('Plosnak.beh.konec.uspech'), f'{lid}: referenční řešení uspěje')
        page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
        page.screenshot(path=f'{SNIMKY}/k2-{lid}-splneno.png')
        if i < 3:
            page.click('[data-akce="dalsi"]')
    # přetažení myší do těla smyčky a přesun smyčky
    page.click('[data-akce="zpet"]')
    page.click('#vymaz')
    page.click('#paleta .blok[data-op="opakuj"]')
    page.click('#paleta .blok[data-op="krok"]')
    sid = page.get_attribute('#program .smycka', 'data-id')
    page.click(f'#program .pata[data-id="{sid}"]')
    page.click('#paleta .blok[data-op="poloz"]')
    src = page.locator('#paleta .blok[data-op="zvedni"]').bounding_box()
    dst = page.locator('#program .smycka .telo .blok').first.bounding_box()
    page.mouse.move(src['x'] + 20, src['y'] + 20); page.mouse.down()
    page.mouse.move(src['x'] - 80, src['y'] + 40, steps=4)
    page.mouse.move(dst['x'] + 40, dst['y'] + dst['height'] + 1, steps=8)
    page.screenshot(path=f'{SNIMKY}/k2-tah-do-smycky.png')
    page.mouse.up()
    over(page.evaluate('Plosnak.program') == normal([['opakuj', 2, ['krok', 'zvedni']], 'poloz']), 'tah z palety do těla smyčky')
    h = page.locator('#program .smycka > .hlava').bounding_box()
    last = page.locator('#program > li.blok').last.bounding_box()
    page.mouse.move(h['x'] + 60, h['y'] + 20); page.mouse.down()
    page.mouse.move(h['x'] + 60, h['y'] + 60, steps=4)
    page.mouse.move(last['x'] + 60, last['y'] + last['height'] + 2, steps=8)
    page.mouse.up()
    over(page.evaluate('Plosnak.program') == normal(['poloz', ['opakuj', 2, ['krok', 'zvedni']]]), 'přesun celé smyčky')
    # smazání smyčky smaže i obsah
    page.click('#program .smycka > .hlava .nazev')
    page.click('#program .smycka > .hlava .smaz')
    over(page.evaluate('Plosnak.program') == normal(['poloz']), 'smazání smyčky i s obsahem')
    ctx.close(); b.close()


def kapitola2_mobil(p):
    print('Chromium mobil 390: smyčky dotykem (2.2)')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    page.evaluate(ODEMCENO.replace("aktualni: '2.1'", "aktualni: '2.2'").replace("'1.4': {splneno: true}", "'1.4': {splneno: true}, '2.1': {splneno: true}"))
    page.reload(); page.wait_for_function('window.Plosnak')
    cdp = ctx.new_cdp_session(page)
    def klik(sel):
        page.locator(sel).scroll_into_view_if_needed()
        tukni(cdp, page, sel)
    sestav(page, RESENI2['2.2'], klik)
    over(page.evaluate('Plosnak.program') == normal(RESENI2['2.2']), 'mobil: vnořený program ťukáním')
    sirka = page.evaluate('document.documentElement.scrollWidth')
    over(sirka <= 390, f'mobil: bez vodorovného posuvníku ({sirka} px)')
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=f'{SNIMKY}/k2-m-program.png', full_page=True)
    klik('#program > .smycka > .telo > li:nth-child(2) > .hlava .pocet-n')
    page.screenshot(path=f'{SNIMKY}/k2-m-volba.png', full_page=True)
    klik('#program > .smycka > .telo > li:nth-child(2) > .hlava .volba-n [data-n="3"]')
    page.evaluate('window.scrollTo(0, 0)')
    klik('#rychlost [data-r="0"]')
    klik('#spust')
    pockej_konec(page, 15000)
    over(page.evaluate('Plosnak.beh.konec.uspech'), 'mobil: 2.2 uspěje')
    ctx.close(); b.close()


RESENI3 = {
    '3.1': [['stale', ['zvedni', ['kdyz', 'druh:odpor',
        ['vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo'],
        ['vpravo', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'vpravo']]]]],
    '3.2': [['stale', ['zvedni', 'krok', ['kdyz', 'druh:spaleny', ['krok'], []], 'poloz',
        'vpravo', 'vpravo', 'krok', ['kdyz', 'cesta:vpred', ['krok'], []], 'vpravo', 'vpravo']]],
    '3.3': [['stale', [['kdyz', 'cesta:vpravo', ['vpravo', 'krok'], [['kdyz', 'cesta:vpred', ['krok'], ['vlevo']]]]]]],
    '3.4': [['stale', ['zvedni', 'krok', ['kdyz', 'pruh:hneda', ['poloz'], []], 'krok', ['kdyz', 'pruh:cervena', ['poloz'], []],
        'krok', 'poloz', 'vpravo', 'vpravo', ['opakuj', 3, ['krok']], 'vpravo', 'vpravo']]],
}

ODEMCENO3 = """localStorage.setItem('malycz.plosnak.v1', JSON.stringify({aktualni: '3.1', levely: Object.fromEntries(
  ['1.1','1.2','1.3','1.4','2.1','2.2','2.3','2.4'].map(id => [id, {splneno: true}]))}))"""


def kapitola3(p):
    print('Chromium desktop: kapitola 3')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 900})
    page.evaluate(ODEMCENO3)
    page.reload(); page.wait_for_function('window.Plosnak')
    for i, (lid, prg) in enumerate(RESENI3.items()):
        over(page.evaluate('Plosnak.level') == lid, f'načten level {lid}')
        sestav(page, prg, page.click)
        over(page.evaluate('Plosnak.program') == normal(prg), f'{lid}: program složený přes rozhraní')
        if lid == '3.1':
            page.click('#krok'); page.wait_for_timeout(450)
            page.click('#krok'); page.wait_for_timeout(450)
            over(page.locator('#program ol.telo.bezi-vetev').count() == 1, '3.1: běžící větev když je zvýrazněná')
            page.screenshot(path=f'{SNIMKY}/k3-3.1-krokovani.png')
            page.click('#zastav')
        if lid == '3.3':
            page.click('#testy [data-test="1"]')
            page.screenshot(path=f'{SNIMKY}/k3-3.3-zadani2.png')
            page.click('#testy [data-test="0"]')
        page.click('#rychlost [data-r="4"]')
        page.click('#spust')
        page.wait_for_timeout(1300)
        page.screenshot(path=f'{SNIMKY}/k3-{lid}-beh.png')
        page.click('#rychlost [data-r="0"]')
        pockej_konec(page, 15000)
        over(page.evaluate('Plosnak.beh.konec.uspech'), f'{lid}: referenční řešení uspěje')
        page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
        page.screenshot(path=f'{SNIMKY}/k3-{lid}-splneno.png')
        if i < 3:
            page.click('[data-akce="dalsi"]')
    # chybné třídění: hláška o výstupu
    page.click('#levely [data-level="3.1"]')
    page.click('#vymaz')
    sestav(page, [['stale', ['zvedni', 'vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo']]], page.click)
    page.click('#spust')
    pockej_konec(page, 15000)
    over('Na výstup A patří jen odpory' in page.inner_text('#stav'), 'chybné třídění: hláška')
    page.screenshot(path=f'{SNIMKY}/k3-3.1-chyba.png')
    ctx.close(); b.close()


def kapitola3_mobil(p):
    print('Chromium mobil 390: podmínky dotykem (3.2)')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    page.evaluate(ODEMCENO3.replace("aktualni: '3.1'", "aktualni: '3.2'").replace("'2.4']", "'2.4','3.1']"))
    page.reload(); page.wait_for_function('window.Plosnak')
    over(page.evaluate('Plosnak.level') == '3.2', 'mobil: otevřen 3.2')
    cdp = ctx.new_cdp_session(page)
    klik = lambda sel: tukni(cdp, page, sel)
    sestav(page, RESENI3['3.2'], klik)
    over(page.evaluate('Plosnak.program') == normal(RESENI3['3.2']), 'mobil: program s podmínkami ťukáním')
    sirka = page.evaluate('document.documentElement.scrollWidth')
    over(sirka <= 390, f'mobil: bez vodorovného posuvníku ({sirka} px)')
    klik('#program > .smycka > .telo > li.vetveni:nth-child(3) > .hlava .podminka-n')
    page.screenshot(path=f'{SNIMKY}/k3-m-volba.png', full_page=True)
    klik('#program > .smycka > .telo > li.vetveni:nth-child(3) > .hlava .volba-p [data-p="druh:spaleny"]')
    page.evaluate('window.scrollTo(0, 0)')
    klik('#rychlost [data-r="0"]')
    klik('#spust')
    pockej_konec(page, 15000)
    over(page.evaluate('Plosnak.beh.konec.uspech'), 'mobil: 3.2 uspěje')
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=f'{SNIMKY}/k3-m-hotovo.png', full_page=True)
    ctx.close(); b.close()


def odemceno_do(aktualni, splnene):
    return f"""localStorage.setItem('malycz.plosnak.v1', JSON.stringify({{aktualni: '{aktualni}', levely: Object.fromEntries(
      {splnene!r}.map(id => [id, {{splneno: true}}]))}}))"""


KAP1_3 = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '3.4']


def kapitola(p, nazev, reseni, splnene, kontrola=None):
    """Projde levely kapitoly: složí řešení přes rozhraní, ověří úspěch a postup na další level."""
    print(f'Chromium desktop: {nazev}')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 1280, 'height': 900})
    ids = list(reseni)
    page.evaluate(odemceno_do(ids[0], splnene))
    page.reload(); page.wait_for_function('window.Plosnak')
    for i, (lid, prg) in enumerate(reseni.items()):
        over(page.evaluate('Plosnak.level') == lid, f'načten level {lid}')
        sestav(page, prg, page.click)
        over(page.evaluate('Plosnak.program') == normal(prg), f'{lid}: program složený přes rozhraní')
        if kontrola:
            kontrola(page, lid)
        page.click('#rychlost [data-r="4"]')
        page.click('#spust')
        page.wait_for_timeout(1300)
        page.screenshot(path=f'{SNIMKY}/k-{lid}-beh.png')
        page.click('#rychlost [data-r="0"]')
        pockej_konec(page, 20000)
        over(page.evaluate('Plosnak.beh.konec.uspech'), f'{lid}: referenční řešení uspěje')
        page.wait_for_selector('#vysledek:not([hidden])', timeout=3000)
        if i < len(ids) - 1:
            page.click('[data-akce="dalsi"]')
    ctx.close(); b.close()


def kapitola_mobil(p, lid, prg, splnene):
    print(f'Chromium mobil 390: {lid} dotykem')
    b = p.chromium.launch()
    ctx, page = otevri(b, viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    page.evaluate(odemceno_do(lid, splnene))
    page.reload(); page.wait_for_function('window.Plosnak')
    over(page.evaluate('Plosnak.level') == lid, f'mobil: otevřen {lid}')
    cdp = ctx.new_cdp_session(page)
    sestav(page, prg, lambda sel: tukni(cdp, page, sel))
    over(page.evaluate('Plosnak.program') == normal(prg), f'mobil {lid}: program ťukáním')
    sirka = page.evaluate('document.documentElement.scrollWidth')
    over(sirka <= 390, f'mobil {lid}: bez vodorovného posuvníku ({sirka} px)')
    page.evaluate('window.scrollTo(0, 0)')
    tukni(cdp, page, '#rychlost [data-r="4"]')
    tukni(cdp, page, '#spust')
    page.wait_for_timeout(1200)
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=f'{SNIMKY}/m-{lid}-beh.png', full_page=True)
    tukni(cdp, page, '#rychlost [data-r="0"]')
    pockej_konec(page, 20000)
    over(page.evaluate('Plosnak.beh.konec.uspech'), f'mobil {lid}: uspěje')
    ctx.close(); b.close()


RESENI4 = {
    '4.1': [['stale', ['zvedni', 'uloz', 'zvedni', 'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
    '4.2': [['stale', ['zvedni', ['kdyz', 'kapsa:stejna',
        ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo'],
        ['prohod', 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']]]]],
    '4.3': [['stale', ['zvedni', 'uloz',
        ['opakuj', 2, ['zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']],
        'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]],
    '4.4': [['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []],
        'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
}


def kontrola4(page, lid):
    if lid != '4.1':
        return
    over(page.locator('#legenda').is_visible(), '4.1: legenda barev pod zadáním')
    for _ in range(3):
        page.click('#krok'); page.wait_for_timeout(450)
    over('v kapse' in page.inner_text('#stav'), '4.1: stavový řádek ukazuje kapsu')
    page.screenshot(path=f'{SNIMKY}/k-4.1-kapsa.png')
    page.click('#zastav')


KAP1_4 = KAP1_3 + ['4.1', '4.2', '4.3', '4.4']
RESENI5 = {
    '5.1': ['zvedni', 'krok', 'poloz', 'pajej', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo', 'zvedni', 'krok', 'krok', 'poloz', 'pajej'],
    '5.2': ['zvedni', 'krok', ['kdyz', 'znacka:obracena', ['otoc'], []], 'poloz', 'pajej', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo',
            'zvedni', 'krok', 'krok', 'poloz', 'pajej'],
    '5.3': [['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'druh:odpor', ['prohod'], []], 'krok',
      ['opakuj', 6, [['kdyz', 'drzim', [['kdyz', 'patice:volna', ['poloz', 'pajej', 'vpravo', 'krok', 'vyndej', 'poloz', 'pajej', 'vlevo'], []]], []], 'krok']],
      'vpravo', 'vpravo', ['opakuj', 7, ['krok']], 'vpravo', 'krok', 'vpravo']]],
    '5.4': ['zvedni', 'uloz',
      ['opakuj', 15, [
        ['kdyz', 'cesta:vpred', ['krok'], ['vpravo', 'krok']],
        ['kdyz', 'patice:osazena', ['vypajej', 'zvedni', ['kdyz', 'druh:spaleny', ['prohod'], []], 'poloz', 'pajej'], []]]],
      'vyndej', 'poloz'],
}


def kontrola5(page, lid):
    page.screenshot(path=f'{SNIMKY}/k-{lid}-program.png')


with sync_playwright() as p:
    kapitola(p, 'kapitola 5', RESENI5, KAP1_4, kontrola5)
    kapitola(p, 'kapitola 4', RESENI4, KAP1_3, kontrola4)
    kapitola_mobil(p, '4.4', RESENI4['4.4'], KAP1_3 + ['4.1', '4.2', '4.3'])
    kapitola3(p)
    kapitola3_mobil(p)
    kapitola2(p)
    kapitola2_mobil(p)
    desktop(p)
    levely(p)
    mobil_dlouhy(p)
    mobil(p)
    webkit(p)
srv.shutdown()
print('\nCHYBY:' if chyby else '\nVše v pořádku.')
for c in chyby:
    print(' -', c)
sys.exit(1 if chyby else 0)
