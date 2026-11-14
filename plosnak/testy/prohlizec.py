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


with sync_playwright() as p:
    desktop(p)
    mobil(p)
    webkit(p)
srv.shutdown()
print('\nCHYBY:' if chyby else '\nVše v pořádku.')
for c in chyby:
    print(' -', c)
sys.exit(1 if chyby else 0)
