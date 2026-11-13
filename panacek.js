
/*!
 * panacek.js, verze 6: hra „Rozeber si mě" pro maly.cz
 *
 * Hůlková postavička s klouby. Ruce a nohy počítá inverzní kinematika, všechny
 * pohyby jdou přes pružiny, hlava má setrvačnost. Póza určuje jen cíle, kam se
 * tělo má dostat; plynulost obstará fyzika.
 *
 * Příběh:
 *   1. Po chvíli klidu panáček vykoukne zpoza některé čáry na stránce.
 *   2. Pak vyleze, poplašeně se rozhlédne a odskáče po čarách dolů ke skrýši v patičce.
 *   3. Tam zadumaně čeká. Když ho návštěvník sleduje, vytáhne šroubovák a vleče ho jinam.
 *   4. U kurzoru ztuhne a sleduje ho očima. Pošimrání ho rozesměje a šroubovák upustí.
 *   5. Upuštěný šroubovák jde kliknutím uložit do opasku s nářadím.
 *   6. Kliknutím na šroubovák v opasku se z kurzoru stane šroubovák. Čtverečky v pracovní
 *      mapě jsou spoje: stisknout a táhnout, až cvaknou. Kabely v nich povolí a visí jako lana.
 *   7. Na posledním spoji se mapa zhoupne, po něm spadne. Pod ní je dílna s knihami a vzkazy.
 *   8. Panáček sbírá spoje ze země do hromádky a v dílně touží po kleštích na háku.
 *   9. Když mapa spadne, sestřelí kleště spoji z hromádky a odnáší si je. Pošimraný je upustí.
 *  10. Kleštěmi z opasku jdou odštípnout štítky v oddílu Území; spadnou a zůstane po nich díra.
 *  11. Páječka leží v dílně na poličce. Vrací spoje, štítky i celou mapu a záplatuje díry.
 *  12. Vrtačka vypadne zpoza třetího odštípnutého štítku. Podržením vyvrtá do stránky díru.
 *  13. Baterku nosí panáček, když jsou díry aspoň dvě. Svítí do děr a na rubu webu.
 *  14. Od tří děr jde stránka za pravý horní roh překlopit na rub. Tam jsou poznámky „toho vzadu".
 *  15. Panáček s kladivem sám opravuje, co je rozebrané, i mezi návštěvami (jedna věc za dvě hodiny).
 *  17. Směr: nadpis jde odšroubovat a slovesa ve větě zapnout správným nástrojem. Dělám: řádky jsou
 *      šuplíky a jejich linky jdou přeštípnout. Odkazy: zástrčky jdou vypáčit, odkaz ale funguje dál.
 *  16. V noci (22 až 6 h) u šroubováku usne. Zvuky vypíná přezka opasku. Slovo „panacek" ho přivolá.
 *  18. Za čepici jde chytit, přenést, protřepat (vypadnou mu věci z kapes) a hodit. Hozený vyráží spoje
 *      z mapy; od čtvrtého hodu má deštník. Nástroje na něj: baterka oslní, páječka spálí, kleště štípnou
 *      nebo ustřihnou kšilt, vrtačka roztočí, šroubovák povolí krk.
 *  19. Písmena jména jdou vypáčit; panáček je hází zpátky do děr, takže vznikají přesmyčky.
 *  20. Značka MM je šroub: povolená nakloní navigaci, vypadne; přetažená zkroutí stránku.
 *  21. Řádky perexu jdou přestřihnout; ze slov panáček staví věž a leze na ni.
 *  22. Volné konce kabelů v mapě jde přepojit; poznámka pod mapou pak vypíše, co mapa tvrdí.
 *  23. Na 100 % opadá styl pravidlo po pravidle, zůstane holé HTML a panáček stránku znovu oblékne.
 *  24. Když návštěvník odejde na jinou kartu, změní se titulek a ikona; po návratu panáček zamává.
 *
 * Bez závislostí, všechno si skript vloží sám. Ladění:
 *   #hned    krátké prodlevy            #reset   smaže uložený stav
 *   window.panacek.act('gather'), .pose('think'), .pry('p1'), .tool(true), .world(), .reset(),
 *   .act('pliers'), .pliers(true), .snip('Média'), .give('drill'), .use('torch'), .hole(x, y), .rub(true)
 *   #noc vynutí noční režim, #finale rovnou spustí finále
 *   .finale(), .parts(), .ends(), .dbg()
 */
(() => {
  'use strict';
  if (window.panacek) return;

  const doc = document, root = doc.documentElement;
  const flags = (location.search + location.hash).toLowerCase();
  const FAST = flags.includes('hned');
  // Kdo má v systému vypnuté animace, tomu panáček sám nevyleze.
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches && !FAST;

  // ---------- nastavení ----------
  const KEY = 'malycz.panacek.v1';
  const FLOORS = [              // čáry, po kterých panáček chodí: [selektor, hrana]
    ['.nav', 'bottom', () => !mm.out && !mm.L], ['.portrait-card', 'top'], ['.portrait-note', 'top'], ['.index', 'top'],
    ['.section-card', 'top'], ['.refs', 'top'], ['.footer', 'top'],
    ['.portrait', 'bottom', () => world.open],   // podlaha dílny, jen když je otevřená
  ];
  const STASH = '.footer';      // čára se skrýší
  const SPOTS = [0.28, 0.74];   // dvě místa skrýše (podíl šířky čáry)
  const q = FAST ? 0.15 : 1;
  const T = {                   // prodlevy v ms
    first: 2500 * q,            // nejdřív takhle dlouho po načtení
    idle: 4000 * q,             // klid před prvním vykouknutím
    afterPeek: 2600 * q,        // od vykouknutí k prvnímu výstupu
    again: 7000 * q,            // pauza mezi dalšími výstupy, postupně roste
    againMax: 45000 * q,
    retrieve: 6500 * q,         // za jak dlouho se vrátí pro upuštěný šroubovák
    search: 3000 * q,           // první hledání po sebrání
    searchIdle: 25000 * q,      // další hledání až po delším klidu
    waitSeen: 14000,            // jak dlouho čeká u skrýše na diváka
  };
  const TICKLE = 230;           // kolik šimrání je potřeba (zhruba px pohybu po panáčkovi)

  // ---------- barvy ----------
  const css = getComputedStyle(root);
  const cv = (n, d) => (css.getPropertyValue(n) || '').trim() || d;
  const K = cv('--hard', '#101317'), TEAL = cv('--accent', '#006c86');
  const W = '#fff', Y = '#f2b705', YD = '#c48d00', PINK = '#ff9db0', GREY = '#b9c1c9', BLUE = '#6cc7f5';

  // ---------- rozměry ----------
  // S je základní jednotka (px). Postava je vysoká asi 16 S, plátno má 24 × 24 S.
  const G = 24;
  const B = { thigh: 3.0, shin: 2.9, torso: 4.6, neck: 0.45, head: 2.7, up: 2.85, fore: 2.7, lw: 0.6 };
  let S = 4, FW = 96, HW = 32, R = 17, DPR = 1;

  // ---------- stav ----------
  const fig = { cx: 0, gy: 0, dir: 1, sink: 0, pose: 'stand', lean: 0, rot: 0, rotO: 0, air: false, brolly: false, vis: false, ticklish: false, freezable: false, floor: null, t: 0, hold: false, pebble: null, reachY: 0, tool: null };
  // šroubovák: stash (schovaný), stuck (trčí ze skrýše), air (v pohybu), carry, ground, fly, belt
  const sd = { state: 'stash', gx: 0, gy: 0, ang: 0, ta: 0, cdir: 0, x: 0, fy: 0, out: 0, el: null, frac: 0, spot: 0 };
  const st = { stage: 0, rounds: 0, searched: false, gathered: false, longs: 0, fetches: 0, repairs: 0, lamps: 0, napped: false, thrown: 0, spells: 0, towers: 0 };
  const ptr = { x: -1e4, y: -1e4, on: false, v: 0, ts: 0 };
  const CANCEL = Symbol('cancel'), FREE = { dead: false };
  const tasks = new Set();
  let act = null, raf = 0, last = 0, speed = 1, forced = null;
  let tickle = 0, frozen = false, frozenFor = 0, thaw = 0, blinkAt = 1500, blinkEnd = 0;
  let lastActivity = performance.now(), lastEnd = lastActivity, t0 = lastActivity;
  let layer, figEl, fctx, sdEl, belt, slots, count;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (b < a ? (a + b) / 2 : Math.min(b, Math.max(a, v)));
  const rad = d => d * Math.PI / 180;
  const TAU = Math.PI * 2;
  const ease = {
    in: p => p * p,
    out: p => 1 - (1 - p) ** 3,
    io: p => (p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
    back: p => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
  };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* bez úložiště to jde taky */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { /* nic */ } },
  };

  // ---------- stavba ----------
  function pstyle() { const s = doc.createElement('style'); s.dataset.pnk = ''; return s; }
  function el(tag, cls) { const e = doc.createElement(tag); e.className = cls; return e; }
  function canvas(w, h) { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }

  function build() {
    const style = pstyle();
    style.textContent = `
.pnk-layer{position:absolute;left:0;top:0;width:100%;height:0;overflow:hidden;pointer-events:none;z-index:2147483000}
.pnk-fig,.pnk-sd{position:absolute;left:0;top:0;display:none;will-change:transform}
.pnk-fig{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}
html.pnk-grabbing,html.pnk-grabbing *{cursor:grabbing!important;user-select:none!important}
.pnk-visor{position:absolute;left:0;top:0;width:${Math.round(1.5 * 4)}px;height:3px;background:${TEAL};border:1.5px solid ${K};border-radius:2px;pointer-events:none}
.pnk-layer canvas,.pnk-belt canvas,.pnk-fly{display:block}
.pnk-sd{border:0;padding:0;margin:0;background:none;pointer-events:none;-webkit-tap-highlight-color:transparent}
.pnk-sd.is-ground{pointer-events:auto;cursor:pointer}
.pnk-sd.is-ground canvas{animation:pnk-bob 1.1s ease-in-out infinite}
.pnk-sd::before{content:"";position:absolute;inset:-16px}
.pnk-sd:focus-visible{outline:2px solid var(--accent,#006c86);outline-offset:8px}
@keyframes pnk-bob{50%{transform:translateY(-3px)}}
.pnk-puff{position:absolute;left:0;top:0;font:800 12px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;color:var(--accent,#006c86);white-space:nowrap;animation:pnk-puff .9s ease-out forwards}
.pnk-puff.is-slow{animation-duration:1.6s}
@keyframes pnk-puff{from{opacity:0;transform:translate(var(--x),var(--y))}15%{opacity:1}to{opacity:0;transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) - 30px))}}
.pnk-fly{position:fixed;left:0;top:0;z-index:2147483002;pointer-events:none}
.pnk-belt{position:fixed;right:16px;bottom:16px;z-index:2147483001;display:flex;align-items:center;gap:10px;padding:7px 12px 7px 10px;background:var(--hard,#101317);color:#fff;font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;transform:translateY(170%);visibility:hidden;transition:transform .55s cubic-bezier(.2,1.5,.4,1),visibility 0s .55s}
.pnk-belt.is-on{transform:none;visibility:visible;transition:transform .55s cubic-bezier(.2,1.5,.4,1)}
.pnk-belt::before{content:"";position:absolute;left:4px;right:4px;top:3px;bottom:3px;border-top:1px dashed rgba(255,255,255,.35);border-bottom:1px dashed rgba(255,255,255,.35);pointer-events:none}
.pnk-belt.is-bump{animation:pnk-bump .35s ease-out}
.pnk-belt.is-gold{box-shadow:0 0 0 2px #f2b705}
.pnk-pocket{position:absolute;left:0;top:0;box-sizing:border-box;border:1.5px solid ${K};padding:0;margin:0;cursor:pointer;pointer-events:auto;font:800 8px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#fff;-webkit-tap-highlight-color:transparent}
.pnk-pocket::before{content:"";position:absolute;inset:-8px}
.pnk-pk-note{width:22px;height:16px;background:repeating-linear-gradient(to bottom,#fff 0 3px,#9fc5d3 3px 4px);transform-origin:50% 50%}
.pnk-pk-coin{width:16px;height:16px;border-radius:50%;background:#e2b13c;color:${K};font-size:9px}
.pnk-pk-res{width:30px;height:9px;border:0;background:linear-gradient(to right,transparent 0 7px,#e8cf9f 7px 23px,transparent 23px),linear-gradient(${K},${K}) 0 50%/100% 1.5px no-repeat}
.pnk-pk-res::after{content:"";position:absolute;left:10px;top:0;width:10px;height:9px;background:linear-gradient(to right,#c0392b 0 2px,transparent 2px 4px,#7b4b2a 4px 6px,transparent 6px 8px,#e67e22 8px 10px)}
.pnk-pk-chip{width:26px;height:14px;background:${K};box-shadow:0 -3px 0 -1px #b9c1c9,0 3px 0 -1px #b9c1c9;font-size:7px}
.pnk-pk-screw{width:18px;height:8px;border-radius:1px 4px 4px 1px;background:repeating-linear-gradient(to right,#b9c1c9 0 2px,#6b7580 2px 3px)}
@media print{.pnk-layer,.pnk-belt,.pnk-corner,.pnk-rub,.pnk-tip,.pnk-fly{display:none!important}body::after{content:"Panáček vzkazuje: tisknout web? To se nedělá. Ale dobře, tady to máte.";display:block;margin:24px;padding:12px;border:2px dashed #101317;font:700 14px/1.4 ui-monospace,monospace}}
html.pnk-fin .pnk-belt{transform:translateY(170%)}
.pnk-css{position:fixed;left:0;top:0;z-index:2147483003;padding:3px 7px;background:#fff;border:1px solid ${K};color:${K};font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap;pointer-events:none;box-shadow:2px 2px 0 rgba(16,19,23,.2)}
.pnk-css.is-up{background:#f2b705}
html.pnk-fin .pnk-dilna:not(.is-open){display:none}
html.pnk-fin .pnk-map{max-width:380px;max-height:380px}
@keyframes pnk-bump{40%{transform:translateY(-7px)}}
.pnk-buckle{flex:none;width:14px;height:20px;border:3px solid #f2b705}
.pnk-slots{display:flex;gap:5px}
.pnk-slot{position:relative;flex:none;width:26px;height:46px;padding:0;margin:0;border:1px dashed rgba(255,255,255,.4);background:rgba(255,255,255,.06);color:inherit;font:inherit}
.pnk-slot.is-next{animation:pnk-next 1s steps(2) infinite}
@keyframes pnk-next{50%{border-color:#f2b705}}
.pnk-slot.is-full{border:1px solid #fff;cursor:pointer}
.pnk-slot:focus-visible{outline:2px solid #f2b705;outline-offset:2px}
.pnk-slot canvas{position:absolute;left:50%;top:50%;width:40px;height:10px;margin:-5px 0 0 -20px;transform:rotate(90deg)}
.pnk-count{min-width:3ch;text-align:right;opacity:.75}
@media (max-width:560px){.pnk-belt{right:10px;bottom:10px;gap:7px}.pnk-belt-name{display:none}}
.pnk-slot.is-active{border-color:#f2b705;background:rgba(242,183,5,.24)}
.pnk-slot.is-hint{animation:pnk-wiggle 3.6s ease-in-out infinite}
@keyframes pnk-wiggle{0%,76%,100%{transform:none}80%{transform:rotate(-14deg)}85%{transform:rotate(11deg)}90%{transform:rotate(-6deg)}95%{transform:rotate(3deg)}}
.pnk-map{position:relative;z-index:1}
.pnk-ropes{position:absolute;left:0;top:0;pointer-events:none}
.portrait-note.pnk-claim{border-left-color:#f2b705}
.pnk-peb{position:absolute;left:0;top:0;background:#fff;border:1.5px solid ${K};box-sizing:border-box;pointer-events:none;will-change:transform}
.pnk-pry{position:absolute;left:0;top:0;display:none;pointer-events:none;transform-origin:39px 5px}
html.pnk-prying,html.pnk-prying *{user-select:none!important}
html.pnk-tool .portrait{touch-action:none}
html.pnk-tool .pnk-pin{animation:pnk-glint 1.5s ease-in-out infinite}
@keyframes pnk-glint{50%{fill:#f2b705}}
.pnk-pin.is-hover{fill:#f2b705!important;animation:none!important}
.pnk-dilna{position:absolute;inset:0;z-index:0;overflow:hidden;background-color:#eef1f4;background-image:radial-gradient(circle,rgba(16,19,23,.16) 1.1px,transparent 1.5px);background-size:14px 14px;color:${K};font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.pnk-dl-label{position:absolute;left:14px;top:14px;padding:4px 9px;border:1px solid ${K};background:#f7f8fa;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.pnk-dl-books{position:absolute;left:9%;bottom:56%;display:flex;align-items:flex-end;gap:2px}
.pnk-book{position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:var(--bg);color:var(--fg);border:1.5px solid ${K};transition:transform .2s}
.pnk-book::before,.pnk-book::after{content:"";position:absolute;left:3px;right:3px;height:2px;background:currentColor;opacity:.5}
.pnk-book::before{top:9px}.pnk-book::after{bottom:9px}
.pnk-book span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5px;font-weight:800;line-height:1;letter-spacing:-.01em;white-space:nowrap}
.pnk-book:hover,.pnk-book:focus-visible{transform:translateY(-8px)}
.pnk-dl-shelf{position:absolute;left:6%;right:36%;top:44%;height:6px;background:${K}}
.pnk-dl-shelf::before,.pnk-dl-shelf::after{content:"";position:absolute;top:6px;width:4px;height:12px;background:${K}}
.pnk-dl-shelf::before{left:12%}.pnk-dl-shelf::after{right:12%}
.pnk-dl-shelf-label{position:absolute;left:6%;top:calc(44% + 24px);color:#5f6872;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}
.pnk-dl-board{position:absolute;left:6%;right:36%;top:calc(44% + 46px);bottom:6%;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;align-content:center;gap:10px 8px;padding:12px 10px;background:#e6d3ad;border:2px solid ${K}}
.pnk-note{position:relative;display:grid;gap:4px;padding:10px 8px 8px;background:#fff;border:1px solid ${K};box-shadow:2px 2px 0 rgba(16,19,23,.16);transform:rotate(var(--r));transition:transform .2s}
.pnk-note:nth-child(even){background:#fff6d6}
.pnk-note::before{content:"";position:absolute;left:50%;top:-5px;width:8px;height:8px;margin-left:-5px;border-radius:50%;background:#d9483b;border:1px solid ${K}}
.pnk-note small{color:${TEAL};font:800 8.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
.pnk-note b{font-size:13px;line-height:1.1;letter-spacing:-.03em;white-space:nowrap}
@media (max-width:560px){.pnk-note{padding:9px 6px 7px}.pnk-note b{font-size:11.5px}.pnk-dl-board{gap:10px 6px;padding:12px 8px}}
.pnk-note:hover,.pnk-note:focus-visible{transform:none;z-index:1}
.pnk-dl-hook{position:absolute;right:6%;top:9%;width:28%;display:flex;flex-direction:column;align-items:center}
.pnk-peg{width:12px;height:12px;border-radius:50%;background:${K}}
.pnk-hang{position:relative;margin:-4px 0 0;padding:14px 0 0;border:0;background:none;cursor:pointer;transform-origin:50% 0;animation:pnk-sway 4.5s ease-in-out infinite}
.pnk-hang::before{content:"";position:absolute;left:50%;top:0;width:2px;height:16px;margin-left:-1px;background:${K}}
.pnk-hang canvas{display:block;width:34px;height:80px}
.pnk-hang:focus-visible{outline:2px solid ${TEAL};outline-offset:4px}
.pnk-tag{position:absolute;left:66%;top:34px;padding:3px 6px;background:#fff;border:1px solid ${K};font:800 12px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;transform:rotate(12deg)}
@keyframes pnk-sway{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
.pnk-hang.is-jiggle{animation:pnk-jiggle .7s ease-out}
@keyframes pnk-jiggle{20%{transform:rotate(16deg)}45%{transform:rotate(-11deg)}70%{transform:rotate(5deg)}}
.pnk-dl-msg{margin-top:10px;color:#5f6872;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;opacity:0;transition:opacity .3s}
.pnk-dl-msg.is-on{opacity:1}
.pnk-dl-hook.is-empty .pnk-hang,.pnk-dl-hook.is-empty .pnk-dl-msg{visibility:hidden}
.pnk-pl{position:absolute;left:0;top:0;display:none;border:0;padding:0;margin:0;background:none;pointer-events:none;transform-origin:50% 100%;will-change:transform;-webkit-tap-highlight-color:transparent}
.pnk-pl canvas{width:34px;height:80px}
.pnk-pl.is-ground{pointer-events:auto;cursor:pointer}
.pnk-pl:focus-visible{outline:2px solid ${TEAL};outline-offset:4px}
.pnk-slot canvas.pnk-ico-pl{width:16px;height:38px;margin:-19px 0 0 -8px;transform:none}
html.pnk-pliers .index-tags .tag:not(.pnk-hole){outline:2px dashed #f2b705;outline-offset:1px}
.pnk-cutoff{position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;will-change:transform}
.tag.pnk-half{position:relative;z-index:3}
.tag.pnk-half-L{transform-origin:calc(100% - 3px) 50%;animation:pnk-tagL 1.1s forwards}
.tag.pnk-half-R{transform-origin:3px 50%;animation:pnk-tagR 1.1s forwards}
.tag.pnk-half.pnk-still{animation:none}
.tag.pnk-half-L.pnk-still{transform:rotate(calc(var(--a) * -1))}
.tag.pnk-half-R.pnk-still{transform:rotate(var(--a))}
@keyframes pnk-tagL{0%{transform:none;animation-timing-function:ease-in}40%{transform:rotate(calc(var(--a) * -1));animation-timing-function:ease-out}58%{transform:rotate(calc(var(--a) * -.78));animation-timing-function:ease-in}74%{transform:rotate(calc(var(--a) * -1));animation-timing-function:ease-out}84%{transform:rotate(calc(var(--a) * -.93));animation-timing-function:ease-in}100%{transform:rotate(calc(var(--a) * -1))}}
@keyframes pnk-tagR{0%{transform:none;animation-timing-function:ease-in}40%{transform:rotate(var(--a));animation-timing-function:ease-out}58%{transform:rotate(calc(var(--a) * .78));animation-timing-function:ease-in}74%{transform:rotate(var(--a));animation-timing-function:ease-out}84%{transform:rotate(calc(var(--a) * .93));animation-timing-function:ease-in}100%{transform:rotate(var(--a))}}
.tag.pnk-hole{box-sizing:border-box;justify-content:center;padding:0 4px;background:none;border-left:0;outline:1px dashed #98a3ae;outline-offset:-1px}
.tag.pnk-hole::before{content:none}
.tag.pnk-hole a{color:${TEAL};font-size:10px;letter-spacing:0;text-transform:none;text-decoration:underline}
`;
    // při páčení kurzor mizí, šroubovák je vidět jen jako páka u spoje
    style.textContent += `html.pnk-tool,html.pnk-tool *{cursor:url(${cursorURL()}) 11 11,crosshair!important}html.pnk-tool.pnk-prying,html.pnk-tool.pnk-prying *{cursor:none!important}`;
    doc.head.appendChild(style);

    layer = el('div', 'pnk-layer');
    figEl = el('div', 'pnk-fig'); figEl.setAttribute('aria-hidden', 'true');
    const fc = canvas(1, 1); fctx = fc.getContext('2d'); figEl.appendChild(fc);
    sdEl = el('button', 'pnk-sd'); sdEl.type = 'button'; sdEl.setAttribute('aria-label', 'Sebrat šroubovák');
    sdEl.appendChild(canvas(1, 1));
    sdEl.addEventListener('click', collect);
    layer.append(sdEl, figEl);

    belt = el('div', 'pnk-belt'); belt.setAttribute('role', 'group');
    belt.innerHTML = '<button type="button" class="pnk-buckle" aria-label="Zvuk"></button><span class="pnk-belt-name">Opasek</span><span class="pnk-slots"></span><span class="pnk-count"></span><span class="pnk-pct"></span>';
    slots = [];
    for (let i = 0; i < 5; i++) {
      const b = el('button', 'pnk-slot'); b.type = 'button'; b.disabled = true; b.setAttribute('aria-label', 'Prázdné poutko');
      belt.querySelector('.pnk-slots').appendChild(b); slots.push(b);
    }
    count = belt.querySelector('.pnk-count');
    slots[0].addEventListener('click', () => { if (sd.state === 'belt') toggleTool(); });
    setCount(0);
    doc.body.append(layer, belt);
    buildPliers();
    buildExtra();
  }

  function measure() {
    S = innerWidth < 700 ? 3 : 4; FW = G * S; HW = 8 * S; R = 4.3 * S;
    DPR = Math.min(3, devicePixelRatio || 1);
    const fc = figEl.firstChild, sc = sdEl.firstChild;
    fc.width = fc.height = Math.round(FW * DPR);
    figEl.style.width = figEl.style.height = fc.style.width = fc.style.height = FW + 'px';
    sc.width = Math.round(20 * S * DPR); sc.height = Math.round(5 * S * DPR); drawSd(sc);
    sdEl.style.width = sc.style.width = 20 * S + 'px';
    sdEl.style.height = sc.style.height = 5 * S + 'px';
    sdEl.style.transformOrigin = `${4 * S}px ${2.5 * S}px`;   // otáčí se kolem středu rukojeti
    fitLayer();
    measureMap();
    placeFallen();
    placeExtra();
  }
  function fitLayer() {
    layer.style.height = '0px';
    layer.style.height = Math.max(root.scrollHeight, doc.body.scrollHeight) + 'px';
  }

  // ---------- čáry na stránce ----------
  function floors() {
    const out = [];
    for (const [sel, edge, cond] of FLOORS) for (const e of cond && !cond() ? [] : doc.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      if (r.width < 120 || !r.height) continue;
      out.push({ el: e, y: Math.round((edge === 'top' ? r.top : r.bottom - 1) + scrollY), x1: r.left + scrollX, x2: r.right + scrollX, stash: e.matches(STASH) });
    }
    return out.sort((a, b) => a.y - b.y);
  }
  const floorOf = e => floors().find(f => f.el === e);
  const spotX = (f, i) => f.x1 + clamp((f.x2 - f.x1) * SPOTS[i], 14 * S, f.x2 - f.x1 - 14 * S);
  const gapTo = (f, x) => (x < f.x1 ? f.x1 - x : x > f.x2 ? x - f.x2 : 0);

  // Čára, která je právě vidět a má nad sebou dost místa, nejlépe uprostřed okna.
  function visibleFloor() {
    const top = scrollY + 17 * S + 6, bot = scrollY + innerHeight - 10, mid = scrollY + innerHeight * .55;
    let best = null, bd = 1e9;
    for (const f of floors()) {
      if (f.y < top || f.y > bot) continue;
      if (Math.min(f.x2, scrollX + innerWidth) - Math.max(f.x1, scrollX) < FW * 1.5) continue;
      const d = Math.abs(f.y - mid);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  // Místo na čáře uvnitř okna a dál od kurzoru.
  function spotOn(f) {
    const lo = Math.max(f.x1 + HW, scrollX + HW + 8), hi = Math.min(f.x2 - HW, scrollX + innerWidth - HW - 8);
    if (hi <= lo) return (f.x1 + f.x2) / 2;
    let x = rand(lo, hi);
    if (ptr.on) {
      const px = ptr.x + scrollX;
      if (Math.abs(x - px) < 40 * S) x = px - lo > hi - px ? Math.max(lo, px - 55 * S) : Math.min(hi, px + 55 * S);
    }
    return x;
  }
  const atBottom = () => scrollY + innerHeight >= root.scrollHeight - 4;

  // ---------- šroubovák: kresba ----------
  function drawSd(c) {
    const g = c.getContext('2d'), u = c.width / 20;
    g.setTransform(u, 0, 0, u, 0, 0); g.clearRect(0, 0, 20, 5);
    paintSd(g, u);
  }
  function paintSd(g, u) {
    g.lineJoin = g.lineCap = 'round'; g.strokeStyle = K; g.lineWidth = Math.max(.32, 1.1 / u);
    // dřík a plochý hrot
    g.fillStyle = GREY;
    g.beginPath(); g.rect(8.4, 2.05, 9.4, .9); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(17.6, 1.85); g.lineTo(19.5, 1.55); g.lineTo(19.5, 3.45); g.lineTo(17.6, 3.15); g.closePath(); g.fill(); g.stroke();
    // objímka
    g.fillStyle = '#6b7580'; g.beginPath(); g.rect(7.5, 1.45, 1.1, 2.1); g.fill(); g.stroke();
    // rukojeť
    g.fillStyle = Y;
    g.beginPath();
    if (g.roundRect) g.roundRect(.5, .5, 7.2, 4, 1.7); else g.rect(.5, .5, 7.2, 4);
    g.fill(); g.stroke();
    g.strokeStyle = YD; g.lineWidth = Math.max(.25, .9 / u);
    for (const y of [1.75, 3.25]) { g.beginPath(); g.moveTo(1.6, y); g.lineTo(6.6, y); g.stroke(); }
  }

  // ---------- kostra ----------
  // Každý pohyb je pružina: póza řekne, kam chce, pružina tam tělo dovede.
  function spring(x, k, z = 1) { return { x, v: 0, k, d: 2 * z * Math.sqrt(k), z }; }
  function tune(s, k) { if (s.k !== k) { s.k = k; s.d = 2 * s.z * Math.sqrt(k); } }
  function stepS(s, to, h) { s.v += (s.k * (to - s.x) - s.d * s.v) * h; s.x += s.v * h; }
  const pt = (k = 260) => ({ x: spring(0, k), y: spring(0, k) });
  const rig = {
    face: spring(1, 90), hf: spring(1, 170), gaze: spring(1, 300), up: spring(0, 140),
    hipY: spring(5.7, 260), hipX: spring(0, 200), lean: spring(0, 140), tilt: spring(0, 120),
    walk: spring(0, 160), lagX: spring(0, 120, .3), lagY: spring(0, 150, .32), boing: spring(0, 110, .11),
    bend: [spring(-1, 200), spring(-1, 200)],
    hands: [pt(240), pt(240)], feet: [pt(1100), pt(1100)],
    phase: 0, px: 0, py: 0, snap: true, sk: null, P: null,
  };

  // Póza: cíle pro tělo. Souřadnice v jednotkách S, x dopředu (podle toho, kam kouká), y nahoru od země.
  // Ruka: [x, y, k čemu, ohyb lokte]; k čemu: 's' rameno, 'g' země, 'chin' brada, 'head' hlava.
  // Ohyb lokte se bez zadání dopočítá sám (loket míří dozadu a dolů).
  function poseOf(pose, t) {
    const ph = rig.phase * TAU, br = Math.sin(t / 650);
    const P = {
      hipY: 5.75 + br * .05, hipX: 0, lean: .04, tilt: 0, look: 1, gaze: null, up: 0,
      eyes: 'dot', mouth: 'smile', brows: 0, blush: 0, sweat: 0, quick: false,
      hands: [[1.45, -4.6 + br * .06, 's'], [-1.35, -4.7, 's']], feet: null, front: false,
      stride: 4, stance: 1.25, lift: 1.2, bob: .2,
    };
    const set = o => Object.assign(P, o);
    switch (pose) {
      case 'run': set({ lean: .24, stride: 5.2, lift: 1.6, bob: .35,
        hands: [[.5 + Math.cos(ph) * 1.8, -3.3, 's'], [.5 - Math.cos(ph) * 1.8, -3.3, 's']] }); break;
      case 'flee': set({ lean: .3, stride: 5.6, lift: 1.8, bob: .4, eyes: 'happy', mouth: 'open', blush: .8,
        hands: [[.4 + Math.cos(ph) * 2, -3, 's'], [.4 - Math.cos(ph) * 2, -3, 's']] }); break;
      case 'sneak': set({ hipY: 4.9, lean: .3, stride: 2.8, lift: 2, bob: .5, mouth: 'flat',
        hands: [[2, -.4 + Math.sin(ph) * .25, 's'], [1, .5 - Math.sin(ph) * .25, 's']] }); break;
      case 'drag': set({ hipY: 5, lean: .34, stride: 2.2, lift: .8, bob: .22, eyes: 'effort', mouth: 'grit', sweat: 1 }); break;
      case 'rest': set({ hipY: 5 + Math.sin(t / 110) * .12, lean: .62 + Math.sin(t / 110) * .05, tilt: .15,
        eyes: 'effort', mouth: 'open', sweat: 1, feet: [[-1.1, 0], [1, 0]] }); break;
      case 'pull': {
        const l = fig.lean, gy = holdY();
        set({ hipY: 4.9 + l * .5, lean: .12 + l * .42, eyes: l < -.2 ? 'effort' : 'dot', mouth: l < -.2 ? 'grit' : 'flat',
          feet: [[-1.6, 0], [1.3, 0]], sweat: l < -.5 ? 1 : 0 });
        if (gy < 6) set({ hipY: Math.max(3.2, 2.4 + gy * .45), lean: P.lean + .25 });   // tlačí dolů
        break;
      }
      case 'jump': set({ hipY: 6.4, lean: .1, eyes: 'wide', mouth: 'o', feet: [[-.7, 1.9], [1, 2.3]],
        hands: [[2.4, 4.6, 's'], [-2.6, 4.2, 's']] }); break;
      case 'land': set({ hipY: 4.2, lean: .25, feet: [[-1.3, 0], [1.3, 0]],
        hands: [[2.6, -2.2, 's'], [-2.4, -2.6, 's']] }); break;
      case 'sit': set({ hipY: 1.35, hipX: -.6, lean: -.12, eyes: 'dizzy', mouth: 'o', feet: [[3.4, .35], [4.3, .55]],
        hands: [[-2.4, .6, 'g'], [-1.8, .6, 'g']] }); break;
      case 'stiff': set({ hipY: 5.95, hipX: Math.sin(t / 30) * .05, lean: 0, eyes: 'wide', brows: 1, mouth: 'flat', sweat: 1, quick: true,
        feet: [[-.55, 0], [.55, 0]], hands: [[.45, -5.1, 's'], [-.45, -5.1, 's']] });
        if (ptr.on) set({ gaze: clamp((ptr.x + scrollX - fig.cx) / (10 * S), -1, 1),
          up: clamp((fig.gy - 13 * S - ptr.y - scrollY) / (12 * S), -1, 1) });
        break;
      case 'laugh': set({ hipY: 5.1 + Math.abs(Math.sin(t / 85)) * .35, lean: -.22 + Math.sin(t / 130) * .1, tilt: -.35,
        eyes: 'happy', mouth: 'open', blush: 1, feet: [[-1, 0], [1.1, 0]],
        hands: [[1.3, 6, 'g'], [.7, 5.4, 'g']] }); break;
      case 'wriggle': set({ hipY: 5.5, lean: Math.sin(t / 95) * .2, tilt: Math.sin(t / 140) * .25,
        eyes: 'happy', mouth: 'smile', blush: .7, feet: [[-.7, 0], [.8, 0]],
        hands: [[1.1, 8.3, 'g'], [.6, 7.6, 'g']] }); break;
      case 'sad': set({ hipY: 5.5, lean: .18, tilt: .5, up: -.6, eyes: 'half', mouth: 'frown',
        hands: [[.5, -5.2, 's'], [-.3, -5.2, 's']] }); break;
      case 'sadwalk': set({ hipY: 5.5, lean: .2, tilt: .5, up: -.6, eyes: 'half', mouth: 'frown', stride: 2.3, lift: .6, bob: .12,
        hands: [[.5 + Math.cos(ph) * .5, -5.2, 's'], [-.3 - Math.cos(ph) * .5, -5.2, 's']] }); break;
      case 'peek': {
        const L = fig.sink / S;
        set({ quick: true, brows: .5, mouth: 'flat' });
        if (L > 5.5) set({ hands: [[-2.5, L + .15, 'g'], [2.5, L + .15, 'g']] });
        break;
      }
      case 'think': set({ hipX: -.35, lean: -.06, tilt: -.12, up: .7, look: .8, mouth: 'flat', front: true,
        feet: [[.75, 0], [-.35, 0]],
        hands: [[.25, -.15 + Math.sin(t / 380) * .12, 'chin'], [1, 7.3, 'g']] }); break;
      case 'scratch': set({ tilt: .22, up: .5, look: .7, mouth: 'flat', feet: [[.9, 0], [-.6, 0]],
        hands: [[1.3, -4.7, 's'], [-3 + Math.sin(t / 60) * .25, .4 + Math.cos(t / 60) * .3, 'head']] }); break;
      case 'alarm': set({ hipY: 5.15, hipX: Math.sin(t / 45) * .03, lean: .06, eyes: 'wide', brows: 1, mouth: 'o', quick: true,
        feet: [[-1.3, 0], [1.2, 0]], hands: [[2.6, 8.6, 'g'], [1.7, 9.5, 'g']] }); break;
      case 'bend': case 'place': {           // shýbne se k zemi, nebo pokládá do výšky reachY
        const ry = pose === 'place' ? clamp(fig.reachY, 0, 4) : .35;
        set({ hipY: 3.2 + ry * .55, lean: .95 - ry * .15, tilt: .1, up: -.7, mouth: 'flat', feet: [[-1.3, 0], [.9, 0]],
          hands: [[2.5, ry, 'g'], [-.6, -4.3, 's']] }); break;
      }
      case 'inspect': set({ tilt: .3, eyes: 'wide', mouth: 'o', brows: .4, front: true,
        hands: [[1.1, -.4, 'chin'], [-1.2, -4.6, 's']] }); break;
      case 'proud': set({ lean: -.1, up: .35, eyes: 'happy', mouth: 'smile', blush: .4, feet: [[-1.2, 0], [1.2, 0]],
        hands: [[1.1, -3.5, 's'], [-1.1, -3.5, 's']] }); break;
      case 'reach': set({ hipY: 6.05, lean: 0, up: 1, eyes: 'wide', mouth: 'o', quick: true, feet: [[-.35, .3], [.35, .3]],
        hands: [[.7, 5.3, 's'], [.25, 5.4, 's']] }); break;
      case 'trophy': set({ lean: -.08, up: .5, eyes: 'happy', mouth: 'smile', blush: .4, stride: 3, lift: 1, bob: .3,
        hands: [[.9, 5.2, 's'], [-.5, 5.2, 's']] }); break;
      case 'windup': set({ lean: -.25, up: .8, mouth: 'grit', brows: .6, feet: [[-1.5, 0], [1.2, 0]],
        hands: [[-2.7, 2.2, 's'], [2, -1.5, 's']] }); break;
      case 'throw': set({ lean: .3, up: .8, mouth: 'o', feet: [[-1.6, 0], [1.4, 0]],
        hands: [[2.9, 4, 's'], [-1.6, -3, 's']] }); break;
      case 'hammer': set({ lean: .35, up: -.6, mouth: 'grit', feet: [[-1.3, 0], [1, 0]],
        hands: [[2.3, .9 + Math.abs(Math.sin(t / 120)) * 2.6, 'g'], [-.8, -4.2, 's']] }); break;
      case 'shine': set({ lean: .1, mouth: 'flat', brows: .3, stride: 2.6, lift: 1, hands: [[2.6, -1.6, 's'], [-1, -4.4, 's']] }); break;
      case 'yawn': set({ lean: -.1, tilt: -.2, up: .6, eyes: 'shut', mouth: 'open', front: true, hipY: 1.35, hipX: -.6, feet: [[3.4, .35], [4.3, .55]],
        hands: [[.2, .1, 'chin'], [-2.2, .6, 'g']] }); break;
      case 'sleep': set({ hipY: 1.35, hipX: -.6, lean: .28, tilt: .55 + Math.sin(t / 900) * .08, up: -.5, eyes: 'shut', mouth: 'flat',
        feet: [[3.4, .35], [4.3, .55]], hands: [[1.6, .6, 'g'], [2.3, .5, 'g']] }); break;
      case 'lookup': set({ up: 1, look: .4, mouth: 'o', brows: .3 }); break;
      case 'peekdown': set({ lean: .32, up: -1, eyes: 'wide', mouth: 'o', brows: .4, feet: [[-1.2, 0], [.6, 0]] }); break;
      case 'climb': {                          // na žebříku: ruce a nohy se střídají
        const c = Math.sin(t / 140);
        set({ hipY: 5.4, lean: .06, up: .3, mouth: 'flat', quick: true, front: true,
          feet: [[3.6, .5 + Math.max(0, c) * 1.8], [3.1, .5 + Math.max(0, -c) * 1.8]],
          hands: [[4.2, 1.6 + c * 1.1, 's'], [4.0, 1.6 - c * 1.1, 's']] }); break;
      }
      case 'plugin': set({ lean: .12 + fig.lean * .18, mouth: 'grit', brows: .3, feet: [[-1.3, 0], [1, 0]],
        hands: [[2.5 + fig.lean * .6, clamp(fig.reachY, 1, 13), 'g'], [-1, -4.4, 's']] }); break;
      case 'dangle': {                         // visí za čepici: kope nohama a mává rukama
        const a = Math.sin(t / 105), b = Math.sin(t / 88), dz = grab.shake > 5;
        set({ hipY: 5.8, lean: 0, up: .25, quick: true, eyes: dz ? 'dizzy' : 'wide', mouth: dz ? 'open' : 'o', brows: .9, sweat: 1,
          feet: [[.5 + a * 1.7 - grab.vx * .6, .2 + Math.max(0, b) * 3], [-.4 - a * 1.7 - grab.vx * .6, .2 + Math.max(0, -b) * 3]],
          hands: [[4 + Math.sin(t / 70) * .5, 2 + Math.cos(t / 83) * 1.6, 's'], [-3.9 - Math.sin(t / 77) * .5, 1.8 - Math.cos(t / 91) * 1.6, 's']] });
        break;
      }
      case 'fly': set({ hipY: 5.8, lean: 0, eyes: 'wide', mouth: 'open', brows: .6, quick: true,
        feet: [[2, 1.4], [-2, 1.2]], hands: [[4.3, 1.6, 's'], [-4.3, 1.9, 's']] }); break;
      case 'brolly': set({ hipY: 5.85, lean: 0, eyes: 'happy', mouth: 'smile', quick: true,
        feet: [[.5 + Math.sin(t / 300) * .5, .6], [-.4 + Math.sin(t / 300) * .5, .5]], hands: [[.55, 5.3, 's'], [.25, 5.1, 's']] }); break;
      case 'wave': set({ lean: -.05, up: .4, eyes: 'happy', mouth: 'open', blush: .3, look: .2,
        hands: [[2 + Math.sin(t / 95) * 1.1, 5.6, 's'], [-1.2, -4.5, 's']] }); break;
      case 'dazzled': set({ lean: -.16, tilt: -.25, up: .35, eyes: 'shut', mouth: 'grit', brows: .9, front: true,
        hands: [[1.25, .15, 'head'], [.35, .35, 'head']] }); break;
      case 'blow': set({ lean: .05, tilt: .1, up: -.2, eyes: 'effort', mouth: 'o', sweat: 1, front: true, feet: [[-.9, 0], [.9, Math.max(0, Math.sin(t / 70)) * .8]],
        hands: [[1.6 + Math.sin(t / 50) * .5, -.6 + Math.cos(t / 50) * .4, 'chin'], [-1.3, -4.4, 's']] }); break;
      case 'rub': set({ lean: .2, tilt: .15, eyes: 'effort', mouth: 'grit', feet: [[-1.2, 0], [1, 0]],
        hands: [[-1.9 + Math.sin(t / 60) * .5, -4.6 + Math.cos(t / 60) * .4, 's'], [1.3, -4.4, 's']] }); break;
      case 'feel': set({ tilt: .2, up: .7, eyes: 'wide', mouth: 'o', brows: .7, front: true,
        hands: [[1.9 + Math.sin(t / 90) * .4, 1.4, 'head'], [-1.2, -4.6, 's']] }); break;
      case 'angry': set({ lean: -.08, up: .3, eyes: 'dot', mouth: 'grit', brows: 1, quick: true,
        feet: [[1.3, Math.max(0, Math.sin(t / 85)) * .55], [-1.3, 0]], hands: [[2.9, 1.3 + Math.sin(t / 55) * .6, 's'], [-.55, -3.75, 's', -1]] }); break;
    }
    // spoj v ruce nese před sebou
    if (fig.pebble && pose !== 'bend' && pose !== 'place' && pose !== 'inspect' && pose !== 'windup') P.hands[0] = [1.7, -2.4, 's'];
    if (fig.plug && pose !== 'place' && pose !== 'plugin') P.hands[0] = [2.3, -2, 's'];
    return P;
  }

  // Úchop: konec rukojeti šroubováku v souřadnicích postavy.
  function holdPt(k) {
    const a = rad(sd.ang), bx = sd.gx - Math.cos(a) * k * S, by = sd.gy - Math.sin(a) * k * S;
    return { x: (bx - fig.cx) / S, y: (fig.gy - by) / S };
  }
  const holdY = () => (fig.hold ? holdPt(3.2).y : 9);

  function effectivePose() {
    if (forced) return forced;
    if (fig.pose === 'laugh') return 'laugh';
    if (fig.dazzle > .5 && !fig.air && fig.pose !== 'sleep' && fig.pose !== 'yawn') return 'dazzled';
    if (frozen) return 'stiff';
    if (tickle > 40 && fig.ticklish) return 'wriggle';
    return fig.pose;
  }

  function updateRig(dt) {
    const t = fig.t, P = poseOf(effectivePose(), t);
    const dx = fig.cx - rig.px, dy = fig.gy - rig.py;
    rig.px = fig.cx; rig.py = fig.gy;
    const sec = Math.max(dt, 1) / 1000;
    const vx = rig.snap ? 0 : dx / S / sec, vy = rig.snap ? 0 : -dy / S / sec;
    if (!rig.snap) rig.phase += Math.abs(dx) / S / (2 * P.stride);

    tune(rig.face, P.quick ? 420 : 90); tune(rig.hf, P.quick ? 700 : 170);
    const body = [
      [rig.face, fig.dir], [rig.hf, fig.dir], [rig.gaze, P.gaze !== null ? P.gaze : fig.dir * P.look], [rig.up, P.up],
      [rig.hipY, P.hipY], [rig.hipX, P.hipX], [rig.lean, P.lean], [rig.tilt, P.tilt],
      [rig.walk, P.feet ? 0 : clamp(Math.abs(vx) / 5, 0, 1)],
      [rig.lagX, fig.air ? 0 : clamp(-vx * .012, -.9, .9)], [rig.lagY, fig.air ? 0 : clamp(-vy * .012, -1.2, 1.2)], [rig.boing, 0],
    ];
    if (rig.snap) for (const [s, v] of body) { s.x = v; s.v = 0; }
    const n = Math.max(1, Math.ceil(dt / 8)), h = dt / n / 1000;
    for (let i = 0; i < n; i++) for (const [s, v] of body) stepS(s, v, h);

    const sk = skeleton(P);
    const F = rig.face.x, w = rig.walk.x;
    const limbs = [], bends = [];
    for (let i = 0; i < 2; i++) {
      // ruka
      const [u, y, m] = P.hands[i];
      let tx, ty;
      if (fig.hold) { const g = holdPt(i ? 1.9 : 3.2); tx = g.x; ty = g.y; }
      else if (m === 's') { tx = sk.sh.x + u * F; ty = sk.sh.y + y; }
      else if (m === 'chin') { tx = sk.hc.x + F * (.6 + u); ty = sk.hc.y - 2.3 + y; }
      else if (m === 'head') { tx = sk.hc.x + F * u; ty = sk.hc.y + y; }
      else { tx = u * F; ty = y; }
      limbs.push([rig.hands[i], tx, ty]);
      // loket: zadaný, jinak tam, kam ho tělo dá samo (dozadu a dolů)
      const ux = tx - sk.sh.x, uy = ty - sk.sh.y, ul = Math.hypot(ux, uy) || 1;
      bends.push([rig.bend[i], P.hands[i][3] ? P.hands[i][3] * F : clamp((.4 * F * uy / ul - .9 * ux / ul) / .25, -1, 1)]);
      // noha: chůze, nebo pevná póza
      const p = (rig.phase + i * .5) * TAU;
      const fu = P.feet ? P.feet[i][0] : (i ? P.stance : -P.stance) * (1 - w) - Math.cos(p) * P.stride / 2 * w;
      const fy = P.feet ? P.feet[i][1] : Math.max(0, Math.sin(p)) * P.lift * w;
      limbs.push([rig.feet[i], fu * F, fy]);
    }
    for (const [s, v] of bends) { if (rig.snap) { s.x = v; s.v = 0; } else for (let i = 0; i < n; i++) stepS(s, v, h); }
    for (const [o, tx, ty] of limbs) {
      if (rig.snap) { o.x.x = tx; o.y.x = ty; o.x.v = o.y.v = 0; continue; }
      for (let i = 0; i < n; i++) { stepS(o.x, tx, h); stepS(o.y, ty, h); }
    }
    rig.snap = false; rig.sk = sk; rig.P = P;
  }

  function skeleton(P) {
    const F = rig.face.x, HF = rig.hf.x, w = rig.walk.x, a = rig.lean.x * F;
    const hip = { x: rig.hipX.x * F, y: rig.hipY.x + w * P.bob * Math.cos(rig.phase * 2 * TAU) };
    const sx = Math.sin(a), sy = Math.cos(a);
    const neck = { x: hip.x + sx * B.torso, y: hip.y + sy * B.torso };
    const sh = { x: hip.x + sx * B.torso * .86, y: hip.y + sy * B.torso * .86 };
    const ha = a + rig.tilt.x * HF;
    const bo = Math.max(-.3, rig.boing.x);
    const hc = { x: neck.x + Math.sin(ha) * (B.neck + B.head + bo) + rig.lagX.x, y: neck.y + Math.cos(ha) * (B.neck + B.head + bo) + rig.lagY.x };
    return { F, HF, a, ha, hip, neck, sh, hc };
  }

  // Dvoukloubová inverzní kinematika: kde je loket nebo koleno.
  function ik(a, tx, ty, l1, l2, bend) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1e-4;
    const dd = clamp(d, Math.abs(l1 - l2) + .01, (l1 + l2) * .999), ux = dx / d, uy = dy / d;
    const m = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, l1 * l1 - m * m));
    return [{ x: a.x + ux * m - uy * hh * bend, y: a.y + uy * m + ux * hh * bend }, { x: a.x + ux * dd, y: a.y + uy * dd }];
  }

  // ---------- kreslení postavy ----------
  function drawFig(dt) {
    updateRig(dt);
    const g = fctx, sk = rig.sk, P = rig.P, t = fig.t;
    const { F, HF, hip, neck, sh, hc, ha } = sk;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    // počátek dole uprostřed, y nahoru, jednotka S
    g.setTransform(DPR * S, 0, 0, -DPR * S, g.canvas.width / 2, g.canvas.height);
    g.lineCap = g.lineJoin = 'round'; g.lineWidth = B.lw; g.strokeStyle = K;

    const hose = (a, j, e) => {                // končetina jako oblouk procházející kloubem
      g.beginPath(); g.moveTo(a.x, a.y);
      g.quadraticCurveTo(2 * j.x - (a.x + e.x) / 2, 2 * j.y - (a.y + e.y) / 2, e.x, e.y); g.stroke();
    };
    const leg = i => { const f = rig.feet[i]; const [j, e] = ik(hip, f.x.x, f.y.x, B.thigh, B.shin, F); hose(hip, j, e); };
    const arm = i => { const hd = rig.hands[i]; const [j, e] = ik(sh, hd.x.x, hd.y.x, B.up, B.fore, rig.bend[i].x); hose(sh, j, e); };

    leg(1); arm(1);
    // trup, při předklonu mírně shrbený
    const pf = { x: F * Math.cos(sk.a), y: -F * Math.sin(sk.a) }, bow = -rig.lean.x * .6;
    g.beginPath(); g.moveTo(hip.x, hip.y);
    g.quadraticCurveTo((hip.x + neck.x) / 2 + pf.x * bow, (hip.y + neck.y) / 2 + pf.y * bow, neck.x, neck.y);
    if (rig.boing.x > .25) {                   // krk jako pružina
      const nx = hc.x - Math.sin(ha) * B.head * .9, ny = hc.y - Math.cos(ha) * B.head * .9, n = 7;
      for (let i = 1; i <= n; i++) {
        const k = i / n, s = i === n ? 0 : (i % 2 ? .55 : -.55);
        g.lineTo(neck.x + (nx - neck.x) * k + Math.cos(ha) * s, neck.y + (ny - neck.y) * k - Math.sin(ha) * s);
      }
    } else g.lineTo(hc.x - Math.sin(ha) * B.head * .9, hc.y - Math.cos(ha) * B.head * .9);
    g.stroke();
    leg(0);
    if (!P.front) arm(0);

    // hlava
    const r = B.head;
    g.fillStyle = W; g.beginPath(); g.arc(hc.x, hc.y, r, 0, TAU); g.fill(); g.stroke();
    // čepice s kšiltem; při pohledu na diváka kšilt mizí
    g.save(); g.translate(hc.x, hc.y); g.rotate(-ha);
    g.fillStyle = TEAL; g.beginPath(); g.arc(0, 0, r + .05, .19 * Math.PI, .81 * Math.PI); g.closePath(); g.fill(); g.stroke();
    const vx0 = HF * r * .8;
    if (fig.novisor) { g.lineWidth = B.lw * .7; g.beginPath(); g.moveTo(vx0, r * .56); g.lineTo(vx0 + HF * .35, r * .5); g.stroke(); }
    else g.lineWidth = B.lw * 1.7;
    if (!fig.novisor) { g.beginPath(); g.moveTo(vx0, r * .56); g.lineTo(vx0 + HF * 1.5, r * .46); g.stroke();
    g.lineWidth = B.lw * .8; g.strokeStyle = TEAL; g.beginPath(); g.moveTo(vx0, r * .56); g.lineTo(vx0 + HF * 1.4, r * .47); g.stroke();
    }
    g.restore();
    g.lineWidth = B.lw; g.strokeStyle = K;

    // obličej
    const gz = rig.gaze.x, up = rig.up.x;
    if (t > blinkAt) { blinkEnd = t + 120; blinkAt = t + rand(1800, 4400); }
    let eyes = P.eyes;
    if (eyes === 'dot' && t < blinkEnd) eyes = 'shut';
    const ex0 = hc.x + gz * 1.05, ey = hc.y + .1 + up * .45, sep = .62 * (1 - .28 * Math.abs(gz));
    const eye = [ex0 - sep, ex0 + sep];
    g.fillStyle = K;
    for (let i = 0; i < 2; i++) {
      const x = eye[i];
      g.beginPath();
      if (eyes === 'dot') { g.arc(x, ey, .3, 0, TAU); g.fill(); }
      else if (eyes === 'wide') { g.arc(x, ey, .4, 0, TAU); g.fill(); }
      else if (eyes === 'happy') { g.arc(x, ey - .2, .36, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
      else if (eyes === 'half') { g.arc(x, ey - .12, .26, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - .36, ey + .16); g.lineTo(x + .36, ey + .16); g.stroke(); }
      else if (eyes === 'effort') { const s = i ? -1 : 1; g.moveTo(x - s * .3, ey + .28); g.lineTo(x + s * .22, ey); g.lineTo(x - s * .3, ey - .28); g.stroke(); }
      else if (eyes === 'dizzy') { g.lineWidth = B.lw * .7; g.arc(x, ey, .34, t / 90, t / 90 + 1.6 * Math.PI); g.stroke(); g.lineWidth = B.lw; }
      else { g.moveTo(x - .3, ey); g.lineTo(x + .3, ey); g.stroke(); }
    }
    if (P.brows > .1) {                        // ustarané obočí
      g.lineWidth = B.lw * .8;
      for (let i = 0; i < 2; i++) {
        const x = eye[i], s = i ? 1 : -1, by = ey + .68;
        g.beginPath(); g.moveTo(x - s * .05, by + .2 * P.brows); g.lineTo(x + s * .42, by - .05); g.stroke();
      }
      g.lineWidth = B.lw;
    }
    const mx = hc.x + gz * 1.15, my = hc.y - .95 + up * .3;
    g.beginPath();
    switch (P.mouth) {
      case 'smile': g.arc(mx, my + .35, .45, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
      case 'open': g.arc(mx, my + .12, .55, Math.PI, TAU); g.closePath(); g.fill(); break;
      case 'o': g.arc(mx, my, .26, 0, TAU); g.stroke(); break;
      case 'frown': g.arc(mx, my - .5, .45, .22 * Math.PI, .78 * Math.PI); g.stroke(); break;
      case 'grit': g.moveTo(mx - .4, my + .05); g.lineTo(mx + .4, my - .05); g.stroke(); break;
      default: g.moveTo(mx - .28, my); g.lineTo(mx + .28, my); g.stroke();
    }
    if (P.blush > .05) {
      g.fillStyle = PINK; g.globalAlpha = .75 * P.blush;
      for (const x of [ex0 - sep - .45, ex0 + sep + .45]) { g.beginPath(); g.ellipse(x, ey - .65, .42, .22, 0, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    if (P.sweat > .05) {                       // kapka potu na zátylku
      const x = hc.x - Math.sign(gz || 1) * (r + .25), y = hc.y + .9 + (t / 600 % 1) * -.6;
      g.fillStyle = BLUE; g.beginPath(); g.moveTo(x, y + .55); g.quadraticCurveTo(x + .4, y - .1, x, y - .25); g.quadraticCurveTo(x - .4, y - .1, x, y + .55); g.fill();
    }
    if (P.front) arm(0);
    if (fig.tool === 'hammer') {               // kladivo v ruce
      const hd = rig.hands[0], hx = hd.x.x, hy = hd.y.x;
      g.lineWidth = B.lw * .9; g.strokeStyle = '#8a5a2b';
      g.beginPath(); g.moveTo(hx - F * .3, hy - .4); g.lineTo(hx + F * .9, hy + 1.9); g.stroke();
      g.save(); g.translate(hx + F * .9, hy + 1.9); g.rotate(-F * .45);
      g.fillStyle = '#6b7580'; g.strokeStyle = K; g.lineWidth = B.lw * .6;
      g.beginPath(); g.rect(-.95, -.5, 1.9, 1); g.fill(); g.stroke(); g.restore();
    }
    if (fig.brolly) {                          // deštník: rukojeť v ruce, vrchlík nad hlavou
      const hd = rig.hands[0], hx = hd.x.x, hy = hd.y.x, top = hy + 4.6, sw = Math.sin(t / 260) * .35;
      g.lineWidth = B.lw * .8;
      g.beginPath(); g.moveTo(hx + .5, hy - .5); g.quadraticCurveTo(hx + .6, hy - 1.1, hx, hy - 1); g.lineTo(hx + sw * .3, top + 2.8); g.stroke();
      g.save(); g.translate(hx + sw, top); g.rotate(-sw * .15);
      g.fillStyle = '#d9483b'; g.lineWidth = B.lw * .7;
      g.beginPath(); g.moveTo(-4.4, 0);
      g.bezierCurveTo(-4.2, 3.6, 4.2, 3.6, 4.4, 0);
      for (let i = 3; i >= 0; i--) { const x0 = -4.4 + i * 2.2; g.quadraticCurveTo(x0 + 1.1, .7, x0, 0); }
      g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 2.7); g.lineTo(0, 3.4); g.stroke();
      g.restore();
    }
  }

  function render(dt) {
    renderSd();
    if (fig.vis) renderFig(dt);
    if (world.ready) renderPebbles();
    renderPliers();
    renderItems();
    if (fig.letter) renderLetter(fig.letter);
    if (fig.word) renderWord(fig.word);
  }
  function renderFig(dt) {
    drawFig(dt);
    figEl.style.transformOrigin = `${FW / 2}px ${(FW - fig.rotO * S).toFixed(1)}px`;
    figEl.style.transform = `translate3d(${Math.round(fig.cx - FW / 2)}px,${Math.round(fig.gy - FW + fig.sink)}px,0)` + (fig.rot ? ` rotate(${fig.rot.toFixed(4)}rad)` : '');
    figEl.style.clipPath = fig.sink > 0 ? `inset(0 0 ${fig.sink}px 0)` : 'none';
  }
  function renderSd() {
    const s = sd.state;
    let on = s === 'stuck' || s === 'air' || s === 'carry' || s === 'ground', clip = 'none';
    if (s === 'stuck') {                      // trčí ze skrýše rukojetí nahoru
      sd.gx = sd.x; sd.gy = sd.fy - sd.out + 4 * S; sd.ang = 90;
      clip = `inset(0 ${Math.max(0, 20 * S - sd.out)}px 0 0)`;
      if (sd.out < 1) on = false;
    }
    sdEl.style.display = on ? 'block' : 'none';
    sdEl.classList.toggle('is-ground', s === 'ground');
    sdEl.tabIndex = s === 'ground' ? 0 : -1;
    if (!on) return;
    sdEl.style.clipPath = clip;
    sdEl.style.transform = `translate3d(${sd.gx - 4 * S}px,${sd.gy - 2.5 * S}px,0) rotate(${sd.ang}deg)`;
  }

  // ---------- smyčka ----------
  function loop(now) {
    const dt = Math.min(48, now - last) * speed; last = now;
    if (tickle > 0) tickle = Math.max(0, tickle - dt * .09);
    updateFreeze(dt); updateDazzle(dt);
    if (!frozen) for (const s of [...tasks]) s(dt);
    fig.t += dt;
    if (sd.state === 'carry') followSd(dt);
    const wb = worldStep(dt) | cableStep(dt) | stepMM(dt) | stepWords(dt);
    if (fig.vis && rig.walk.x > .4) { const k = Math.floor(rig.phase * 2); if (k !== audio.step) { audio.step = k; snd('krok'); } }
    render(dt);
    if (world.dirty) { world.dirty = false; drawRopes(); }
    raf = act || tasks.size || tickle > 0 || forced || wb ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  function task(tk, fn) {
    return new Promise((res, rej) => {
      const step = dt => {
        if (tk.dead) { tasks.delete(step); rej(CANCEL); return; }
        const r = fn(dt);
        if (r !== undefined) { tasks.delete(step); res(r); }
      };
      tasks.add(step); kick();
    });
  }
  function tween(tk, ms, fn) {
    let t = 0;
    return task(tk, dt => { t += dt; const p = Math.min(1, t / ms); if (fn) fn(p); if (p >= 1) return true; });
  }
  const wait = (tk, ms) => tween(tk, ms);

  function run(name, fn) {
    if (fig.pebble && name !== 'gather') dropPebble();
    cancel(); forced = null;
    const tk = { dead: false }; act = { name, tk };
    kick();
    (async () => {
      try { await fn(tk); }
      catch (e) { if (e !== CANCEL) console.error('[panáček]', e); }
      finally { if (act && act.tk === tk) { act = null; hide(); lastEnd = performance.now(); } }
    })();
  }
  function cancel() {
    if (!act) return;
    act.tk.dead = true;
    for (const s of [...tasks]) s(0);
  }
  function show() { figEl.style.pointerEvents = ''; fig.vis = true; rig.snap = true; figEl.style.display = 'block'; kick(); }
  function hide() {
    if (fig.pebble) dropPebble(); pl.vis = false; dropVis(); fig.vis = false;
    if (fig.letter) { const L = fig.letter; fig.letter = null; if (L.st === 'fig') letterFall(L, L.x, L.y, L.a); }
    if (fig.word) { const W = fig.word; fig.word = null; if (W.st === 'fig') { Object.assign(W, { st: 'air', vx: 0, vy: 0, va: 0, wait: 0 }); kick(); } } frozen = false; fig.hold = false; figEl.style.display = 'none';
    Object.assign(fig, { rot: 0, rotO: 0, air: false, brolly: false }); grab.on = false; root.classList.remove('pnk-grabbing');
  }
  function setFlags(ticklish, freezable) { fig.ticklish = ticklish; fig.freezable = freezable; }

  // U kurzoru ztuhne. Po chvíli to nevydrží a kousek popojde, pak ztuhne znovu.
  function updateFreeze(dt) {
    thaw = Math.max(0, thaw - dt);
    const d = ptr.on ? Math.hypot(ptr.x - (fig.cx - scrollX), ptr.y - (fig.gy - scrollY - 8 * S)) : 1e9;
    if (!fig.vis || !fig.freezable || fig.pose === 'laugh' || d > 30 * S) { frozen = false; return; }
    if (!frozen && thaw === 0 && d < 24 * S) { frozen = true; frozenFor = 0; }
    if (frozen) { frozenFor += dt; if (frozenFor > 2600 && tickle < 30) { frozen = false; thaw = 1600; } }
  }

  // ---------- pohyby ----------
  function go(tk, x, o = {}) {
    const sp = o.speed || 52 * S;
    fig.pose = o.pose || 'run';
    if (Math.abs(x - fig.cx) > .5) fig.dir = x > fig.cx ? 1 : -1;
    return task(tk, dt => {
      if (o.until && o.until()) return 'stop';
      const d = sp * dt / 1000, r = x - fig.cx;
      if (Math.abs(r) <= d) { fig.cx = x; return 'ok'; }
      fig.cx += Math.sign(r) * d;
    }).then(r => { fig.pose = 'stand'; return r; });
  }
  async function climb(tk, f, cx, dir) {
    Object.assign(fig, { floor: f, cx, gy: f.y, dir, sink: FW, pose: 'peek', lean: 0 });
    setFlags(false, false); show();
    await tween(tk, 520, p => { fig.sink = FW * (1 - ease.back(p)); });
    fig.sink = 0; fig.pose = 'stand'; setFlags(true, true);
    await wait(tk, 180);
  }
  async function duck(tk, ms = 260) {
    setFlags(false, false); fig.pose = 'peek';
    const s0 = Math.max(0, fig.sink);
    await tween(tk, ms, p => { fig.sink = s0 + (FW - s0) * ease.in(p); });
    hide();
  }
  async function hop(tk, x2, f) {
    const x1 = fig.cx, y1 = fig.gy, dy = f.y - y1, h = 7 * S;
    setFlags(false, false);
    if (Math.abs(x2 - x1) > .5) fig.dir = x2 > x1 ? 1 : -1;
    fig.pose = 'land'; await wait(tk, 120);     // nádech před skokem
    fig.pose = 'jump';
    await tween(tk, 320 + 16 * Math.sqrt(Math.abs(dy)) + .4 * Math.abs(x2 - x1), p => {
      fig.cx = x1 + (x2 - x1) * p; fig.gy = y1 + (dy + 4 * h) * p * p - 4 * h * p;
    });
    fig.cx = x2; fig.gy = f.y; fig.floor = f; fig.pose = 'land';
    await wait(tk, 200);
    fig.pose = 'stand'; setFlags(true, true);
  }
  // Rozhlíží se: hlava rychle, tělo s ním.
  async function lookAround(tk, n, ms, pose = 'stand') {
    fig.pose = pose;
    for (let i = 0; i < n; i++) { fig.dir = -fig.dir; await wait(tk, ms * rand(.8, 1.2)); }
    fig.pose = 'stand';
  }
  // Po čarách dolů až na cílovou čáru.
  async function travel(tk, to, destX) {
    for (let i = 0; i < 12 && fig.floor.el !== to.el; i++) {
      const all = floors(), cur = all.find(f => f.el === fig.floor.el) || fig.floor;
      const goal = all.find(f => f.el === to.el) || to;
      let cand = all.filter(f => f.y >= cur.y + 60 && f.y <= goal.y);
      if (!cand.length) cand = [goal];
      const row = cand.filter(f => f.y - cand[0].y < 8);
      const want = fig.cx + clamp(destX - fig.cx, -60 * S, 60 * S);
      const nf = row.reduce((a, b) => (gapTo(b, want) < gapTo(a, want) ? b : a));
      const land = clamp(want, nf.x1 + HW, nf.x2 - HW);
      await go(tk, clamp(land, cur.x1 + HW, cur.x2 - HW));
      await hop(tk, land, nf);
      await wait(tk, 160);
    }
  }
  // Zadumaně čeká, až bude celý vidět v okně.
  function waitSeen(tk, ms) {
    let t = 0, seen = 0, hm = 2200;
    fig.pose = 'think';
    return task(tk, dt => {
      t += dt;
      const top = fig.gy - 16 * S - scrollY, bot = fig.gy - scrollY, x = fig.cx - scrollX;
      seen = top > 0 && bot < innerHeight && x > 0 && x < innerWidth && !doc.hidden ? seen + dt : 0;
      if (seen > 900) { fig.pose = 'stand'; return true; }
      if (t > ms) { fig.pose = 'stand'; return false; }
      if (t > hm) { hm = t + rand(3500, 5500); puff('hm…', true); }
    });
  }
  function puff(text, slow) { puffAt(fig.cx + fig.dir * 2 * S, fig.gy - 18 * S + Math.max(0, fig.sink) - 8, text, slow); }
  function puffAt(x, y, text, slow) {
    const p = el('span', 'pnk-puff' + (slow ? ' is-slow' : '')); p.textContent = text;
    p.style.setProperty('--x', Math.round(x + rand(-6, 6)) + 'px');
    p.style.setProperty('--y', Math.round(y) + 'px');
    p.style.setProperty('--dx', Math.round(rand(-12, 12)) + 'px');
    snd(TXT[text]);
    layer.appendChild(p);
    setTimeout(() => p.remove(), slow ? 1800 : 1200);
  }

  // ---------- šroubovák: pohyb ----------
  // Vleče ho za sebou hrotem po zemi; při otočce ho přehodí vrchem.
  function aim(dir) {
    const base = dir > 0 ? 168 : 12;
    let d = (((base - sd.ang) % 360) + 540) % 360 - 180;
    if (d > 90) d -= 360; else if (d < -90) d += 360;
    sd.ta = sd.ang + d; sd.cdir = dir;
  }
  function carry() { sd.state = 'carry'; fig.hold = true; aim(fig.dir); }
  function followSd(dt) {
    if (fig.dir !== sd.cdir) aim(fig.dir);
    const k = Math.min(1, dt / 90);
    sd.gx += (fig.cx - fig.dir * 5.4 * S - sd.gx) * k;
    sd.gy += (fig.gy - 4.5 * S - sd.gy) * k;
    sd.ang += (sd.ta + Math.sin(fig.t / 130) * 1.5 - sd.ang) * k;
  }
  // Tahá šroubovák ze skrýše. pd je směr, kterým při tom stojí čelem.
  async function pull(tk, f, ax, pd) {
    Object.assign(sd, { state: 'stuck', x: ax, fy: f.y, out: 0, el: f.el });
    fig.dir = pd; fig.pose = 'pull'; fig.lean = 0;
    // nejdřív pootevře skrýš a chytne
    await tween(tk, 300, p => { sd.out = 4 * S * ease.out(p); });
    fig.hold = true;
    await wait(tk, 250);
    for (const o of [7, 11.5, 16]) {
      await wait(tk, 260);
      const o0 = sd.out, o1 = o * S;
      await tween(tk, 420, p => { sd.out = o0 + (o1 - o0) * ease.out(p); fig.lean = -Math.sin(p * Math.PI); });
      fig.lean = 0;
    }
    await wait(tk, 260);
    // lup: šroubovák vyletí a panáček si sedne na zadek
    fig.hold = false; sd.state = 'air'; puff('lup!');
    const sx = sd.x, sy = sd.fy - sd.out + 4 * S, ex = sd.x - pd * 2 * S, ey = f.y - 2.5 * S, ea = pd > 0 ? 0 : 180;
    const fx = fig.cx, fy = fig.gy;
    setFlags(false, false); fig.pose = 'jump';
    await Promise.all([
      tween(tk, 480, p => { sd.gx = sx + (ex - sx) * p; sd.gy = sy + (ey - sy) * p - Math.sin(p * Math.PI) * 12 * S; sd.ang = 90 + (ea - 90) * ease.io(p); }),
      tween(tk, 340, p => { fig.cx = fx - pd * 5 * S * p; fig.gy = fy - Math.sin(p * Math.PI) * 3 * S; }),
    ]);
    fig.gy = fy; fig.pose = 'sit'; setFlags(true, true);
    await wait(tk, 1100);
    if (NIGHT && !st.napped && !(await nap(tk, f))) return false;
    fig.pose = 'stand';
    await wait(tk, 300);
    // dojde k rukojeti, otočí se a chytí ji za zády
    await go(tk, sd.gx - pd * 6 * S, { speed: 15 * S, pose: 'sneak' });
    fig.dir = -pd; carry();
    await wait(tk, 260);
  }
  // Vleče šroubovák s oddechy.
  async function drag(tk, x) {
    const dir = x > fig.cx ? 1 : -1;
    while (Math.abs(x - fig.cx) > 1) {
      const leg = Math.min(Math.abs(x - fig.cx), rand(30, 42) * S);
      await go(tk, fig.cx + dir * leg, { speed: 14 * S, pose: 'drag' });
      if (Math.abs(x - fig.cx) > 1) { fig.pose = 'rest'; puff('uf'); await wait(tk, 620); }
    }
  }
  // Postaví šroubovák na hrot a zatlačí ho za čáru. pd je směr k šroubováku.
  async function stash(tk, f, pd) {
    fig.pose = 'stand';
    await wait(tk, 220);
    fig.dir = pd; sd.state = 'air'; fig.pose = 'pull'; fig.lean = 0;
    const a0 = sd.ang, a1 = a0 + ((((90 - a0) % 360) + 540) % 360 - 180);
    const t0x = sd.gx + 16 * S * Math.cos(rad(a0)), t1x = fig.cx + pd * R, ty = f.y - 1.5 * S;
    await tween(tk, 520, p => {
      const e = ease.io(p), a = a0 + (a1 - a0) * e, tx = t0x + (t1x - t0x) * e;
      sd.ang = a; sd.gx = tx - 16 * S * Math.cos(rad(a)); sd.gy = ty - 16 * S * Math.sin(rad(a));
    });
    Object.assign(sd, { state: 'stuck', x: t1x, fy: f.y, out: 20 * S, el: f.el });
    for (const o of [13, 7, 0]) {
      await wait(tk, 200);
      const o0 = sd.out, o1 = o * S;
      await tween(tk, 320, p => { sd.out = o0 + (o1 - o0) * ease.in(p); fig.lean = Math.sin(p * Math.PI); });
      fig.lean = 0;
    }
    fig.hold = false; sd.state = 'stash'; fig.pose = 'stand';
    await wait(tk, 200);
  }
  // Šroubovák mu vypadne a zůstane ležet na čáře.
  function dropSd() {
    const f = floorOf(sd.el) || fig.floor, from = sd.state;
    fig.hold = false;
    let x1 = sd.gx, a1;
    if (from === 'stuck') { sd.gx = sd.x; sd.gy = sd.fy - sd.out + 4 * S; sd.ang = 90; a1 = fig.dir > 0 ? 0 : 180; x1 = sd.x - fig.dir * 2 * S; }
    else a1 = Math.round(sd.ang / 180) * 180;
    x1 = clamp(x1, f.x1 + 20 * S, f.x2 - 20 * S);
    sd.state = 'air';
    const x0 = sd.gx, y0 = sd.gy, y1 = f.y - 2.5 * S, a0 = sd.ang, h = (from === 'stuck' ? 9 : 3) * S;
    tween(FREE, 380, p => { sd.gx = x0 + (x1 - x0) * p; sd.gy = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * h; sd.ang = a0 + (a1 - a0) * p; })
      .then(() => {
        Object.assign(sd, { state: 'ground', ang: ((a1 % 360) + 360) % 360, el: f.el, frac: (sd.gx - f.x1) / (f.x2 - f.x1) });
        showBelt(); renderSd();
      });
  }

  // ---------- opasek ----------
  function setCount(n) { count.textContent = n + '/5'; belt.setAttribute('aria-label', `Opasek s nářadím, ${n} z 5`); }
  function showBelt() {
    belt.classList.add('is-on');
    slots[0].classList.toggle('is-next', sd.state !== 'belt');
    slots[1].classList.toggle('is-next', pl.state === 'ground' || pl.state === 'fly');
  }
  function fillSlot() {
    const b = slots[0], c = canvas(40 * DPR, 10 * DPR);
    drawSd(c);
    b.replaceChildren(c); b.disabled = false; b.classList.remove('is-next'); b.classList.add('is-full');
    b.setAttribute('aria-label', 'Šroubovák'); b.setAttribute('aria-pressed', String(tool.on));
    setCount(toolCount()); showBelt();
  }
  // Kliknutí na ležící šroubovák: přeletí do opasku.
  function collect() {
    if (sd.state !== 'ground') return;
    const r = sdEl.getBoundingClientRect(), a0 = sd.ang;
    sd.state = 'fly'; renderSd(); showBelt();
    const done = () => {
      sd.state = 'belt'; st.stage = 3; st.searched = false; lastEnd = performance.now();
      fillSlot(); save(); hint();
      belt.classList.remove('is-bump'); void belt.offsetWidth; belt.classList.add('is-bump');
    };
    const c = canvas(Math.round(20 * S * DPR), Math.round(5 * S * DPR)); c.className = 'pnk-fly';
    drawSd(c);
    c.style.width = 20 * S + 'px'; c.style.height = 5 * S + 'px';
    doc.body.appendChild(c);
    const s = slots[0].getBoundingClientRect();
    const x0 = r.left + r.width / 2 - 10 * S, y0 = r.top + r.height / 2 - 2.5 * S;
    const x1 = s.left + s.width / 2 - 10 * S, y1 = s.top + s.height / 2 - 2.5 * S;
    if (!c.animate) { c.remove(); done(); return; }
    c.animate([
      { transform: `translate(${x0}px,${y0}px) rotate(${a0}deg) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 90}px) rotate(${(a0 - 270) / 2}deg) scale(1.15)`, offset: .5 },
      { transform: `translate(${x1}px,${y1}px) rotate(-270deg) scale(${2 / S})` },
    ], { duration: 650, easing: 'ease-in-out' }).onfinish = () => { c.remove(); done(); };
  }

  // ---------- výstupy ----------
  // 1. Vykoukne zpoza čáry, poplašeně se rozhlédne a schová se.
  async function peek(tk) {
    const f = visibleFloor();
    if (!f) return;
    st.stage = Math.max(st.stage, 1);
    const cx = spotOn(f);
    Object.assign(fig, { floor: f, cx, gy: f.y, dir: ptr.on && ptr.x + scrollX > cx ? -1 : 1, sink: FW, pose: 'peek', lean: 0 });
    setFlags(true, true); show();
    await tween(tk, 650, p => { fig.sink = FW + (8.5 * S - FW) * ease.out(p); });
    await wait(tk, 600); fig.dir = -fig.dir;
    await wait(tk, 700); fig.dir = -fig.dir;
    await wait(tk, 450);
    await tween(tk, 160, p => { fig.sink = 8.5 * S + 1.5 * S * Math.sin(p * Math.PI); });   // přikrčí se
    await wait(tk, 300);
    await duck(tk, 180);
  }
  // 2. Přiběhne, rozhlédne se, uteče ke skrýši a přestěhuje šroubovák.
  async function heist(tk) {
    const from = visibleFloor(), home = floors().find(f => f.stash);
    if (!from || !home) return;
    const x0 = spotOn(from), dir = x0 - scrollX < innerWidth / 2 ? 1 : -1;
    await climb(tk, from, x0, dir);
    await go(tk, clamp(x0 + dir * rand(30, 60) * S, Math.max(from.x1, scrollX) + HW, Math.min(from.x2, scrollX + innerWidth) - HW));
    await lookAround(tk, 3, 420, 'alarm');
    fig.pose = 'stand'; await wait(tk, 250);
    const ax = spotX(home, sd.spot), bx = spotX(home, 1 - sd.spot);
    const pd = ax < bx ? -1 : 1;                 // při tahání stojí zády k nové skrýši
    await travel(tk, home, ax - pd * R);
    await go(tk, ax - pd * R, { speed: 15 * S, pose: 'sneak' });
    fig.dir = pd;
    if (!(await waitSeen(tk, T.waitSeen))) {     // nikdo se nedívá: tajemství si nechá
      st.rounds++;
      await lookAround(tk, 2, 420);
      await duck(tk);
      return;
    }
    await lookAround(tk, 2, 360, 'alarm');
    fig.dir = pd;
    if ((await pull(tk, home, ax, pd)) === false) return;
    await drag(tk, bx - pd * R);
    await stash(tk, home, pd);
    sd.spot = 1 - sd.spot; st.stage = 2; st.rounds++;
    await lookAround(tk, 2, 400, 'alarm');
    await duck(tk);
  }
  // 3. Vrátí se pro upuštěný šroubovák, pokud ho mezitím nikdo nesebral.
  async function retrieve(tk) {
    const f = floorOf(sd.el);
    if (!f) { sd.state = 'stash'; return; }
    const dd = sd.ang === 0 ? -1 : 1;            // vléct ho jde jen za rukojeť
    const stand = sd.gx + dd * 6 * S;
    let x0 = clamp(stand + dd * rand(28, 40) * S, f.x1 + HW, f.x2 - HW);
    if (Math.abs(x0 - stand) < 12 * S) x0 = clamp(stand - dd * 34 * S, f.x1 + HW, f.x2 - HW);
    if (f.y - scrollY < 17 * S || f.y - scrollY > innerHeight) { sd.state = 'stash'; renderSd(); return; }   // nikdo se nedívá
    await climb(tk, f, x0, x0 < stand ? 1 : -1);
    await lookAround(tk, 2, 400, 'alarm');
    await go(tk, stand, { speed: 15 * S, pose: 'sneak', until: () => sd.state !== 'ground' });
    if (sd.state !== 'ground') return puzzled(tk);
    fig.dir = dd; carry();
    await wait(tk, 280);
    const xs = [spotX(f, 0), spotX(f, 1)];
    const i = Math.abs(xs[0] - fig.cx) > Math.abs(xs[1] - fig.cx) ? 0 : 1;   // do vzdálenější skrýše
    const pd = xs[i] > fig.cx ? -1 : 1;
    await drag(tk, xs[i] - pd * R);
    await stash(tk, f, pd);
    sd.spot = i; st.stage = Math.max(st.stage, 2);
    await lookAround(tk, 2, 400, 'alarm');
    await duck(tk);
  }
  // Šroubovák nikde: drbe se na hlavě, smutně kouká a odchází.
  async function puzzled(tk) {
    fig.pose = 'scratch'; puff('?');
    await wait(tk, 1400);
    await lookAround(tk, 2, 500, 'alarm');
    fig.pose = 'sad'; puff('…', true);
    await wait(tk, 1300);
    const f = fig.floor;
    await go(tk, clamp(fig.cx - fig.dir * 16 * S, f.x1 + HW, f.x2 - HW), { speed: 11 * S, pose: 'sadwalk' });
    await duck(tk);
  }
  // 4. Po sebrání šroubováku ho občas přijde hledat.
  async function search(tk) {
    st.searched = true;
    const f = visibleFloor();
    if (!f) return;
    const x0 = spotOn(f), dir = x0 - scrollX < innerWidth / 2 ? 1 : -1;
    await climb(tk, f, x0, dir);
    await go(tk, clamp(x0 + dir * rand(20, 40) * S, Math.max(f.x1, scrollX) + HW, Math.min(f.x2, scrollX + innerWidth) - HW));
    await puzzled(tk);
  }
  // Pošimraný: směje se, pustí šroubovák, uteče a schová se.
  function tickled() {
    if (fig.pose === 'laugh') return;
    const drop = dropper();
    tickle = 0; frozen = false;
    run('laugh', async tk => {
      setFlags(false, false); fig.pose = 'laugh'; fig.lean = 0;
      drop();
      for (const s of ['chi', 'chichi!', 'chi']) { puff(s); await wait(tk, 340); }
      const f = fig.floor;
      if (fig.sink <= 0 && f) {
        let away = ptr.on ? (fig.cx - scrollX >= ptr.x ? 1 : -1) : -fig.dir;
        if (away > 0 ? f.x2 - HW - fig.cx < 10 * S : fig.cx - f.x1 - HW < 10 * S) away = -away;
        await go(tk, clamp(fig.cx + away * rand(26, 40) * S, f.x1 + HW, f.x2 - HW), { speed: 80 * S, pose: 'flee' });
      }
      await duck(tk, 220);
    });
  }
  // ---------- panáček v ruce ----------
  // Za čepici jde chytit a přenést. Visí jako kyvadlo: těžiště je bod na tyči od úchopu, takže se při
  // tažení sám rozhoupe. Puštěný padá, hozený letí, točí se, odráží se od stěn a čar a cestou
  // vyráží spoje z mapy. Kdo ho hází pořád, dočká se deštníku.
  const grab = { on: false, id: null, b: null, w: 0, vx: 0, pv: [0, 0], pt: 0, px: 0, py: 0, shake: 0, sgn: 0 };
  const GRIP = 15.3, COM = 8;           // úchop a těžiště nad zemí, v jednotkách S
  function headAt(x, y, touch) {
    if (!fig.vis || !rig.sk || fig.air || figEl.style.pointerEvents === 'none') return false;
    const hc = rig.sk.hc, hx = fig.cx + hc.x * S - scrollX, hy = fig.gy + fig.sink - hc.y * S - scrollY;
    if (hy > fig.gy - scrollY - B.head * S * .3) return false;     // hlava je ještě za čarou
    return Math.hypot(x - hx, y - hy) < (B.head + 1) * S * (touch ? 1.7 : 1);
  }
  // Co nese, to upustí. Vrací funkci, která to udělá (stav se musí zjistit před zrušením výstupu).
  function dropper() {
    const drop = sd.state === 'carry' || sd.state === 'stuck' || sd.state === 'air';
    const dropPl = pl.state === 'fig' && pl.vis, dropIt = carried(), f = fig.floor, dropL = fig.letter, dropW = fig.word;
    return () => {
      if (dropL && dropL.st === 'fig') { fig.letter = null; letterFall(dropL, dropL.x, dropL.y, dropL.a); }
      if (dropW && dropW.st === 'fig') { fig.word = null; Object.assign(dropW, { st: 'air', vx: rand(-80, 80), vy: -120, va: rand(-300, 300), wait: 0 }); kick(); }
      if (fig.pebble) dropPebble();
      if (drop) dropSd(); else fig.hold = false;
      if (dropPl && f) landPliers(f, pl.x, pl.y, pl.a, 420);
      if (dropIt && f) landItem(dropIt, f, dropIt.x, dropIt.y);
      fig.tool = null;
    };
  }
  function grabStart(e) {
    if (grab.on || tool.pry || drilling || e.button > 0 || !headAt(e.clientX, e.clientY, e.pointerType !== 'mouse')) return false;
    const drop = dropper();
    Object.assign(grab, { on: true, id: e.pointerId, flips: 0, shake: 0, sgn: 0, w: 0, vx: 0, pv: [0, 0], pt: e.timeStamp, px: e.clientX, py: e.clientY });
    try { figEl.setPointerCapture(e.pointerId); } catch (er) { /* nevadí */ }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    run('grab', tk => held(tk, drop));
    return true;
  }
  function grabEnd(e) { if (grab.on && e.pointerId === grab.id) grab.on = false; }
  // Rychlost ruky se měří z událostí ukazatele, ne ze snímků (ty chodí jinak často).
  function grabMove(e) {
    if (!grab.on || e.pointerId !== grab.id) return;
    const dt = e.timeStamp - grab.pt;
    if (dt < 4) return;
    const k = Math.min(1, dt / 40), vx = (e.clientX - grab.px) / dt * 1000, vy = (e.clientY - grab.py) / dt * 1000;
    grab.pv = [grab.pv[0] * (1 - k) + vx * k, grab.pv[1] * (1 - k) + vy * k];
    grab.pt = e.timeStamp; grab.px = e.clientX; grab.py = e.clientY;
  }

  async function held(tk, drop) {
    setFlags(false, false); frozen = false; tickle = 0; drop();
    const pop = fig.sink > 2 * S;                // vytažený zpoza čáry
    Object.assign(fig, { sink: 0, rot: 0, rotO: GRIP, air: true, pose: 'dangle', lean: 0 });
    rig.snap = true;
    root.classList.add('pnk-grabbing');
    puff(pop ? 'lup!' : ['hej!', 'ááá', 'pusť!', '!'][Math.floor(rand(0, 4))]);
    const at = () => ({ x: ptr.x + scrollX, y: ptr.y + scrollY });
    const h0 = at();
    grab.b = { x: h0.x, y: h0.y + (GRIP - COM) * S, px: h0.x, py: h0.y + (GRIP - COM) * S };
    let lx = h0.x, yell = 1500;
    await task(tk, dt => {
      const p = at(), b = grab.b, h = Math.max(1, dt) / 1000, L = (GRIP - COM) * S;
      const vx = (b.x - b.px) * .985, vy = (b.y - b.py) * .985;
      b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + GR * h * h;
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
      b.x = p.x + dx / d * L; b.y = p.y + dy / d * L;
      const r = Math.atan2(-(b.x - p.x), b.y - p.y);
      grab.w = grab.w * .6 + (r - fig.rot) / h * .4;
      fig.rot = r; fig.cx = p.x; fig.gy = p.y + GRIP * S;
      // třesení: rychlé změny směru
      const pv = (p.x - lx) / h; lx = p.x;
      grab.vx = clamp(grab.vx * .8 + pv / 900 * .2, -1.5, 1.5);
      const sg = Math.abs(pv) > 700 ? Math.sign(pv) : 0;
      if (sg && sg !== grab.sgn) { if (grab.sgn) { grab.shake++; if (++grab.flips % 5 === 0) shook(); } grab.sgn = sg; }
      grab.shake = Math.max(0, grab.shake - dt / 900);
      if ((yell -= dt) < 0) { yell = rand(1800, 3200); puff(grab.shake > 5 ? 'bléé' : ['pusť!', 'hej!', 'mami'][Math.floor(rand(0, 3))]); }
      if (!grab.on) return true;
    });
    root.classList.remove('pnk-grabbing');
    // rychlost při puštění
    let [vx, vy] = performance.now() - grab.pt < 90 ? grab.pv : [0, 0];
    const v = Math.hypot(vx, vy);
    if (v > 3200) { vx *= 3200 / v; vy *= 3200 / v; }
    const thrown = v > 650;
    if (thrown) st.thrown++;
    await fly(tk, vx, vy, clamp(grab.w, -14, 14) + (thrown ? Math.sign(vx || 1) * rand(4, 9) : 0));
  }
  // Třesení: obrací kapsy.
  function shook() { snd('uf'); if (typeof shakeOut === 'function') shakeOut(); }

  // Volný let. Otočení se přepne z úchopu na těžiště, aby postava v tu chvíli neposkočila.
  async function fly(tk, vx, vy, w, self) {
    const k = (fig.rotO - COM) * S, t = fig.rot;
    fig.cx += -k * Math.sin(t); fig.gy += -k + k * Math.cos(t); fig.rotO = COM;
    fig.air = true; fig.pose = 'fly';
    const fl = floors(), pw = root.scrollWidth, ph = root.scrollHeight;
    const brolly = st.thrown >= 3;
    let bounces = 0;
    const res = await task(tk, dt => {
      const h = Math.min(dt, 40) / 1000, y0 = fig.gy;
      vy += GR * h;
      if (fig.brolly) { vy = Math.min(vy, 95); vx *= .96; fig.rot *= .9; w = 0; }
      else if (brolly && vy > 200) { fig.brolly = true; fig.pose = 'brolly'; puff('ha!'); snd('lup'); }
      fig.cx += vx * h; fig.gy += vy * h; fig.rot += w * h;
      if (fig.cx < HW || fig.cx > pw - HW) {   // stěna
        fig.cx = clamp(fig.cx, HW, pw - HW); vx = -vx * .45; w = -w * .6; snd('tuk');
      }
      if (fig.gy < 17 * S) { fig.gy = 17 * S; vy = Math.abs(vy) * .3; }
      if (world.ready && !world.gone && !world.fall) {      // cestou vyráží spoje z mapy
        const mx = fig.cx, my = fig.gy - COM * S;
        for (const p of world.pins) if (p.on && Math.hypot(p.px - mx, p.py - my) < 7 * S) {
          popPin(p, Math.sign(vx) || 1, -.5); vx *= .7; puffAt(p.px, p.py - 30, 'bum');
        }
      }
      if (vy > 0) for (const f of fl) {
        if (fig.cx < f.x1 || fig.cx > f.x2 || y0 > f.y + .5 || fig.gy < f.y) continue;
        fig.gy = f.y; fig.floor = f;
        if (vy > 650 && bounces < 2 && !fig.brolly) {
          bounces++; vy = -vy * .33; vx *= .55; w *= .5; snd('bum'); puffAt(fig.cx, f.y - 6, 'bum');
          return;
        }
        return { f, hard: !fig.brolly && (vy > 450 || bounces > 0 || Math.abs(Math.atan2(Math.sin(fig.rot), Math.cos(fig.rot))) > 1.3) };
      }
      if (fig.gy > ph) {                        // propadl stránkou: dopadne na poslední čáru
        const f = fl[fl.length - 1];
        fig.cx = clamp(fig.cx, f.x1 + HW, f.x2 - HW); fig.gy = f.y; fig.floor = f;
        return { f, hard: true };
      }
    });
    // dopad: postaví se, z otočení se stane pád na zadek
    const r0 = Math.atan2(Math.sin(fig.rot), Math.cos(fig.rot));
    fig.pose = res.hard ? 'sit' : 'land';
    await tween(tk, 160, p => { fig.rot = r0 * (1 - p); });
    Object.assign(fig, { rot: 0, rotO: 0, air: false });
    const f = res.f;
    if (fig.brolly) {
      fig.pose = 'proud'; puff('ha!');
      await wait(tk, 900);
      fig.brolly = false;
    } else if (res.hard) {
      snd('bum'); puff(st.thrown > 1 ? 'au au' : 'au');
      await wait(tk, 1500);
    } else await wait(tk, 260);
    fig.pose = 'stand'; setFlags(true, true);
    const seen = visibleY(f.y);
    if (self && seen) {                       // spadl sám, nemá se na koho zlobit
      fig.pose = 'scratch'; puff('příště líp', true);
      await wait(tk, 1400);
    } else if (seen) {
      fig.dir = ptr.on && ptr.x + scrollX < fig.cx ? -1 : 1;
      fig.pose = 'angry';
      puff(['hmpf', 'no dovol!', 'tak to ne', 'grr'][Math.min(3, st.thrown)], true);
      await wait(tk, 1300);
      fig.pose = 'stand';
      const away = -fig.dir;
      await go(tk, clamp(fig.cx + away * rand(20, 34) * S, f.x1 + HW, f.x2 - HW), { speed: 34 * S, pose: 'run' });
    }
    await duck(tk);
  }

  // ---------- nástroje na panáčka ----------
  // Baterka oslní (zakryje si oči a jde dál poslepu), páječka spálí, kleště štípnou nebo ustřihnou
  // kšilt, vrtačka ho roztočí jako káču a šroubovák mu povolí krk, takže hlava vyskočí na pružině.
  let dazzled = false;
  function headPos() {
    const hc = rig.sk ? rig.sk.hc : { x: 0, y: 13.5 };
    return { x: fig.cx + hc.x * S - scrollX, y: fig.gy + fig.sink - hc.y * S - scrollY };
  }
  function updateDazzle(dt) {
    let on = false;
    if (tool.cur === 'torch' && fig.vis && !fig.air && ptr.on && fig.sink < 8 * S) {
      const h = headPos(), dx = h.x - ptr.x, dy = h.y - ptr.y;
      on = Math.hypot(dx, dy) < 24 * S;          // svítí mu do obličeje
    }
    fig.dazzle = on ? Math.min(1.6, (fig.dazzle || 0) + dt / 260) : Math.max(0, (fig.dazzle || 0) - dt / 700);
    if (fig.dazzle > .5 && !dazzled && fig.pose !== 'sleep') { dazzled = true; puff(['au, světlo!', 'nesviť!', 'oči!'][Math.floor(rand(0, 3))]); }
    else if (fig.dazzle < .2) dazzled = false;
  }
  function toolOnFig(e) {
    const c = curTool();
    if (!c || c === 'torch' || !fig.vis || fig.air || fig.sink > 4 * S || e.button > 0 || !overFig(e.clientX, e.clientY)) return false;
    const head = headAt(e.clientX, e.clientY, e.pointerType !== 'mouse');
    const kind = c === 'pl' ? (head && !fig.novisor ? 'visor' : 'pinch') : c === 'iron' ? (head && fig.novisor ? 'weld' : 'burn')
      : c === 'drill' ? 'spin' : 'boing';
    const drop = dropper();
    run('ouch', tk => ouch(tk, kind, drop));
    return true;
  }
  async function ouch(tk, kind, drop) {
    setFlags(false, false); frozen = false; tickle = 0; drop();
    const f = fig.floor, y0 = fig.gy;
    const hop = (h, ms) => tween(tk, ms, p => { fig.gy = y0 - Math.sin(p * Math.PI) * h * S; });
    const flee = async (sp = 70) => {
      const away = ptr.on && ptr.x + scrollX > fig.cx ? -1 : 1;
      if (f) await go(tk, clamp(fig.cx + away * rand(26, 40) * S, f.x1 + HW, f.x2 - HW), { speed: sp * S, pose: 'flee' });
    };
    if (kind === 'burn') {
      puff('áu!'); snd('pss'); fig.pose = 'jump';
      await hop(11, 420);
      fig.gy = y0; fig.pose = 'blow'; puff('fff', true);
      await wait(tk, 1100);
      fig.pose = 'angry'; puff('to pálí!');
      await wait(tk, 900);
      await flee(80);
    } else if (kind === 'pinch') {
      puff('au'); fig.pose = 'alarm';
      await hop(4, 260);
      fig.gy = y0; fig.pose = 'rub';
      await wait(tk, 1000);
      fig.dir = ptr.on && ptr.x + scrollX < fig.cx ? -1 : 1;
      fig.pose = 'angry'; puff('hmpf');
      await wait(tk, 900);
      await flee(40);
    } else if (kind === 'visor') {
      fig.novisor = true; save(); snd('cvak'); puff('cvak');
      dropVisor();
      fig.pose = 'feel';
      await wait(tk, 1200);
      fig.pose = 'sad'; puff('můj kšilt…', true);
      await wait(tk, 1400);
      if (f) await go(tk, clamp(fig.cx - fig.dir * 14 * S, f.x1 + HW, f.x2 - HW), { speed: 11 * S, pose: 'sadwalk' });
    } else if (kind === 'weld') {
      fig.novisor = false; save(); snd('pss'); puff('pšš');
      fig.pose = 'feel';
      await wait(tk, 700);
      fig.pose = 'proud'; puff('jo!');
      await wait(tk, 1100);
    } else if (kind === 'spin') {
      puff('NE!'); drillSnd(true);
      Object.assign(fig, { air: true, rotO: COM, pose: 'fly' });
      const turns = 4 * TAU * (Math.random() < .5 ? 1 : -1);
      await tween(tk, 1300, p => { fig.rot = turns * ease.out(p); fig.gy = y0 - Math.sin(p * Math.PI) * 4 * S; });
      drillSnd(false);
      Object.assign(fig, { rot: 0, rotO: 0, air: false, gy: y0, pose: 'sit' });
      puff('@#!'); snd('bum');
      await wait(tk, 1700);
      fig.pose = 'stand';
      await wait(tk, 250);
      await flee(30);
    } else {
      snd('boing'); puff('boing!');
      rig.boing.v = 44;
      fig.pose = 'stiff';
      await wait(tk, 1400);
      fig.pose = 'feel'; puff('?');
      await wait(tk, 1000);
      fig.pose = 'scratch';
      await wait(tk, 900);
    }
    await duck(tk);
  }
  // Ustřižený kšilt spadne na čáru a zůstane tam ležet.
  function dropVisor() {
    const h = headPos(), f = fig.floor, e = el('div', 'pnk-visor');
    layer.appendChild(e);
    const x0 = h.x + scrollX + fig.dir * B.head * S, y0 = h.y + scrollY - B.head * .5 * S, y1 = (f ? f.y : y0 + 60) - 3;
    tween(FREE, 520, p => { e.style.transform = `translate3d(${(x0 + fig.dir * 18 * p).toFixed(1)}px,${(y0 + (y1 - y0) * p * p - Math.sin(p * Math.PI) * 14).toFixed(1)}px,0) rotate(${(p * 380 * fig.dir).toFixed(0)}deg)`; });
  }

  const ACTS = { wave, peek, heist, retrieve, search, gather, longing, pliers: fetchPliers, repair, lamp, spell, tower };

  // ---------- mapa: kryt, který jde rozebrat ----------
  // Souřadnice jsou v jednotkách mapy (viewBox 920 × 920). Spoje jsou čtverečky v mapě,
  // čáry jsou kabely, které v nich drží. Vypáčený spoj kabel uvolní a z čáry je lano.
  // Když zbude jediný spoj, mapa se na něm zhoupne; když povolí i ten, spadne.
  const PINS = {
    i1: [249, 185], i2: [249, 365], i3: [249, 545], i4: [249, 725],
    c1: [372, 425.15], c2: [567, 431],
    p1: [647, 253], p2: [647, 343], p3: [647, 431.11], p4: [647, 523],
    o1: [442.86, 690.36], o2: [573.86, 690.36], o3: [704.86, 690.36], o4: [835.86, 690.36],
  };
  // src: začátek atributu d původní čáry, pts: lomená čára, at: body, kde kabel drží ve spoji
  const LINES = [
    { src: 'M254,185', pts: [[254, 185], [300, 185], [300, 426], [342, 426]], at: [[254, 185, 'i1'], [342, 426, 'c1']] },
    { src: 'M254,365', pts: [[254, 365], [288, 365], [288, 426], [342, 426]], at: [[254, 365, 'i2'], [342, 426, 'c1']] },
    { src: 'M254,545', pts: [[254, 545], [276, 545], [276, 426], [342, 426]], at: [[254, 545, 'i3'], [342, 426, 'c1']] },
    { src: 'M254,725', pts: [[254, 725], [300, 725], [300, 426], [367, 426]], at: [[254, 725, 'i4'], [367, 426, 'c1']] },
    { src: 'M572,431', pts: [[572, 431], [642, 431]], at: [[572, 431, 'c2'], [642, 431, 'p3']] },
    { src: 'M648,253L680', pts: [[648, 253], [680, 253]], at: [[648, 253, 'p1']] },
    { src: 'M648,253L680', pts: [[648, 343], [680, 343]], at: [[648, 343, 'p2']] },
    { src: 'M648,253L680', pts: [[647.8, 431.1], [679.8, 431.1]], at: [[647.8, 431.1, 'p3']] },
    { src: 'M648,253L680', pts: [[648, 523], [680, 523]], at: [[648, 523, 'p4']] },
    { src: 'M648,253L648', pts: [[648, 253], [648, 690.4]], at: [[648, 253, 'p1'], [648, 343, 'p2'], [648, 431, 'p3'], [648, 523, 'p4']] },
    { src: 'M648,253L648', pts: [[442.86, 690.4], [835.86, 690.4]], at: [[442.86, 690.4, 'o1'], [573.86, 690.4, 'o2'], [704.86, 690.4, 'o3'], [835.86, 690.4, 'o4']] },
    { src: 'M453,778', pts: [[442.86, 685.36], [442.86, 723.36]], at: [[442.86, 690.36, 'o1']] },
    { src: 'M453,778', pts: [[573.86, 685.36], [573.86, 723.36]], at: [[573.86, 690.36, 'o2']] },
    { src: 'M453,778', pts: [[704.86, 685.36], [704.86, 723.36]], at: [[704.86, 690.36, 'o3']] },
    { src: 'M453,778', pts: [[835.86, 685.36], [835.86, 723.36]], at: [[835.86, 690.36, 'o4']] },
  ];
  const PRY = 54;               // jak daleko se táhne, než spoj povolí (px)
  const GR = 1700;              // gravitace (px/s²)
  const PILE = [5, 4, 3, 2];    // hromádka spojů: kolik jich je v řadách odspodu
  // Obsah dílny pod mapou. Knihy podle elektroniche.cz, vzkazy jsou odkazy z oddílu Odkazy.
  const DILNA = {
    knihy: [            // název, barva, písmo, šířka, výška
      ['Hradla, volty, jednočipy', K, '#fff', 24, 146],
      ['Porty, bajty, osmibity', TEAL, '#fff', 22, 138],
      ['Data, čipy, procesory', Y, K, 26, 150],
      ['Micro:bit krok za krokem', '#fff', K, 22, 154],
      ['ESP32 prakticky', '#0b7a4f', '#fff', 25, 126],
      ['Kity, bity, neurony', '#5f6872', '#fff', 23, 140],
    ],
    knihyUrl: 'https://elektroniche.cz/',
    vzkazy: [
      ['Práce', 'Jasně.cz', 'https://jasne.cz/'],
      ['Nová hračka', 'made4fun', 'https://made4fun.eu/'],
      ['Newsletter', 'Adent', 'https://adent.substack.com/'],
      ['Archiv textů', 'Den 1', 'https://den1.cz/'],
    ],
  };

  const world = {
    ready: false, svg: null, box: null, pins: [], pinById: {}, lines: [], removed: [],
    swing: null, fall: null, pivot: null, gone: false, open: false, jolt: spring(0, 160, .22),
    cv: null, cx: null, dirty: false, dilna: null, hang: null, rewire: [], wire: null,
  };
  const pebbles = [];
  const tool = { on: false, pry: null, hover: null, el: null };
  let remeasureRaf = 0;

  // Kurzor šroubováku: hrot vlevo nahoře, tam je i aktivní bod.
  function cursorURL() {
    const c = canvas(40, 40), g = c.getContext('2d');
    g.translate(36, 36); g.rotate(-Math.PI * .75); g.scale(1.75, 1.75); g.translate(0, -2.5);
    paintSd(g, 1.75);
    return c.toDataURL();
  }
  function drawPliers(c, k = DPR) {
    c.width = Math.round(34 * k); c.height = Math.round(80 * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0); g.lineCap = g.lineJoin = 'round';
    const seg = (x1, y1, x2, y2, w, col) => {
      for (const [lw, s] of [[w + 2.4, K], [w, col]]) { g.strokeStyle = s; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    };
    seg(17, 32, 8, 76, 6, TEAL); seg(17, 32, 26, 76, 6, TEAL);
    seg(17, 32, 15.6, 6, 3.4, GREY); seg(17, 32, 18.4, 6, 3.4, GREY);
    g.fillStyle = '#6b7580'; g.strokeStyle = K; g.lineWidth = 1.2;
    g.beginPath(); g.arc(17, 32, 3.6, 0, TAU); g.fill(); g.stroke();
  }

  // Mapa je obrázek; aby šla rozebírat, vloží se přímo do stránky.
  async function inlineMap() {
    const img = doc.querySelector('img.identity-map');
    if (!img || !window.DOMParser) return null;
    const src = img.getAttribute('src') || '';
    let text;
    if (src.startsWith('data:')) {
      const i = src.indexOf(','), head = src.slice(5, i), body = src.slice(i + 1);
      text = head.includes('base64') ? new TextDecoder().decode(Uint8Array.from(atob(body), c => c.charCodeAt(0))) : decodeURIComponent(body);
    } else {
      const r = await fetch(img.src);
      if (!r.ok) return null;
      text = await r.text();
    }
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (!parsed || parsed.nodeName.toLowerCase() !== 'svg') return null;
    const sv = doc.importNode(parsed, true);
    sv.setAttribute('class', 'identity-map pnk-map');
    sv.setAttribute('role', 'img');
    sv.setAttribute('aria-label', img.alt || '');
    img.replaceWith(sv);
    return sv;
  }

  function setupMap(sv, saved) {
    world.svg = sv;
    const ctm = sv.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const found = [...sv.querySelectorAll('rect')]
      .filter(r => r.getAttribute('width') === '10' && r.getAttribute('height') === '10')
      .map(r => {
        const m = inv.multiply(r.getScreenCTM()), b = r.getBBox(), lx = b.x + b.width / 2, ly = b.y + b.height / 2;
        return { r, lx, ly, x: m.a * lx + m.c * ly + m.e, y: m.b * lx + m.d * ly + m.f };
      });
    for (const [id, [x, y]] of Object.entries(PINS)) {
      const hit = found.find(f => Math.hypot(f.x - x, f.y - y) < 4);
      if (!hit) continue;
      hit.r.classList.add('pnk-pin');
      const pin = { id, x, y, el: hit.r, lx: hit.lx, ly: hit.ly, on: true, px: 0, py: 0 };
      world.pins.push(pin); world.pinById[id] = pin;
    }
    // původní čáry se schovají, kabely kreslí skript
    const paths = [...sv.querySelectorAll('path')];
    for (const def of LINES) {
      const p = paths.find(e => (e.getAttribute('d') || '').startsWith(def.src));
      if (!p) continue;
      p.style.display = 'none';
      world.lines.push({ def, rope: null, gone: false });
    }
    world.cv = canvas(1, 1); world.cv.className = 'pnk-ropes'; world.cx = world.cv.getContext('2d');
    layer.insertBefore(world.cv, figEl);
    buildDilna(sv.parentElement);

    // uložený stav
    world.rewire = (saved.rw || []).filter(r => Array.isArray(r) && world.lines[r[0]] && world.pinById[r[2]]);
    for (const id of saved.pins || []) {
      const p = world.pinById[id];
      if (p && p.on) { p.on = false; p.el.classList.add('is-off'); world.removed.push(id); }
    }
    world.ready = true;
    world.box = mapBox();
    for (const p of world.pins) [p.px, p.py] = toPage(p.x, p.y);
    const left = world.pins.filter(p => p.on);
    if (world.removed.length && !left.length) { world.gone = true; sv.style.display = 'none'; world.cv.style.display = 'none'; openWorkshop(); }
    else if (world.removed.length && left.length === 1) startSwing(left[0], true);
    for (const L of world.lines) {
      const ps = L.def.at.map(a => world.pinById[a[2]]).filter(Boolean);
      if (world.gone || (ps.length && ps.every(p => !p.on))) L.gone = true;
    }
    updateLines();
    for (const id of world.removed) {
      const s = (saved.peb || []).find(v => v.id === id);
      makePebble(id, s && s.s === 'pile' ? 'pile' : 'rest', s);
    }
    measureMap();
    hint();
    setupWires();
  }

  function buildDilna(port) {
    const d = el('div', 'pnk-dilna');
    d.inert = true; d.setAttribute('aria-hidden', 'true');
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const books = DILNA.knihy.map(([t, bg, fg, w, h]) =>
      `<a class="pnk-book" href="${DILNA.knihyUrl}" target="_blank" rel="noopener noreferrer" style="--bg:${bg};--fg:${fg};width:${w}px;height:${h}px"><span>${esc(t)}</span></a>`).join('');
    const notes = DILNA.vzkazy.map(([k, t, u], i) =>
      `<a class="pnk-note" href="${u}" target="_blank" rel="noopener noreferrer" style="--r:${[-3, 2, -1.5, 3][i % 4]}deg"><small>${esc(k)}</small><b>${esc(t)}</b></a>`).join('');
    d.innerHTML = `<span class="pnk-dl-label">02 / Dílna</span>
<div class="pnk-dl-books">${books}</div><div class="pnk-dl-shelf"></div><span class="pnk-dl-shelf-label">Knihy · elektroniche.cz</span><button type="button" class="pnk-dl-iron" aria-label="Páječka"><canvas></canvas></button>
<div class="pnk-dl-board">${notes}</div>
<div class="pnk-dl-hook"><span class="pnk-peg"></span><button type="button" class="pnk-hang" aria-label="Další nástroj, zatím nedosažitelný"><canvas></canvas><span class="pnk-tag">?</span></button><span class="pnk-dl-msg">Moc vysoko</span></div>`;
    port.prepend(d);
    world.dilna = d;
    world.hang = d.querySelector('.pnk-hang');
    drawPliers(world.hang.querySelector('canvas'));
    if (pl.state === 'belt') hideHang();
    const ib = d.querySelector('.pnk-dl-iron');
    drawItem(ib.querySelector('canvas'), items.iron);
    if (items.iron.state !== 'hidden') ib.style.display = 'none';
    ib.addEventListener('click', () => {
      if (items.iron.state !== 'hidden') return;
      const r = ib.getBoundingClientRect();
      ib.style.display = 'none'; collectItem(items.iron, r, -8);
    });
    const msg = d.querySelector('.pnk-dl-msg');
    world.hang.addEventListener('click', () => {
      world.hang.classList.remove('is-jiggle'); void world.hang.offsetWidth; world.hang.classList.add('is-jiggle');
      msg.classList.add('is-on'); clearTimeout(msg.pnkT); msg.pnkT = setTimeout(() => msg.classList.remove('is-on'), 1800);
    });
    world.hang.addEventListener('animationend', e => { if (e.animationName === 'pnk-jiggle') world.hang.classList.remove('is-jiggle'); });
  }
  function openWorkshop() {
    if (world.open) return;
    world.open = true;
    if (world.dilna) { world.dilna.inert = false; world.dilna.removeAttribute('aria-hidden'); world.dilna.classList.add('is-open'); }
    if (world.svg) world.svg.style.pointerEvents = 'none';
  }

  // Poloha mapy na stránce bez otočení: obdélník prvku a měřítko viewBoxu (zachová poměr stran).
  function mapBox() {
    const sv = world.svg, keep = sv.style.transform;
    sv.style.transform = 'none';
    const r = sv.getBoundingClientRect();
    sv.style.transform = keep;
    const l = r.left + scrollX, t = r.top + scrollY, w = r.width, h = r.height, s = Math.min(w, h) / 920;
    return { l, t, w, h, s, ox: l + (w - 920 * s) / 2, oy: t + (h - 920 * s) / 2 };
  }
  const toPage = (x, y) => [world.box.ox + x * world.box.s, world.box.oy + y * world.box.s];

  function measureMap() {
    if (!world.ready) return;
    if (!world.gone) {
      world.box = mapBox();
      const b = world.box, c = world.cv;
      for (const p of world.pins) [p.px, p.py] = toPage(p.x, p.y);
      Object.assign(c.style, { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' });
      c.width = Math.max(1, Math.round(b.w * DPR)); c.height = Math.max(1, Math.round(b.h * DPR));
      for (const L of world.lines) if (L.rope) { L.rope = makeRope(L); settle(L.rope); }
      if (world.swing) { swingParams(); if (world.swing.still) world.swing.th = world.swing.psi0; }
      mapTransform();
    }
    placePebbles(); renderPebbles();
    drawRopes();
  }
  function remeasure() {
    if (!world.ready || remeasureRaf) return;
    remeasureRaf = requestAnimationFrame(() => { remeasureRaf = 0; measureMap(); });
  }

  // ---------- kabely a lana ----------
  function makeRope(L) {
    const P = L.def.pts, pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1], n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 8));
      for (let k = 0; k < n; k++) pts.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
    }
    pts.push(P[P.length - 1]);
    const q = pts.map(([x, y]) => { const [X, Y] = toPage(x, y); return { x: X, y: Y, px: X, py: Y, rx: X, ry: Y, pin: null }; });
    for (const [x, y, id] of L.def.at) {
      const pin = world.pinById[id];
      if (!pin || !pin.on) continue;
      let bi = 0, bd = 1e9;
      pts.forEach(([a, b], i) => { const d = Math.hypot(a - x, b - y); if (d < bd) { bd = d; bi = i; } });
      q[bi].pin = pin;
    }
    const len = [];
    for (let i = 0; i < q.length - 1; i++) len.push(Math.hypot(q[i + 1].x - q[i].x, q[i + 1].y - q[i].y));
    const R = { q, len, len0: len.slice(), awake: 240, low: false };
    const li = world.lines.indexOf(L);
    for (const [l, e, id] of world.rewire) {        // přepojené konce
      const t = world.pinById[id], v = e ? q[q.length - 1] : q[0];
      if (l !== li || !t || (v.pin && v.pin !== SOCK)) continue;
      const [X, Y] = toPage(t.x, t.y);
      Object.assign(v, { pin: SOCK, rx: X, ry: Y, x: X, y: Y, px: X, py: Y });
      stretch(R, v);
    }
    return R;
  }
  // Konec kabelu v cizí zdířce nebo v ruce: kabel se natáhne, aby tam dosáhl.
  const SOCK = { on: true, sock: true }, HAND = { on: true, hand: true };
  function stretch(R, v) {
    let d = 0;
    for (const u of R.q) if (u !== v && u.pin) d = Math.max(d, Math.hypot(u.rx - v.rx, u.ry - v.ry));
    const tot = R.len0.reduce((a, b) => a + b, 0), k = Math.max(1, d * 1.05 / tot);
    R.len = R.len0.map(l => l * k);
  }
  function settle(R) { for (let i = 0; i < 360; i++) stepRope(R, 1 / 120, false); }
  // Kabel, kterému povolil některý spoj, se změní v lano; spoje, které zmizely, ho přestanou držet.
  function updateLines() {
    for (const L of world.lines) {
      if (L.gone) continue;
      const ps = L.def.at.map(a => world.pinById[a[2]]).filter(Boolean);
      if (ps.every(p => p.on) && !world.swing) continue;
      if (!L.rope) L.rope = makeRope(L);
      for (const v of L.rope.q) if (v.pin && !v.pin.on) v.pin = null;
      L.rope.awake = 240;
    }
    world.dirty = true;
  }
  function stepRope(R, h, push) {
    let px = push && ptr.on ? ptr.x + scrollX : -1e5, py = push && ptr.on ? ptr.y + scrollY : -1e5;
    // u volného konce kurzor lano neodtlačuje, jinak by hrot uskakoval a nešel chytit
    const e0 = R.q[0], e1 = R.q[R.q.length - 1];
    for (const v of [e0, e1]) if ((!v.pin || v.pin === SOCK) && Math.hypot(v.x - px, v.y - py) < 34) { px = py = -1e5; break; }
    const bottom = world.box.t + world.box.h + 40, g = GR * h * h;
    let mv = 0, low = true;
    for (const v of R.q) {
      if (v.pin) { v.x = v.px = v.rx; v.y = v.py = v.ry; low = false; continue; }
      const vx = (v.x - v.px) * .99, vy = (v.y - v.py) * .99;
      v.px = v.x; v.py = v.y; v.x += vx; v.y += vy + g;
      const dx = v.x - px, dy = v.y - py, d = Math.hypot(dx, dy);
      if (d < 20 && d > .01) { const f = (20 - d) / d * .2; v.x += dx * f; v.y += dy * f; R.awake = 240; }
      mv = Math.max(mv, Math.abs(vx) + Math.abs(vy));
      if (v.y < bottom) low = false;
    }
    for (let it = 0; it < 14; it++) for (let i = 0; i < R.len.length; i++) {
      const a = R.q[i], b = R.q[i + 1];
      if (a.pin && b.pin) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, df = (d - R.len[i]) / d;
      if (a.pin) { b.x -= dx * df; b.y -= dy * df; }
      else if (b.pin) { a.x += dx * df; a.y += dy * df; }
      else { a.x += dx * df / 2; a.y += dy * df / 2; b.x -= dx * df / 2; b.y -= dy * df / 2; }
    }
    R.low = low;
    return mv;
  }
  function stepRopes(h) {
    let busy = false;
    for (const L of world.lines) {
      const R = L.rope;
      if (!R || L.gone || R.awake <= 0) continue;
      busy = true;
      const mv = stepRope(R, h, true);
      if (R.low) { L.gone = true; L.rope = null; }
      else if (mv < .02) R.awake--;
      else R.awake = Math.max(R.awake, 90);
    }
    return busy;
  }
  function drawRopes() {
    const c = world.cv, g = world.cx, b = world.box;
    if (!c || !b) return;
    if (world.gone) { c.style.display = 'none'; return; }
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, b.w, b.h);
    g.translate(-b.l, -b.t);
    g.strokeStyle = K; g.lineWidth = Math.max(1, 2 * b.s); g.lineCap = g.lineJoin = 'round';
    for (const L of world.lines) {
      if (L.gone) continue;
      g.beginPath();
      if (!L.rope) L.def.pts.forEach(([x, y], i) => { const [X, Y] = toPage(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      else {
        const v = L.rope.q;
        g.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length - 1; i++) g.quadraticCurveTo(v[i].x, v[i].y, (v[i].x + v[i + 1].x) / 2, (v[i].y + v[i + 1].y) / 2);
        g.lineTo(v[v.length - 1].x, v[v.length - 1].y);
      }
      g.stroke();
    }
    // volné konce mají měděný hrot, za který jde kabel chytit
    const r = Math.max(2.5, 5 * b.s);
    const loose = world.lines.some(L => !L.gone && L.rope && [L.rope.q[0], L.rope.q[L.rope.q.length - 1]].some(v => !v.pin || v.pin === SOCK));
    world.svg.parentElement.style.touchAction = loose && !world.swing ? 'none' : '';
    for (const L of world.lines) {
      if (L.gone || !L.rope) continue;
      const q = L.rope.q;
      for (const v of [q[0], q[q.length - 1]]) {
        if (v.pin && v.pin !== SOCK && v.pin !== HAND) continue;
        g.fillStyle = v.pin === SOCK ? K : '#d98a2b'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(v.x, v.y, v.pin === SOCK ? r * .8 : r, 0, TAU); g.fill(); if (!v.pin) g.stroke();
      }
    }
  }

  // ---------- přepojování ----------
  // Volný konec kabelu jde chytit (rukou nebo kleštěmi) a zastrčit do kterékoli zdířky v mapě.
  // Mapa pak tvrdí něco jiného a poznámka pod ní to vypíše.
  const PIN_NAME = { i1: 'média', i2: 'software', i3: 'AI', i4: 'elektronika', c1: 'jádro', c2: 'jádro',
    p1: 'rozebrat', p2: 'vyzkoušet', p3: 'popsat', p4: 'spustit', o1: 'článek', o2: 'kniha', o3: 'prototyp', o4: 'nástroj' };
  const CLAIM = { io: 'rovnou, bez přemýšlení', ip: 'bez textu i kódu', ii: 'vstupy si povídají mezi sebou', ic: 'jádro dostalo jiný vstup',
    oi: 'výstup se vrací na vstup, kruh se uzavřel', oo: 'výstupy se množí samy', op: 'nejdřív výsledek, potom práce', po: 'hotovo dřív, než se začalo',
    pp: 'proces v procesu', pi: 'zpátky na začátek', pc: 'jádro se samo rozebírá', ci: 'jádro krmí vstupy', co: 'jádro to rovnou vydá', cp: 'jádro zkratovalo', cc: 'jádro mluví samo se sebou', oc: 'výstup se cpe do jádra' };
  const noteOrig = {};
  function wireAt(x, y, touch) {
    if (!world.ready || world.swing || world.fall || world.gone) return null;
    let best = null, bd = touch ? 26 : 15;
    world.lines.forEach((L, li) => {
      if (L.gone || !L.rope) return;
      const q = L.rope.q;
      [0, 1].forEach(e => {
        const v = e ? q[q.length - 1] : q[0];
        if (v.pin && v.pin !== SOCK) return;
        if (!L.rope.q.some(u => u !== v && u.pin)) return;      // kabel, který nic nedrží, nejde přepojit
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < bd) { bd = d; best = { L, li, e, v }; }
      });
    });
    return best;
  }
  function setupWires() {
    const port = world.svg.parentElement;
    addEventListener('pointerdown', e => {
      const c = curTool();
      if ((c && c !== 'pl') || e.button > 0 || world.wire) return;
      const w = wireAt(e.clientX + scrollX, e.clientY + scrollY, e.pointerType !== 'mouse');
      if (!w) return;
      e.preventDefault(); e.stopImmediatePropagation(); swallow = performance.now(); lastActivity = performance.now();
      if (w.v.pin === SOCK) { world.rewire = world.rewire.filter(r => !(r[0] === w.li && r[1] === w.e)); claims(); }
      w.v.pin = HAND; w.id = e.pointerId; world.wire = w;
      root.classList.add('pnk-grabbing'); snd('tuk');
      wireMove(e);
    }, { capture: true });
    addEventListener('pointermove', e => {
      if (world.wire) { wireMove(e); return; }
      if (e.pointerType === 'mouse' && !curTool() || curTool() === 'pl') {
        const near = !!wireAt(e.clientX + scrollX, e.clientY + scrollY, false);
        port.style.cursor = near ? 'grab' : '';
      }
    }, { capture: true, passive: true });
    const up = e => {
      const w = world.wire;
      if (!w || e.pointerId !== w.id) return;
      world.wire = null; root.classList.remove('pnk-grabbing');
      const R = w.L.rope, own = new Set(R.q.filter(u => u.pin && u.pin.id).map(u => u.pin.id));
      let t = null, bd = 24;
      for (const p of world.pins) {
        if (own.has(p.id)) continue;
        const d = Math.hypot(p.px - w.v.rx, p.py - w.v.ry);
        if (d < bd) { bd = d; t = p; }
      }
      if (t) {
        Object.assign(w.v, { pin: SOCK, rx: t.px, ry: t.py });
        world.rewire = world.rewire.filter(r => !(r[0] === w.li && r[1] === w.e));
        world.rewire.push([w.li, w.e, t.id]);
        stretch(R, w.v); snd('cvak'); puffAt(t.px, t.py - 14, 'cvak');
        lastBreak = performance.now();
      } else { w.v.pin = null; R.len = R.len0.slice(); }
      R.awake = 240; world.dirty = true; kick();
      claims(); save();
    };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    claims();
  }
  function wireMove(e) {
    const w = world.wire;
    if (!w || e.pointerId !== w.id) return;
    w.v.rx = e.clientX + scrollX; w.v.ry = e.clientY + scrollY;
    stretch(w.L.rope, w.v); w.L.rope.awake = 240; kick();
  }
  // Co teď mapa tvrdí: věta za každý přepojený kabel.
  function claims() {
    const note = doc.querySelector('.portrait-note');
    if (!note) return;
    const lab = note.querySelector('.portrait-note-label'), big = note.querySelector('strong'), small = note.querySelector('span:last-child');
    if (!noteOrig.big) Object.assign(noteOrig, { lab: lab.textContent, big: big.textContent, small: small.textContent });
    const out = [];
    for (const [li, e, id] of world.rewire) {
      const L = world.lines[li], R = L.rope;
      let src = null;
      if (R) { const pins = R.q.filter(u => u.pin && u.pin.id && u.pin.on).map(u => u.pin.id); src = e ? pins[0] : pins[pins.length - 1]; }
      if (!src) src = L.def.at[e ? 0 : L.def.at.length - 1][2];
      if (src === id) continue;
      const k = src[0] + id[0], a = PIN_NAME[src], b = PIN_NAME[id];
      out.push(`${a[0].toUpperCase() + a.slice(1)} → ${b}: ${CLAIM[k] || 'nikdo neví proč'}.`);
    }
    if (!out.length) { lab.textContent = noteOrig.lab; big.textContent = noteOrig.big; small.textContent = noteOrig.small; note.classList.remove('pnk-claim'); return; }
    lab.textContent = 'Mapa · přepojeno';
    big.textContent = out.length > 1 ? 'Mapa teď tvrdí:' : out[0].split(':')[0] + '.';
    small.textContent = out.length > 1 ? out.slice(-3).join(' ') : out[0].split(': ')[1];
    note.classList.add('pnk-claim');
  }

  // ---------- mapa se houpe a padá ----------
  function startSwing(pin, rest) {
    world.pivot = pin;
    world.swing = { th: 0, w: 0, psi0: 0, k: 1, c: .45, still: 0 };
    swingParams();
    if (rest) { world.swing.th = world.swing.psi0; world.swing.still = 1; } else world.swing.w = rand(-.25, .25);
    openWorkshop(); updateLines(); mapTransform();
  }
  // Kyvadlo: deska zavěšená v bodě spoje, těžiště uprostřed mapy.
  function swingParams() {
    const sw = world.swing, b = world.box, pin = world.pivot;
    const rx = (460 - pin.x) * b.s, ry = (460 - pin.y) * b.s, L = Math.hypot(rx, ry) || 1, a = 920 * b.s;
    sw.psi0 = Math.atan2(rx, ry);
    sw.k = GR / ((a * a / 6 + L * L) / L);
  }
  function mapTransform() {
    const sv = world.svg, c = world.cv;
    if (!sv || world.gone) return;
    if (world.swing) {
      const o = world.pivot, b = world.box;
      sv.style.transformOrigin = `${(o.px - b.l).toFixed(1)}px ${(o.py - b.t).toFixed(1)}px`;
      sv.style.transform = `translateY(${world.fall ? world.fall.y.toFixed(1) : 0}px) rotate(${world.swing.th.toFixed(4)}rad)`;
      c.style.transform = 'none';
    } else {
      const a = world.jolt.x, t = Math.abs(a) < .002 ? 'none' : `rotate(${a.toFixed(3)}deg)`;
      sv.style.transformOrigin = '50% 50%'; sv.style.transform = t; c.style.transform = t;
    }
  }
  function stepMap(h) {
    let busy = false;
    const J = world.jolt;
    if (Math.abs(J.x) > .002 || Math.abs(J.v) > .002) { stepS(J, 0, h); busy = true; } else J.x = J.v = 0;
    const sw = world.swing;
    if (sw && world.fall && !world.gone) {
      const F = world.fall;
      F.v += GR * h; F.y += F.v * h; sw.th += sw.w * h;
      if (F.y > world.box.h + 920 * world.box.s) {
        world.gone = true; world.svg.style.display = 'none'; world.cv.style.display = 'none';
        save();
      }
      busy = true;
    } else if (sw && !sw.still) {
      sw.w += (sw.k * Math.sin(sw.psi0 - sw.th) - sw.c * sw.w) * h; sw.th += sw.w * h;
      if (Math.abs(sw.w) < .002 && Math.abs(sw.th - sw.psi0) < .002) sw.still = 1;
      busy = true;
    }
    if (busy) mapTransform();
    return busy;
  }

  // ---------- páčení ----------
  function popPin(pin, ux = 0, uy = -1) {
    if (!pin || !pin.on || !world.ready) return;
    pin.on = false; pin.el.classList.add('is-off'); pin.el.removeAttribute('transform');
    lastBreak = performance.now();
    if (tool.hover === pin) setHover(null);
    world.removed.push(pin.id);
    spawnPebble(pin.id, pin.px, pin.py, ux * 150 + rand(-40, 40), -380 + uy * 140 + rand(-60, 20), rand(-1, 1) * 900);
    puffAt(pin.px, pin.py - 14, 'cvak');
    const left = world.pins.filter(p => p.on);
    if (left.length === 1 && !world.swing) startSwing(left[0], false);
    else if (!left.length && world.swing && !world.fall) { world.fall = { y: 0, v: 0 }; world.swing.still = 0; world.swing.w += rand(-.6, .6); }
    else if (!world.swing) world.jolt.v += (Math.random() < .5 ? -1 : 1) * (14 + world.removed.length * 4);
    updateLines(); save(); hint(); kick();
  }
  function pinAt(cx, cy) {
    if (!world.ready || world.fall || world.gone) return null;
    let best = null, bd = 18;
    for (const p of world.pins) {
      if (!p.on) continue;
      const d = Math.hypot(p.px - scrollX - cx, p.py - scrollY - cy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function setHover(pin) {
    if (tool.hover === pin) return;
    if (tool.hover) tool.hover.el.classList.remove('is-hover');
    if (pin) pin.el.classList.add('is-hover');
    tool.hover = pin;
  }
  function toggleTool(v = !tool.on) {
    if (v && sd.state !== 'belt') return;
    if (v && tool.pl) togglePliers(false);
    if (v && tool.cur) useTool(null);
    tool.on = !!v;
    root.classList.toggle('pnk-tool', tool.on);
    slots[0].classList.toggle('is-active', tool.on);
    slots[0].setAttribute('aria-pressed', String(tool.on));
    if (!tool.on) { endPry(); setHover(null); }
    hint();
  }
  // Dokud je v ruce nástroj, odkazy na stránce nejsou odkazy: žádné kliknutí je nemůže otevřít,
  // ani když ho zachytí někdo jiný než tenhle skript (například prohlížeč náhledu).
  function syncLinks() {
    const busy = !!(tool.on || tool.pl || tool.cur);
    root.classList.toggle('pnk-busy', busy);
    if (busy) for (const a of doc.querySelectorAll('a[href]')) {
      if (a.closest('.pnk-belt')) continue;
      a.dataset.pnkHref = a.getAttribute('href'); a.removeAttribute('href');
    }
    else for (const a of doc.querySelectorAll('a[data-pnk-href]')) { a.setAttribute('href', a.dataset.pnkHref); delete a.dataset.pnkHref; }
  }
  function hint() {
    syncLinks();
    slots[0].classList.toggle('is-hint', sd.state === 'belt' && world.ready && !world.removed.length && !tool.on);
    slots[1].classList.toggle('is-hint', pl.state === 'belt' && !pl.cuts.length && !tool.pl);
  }
  function pryStart(e) {
    const pin = pinAt(e.clientX, e.clientY);
    if (!pin) return false;
    if (!tool.el) {
      const c = canvas(Math.round(40 * DPR), Math.round(10 * DPR)), g = c.getContext('2d'), u = c.width / 20;
      c.className = 'pnk-pry'; c.style.width = '40px'; c.style.height = '10px';
      g.setTransform(u, 0, 0, u, 0, 0); paintSd(g, u);
      layer.appendChild(c); tool.el = c;
    }
    tool.pry = { pin, id: e.pointerId, p: 0, ang: -Math.PI * .75, dir: null };   // jako kurzor: hrot vlevo nahoru
    root.classList.add('pnk-prying');
    tool.el.style.display = 'block';
    setHover(pin);
    pryMove(e);
    return true;
  }
  // Páka: hrot pod spojem, rukojeť míří ke kurzoru. Čím dál, tím víc se spoj zvedá, až povolí.
  // Tlačení: šroubovák při stisku zůstane natočený jako kurzor (hrot vlevo nahoru, na krytce).
  // Při tahu se plynule natočí hrotem po směru tahu a krytku tlačí před sebou. Jde s myší,
  // ale ztuhle, krytka klade odpor. Po dostatečném tahu cvakne a odletí dál po směru tahu.
  // Směr se zamkne po 12 px, návrat ke krytce ho odemkne, tah jinam o víc než 70° ho přehodí.
  function pryMove(e) {
    const P = tool.pry, pin = P.pin;
    const dx = e.clientX - (pin.px - scrollX), dy = e.clientY - (pin.py - scrollY), d = Math.hypot(dx, dy);
    const pa = Math.atan2(dy, dx), diff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    if (d < 8) P.dir = null;
    else if (P.dir == null && d > 12) P.dir = pa;
    else if (P.dir != null && d > 20 && Math.abs(diff(pa, P.dir)) > 1.22) P.dir = pa;
    if (P.dir != null) {
      P.ang += diff(P.dir, P.ang) * .35;                     // natáčí se plynule, nikdy neskočí
      P.p = clamp((dx * Math.cos(P.dir) + dy * Math.sin(P.dir)) / PRY, 0, 1);
    } else P.p = Math.max(0, P.p - .2);
    const dir = P.dir == null ? P.ang : P.dir, ux = Math.cos(dir), uy = Math.sin(dir);
    const lift = 12 * P.p * P.p, s0 = world.box ? world.box.s : .5;
    const jit = P.p > .55 ? rand(-1, 1) * P.p : 0, rot = (P.p * 32 + jit * 4) * (ux >= 0 ? 1 : -1);
    pin.el.setAttribute('transform', `translate(${(ux * lift + jit).toFixed(2)} ${(uy * lift).toFixed(2)}) rotate(${rot.toFixed(1)} ${pin.lx} ${pin.ly})`);
    // hrot je u krytky a jede s ní; prvek má hrot vpravo, takže otočení = směr hrotu
    const tx = pin.px + ux * lift * s0 - Math.cos(P.ang) * 4, ty = pin.py + uy * lift * s0 - Math.sin(P.ang) * 4;
    tool.el.style.transform = `translate3d(${(tx - 39).toFixed(1)}px,${(ty - 5).toFixed(1)}px,0) rotate(${P.ang.toFixed(3)}rad)`;
    if (P.p >= 1) { endPry(); popPin(pin, ux, uy); }
  }


  function endPry() {
    const P = tool.pry;
    if (!P) return;
    tool.pry = null;
    root.classList.remove('pnk-prying');
    if (tool.el) tool.el.style.display = 'none';
    if (P.pin.on) P.pin.el.removeAttribute('transform');
  }

  // ---------- spoje na zemi ----------
  const pebSize = () => (world.box ? Math.max(7, Math.round(13 * world.box.s)) : 7);
  function floorKey(e) {
    for (let i = 0; i < FLOORS.length; i++) {
      const j = [...doc.querySelectorAll(FLOORS[i][0])].indexOf(e);
      if (j >= 0) return [i, j];
    }
    return null;
  }
  function floorByKey(k) {
    if (!k || !FLOORS[k[0]]) return null;
    const e = doc.querySelectorAll(FLOORS[k[0]][0])[k[1]];
    return e ? floorOf(e) : null;
  }
  function pileFloor() { const e = doc.querySelector('.portrait-note'); return e ? floorOf(e) : null; }
  function slotPos(k, f = pileFloor()) {
    if (!f || k < 0) return null;
    const z = pebSize();
    let row = 0, j = k;
    while (row < PILE.length && j >= PILE[row]) { j -= PILE[row]; row++; }
    if (row >= PILE.length) { row = PILE.length - 1; j = 0; }
    const n = PILE[row], cx = f.x2 - 14 * S;
    return { x: cx + (j - (n - 1) / 2) * (z + 1), y: f.y - z / 2 - row * z };
  }
  function nextSlot() {
    const used = new Set(pebbles.filter(p => p.st === 'pile').map(p => p.slot));
    let k = 0;
    while (used.has(k)) k++;
    return k;
  }
  function makePebble(id, st0, s) {
    const e = el('div', 'pnk-peb');
    layer.appendChild(e);
    const pf = pileFloor();
    const p = { id, el: e, st: st0, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, z: pebSize(), t: 0,
      fk: (s && s.fk) || (pf ? floorKey(pf.el) : null), fr: s && s.fr != null ? s.fr : rand(.25, .6), slot: s && s.slot != null ? s.slot : -1 };
    if (st0 === 'pile' && p.slot < 0) p.slot = nextSlot();
    pebbles.push(p);
    return p;
  }
  function spawnPebble(id, x, y, vx, vy, va) {
    const p = makePebble(id, 'fly');
    Object.assign(p, { x, y, vx, vy, va, z: pebSize() });
    p.el.style.width = p.el.style.height = p.z + 'px';
    kick();
  }
  function placePebbles() {
    const z = pebSize();
    for (const p of pebbles) {
      p.z = z; p.el.style.width = p.el.style.height = z + 'px';
      if (p.st === 'rest') {
        const f = floorByKey(p.fk) || pileFloor();
        if (f) { p.x = f.x1 + p.fr * (f.x2 - f.x1); p.y = f.y - z / 2; p.fk = floorKey(f.el); }
      } else if (p.st === 'pile') {
        const s = slotPos(p.slot);
        if (s) { p.x = s.x; p.y = s.y; }
      }
    }
  }
  function renderPebbles() {
    for (const p of pebbles) {
      if (p.st === 'held' && fig.vis) {
        const hd = rig.hands[0], F = rig.face.x;
        p.x = fig.cx + (hd.x.x + F * .4) * S; p.y = fig.gy + fig.sink - (hd.y.x + .15) * S; p.a = 0;
      }
      p.el.style.transform = `translate3d(${(p.x - p.z / 2).toFixed(1)}px,${(p.y - p.z / 2).toFixed(1)}px,0) rotate(${p.a.toFixed(1)}deg)`;
    }
  }
  function stepPebbles(h, fl) {
    let busy = false;
    const pw = root.scrollWidth, ph = root.scrollHeight;
    for (const p of pebbles) {
      if (p.st !== 'fly') continue;
      busy = true;
      const b0 = p.y + p.z / 2;
      p.vy += GR * h; p.x += p.vx * h; p.y += p.vy * h; p.a += p.va * h;
      if (p.x < p.z) { p.x = p.z; p.vx = Math.abs(p.vx) * .5; } else if (p.x > pw - p.z) { p.x = pw - p.z; p.vx = -Math.abs(p.vx) * .5; }
      const b1 = p.y + p.z / 2;
      for (const f of fl) {
        if (p.x < f.x1 || p.x > f.x2 || b0 > f.y + .5 || b1 < f.y) continue;
        p.y = f.y - p.z / 2;
        if (p.vy > 180) { p.vy *= -.3; p.vx *= .55; p.va *= .4; } else land(p, f);
        break;
      }
      if (p.st === 'fly' && p.y > ph) {
        const f = pileFloor() || fl[fl.length - 1];
        if (f) { p.x = clamp(p.x, f.x1 + 10, f.x2 - 10); land(p, f); }
      }
    }
    return busy;
  }
  function land(p, f) {
    Object.assign(p, { st: 'rest', y: f.y - p.z / 2, a: Math.round(p.a / 90) * 90, vx: 0, vy: 0, va: 0,
      fk: floorKey(f.el), fr: (p.x - f.x1) / (f.x2 - f.x1), t: performance.now() });
    save();
  }
  function dropPebble() {
    const p = fig.pebble;
    fig.pebble = null;
    if (!p || p.st !== 'held') return;
    Object.assign(p, { st: 'fly', vx: fig.dir * 70, vy: -140, va: rand(-500, 500) });
    kick();
  }
  function nearestPebble(x, pf = pileFloor()) {
    if (!pf) return null;
    const k = floorKey(pf.el), now = performance.now();
    let best = null, bd = 1e9;
    for (const p of pebbles) {
      if (p.st !== 'rest' || !p.fk || !k || p.fk[0] !== k[0] || p.fk[1] !== k[1] || now - p.t < 700 * q) continue;
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  const visibleY = y => y > scrollY + 17 * S && y < scrollY + innerHeight - 4;
  function gatherReady() { const pf = pileFloor(); return !!(pf && visibleY(pf.y) && nearestPebble(0, pf)); }
  const workFloor = () => (world.open && world.svg ? floorOf(world.svg.parentElement) : null);

  function save() {
    const peb = [];
    for (const p of pebbles) {
      if (p.st === 'pile') peb.push({ id: p.id, s: 'pile', slot: p.slot });
      else if ((p.st === 'rest' || p.st === 'held') && p.fk) peb.push({ id: p.id, s: 'rest', fk: p.fk, fr: +(+p.fr).toFixed(4) });
    }
    const tools = [];
    if (sd.state === 'belt') tools.push('sroubovak');
    if (pl.state === 'belt') tools.push('kleste');
    store.set(Object.assign({ tools, pins: world.removed.slice(), rw: world.rewire.map(r => r.slice()), peb, cuts: pl.cuts.slice(), half: pl.half }, extraSave()));
  }

  function worldStep(dt) {
    if (!world.ready) return false;
    let busy = false;
    const H = Math.min(.05, dt / 1000), n = Math.max(1, Math.ceil(H * 120)), h = H / n;
    // spoje padají před rámem mapy, podlaha dílny je nezachytí
    const flying = pebbles.some(p => p.st === 'fly'), fl = flying ? floors().filter(f => !world.svg || f.el !== world.svg.parentElement) : null;
    let ropes = false;
    for (let i = 0; i < n; i++) {
      if (stepRopes(h)) ropes = true;
      if (flying && stepPebbles(h, fl)) busy = true;
      if (stepMap(h)) busy = true;
    }
    if (ropes) world.dirty = true;
    return busy || ropes;
  }

  // ---------- výstupy kolem mapy ----------
  // Sbírá spoje ze země a staví z nich hromádku.
  async function gather(tk) {
    const pf = pileFloor();
    let p = nearestPebble(0, pf);
    if (!pf || !p) return;
    const s0 = slotPos(0, pf), x0 = clamp(s0.x - 24 * S, pf.x1 + HW, pf.x2 - HW);
    await climb(tk, pf, x0, p.x < x0 ? -1 : 1);
    if (!st.gathered) { fig.pose = 'scratch'; puff('?'); await wait(tk, 1200); await lookAround(tk, 2, 380, 'alarm'); }
    for (let n = 0; p && n < 20; n++) {
      const side = p.x >= fig.cx ? 1 : -1;
      await go(tk, clamp(p.x - side * 2.5 * S, pf.x1 + HW / 2, pf.x2 - HW / 2), { speed: 38 * S });
      if (p.st === 'rest') {
        fig.dir = side; fig.pose = 'bend';
        await wait(tk, 380);
      }
      if (p.st !== 'rest') { p = nearestPebble(fig.cx, pf); continue; }
      p.st = 'held'; fig.pebble = p; fig.pose = 'stand';
      await wait(tk, 240);
      if (!st.gathered || Math.random() < .25) {
        fig.pose = 'inspect'; puff(st.gathered ? 'hm' : 'ó!');
        await wait(tk, 1100);
        st.gathered = true; fig.pose = 'stand';
      }
      const k = nextSlot(), sp = slotPos(k, pf), side2 = sp.x >= fig.cx ? 1 : -1;
      await go(tk, clamp(sp.x - side2 * 2.5 * S, pf.x1 + HW / 2, pf.x2 - HW / 2), { speed: 30 * S });
      fig.dir = side2; fig.reachY = (pf.y - sp.y) / S; fig.pose = 'place';
      await wait(tk, 420);
      Object.assign(p, { st: 'pile', slot: k, x: sp.x, y: sp.y, a: 0, fk: floorKey(pf.el) });
      fig.pebble = null; save(); fig.pose = 'stand';
      await wait(tk, 240);
      p = nearestPebble(fig.cx, pf);
    }
    fig.pose = 'proud';
    puff(pebbles.length === world.pins.length && pebbles.every(v => v.st === 'pile') ? 'ta-dá!' : 'tak');
    await wait(tk, 1300);
    await lookAround(tk, 1, 400);
    await duck(tk);
  }
  // V dílně kouká na nástroj na háku, vyskakuje, ale nedosáhne.
  async function longing(tk) {
    st.longs++;
    const f = workFloor();
    if (!f || !world.hang) return;
    const hr = world.hang.getBoundingClientRect();
    const hx = clamp(hr.left + hr.width / 2 + scrollX, f.x1 + HW, f.x2 - HW);
    const x0 = clamp(hx - 34 * S, f.x1 + HW, f.x2 - HW);
    await climb(tk, f, x0, hx >= x0 ? 1 : -1);
    await go(tk, hx, { speed: 26 * S });
    fig.pose = 'lookup'; puff('!');
    await wait(tk, 1000);
    for (let i = 0; i < 2; i++) {
      fig.pose = 'land'; await wait(tk, 160);
      fig.pose = 'reach';
      const y0 = fig.gy;
      await tween(tk, 460, v => { fig.gy = y0 - Math.sin(v * Math.PI) * 9 * S; });
      fig.gy = y0; fig.pose = 'land';
      await wait(tk, 240);
    }
    fig.pose = 'think'; puff('hm…', true);
    await wait(tk, 1800);
    fig.pose = 'sad';
    await wait(tk, 700);
    await go(tk, clamp(fig.cx - 20 * S, f.x1 + HW, f.x2 - HW), { speed: 12 * S, pose: 'sadwalk' });
    await duck(tk);
  }

  // ---------- kleště ----------
  // Druhý nástroj. Visí v dílně na háku; panáček je sestřelí spoji z hromádky a odnáší si je.
  // Pošimraný je upustí, kliknutím jdou do opasku. Kleštěmi se odštipují štítky v oddílu Území.
  // stavy: hook (na háku), air (padají), fig (má je panáček), ground (leží), fly, belt
  const pl = { half: {}, state: 'hook', x: 0, y: 0, a: 0, vis: false, el: null, fk: null, fr: 0, cuts: [], fallen: [] };
  // Co se objeví v díře po odštípnutém štítku: [text, odkaz]. Štítky bez záznamu nechají prázdnou díru.
  const UZEMI = {
    'Média': ['Newsletter', 'https://adent.substack.com/'],
    'Odborné knihy': ['elektroniche.cz', 'https://elektroniche.cz/'],
    'Mikroelektronika': ['elektroniche.cz', 'https://elektroniche.cz/'],
    'Retrocomputing': ['elektroniche.cz', 'https://elektroniche.cz/'],
  };
  const toolCount = () => (sd.state === 'belt' ? 1 : 0) + (pl.state === 'belt' ? 1 : 0) + Object.values(items).filter(it => it.state === 'belt').length;

  function buildPliers() {
    const b = el('button', 'pnk-pl'); b.type = 'button'; b.setAttribute('aria-label', 'Sebrat kleště');
    const c = canvas(1, 1); drawPliers(c); b.appendChild(c);
    b.addEventListener('click', collectPliers);
    layer.appendChild(b); pl.el = b;
    slots[1].addEventListener('click', () => { if (pl.state === 'belt') togglePliers(); });
    const cc = canvas(1, 1); drawPliers(cc, .5);
    const style = pstyle();
    style.textContent = `html.pnk-pliers,html.pnk-pliers *{cursor:url(${cc.toDataURL()}) 8 3,crosshair!important}`;
    doc.head.appendChild(style);
  }
  function hookPos() { const r = world.hang.getBoundingClientRect(); return { x: r.left + r.width / 2 + scrollX, y: r.bottom + scrollY }; }
  function hideHang() { if (world.hang) world.hang.parentElement.classList.add('is-empty'); }
  function renderPliers() {
    const e = pl.el, s = pl.state;
    if (!e) return;
    const on = s === 'air' || s === 'ground' || (s === 'fig' && pl.vis && fig.vis);
    e.style.display = on ? 'block' : 'none';
    e.classList.toggle('is-ground', s === 'ground');
    e.tabIndex = s === 'ground' ? 0 : -1;
    if (!on) return;
    if (s === 'fig') {                         // drží je oběma rukama nad hlavou
      const a = rig.hands[0], b = rig.hands[1];
      pl.x = fig.cx + (a.x.x + b.x.x) / 2 * S; pl.y = fig.gy - (a.y.x + b.y.x) / 2 * S + 8;
      pl.a = rig.lean.x * rig.face.x * 25 + rig.lagX.x * 14 + Math.sin(fig.t / 170) * 3;
    }
    e.style.transform = `translate3d(${(pl.x - 17).toFixed(1)}px,${(pl.y - 80).toFixed(1)}px,0) rotate(${pl.a.toFixed(1)}deg)`;
  }
  // Kleště spadnou na čáru a zůstanou ležet.
  function landPliers(f, x0, y0, a0, ms, tx = x0) {
    pl.state = 'air'; pl.vis = false;
    const gx = clamp(tx, f.x1 + 12, f.x2 - 92), gy = f.y - 17;
    return tween(FREE, ms, v => { pl.x = x0 + (gx - x0) * v; pl.y = y0 + (gy - y0) * v * v; pl.a = a0 + (450 - a0) * v; })
      .then(() => {
        Object.assign(pl, { state: 'ground', x: gx, y: gy, a: 90, fk: floorKey(f.el), fr: (gx - f.x1) / (f.x2 - f.x1) });
        puffAt(gx + 30, gy - 30, 'řach'); showBelt(); renderPliers(); lastEnd = performance.now();
      });
  }
  function fillPliers() {
    const b = slots[1], c = canvas(1, 1);
    drawPliers(c); c.className = 'pnk-ico-pl';
    b.replaceChildren(c); b.disabled = false; b.classList.remove('is-next'); b.classList.add('is-full');
    b.setAttribute('aria-label', 'Kleště'); b.setAttribute('aria-pressed', String(!!tool.pl));
    setCount(toolCount()); showBelt(); hideHang();
  }
  function collectPliers() {
    if (pl.state !== 'ground') return;
    const r = pl.el.getBoundingClientRect();
    pl.state = 'fly'; renderPliers(); showBelt();
    const done = () => {
      pl.state = 'belt'; lastEnd = performance.now();
      fillPliers(); save(); hint();
      belt.classList.remove('is-bump'); void belt.offsetWidth; belt.classList.add('is-bump');
    };
    const c = canvas(1, 1); drawPliers(c); c.className = 'pnk-fly';
    c.style.width = '34px'; c.style.height = '80px';
    doc.body.appendChild(c);
    const s = slots[1].getBoundingClientRect();
    const x0 = r.left + r.width / 2 - 17, y0 = r.top + r.height / 2 - 40, x1 = s.left + s.width / 2 - 17, y1 = s.top + s.height / 2 - 40;
    if (!c.animate) { c.remove(); done(); return; }
    c.animate([
      { transform: `translate(${x0}px,${y0}px) rotate(90deg) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 90}px) rotate(230deg) scale(1.1)`, offset: .5 },
      { transform: `translate(${x1}px,${y1}px) rotate(360deg) scale(.45)` },
    ], { duration: 650, easing: 'ease-in-out' }).onfinish = () => { c.remove(); done(); };
  }
  function togglePliers(v = !tool.pl) {
    if (v && pl.state !== 'belt') return;
    if (v && tool.on) toggleTool(false);
    if (v && tool.cur) useTool(null);
    tool.pl = !!v;
    root.classList.toggle('pnk-pliers', tool.pl);
    slots[1].classList.toggle('is-active', tool.pl);
    slots[1].setAttribute('aria-pressed', String(tool.pl));
    hint();
  }

  // Odštípnutí štítku: štítek spadne na čáru pod sebou, v řádku po něm zůstane díra.
  // Úhel, pod kterým visí: volný konec se opře o spodní okraj rámečku Území, nepropadne pod něj.
  function hangAngle(t) {
    const box = t.closest('.index') || t.parentElement, r = t.getBoundingClientRect(), b = box.getBoundingClientRect();
    const d = b.bottom - 3 - (r.top + r.height / 2), L = r.width - 3;
    return Math.max(6, d >= L ? 88 : Math.asin(Math.max(0, d) / L) * 180 / Math.PI);
  }
  function halfTag(t, side, still) {
    t.classList.remove('pnk-half', 'pnk-half-L', 'pnk-half-R', 'pnk-still');
    t.style.setProperty('--a', hangAngle(t).toFixed(1) + 'deg');
    t.classList.add('pnk-half', 'pnk-half-' + side);
    if (still) t.classList.add('pnk-still');
  }
  function unhalf(t) { t.classList.remove('pnk-half', 'pnk-half-L', 'pnk-half-R', 'pnk-still'); }
  function snip(t, live) {
    if (!t || t.classList.contains('pnk-hole')) return;
    const side0 = pl.half[t.textContent.trim()], ang0 = parseFloat(t.style.getPropertyValue('--a')) || 0;
    unhalf(t);                                   // měřit se musí cedulka v původní poloze
    const name = t.textContent.trim(), r = t.getBoundingClientRect();
    delete pl.half[name];
    if (live) {
      const c = t.cloneNode(true); c.classList.add('pnk-cutoff');
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
      const a0 = side0 === 'L' ? -ang0 : side0 === 'R' ? ang0 : 0;
      layer.appendChild(c);
      const x0 = r.left + scrollX, y0 = r.top + scrollY, mid = x0 + r.width / 2;
      const drop = side0 ? 140 : 4;           // napůl utržená přepadne přes okraj a letí dál
      const cand = floors().filter(f => f.y > y0 + r.height + drop);
      const row = cand.filter(f => f.y - cand[0].y < 8);
      const f = row.length ? row.reduce((a, b) => (gapTo(b, mid) < gapTo(a, mid) ? b : a)) : null;
      const sx = side0 === 'L' ? -1 : side0 === 'R' ? 1 : 0;
      const x1 = f ? clamp(x0 + sx * r.width * .6, f.x1, f.x2 - r.width) : x0, y1 = (f ? f.y : root.scrollHeight) - r.height;
      const a1 = side0 ? (side0 === 'L' ? -180 : 180) + rand(-5, 5) : rand(-7, 7);
      // start: kde je střed visící cedulky (otáčí se kolem středu, aby převrácená ležela na svém místě)
      let bx = x0, by = y0;
      if (side0) {
        const px = side0 === 'L' ? x0 + r.width - 3 : x0 + 3, py = y0 + r.height / 2, k = (r.width / 2 - 3) * (side0 === 'L' ? -1 : 1), ra = a0 * Math.PI / 180;
        bx = px + k * Math.cos(ra) - r.width / 2; by = py + k * Math.sin(ra) - r.height / 2;
      }
      pl.fallen.push({ name, el: c, fk: f ? floorKey(f.el) : null, fr: f ? (x1 - f.x1) / (f.x2 - f.x1) : 0, a: a1, h: r.height });
      tween(FREE, 300 + 14 * Math.sqrt(Math.max(0, y1 - y0)), v => {
        c.style.transform = `translate3d(${(bx + (x1 - bx) * v).toFixed(1)}px,${(by + (y1 - by) * v * v - (side0 ? Math.sin(v * Math.PI) * 30 : 0)).toFixed(1)}px,0) rotate(${(a0 + (a1 - a0) * v + Math.sin(v * 9) * 7 * (1 - v)).toFixed(1)}deg)`;
      });
      puffAt(mid - 12, y0 - 8, 'cvak');
      pl.cuts.push(name); save();
      onCut(f, mid, y0);
    }
    t.style.width = r.width + 'px';
    t.classList.add('pnk-hole'); t.setAttribute('aria-label', name);
    t.textContent = '';
    const u = UZEMI[name];
    if (u) {
      const a = doc.createElement('a');
      a.href = u[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = u[0];
      t.appendChild(a);
    }
    hint();
  }
  function placeFallen() {
    for (const o of pl.fallen) {
      const f = floorByKey(o.fk);
      if (f) o.el.style.transform = `translate3d(${(f.x1 + o.fr * (f.x2 - f.x1)).toFixed(1)}px,${f.y - o.h}px,0) rotate(${o.a.toFixed(1)}deg)`;
    }
    if (pl.state === 'ground') {
      const f = floorByKey(pl.fk);
      if (f) { pl.x = f.x1 + pl.fr * (f.x2 - f.x1); pl.y = f.y - 17; }
    }
    renderPliers();
  }

  // Panáček a kleště: sestřelí je z háku, zvedne ze země, nebo je jen hrdě nese kolem.
  async function fetchPliers(tk) {
    const pf = pileFloor();
    if (!pf) return;
    st.fetches++;
    const lo = pf.x1 + HW, hi = pf.x2 - HW;
    if (pl.state === 'hook') {
      const hp = hookPos(), spot = clamp(slotPos(0, pf).x - 13 * S, lo, hi);
      await climb(tk, pf, clamp(spot - 22 * S, lo, hi), 1);
      await go(tk, spot, { speed: 30 * S });
      fig.dir = hp.x >= fig.cx ? 1 : -1; fig.pose = 'lookup';
      await wait(tk, 800);
      fig.pose = 'think'; puff('hm…', true);
      await wait(tk, 1400);
      fig.pose = 'stand'; puff('!');
      await wait(tk, 350);
      for (let i = 0; i < 3; i++) {
        const p = pebbles.filter(v => v.st === 'pile').sort((a, b) => b.slot - a.slot)[0];
        if (!p) break;
        const side = p.x >= fig.cx ? 1 : -1;
        await go(tk, clamp(p.x - side * 2.5 * S, pf.x1 + HW / 2, pf.x2 - HW / 2), { speed: 34 * S });
        fig.dir = side; fig.reachY = (pf.y - p.y) / S; fig.pose = 'place';
        await wait(tk, 360);
        Object.assign(p, { st: 'held', slot: -1 }); fig.pebble = p; fig.pose = 'stand';
        await go(tk, spot, { speed: 34 * S });
        fig.dir = hp.x >= fig.cx ? 1 : -1; fig.pose = 'windup';
        await wait(tk, 420);
        // hod: oblouk má vrchol v místě, kam míří; první dva vedle
        const tx = hp.x + [-40, 34, 0][i], ty = hp.y - 48;
        const vy = -Math.sqrt(2 * GR * Math.max(40, p.y - ty)), tt = -vy / GR;
        fig.pebble = null;
        Object.assign(p, { st: 'fly', vx: (tx - p.x) / tt, vy, va: 800 });
        fig.pose = 'throw';
        await wait(tk, tt * 1000);
        if (i < 2) { fig.pose = i ? 'scratch' : 'sad'; puff(i ? 'hm' : 'ach'); await wait(tk, 750); continue; }
        world.hang.classList.remove('is-jiggle'); void world.hang.offsetWidth; world.hang.classList.add('is-jiggle');
        puffAt(hp.x, hp.y - 90, 'ťuk');
        await wait(tk, 260);
        hideHang();
        landPliers(pf, hp.x, hp.y, 0, 560, slotPos(0, pf).x - 34 * S);
        fig.pose = 'alarm';
        await wait(tk, 700);
        fig.pose = 'proud'; puff('jo!');
        await wait(tk, 900);
      }
      if (pl.state === 'hook') { fig.pose = 'sad'; await wait(tk, 800); await duck(tk); return; }
    } else if (pl.state === 'ground') {
      const f = floorByKey(pl.fk) || pf;
      await climb(tk, f, clamp(pl.x - 30 * S, f.x1 + HW, f.x2 - HW), 1);
      await lookAround(tk, 2, 380, 'alarm');
    } else {
      await climb(tk, pf, clamp(pf.x2 - 26 * S, lo, hi), -1);
      pl.vis = true; fig.pose = 'trophy';
      await wait(tk, 500);
    }
    if (pl.state === 'ground' || pl.state === 'air') {
      const f = fig.floor;
      await go(tk, clamp(pl.x - 2 * S, f.x1 + HW / 2, f.x2 - HW / 2), { speed: 22 * S, pose: 'sneak', until: () => pl.state !== 'ground' && pl.state !== 'air' });
      if (pl.state !== 'ground') return puzzled(tk);
      fig.dir = 1; fig.pose = 'bend';
      await wait(tk, 420);
      if (pl.state !== 'ground') return puzzled(tk);
      pl.state = 'fig'; pl.vis = true; fig.pose = 'trophy'; puff('hehe');
      await wait(tk, 700);
    }
    const f = fig.floor;
    await go(tk, f.x1 + HW, { speed: 13 * S, pose: 'trophy' });
    fig.pose = 'trophy';
    await wait(tk, 300);
    pl.vis = false;
    await duck(tk);
  }

  // ---------- zvuk ----------
  // Všechno se vyrábí v prohlížeči. Hraje až po prvním kliknutí, vypíná se přezkou opasku.
  const audio = { ctx: null, mute: false, last: {}, step: 0, drill: null };
  function unlock() {
    if (audio.ctx || audio.mute) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) try { audio.ctx = new AC(); } catch (e) { /* bez zvuku */ }
  }
  function tone(f0, f1, dur, type, vol, at = 0) {
    const c = audio.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, freq, at = 0) {
    const c = audio.ctx, t = c.currentTime + at, n = Math.max(1, Math.floor(c.sampleRate * dur));
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  const SOUNDS = {
    cvak: () => { noise(.03, .5, 3000); tone(1800, 900, .04, 'square', .1); },
    lup: () => tone(300, 900, .09, 'sine', .3),
    chi: () => { for (let i = 0; i < 3; i++) tone(900 + i * 160, 1250 + i * 160, .07, 'sine', .16, i * .09); },
    uf: () => noise(.25, .12, 500),
    rach: () => { noise(.18, .5, 900); tone(160, 60, .2, 'triangle', .3); },
    tuk: () => tone(700, 400, .05, 'triangle', .3),
    krok: () => noise(.02, .06, 1800),
    jo: () => tone(500, 1000, .15, 'sine', .2),
    hm: () => tone(180, 150, .25, 'sine', .12),
    q: () => tone(500, 800, .12, 'sine', .12),
    pss: () => noise(.4, .2, 5000),
    bum: () => { tone(120, 50, .12, 'sine', .5); noise(.04, .3, 800); },
    zzz: () => tone(140, 110, .5, 'sine', .05),
    flip: () => noise(.35, .2, 1200),
    boing: () => { const c = audio.ctx, t = c.currentTime, o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(520, t + .5);
      l.frequency.value = 14; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .6);
      o.connect(g); g.connect(c.destination); o.start(t); l.start(t); o.stop(t + .62); l.stop(t + .62); },
    au: () => { tone(620, 300, .12, 'sine', .2); tone(500, 240, .14, 'sine', .14, .1); },
  };
  const TXT = { 'cvak': 'cvak', 'lup!': 'lup', 'chi': 'chi', 'chichi!': 'chi', 'hehe': 'chi', 'uf': 'uf', 'řach': 'rach', 'ťuk': 'tuk', 'bum': 'bum',
    'jo!': 'jo', 'ta-dá!': 'jo', 'tak': 'tuk', 'hm…': 'hm', 'hm': 'hm', 'ach': 'hm', '?': 'q', '!': 'q', 'ó!': 'q', 'z': 'zzz', 'pšš': 'pss', 'ááá': 'hm', 'zzt': 'pss', 'boing!': 'boing', 'krrr': 'pss', 'vrz': 'tuk', 'au': 'au', 'áu!': 'au', 'au au': 'au', 'hej!': 'q', 'pusť!': 'au', 'NE!': 'au', 'hmpf': 'hm', 'grr': 'hm', 'ha!': 'jo' };
  function snd(n) {
    const c = audio.ctx;
    if (!n || !c || audio.mute || !SOUNDS[n]) return;
    const now = performance.now();
    if (now - (audio.last[n] || 0) < 70) return;
    audio.last[n] = now;
    try { if (c.state === 'suspended') c.resume(); SOUNDS[n](); } catch (e) { /* nic */ }
  }
  function drillSnd(on) {
    const c = audio.ctx;
    if (audio.drill) { try { audio.drill.stop(); } catch (e) { /* nic */ } audio.drill = null; }
    if (!on || !c || audio.mute) return;
    try {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(80, c.currentTime); o.frequency.linearRampToValueAtTime(150, c.currentTime + .7);
      g.gain.value = .07; o.connect(g); g.connect(c.destination); o.start(); audio.drill = o;
    } catch (e) { /* nic */ }
  }
  function setMute(v, user) {
    audio.mute = !!v;
    const b = belt.querySelector('.pnk-buckle');
    b.classList.toggle('is-mute', audio.mute); b.setAttribute('aria-pressed', String(!audio.mute));
    if (audio.mute) drillSnd(false); else if (user) unlock();
  }

  // ---------- další nářadí: páječka, vrtačka, baterka ----------
  // stavy: hidden, air, fig (nese panáček), ground (leží), fly, belt
  const paintIt = (g, fill, fn) => { g.fillStyle = fill; g.beginPath(); fn(); g.fill(); g.stroke(); };
  const rr = (g, x, y, w, h, r) => { if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const items = {
    iron: { slot: 2, w: 72, h: 22, name: 'Páječka', draw(g) {
      paintIt(g, GREY, () => { g.moveTo(1, 11); g.lineTo(11, 8); g.lineTo(34, 9); g.lineTo(34, 13); g.lineTo(11, 14); g.closePath(); });
      paintIt(g, '#6b7580', () => g.rect(34, 5, 4, 12));
      paintIt(g, TEAL, () => rr(g, 38, 4, 30, 14, 6));
      g.beginPath(); g.moveTo(68, 11); g.quadraticCurveTo(72, 11, 71, 19); g.stroke();
    } },
    drill: { slot: 3, w: 62, h: 46, name: 'Vrtačka', draw(g) {
      g.save(); g.lineWidth = 3; g.strokeStyle = '#6b7580'; g.beginPath(); g.moveTo(1, 13); g.lineTo(15, 13); g.stroke(); g.restore();
      paintIt(g, GREY, () => g.rect(14, 8, 8, 10));
      paintIt(g, Y, () => rr(g, 38, 18, 13, 26, 4));
      paintIt(g, Y, () => rr(g, 22, 3, 36, 20, 5));
      paintIt(g, K, () => g.rect(34, 24, 4, 7));
    } },
    torch: { slot: 4, w: 56, h: 22, name: 'Baterka', draw(g) {
      paintIt(g, '#3a424b', () => rr(g, 12, 5, 42, 12, 3));
      paintIt(g, '#59636e', () => { g.moveTo(1, 2); g.lineTo(13, 5); g.lineTo(13, 17); g.lineTo(1, 20); g.closePath(); });
      paintIt(g, Y, () => g.rect(1, 4, 3, 14));
      paintIt(g, TEAL, () => g.rect(26, 2.5, 8, 3));
    } },
  };
  function drawItem(c, it, k = DPR) {
    c.width = Math.round(it.w * k); c.height = Math.round(it.h * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = g.lineCap = 'round'; g.strokeStyle = K; g.lineWidth = 1.4;
    it.draw(g);
  }
  let holes = [], drilling = null, lastBreak = -1e9, rub = null, corner = null, typed = '', swallow = 0;
  const NIGHT = flags.includes('noc') || new Date().getHours() >= 22 || new Date().getHours() < 6;

  // Poznámky „toho vzadu". Viditelné jsou jen ve světle baterky.
  const NOTES = [
    ['Kdo je vepředu', 'Píše, programuje a rozebírá věci, aby zjistil, jak fungují. Pak o tom napíše knihu.'],
    ['Stručnost', 'Chce odpovědi na jednu až dvě věty. Tahle poznámka je už teď moc dlouhá.'],
    ['Čeština', 'Anglicismy mi škrtá. Na líci má přitom v oddílu Dělám slovo „workflow". Neříkat mu to, nebo si toho všimne.'],
    ['Pomlčky', 'Dlouhé pomlčky nesnese. Píšu čárky a dělám, že mi to nevadí.'],
    ['Nejdřív mluvit', 'Kód až po dohodě. Když začnu programovat dřív, pozná to a zuří.'],
    ['Osm bitů', 'Z80, 8080, 6502, 6809. ASM80 je jeho assembler v prohlížeči, Osma jeho jazyk pro osmibity. Emulátor starých procesorů si napsal v JavaScriptu.'],
    ['Starquake', 'Předělává hry ze ZX Spectra z roku 1985. Věrně, včetně mapy. A k tomu chystá knihu o hrách na Spectrum.'],
    ['Dráty', 'ESP32, Micro:bit, klávesnice z počítače Ondra. FORTH na mikrokontroléru zkusil taky.'],
    ['Doma', 'Někde na kopci nad Sázavou běží domácí servery a Raspberry Pi, které poslouchá letadla a meteorologické sondy. A Meshcore a TinyGS'],
    ['Stroje', 'iPhone, MacBook Air s M1, miniservery na Linuxu a pracovní stanice s Windows. S tou poslední jsme si užili nejvíc.'],
    ['Agenti', 'Nechává agenty, aby si navzájem kontrolovali práci, a chce jim k tomu dát moderátora. Dokumentaci drží ve Stratě, abych si ji nemusel pamatovat sám.'],
    ['Dovednosti', 'Staví mi je do zásoby: featuremaker, ideamaker, první principy s povinným oponentem.'],
    ['Lokální modely', 'Počítal, jestli se vyplatí vlastní železo. Vyšlo mu, že zatím ne. Území na líci si přesto nechal. Mám se bát?'],
    ['Slovobraní', 'Napsal si řešitele slovní hry, který dorovnává denní rekordy. Hrát poctivě ho zjevně nebavilo.'],
    ['made4fun', 'Staví katalog věcí, které si lidé udělali pro radost. Tenhle web by tam patřil.'],
    ['Satira', 'Píše glosy. Lehce a kousavě. Tady vzadu se snažím nebýt jejich námětem.'],
    ['Růže', 'Pěstuje na zahradě růže. Jediná věc v téhle složce, která nejde přeložit ani spustit.'],
    ['Dílna', 'Tam za ním nemůžu. Ne že bych nechtěl. Bůhví, co tam dělá.'],
    ['Tenhle web', 'Chtěl web jako hru. Dostal panáčka, který mu krade šroubovák. Ve tři ráno napsal: jeď a programuj.'],
  ];

  function buildExtra() {
    const style = pstyle();
    let cur = '';
    for (const [n, it] of Object.entries(items)) {
      const c = canvas(1, 1); drawItem(c, it, .6);
      cur += `html.pnk-t-${n},html.pnk-t-${n} *{cursor:url(${c.toDataURL()}) 1 ${Math.round(it.h * .6 * (n === 'drill' ? .28 : .5))},crosshair!important}`;
    }
    style.textContent = cur + `
.pnk-buckle{padding:0;background:none;cursor:pointer;box-sizing:content-box}
.pnk-buckle.is-mute{border-style:dashed;opacity:.5}
.pnk-pct{opacity:.75;white-space:nowrap}
.pnk-pct:empty{display:none}
@media (max-width:560px){.pnk-pct{display:none}.pnk-slot{width:24px}}
.pnk-slot canvas.pnk-ico{left:50%;top:50%;margin:0;transform:translate(-50%,-50%) rotate(-90deg)}
.pnk-it{position:absolute;left:0;top:0;display:none;border:0;padding:0;margin:0;background:none;pointer-events:none;will-change:transform;-webkit-tap-highlight-color:transparent}
.pnk-it.is-ground{pointer-events:auto;cursor:pointer}
.pnk-it:focus-visible{outline:2px solid ${TEAL};outline-offset:4px}
.pnk-it.is-shine::after{content:"";position:absolute;right:96%;top:50%;width:130px;height:96px;transform:translateY(-50%);background:linear-gradient(to left,rgba(242,183,5,.5),rgba(242,183,5,0));clip-path:polygon(100% 40%,100% 60%,0 100%,0 0);pointer-events:none}
.pnk-pin.is-off{visibility:hidden}
html.pnk-t-iron .pnk-pin.is-off{visibility:visible;opacity:.5;fill:#f2b705;stroke-dasharray:2 2}
html.pnk-t-iron .portrait{outline:2px dashed #f2b705;outline-offset:-5px}
html.pnk-t-iron .tag.pnk-hole,html.pnk-t-iron .pnk-hole2{outline:2px dashed #f2b705;outline-offset:1px}
html.pnk-t-drill,html.pnk-t-drill *{user-select:none!important;-webkit-touch-callout:none}
.pnk-dl-iron{position:absolute;right:38%;bottom:56%;border:0;padding:0;background:none;cursor:pointer;transform:rotate(-8deg);transform-origin:100% 100%}
.pnk-dl-iron canvas{display:block;width:72px;height:22px}
.pnk-dl-iron:hover,.pnk-dl-iron:focus-visible{transform:rotate(-8deg) translateY(-5px)}
.pnk-bit{position:absolute;left:0;top:0;width:54px;height:54px;pointer-events:none}
.pnk-bit::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px dashed ${K};animation:pnk-spin .35s linear infinite}
.pnk-bit::after{content:"";position:absolute;inset:0;border-radius:50%;background:#0c0e11;animation:pnk-bore .7s ease-in forwards}
@keyframes pnk-spin{to{transform:rotate(360deg)}}
@keyframes pnk-bore{from{transform:scale(0)}to{transform:scale(1)}}
.pnk-hole2{position:absolute;left:0;top:0;width:54px;height:54px;border-radius:50%;background:#0c0e11;box-shadow:inset 0 4px 10px #000,0 0 0 2px ${K},0 0 0 4px rgba(16,19,23,.12);pointer-events:auto;display:grid;place-items:center;overflow:hidden;color:${K};font:800 8.5px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;text-transform:uppercase;text-align:center}
.pnk-hole2 i{display:block;width:22px;height:7px;background:radial-gradient(circle at 4px 50%,#fff 3px,transparent 3.6px),radial-gradient(circle at 18px 50%,#fff 3px,transparent 3.6px);animation:pnk-eyes 4.6s infinite}
@keyframes pnk-eyes{0%,91%,100%{transform:none}94%{transform:scaleY(.1)}}
.pnk-hole2 b{display:none;padding:0 4px;font-weight:800}
.pnk-hole2.is-lit{background:#f1e7c9}
.pnk-hole2.is-lit i{display:none}
.pnk-hole2.is-lit b{display:block}
.pnk-corner{position:fixed;right:0;top:0;z-index:2147483001;width:62px;height:62px;border:0;padding:0;cursor:pointer;background:linear-gradient(225deg,#14181d 0 50%,transparent 50%);filter:drop-shadow(-2px 2px 2px rgba(16,19,23,.3));transform:translate(100%,-100%);transition:transform .5s cubic-bezier(.2,1.4,.4,1)}
.pnk-corner.is-on{transform:none}
.pnk-corner:hover,.pnk-corner:focus-visible{transform:scale(1.25);transform-origin:100% 0}
.pnk-corner{touch-action:none}
.pnk-corner.is-back{right:auto;left:0;background:linear-gradient(135deg,#f7f8fa 0 50%,transparent 50%);filter:drop-shadow(2px 2px 2px rgba(0,0,0,.45));transform:translate(-100%,-100%)}
.pnk-corner.is-back.is-on{transform:none}
.pnk-corner.is-back:hover,.pnk-corner.is-back:focus-visible{transform:scale(1.25);transform-origin:0 0}
html.pnk-turning .pnk-corner{transition:none;visibility:hidden}
.pnk-rub{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background-color:#14181d;background-image:linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;color:#e9e3d0;font-family:Inter,ui-sans-serif,system-ui,sans-serif;visibility:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.pnk-rub.is-turning{visibility:visible}
.pnk-rub.is-on{position:relative;inset:auto;min-height:100vh;overflow:visible;visibility:visible}
.pnk-shade{position:absolute;left:0;top:0;width:100%;height:100%;background:#07090b;opacity:0;pointer-events:none;display:none;z-index:5}
html.pnk-turning .pnk-shade{display:block}
.pnk-under{position:fixed;left:0;top:0;z-index:-1;display:none;pointer-events:none}
.pnk-ply{position:fixed;left:50%;top:0;height:100vh;z-index:2147483001;pointer-events:none;display:none;box-sizing:border-box;background:repeating-linear-gradient(to right,#e6c995 0 2px,#c49a5e 2px 3px,#ead3a6 3px 6px,#b7884f 6px 7px);border-top:1px solid #8a6436;border-bottom:1px solid #8a6436}
html.pnk-turning .pnk-ply{display:block}
.pnk-rub-in{position:relative;width:min(1180px,calc(100% - 48px));margin:0 auto;padding:28px 0 140px}
.pnk-rub-back{padding:9px 14px;border:1px solid #e9e3d0;background:none;color:inherit;cursor:pointer;font:800 12px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase}
.pnk-rub-ghost{margin:38px 0 0;font-size:clamp(58px,9vw,116px);font-weight:800;line-height:.86;letter-spacing:-.085em;color:rgba(255,255,255,.07);transform:scaleX(-1);user-select:none}
.pnk-rub-dark{margin:26px 0 0;color:#8b949e;font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.pnk-rub.has-light .pnk-rub-dark{visibility:hidden}
.pnk-rub-notes{margin-top:22px;-webkit-mask-image:radial-gradient(circle var(--r,0px) at var(--mx,50%) var(--my,0px),#000 60%,transparent 100%);mask-image:radial-gradient(circle var(--r,0px) at var(--mx,50%) var(--my,0px),#000 60%,transparent 100%)}
.pnk-rub-notes h2{margin:0 0 6px;font-size:clamp(30px,4vw,50px);line-height:.96;letter-spacing:-.065em}
.pnk-rub-notes>p{margin:0 0 30px;max-width:56ch;color:#b9c1c9;font-size:17px}
.pnk-rub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:26px 30px}
.pnk-rub-grid article{padding-top:12px;border-top:2px solid #e9e3d0}
.pnk-rub-grid article:nth-child(3n+2){border-top-color:#6cc7f5}
.pnk-rub-grid h3{margin:0 0 8px;color:#6cc7f5;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
.pnk-rub-grid p{margin:0;font-size:16px;line-height:1.45}
.pnk-rub-glow{position:fixed;left:0;top:0;width:420px;height:420px;margin:-210px 0 0 -210px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,170,.13),rgba(255,236,170,0) 68%);pointer-events:none;display:none}
.pnk-rub.has-light .pnk-rub-glow{display:block}
`;
    doc.head.appendChild(style);

    for (const [n, it] of Object.entries(items)) {
      Object.assign(it, { id: n, state: 'hidden', x: 0, y: 0, a: 0, vis: false, fk: null, fr: 0 });
      const b = el('button', 'pnk-it'); b.type = 'button'; b.setAttribute('aria-label', 'Sebrat: ' + it.name.toLowerCase());
      const c = canvas(1, 1); drawItem(c, it); c.style.width = it.w + 'px'; c.style.height = it.h + 'px'; c.style.display = 'block';
      b.appendChild(c);
      b.addEventListener('click', () => { if (it.state === 'ground') collectItem(it, b.getBoundingClientRect(), it.a); });
      layer.appendChild(b); it.el = b;
      slots[it.slot].addEventListener('click', () => { if (it.state === 'belt') useTool(tool.cur === n ? null : n); });
    }
    const bk = belt.querySelector('.pnk-buckle');
    bk.addEventListener('click', () => { setMute(!audio.mute, true); save(); snd('tuk'); });

    corner = el('button', 'pnk-corner'); corner.type = 'button'; corner.setAttribute('aria-label', 'Otočit web na rub');
    corner.addEventListener('click', e => { if (turn.dragged) { turn.dragged = false; return; } flip(!turn.side); });
    corner.addEventListener('pointerdown', turnStart);
    rub = el('div', 'pnk-rub'); rub.inert = true; rub.setAttribute('aria-hidden', 'true');
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    rub.innerHTML = `<div class="pnk-rub-glow"></div><div class="pnk-rub-in"><button type="button" class="pnk-rub-back">Otočit zpět</button>
<div class="pnk-rub-ghost" aria-hidden="true">Martin Malý</div><p class="pnk-rub-dark"></p>
<div class="pnk-rub-notes"><h2>Rub</h2><p>Co je vepředu, ukazuje on. Co je vzadu, dělám já. Tohle jsou moje poznámky.</p>
<div class="pnk-rub-grid">${NOTES.map(([t, x]) => `<article><h3>${esc(t)}</h3><p>${esc(x)}</p></article>`).join('')}</div></div></div>`;
    rub.querySelector('.pnk-rub-back').addEventListener('click', () => flip(false));
    turn.shadeB = el('div', 'pnk-shade'); rub.appendChild(turn.shadeB);
    turn.shadeF = el('div', 'pnk-shade'); layer.appendChild(turn.shadeF);
    turn.ply = el('div', 'pnk-ply');
    addEventListener('scroll', () => { if (turn.side) rubLight(); }, { passive: true });
    addEventListener('pointermove', turnMove, { passive: true });
    addEventListener('pointerup', turnEnd); addEventListener('pointercancel', turnEnd);
    doc.body.append(rub, turn.ply, corner);
  }

  // ---------- nářadí: ležení, sbírání, výběr ----------
  function renderItems() {
    for (const it of Object.values(items)) {
      const e = it.el, s = it.state;
      if (!e) continue;
      const on = s === 'air' || s === 'ground' || (s === 'fig' && it.vis && fig.vis);
      e.style.display = on ? 'block' : 'none';
      e.classList.toggle('is-ground', s === 'ground');
      e.classList.toggle('is-shine', s === 'fig' && it.id === 'torch');
      e.tabIndex = s === 'ground' ? 0 : -1;
      if (!on) continue;
      if (s === 'fig') {
        const hd = rig.hands[0], F = rig.face.x;
        it.x = fig.cx + hd.x.x * S + F * it.w * .3; it.y = fig.gy - hd.y.x * S; it.a = 90 + F * 90 + Math.sin(fig.t / 300) * 4;
      }
      e.style.transform = `translate3d(${(it.x - it.w / 2).toFixed(1)}px,${(it.y - it.h / 2).toFixed(1)}px,0) rotate(${it.a.toFixed(1)}deg)`;
    }
  }
  function landItem(it, f, x0, y0, tx = x0) {
    it.state = 'air'; it.vis = false;
    const gx = clamp(tx, f.x1 + it.w / 2 + 4, f.x2 - it.w / 2 - 4), gy = f.y - it.h / 2, a0 = it.a;
    it.x = x0; it.y = y0;
    kick();
    return tween(FREE, 300 + 13 * Math.sqrt(Math.max(0, gy - y0)), v => { it.x = x0 + (gx - x0) * v; it.y = y0 + (gy - y0) * v * v; it.a = a0 + (360 - a0) * v; })
      .then(() => {
        Object.assign(it, { state: 'ground', x: gx, y: gy, a: 0, fk: floorKey(f.el), fr: (gx - f.x1) / (f.x2 - f.x1) });
        puffAt(gx, gy - 26, 'řach'); showBelt(); renderItems(); lastEnd = performance.now();
      });
  }
  function fillItem(it) {
    const b = slots[it.slot], c = canvas(1, 1), k = Math.min(38 / it.w, 22 / it.h);
    drawItem(c, it, k * DPR); c.className = 'pnk-ico';
    c.style.width = it.w * k + 'px'; c.style.height = it.h * k + 'px';
    b.replaceChildren(c); b.disabled = false; b.classList.remove('is-next'); b.classList.add('is-full');
    b.setAttribute('aria-label', it.name); b.setAttribute('aria-pressed', String(tool.cur === it.id));
    setCount(toolCount()); showBelt();
  }
  function collectItem(it, r, a0) {
    it.state = 'fly'; renderItems(); showBelt();
    const done = () => {
      it.state = 'belt'; lastEnd = performance.now();
      fillItem(it); save(); hint();
      belt.classList.remove('is-bump'); void belt.offsetWidth; belt.classList.add('is-bump');
    };
    const c = canvas(1, 1); drawItem(c, it); c.className = 'pnk-fly';
    c.style.width = it.w + 'px'; c.style.height = it.h + 'px';
    doc.body.appendChild(c);
    const s = slots[it.slot].getBoundingClientRect();
    const x0 = r.left + r.width / 2 - it.w / 2, y0 = r.top + r.height / 2 - it.h / 2, x1 = s.left + s.width / 2 - it.w / 2, y1 = s.top + s.height / 2 - it.h / 2;
    if (!c.animate) { c.remove(); done(); return; }
    c.animate([
      { transform: `translate(${x0}px,${y0}px) rotate(${a0}deg) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 90}px) rotate(${a0 - 200}deg) scale(1.1)`, offset: .5 },
      { transform: `translate(${x1}px,${y1}px) rotate(-450deg) scale(${Math.min(38 / it.w, 22 / it.h)})` },
    ], { duration: 650, easing: 'ease-in-out' }).onfinish = () => { c.remove(); done(); };
  }
  function useTool(n) {
    if (n && items[n].state !== 'belt') return;
    if (n) { if (tool.on) toggleTool(false); if (tool.pl) togglePliers(false); }
    if (tool.cur) { root.classList.remove('pnk-t-' + tool.cur); slots[items[tool.cur].slot].classList.remove('is-active'); slots[items[tool.cur].slot].setAttribute('aria-pressed', 'false'); }
    drillEnd();
    tool.cur = n || null;
    if (n) { root.classList.add('pnk-t-' + n); slots[items[n].slot].classList.add('is-active'); slots[items[n].slot].setAttribute('aria-pressed', 'true'); }
    for (const h of holes) h.el.classList.remove('is-lit');
    rubLight(); hint();
  }
  const carried = () => Object.values(items).find(it => it.state === 'fig' && it.vis);
  function dropVis() { fig.tool = null; for (const it of Object.values(items)) it.vis = false; }

  // ---------- počitadlo ----------
  function progress() {
    const e = belt.querySelector('.pnk-pct');
    if (!e) return;
    const parts = brokenParts(), n = parts.reduce((a, b) => a + b[0], 0), all = parts.reduce((a, b) => a + b[1], 0);
    const p = Math.min(100, Math.round(100 * n / all));
    e.textContent = fin.on ? '' : n ? `rozebráno ${p} %` : fin.done ? '★ složeno' : '';
    if (p >= 100 && !fin.on && !fin.armed) { fin.armed = true; setTimeout(finale, 700); }
    if (corner) corner.classList.toggle('is-on', holes.length >= 3);
  }

  // Co všechno jde rozebrat: [rozebráno, celkem] po skupinách.
  function brokenParts() {
    const lw = lead.words.length || 1;
    return [
      [world.removed.length, 14], [pl.cuts.length, 9], [Math.min(holes.length, 6), 6], [secCount(), 2 + (secEl.items.length || 3) + (secEl.links.length || 4)],
      [h1.slots.filter(s => s.cur !== s.orig).length, h1.slots.length || 1],
      [mm.L ? 2 : mm.out > 0 ? 1 : 0, 2], [Math.round(6 * lead.words.filter(w => w.gone).length / lw), 6], [fig.novisor ? 1 : 0, 1],
    ];
  }

  // ---------- finále: holé HTML ----------
  // Když je rozebráno všechno, opadá ze stránky styl: pravidlo po pravidle se mažou a padají
  // jako trosky. Zůstane holé HTML. Panáček pak stránku obléká: hází pravidla zpátky nahoru,
  // stránka se po kouscích skládá, a nakonec spraví i všechno ostatní. Opasek dostane hvězdu.
  const fin = { on: false, armed: false, done: 0, sheets: null };
  function siteSheets() {
    return [...doc.styleSheets].filter(sh => { try { return !(sh.ownerNode && sh.ownerNode.dataset && 'pnk' in sh.ownerNode.dataset) && sh.cssRules; } catch (e) { return false; } });
  }
  function cssChunk(text, x, y) {
    const c = el('div', 'pnk-css');
    c.textContent = text.replace(/\s+/g, ' ').slice(0, 46) + (text.length > 46 ? '…' : '');
    doc.body.appendChild(c);
    if (!c.animate) { c.remove(); return; }
    const dx = rand(-160, 160), r = rand(-50, 50);
    c.animate([{ transform: `translate(${x}px,${y}px) rotate(0)`, opacity: 1 }, { transform: `translate(${x + dx}px,${innerHeight + 80}px) rotate(${r}deg)`, opacity: 1 }],
      { duration: rand(1300, 2200), easing: 'cubic-bezier(.4,0,.9,.6)' }).onfinish = () => c.remove();
  }
  async function finale() {
    if (fin.on) return;
    fin.on = true;
    if (tool.on) toggleTool(false); if (tool.pl) togglePliers(false); if (tool.cur) useTool(null);
    flip(false); cancel(); forced = null; hide();
    root.classList.add('pnk-fin'); progress();
    const page = doc.querySelector('.page');
    snd('rach');
    if (page && page.animate) page.animate([{ transform: 'none' }, { transform: 'translate(-6px,3px) rotate(-.4deg)' }, { transform: 'translate(5px,-2px) rotate(.3deg)' }, { transform: 'none' }], { duration: 160, iterations: 4 });
    await new Promise(r => setTimeout(r, 750));
    // pravidla padají
    fin.sheets = siteSheets().map(sh => ({ sh, rules: [...sh.cssRules].map(r => r.cssText) }));
    const order = [];
    fin.sheets.forEach((s, si) => s.rules.forEach((_, ri) => order.push([si, ri])));
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const alive = fin.sheets.map(s => s.rules.map(() => true));
    const per = Math.max(1, Math.ceil(order.length / 40));
    for (let k = 0; k < order.length; k += per) {
      for (const [si, ri] of order.slice(k, k + per)) {
        const s = fin.sheets[si], idx = alive[si].slice(0, ri).filter(Boolean).length;
        try { s.sh.deleteRule(idx); } catch (e) { /* nevadí */ }
        alive[si][ri] = false;
        if (Math.random() < .7) cssChunk(s.rules[ri], rand(20, innerWidth - 260), rand(-20, innerHeight * .4));
      }
      if (k % (per * 4) === 0) snd('krok');
      await new Promise(r => setTimeout(r, 55));
    }
    for (const s of fin.sheets) while (s.sh.cssRules.length) try { s.sh.deleteRule(0); } catch (e) { break; }
    snd('bum');
    remeasureAll();
    await new Promise(r => setTimeout(r, 1600));
    run('dress', dress);
  }
  function remeasureAll() { fitLayer(); measure(); rebuildCablesSoon(); }
  // Vrací pravidla v původním pořadí: prvních k pravidel každého listu.
  function dressTo(frac) {
    for (const s of fin.sheets || []) {
      const want = Math.round(s.rules.length * frac);
      while (s.sh.cssRules.length < want) { try { s.sh.insertRule(s.rules[s.sh.cssRules.length], s.sh.cssRules.length); } catch (e) { s.rules.splice(s.sh.cssRules.length, 1); } }
    }
    remeasureAll();
  }
  async function dress(tk) {
    try {
      const f = visibleFloor() || floors()[0];
      if (!f) return;
      await climb(tk, f, clamp(scrollX + innerWidth * .35, f.x1 + HW, f.x2 - HW), 1);
      fig.pose = 'alarm'; puff('ups');
      await wait(tk, 1100);
      await lookAround(tk, 2, 450, 'alarm');
      fig.pose = 'think'; puff('hm…', true);
      await wait(tk, 1500);
      fig.pose = 'stand'; puff('!');
      await wait(tk, 400);
      const steps = 9;
      for (let i = 1; i <= steps; i++) {
        const ff = floors().find(v => Math.abs(v.y - fig.gy) < 3) || fig.floor;
        fig.floor = ff;
        fig.pose = 'bend';
        await wait(tk, 280);
        fig.pose = 'windup';
        await wait(tk, 300);
        fig.pose = 'throw'; puff(['hop', 'hop!', 'a ještě', 'hop', 'uf', 'hop!', 'skoro', 'hop', 'ták'][i - 1]);
        cssChunkUp(fig.cx - scrollX, fig.gy - scrollY - 14 * S);
        await wait(tk, 380);
        dressTo(i / steps);
        snd('cvak');
        // po přeskládání stránky stojí jinde: najde svou čáru znovu, nebo vyleze na nejbližší
        const nf = visibleFloor();
        if (nf && Math.abs(nf.y - fig.gy) > 4) { Object.assign(fig, { floor: nf, gy: nf.y, cx: clamp(fig.cx, nf.x1 + HW, nf.x2 - HW) }); rig.snap = true; }
        await wait(tk, 250);
      }
      root.classList.remove('pnk-fin'); remeasureAll();
      fixAll();
      fig.pose = 'proud'; puff('ta-dá!');
      await wait(tk, 1400);
      fig.pose = 'trophy'; puff('★');
      await wait(tk, 1000);
      await duck(tk);
    } finally {
      dressTo(1);
      fin.on = false; fin.armed = false; fin.done++;
      root.classList.remove('pnk-fin'); belt.classList.add('is-gold'); remeasureAll();
      save(); progress();
    }
  }
  function cssChunkUp(x, y) {
    const c = el('div', 'pnk-css is-up');
    c.textContent = ['{ display: grid }', 'font-family: Inter', '--accent: #006c86', 'border-top: 2px solid', 'gap: 48px', 'letter-spacing: -.085em', 'background: #fff', 'h1 { … }', 'margin: 0 auto'][Math.floor(rand(0, 9))];
    doc.body.appendChild(c);
    if (!c.animate) { c.remove(); return; }
    c.animate([{ transform: `translate(${x}px,${y}px) rotate(0)` }, { transform: `translate(${x + rand(-80, 80)}px,${-60}px) rotate(${rand(-30, 30)}deg)` }],
      { duration: 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
  }
  // Všechno zpátky do původního stavu.
  function fixAll() {
    for (const id of world.removed.slice()) restorePin(world.pinById[id]);
    for (const t of doc.querySelectorAll('.index-tags .tag.pnk-hole, .index-tags .tag.pnk-half')) restoreTag(t);
    for (const h of holes.slice()) removeHole(h.el);
    sec.h2 = 0; sec.cut = []; sec.off = []; applySec();
    fixH1(); fixMM(); fixLead();
    fig.novisor = false;
    measureMap();
    save();
  }

  // ---------- páječka: vrací věci na místo ----------
  function closeWorkshop() {
    world.open = false;
    if (world.dilna) { world.dilna.inert = true; world.dilna.setAttribute('aria-hidden', 'true'); world.dilna.classList.remove('is-open'); }
    if (world.svg) world.svg.style.pointerEvents = '';
  }
  function rebuildLines() {
    for (const L of world.lines) {
      const ps = L.def.at.map(a => world.pinById[a[2]]).filter(Boolean);
      if (!ps.some(p => p.on)) { L.gone = true; L.rope = null; continue; }
      L.gone = false; L.rope = null;
      if (ps.every(p => p.on) && !world.swing) continue;
      L.rope = makeRope(L); settle(L.rope);
    }
    world.dirty = true;
  }
  function restorePin(pin) {
    if (!pin || pin.on || !world.ready) return false;
    if (world.gone || world.fall) {
      Object.assign(world, { gone: false, fall: null, swing: null, pivot: null });
      world.svg.style.display = ''; world.cv.style.display = '';
      world.box = mapBox(); for (const q of world.pins) [q.px, q.py] = toPage(q.x, q.y);
    }
    pin.on = true; pin.el.classList.remove('is-off');
    world.rewire = world.rewire.filter(([l, , id]) => id !== pin.id && !world.lines[l].def.at.some(a => a[2] === pin.id));
    setTimeout(claims, 0);
    world.removed = world.removed.filter(i => i !== pin.id);
    const k = pebbles.findIndex(p => p.id === pin.id);
    if (k >= 0) { const p = pebbles[k]; if (fig.pebble === p) fig.pebble = null; p.el.remove(); pebbles.splice(k, 1); }
    const on = world.pins.filter(p => p.on);
    if (on.length === 1) { world.swing = null; startSwing(pin, false); }
    else { if (world.swing) { world.swing = null; world.pivot = null; world.jolt.v += 40; } closeWorkshop(); }
    rebuildLines(); mapTransform(); save(); hint(); kick();
    return true;
  }
  function restoreTag(t) {
    if (t && t.classList.contains('pnk-half')) { delete pl.half[t.textContent.trim()]; unhalf(t); save(); hint(); return true; }
    if (!t || !t.classList.contains('pnk-hole')) return false;
    const name = t.getAttribute('aria-label') || '';
    t.textContent = name; t.classList.remove('pnk-hole'); t.style.width = ''; t.removeAttribute('aria-label');
    pl.cuts = pl.cuts.filter(n => n !== name);
    for (const o of pl.fallen.filter(v => v.name === name)) o.el.remove();
    pl.fallen = pl.fallen.filter(v => v.name !== name);
    save(); hint();
    return true;
  }
  function ironAt(e) {
    const t = e.target;
    const h = t.closest('.pnk-hole2');
    if (h) { removeHole(h); return true; }
    if (t.closest('.pnk-h1') && fixH1()) return true;
    if (t.closest('.nav') && fixMM()) return true;
    if (t.closest('.hero .lead') && fixLead()) return true;
    if (restoreTag(t.closest('.index-tags .tag.pnk-hole, .index-tags .tag.pnk-half'))) return true;
    if (secIron(t)) return true;
    const b = world.box;
    if (!world.ready || !b) return false;
    const X = e.clientX + scrollX, Y = e.clientY + scrollY;
    if (X < b.l || X > b.l + b.w || Y < b.t || Y > b.t + b.h) return false;
    let best = null, bd = world.gone ? 1e9 : 26;
    for (const p of world.pins) { if (p.on) continue; const d = Math.hypot(p.px - X, p.py - Y); if (d < bd) { bd = d; best = p; } }
    return restorePin(best);
  }

  // ---------- vrtačka: díry do stránky ----------
  // Díra si pamatuje polohu jako podíl šířky stránky (fx). Při načtení se fx převezme přímo,
  // nepřepočítává se přes šířku, která může být v tu chvíli nulová (náhled se načítá skrytý).
  // Vodorovná poloha díry se počítá vůči obsahu stránky (.page), ne vůči šířce dokumentu,
  // kterou může nafouknout cokoli, co přečnívá.
  function pageSpan() {
    const e = doc.querySelector('.page') || doc.body, r = e.getBoundingClientRect();
    return r.width > 0 ? { l: r.left + scrollX, w: r.width } : null;
  }
  function addHole(x, y, live, fx) {
    if (holes.length >= 12) { if (live) puffAt(x, y - 30, 'dost'); return; }
    const e = el('div', 'pnk-hole2');
    e.innerHTML = '<i></i><b></b>';
    e.querySelector('b').textContent = NOTES[holes.length % NOTES.length][0];
    layer.appendChild(e);
    const sp = pageSpan();
    holes.push({ el: e, fx: fx != null ? fx : sp ? (x - sp.l) / sp.w : .5, y });
    placeExtra();
    if (live) { lastBreak = performance.now(); snd('lup'); puffAt(x, y - 34, 'lup!'); save(); }
    progress();
  }
  function removeHole(e) {
    holes = holes.filter(h => h.el !== e); e.remove(); save(); progress();
  }
  function drillStart(e) {
    const x = e.clientX + scrollX, y = e.clientY + scrollY, m = el('div', 'pnk-bit');
    m.style.transform = `translate3d(${x - 27}px,${y - 27}px,0)`;
    layer.appendChild(m);
    drilling = { id: e.pointerId, cx: e.clientX, cy: e.clientY, m, timer: setTimeout(() => { drillEnd(); addHole(x, y, true); }, 700) };
    drillSnd(true);
  }
  function drillEnd() {
    if (!drilling) return;
    clearTimeout(drilling.timer); drilling.m.remove(); drilling = null; drillSnd(false);
  }
  function placeExtra() {
    const sp = pageSpan();
    if (sp) for (const h of holes) h.el.style.transform = `translate3d(${(sp.l + h.fx * sp.w - 27).toFixed(1)}px,${h.y - 27}px,0)`;
    for (const it of Object.values(items)) {
      if (it.state !== 'ground') continue;
      const f = floorByKey(it.fk);
      if (f) { it.x = f.x1 + it.fr * (f.x2 - f.x1); it.y = f.y - it.h / 2; }
    }
    if (rub) renderItems();
    buildCables();
    placeLetters();
    placeMM();
    placeWords();
    placePockets();
  }

  // ---------- baterka a rub ----------
  function rubLight() {
    if (!rub) return;
    const lit = tool.cur === 'torch', n = rub.querySelector('.pnk-rub-notes'), r = n.getBoundingClientRect();
    rub.classList.toggle('has-light', lit);
    n.style.setProperty('--r', lit ? (innerWidth < 700 ? 170 : 250) + 'px' : '0px');
    n.style.setProperty('--mx', (ptr.x - r.left) + 'px'); n.style.setProperty('--my', (ptr.y - r.top) + 'px');
    rub.querySelector('.pnk-rub-glow').style.transform = `translate3d(${ptr.x}px,${ptr.y}px,0)`;
    rub.querySelector('.pnk-rub-dark').textContent = items.torch.state === 'belt' ? 'Je tu tma. Vezmi si z opasku baterku.' : 'Je tu tma. Chce to baterku.';
  }
  // ---------- otočení na rub ----------
  // Líc a rub jsou dvě strany jedné tuhé desky z překližky. Deska se otáčí kolem svislé osy
  // uprostřed okna: pravý okraj se zvedá k divákovi, do 90° je vidět líc, pak rub. Natočená bokem
  // ukáže hranu s vrstvami dýhy. Otáčí se tahem za roh (na líci vpravo, na rubu vlevo, protože
  // uchopený okraj se otočením přesune) nebo kliknutím. Hotový rub je obyčejný obsah stránky.
  const turn = { a: 0, side: 0, busy: false, drag: null, dragged: false, anim: 0, front: 0, back: 0, shadeF: null, shadeB: null, ply: null };
  const PLY = 18, PERSP = 1700;
  function turnBegin() {
    if (turn.busy) return;
    const page = doc.querySelector('.page');
    if (turn.side) {                           // z rubu: líc se vrátí tam, kde zůstal
      turn.back = scrollY;
      page.style.display = ''; layer.style.visibility = '';
      rub.classList.remove('is-on');
      rub.firstElementChild.nextElementSibling.style.transform = `translateY(${-turn.back}px)`;
      scrollTo({ top: turn.front, behavior: 'instant' });
      remeasureAll();
    } else {
      turn.front = scrollY;
      cancel(); forced = null; hide();
      rub.firstElementChild.nextElementSibling.style.transform = `translateY(${-turn.back}px)`;
    }
    const cs = getComputedStyle(doc.body);
    Object.assign(page.style, { backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize });
    turn.busy = true;
    root.classList.add('pnk-turning'); rub.classList.add('is-turning');
    underStart(turn.side);
    snd('flip');
    setTurn(turn.side ? 180 : 0);
  }
  function setTurn(a) {
    turn.a = a = clamp(a, 0, 180);
    under.a = a;
    const page = doc.querySelector('.page'), W = innerWidth, H = innerHeight, y0 = scrollY, h = PLY / 2;
    // deska se přisouvá k divákovi: vzdálený okraj zůstává v rovině stránky, přilehlý se zvedá a roste
    const lift = W / 2 * Math.sin(rad(a)), P = Math.max(PERSP, W * 2.2);
    const base = `perspective(${P.toFixed(0)}px) translateZ(${(lift - h).toFixed(1)}px) rotateY(${(-a).toFixed(2)}deg)`;
    for (const e of [page, layer]) Object.assign(e.style, { transformOrigin: `${W / 2}px ${y0 + H / 2}px`, transform: `${base} translateZ(${h}px)`,
      clipPath: `inset(${y0}px 0 ${Math.max(0, e.offsetHeight - y0 - H)}px 0)`, backfaceVisibility: 'hidden', webkitBackfaceVisibility: 'hidden' });
    Object.assign(turn.shadeF.style, { top: y0 + 'px', height: H + 'px' });
    Object.assign(rub.style, { transformOrigin: '50% 50%', transform: `${base} translateZ(${-h}px) rotateY(180deg)` });
    turn.ply.style.visibility = a > 6 && a < 174 ? 'visible' : 'hidden';
    Object.assign(turn.ply.style, { width: PLY + 'px', marginLeft: -h + 'px', transform: `${base} translateX(${W / 2}px) rotateY(90deg)`, filter: `brightness(${(.75 + .35 * Math.abs(Math.sin(rad(a)))).toFixed(3)})` });
    const sh = (1 - Math.abs(Math.cos(rad(a)))) * .6;
    turn.shadeF.style.opacity = sh.toFixed(3); turn.shadeB.style.opacity = sh.toFixed(3);
  }
  function turnFinish(side) {
    const page = doc.querySelector('.page');
    turn.busy = false; turn.side = side;
    root.classList.remove('pnk-turning'); rub.classList.remove('is-turning');
    for (const e of [page, layer]) Object.assign(e.style, { transform: '', transformOrigin: '', clipPath: '', backfaceVisibility: '', webkitBackfaceVisibility: '' });
    Object.assign(page.style, { backgroundColor: '', backgroundImage: '', backgroundSize: '' });
    rub.style.transform = ''; rub.style.transformOrigin = '';
    rub.firstElementChild.nextElementSibling.style.transform = '';
    corner.classList.toggle('is-back', !!side);
    corner.setAttribute('aria-label', side ? 'Otočit web zpátky na líc' : 'Otočit web na rub');
    rub.inert = !side;
    if (side) {
      rub.removeAttribute('aria-hidden'); rub.classList.add('is-on');
      page.style.display = 'none'; layer.style.visibility = 'hidden';
      scrollTo({ top: turn.back, behavior: 'instant' });
    } else {
      rub.setAttribute('aria-hidden', 'true');
      applyMM();
      remeasureAll();
    }
    snd('tuk'); rubLight(); underStop();
  }
  function turnTo(side, from) {
    cancelAnimationFrame(turn.anim);
    if (!turn.busy) { if (turn.side === side) return; turnBegin(); }
    const a0 = from != null ? from : turn.a, a1 = side ? 180 : 0, ms = 120 + Math.abs(a1 - a0) / 180 * 680;
    // když pod deskou někdo je, deska se bokem na chvíli zarazí, aby byl vidět úprk
    const cross = (a0 - 90) * (a1 - 90) < 0 && underAlive(), hold = cross ? 300 : 0;
    const m1 = cross ? ms * Math.abs(90 - a0) / Math.abs(a1 - a0) : ms, m2 = ms - m1;
    const t0 = performance.now();
    const step = now => {
      const t = now - t0;
      let a, done = false;
      if (!cross) { const p = Math.min(1, t / ms); a = a0 + (a1 - a0) * ease.io(p); done = p >= 1; }
      else if (t < m1) a = a0 + (90 - a0) * ease.io(t / m1);
      else if (t < m1 + hold) a = 90;
      else { const p = Math.min(1, (t - m1 - hold) / m2); a = 90 + (a1 - 90) * ease.io(p); done = p >= 1; }
      setTurn(a);
      if (!done) turn.anim = requestAnimationFrame(step); else turnFinish(side);
    };
    turn.anim = requestAnimationFrame(step);
  }
  function flip(on) { if (rub) turnTo(on ? 1 : 0); }

  // ---------- pod deskou ----------
  // Pod deskou žije kolonie drobných panáčků, kteří web drží zespodu: podpírají desku, tahají kabely,
  // nosí písmena a kartičky se styly, suší prádlo. Když se deska zvedne, ztuhnou, pak se rozutečou
  // ke krajům okna (od světla). Kdo desku drží bokem, uvidí je vykukovat. Když deska klesá, vrhnou se
  // pod ni. Při dalších otočeních jich je míň, pak tam je jen cedule a nakonec vzkaz, že se odstěhovali.
  // Uprostřed sedí s hrnkem hlavní panáček; ten neutíká.
  const UNDER_N = [34, 24, 15, 8, 4, 0];
  const under = { cv: null, g: null, raf: 0, last: 0, a: 0, visits: 0, kids: [], exposed: false, light: 1, t: 0, fled: -1e9, floor: null, items: [], w: 0, h: 0 };
  const underAlive = () => under.kids.some(k => k.st !== 'gone');
  function underStart(fromBack) {
    if (CALM) return;
    if (!under.cv) {
      under.cv = canvas(1, 1); under.cv.className = 'pnk-under'; under.g = under.cv.getContext('2d');
      doc.body.prepend(under.cv);
    }
    const W = innerWidth, H = innerHeight;
    if (under.w !== W || under.h !== H) {
      under.w = W; under.h = H;
      under.cv.width = Math.round(W * DPR); under.cv.height = Math.round(H * DPR);
      under.cv.style.width = W + 'px'; under.cv.style.height = H + 'px';
      under.floor = null;
    }
    under.light = fromBack ? -1 : 1;              // světlo přichází z té strany, kde se deska zvedá
    const now = performance.now();
    if (!under.kids.some(k => k.st !== 'gone') && now - under.fled > 2500) populate();
    under.exposed = false; under.peak = 0;
    under.cv.style.display = 'block';
    under.last = now;
    cancelAnimationFrame(under.raf);
    under.raf = requestAnimationFrame(underLoop);
  }
  function underStop() {
    cancelAnimationFrame(under.raf); under.raf = 0;
    if (under.cv) under.cv.style.display = 'none';
    for (const k of under.kids) if (k.st === 'dive' || k.st === 'peek') k.st = 'gone';
  }
  function populate() {
    under.vi = Math.min(under.visits, UNDER_N.length - 1);
    const W = under.w, H = under.h, n = UNDER_N[under.vi];
    const sc = W < 700 ? 1.45 : 2;
    under.kids = [];
    under.items = [];
    const role = i => (i < Math.ceil(n * .4) ? 'hold' : i < Math.ceil(n * .6) ? 'pull' : i < n - 2 ? 'carry' : i === n - 1 ? 'sleep' : 'wash');
    for (let i = 0; i < n; i++) {
      const r = role(i);
      const k = { r, st: 'work', x: rand(W * .08, W * .92), y: rand(H * .18, H * .95), dir: Math.random() < .5 ? -1 : 1, ph: rand(0, TAU), s: sc * rand(.9, 1.1),
        vx: 0, vy: 0, tf: 0, sp: rand(190, 320), item: r === 'carry' ? (Math.random() < .5 ? 'card' : 'letter') : null, ch: 'MARTINMALÝ'[Math.floor(rand(0, 10))] };
      if (r === 'hold') { const c = Math.ceil(n * .4), j = i % c; k.x = W * (.12 + .76 * (j + .5) / c) + rand(-20, 20); k.y = H * (j % 2 ? .45 : .82) + rand(-30, 30); }
      if (r === 'wash') { k.x = W * .1 + rand(-10, 30); k.y = H * .3; }
      if (r === 'sleep') { k.x = W * rand(.65, .85); k.y = H * rand(.6, .9); }
      k.hx = k.x; k.hy = k.y;
      under.kids.push(k);
    }
  }
  // Podlaha: prach, škrábance, stopy po deskách, šňůra s prádlem, cedule nebo vzkaz.
  function drawFloor() {
    const W = under.w, H = under.h, c = canvas(Math.round(W * DPR), Math.round(H * DPR)), g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = '#2b2720'; g.fillRect(0, 0, W, H);
    const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(91);
    for (let i = 0; i < W * H / 260; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,240,210' : '0,0,0'},${(rnd() * .08).toFixed(3)})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    g.strokeStyle = 'rgba(255,240,210,.05)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, l = 20 + rnd() * 90, a = rnd() * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i < 7; i++) g.fillRect(0, (i + .5) * H / 7, W, 2);      // spáry mezi prkny podlahy
    g.font = '700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'; g.fillStyle = 'rgba(233,227,208,.22)';
    g.fillText('SEM NEŠLAPAT', W * .62, H * .14);
    g.fillText('→ k rubu', W * .08, H * .97);
    return c;
  }
  function mini(g, k, t) {
    const s = k.s, ph = k.ph + t * (k.st === 'run' || k.st === 'dive' ? .024 : .006);
    g.save(); g.translate(k.x, k.y); g.scale(k.dir * s, s);
    g.strokeStyle = '#e9e3d0'; g.fillStyle = '#e9e3d0'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 1.25;
    const L = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
    let lean = 0, hand = [[3, -7], [-3, -7]], foot = [[1.6, 0], [-1.6, 0]], eye = 'dot', bob = 0;
    const st = k.st, r = k.r;
    if (st === 'run' || st === 'dive') {
      lean = 2.2; bob = Math.abs(Math.sin(ph)) * .8;
      foot = [[Math.sin(ph) * 3.2, -Math.max(0, Math.cos(ph)) * 1.6], [-Math.sin(ph) * 3.2, -Math.max(0, -Math.cos(ph)) * 1.6]];
      hand = [[2 - Math.sin(ph) * 3, -7.5], [2 + Math.sin(ph) * 3, -7.5]]; eye = 'wide';
    } else if (st === 'freeze') { hand = [[3.8, -10.5], [-3.8, -10.5]]; foot = [[2.2, 0], [-2.2, 0]]; eye = 'wide'; }
    else if (r === 'sleep' && st === 'work') {           // spí na zádech
      g.rotate(-Math.PI / 2 * k.dir); g.translate(-4, -2);
      eye = 'shut';
    } else if (r === 'hold') { const w = Math.sin(t * .004 + k.ph) * .4; hand = [[1.8, -16 + w], [-1.8, -16 - w]]; foot = [[2.4, 0], [-2.4, 0]]; eye = 'effort'; bob = -.3; }
    else if (r === 'pull') { lean = -2; hand = [[4.6, -8.2], [3.8, -7.6]]; foot = [[-2.6, 0], [1.8, 0]]; eye = 'effort'; }
    else if (r === 'carry') { lean = .6; bob = Math.abs(Math.sin(ph * 2)) * .4; hand = [[1.2, -15], [-1, -15]]; foot = [[Math.sin(ph) * 2.2, 0], [-Math.sin(ph) * 2.2, 0]]; }
    else if (r === 'wash') { hand = [[2.4, -14 + Math.sin(t * .006 + k.ph)], [-1.8, -7]]; }
    const hip = [lean * .3, -6 - bob], neck = [lean, -11 - bob], head = [lean * 1.15, -13.6 - bob];
    for (const f of foot) L(hip[0], hip[1], f[0], f[1]);
    L(hip[0], hip[1], neck[0], neck[1]);
    for (const hd of hand) L(neck[0], neck[1] + .6, hd[0], hd[1]);
    g.fillStyle = '#2b2720'; g.beginPath(); g.arc(head[0], head[1], 2.3, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#e9e3d0';
    if (eye === 'wide') { g.beginPath(); g.arc(head[0] + .9, head[1] - .2, .55, 0, TAU); g.fill(); }
    else if (eye === 'shut' || eye === 'effort') { L(head[0] + .3, head[1], head[0] + 1.5, head[1] - .1); }
    else { g.beginPath(); g.arc(head[0] + 1, head[1] - .1, .4, 0, TAU); g.fill(); }
    if (k.item && st !== 'run' && st !== 'dive') {         // co nese nad hlavou
      g.save(); g.translate((hand[0][0] + hand[1][0]) / 2, hand[0][1] - 2.2);
      if (k.item === 'card') { g.fillStyle = '#f2b705'; g.fillRect(-4, -2.4, 8, 4.2); g.strokeStyle = '#101317'; g.lineWidth = .6; g.strokeRect(-4, -2.4, 8, 4.2); }
      else { g.scale(k.dir, 1); g.fillStyle = '#e9e3d0'; g.font = '800 7px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(k.ch, 0, 2); }
      g.restore();
    }
    g.restore();
    if (st === 'freeze') { g.fillStyle = '#f2b705'; g.font = '800 11px ui-monospace,monospace'; g.fillText('!', k.x - 2, k.y - 24 * s); }
    if (r === 'sleep' && st === 'work') { g.fillStyle = 'rgba(233,227,208,.6)'; g.font = '700 9px ui-monospace,monospace'; g.fillText('z', k.x + 8, k.y - 14 - Math.sin(t * .003) * 3); }
  }
  // Panáček, který neutíká: sedí s hrnkem a mává.
  function boss(g, t) {
    const W = under.w, H = under.h, x = W * .3, y = H * .64, s = W < 700 ? 1.6 : 2.1;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#e9e3d0'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 1.5;
    const L = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
    L(0, -4, 4, -3.4); L(4, -3.4, 5.5, 0); L(0, -4, 3.4, -2.8); L(3.4, -2.8, 4.6, 0);     // nohy (sedí)
    L(0, -4, -.6, -9.5);
    const wave = under.exposed ? Math.sin(t * .012) * 1.6 : 0;
    L(-.6, -9, 3.2, -8); L(3.2, -8, 3.4, -10);                                          // ruka s hrnkem
    L(-.6, -9, -3 + wave * .3, -13 + wave);                                              // mává
    g.fillStyle = '#ece6d5'; g.fillRect(2.4, -11.4, 2.2, 2.2);
    g.fillStyle = '#2b2720'; g.beginPath(); g.arc(-.9, -12, 2.4, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = TEAL; g.beginPath(); g.arc(-.9, -12, 2.45, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.fill();
    g.fillStyle = '#e9e3d0'; g.beginPath(); g.arc(0, -11.8, .45, 0, TAU); g.fill();
    g.restore();
    if (under.exposed) { g.fillStyle = '#e9e3d0'; g.font = '800 12px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText(under.vi === UNDER_N.length - 1 ? 'zůstal jsem jen já' : 'ahoj', x, y - 36 * (s / 2.1)); g.textAlign = 'left'; }
  }
  function underLoop(now) {
    const dt = Math.min(48, now - under.last); under.last = now; under.t += dt;
    const W = under.w, H = under.h, g = under.g, a = under.a, open = Math.sin(rad(a));
    // odkrytí: poprvé, když se deska zvedne nad 20°
    if (!under.exposed && a > 20 && a < 160) {
      under.exposed = true; under.visits++; save();
      for (const k of under.kids) {
        const d = under.light > 0 ? (W - k.x) / W : k.x / W;
        k.tf = under.t + 120 + d * 380 + rand(0, 160) + (k.r === 'sleep' ? 1300 : 0);
        k.st = k.r === 'sleep' ? 'work' : 'freeze';
      }
      if (under.kids.length) snd('chi');
    }
    under.peak = Math.max(under.peak || 0, open);
    const closing = under.exposed && under.peak > .75 && open < .55;   // deska už byla nahoře a zase klesá
    for (const k of under.kids) {
      if (k.st === 'gone') continue;
      if ((k.st === 'freeze' || (k.r === 'sleep' && k.st === 'work')) && under.exposed && under.t > k.tf) {
        k.st = 'run';
        const ex = under.light > 0 ? -40 : W + 40, ey = k.y < H / 2 ? -40 : H + 40;   // od světla, nebo nejkratší cestou ven
        const tx = Math.abs(k.x - ex) < Math.abs(k.y - ey) * 1.6 ? ex : k.x + rand(-80, 80), ty = tx === ex ? k.y + rand(-60, 60) : ey;
        const d = Math.hypot(tx - k.x, ty - k.y) || 1;
        k.vx = (tx - k.x) / d * k.sp; k.vy = (ty - k.y) / d * k.sp; k.dir = k.vx >= 0 ? 1 : -1;
        if (k.item) { under.items.push({ x: k.x, y: k.y, item: k.item, ch: k.ch, a: rand(-.6, .6) }); k.item = null; }
      }
      if (k.st === 'run' || k.st === 'dive') {
        k.x += k.vx * dt / 1000; k.y += k.vy * dt / 1000;
        if (k.st === 'run' && (k.x < -30 || k.x > W + 30 || k.y < -30 || k.y > H + 40)) { k.st = 'gone'; under.fled = performance.now(); k.gt = under.t; }
        if (k.st === 'dive' && Math.hypot(k.x - k.hx, k.y - k.hy) < 20) k.st = 'gone';
      }
    }
    // podržená deska: po chvíli někteří opatrně vykukují od krajů
    if (under.exposed && !closing && under.kids.length && under.kids.every(k => k.st === 'gone' || k.st === 'peek')) {
      const quiet = under.kids.filter(k => k.st === 'gone' && under.t - (k.gt || 0) > 1600);
      if (quiet.length && under.kids.filter(k => k.st === 'peek').length < 5 && Math.random() < dt / 700) {
        const k = quiet[Math.floor(rand(0, quiet.length))], side = Math.floor(rand(0, 3));
        Object.assign(k, { st: 'peek', pe: side, x: side === 0 ? 6 : side === 1 ? W - 6 : rand(W * .1, W * .9), y: side === 2 ? H - 2 : rand(H * .2, H * .9), dir: side === 1 ? -1 : 1 });
      }
    }
    // deska klesá: kdo je venku, vrhne se zpátky pod ni
    if (closing) for (const k of under.kids) if (k.st === 'peek' || k.st === 'run' || k.st === 'freeze') {
      k.st = 'dive';
      const d = Math.hypot(k.hx - k.x, k.hy - k.y) || 1;
      k.vx = (k.hx - k.x) / d * 700; k.vy = (k.hy - k.y) / d * 700; k.dir = k.vx >= 0 ? 1 : -1;
    }
    // kreslení
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!under.floor) under.floor = drawFloor();
    g.drawImage(under.floor, 0, 0);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const v = under.vi || 0;
    if (v === UNDER_N.length - 2) {                // cedule
      g.save(); g.translate(W * .34, H * .5);
      g.fillStyle = '#8a5a2b'; g.fillRect(-2, -10, 4, 46);
      g.fillStyle = '#e9e3d0'; g.fillRect(-46, -34, 92, 28); g.strokeStyle = '#101317'; g.lineWidth = 2; g.strokeRect(-46, -34, 92, 28);
      g.fillStyle = '#c0392b'; g.font = '800 13px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText('NEZVEDAT!', 0, -15); g.restore();
    }
    if (v === UNDER_N.length - 1) {   // vzkaz
      const nw = Math.min(240, W * .44), ns = nw / 240;
      g.save(); g.translate(W * .25, H * .42); g.rotate(-.06); g.scale(ns, ns);
      g.fillStyle = '#f3ecd8'; g.fillRect(-120, -34, 240, 64); g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(-120, -34, 240, 64);
      g.fillStyle = '#2b2720'; g.font = '700 12px ui-monospace,monospace'; g.textAlign = 'center';
      g.fillText('Odstěhovali jsme se', 0, -10); g.fillText('kvůli hluku.', 0, 7); g.font = '600 10px ui-monospace,monospace'; g.fillText('Ti zespodu', 50, 24);
      g.restore();
    }
    if (v < UNDER_N.length - 1 || under.kids.length) {    // šňůra s prádlem v levém horním rohu
      g.strokeStyle = 'rgba(233,227,208,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(W * .03, H * .2); g.quadraticCurveTo(W * .13, H * .24, W * .23, H * .2); g.stroke();
      ['#c0392b', '#6cc7f5', '#f2b705', '#e9e3d0'].forEach((c, i) => { g.fillStyle = c; g.fillRect(W * (.06 + i * .045), H * .215 + Math.sin(i) * 2, 8, 10); });
    }
    for (const it of under.items) {
      g.save(); g.translate(it.x, it.y); g.rotate(it.a);
      if (it.item === 'card') { g.fillStyle = '#f2b705'; g.fillRect(-6, -4, 12, 7); }
      else { g.fillStyle = '#e9e3d0'; g.font = '800 11px Inter,system-ui,sans-serif'; g.fillText(it.ch, -4, 4); }
      g.restore();
    }
    boss(g, under.t);
    for (const k of under.kids) {
      if (k.st === 'gone') continue;
      if (k.st === 'peek') {                       // jen hlava zpoza kraje okna
        g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
        const s = k.s, px = k.pe === 0 ? -6 * s + 6 : k.pe === 1 ? W + 6 * s - 6 : k.x, py = k.pe === 2 ? H + 12 * s : k.y;
        g.translate(px, py); g.scale(k.dir * s, s);
        g.fillStyle = '#2b2720'; g.strokeStyle = '#e9e3d0'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(k.pe === 2 ? 0 : 2, k.pe === 2 ? -11 : -13.6, 2.3, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#e9e3d0'; g.beginPath(); g.arc(k.pe === 2 ? .9 : 3, k.pe === 2 ? -11.2 : -13.8, .5, 0, TAU); g.fill();
        g.restore();
        continue;
      }
      mini(g, k, under.t);
    }
    // světlo z té strany, kde se deska zvedla; zbytek je ještě ve stínu
    const lg = g.createLinearGradient(under.light > 0 ? W : 0, 0, under.light > 0 ? 0 : W, 0);
    lg.addColorStop(0, `rgba(0,0,0,${(.55 - .5 * open).toFixed(3)})`); lg.addColorStop(1, `rgba(0,0,0,${(.85 - .45 * open).toFixed(3)})`);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    under.raf = requestAnimationFrame(underLoop);
  }
  function turnStart(e) {
    if (e.button > 0 || turn.drag) return;
    cancelAnimationFrame(turn.anim);
    turn.drag = { id: e.pointerId, x0: e.clientX, from: turn.side, moved: false };
    turn.dragged = false;
    try { corner.setPointerCapture(e.pointerId); } catch (er) { /* nevadí */ }
  }
  function turnMove(e) {
    const D = turn.drag;
    if (!D || e.pointerId !== D.id) return;
    const dx = e.clientX - D.x0;
    if (!D.moved && Math.abs(dx) < 6) return;
    if (!D.moved) { D.moved = true; if (!turn.busy) turnBegin(); }
    const k = Math.abs(dx) / (innerWidth * .7) * 180;
    setTurn(D.from ? 180 - (dx > 0 ? k : 0) : (dx < 0 ? k : 0));
  }
  function turnEnd(e) {
    const D = turn.drag;
    if (!D || e.pointerId !== D.id) return;
    turn.drag = null;
    if (!D.moved) return;                      // kliknutí obslouží click
    turn.dragged = true;
    turnTo(turn.a > 90 ? 1 : 0);
  }
  function torchMove() {
    if (tool.cur !== 'torch') return;
    const X = ptr.x + scrollX, Y = ptr.y + scrollY, w = root.scrollWidth;
    const sp = pageSpan();
    if (sp) for (const h of holes) h.el.classList.toggle('is-lit', Math.hypot(sp.l + h.fx * sp.w - X, h.y - Y) < 120);
    if (rub.classList.contains('is-on')) rubLight();
  }

  // ---------- výstupy: opravy, baterka, spaní ----------
  // Panáček s kladivem vrací, co návštěvník rozebral. Nejdřív štítky, potom spoje.
  async function repair(tk) {
    st.repairs++;
    const idx = doc.querySelector('.index'), fI = idx && floorOf(idx);
    const hole = fI && visibleY(fI.y) ? doc.querySelector('.index-tags .tag.pnk-hole, .index-tags .tag.pnk-half') : null;
    if (!hole && sec.off.length && (await replug(tk))) return;
    const sb = hole ? null : secBroken();
    if (sb) {
      await climb(tk, sb.f, clamp(sb.x - 22 * S, sb.f.x1 + HW, sb.f.x2 - HW), 1);
      fig.tool = 'hammer';
      await go(tk, sb.x, { speed: 26 * S });
      fig.dir = 1; fig.pose = 'hammer';
      for (let i = 0; i < 3; i++) { await wait(tk, 250); puffAt(fig.cx + 3 * S, sb.f.y + 2, 'bum'); }
      sb.fix();
      fig.pose = 'proud'; puff('tak');
      await wait(tk, 800);
      fig.tool = null;
      await duck(tk);
      return;
    }
    if (hole) {
      const r = hole.getBoundingClientRect(), x = clamp(r.left + scrollX + r.width / 2, fI.x1 + HW, fI.x2 - HW);
      await climb(tk, fI, clamp(x - 24 * S, fI.x1 + HW, fI.x2 - HW), 1);
      fig.tool = 'hammer';
      await go(tk, clamp(x - 3 * S, fI.x1 + HW / 2, fI.x2 - HW / 2), { speed: 26 * S });
      fig.dir = 1; fig.pose = 'scratch'; puff('hm');
      await wait(tk, 900);
      if (!hole.classList.contains('pnk-hole') && !hole.classList.contains('pnk-half')) { fig.tool = null; return puzzled(tk); }
      const o = pl.fallen.find(v => v.name === hole.getAttribute('aria-label'));
      if (o) {
        const m = new DOMMatrixReadOnly(getComputedStyle(o.el).transform), x1 = r.left + scrollX, y1 = r.top + scrollY;
        tween(FREE, 380, v => { o.el.style.transform = `translate3d(${(m.m41 + (x1 - m.m41) * v).toFixed(1)}px,${(m.m42 + (y1 - m.m42) * v - Math.sin(v * Math.PI) * 30).toFixed(1)}px,0)`; });
        fig.pose = 'throw';
        await wait(tk, 400);
      }
      restoreTag(hole);
      fig.pose = 'hammer';
      for (let i = 0; i < 3; i++) { await wait(tk, 250); puffAt(x + 3 * S, fI.y + 2, 'bum'); }
      await wait(tk, 250);
    } else {
      const pf = pileFloor(), pin = world.pinById[world.removed[world.removed.length - 1]];
      if (!pf || !pin || world.gone || world.fall || !visibleY(pf.y)) return;
      const x = clamp(pin.px, pf.x1 + HW, pf.x2 - HW);
      await climb(tk, pf, clamp(x - 20 * S, pf.x1 + HW, pf.x2 - HW), 1);
      fig.tool = 'hammer';
      await go(tk, x, { speed: 26 * S });
      fig.pose = 'lookup';
      await wait(tk, 600);
      const p = pebbles.find(v => v.id === pin.id);
      if (p && fig.pebble !== p) {
        const x0 = p.x, y0 = p.y;
        p.st = 'back';
        tween(FREE, 420, v => { p.x = x0 + (pin.px - x0) * v; p.y = y0 + (pin.py - y0) * v - Math.sin(v * Math.PI) * 30; p.a = v * 360; })
          .then(() => { if (restorePin(pin)) puffAt(pin.px, pin.py - 12, 'bum'); });
      } else if (restorePin(pin)) puffAt(pin.px, pin.py - 12, 'bum');
      fig.pose = 'throw';
      await wait(tk, 700);
    }
    fig.pose = 'proud'; puff('tak');
    await wait(tk, 800);
    fig.tool = null;
    await duck(tk);
  }
  // Chodí s rozsvícenou baterkou a zkoumá, co je to za díry. Pošimraný ji upustí.
  async function lamp(tk) {
    st.lamps++;
    const it = items.torch;
    let f;
    if (it.state === 'ground') {
      f = floorByKey(it.fk);
      if (!f || !visibleY(f.y)) { it.state = 'fig'; renderItems(); return; }
      await climb(tk, f, clamp(it.x - 26 * S, f.x1 + HW, f.x2 - HW), 1);
      await lookAround(tk, 2, 380, 'alarm');
      await go(tk, clamp(it.x - 3 * S, f.x1 + HW / 2, f.x2 - HW / 2), { speed: 22 * S, pose: 'sneak', until: () => it.state !== 'ground' });
      if (it.state !== 'ground') return puzzled(tk);
      fig.dir = 1; fig.pose = 'bend';
      await wait(tk, 400);
      if (it.state !== 'ground') return puzzled(tk);
    } else {
      f = visibleFloor();
      if (!f) return;
      const x0 = spotOn(f);
      await climb(tk, f, x0, x0 - scrollX < innerWidth / 2 ? 1 : -1);
    }
    it.state = 'fig'; it.vis = true; fig.pose = 'shine';
    await wait(tk, 700);
    for (let i = 0; i < 2; i++) {
      await go(tk, clamp(fig.cx + fig.dir * rand(26, 40) * S, f.x1 + HW, f.x2 - HW), { speed: 14 * S, pose: 'shine' });
      fig.pose = 'shine';
      await wait(tk, 800);
      fig.dir = -fig.dir;
      await wait(tk, 600);
    }
    it.vis = false;
    await duck(tk);
  }
  // V noci u vytaženého šroubováku usne. Kdo jde potichu, vezme mu ho bez šimrání.
  async function nap(tk, f) {
    st.napped = true;
    fig.pose = 'yawn'; puff('ááá');
    await wait(tk, 1300);
    Object.assign(sd, { state: 'ground', ang: ((sd.ang % 360) + 360) % 360, el: f.el, frac: (sd.gx - f.x1) / (f.x2 - f.x1) });
    showBelt();
    fig.pose = 'sleep'; setFlags(true, false);
    figEl.style.pointerEvents = 'none';        // spící nepřekáží kliknutí na šroubovák
    let t = 0, z = 1000;
    await task(tk, dt => {
      t += dt; z += dt;
      if (z > 1600) { z = 0; puff('z', true); }
      if (sd.state !== 'ground') return 'gone';
      const d = ptr.on ? Math.hypot(ptr.x - (fig.cx - scrollX), ptr.y - (fig.gy - scrollY - 4 * S)) : 1e9;
      if (d < 45 * S && ptr.v > .8 && performance.now() - ptr.ts < 150) return 'noise';
      if (t > 30000) return 'time';
      if (fig.dazzle > 1.2) return 'light';      // posvítil mu do očí
    });
    figEl.style.pointerEvents = '';
    fig.pose = 'alarm'; puff('!');
    await wait(tk, 600);
    if (sd.state !== 'ground') { await puzzled(tk); return false; }
    sd.state = 'air'; setFlags(true, true);
    return true;
  }

  // ---------- zapojení ----------
  // Co se mezi návštěvami stihlo opravit: jedna věc za dvě hodiny.
  function offlineRepair(saved) {
    let n = saved.ts ? Math.floor((Date.now() - saved.ts) / 72e5) : 0;
    while (n-- > 0) {
      if (saved.cuts && saved.cuts.length) saved.cuts.pop();
      else if (saved.pins && saved.pins.length && saved.pins.length < 14) { const id = saved.pins.pop(); saved.peb = (saved.peb || []).filter(p => p.id !== id); }
      else break;
    }
  }
  function extraSave() {
    const tools = Object.values(items).filter(it => it.state === 'belt').map(it => it.id);
    progress();
    const h1s = h1.el ? { s: h1.slots.map(s => s.cur), f: h1.fallen.filter(L => L.fk && L.st !== 'gone').map(L => [L.ch, L.fk, +L.fr.toFixed(4), Math.round(L.a)]) } : undefined;
    return { ub: under.visits, done: fin.done, lead: leadSave(), mm: mmSave(), h1: h1s, visor: fig.novisor ? 0 : 1, more: tools, holes: holes.map(h => [+h.fx.toFixed(4), Math.round(h.y), 2]), mute: audio.mute, sec: { h2: sec.h2, verbs: sec.verbs, open: sec.open, cut: sec.cut, off: sec.off }, ts: Date.now() };
  }
  function onCut(f, x, y) {
    lastBreak = performance.now();
    if (f && pl.cuts.length >= 3 && items.drill.state === 'hidden') landItem(items.drill, f, x, y);
  }
  function initExtra(saved) {
    setMute(!!saved.mute); fig.novisor = saved.visor === 0; fin.done = saved.done || 0; under.visits = saved.ub || 0;
    if (fin.done) belt.classList.add('is-gold');
    for (const n of saved.more || []) if (items[n]) { items[n].state = 'belt'; fillItem(items[n]); }
    const w = root.scrollWidth;
    for (const [fx, y, v] of saved.holes || []) {
      if (!Number.isFinite(fx) || !Number.isFinite(y)) continue;          // poškozené záznamy zahodit
      if (v === 2) addHole(0, y, false, fx);
      else addHole(fx * (root.clientWidth || innerWidth) + scrollX, y, false);   // starý formát: podíl šířky okna
    }
    // vrtačka, která vypadla a nikdo ji nesebral, leží pod štítky dál
    if (pl.cuts.length >= 3 && items.drill.state === 'hidden') {
      const idx = doc.querySelector('.index'), f = idx && floors().find(v => v.y > idx.getBoundingClientRect().bottom + scrollY + 4);
      if (f) Object.assign(items.drill, { state: 'ground', x: f.x1 + 80, y: f.y - items.drill.h / 2, fk: floorKey(f.el), fr: 80 / (f.x2 - f.x1) });
    }
    buildSec(saved.sec);
    buildH1(saved.h1);
    buildMM(saved.mm);
    buildLead(saved.lead);
    progress(); renderItems();

    addEventListener('pointerdown', e => {
      unlock();
      if (!tool.cur || e.button > 0 || !e.target.closest || e.target.closest('.pnk-belt,.pnk-corner,.pnk-rub,.pnk-it,.pnk-pl,.pnk-sd')) return;
      if (tool.cur === 'iron') { if (ironAt(e)) { swallow = performance.now(); e.preventDefault(); e.stopImmediatePropagation(); puffAt(e.clientX + scrollX, e.clientY + scrollY - 20, 'pšš'); } }
      else if (tool.cur === 'drill') { e.preventDefault(); e.stopImmediatePropagation(); drillStart(e); }
    }, { capture: true });
    addEventListener('click', e => {
      // kliknutí, které patřilo nástroji, nesmí ještě otevřít odkaz pod ním
      const mine = (swallow && performance.now() - swallow < 8000) || (tool.cur === 'drill' && e.target.closest && !e.target.closest('.pnk-belt,.pnk-corner,.pnk-rub,.pnk-it,.pnk-pl,.pnk-sd'));
      if (mine) { swallow = 0; e.preventDefault(); e.stopImmediatePropagation(); }
    }, { capture: true });
    addEventListener('pointermove', e => {
      const now = performance.now(), d = Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y);
      if (e.pointerType === 'mouse' && ptr.ts) ptr.v = (ptr.v || 0) * .6 + d / Math.max(1, now - ptr.ts) * .4;
      ptr.ts = now;
      if (drilling && e.pointerId === drilling.id && Math.hypot(e.clientX - drilling.cx, e.clientY - drilling.cy) > 14) drillEnd();
      if (tool.cur === 'torch') requestAnimationFrame(torchMove);
    }, { capture: true, passive: true });
    const up = () => { unlock(); drillEnd(); };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    addEventListener('scroll', () => { if (tool.cur === 'torch') torchMove(); }, { passive: true });
    addEventListener('keydown', e => {
      unlock();
      if (e.key === 'Escape') { if (tool.cur) useTool(null); flip(false); return; }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      typed = (typed + e.key.toLowerCase()).slice(-7);
      if (typed === 'panacek') {                 // tajné slovo: panáček přijde hned
        typed = ''; lastBreak = -1e9;
        t0 = lastEnd = lastActivity = -1e9;
        Object.assign(st, { rounds: 0, longs: 0, fetches: 0, lamps: 0, repairs: 0 });
      }
    });
  }

  // ---------- sekce Směr, Dělám, Odkazy ----------
  // Směr: nadpis visí na dvou šroubech; pět sloves ve větě se zapíná nástrojem, který k nim patří.
  // Dělám: řádky jsou šuplíky (šroubovák je vypáčí), linku pod řádkem jde přeštípnout kleštěmi.
  // Odkazy: každý odkaz má zástrčku; šroubovák ji vypáčí, páječka nebo panáček zapojí zpět.
  const sec = { h2: 0, verbs: [], open: [], cut: [], off: [] };
  const VERBS = [['spustit', 'drill'], ['použít', 'pl'], ['rozebrat', 'sd'], ['napsat si poznámky', 'iron'], ['zjistit, kde jsou hranice', 'torch']];
  // Co je v šuplících. Zatím panáčkovy věci; sem patří tvoje podrobnosti k jednotlivým řádkům.
  const SUPLIKY = ['Rozepsaný titulek: „Panáček ukradl šroubovák." Škrtnuto.', '// TODO: vrátit šroubovák\n// TODO: neusínat ve službě', 'Svačina. Nesahat.'];
  const SVETLO = ['Agenti', 'made4fun', 'Čeština', 'Satira', 'Osm bitů', 'Kdo je vepředu', 'Stručnost'];   // která poznámka z rubu patří ke kterému odkazu
  const secEl = { h2: null, verbs: [], items: [], links: [], tip: null };
  const curTool = () => (tool.on ? 'sd' : tool.pl ? 'pl' : tool.cur);

  // ---------- kabely odkazů ----------
  // Každý odkaz má kabel uchycený nahoře ve svém řádku a zástrčku ve zdi vpravo.
  // Vypáčená zástrčka visí na kabelu jako na laně: řetěz bodů, tíha, setrvačnost, jde do ní strčit.
  const cables = { cv: null, g: null, x: 0, y: 0, w: 0, h: 0, list: [] };
  function cableGeom(a) {
    const r = a.getBoundingClientRect(), R = r.right + scrollX, T = r.top + scrollY;
    return { ax: R - 78, ay: T + 1, sx: R - 34, sy: T + r.height / 2 };
  }
  function buildCables() {
    if (!secEl.links.length) return;
    if (!cables.cv) { cables.cv = canvas(1, 1); cables.cv.className = 'pnk-ropes'; cables.g = cables.cv.getContext('2d'); layer.insertBefore(cables.cv, figEl); }
    const box = secEl.links[0].parentElement.getBoundingClientRect();
    Object.assign(cables, { x: box.left + scrollX - 10, y: box.top + scrollY - 10, w: box.width + 20, h: box.height + 110 });
    const c = cables.cv;
    Object.assign(c.style, { left: cables.x + 'px', top: cables.y + 'px', width: cables.w + 'px', height: cables.h + 'px' });
    c.width = Math.round(cables.w * DPR); c.height = Math.round(cables.h * DPR);
    cables.list = secEl.links.map((a, i) => {
      const g = cableGeom(a), n = 11, d = Math.hypot(g.sx - g.ax, g.sy - g.ay), off = sec.off.includes(i);
      const q = [];
      for (let k = 0; k < n; k++) { const t = k / (n - 1), x = g.ax + (g.sx - g.ax) * t, y = g.ay + (g.sy - g.ay) * t; q.push({ x, y, px: x, py: y }); }
      const cb = { g, q, seg: Math.max(d * 1.22, 62) / (n - 1), off, awake: 0 };
      for (let k = 0; k < 300; k++) stepCable(cb, 1 / 120, false);
      return cb;
    });
    drawCables();
  }
  function stepCable(cb, h, push) {
    const q = cb.q, n = q.length, g = cb.g, gr = GR * .75 * h * h;
    const px = push && ptr.on ? ptr.x + scrollX : -1e5, py = push && ptr.on ? ptr.y + scrollY : -1e5;
    let mv = 0;
    for (let k = 1; k < n; k++) {
      const v = q[k];
      if (k === n - 1 && cb.hold) { const hp = cb.hold(); v.x = v.px = hp.x; v.y = v.py = hp.y; continue; }
      if (k === n - 1 && !cb.off) { v.x = v.px = g.sx; v.y = v.py = g.sy; continue; }
      const vx = (v.x - v.px) * .992, vy = (v.y - v.py) * .992;
      v.px = v.x; v.py = v.y; v.x += vx; v.y += vy + gr * (k === n - 1 ? 1.6 : 1);
      const dx = v.x - px, dy = v.y - py, d = Math.hypot(dx, dy);
      if (d < 22 && d > .01) { const f = (22 - d) / d * .25; v.x += dx * f; v.y += dy * f; cb.awake = 300; }
      mv = Math.max(mv, Math.abs(vx) + Math.abs(vy));
    }
    q[0].x = g.ax; q[0].y = g.ay;
    for (let it = 0; it < 14; it++) for (let k = 0; k < n - 1; k++) {
      const a = q[k], b = q[k + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, df = (d - cb.seg) / d;
      const fa = k === 0, fb = k === n - 2 && (!cb.off || !!cb.hold);         // konce: úchyt nahoře, zástrčka ve zdi
      const wb = k === n - 2 && cb.off ? .25 : .5;              // zástrčka je těžší než kabel
      if (fa && fb) continue;
      if (fa) { b.x -= dx * df; b.y -= dy * df; }
      else if (fb) { a.x += dx * df; a.y += dy * df; }
      else { a.x += dx * df * (1 - wb); a.y += dy * df * (1 - wb); b.x -= dx * df * wb; b.y -= dy * df * wb; }
    }
    return mv;
  }
  function cableStep(dt) {
    if (!cables.list.some(c => c.awake > 0 || c.hold)) return false;
    const H = Math.min(.05, dt / 1000), n = Math.max(1, Math.ceil(H * 120)), h = H / n;
    for (const cb of cables.list) {
      if (cb.hold) cb.awake = 400;
      if (cb.awake <= 0) continue;
      let mv = 0;
      for (let i = 0; i < n; i++) mv = stepCable(cb, h, true);
      cb.awake = mv < .03 ? cb.awake - 1 : Math.max(cb.awake, 60);
    }
    drawCables();
    return true;
  }
  // Rozvržení se může posunout i po načtení (písma, otevřený šuplík nad odkazy); kabely se pak přepočítají.
  let cabRaf = 0;
  function rebuildCablesSoon() {
    if (cabRaf || !secEl.links.length) return;
    cabRaf = requestAnimationFrame(() => { cabRaf = 0; buildCables(); });
  }
  function wakeCables(n = 30) { for (const cb of cables.list) cb.awake = Math.max(cb.awake, n); kick(); }
  function syncCables() {
    cables.list.forEach((cb, i) => {
      const off = sec.off.includes(i);
      if (off === cb.off) return;
      cb.off = off; cb.awake = 400;
      const e = cb.q[cb.q.length - 1];
      if (off) { e.px = e.x + 4; e.py = e.y + 1; }             // vypáčení: škubne dozadu
    });
    kick();
  }
  function drawCables() {
    const g = cables.g;
    if (!g) return;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, cables.w, cables.h);
    g.translate(-cables.x, -cables.y);
    g.lineCap = g.lineJoin = 'round';
    for (const cb of cables.list) {
      const q = cb.q, n = q.length, e = q[n - 1], p = q[n - 2];
      // úchyt nahoře v řádku
      g.fillStyle = K; g.beginPath(); g.arc(cb.g.ax, cb.g.ay + 2, 4, 0, TAU); g.fill();
      // kabel
      g.strokeStyle = K; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(q[0].x, q[0].y);
      for (let k = 1; k < n - 1; k++) g.quadraticCurveTo(q[k].x, q[k].y, (q[k].x + q[k + 1].x) / 2, (q[k].y + q[k + 1].y) / 2);
      g.lineTo(e.x, e.y); g.stroke();
      // zástrčka: tělo s vroubky, límec a dva kolíky; ve zdi míří vodorovně, jinak visí po směru kabelu
      g.save(); g.translate(e.x, e.y); g.rotate(cb.off ? Math.atan2(e.y - p.y, e.x - p.x) : 0);
      g.fillStyle = '#d9dee3'; g.strokeStyle = K; g.lineWidth = 1.3;
      for (const y of [-5.5, 2.5]) { g.beginPath(); g.rect(17, y, 9, 3); g.fill(); g.stroke(); }
      g.fillStyle = K; g.beginPath();
      if (g.roundRect) g.roundRect(-2, -8.5, 16, 17, 4); else g.rect(-2, -8.5, 16, 17);
      g.fill();
      g.fillStyle = TEAL; g.beginPath(); g.rect(13, -10, 5, 20); g.fill(); g.stroke();
      g.strokeStyle = '#5f6872'; g.lineWidth = 1;
      for (const x of [2, 5.5, 9]) { g.beginPath(); g.moveTo(x, -5); g.lineTo(x, 5); g.stroke(); }
      g.restore();
    }
  }

  function applySec() {
    const h = secEl.h2;
    if (h) { h.classList.toggle('is-left', sec.h2 === 1); h.classList.toggle('is-right', sec.h2 === 2); h.classList.toggle('is-gone', sec.h2 === 3); }
    secEl.verbs.forEach((v, i) => v.classList.toggle('is-on', sec.verbs.includes(i)));
    secEl.items.forEach((v, i) => { v.classList.toggle('is-open', sec.open.includes(i)); v.classList.toggle('is-cut', sec.cut.includes(i)); });
    secEl.links.forEach((v, i) => v.classList.toggle('is-off', sec.off.includes(i)));
    syncCables();
  }
  const secChanged = broke => { if (broke) lastBreak = performance.now(); applySec(); save(); };
  const fixH2 = () => { sec.h2 = 0; secChanged(); };
  const fixCut = i => { sec.cut = sec.cut.filter(v => v !== i); secChanged(); };
  const fixPlug = i => { sec.off = sec.off.filter(v => v !== i); secChanged(); };
  const secCount = () => (sec.h2 ? Math.min(2, sec.h2 === 3 ? 2 : 1) : 0) + sec.cut.length + sec.off.length;

  function buildSec(saved) {
    const cards = doc.querySelectorAll('.section-card');
    const style = pstyle();
    style.textContent = `
.pnk-sign{position:relative;display:inline-block;padding:0 18px;margin-left:-18px;z-index:1;transform-origin:calc(100% - 7px) 50%;transition:color .2s}
.pnk-screw{position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;border:1.5px solid ${K};background:linear-gradient(45deg,transparent 42%,${K} 42% 58%,transparent 58%),${GREY};transition:transform .5s ease-in,opacity .5s}
.pnk-sign.is-left,.pnk-sign.is-right,.pnk-sign.is-gone{pointer-events:none}
.pnk-sign .pnk-screw,html.pnk-t-iron .pnk-sign{pointer-events:auto}
.pnk-screw[data-k="0"]{left:2px}.pnk-screw[data-k="1"]{right:2px}
.pnk-sign.is-left .pnk-screw[data-k="0"],.pnk-sign.is-right .pnk-screw[data-k="1"],.pnk-sign.is-gone .pnk-screw{transform:translateY(60px) rotate(300deg);opacity:0}
.pnk-sign.is-left{transform-origin:calc(100% - 7px) 50%;animation:pnk-hangL 1.5s ease-out forwards}
.pnk-sign.is-right{transform-origin:7px 50%;animation:pnk-hangR 1.5s ease-out forwards}
@keyframes pnk-hangL{0%{transform:none}30%{transform:rotate(-96deg)}55%{transform:rotate(-72deg)}78%{transform:rotate(-88deg)}100%{transform:rotate(-82deg)}}
@keyframes pnk-hangR{0%{transform:none}30%{transform:rotate(96deg)}55%{transform:rotate(72deg)}78%{transform:rotate(88deg)}100%{transform:rotate(82deg)}}
.pnk-sign.is-gone{color:transparent;outline:1px dashed #98a3ae;outline-offset:-2px;animation:pnk-drop .5s ease-in}
@keyframes pnk-drop{from{color:${K};transform:rotate(-82deg)}to{color:${K};transform:rotate(-82deg) translateX(-260px);opacity:0}}
.pnk-verb{transition:background-size .3s;background:linear-gradient(#f2b705,#f2b705) 0 100%/0 38% no-repeat}
.pnk-verb.is-on{background-size:100% 38%}
.pnk-verb.is-no{animation:pnk-no .3s}
@keyframes pnk-no{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
html.pnk-tool .pnk-verb,html.pnk-pliers .pnk-verb,html[class*="pnk-t-"] .pnk-verb{display:inline-block;border-bottom:1px dashed ${K}}
.list .item{position:relative;transition:transform .35s}
.list .item>strong,.list .item>span{transition:transform .3s}
.list .item.is-open>strong,.list .item.is-open>span{transform:translateX(16px)}
.pnk-drawer{grid-column:1/-1;max-height:0;overflow:hidden;transition:max-height .35s ease}
.list .item.is-open .pnk-drawer{max-height:110px}
.pnk-drawer div{margin:10px 0 2px 16px;padding:9px 11px;border:1px dashed ${K};background:#fff;color:${K};font:600 12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap}
.list .item.is-cut{transform-origin:0 0;transform:rotate(2.2deg);border-bottom-style:dashed;animation:pnk-sag .6s ease-out}
@keyframes pnk-sag{0%{transform:none}45%{transform:rotate(3.6deg)}70%{transform:rotate(1.4deg)}}
html.pnk-tool .list .item,html.pnk-pliers .list .item,html.pnk-tool .pnk-screw,html.pnk-tool .pnk-ref{outline:2px dashed #f2b705;outline-offset:2px}
.pnk-ref{position:relative;padding-right:96px!important}
.pnk-ref>span{transition:opacity .3s}
.pnk-ref::after{content:"";position:absolute;right:0;top:50%;width:9px;height:30px;margin-top:-15px;background:${K};border-radius:3px 0 0 3px}
.pnk-ref.is-off>span{opacity:.35}
html.pnk-t-iron .pnk-ref.is-off,html.pnk-t-iron .item.is-cut,html.pnk-t-iron .pnk-sign.is-left,html.pnk-t-iron .pnk-sign.is-right,html.pnk-t-iron .pnk-sign.is-gone{outline:2px dashed #f2b705;outline-offset:2px}
.pnk-ladder{position:absolute;left:0;top:0;width:20px;box-sizing:border-box;border-left:3px solid #8a5a2b;border-right:3px solid #8a5a2b;background:repeating-linear-gradient(to bottom,transparent 0 10px,#8a5a2b 10px 13px);transform-origin:50% 0;pointer-events:none;transition:opacity .35s}
.pnk-tip{position:fixed;left:0;top:0;z-index:2147483001;max-width:260px;padding:10px 12px;background:#14181d;color:#e9e3d0;font:500 13px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;pointer-events:none;display:none;box-shadow:0 0 0 1px #e9e3d0}
.pnk-tip b{display:block;margin-bottom:4px;color:#6cc7f5;font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
`;
    doc.head.appendChild(style);

    const smer = cards[0], h2 = smer && smer.querySelector('h2');
    if (h2) {
      h2.classList.add('pnk-sign');
      for (const k of [0, 1]) { const s = el('i', 'pnk-screw'); s.dataset.k = k; h2.appendChild(s); }
      secEl.h2 = h2;
      const p = smer.querySelectorAll('p')[1];
      if (p && !p.children.length) {
        let html = p.textContent;
        VERBS.forEach(([w], i) => { html = html.replace(w, `<span class="pnk-verb" data-i="${i}">${w}</span>`); });
        p.innerHTML = html;
        secEl.verbs = VERBS.map((_, i) => p.querySelector(`.pnk-verb[data-i="${i}"]`)).filter(Boolean);
      }
    }
    secEl.items = [...doc.querySelectorAll('.list .item')];
    secEl.items.forEach((it, i) => {
      const d = el('div', 'pnk-drawer'), b = doc.createElement('div');
      d.addEventListener('transitionend', rebuildCablesSoon);
      b.textContent = SUPLIKY[i % SUPLIKY.length]; d.appendChild(b); it.appendChild(d);
    });
    secEl.links = [...doc.querySelectorAll('.refs .ref-link')];
    secEl.links.forEach((a, i) => {
      a.classList.add('pnk-ref');
      a.addEventListener('click', () => { if (sec.off.includes(i) && !curTool()) { const r = a.getBoundingClientRect(); puffAt(r.right + scrollX - 40, r.top + scrollY, 'zzt'); } });
    });
    secEl.tip = el('div', 'pnk-tip'); doc.body.appendChild(secEl.tip);

    if (saved) for (const k of ['verbs', 'open', 'cut', 'off']) if (Array.isArray(saved[k])) sec[k] = saved[k].slice();
    if (saved && saved.h2) sec.h2 = saved.h2;
    buildCables();
    applySec();

    addEventListener('pointerdown', e => {
      const t = e.target, cur = curTool();
      if (!cur || e.button > 0 || !t.closest || t.closest('.pnk-belt,.pnk-rub,.pnk-corner')) return;
      let hit = false;
      const v = t.closest('.pnk-verb');
      if (v) {                                   // sloveso a jeho nástroj
        const i = +v.dataset.i;
        if (VERBS[i][1] === cur) {
          if (!sec.verbs.includes(i)) { sec.verbs.push(i); const r = v.getBoundingClientRect(); puffAt(r.left + scrollX + r.width / 2 - 10, r.top + scrollY - 6, sec.verbs.length === VERBS.length ? 'ta-dá!' : 'cvak'); secChanged(); }
        } else { v.classList.remove('is-no'); void v.offsetWidth; v.classList.add('is-no'); }
        hit = true;
      } else if (cur === 'sd') {
        const sc = t.closest('.pnk-screw'), it = t.closest('.list .item'), a = t.closest('.pnk-ref');
        if (sc && sec.h2 !== 3) {                // šrouby nadpisu
          const k = +sc.dataset.k;
          if (sec.h2 === 0) sec.h2 = k ? 2 : 1; else if ((sec.h2 === 1 && k === 1) || (sec.h2 === 2 && k === 0)) sec.h2 = 3;
          puffAt(e.clientX + scrollX, e.clientY + scrollY - 16, 'cvak'); secChanged(true); hit = true;
        } else if (it) {                         // šuplík
          const i = secEl.items.indexOf(it);
          sec.open = sec.open.includes(i) ? sec.open.filter(x => x !== i) : sec.open.concat(i);
          puffAt(e.clientX + scrollX, e.clientY + scrollY - 16, 'ťuk'); secChanged(); hit = true;
        } else if (a) {                          // odkaz: šroubovák vždy jen páčí zástrčku, nikdy neotevírá
          const i = secEl.links.indexOf(a);
          const r = a.getBoundingClientRect();
          if (!sec.off.includes(i)) { sec.off.push(i); puffAt(r.right + scrollX - 50, r.top + scrollY, 'lup!'); secChanged(true); }
          hit = true;
        }
      } else if (cur === 'pl') {
        const it = t.closest('.list .item');
        if (it) { const i = secEl.items.indexOf(it); if (!sec.cut.includes(i)) { sec.cut.push(i); puffAt(e.clientX + scrollX, e.clientY + scrollY - 16, 'cvak'); secChanged(true); } hit = true; }
      }
      if (hit) { swallow = performance.now(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, { capture: true });
    // baterka nad odkazem ukáže poznámku z rubu, která k němu patří
    addEventListener('pointermove', e => {
      if (cables.list.length && e.clientY + scrollY > cables.y - 40 && e.clientY + scrollY < cables.y + cables.h + 40) wakeCables();
      const tip = secEl.tip, a = tool.cur === 'torch' && e.target.closest ? e.target.closest('.pnk-ref') : null;
      if (!a) { tip.style.display = 'none'; return; }
      const n = NOTES.find(v => v[0] === SVETLO[secEl.links.indexOf(a)]);
      if (!n) return;
      tip.innerHTML = '<b></b><span></span>'; tip.firstChild.textContent = n[0]; tip.lastChild.textContent = n[1];
      tip.style.display = 'block';
      tip.style.transform = `translate3d(${Math.min(e.clientX + 18, innerWidth - 280)}px,${e.clientY + 22}px,0)`;
    }, { passive: true });
  }
  // Zapojení odkazu: panáček vyleze nad Odkazy, spustí žebřík k řádku, sleze, skočí do něj,
  // chytí visící zástrčku, zastrčí ji do zásuvky a zaleze za spodní čáru řádku.
  const handPos = () => { const hd = rig.hands[0]; return { x: fig.cx + hd.x.x * S, y: fig.gy + fig.sink - hd.y.x * S }; };
  async function replug(tk) {
    const i = sec.off[0], a = secEl.links[i], cb = cables.list[i];
    if (!a || !cb) return false;
    const card = a.closest('.section-card'), f0 = card && floorOf(card);
    if (!f0 || !visibleY(f0.y)) return false;
    const r = a.getBoundingClientRect(), top = r.top + scrollY, bot = r.bottom + scrollY - 1, L = r.left + scrollX, R = r.right + scrollX;
    const lo = Math.max(f0.x1, L) + HW, hi = Math.min(f0.x2, R) - HW;
    const lx = clamp(cb.g.ax - 30 * S, lo, hi);       // místo pro žebřík, kus vlevo od úchytu kabelu
    let lad = null;
    try {
      await climb(tk, f0, clamp(lx - 28 * S, f0.x1 + HW, f0.x2 - HW), 1);
      await lookAround(tk, 2, 380, 'alarm');
      await go(tk, lx, { speed: 30 * S });
      fig.dir = 1; fig.pose = 'peekdown'; puff('!');
      await wait(tk, 900);
      // žebřík: vytáhne ho a spustí přes hranu dolů k horní čáře řádku
      const x = lx + 3 * S, h = top - f0.y + 12;
      lad = el('div', 'pnk-ladder'); layer.insertBefore(lad, figEl);
      lad.style.height = h + 'px';
      fig.pose = 'bend';
      await tween(tk, 520, v => { lad.style.transform = `translate3d(${x - 10}px,${f0.y - 12}px,0) scaleY(${ease.out(v).toFixed(3)})`; });
      fig.pose = 'stand';
      await go(tk, x - 4.3 * S, { speed: 12 * S, pose: 'sneak' });   // stoupne si k žebříku, drží se ho vepředu
      fig.dir = 1;
      // sešplhá
      fig.pose = 'climb'; setFlags(false, false);
      const y0 = fig.gy;
      await tween(tk, Math.max(600, (top - y0) / (20 * S) * 1000), v => { fig.gy = y0 + (top - y0) * v; });
      fig.gy = top; fig.floor = { el: a, y: top, x1: L, x2: R }; fig.pose = 'stand'; setFlags(true, true);
      await wait(tk, 200);
      lad.style.opacity = '0';
      // skok do řádku
      const inRow = { el: a, y: bot, x1: L, x2: R };
      await hop(tk, clamp(x + 12 * S, L + HW, R - HW), inRow);
      if (!sec.off.includes(i)) return puzzled(tk), true;
      // k visící zástrčce
      const e = cb.q[cb.q.length - 1];
      await go(tk, clamp(e.x - 2.5 * S, L + HW / 2, R - HW / 2), { speed: 24 * S });
      fig.dir = e.x >= fig.cx ? 1 : -1;
      fig.reachY = clamp((bot - e.y) / S, 0, 4); fig.pose = 'place';
      await wait(tk, 420);
      if (!sec.off.includes(i)) return puzzled(tk), true;
      cb.hold = handPos; fig.plug = true; puff('mám');
      fig.pose = 'stand';
      await wait(tk, 300);
      // k zásuvce a zastrčit
      await go(tk, clamp(cb.g.sx - 4.2 * S, L + HW / 2, R - HW / 2), { speed: 18 * S });
      fig.dir = 1; fig.reachY = (bot - cb.g.sy) / S; fig.lean = 0; fig.pose = 'plugin';
      await wait(tk, 500);
      await tween(tk, 260, v => { fig.lean = Math.sin(v * Math.PI); });
      cb.hold = null; fig.plug = false;
      if (sec.off.includes(i)) fixPlug(i);
      puffAt(cb.g.sx, cb.g.sy - 16, 'cvak');
      fig.pose = 'proud'; puff('tak');
      await wait(tk, 900);
      await go(tk, clamp(fig.cx - 14 * S, L + HW, R - HW), { speed: 22 * S });
      await duck(tk);
      return true;
    } finally {
      cb.hold = null; fig.plug = false;
      if (lad) { const l = lad; l.style.opacity = '0'; setTimeout(() => l.remove(), 400); }
    }
  }

  // Páječka: zapojí odkaz, spraví linku, pověsí nadpis.
  function secIron(t) {
    const a = t.closest('.pnk-ref.is-off'), it = t.closest('.list .item.is-cut'), h = t.closest('.pnk-sign');
    if (a) fixPlug(secEl.links.indexOf(a)); else if (it) fixCut(secEl.items.indexOf(it)); else if (h && sec.h2) fixH2(); else return false;
    return true;
  }
  // Co z toho může opravit panáček: věc v sekci, jejíž horní čára je vidět.
  function secBroken() {
    let e = null, fix = null;
    if (sec.off.length) { const i = sec.off[0]; e = secEl.links[i]; fix = () => fixPlug(i); }
    else if (sec.cut.length) { const i = sec.cut[0]; e = secEl.items[i]; fix = () => fixCut(i); }
    else if (sec.h2) { e = secEl.h2; fix = fixH2; }
    const card = e && e.closest('.section-card'), f = card && floorOf(card);
    if (!f || !visibleY(f.y)) return null;
    const r = e.getBoundingClientRect();
    return { f, x: clamp(r.left + scrollX + Math.min(r.width / 2, 30 * S), f.x1 + HW, f.x2 - HW), fix };
  }

  function repairVisible() {
    const idx = doc.querySelector('.index'), fI = idx && floorOf(idx), pf = pileFloor();
    return !!(secBroken() || ((pl.cuts.length || Object.keys(pl.half).length) && fI && visibleY(fI.y)) || (world.removed.length && !world.gone && !world.fall && pf && visibleY(pf.y)));
  }

  // ---------- nadpis: písmena ----------
  // Každé písmeno jména drží ve stránce. Šroubovák ho prvním stiskem uvolní, druhým vypáčí a písmeno
  // spadne na čáru pod sebou. Panáček je pak hází zpátky, jenže do kterékoli prázdné díry, takže
  // ze jména vznikají přesmyčky. Páječka na nadpisu vrátí všechna písmena na jejich místa.
  const h1 = { el: null, slots: [], fallen: [], loose: null };
  function buildH1(saved) {
    const e = doc.querySelector('.hero h1');
    if (!e || e.children.length) return;
    const text = e.textContent.trim();
    e.classList.add('pnk-h1'); e.setAttribute('aria-label', text);
    e.textContent = '';
    for (const [wi, w] of text.split(' ').entries()) {
      if (wi) e.appendChild(doc.createTextNode(' '));
      const we = el('span', 'pnk-word'); we.setAttribute('aria-hidden', 'true');
      for (const ch of w) {
        const c = el('span', 'pnk-ch'); c.textContent = ch; we.appendChild(c);
        h1.slots.push({ el: c, orig: ch, cur: ch });
      }
      e.appendChild(we);
    }
    h1.el = e;
    const style = pstyle();
    style.textContent = `
.pnk-word{display:inline-block;white-space:nowrap}
.pnk-ch{display:inline-block;transform-origin:50% 92%;transition:transform .25s}
.pnk-ch.is-empty{color:transparent;outline:2px dashed rgba(16,19,23,.2);outline-offset:-.12em}
.pnk-ch.is-loose{transform:rotate(-7deg) translateY(-.04em);animation:pnk-loose .5s ease-out}
@keyframes pnk-loose{25%{transform:rotate(-13deg)}55%{transform:rotate(-4deg)}}
.pnk-ch.is-wrong{color:${TEAL}}
html.pnk-tool .pnk-ch:not(.is-empty):hover{transform:rotate(-4deg)}
html.pnk-t-iron .pnk-h1{outline:2px dashed #f2b705;outline-offset:4px}
.pnk-letter{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;pointer-events:none;will-change:transform;white-space:pre}
`;
    doc.head.appendChild(style);
    if (saved && Array.isArray(saved.s) && saved.s.length === h1.slots.length) {
      saved.s.forEach((c, i) => setSlot(i, c));
      for (const [ch, fk, fr, a] of saved.f || []) h1.fallen.push(makeLetter(ch, { st: 'rest', fk, fr, a }));
    }
    placeLetters();
    addEventListener('pointerdown', e => {
      if (curTool() !== 'sd' || e.button > 0 || !e.target.closest) return;
      const c = e.target.closest('.pnk-ch');
      if (!c) return;
      const i = h1.slots.findIndex(s => s.el === c);
      if (i < 0 || h1.slots[i].cur == null) return;
      e.preventDefault(); e.stopImmediatePropagation(); swallow = performance.now(); lastActivity = performance.now();
      if (h1.loose !== i) {                      // první stisk: povolí
        if (h1.loose != null) h1.slots[h1.loose].el.classList.remove('is-loose');
        h1.loose = i; c.classList.add('is-loose'); snd('tuk');
        const r = c.getBoundingClientRect(); puffAt(r.left + scrollX + r.width / 2 - 10, r.top + scrollY, 'vrz');
      } else popLetter(i);
    }, { capture: true });
  }
  function setSlot(i, ch) {
    const s = h1.slots[i];
    s.cur = ch == null ? null : ch;
    s.el.textContent = ch == null ? s.orig : ch;
    s.el.classList.toggle('is-empty', ch == null);
    s.el.classList.toggle('is-wrong', ch != null && ch !== s.orig);
    s.el.classList.remove('is-loose');
  }
  function letterFont(L) {
    const cs = getComputedStyle(h1.el);
    Object.assign(L.el.style, { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, lineHeight: L.h + 'px', width: L.w + 'px', height: L.h + 'px' });
  }
  function makeLetter(ch, o = {}) {
    const L = Object.assign({ ch, el: el('div', 'pnk-letter'), st: 'rest', x: 0, y: 0, a: 0, fk: null, fr: 0, w: 40, h: 60 }, o);
    L.el.textContent = ch;
    const r = h1.slots[0].el.getBoundingClientRect();
    L.h = r.height || 60; L.w = Math.max(16, L.h * (/[MmWw]/.test(ch) ? .86 : /[iljtfrI]/.test(ch) ? .34 : .56));
    letterFont(L);
    layer.appendChild(L.el);
    return L;
  }
  // Ležící písmeno: střed tak vysoko, aby se dotýkalo čáry (podle toho, jak je otočené).
  const restY = (L, f) => f.y - (Math.abs(Math.sin(rad(L.a))) * L.w + Math.abs(Math.cos(rad(L.a))) * L.h * .78) / 2;
  function placeLetters() {
    for (const L of h1.fallen) {
      if (L.st === 'rest') {
        const f = floorByKey(L.fk);
        if (!f) continue;
        L.x = f.x1 + L.fr * (f.x2 - f.x1); L.y = restY(L, f);
      }
      renderLetter(L);
    }
  }
  function renderLetter(L) {
    if (L.st === 'fig' && fig.vis) {               // nese ho nad hlavou
      const a = rig.hands[0], b = rig.hands[1];
      L.x = fig.cx + (a.x.x + b.x.x) / 2 * S; L.y = fig.gy - (a.y.x + b.y.x) / 2 * S - L.h * .38;
      L.a = rig.lean.x * rig.face.x * 20 + Math.sin(fig.t / 160) * 4;
    }
    L.el.style.display = L.st === 'gone' ? 'none' : '';
    L.el.style.transform = `translate3d(${(L.x - L.w / 2).toFixed(1)}px,${(L.y - L.h / 2).toFixed(1)}px,0) rotate(${L.a.toFixed(1)}deg)`;
  }
  function letterFall(L, x0, y0, a0) {
    const all = floors(), f = all.find(v => v.y > y0 + 20 && x0 > v.x1 - 10 && x0 < v.x2 + 10) || all[all.length - 1];
    L.st = 'air';
    const a1 = [90, -90, 180, 8, -12][Math.floor(rand(0, 5))] + rand(-6, 6);
    const x1 = clamp(x0 + rand(-50, 50), f.x1 + L.w, f.x2 - L.w);
    const y1 = restY(Object.assign({}, L, { a: a1 }), f);
    return tween(FREE, 380 + 16 * Math.sqrt(Math.max(0, y1 - y0)), p => {
      L.x = x0 + (x1 - x0) * p; L.y = y0 + (y1 - y0) * p * p - Math.sin(p * Math.PI) * 40; L.a = a0 + (a1 - a0) * p; renderLetter(L);
    }).then(() => {
      Object.assign(L, { st: 'rest', x: x1, y: y1, a: a1, fk: floorKey(f.el), fr: (x1 - f.x1) / (f.x2 - f.x1) });
      renderLetter(L); snd('bum'); puffAt(x1, f.y - 20, 'bum'); save();
    });
  }
  function popLetter(i) {
    const s = h1.slots[i], r = s.el.getBoundingClientRect(), ch = s.cur;
    h1.loose = null;
    const L = makeLetter(ch);
    L.w = r.width || L.w; L.h = r.height || L.h; letterFont(L);
    setSlot(i, null);
    h1.fallen.push(L);
    lastBreak = performance.now();
    puffAt(r.left + scrollX + r.width / 2 - 8, r.top + scrollY - 6, 'lup!');
    letterFall(L, r.left + scrollX + r.width / 2, r.top + scrollY + r.height / 2, -7);
    save(); progress();
  }
  // Páječka: všechno zpátky na své místo.
  function fixH1() {
    if (!h1.slots.some(s => s.cur !== s.orig) && !h1.fallen.length) return false;
    const pool = h1.fallen.splice(0);
    h1.slots.forEach((s, i) => {
      if (s.cur === s.orig) return;
      const r = s.el.getBoundingClientRect(), tx = r.left + scrollX + r.width / 2, ty = r.top + scrollY + r.height / 2;
      let L = null;
      const k = pool.findIndex(v => v.ch === s.orig);
      if (k >= 0) L = pool.splice(k, 1)[0];
      setSlot(i, null);
      if (!L) { setSlot(i, s.orig); return; }
      const x0 = L.x, y0 = L.y, a0 = L.a;
      L.st = 'air';
      tween(FREE, 500 + i * 60, p => { const e = ease.io(p); L.x = x0 + (tx - x0) * e; L.y = y0 + (ty - y0) * e - Math.sin(p * Math.PI) * 60; L.a = a0 * (1 - e); renderLetter(L); })
        .then(() => { L.el.remove(); setSlot(i, s.orig); save(); progress(); });
    });
    for (const L of pool) L.el.remove();         // přebytečná písmena (nemělo by nastat)
    save(); progress();
    return true;
  }
  const h1Broken = () => h1.slots.filter(s => s.cur !== s.orig).length;
  function h1Ready() {
    const L = h1.fallen.find(v => v.st === 'rest'), f = L && floorByKey(L.fk);
    return !!(f && visibleY(f.y) && h1.slots.some(s => s.cur == null));
  }
  // Panáček hází písmena zpátky do děr. Které písmeno kam, to moc neřeší.
  async function spell(tk) {
    st.spells++;
    let L = h1.fallen.find(v => v.st === 'rest');
    const f = L && floorByKey(L.fk);
    if (!f) return;
    await climb(tk, f, clamp(L.x - 30 * S, f.x1 + HW, f.x2 - HW), L.x > fig.cx ? 1 : -1);
    fig.pose = 'scratch'; puff('?');
    await wait(tk, 900);
    for (let n = 0; L && n < 3; n++) {
      const side = L.x >= fig.cx ? 1 : -1;
      await go(tk, clamp(L.x - side * 3 * S, f.x1 + HW / 2, f.x2 - HW / 2), { speed: 30 * S });
      if (L.st !== 'rest') break;
      fig.dir = side; fig.pose = 'bend';
      await wait(tk, 420);
      if (L.st !== 'rest') break;
      L.st = 'fig'; fig.letter = L; fig.pose = 'trophy'; puff(n ? 'hop' : 'uf', n > 0);
      await wait(tk, 500);
      const empty = h1.slots.map((s, i) => (s.cur == null ? i : -1)).filter(i => i >= 0);
      if (!empty.length) break;
      const j = empty[Math.floor(rand(0, empty.length))], r = h1.slots[j].el.getBoundingClientRect();
      const tx = r.left + scrollX + r.width / 2, ty = r.top + scrollY + r.height / 2;
      await go(tk, clamp(tx, f.x1 + HW, f.x2 - HW), { speed: 12 * S, pose: 'trophy' });
      fig.dir = tx >= fig.cx ? 1 : -1; fig.pose = 'windup'; puff('hop!');
      await wait(tk, 450);
      fig.pose = 'throw'; fig.letter = null;
      const x0 = L.x, y0 = L.y, a0 = L.a; L.st = 'air';
      await tween(tk, 620, p => { L.x = x0 + (tx - x0) * p; L.y = y0 + (ty - y0) * p - Math.sin(p * Math.PI) * 90; L.a = a0 + (360 - a0) * p; renderLetter(L); });
      h1.fallen = h1.fallen.filter(v => v !== L); L.el.remove();
      setSlot(j, L.ch); snd('cvak'); puffAt(tx, ty - 50, L.ch === h1.slots[j].orig ? 'cvak' : 'hm?');
      save(); progress();
      fig.pose = 'proud';
      await wait(tk, 700);
      L = h1.fallen.find(v => v.st === 'rest' && v.fk && v.fk[0] === floorKey(f.el)[0] && v.fk[1] === floorKey(f.el)[1]);
    }
    fig.pose = 'proud';
    puff(h1.slots.every(s => s.cur === s.orig) ? 'ta-dá!' : h1.slots.every(s => s.cur != null) ? 'ta-dá?' : 'tak', true);
    await wait(tk, 1200);
    await duck(tk);
  }

  // ---------- značka MM: šroub ----------
  // Šroubovákem se značka točí jako šroub: proti směru hodinových ručiček povoluje, po půl otáčce je
  // z MM vzhůru nohama WW. Navigace se s povoleným šroubem naklání a po dvou otáčkách šroub vypadne,
  // navigace se zhoupne. Kdo šroub přetáhne, zkroutí celou stránku. Páječka na navigaci vše srovná.
  const mm = { el: null, nav: null, out: 0, drag: null, L: null, tilt: spring(0, 60, .25), step: 0 };
  const MM_OUT = 720, MM_IN = -300;
  function buildMM(saved) {
    const e = doc.querySelector('.brand-mark'), nav = doc.querySelector('.nav');
    if (!e || !nav) return;
    mm.el = e; mm.nav = nav;
    const style = pstyle();
    style.textContent = `
.brand-mark{position:relative;will-change:transform}
html.pnk-tool .brand-mark{outline:2px dashed #f2b705;outline-offset:3px;touch-action:none}
.brand-mark.is-out{background:transparent;color:transparent;outline:2px dashed #98a3ae;outline-offset:-2px}
.nav{transform-origin:100% 100%}
.pnk-mmfall{position:absolute;left:0;top:0;display:grid;place-items:center;background:${K};color:#fff;font:900 13px/1 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.07em;pointer-events:none;will-change:transform}
.page{transform-origin:50% 0}
`;
    doc.head.appendChild(style);
    if (saved && Number.isFinite(saved.out)) {
      mm.out = clamp(saved.out, MM_IN, MM_OUT);
      if (mm.out >= MM_OUT) { popMM(false, saved); }
    }
    applyMM(true);
    addEventListener('pointerdown', e => {
      if (curTool() !== 'sd' || e.button > 0 || !e.target.closest || !e.target.closest('.brand-mark') || mm.out >= MM_OUT) return;
      e.preventDefault(); e.stopImmediatePropagation(); swallow = performance.now(); lastActivity = performance.now();
      const r = e.target.closest('.brand-mark').getBoundingClientRect();
      mm.drag = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: null };
      mmMove(e);
    }, { capture: true });
    addEventListener('pointermove', mmMove, { capture: true, passive: true });
    const end = e => { if (mm.drag && e.pointerId === mm.drag.id) mm.drag = null; };
    addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  }
  function mmMove(e) {
    const D = mm.drag;
    if (!D || e.pointerId !== D.id) return;
    const dx = e.clientX - D.cx, dy = e.clientY - D.cy;
    if (Math.hypot(dx, dy) < 6) return;
    const a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (D.a != null) {
      let d = a - D.a; d = ((d + 540) % 360) - 180;
      mm.out = clamp(mm.out - d, MM_IN, MM_OUT);   // proti směru ručiček povoluje
      const k = Math.floor(mm.out / 30);
      if (k !== mm.step) {
        mm.step = k; snd(mm.out < 0 ? 'pss' : 'krok');
        if (mm.out < -60 && Math.random() < .25) puffAt(D.cx + scrollX + 20, D.cy + scrollY - 10, 'krrr');
      }
      if (mm.out >= MM_OUT) { mm.drag = null; popMM(true); }
      applyMM(); save(); lastBreak = performance.now();
    }
    D.a = a;
  }
  function applyMM(now) {
    if (!mm.el) return;
    const o = mm.out;
    mm.el.style.transform = mm.L ? '' : `rotate(${(-o).toFixed(1)}deg) scale(${(1 + Math.max(0, o) / MM_OUT * .18).toFixed(3)})`;
    mm.el.style.boxShadow = o > 0 && !mm.L ? `${(o / MM_OUT * 4).toFixed(1)}px ${(o / MM_OUT * 5).toFixed(1)}px 0 rgba(16,19,23,.25)` : '';
    mm.nav.classList.toggle('pnk-loose', o > 30);
    const target = mm.L ? -4.5 : -Math.max(0, o) / MM_OUT * 2.6;
    if (now) { mm.tilt.x = target; mm.tilt.v = 0; }
    mm.tiltTo = target;
    // přetažený šroub kroutí stránkou
    const page = doc.querySelector('.page');
    if (page) page.style.transform = o < -20 ? `rotate(${(o / 360 * 1.1).toFixed(3)}deg) skewX(${(o / 360 * 1.6).toFixed(3)}deg)` : '';
    kick();
  }
  function stepMM(dt) {
    if (!mm.nav) return false;
    const T = mm.tiltTo || 0, s = mm.tilt;
    if (Math.abs(s.x - T) < .005 && Math.abs(s.v) < .005) { if (s.x !== T) { s.x = T; mm.nav.style.transform = T ? `rotate(${T}deg)` : ''; } return false; }
    const n = Math.max(1, Math.ceil(dt / 8)), h = dt / n / 1000;
    for (let i = 0; i < n; i++) stepS(s, T, h);
    mm.nav.style.transform = `rotate(${s.x.toFixed(3)}deg)`;
    return true;
  }
  function popMM(live, saved) {
    const r = mm.el.getBoundingClientRect();
    const L = { ch: 'MM', el: el('div', 'pnk-mmfall'), st: 'rest', x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2, a: 0, w: r.width || 36, h: r.height || 36, fk: null, fr: 0 };
    L.el.textContent = 'MM'; L.el.style.width = L.w + 'px'; L.el.style.height = L.h + 'px';
    layer.appendChild(L.el);
    mm.L = L; mm.el.classList.add('is-out');
    if (live) {
      snd('lup'); puffAt(L.x, L.y - 30, 'lup!');
      mm.tilt.v -= 40;
      letterFall(L, L.x, L.y, -MM_OUT);
    } else if (saved && saved.fk) {
      Object.assign(L, { fk: saved.fk, fr: saved.fr, a: saved.a || 0 });
      const f = floorByKey(L.fk);
      if (f) { L.x = f.x1 + L.fr * (f.x2 - f.x1); L.y = restY(L, f); }
      renderLetter(L);
    } else { L.el.remove(); mm.L = null; mm.el.classList.remove('is-out'); mm.out = 0; }
  }
  function placeMM() {
    const L = mm.L;
    if (!L || L.st !== 'rest') return;
    const f = floorByKey(L.fk);
    if (f) { L.x = f.x1 + L.fr * (f.x2 - f.x1); L.y = restY(L, f); renderLetter(L); }
  }
  function fixMM() {
    if (!mm.el || (!mm.out && !mm.L)) return false;
    const L = mm.L;
    if (L) {
      const r = mm.el.getBoundingClientRect(), tx = r.left + scrollX + r.width / 2, ty = r.top + scrollY + r.height / 2, x0 = L.x, y0 = L.y, a0 = L.a;
      L.st = 'air';
      tween(FREE, 650, p => { const e = ease.io(p); L.x = x0 + (tx - x0) * e; L.y = y0 + (ty - y0) * e - Math.sin(p * Math.PI) * 80; L.a = a0 * (1 - e); renderLetter(L); })
        .then(() => { L.el.remove(); mm.L = null; mm.el.classList.remove('is-out'); mm.out = 0; applyMM(); save(); });
      return true;
    }
    mm.out = 0; applyMM(); save();
    return true;
  }
  const mmSave = () => (mm.el ? { out: Math.round(mm.out), fk: mm.L && mm.L.fk, fr: mm.L ? +mm.L.fr.toFixed(4) : 0, a: mm.L ? Math.round(mm.L.a) : 0 } : undefined);

  // ---------- perex: slova ----------
  // Kleštěmi jde přestřihnout řádek perexu. Slova z něj popadají na čáru pod sebou (a na sebe).
  // Panáček z nich staví věž, vyleze na ni, a když má smůlu, věž se s ním zřítí.
  // Páječka na perexu vrátí slova do textu.
  const lead = { el: null, words: [], fallen: [], tower: null };
  function buildLead(saved) {
    const e = doc.querySelector('.hero .lead');
    if (!e || e.children.length) return;
    const text = e.textContent.trim().split(/\s+/);
    e.textContent = '';
    text.forEach((w, i) => {
      if (i) e.appendChild(doc.createTextNode(' '));
      const s = el('span', 'pnk-w'); s.textContent = w; e.appendChild(s);
      lead.words.push({ el: s, text: w, gone: false });
    });
    lead.el = e;
    const style = pstyle();
    style.textContent = `
.pnk-w.is-gone{visibility:hidden}
html.pnk-pliers .hero .lead{cursor:inherit;outline:2px dashed #f2b705;outline-offset:6px}
html.pnk-t-iron .hero .lead{outline:2px dashed #f2b705;outline-offset:6px}
.pnk-wf{position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;will-change:transform}
.pnk-cutline{position:absolute;left:0;top:0;height:0;border-top:2px dashed ${TEAL};pointer-events:none;animation:pnk-cut .6s ease-out forwards}
@keyframes pnk-cut{from{clip-path:inset(0 100% 0 0)}60%{clip-path:inset(0 0 0 0);opacity:1}to{opacity:0}}
`;
    doc.head.appendChild(style);
    if (saved && Array.isArray(saved.g)) {
      for (const i of saved.g) if (lead.words[i]) { lead.words[i].gone = true; lead.words[i].el.classList.add('is-gone'); }
      for (const [i, fk, fr, lvl, a, tw] of saved.f || []) {
        const W = makeWord(i);
        if (W) { Object.assign(W, { st: tw ? 'tower' : 'rest', fk, fr, lvl, a }); lead.fallen.push(W); }
      }
    }
    placeWords();
    addEventListener('pointerdown', e => {
      if (curTool() !== 'pl' || e.button > 0 || !e.target.closest || !e.target.closest('.hero .lead')) return;
      e.preventDefault(); e.stopImmediatePropagation(); swallow = performance.now(); lastActivity = performance.now();
      cutLine(e.clientY);
    }, { capture: true });
  }
  function makeWord(i) {
    const w = lead.words[i];
    if (!w) return null;
    const r = w.el.getBoundingClientRect(), cs = getComputedStyle(lead.el);
    const W = { i, el: el('div', 'pnk-wf'), st: 'rest', x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, w: r.width || 60, h: (parseFloat(cs.fontSize) || 24) * 1.02, fk: null, fr: 0, lvl: 0 };
    W.el.textContent = w.text;
    Object.assign(W.el.style, { font: cs.font, letterSpacing: cs.letterSpacing, color: cs.color, lineHeight: W.h + 'px' });
    layer.appendChild(W.el);
    return W;
  }
  function renderWord(W) {
    if (W.st === 'fig' && fig.vis) {
      const a = rig.hands[0], b = rig.hands[1];
      W.x = fig.cx + (a.x.x + b.x.x) / 2 * S; W.y = fig.gy - (a.y.x + b.y.x) / 2 * S - W.h / 2;
      W.a = Math.sin(fig.t / 150) * 5 + rig.lean.x * rig.face.x * 15;
    }
    W.el.style.transform = `translate3d(${(W.x - W.w / 2).toFixed(1)}px,${(W.y - W.h / 2).toFixed(1)}px,0) rotate(${W.a.toFixed(1)}deg)`;
  }
  function placeWords() {
    for (const W of lead.fallen) {
      if (W.st === 'rest' || W.st === 'tower') {
        const f = floorByKey(W.fk);
        if (f) { W.x = f.x1 + W.fr * (f.x2 - f.x1); W.y = f.y - W.lvl - W.h / 2 + 3; }
      }
      renderWord(W);
    }
  }
  function cutLine(cy) {
    const vis = lead.words.filter(w => !w.gone).map(w => ({ w, r: w.el.getBoundingClientRect() }));
    const hit = vis.filter(v => cy >= v.r.top - 4 && cy <= v.r.bottom + 4);
    if (!hit.length) return;
    const top = Math.min(...hit.map(v => v.r.top)), row = vis.filter(v => Math.abs(v.r.top - top) < 6);
    const x1 = Math.min(...row.map(v => v.r.left)), x2 = Math.max(...row.map(v => v.r.right)), ly = top + row[0].r.height * .55;
    const c = el('div', 'pnk-cutline');
    Object.assign(c.style, { width: (x2 - x1) + 'px', transform: `translate3d(${x1 + scrollX}px,${ly + scrollY}px,0)` });
    layer.appendChild(c); setTimeout(() => c.remove(), 700);
    snd('cvak'); puffAt(x2 + scrollX - 10, top + scrollY - 6, 'cvak');
    lastBreak = performance.now();
    row.forEach((v, k) => {
      const i = lead.words.indexOf(v.w), W = makeWord(i);
      v.w.gone = true; v.w.el.classList.add('is-gone');
      Object.assign(W, { st: 'air', x: v.r.left + scrollX + v.r.width / 2, y: v.r.top + scrollY + v.r.height / 2, vx: rand(-60, 60), vy: -rand(40, 200) - k * 10, va: rand(-260, 260) });
      W.wait = k * 70;
      lead.fallen.push(W);
    });
    renderWords(); save(); progress(); kick();
  }
  function renderWords() { for (const W of lead.fallen) renderWord(W); }
  // Výška hromádky v místě x na čáře f (podle slov, která tam už leží).
  function stackAt(f, x, w, skip) {
    const k = floorKey(f.el);
    let top = 0;
    for (const V of lead.fallen) {
      if (V === skip || (V.st !== 'rest' && V.st !== 'tower') || !V.fk || V.fk[0] !== k[0] || V.fk[1] !== k[1]) continue;
      if (Math.abs(V.x - x) < (V.w + w) / 2 - 6) top = Math.max(top, V.lvl + V.h * .72);
    }
    return top;
  }
  function stepWords(dt) {
    let busy = false;
    const h = Math.min(dt, 40) / 1000;
    let fl = null;
    for (const W of lead.fallen) {
      if (W.st !== 'air') continue;
      busy = true;
      if (W.wait > 0) { W.wait -= dt; continue; }
      fl = fl || floors();
      const y0 = W.y + W.h / 2;
      W.vy += GR * h; W.x += W.vx * h; W.y += W.vy * h; W.a += W.va * h;
      for (const f of fl) {
        if (W.x < f.x1 || W.x > f.x2) continue;
        const lvl = stackAt(f, W.x, W.w, W), fy = f.y - lvl;
        if (y0 > fy + 1 || W.y + W.h / 2 < fy) continue;
        if (W.vy > 380) { W.vy *= -.25; W.vx *= .5; W.va *= .4; W.y = fy - W.h / 2; snd('krok'); break; }
        Object.assign(W, { st: 'rest', lvl, a: (Math.random() < .18 ? 180 : 0) + rand(-6, 6), fk: floorKey(f.el), fr: (W.x - f.x1) / (f.x2 - f.x1), vx: 0, vy: 0 });
        W.y = f.y - lvl - W.h / 2 + 3;
        save();
        break;
      }
      if (W.st === 'air' && W.y > root.scrollHeight) {
        const f = fl[fl.length - 1];
        Object.assign(W, { st: 'rest', lvl: 0, a: 0, fk: floorKey(f.el), fr: .5 }); placeWords(); save();
      }
      renderWord(W);
    }
    return busy;
  }
  function fixLead() {
    if (!lead.fallen.length && !lead.words.some(w => w.gone)) return false;
    for (const W of lead.fallen.splice(0)) {
      const w = lead.words[W.i], r = w.el.getBoundingClientRect(), tx = r.left + scrollX + r.width / 2, ty = r.top + scrollY + r.height / 2;
      const x0 = W.x, y0 = W.y, a0 = W.a;
      W.st = 'back';
      tween(FREE, 500 + rand(0, 300), p => { const e = ease.io(p); W.x = x0 + (tx - x0) * e; W.y = y0 + (ty - y0) * e - Math.sin(p * Math.PI) * 70; W.a = a0 * (1 - e); renderWord(W); })
        .then(() => { W.el.remove(); w.gone = false; w.el.classList.remove('is-gone'); });
    }
    for (const w of lead.words) if (w.gone && !w.el.isConnected) w.gone = false;
    lead.tower = null;
    setTimeout(() => { for (const w of lead.words) { w.gone = false; w.el.classList.remove('is-gone'); } save(); progress(); }, 900);
    save();
    return true;
  }
  const leadSave = () => (lead.el ? { g: lead.words.map((w, i) => (w.gone ? i : -1)).filter(i => i >= 0),
    f: lead.fallen.filter(W => W.fk && (W.st === 'rest' || W.st === 'tower' || W.st === 'fig')).map(W => [W.i, W.fk, +W.fr.toFixed(4), Math.round(W.st === 'fig' ? 0 : W.lvl), Math.round(W.a), W.st === 'tower' ? 1 : 0]) } : undefined);
  function leadReady() {
    const loose = lead.fallen.filter(W => W.st === 'rest');
    if (loose.length < 2) return null;
    const f = floorByKey(loose[0].fk);
    return f && visibleY(f.y) ? f : null;
  }
  // Věž: na kraji čáry, kde zrovna nic neleží.
  async function tower(tk) {
    st.towers++;
    const f = leadReady();
    if (!f) return;
    const k = floorKey(f.el), same = W => W.fk && W.fk[0] === k[0] && W.fk[1] === k[1];
    const tw = lead.fallen.filter(W => W.st === 'tower' && same(W));
    let tx = tw.length ? tw[0].x : null;
    if (tx == null) {
      const xs = lead.fallen.filter(W => W.st === 'rest' && same(W)).map(W => W.x);
      const lo = Math.min(...xs), hi = Math.max(...xs);
      tx = lo - f.x1 > f.x2 - hi ? clamp(lo - 34 * S, f.x1 + 30 * S, f.x2 - 30 * S) : clamp(hi + 34 * S, f.x1 + 30 * S, f.x2 - 30 * S);
    }
    await climb(tk, f, clamp(tx + 14 * S, f.x1 + HW, f.x2 - HW), -1);
    fig.pose = 'think'; puff('hm…', true);
    await wait(tk, 1200);
    fig.pose = 'stand'; puff('!');
    await wait(tk, 300);
    for (let n = 0; n < 6; n++) {
      const cand = lead.fallen.filter(W => W.st === 'rest' && same(W)).sort((a, b) => Math.abs(a.x - fig.cx) - Math.abs(b.x - fig.cx));
      const W = cand[0];
      if (!W) break;
      const side = W.x >= fig.cx ? 1 : -1;
      await go(tk, clamp(W.x - side * 2 * S, f.x1 + HW / 2, f.x2 - HW / 2), { speed: 44 * S });
      if (W.st !== 'rest') continue;
      fig.dir = side; fig.reachY = W.lvl / S; fig.pose = W.lvl > 2 * S ? 'place' : 'bend';
      await wait(tk, 380);
      if (W.st !== 'rest') continue;
      W.st = 'fig'; fig.word = W; fig.pose = 'trophy';
      await wait(tk, 300);
      const H = stackAt(f, tx, W.w, W), sd2 = tx >= fig.cx ? -1 : 1;
      await go(tk, clamp(tx + sd2 * 7 * S, f.x1 + HW / 2, f.x2 - HW / 2), { speed: 30 * S, pose: 'trophy' });
      fig.dir = -sd2;
      const ox = rand(-.12, .12) * W.w, y1 = f.y - H - W.h / 2 + 3;
      if (H < 11 * S) {                          // dosáhne: položí
        fig.reachY = (H + W.h * .4) / S; fig.pose = 'place';
        await wait(tk, 300);
        fig.word = null; W.st = 'air2';
        const x0 = W.x, y0 = W.y, a0 = W.a;
        await tween(tk, 260, p => { W.x = x0 + (tx + ox - x0) * p; W.y = y0 + (y1 - y0) * p; W.a = a0 * (1 - p); renderWord(W); });
      } else {                                   // nedosáhne: hodí to nahoru
        fig.pose = 'windup'; puff('hop!');
        await wait(tk, 420);
        fig.pose = 'throw'; fig.word = null; W.st = 'air2';
        const x0 = W.x, y0 = W.y, a0 = W.a;
        await tween(tk, 520, p => { W.x = x0 + (tx + ox - x0) * p; W.y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 50; W.a = a0 + (360 - a0) * p; renderWord(W); });
      }
      Object.assign(W, { st: 'tower', x: tx + ox, y: y1, a: rand(-2.5, 2.5), lvl: H, fk: k, fr: (tx + ox - f.x1) / (f.x2 - f.x1) });
      renderWord(W); snd('tuk'); save();
      fig.pose = 'stand';
      await wait(tk, 200);
    }
    const tws = lead.fallen.filter(W => W.st === 'tower' && same(W));
    const top = tws.length ? Math.max(...tws.map(W => W.lvl + W.h * .72)) : 0;
    if (tws.length < 3) { fig.pose = 'proud'; await wait(tk, 800); return duck(tk); }
    // vyleze nahoru
    await go(tk, clamp(tx - 6 * S, f.x1 + HW, f.x2 - HW), { speed: 20 * S });
    fig.dir = 1; fig.pose = 'lookup'; puff('!');
    await wait(tk, 800);
    fig.pose = 'climb'; setFlags(false, false);
    const y0 = fig.gy, x0 = fig.cx;
    await tween(tk, Math.max(800, top / (16 * S) * 1000), p => { fig.gy = y0 - top * p; });
    await tween(tk, 300, p => { fig.cx = x0 + (tx - x0) * p; });
    fig.pose = 'proud'; setFlags(true, true); puff('ta-dá!');
    await wait(tk, 1300);
    if (Math.random() < .55 || tws.length > 5) {      // věž se kymácí a spadne
      fig.pose = 'alarm'; puff('ou ou');
      const a0 = tws.map(W => W.a);
      await tween(tk, 900, p => { tws.forEach((W, i) => { W.a = a0[i] + Math.sin(p * 18) * p * (2 + W.lvl / 20); renderWord(W); }); fig.cx = tx + Math.sin(p * 18) * p * 6; });
      snd('rach'); puffAt(tx, fig.gy - 70, 'řach');
      for (const W of tws) Object.assign(W, { st: 'air', vx: rand(-260, 260) + (W.lvl / 2) * (Math.random() < .5 ? -1 : 1), vy: -rand(80, 260), va: rand(-500, 500), wait: 0 });
      kick();
      fig.floor = f;
      await fly(tk, rand(-150, 150), -260, rand(-6, 6), true);
      return;
    }
    fig.pose = 'trophy'; puff('jo!');
    await wait(tk, 900);
    await hop(tk, clamp(tx + 16 * S, f.x1 + HW, f.x2 - HW), f);
    await duck(tk);
  }

  // ---------- kapsy ----------
  // Kdo s panáčkem třese, vysype mu kapsy. Věci spadnou na čáru a kliknutím se dají prohlédnout.
  const POCKET = [
    ['note', 'Nákupní seznam: pájka, kafe, víc pájky.'],
    ['coin', 'Pětikoruna. Na kafe to nestačí.'],
    ['note', 'Úkol: vrátit šroubovák. Škrtnuto. Nevracet šroubovák.'],
    ['res', 'Odpor 4,7 kΩ. Proti šimrání nepomáhá.'],
    ['chip', 'Z80. Nosí ho pro štěstí.'],
    ['note', 'Heslo od dílny: 1234. Neříkat to tomu vepředu.'],
    ['screw', 'Šroubek M3. Odněkud vypadl. Odkud?'],
    ['note', 'Kdo tohle čte, ten se mnou třásl. Nedělá se to.'],
  ];
  const pockets = { order: null, n: 0, items: [] };
  function shakeOut() {
    if (!fig.vis) return;
    if (!pockets.order) pockets.order = POCKET.map((_, i) => i).sort(() => Math.random() - .5);
    if (pockets.n >= pockets.order.length) { puff('nic už nemám', true); return; }
    const [kind, text] = POCKET[pockets.order[pockets.n++]];
    const e = el('button', 'pnk-pocket pnk-pk-' + kind); e.type = 'button'; e.setAttribute('aria-label', text);
    if (kind === 'chip') e.textContent = 'Z80';
    if (kind === 'coin') e.textContent = '5';
    layer.appendChild(e);
    const w = { note: 22, coin: 16, res: 30, chip: 26, screw: 18 }[kind], h = { note: 16, coin: 16, res: 9, chip: 14, screw: 8 }[kind];
    const L = { ch: kind, el: e, st: 'air', x: fig.cx, y: fig.gy - COM * S, a: 0, w, h, fk: null, fr: 0 };
    pockets.items.push(L);
    snd('tuk'); puff(['ups', 'moje věci!', 'ne!', 'hej'][pockets.n % 4]);
    letterFall(L, L.x, L.y, rand(-90, 90));
    e.addEventListener('click', ev => {
      ev.stopPropagation(); snd(kind === 'coin' ? 'jo' : 'tuk');
      const tip = secEl.tip, r = e.getBoundingClientRect();
      tip.innerHTML = '<b></b><span></span>'; tip.firstChild.textContent = { note: 'Lísteček', coin: 'Mince', res: 'Odpor', chip: 'Čip', screw: 'Šroubek' }[kind]; tip.lastChild.textContent = text;
      tip.style.display = 'block';
      tip.style.transform = `translate3d(${Math.min(r.left, innerWidth - 280)}px,${Math.max(8, r.top - 80)}px,0)`;
      clearTimeout(tip.pnkT); tip.pnkT = setTimeout(() => { tip.style.display = 'none'; }, 3500);
    });
  }
  function placePockets() { for (const L of pockets.items) if (L.st === 'rest') { const f = floorByKey(L.fk); if (f) { L.x = f.x1 + L.fr * (f.x2 - f.x1); L.y = restY(L, f); renderLetter(L); } } }

  // ---------- jinde ----------
  // Když návštěvník odejde na jinou kartu, panáček si toho všimne. Po návratu mu zamává.
  let awayT = 0, title0 = doc.title, away = false;
  function faceIcon(sad) {
    const c = canvas(32, 32), g = c.getContext('2d');
    g.lineWidth = 2.4; g.strokeStyle = K; g.fillStyle = '#fff';
    g.beginPath(); g.arc(16, 17, 11.5, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = TEAL; g.beginPath(); g.arc(16, 17, 11.6, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = K; for (const x of [12, 20]) { g.beginPath(); g.arc(x, 19, 1.8, 0, TAU); g.fill(); }
    g.beginPath(); if (sad) g.arc(16, 27, 4, 1.2 * Math.PI, 1.8 * Math.PI); else g.arc(16, 22, 4, .2 * Math.PI, .8 * Math.PI); g.stroke();
    return c.toDataURL();
  }
  function setIcon(url) {
    let l = doc.querySelector('link[rel~="icon"][data-pnk]');
    if (!url) { if (l) l.remove(); return; }
    if (!l) { l = doc.createElement('link'); l.rel = 'icon'; l.dataset.pnk = ''; doc.head.appendChild(l); }
    l.href = url;
  }
  function onVisibility() {
    clearTimeout(awayT);
    if (doc.hidden) {
      awayT = setTimeout(() => { away = true; title0 = doc.title; doc.title = 'Panáček čeká…'; setIcon(faceIcon(true)); }, 2000);
      return;
    }
    if (!away) return;
    away = false; doc.title = title0; setIcon(null);
    if (!CALM && !act && !fin.on && st.stage >= 1) setTimeout(() => { if (!act) run('wave', wave); }, 600);
  }
  async function wave(tk) {
    const f = visibleFloor();
    if (!f) return;
    const x0 = spotOn(f);
    await climb(tk, f, x0, x0 - scrollX < innerWidth / 2 ? 1 : -1);
    fig.pose = 'wave'; puff(['ahoj!', 'už jsi tu!', 'jé!'][Math.floor(rand(0, 3))]);
    await wait(tk, 1800);
    fig.pose = 'stand';
    await wait(tk, 300);
    await duck(tk);
  }

  // ---------- plánování ----------
  function tick() {
    if (CALM || act || forced || fin.on || turn.side || turn.busy || doc.hidden || sd.state === 'fly' || sd.state === 'air') return;
    const now = performance.now(), idle = now - lastActivity, since = now - lastEnd;
    if (sd.state === 'belt') {
      const wf = workFloor();
      if (world.ready && gatherReady()) { if (since > 1200 * q) run('gather', gather); }
      else if (leadReady() && now - lastBreak > 3000 * q && since > Math.min(40000, 5000 * 1.4 ** st.towers) * q) run('tower', tower);
      else if (h1Ready() && now - lastBreak > 2500 * q && since > Math.min(30000, 4000 * 1.3 ** st.spells) * q) run('spell', spell);
      else if (holes.length >= 2 && ['hidden', 'fig', 'ground'].includes(items.torch.state) && (items.torch.state === 'ground' || visibleFloor())
        && since > (items.torch.state === 'ground' ? T.retrieve : Math.min(40000, 6000 * 1.5 ** st.lamps) * q)) run('lamp', lamp);
      else if (now - lastBreak > 25000 * q && since > Math.min(60000, 8000 * 1.4 ** st.repairs) * q && repairVisible()) run('repair', repair);
      else if (world.gone && pl.state !== 'belt' && pl.state !== 'fly' && pl.state !== 'air' && pileFloor() && visibleY(pileFloor().y)
        && (pl.state !== 'hook' || pebbles.filter(p => p.st === 'pile').length >= 3)) {
        if (since > (pl.state === 'ground' ? T.retrieve : Math.min(40000, 5000 * 1.5 ** st.fetches) * q)) run('pliers', fetchPliers);
      }
      else if (pl.state === 'hook' && wf && visibleY(wf.y) && since > Math.min(60000, 9000 * 1.6 ** st.longs) * q) run('longing', longing);
      else if (!world.removed.length && (st.searched ? idle > T.searchIdle && since > T.searchIdle : since > T.search)) run('search', search);
    } else if (sd.state === 'ground') {
      if (since > T.retrieve) run('retrieve', retrieve);
    } else if (st.stage === 0) {
      if (now - t0 > T.first && (idle > T.idle || (atBottom() && idle > T.idle / 3))) run('peek', peek);
    } else if (since > (st.stage === 1 ? T.afterPeek : Math.min(T.againMax, T.again * 1.5 ** st.rounds))) {
      run('heist', heist);
    }
  }

  // ---------- vstupy ----------
  function overFig(x, y) {
    if (!fig.vis) return false;
    const l = fig.cx - scrollX - 8 * S, b = fig.gy - scrollY, t = b - 17 * S + Math.max(0, fig.sink);
    return b > t && x > l - 8 && x < l + 16 * S + 8 && y > t - 8 && y < b + 8;
  }
  function addTickle(v) {
    tickle += v;
    if (tickle >= TICKLE) tickled();
    else if (tickle > 70 && Math.random() < .07) puff('chi');
    kick();
  }
  function listen() {
    const seen = () => { lastActivity = performance.now(); };
    // Zvuk se zapíná a probouzí úplně prvním posluchačem každého gesta, dřív než ho cokoli zachytí.
    // Safari ho po přepnutí karty uspí a probudit ho jde jen uvnitř gesta.
    const wake = () => { unlock(); const c = audio.ctx; if (c && c.state !== 'running' && !audio.mute) try { c.resume().catch(() => {}); } catch (e) { /* nic */ } };
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, wake, { capture: true, passive: true });
    addEventListener('pointerdown', () => { swallow = 0; }, true);   // nové stisknutí: staré spolknutí už neplatí
    // za čepici jde panáčka chytit, to má přednost i před nástroji
    addEventListener('pointerdown', e => {
      if (toolOnFig(e) || grabStart(e)) { swallow = performance.now(); e.preventDefault(); e.stopImmediatePropagation(); seen(); }
    }, { capture: true });
    addEventListener('pointerup', grabEnd, true); addEventListener('pointercancel', grabEnd, true);
    addEventListener('pointermove', e => {
      grabMove(e);
      if (e.pointerType === 'mouse' && fig.vis) figEl.style.cursor = grab.on ? '' : headAt(e.clientX, e.clientY) ? 'grab' : '';
    }, { passive: true });
    // šroubovák v ruce: páčení spojů má přednost před vším ostatním
    addEventListener('pointerdown', e => {
      if (!tool.pl || e.button > 0 || !e.target.closest) return;
      const t = e.target.closest('.index-tags .tag:not(.pnk-hole)');
      if (t) {
        e.preventDefault(); e.stopImmediatePropagation(); seen();
        const name = t.textContent.trim();
        if (pl.half[name]) snip(t, true);       // druhá strana: cedulka odpadne celá
        else {                                  // první strana: cedulka se utrhne jen tam a visí na druhé
          const r = t.getBoundingClientRect(), side = e.clientX < r.left + r.width / 2 ? 'L' : 'R';
          pl.half[name] = side; halfTag(t, side, false);
          puffAt((side === 'L' ? r.left : r.right) + scrollX - 12, r.top + scrollY - 8, 'cvak');
          lastBreak = performance.now(); save();
        }
      }
    }, { capture: true });
    addEventListener('pointerdown', e => {
      if (!tool.on || e.button > 0) return;
      if (pryStart(e)) { e.preventDefault(); e.stopImmediatePropagation(); seen(); kick(); }
    }, { capture: true });
    addEventListener('pointermove', e => {
      if (tool.pry) { if (e.pointerId === tool.pry.id) pryMove(e); return; }
      if (tool.on && e.pointerType === 'mouse') setHover(pinAt(e.clientX, e.clientY));
      const b = world.box;
      if (world.ready && b && !world.gone) {
        const X = e.clientX + scrollX, Y = e.clientY + scrollY;
        if (X > b.l && X < b.l + b.w && Y > b.t && Y < b.t + b.h + 40) {
          for (const L of world.lines) if (L.rope) L.rope.awake = Math.max(L.rope.awake, 20);
          kick();
        }
      }
    }, { capture: true, passive: true });
    const unpry = e => { if (tool.pry && e.pointerId === tool.pry.id) endPry(); };
    addEventListener('pointerup', unpry, true); addEventListener('pointercancel', unpry, true);
    addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (tool.on) toggleTool(false); if (tool.pl) togglePliers(false); });
    addEventListener('pointermove', e => {
      const d = Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y);
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; seen();
      if (d < 160 && fig.ticklish && overFig(ptr.x, ptr.y)) addTickle(d * (e.pointerType === 'mouse' ? 1 : 1.7));
      if (fig.vis) kick();
    }, { passive: true });
    addEventListener('pointerdown', e => {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; seen();
      if (fig.ticklish && overFig(ptr.x, ptr.y)) addTickle(75);
      if (fig.vis) kick();
    }, { passive: true });
    const lift = e => { if (e.pointerType !== 'mouse') setTimeout(() => { ptr.on = false; }, 700); };
    addEventListener('pointerup', lift); addEventListener('pointercancel', lift);
    root.addEventListener('mouseleave', () => { ptr.on = false; });
    addEventListener('scroll', seen, { passive: true });
    addEventListener('keydown', seen);

    // Při změně šířky se stránka přeskládá: výstup končí, ležící šroubovák se přepočítá.
    let w = innerWidth, rz = 0;
    addEventListener('resize', () => {
      if (innerWidth === w) return;
      w = innerWidth; clearTimeout(rz);
      rz = setTimeout(() => {
        if (turn.side || turn.busy) return;
        endPry(); cancel(); forced = null; hide();
        if (sd.state === 'stuck' || sd.state === 'air' || sd.state === 'carry') sd.state = 'stash';
        measure();
        if (sd.state === 'belt') fillSlot();
        if (sd.state === 'ground') {
          const f = floorOf(sd.el);
          if (f) { sd.gx = f.x1 + sd.frac * (f.x2 - f.x1); sd.gy = f.y - 2.5 * S; } else sd.state = 'stash';
        }
        renderSd();
      }, 160);
    });
    if (window.ResizeObserver) new ResizeObserver(() => { if (turn.side || turn.busy) return; fitLayer(); remeasure(); rebuildCablesSoon(); }).observe(doc.body);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { remeasure(); rebuildCablesSoon(); });
    addEventListener('load', () => { remeasure(); rebuildCablesSoon(); });
  }

  function reset() { store.clear(); location.reload(); }

  // Ladění: postaví panáčka doprostřed okna v dané póze (null ho zase schová).
  function posePreview(name) {
    cancel();
    if (!name) { forced = null; hide(); return; }
    const f = visibleFloor() || floors()[0];
    if (!fig.vis || !fig.floor || fig.floor.el !== f.el) {
      Object.assign(fig, { floor: f, cx: clamp(scrollX + innerWidth / 2, f.x1 + HW, f.x2 - HW), gy: f.y, sink: 0, lean: 0 });
      show();
    }
    forced = name; fig.pose = name; kick();
  }

  function init() {
    build(); measure(); listen();
    if (flags.includes('reset')) store.clear();
    const saved = store.get();
    offlineRepair(saved);
    if ((saved.tools || []).includes('sroubovak')) { sd.state = 'belt'; st.stage = 3; fillSlot(); }
    if ((saved.tools || []).includes('kleste')) { pl.state = 'belt'; fillPliers(); }
    pl.cuts = (saved.cuts || []).slice();
    pl.half = Object.assign({}, saved.half || {});
    for (const t of doc.querySelectorAll('.index-tags .tag')) {
      const n = t.textContent.trim();
      if (pl.cuts.includes(n)) snip(t, false); else if (pl.half[n]) halfTag(t, pl.half[n], true);
    }
    hint();
    initExtra(saved);
    inlineMap().then(sv => { if (sv) setupMap(sv, saved); }).catch(e => console.error('[panáček]', e));
    setInterval(tick, 300);
    if (flags.includes('finale')) setTimeout(finale, 2500);   // ladění: rovnou finále
    doc.addEventListener('visibilitychange', onVisibility);
    try {
      console.log('%cAhoj, ty co lezeš do konzole.', 'font:800 15px Inter,system-ui,sans-serif;color:#006c86');
      console.log('Panáček poslouchá na window.panacek. Zkus třeba panacek.act(\'peek\') nebo panacek.pose(\'wave\'). A nikomu to neříkej.');
    } catch (e) { /* bez konzole */ }
    window.panacek = {
      act: name => { if (ACTS[name]) run(name, ACTS[name]); },
      pose: posePreview,
      pry: id => popPin(world.pinById[id]),
      pliers: v => togglePliers(v),
      sec: () => JSON.parse(JSON.stringify(sec)),
      give: n => { if (items[n]) { items[n].state = 'belt'; fillItem(items[n]); save(); } },
      use: n => useTool(n || null),
      hole: (x, y) => addHole(x + scrollX, y + scrollY, true),
      under: () => ({ visits: under.visits, kids: under.kids.map(k => k.st).join(',') }), rub: v => flip(v), turn: a => { if (!turn.busy) turnBegin(); setTurn(a); }, done: s => turnFinish(s ? 1 : 0),
      items: () => Object.fromEntries(Object.values(items).map(it => [it.id, it.state])),
      snip: name => snip([...doc.querySelectorAll('.index-tags .tag')].find(t => t.textContent.trim() === name), true),
      tool: v => toggleTool(v),
      pins: () => world.pins.filter(p => p.on).map(p => ({ id: p.id, x: Math.round(p.px - scrollX), y: Math.round(p.py - scrollY) })),
      world: () => ({ ready: world.ready, removed: world.removed.length, swing: !!world.swing, fall: !!world.fall, gone: world.gone, open: world.open,
        ropes: world.lines.filter(l => l.rope && !l.gone).length, peb: pebbles.map(p => p.st).join(',') }),
      ends: () => world.lines.flatMap((L, li) => (L.rope && !L.gone ? [0, 1].map(e => { const v = e ? L.rope.q[L.rope.q.length - 1] : L.rope.q[0]; return { li, e, x: Math.round(v.x - scrollX), y: Math.round(v.y - scrollY), free: !v.pin || v.pin === SOCK }; }) : [])),
      finale: () => finale(), parts: () => brokenParts(),
      reset, dbg: () => ({ boing: rig.boing.x, dz: fig.dazzle, eff: effectivePose() }),
      state: () => ({ act: act && act.name, stage: st.stage, thrown: st.thrown, rounds: st.rounds, sd: sd.state, pose: fig.pose, pl: pl.state, cuts: pl.cuts.length, holes: holes.length, cur: tool.cur || null, frozen, tickle: Math.round(tickle), hold: fig.hold,
        fig: fig.vis ? { x: Math.round(fig.cx), y: Math.round(fig.gy), sink: Math.round(fig.sink) } : null,
        tool: sd.state === 'ground' ? { x: Math.round(sd.gx), y: Math.round(sd.gy) } : null }),
      get speed() { return speed; },
      set speed(v) { speed = Math.max(.1, +v || 1); },
    };
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();

