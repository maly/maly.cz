/*
 * Plošňák: vykreslení a rozhraní. Simulace je v sim.js, levely v levely.js.
 * Deska je canvas; paleta a program jsou DOM. Přetahování přes pointer events
 * (myš i prst), klepnutí na blok v paletě ho vloží za vybraný řádek.
 */
(function () {
  'use strict';
  const S = window.PlosnakSim, LEVELY = window.PlosnakLevely;
  const KLIC = 'malycz.plosnak.v1';
  const RYCHLOST = { '1': 400, '4': 100, '0': 0 };
  const KROKOVANI = 400;
  const PODRZENI = 300;
  const MAX_N = 20;              // nejvyšší počet opakování ve výběru

  const K = '#101317', TEAL = '#006c86', Y = '#f2b705', W = '#fff', RED = '#d9483b';
  const MASKA = '#2f6b47', MASKA_T = '#245738', MASKA_S = '#3f8159', POTISK = '#e3ece5';
  const MED = '#dba54a', MED_BOK = '#9a6a22', MED_S = '#f3cf86';
  const TAU = Math.PI * 2;
  const $ = s => document.querySelector(s);
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpP = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

  // ---------- uložení ----------

  function nacti() {
    try { const d = JSON.parse(localStorage.getItem(KLIC) || '{}'); return d && typeof d === 'object' ? d : {}; }
    catch (e) { return {}; }
  }
  const data = nacti();
  data.levely = data.levely && typeof data.levely === 'object' ? data.levely : {};
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { /* plné nebo zakázané úložiště */ } }
  function zaznam() { return data.levely[level.id] || (data.levely[level.id] = {}); }

  // ---------- program ----------

  let dalsiId = 1;
  function novyUzel(op) {
    const u = { id: 'b' + dalsiId++, op };
    if (op === 'opakuj') { u.n = 2; u.telo = []; }
    if (op === 'stale') u.telo = [];
    if (op === 'kdyz') { u.podminka = (level.podminky || ['drzim'])[0]; u.telo = []; u.jinak = []; }
    if (op === 'opakujKdyz') { u.podminka = (level.podminky || ['drzim'])[0]; u.telo = []; }
    return u;
  }
  function ocisti(prg, povolene) {
    return (Array.isArray(prg) ? prg : []).filter(u => u && povolene.includes(u.op)).map(u => {
      const n = novyUzel(u.op);
      if (n.n) n.n = Math.max(2, Math.min(MAX_N, u.n | 0));
      if (n.telo) n.telo = ocisti(u.telo, povolene);
      if (n.jinak) n.jinak = ocisti(u.jinak, povolene);
      if (n.podminka && (level.podminky || []).includes(u.podminka)) n.podminka = u.podminka;
      return n;
    });
  }
  function bezId(prg) {
    return prg.map(u => {
      const o = { op: u.op };
      if (u.podminka) o.podminka = u.podminka;
      if (u.n) o.n = u.n;
      if (u.telo) o.telo = bezId(u.telo);
      if (u.jinak) o.jinak = bezId(u.jinak);
      return o;
    });
  }
  function ulozProgram() {
    if (programy) zaznam().programy = programy.map(bezId); else zaznam().program = bezId(program);
    uloz();
  }

  // ---------- stav hry ----------

  let programy = null, aktivniPanacek = 0;   // víc panáčků: každý má svůj program
  let zaklad, level, program = [], kurzor = null, volbaN = null, volbaP = null, testIdx = 0;
  let rychlost = RYCHLOST[data.rychlost] != null ? data.rychlost : '1';
  let beh = null;     // { stav, stroj, bezi, hotovo, krokovani }
  let vis = null;     // { stav, pred, po, ev, t0, dur, poza, bublina }
  let neuspechu = 0;

  function vychoziVis() {
    const s = S.novyStav(level, S.zadani(level, testIdx));
    return { stav: S.snimek(s), pred: null, po: null, ev: null, t0: 0, dur: 0, poza: 'stoji', pozy: null, bubliny: [] };
  }

  // ---------- canvas ----------

  const cv = $('#deska'), g = cv.getContext('2d');
  const podklad = document.createElement('canvas'), pg = podklad.getContext('2d');
  let T = 64, OX = 0, OY = 0, CW = 0, CH = 0, DPR = 1;

  function rozmer() {
    const sirka = Math.max(260, cv.parentElement.clientWidth);
    T = Math.max(34, Math.min(84, Math.floor(sirka / (level.sirka + .8))));
    CW = Math.min(sirka, Math.round(T * (level.sirka + 1.6)));
    CH = Math.round(T * (level.vyska + 1.05));
    OX = Math.round((CW - level.sirka * T) / 2);
    OY = Math.round(T * .62);
    DPR = Math.min(3, window.devicePixelRatio || 1);
    for (const c of [cv, podklad]) { c.width = Math.round(CW * DPR); c.height = Math.round(CH * DPR); }
    cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
    kresliPodklad();
  }

  const stredX = x => OX + (x + .5) * T;
  const stredY = y => OY + (y + .5) * T;
  const stred = (x, y) => ({ x: stredX(x), y: stredY(y) });
  const zem = (x, y) => ({ x: stredX(x), y: stredY(y) + .16 * T });          // kde stojí nohy
  const naZemi = (x, y) => ({ x: stredX(x), y: stredY(y) + .3 * T });       // kam se pokládá
  // Kam se pokládá: na pásce a v patici doprostřed, jinak k nohám.
  function bodPolozeni(x, y) {
    const c = S.bunka(level, x, y);
    return c === 'R' || c === 'O' ? { x: stredX(x), y: stredY(y) + .02 * T } : naZemi(x, y);
  }
  function bodPrivodu() {
    const p = level.privodPos, [dx, dy] = p.posun;
    return { x: stredX(p.x) + dx * .4 * T, y: stredY(p.y) + dy * .4 * T };
  }
  function bodVystupu(znak) {
    const v = level.vystupy.find(x => x.znak === znak) || level.vystupPos, [dx, dy] = v.posun;
    return { x: stredX(v.x + dx), y: stredY(v.y + dy) - .22 * T };
  }

  function zaoblene(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  // Cestičky jako jeden tvar: pájecí bod na každém políčku a spoj k sousedům.
  function tvarCest(c, posun, rozsir) {
    c.beginPath();
    const rp = .33 * T + rozsir, sp = .25 * T + rozsir;
    for (let y = 0; y < level.vyska; y++) for (let x = 0; x < level.sirka; x++) {
      if (!S.jeCesta(S.bunka(level, x, y))) continue;
      const cx = stredX(x), cy = stredY(y) + posun;
      c.moveTo(cx + rp, cy); c.arc(cx, cy, rp, 0, TAU);
      if (S.jeCesta(S.bunka(level, x + 1, y))) c.rect(cx, cy - sp, T, 2 * sp);
      if (S.jeCesta(S.bunka(level, x, y + 1))) c.rect(cx - sp, cy, 2 * sp, T);
    }
    c.fill();
  }

  function kresliPodklad() {
    const c = pg;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, CW, CH);
    const lw = Math.max(1.5, T * .03);
    const bx = OX - .3 * T, by = OY - .3 * T, bw = level.sirka * T + .6 * T, bh = level.vyska * T + .6 * T;
    // deska
    c.fillStyle = 'rgba(16,19,23,.16)'; zaoblene(c, bx + 4, by + 5, bw, bh, .22 * T); c.fill();
    c.fillStyle = MASKA; c.strokeStyle = K; c.lineWidth = lw;
    zaoblene(c, bx, by, bw, bh, .22 * T); c.fill(); c.stroke();
    // průchody v mezerách
    for (let y = 0; y < level.vyska; y++) for (let x = 0; x < level.sirka; x++) {
      const b = S.bunka(level, x, y);
      if (S.jeCesta(b)) continue;
      const cx = stredX(x), cy = stredY(y);
      c.fillStyle = MASKA_S; c.beginPath(); c.arc(cx, cy, .085 * T, 0, TAU); c.fill();
      c.fillStyle = MASKA_T; c.beginPath(); c.arc(cx, cy, .04 * T, 0, TAU); c.fill();
    }
    // montážní díry
    for (const [hx, hy] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) {
      const x = hx + (hx === bx ? .2 : -.2) * T, y = hy + (hy === by ? .2 : -.2) * T;
      c.fillStyle = '#f7f8fa'; c.lineWidth = lw * .8; c.beginPath(); c.arc(x, y, .09 * T, 0, TAU); c.fill(); c.stroke();
    }
    // cestičky: bok, pak vrch, obojí s obrysem
    const bok = .1 * T;
    c.fillStyle = K; tvarCest(c, bok, lw);
    c.fillStyle = MED_BOK; tvarCest(c, bok, 0);
    c.fillStyle = K; tvarCest(c, 0, lw);
    c.fillStyle = MED; tvarCest(c, 0, 0);
    for (let y = 0; y < level.vyska; y++) for (let x = 0; x < level.sirka; x++) {
      if (!S.jeCesta(S.bunka(level, x, y))) continue;
      const cx = stredX(x), cy = stredY(y);
      c.strokeStyle = MED_S; c.lineWidth = .045 * T; c.beginPath(); c.arc(cx, cy, .19 * T, 0, TAU); c.stroke();
      c.fillStyle = MASKA_T; c.strokeStyle = MED_BOK; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, .065 * T, 0, TAU); c.fill(); c.stroke();
    }
    // páska se součástkami a patice
    for (let y = 0; y < level.vyska; y++) for (let x = 0; x < level.sirka; x++) {
      const b = S.bunka(level, x, y), cx = stredX(x), cy = stredY(y);
      if (b === 'R') {
        const h = .5 * T, x0 = cx - T / 2, y0 = cy - h / 2;
        const vlevo = S.bunka(level, x - 1, y) === 'R', vpravo = S.bunka(level, x + 1, y) === 'R';
        const l = vlevo ? x0 : x0 + .08 * T, r = vpravo ? x0 + T : x0 + T - .08 * T;
        c.fillStyle = '#f1e7cc'; c.fillRect(l, y0, r - l, h);
        c.strokeStyle = K; c.lineWidth = lw * .8;
        c.beginPath(); c.moveTo(l, y0); c.lineTo(r, y0); c.moveTo(l, y0 + h); c.lineTo(r, y0 + h);
        if (!vlevo) { c.moveTo(l, y0); c.lineTo(l, y0 + h); }
        if (!vpravo) { c.moveTo(r, y0); c.lineTo(r, y0 + h); }
        c.stroke();
        c.fillStyle = '#b8ab88';
        for (let k = 0; k < 3; k++) c.fillRect(x0 + (k + .3) * T / 3, y0 + .05 * T, .07 * T, .06 * T);
        c.strokeStyle = 'rgba(16,19,23,.25)'; c.lineWidth = 1;
        c.strokeRect(cx - .26 * T, cy - .12 * T, .52 * T, .26 * T);
      }
      if (b === 'H') {                                    // odkládací místo pro předávku
        const w = .62 * T;
        c.save(); c.strokeStyle = POTISK; c.lineWidth = Math.max(1.5, T * .03); c.setLineDash([.06 * T, .05 * T]);
        zaoblene(c, cx - w / 2, cy - w / 2, w, w, .08 * T); c.stroke(); c.restore();
        c.fillStyle = POTISK; c.font = `800 ${Math.max(7, Math.round(T * .1))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('ODKLAD', cx, cy + w / 2 + .03 * T);
      }
      if (b === 'O' && level.obvodMapa[x + ',' + y]) {     // patice v obvodu: potisk se symbolem součástky
        const o = level.obvodMapa[x + ',' + y], w = .66 * T, h = .42 * T;
        c.fillStyle = 'rgba(16,19,23,.4)'; zaoblene(c, cx - w / 2, cy - h / 2, w, h, .06 * T); c.fill();
        c.strokeStyle = POTISK; c.lineWidth = Math.max(1.5, T * .03);
        zaoblene(c, cx - w / 2, cy - h / 2, w, h, .06 * T); c.stroke();
        c.lineWidth = Math.max(1, T * .02);
        if (o.druh === 'led') {
          c.beginPath(); c.arc(cx, cy, .14 * T, 0, TAU); c.stroke();
        } else {
          c.beginPath(); c.moveTo(cx - .16 * T, cy);
          for (let i = 0; i < 6; i++) c.lineTo(cx - .12 * T + i * .05 * T, cy + (i % 2 ? .06 : -.06) * T);
          c.lineTo(cx + .16 * T, cy); c.stroke();
        }
        c.fillStyle = MED_S;
        for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * .25 * T, cy, .045 * T, 0, TAU); c.fill(); }
        c.fillStyle = POTISK; c.font = `800 ${Math.max(7, Math.round(T * .11))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText(String(o.poradi + 1), cx - w / 2 + .03 * T, cy - h / 2 - .14 * T);
      } else if (b === 'O') {
        const w = .62 * T, h = .38 * T;
        c.fillStyle = 'rgba(16,19,23,.35)'; c.fillRect(cx - w / 2, cy - h / 2, w, h);
        c.strokeStyle = POTISK; c.lineWidth = Math.max(1.5, T * .035);
        c.strokeRect(cx - w / 2, cy - h / 2, w, h);
        c.beginPath(); c.moveTo(cx - w / 2, cy - h * .15); c.lineTo(cx - w / 2 + .07 * T, cy - h * .15);
        c.lineTo(cx - w / 2 + .07 * T, cy + h * .15); c.lineTo(cx - w / 2, cy + h * .15); c.stroke();
        c.fillStyle = MED_S;
        for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * .2 * T, cy, .05 * T, 0, TAU); c.fill(); }
      }
    }
    // překážky
    for (let y = 0; y < level.vyska; y++) for (let x = 0; x < level.sirka; x++)
      if (S.bunka(level, x, y) === 'X') kresliPrekazku(c, stredX(x), stredY(y));
    // potisk
    c.fillStyle = POTISK;
    c.font = `700 ${Math.max(8, Math.round(T * .15))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.textBaseline = 'middle'; c.textAlign = 'right';
    c.fillText('PLOŠŇÁK ' + level.id, bx + bw - .38 * T, by + bh - .14 * T);
    c.textAlign = 'left';
    c.fillText('REV 1', bx + .38 * T, by + bh - .14 * T);
  }

  function kresliPrekazku(c, x, y) {
    const r = .3 * T, h = .38 * T, lw = Math.max(1.5, T * .03);
    c.lineWidth = lw; c.strokeStyle = K;
    c.fillStyle = '#2b5fa8';
    c.beginPath(); c.moveTo(x - r, y - h * .3); c.lineTo(x - r, y + h * .5);
    c.ellipse(x, y + h * .5, r, r * .45, 0, Math.PI, 0, true); c.lineTo(x + r, y - h * .3); c.fill(); c.stroke();
    c.fillStyle = '#4b84d1'; c.beginPath(); c.ellipse(x, y - h * .3, r, r * .45, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#dfe8f5'; c.beginPath(); c.moveTo(x + r * .55, y - h * .05); c.lineTo(x + r * .55, y + h * .55); c.stroke();
  }

  // ---------- součástky ----------

  const PRUHY = {
    hneda: '#7b4b2a', cervena: '#d0312d', oranzova: '#f08a12', zluta: '#f4d21c', zelena: '#2e9e45',
    modra: '#2f6fd1', fialova: '#8e44ad', seda: '#8d959c', bila: '#f7f7f7',
  };
  function kresliPolozku(c, pol, x, y, s = 1, uhel = 0) {
    if (!pol) return;
    const druh = typeof pol === 'string' ? pol : pol.druh;
    const u = T * s, lw = Math.max(1.2, u * .03);
    c.save(); c.translate(x, y); c.rotate(uhel); c.lineCap = 'round'; c.lineJoin = 'round';
    switch (druh) {
      case 'propojka':
        c.strokeStyle = K; c.lineWidth = u * .1;
        c.beginPath(); c.moveTo(-.24 * u, 0); c.lineTo(.24 * u, 0); c.stroke();
        c.strokeStyle = '#eef1f4'; c.lineWidth = u * .05;
        c.beginPath(); c.moveTo(-.22 * u, 0); c.lineTo(.22 * u, 0); c.stroke();
        c.fillStyle = K;
        for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * .25 * u, 0, u * .045, 0, TAU); c.fill(); }
        break;
      case 'odpor':
        c.strokeStyle = K; c.lineWidth = u * .04;
        c.beginPath(); c.moveTo(-.3 * u, 0); c.lineTo(.3 * u, 0); c.stroke();
        c.fillStyle = '#e8cf9f'; c.lineWidth = lw; zaoblene(c, -.17 * u, -.08 * u, .34 * u, .16 * u, .07 * u); c.fill(); c.stroke();
        c.fillStyle = PRUHY[pol.pruh] || '#c0392b'; c.fillRect(-.12 * u, -.075 * u, .06 * u, .15 * u);
        c.fillStyle = '#1d1d1d'; c.fillRect(-.02 * u, -.075 * u, .035 * u, .15 * u);
        c.fillStyle = '#c99a1e'; c.fillRect(.07 * u, -.075 * u, .035 * u, .15 * u);
        break;
      case 'spaleny':                                // začernalý kus s obláčkem kouře
        c.strokeStyle = K; c.lineWidth = u * .1;
        c.beginPath(); c.moveTo(-.24 * u, 0); c.lineTo(.24 * u, 0); c.stroke();
        c.strokeStyle = '#3b3530'; c.lineWidth = u * .05;
        c.beginPath(); c.moveTo(-.22 * u, 0); c.lineTo(.22 * u, 0); c.stroke();
        c.fillStyle = '#1a1714';
        c.beginPath(); c.ellipse(-.02 * u, 0, .1 * u, .07 * u, .3, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(120,120,120,.85)'; c.lineWidth = Math.max(1, u * .03);
        c.beginPath(); c.moveTo(0, -.06 * u); c.quadraticCurveTo(.08 * u, -.14 * u, 0, -.2 * u); c.quadraticCurveTo(-.08 * u, -.26 * u, .02 * u, -.32 * u); c.stroke();
        break;
      case 'led':
        if (pol.otoceno) c.scale(-1, 1);
        c.strokeStyle = K; c.lineWidth = u * .035;
        c.beginPath(); c.moveTo(-.28 * u, 0); c.lineTo(.28 * u, 0); c.stroke();
        c.fillStyle = '#e74c3c'; c.lineWidth = lw;
        c.beginPath(); c.arc(0, 0, .14 * u, -1.25, 1.25, true); c.closePath(); c.fill(); c.stroke();   // plochá strana = katoda vpravo
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-.05 * u, -.05 * u, .04 * u, 0, TAU); c.fill();
        break;
      case 'kondenzator':
        c.fillStyle = '#2b5fa8'; c.strokeStyle = K; c.lineWidth = lw;
        c.beginPath(); c.arc(0, 0, .14 * u, 0, TAU); c.fill(); c.stroke();
        break;
      default:
        c.fillStyle = '#2a2a2a'; c.strokeStyle = K; c.lineWidth = lw;
        c.beginPath(); c.arc(0, 0, .13 * u, 0, TAU); c.fill(); c.stroke();
    }
    c.restore();
  }

  function kresliPrivod(c, sn, skryjPrvni) {
    const p = level.privodPos; if (!p) return;
    const [dx, dy] = p.posun;
    const bx = stredX(p.x + dx), by = stredY(p.y + dy) - .2 * T, lw = Math.max(1.5, T * .03);
    const ret = bodPrivodu();
    // skluz
    c.strokeStyle = K; c.lineWidth = .26 * T; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ret.x, ret.y); c.stroke();
    c.strokeStyle = '#b9c1c9'; c.lineWidth = .26 * T - 2 * lw;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ret.x - dx * lw, ret.y - dy * lw); c.stroke();
    // skříň
    const w = .84 * T, h = .5 * T, celo = .16 * T;
    c.lineWidth = lw; c.strokeStyle = K;
    c.fillStyle = '#20252b'; c.fillRect(bx - w / 2, by - h / 2 + h, w, celo); c.strokeRect(bx - w / 2, by - h / 2 + h, w, celo);
    c.fillStyle = '#3a414a'; c.fillRect(bx - w / 2, by - h / 2, w, h); c.strokeRect(bx - w / 2, by - h / 2, w, h);
    c.fillStyle = W; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.max(7, Math.round(T * .12))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.fillText('PŘÍVOD', bx, by + h * .62);
    // počet
    const n = sn.privod.length - (skryjPrvni ? 1 : 0);
    c.fillStyle = n ? Y : '#d8dde3'; c.beginPath(); c.arc(bx + w / 2 - .06 * T, by - h / 2 + .02 * T, .15 * T, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = K; c.font = `800 ${Math.max(8, Math.round(T * .16))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.fillText(String(Math.max(0, sn.privod.length)), bx + w / 2 - .06 * T, by - h / 2 + .03 * T);
    // okénko s další součástkou
    c.fillStyle = '#c9d6cf'; c.fillRect(bx - w * .38, by - h * .32, w * .52, h * .5); c.strokeRect(bx - w * .38, by - h * .32, w * .52, h * .5);
    if (sn.privod.length) kresliPolozku(c, sn.privod[0], bx - w * .12, by - h * .07, .62);
    // součástka připravená na kraji skluzu
    if (sn.privod.length && !skryjPrvni) kresliPolozku(c, sn.privod[0], ret.x, ret.y, .9, dx ? Math.PI / 2 : 0);
  }

  function kresliVystup(c, sn, v) {
    if (level.kontrola === 'dojdi') return kresliCilBludiste(c, v);
    const [dx, dy] = v.posun, kos = v.znak === 'K';
    const bx = stredX(v.x + dx), by = stredY(v.y + dy) - .2 * T, lw = Math.max(1.5, T * .03);
    const w = .86 * T, h = .52 * T, celo = .2 * T;
    const mono = px => `800 ${Math.max(7, Math.round(px))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.lineWidth = lw; c.strokeStyle = K;
    c.fillStyle = kos ? '#6b7178' : '#f7f8fa'; c.fillRect(bx - w / 2, by - h / 2, w, h); c.strokeRect(bx - w / 2, by - h / 2, w, h);
    c.fillStyle = kos ? '#3c4147' : '#c3ccd5'; c.fillRect(bx - w / 2 + .07 * T, by - h / 2 + .06 * T, w - .14 * T, h - .1 * T);
    const moje = sn.vystup.filter(p => (p.kam || 'V') === v.znak);
    moje.forEach((p, i) => {
      const k = i % 4, r = Math.floor(i / 4) % 2;
      kresliPolozku(c, p, bx - w * .26 + k * w * .17, by - h * .12 + r * h * .28, .55, .5 + i * .7);
    });
    c.fillStyle = kos ? '#4a4f55' : '#e4e9ee'; c.fillRect(bx - w / 2, by + h / 2, w, celo); c.strokeRect(bx - w / 2, by + h / 2, w, celo);
    c.fillStyle = kos ? W : K; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = T * .12; c.font = mono(fs);
    while (fs > 6 && c.measureText(v.popis).width > w - 6) { fs -= .5; c.font = mono(fs); }
    c.fillText(v.popis, bx, by + h / 2 + celo * .54);
    if (v.znak !== 'V' && !kos) {                      // písmeno výstupu
      c.fillStyle = K; c.fillRect(bx - w / 2, by - h / 2, .26 * T, .24 * T);
      c.fillStyle = W; c.font = mono(T * .16); c.fillText(v.znak, bx - w / 2 + .13 * T, by - h / 2 + .13 * T);
    }
    c.fillStyle = W; c.strokeStyle = K; c.beginPath(); c.arc(bx + w / 2 - .06 * T, by - h / 2 + .02 * T, .15 * T, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = K; c.font = mono(T * .16);
    c.fillText(String(moje.length), bx + w / 2 - .06 * T, by - h / 2 + .03 * T);
  }

  // Cíl bludiště: praporek přímo na políčku výstupu.
  function kresliCilBludiste(c, v) {
    const x = stredX(v.x), y = stredY(v.y), lw = Math.max(1.5, T * .03);
    c.lineWidth = lw; c.strokeStyle = K;
    c.beginPath(); c.moveTo(x - .05 * T, y + .2 * T); c.lineTo(x - .05 * T, y - .45 * T); c.stroke();
    c.fillStyle = Y; c.beginPath(); c.moveTo(x - .05 * T, y - .45 * T); c.lineTo(x + .32 * T, y - .32 * T); c.lineTo(x - .05 * T, y - .19 * T); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(16,19,23,.25)'; c.beginPath(); c.ellipse(x - .05 * T, y + .2 * T, .1 * T, .04 * T, 0, 0, TAU); c.fill();
  }

  // Obvod: značky polarity, cín na zapájených paticích, rozsvícené LED.
  function kresliObvod(c, sn, vrch) {
    if (!level.obvod) return;
    for (const o of level.obvod) {
      const k = o.x + ',' + o.y, cx = stredX(o.x), cy = stredY(o.y);
      if (!vrch) {
        if (o.druh === 'led') {
          const sx = sn.znacky && sn.znacky[k] ? 1 : -1;
          c.fillStyle = POTISK; c.font = `900 ${Math.max(9, Math.round(T * .2))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('+', cx + sx * .41 * T, cy - .02 * T);
        }
        continue;
      }
      if (sn.cin && sn.cin[k]) {
        for (const sx of [-1, 1]) {
          c.fillStyle = '#e9edf0'; c.strokeStyle = '#7d868e'; c.lineWidth = 1;
          c.beginPath(); c.ellipse(cx + sx * .25 * T, cy, .07 * T, .055 * T, 0, 0, TAU); c.fill(); c.stroke();
          c.fillStyle = W; c.beginPath(); c.arc(cx + sx * .25 * T - .02 * T, cy - .015 * T, .015 * T, 0, TAU); c.fill();
        }
      }
      if (o.druh === 'led' && sn.podlaha && S.sviti(level, sn, o)) {
        const gr = c.createRadialGradient(cx, cy, 0, cx, cy, .9 * T);
        gr.addColorStop(0, 'rgba(255,90,60,.85)'); gr.addColorStop(.25, 'rgba(255,80,50,.45)'); gr.addColorStop(1, 'rgba(255,80,50,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, .9 * T, 0, TAU); c.fill();
        c.fillStyle = '#fff3e0'; c.beginPath(); c.arc(cx - .01 * T, cy + .01 * T, .06 * T, 0, TAU); c.fill();
      }
    }
  }

  function kresliPodlahu(c, sn) {
    for (const k in sn.podlaha) {
      const [x, y] = k.split(',').map(Number), b = bodPolozeni(x, y);
      kresliPolozku(c, sn.podlaha[k], b.x, b.y, .9, .25);
    }
    sn.rozsypano.forEach((r, i) => {
      const b = naZemi(r.x, r.y);
      kresliPolozku(c, r.polozka, b.x + (i % 2 ? .16 : -.14) * T, b.y - (i % 2) * .06 * T, .75, 1 + i * 2.1);
      c.strokeStyle = K; c.lineWidth = 1.5;
      for (let j = 0; j < 3; j++) {
        const a = i * 2 + j * 2.2, d = .26 * T;
        c.beginPath(); c.moveTo(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * .6);
        c.lineTo(b.x + Math.cos(a) * (d + .06 * T), b.y + Math.sin(a) * (d + .06 * T) * .6); c.stroke();
      }
    });
  }

  // ---------- panáček ----------

  // (x, y) je bod mezi chodidly. Vrací pozici hlavy pro bublinu.
  function kresliPanacka(c, x, y, smer, o) {
    const u = T / 8.2, r = 1.45 * u, lw = Math.max(1.4, u * .3), t = o.t || 0;
    const vy = o.vyskok || 0;
    c.save();
    c.fillStyle = 'rgba(16,19,23,.22)';
    c.beginPath(); c.ellipse(x, y + .15 * u, 2.2 * u * (1 - Math.min(.4, vy / (10 * u))), .7 * u, 0, 0, TAU); c.fill();
    y -= vy;
    const bok = smer === 1 || smer === 3, sx = smer === 3 ? -1 : 1;
    const dech = o.dech ? Math.sin(t / 450) * .12 * u : 0;
    const spi = o.poza === 'spi';
    const hip = { x, y: y - 2.8 * u }, neck = { x, y: y - 5.5 * u + dech + (spi ? .4 * u : 0) };
    const hc = { x: x + (spi ? .35 * u : 0), y: neck.y - r * .95 }, sh = { x, y: neck.y + .5 * u };
    const sw = Math.sin((o.faze || 0) * TAU);
    c.lineCap = c.lineJoin = 'round'; c.strokeStyle = K; c.lineWidth = lw;

    const oblouk = (a, b, ox, oy) => {
      c.beginPath(); c.moveTo(a.x, a.y);
      c.quadraticCurveTo((a.x + b.x) / 2 + ox, (a.y + b.y) / 2 + oy, b.x, b.y); c.stroke();
    };
    // nohy
    let n1, n2;
    if (bok) { n1 = { x: x + sx * sw * 1.3 * u, y }; n2 = { x: x - sx * sw * 1.3 * u, y }; }
    else { n1 = { x: x - .75 * u, y: y - Math.max(0, sw) * .7 * u }; n2 = { x: x + .75 * u, y: y - Math.max(0, -sw) * .7 * u }; }
    if (o.skrcene) { n1.y -= 1.1 * u; n2.y -= 1.1 * u; }
    oblouk(hip, n1, bok ? sx * .5 * u : -.3 * u, 0); oblouk(hip, n2, bok ? sx * .5 * u : .3 * u, 0);
    // trup
    c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(neck.x, neck.y); c.stroke();
    // ruce
    const klid = bok
      ? [{ x: x - sx * sw * 1.1 * u, y: y - 2.5 * u }, { x: x + sx * sw * 1.1 * u, y: y - 2.5 * u }]
      : [{ x: x - 1.7 * u, y: y - 2.7 * u }, { x: x + 1.7 * u, y: y - 2.7 * u }];
    const nahore = [{ x: x - 1.0 * u, y: hc.y - r - 1.0 * u }, { x: x + 1.0 * u, y: hc.y - r - 1.0 * u }];
    let ruce = klid.map((p, i) => lerpP(p, nahore[i], o.nahoru || 0));
    if (o.poza === 'krci') ruce = [{ x: x - 2.4 * u, y: sh.y - .9 * u }, { x: x + 2.4 * u, y: sh.y - .9 * u }];
    if (o.ruceCil && o.ruceK) {
      const cil = [{ x: o.ruceCil.x - .45 * u, y: o.ruceCil.y }, { x: o.ruceCil.x + .45 * u, y: o.ruceCil.y }];
      ruce = ruce.map((p, i) => lerpP(p, cil[i], o.ruceK));
    }
    // kapsa na boku (od kapitoly 4); při pohledu zboku je za zády
    const kp = { x: x + (bok ? -sx * 1.15 * u : 1.55 * u), y: hip.y + .25 * u };
    if (o.kapsaK) ruce = ruce.map((p, i) => lerpP(p, { x: kp.x + (i ? .3 : -.3) * u, y: kp.y - .2 * u }, o.kapsaK));
    const kreslitKapsu = () => {
      if (!o.sKapsou) return;
      if (o.kapsa) kresliPolozku(c, o.kapsa, kp.x, kp.y - .7 * u, .55, -.5);
      c.fillStyle = '#b5884f'; c.lineWidth = lw * .8;
      zaoblene(c, kp.x - .85 * u, kp.y - .55 * u, 1.7 * u, 1.35 * u, .35 * u); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(kp.x - .85 * u, kp.y - .1 * u); c.lineTo(kp.x + .85 * u, kp.y - .1 * u); c.stroke();
      c.lineWidth = lw;
    };
    if (bok) kreslitKapsu();
    ruce.forEach((h, i) => oblouk(sh, h, (i ? 1 : -1) * .7 * u, .2 * u));
    if (!bok) kreslitKapsu();
    // kšilt za hlavou (pohled zezadu)
    const ksiltZezadu = () => {
      c.fillStyle = (o.barva || TEAL); c.beginPath(); c.ellipse(hc.x, hc.y - r * .98, r * .78, r * .3, 0, 0, TAU); c.fill(); c.stroke();
    };
    if (smer === 0) ksiltZezadu();
    // hlava a čepice
    c.fillStyle = W; c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.fill(); c.stroke();
    const a0 = smer === 0 ? -.28 : .18;
    c.fillStyle = (o.barva || TEAL); c.beginPath(); c.arc(hc.x, hc.y, r, Math.PI + a0, -a0); c.closePath(); c.fill(); c.stroke();
    // obličej a kšilt
    c.fillStyle = K;
    const oko = (ex, ey) => {
      if (o.oci === 'zavrene' || spi) { c.lineWidth = lw * .8; c.beginPath(); c.moveTo(ex - .2 * r, ey); c.lineTo(ex + .2 * r, ey); c.stroke(); c.lineWidth = lw; }
      else if (o.oci === 'velke') { c.fillStyle = W; c.beginPath(); c.arc(ex, ey, .2 * r, 0, TAU); c.fill(); c.lineWidth = lw * .7; c.stroke(); c.lineWidth = lw; c.fillStyle = K; c.beginPath(); c.arc(ex, ey, .07 * r, 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(ex, ey, Math.max(1.1, .12 * r), 0, TAU); c.fill(); }
    };
    if (smer === 2) {
      c.fillStyle = (o.barva || TEAL); c.beginPath(); c.ellipse(hc.x, hc.y - .12 * r, r * 1.0, r * .3, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = K; oko(hc.x - .38 * r, hc.y + .36 * r); oko(hc.x + .38 * r, hc.y + .36 * r);
    } else if (bok) {
      const k0 = { x: hc.x + sx * .5 * r, y: hc.y - .3 * r }, k1 = { x: hc.x + sx * 1.62 * r, y: hc.y - .14 * r };
      c.lineWidth = lw * 2.6; c.beginPath(); c.moveTo(k0.x, k0.y); c.lineTo(k1.x, k1.y); c.stroke();
      c.strokeStyle = (o.barva || TEAL); c.lineWidth = lw * 1.2; c.beginPath(); c.moveTo(k0.x, k0.y); c.lineTo(k1.x - sx * lw * .4, k1.y); c.stroke();
      c.strokeStyle = K; c.lineWidth = lw; c.fillStyle = K;
      oko(hc.x + sx * .5 * r, hc.y + .16 * r);
    }
    // nesená součástka mezi rukama
    if (o.polozka) {
      const m = lerpP(ruce[0], ruce[1], .5);
      kresliPolozku(c, o.polozka, m.x, m.y - .35 * u, .9, o.uhelPolozky || 0);
    }
    // výbava, kterou panáček nosí od kapitoly, kde ji našel
    const vyb = level.kapitola || 1, hrud = { x, y: neck.y + 1.1 * u };
    if (vyb >= 2 && !bok) {                          // svačina v krabičce na druhém boku
      c.fillStyle = '#7cc0e0'; c.lineWidth = lw * .8;
      zaoblene(c, x - 2.25 * u, hip.y - .1 * u, 1.3 * u, .95 * u, .2 * u); c.fill(); c.stroke(); c.lineWidth = lw;
    }
    if (vyb >= 3 && smer !== 0) {                    // lupa na krku
      const lx = hrud.x + (bok ? sx * .35 * u : -.35 * u);
      c.lineWidth = lw * .6; c.beginPath(); c.moveTo(neck.x, neck.y + .1 * u); c.lineTo(lx, hrud.y - .5 * u); c.stroke();
      c.fillStyle = 'rgba(190,225,240,.9)'; c.lineWidth = lw * .9;
      c.beginPath(); c.arc(lx, hrud.y, .55 * u, 0, TAU); c.fill(); c.stroke(); c.lineWidth = lw;
    }
    if (vyb >= 6 && smer !== 0) {                    // píšťalka na šňůrce
      const px = hrud.x + (bok ? -sx * .2 * u : .55 * u);
      c.lineWidth = lw * .6; c.beginPath(); c.moveTo(neck.x, neck.y + .1 * u); c.lineTo(px, hrud.y + .5 * u); c.stroke();
      c.fillStyle = Y; c.lineWidth = lw * .8; zaoblene(c, px - .2 * u, hrud.y + .45 * u, .9 * u, .45 * u, .2 * u); c.fill(); c.stroke(); c.lineWidth = lw;
    }
    if (o.pajka) {                                   // páječka v pravé ruce
      const h = ruce[1], tip = { x: h.x + .5 * u, y: h.y + 1.6 * u };
      c.strokeStyle = K; c.lineWidth = lw * 2.6; c.beginPath(); c.moveTo(h.x - .3 * u, h.y - .9 * u); c.lineTo(h.x + .1 * u, h.y + .4 * u); c.stroke();
      c.strokeStyle = '#d0453a'; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(h.x - .3 * u, h.y - .9 * u); c.lineTo(h.x + .1 * u, h.y + .4 * u); c.stroke();
      c.strokeStyle = '#8d959c'; c.lineWidth = lw; c.beginPath(); c.moveTo(h.x + .1 * u, h.y + .4 * u); c.lineTo(tip.x, tip.y); c.stroke();
      c.strokeStyle = K;
      if (o.dym != null && o.dym > .3) {
        const d = (o.dym - .3) / .7;
        c.strokeStyle = `rgba(150,150,150,${.9 - d * .8})`; c.lineWidth = Math.max(1.2, u * .25);
        c.beginPath(); c.moveTo(tip.x, tip.y - .3 * u);
        c.quadraticCurveTo(tip.x + 1.2 * u, tip.y - 1.5 * u - d * 2 * u, tip.x - .2 * u, tip.y - 2.5 * u - d * 3 * u); c.stroke();
        c.strokeStyle = K;
      }
    }
    if (o.hvezdy) {
      for (let i = 0; i < 3; i++) {
        const a = t / 220 + i * TAU / 3;
        hvezda(c, hc.x + Math.cos(a) * r * 1.6, hc.y - r * .9 + Math.sin(a) * r * .5, .55 * u);
      }
    }
    c.restore();
    return { x: hc.x, y: hc.y - r - (o.polozka || o.nahoru > .5 ? 2.4 * u : .3 * u) };
  }

  function hvezda(c, x, y, s) {
    c.fillStyle = Y; c.strokeStyle = K; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? s * .4 : s; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.closePath(); c.fill(); c.stroke();
  }

  // Visí za jednu ruku na hraně cestičky; (gx, gy) je bod úchopu.
  function kresliVisiciho(c, gx, gy, smer, t, barva = TEAL) {
    const u = T / 8.2, r = 1.45 * u, lw = Math.max(1.4, u * .3);
    c.save(); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = K; c.lineWidth = lw;
    if (smer === 0) {                          // za horní hranou: jen temeno a prsty
      const hy = gy - .9 * u;
      c.fillStyle = barva; c.beginPath(); c.ellipse(gx, hy - r * .7, r * .72, r * .26, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = W; c.beginPath(); c.arc(gx, hy, r, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = barva; c.beginPath(); c.arc(gx, hy, r, Math.PI + .1, -.1); c.closePath(); c.fill(); c.stroke();
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(gx + s * 1.6 * u, gy - .2 * u); c.lineTo(gx + s * 1.8 * u, gy + .5 * u); c.stroke(); }
      c.restore();
      return { x: gx, y: hy - r * 1.4 };
    }
    c.translate(gx, gy); c.rotate(Math.sin(t / 380) * .14);
    const sh = { x: 1.15 * u, y: 3.5 * u }, neck = { x: 1.3 * u, y: 3.2 * u }, hip = { x: 1.3 * u, y: 6 * u };
    const hc = { x: 2.3 * u, y: 2.1 * u }, kop = Math.sin(t / 130) * .7 * u;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(sh.x, sh.y); c.stroke();                       // ruka v úchopu
    c.beginPath(); c.moveTo(neck.x, neck.y); c.lineTo(hip.x, hip.y); c.stroke();
    c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(.5 * u + kop, 8.7 * u); c.stroke();
    c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(2.1 * u - kop, 8.7 * u); c.stroke();
    c.beginPath(); c.moveTo(sh.x, sh.y); c.quadraticCurveTo(2.6 * u, 3.4 * u, 3.4 * u, 4.4 * u + Math.sin(t / 110) * .9 * u); c.stroke();
    c.fillStyle = W; c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = barva; c.beginPath(); c.arc(hc.x, hc.y, r, Math.PI + .18, -.18); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(hc.x, hc.y - .12 * r, r, r * .3, 0, 0, TAU); c.fill(); c.stroke();
    for (const s of [-1, 1]) {
      c.fillStyle = W; c.lineWidth = lw * .7; c.beginPath(); c.arc(hc.x + s * .4 * r, hc.y + .32 * r, .2 * r, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = K; c.beginPath(); c.arc(hc.x + s * .4 * r, hc.y + .32 * r, .07 * r, 0, TAU); c.fill();
    }
    c.lineWidth = lw * .7; c.beginPath(); c.ellipse(hc.x, hc.y + .74 * r, .13 * r, .17 * r, 0, 0, TAU); c.stroke();
    c.fillStyle = W; c.beginPath(); c.arc(0, 0, .45 * u, 0, TAU); c.fill(); c.stroke();     // pěst na hraně
    c.restore();
    return { x: gx + 2 * u, y: gy };
  }

  function kresliBublinu(c, text, x, y) {
    const fs = Math.max(11, Math.round(T * .19));
    c.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    const w = c.measureText(text).width + fs * 1.1, h = fs * 1.75;
    const bx = Math.max(3, Math.min(CW - w - 3, x - w / 2)), by = Math.max(2, y - h - fs * .55);
    const tx = Math.max(bx + 8, Math.min(bx + w - 8, x));
    c.fillStyle = W; c.strokeStyle = K; c.lineWidth = 1.5;
    zaoblene(c, bx, by, w, h, fs * .35); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(tx - 5, by + h - .5); c.lineTo(tx, by + h + fs * .5); c.lineTo(tx + 5, by + h - .5); c.fill(); c.stroke();
    c.fillRect(tx - 4, by + h - 2, 8, 2.5);
    c.fillStyle = K; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, bx + w / 2, by + h / 2 + 1);
  }

  // Políčko před panáčkem: kam udělá příští krok.
  function kresliCil(c, x, y) {
    const b = S.bunka(level, x, y), cx = stredX(x), cy = stredY(y), a = .4 * T;
    c.save(); c.lineWidth = Math.max(2, T * .04);
    if (S.jeCesta(b)) {
      c.fillStyle = 'rgba(242,183,5,.32)'; c.strokeStyle = Y;
      zaoblene(c, cx - a, cy - a, 2 * a, 2 * a, .12 * T); c.fill(); c.stroke();
    } else {
      c.strokeStyle = b === 'X' ? '#e67e22' : RED; c.setLineDash([.1 * T, .07 * T]);
      zaoblene(c, cx - a, cy - a, 2 * a, 2 * a, .12 * T); c.stroke();
    }
    c.restore();
  }

  // Co a kde kreslit za daného stavu animace.
  // A = { stav, pred, po } pohledy na stav pro tohoto panáčka; i = jeho pořadí.
  function postava(now, ev, p, A, i) {
    const o = { t: now, dech: true, barva: BARVY_CEPIC[i] };
    const poza = pozaPro(i);
    if (!ev) {
      const st = A.stav, [dx, dy] = S.SMERY[st.smer];
      if (poza === 'visi') {
        const c = stred(st.x, st.y);
        return { visi: { x: c.x - dx * .64 * T, y: c.y - dy * .64 * T }, smer: st.smer };
      }
      Object.assign(o, { polozka: st.drzi, nahoru: st.drzi ? 1 : 0, kapsa: st.kapsa, sKapsou: sKapsou() });
      if (poza === 'jasa') { o.nahoru = 1; o.vyskok = Math.abs(Math.sin(now / 160)) * .2 * T; o.dech = false; }
      if (poza === 'krci' || poza === 'spi') o.poza = poza;
      const z = zem(st.x, st.y);
      return { x: z.x, y: z.y, smer: st.smer, o, cil: poza === 'stoji' ? { x: st.x + dx, y: st.y + dy } : null };
    }
    const z = ev.z, na = ev.na || z, [dx, dy] = S.SMERY[z.smer];
    let pos = zem(z.x, z.y), smer = z.smer;
    o.polozka = A.pred.drzi; o.nahoru = A.pred.drzi ? 1 : 0; o.dech = false;
    o.sKapsou = sKapsou(); o.kapsa = p < .5 ? A.pred.kapsa : A.po.kapsa;
    let cil = { x: na.x + S.SMERY[na.smer][0], y: na.y + S.SMERY[na.smer][1] };
    switch (ev.typ) {
      case 'krok': pos = lerpP(zem(z.x, z.y), zem(na.x, na.y), ease(p)); o.faze = p; break;
      case 'skok': pos = lerpP(zem(z.x, z.y), zem(na.x, na.y), ease(p)); o.vyskok = Math.sin(p * Math.PI) * .5 * T; o.skrcene = p > .1 && p < .9; break;
      case 'otoc':
        smer = p < .5 ? z.smer : na.smer; o.faze = p * .5;
        cil = { x: z.x + S.SMERY[smer][0], y: z.y + S.SMERY[smer][1] };
        break;
      case 'naraz': {
        const k = p < .35 ? ease(p / .35) : 1 - ease((p - .35) / .65);
        pos = { x: pos.x + dx * .3 * T * k, y: pos.y + dy * .3 * T * k }; o.faze = p * .5; o.hvezdy = p > .35;
        break;
      }
      case 'pad': {
        const c = stred(na.x, na.y), grip = { x: c.x - dx * .64 * T, y: c.y - dy * .64 * T };
        if (p >= .5) return { visi: grip, smer: z.smer };
        pos = lerpP(pos, { x: grip.x, y: grip.y + .16 * T }, ease(p / .5)); o.faze = p; cil = null;
        if (ev.skok) o.vyskok = Math.sin(p / .5 * Math.PI) * .4 * T;
        break;
      }
      case 'zvedni': {
        const src = ev.odkud === 'privod' ? bodPrivodu() : bodPolozeni(z.x, z.y);
        o.ruceCil = src;
        if (p < .45) { o.ruceK = ease(p / .45); o.polozka = null; o.nahoru = 0; }
        else { const k = ease((p - .45) / .55); o.ruceK = 1 - k; o.nahoru = k; o.polozka = ev.polozka; }
        break;
      }
      case 'poloz': case 'rozsyp': {
        const dst = ev.kam === 'vystup' ? bodVystupu(ev.vystup) : bodPolozeni(z.x, z.y);
        o.ruceCil = dst;
        if (p < .55) { const k = ease(p / .55); o.nahoru = 1 - k; o.ruceK = k; o.polozka = ev.polozka; }
        else { o.nahoru = 0; o.ruceK = 1 - ease((p - .55) / .45); o.polozka = null; }
        break;
      }
      case 'hmat': case 'prazdnaRuka': {
        const pp = level.privodPos, naP = pp && z.x === pp.x && z.y === pp.y;
        const src = naP && ev.typ === 'hmat' ? bodPrivodu() : naZemi(z.x, z.y);
        o.ruceCil = { x: src.x + Math.sin(p * TAU * 2) * .08 * T, y: src.y }; o.ruceK = Math.sin(p * Math.PI);
        if (ev.typ === 'prazdnaRuka') o.nahoru = 0;
        break;
      }
      case 'hvizd':
        o.ruceCil = { x: pos.x + (smer === 3 ? -.12 : .12) * T, y: pos.y - .62 * T }; o.ruceK = Math.sin(p * Math.PI) * .9;
        break;
      case 'ceka': case 'dockal': o.dech = true; break;
      case 'plnaRuka': case 'plnaKapsa': case 'prazdnaKapsa':
        pos = { x: pos.x + Math.sin(p * TAU * 3) * .03 * T, y: pos.y }; break;
      case 'pajej': case 'vypajej': case 'pajejNaprazdno': case 'uzPajeno': case 'neniCin': case 'pripajeno': {
        o.ruceCil = bodPolozeni(z.x, z.y); o.ruceK = Math.sin(p * Math.PI); o.pajka = ev.typ !== 'pripajeno';
        if (ev.typ === 'pajej' || ev.typ === 'vypajej') o.dym = p;
        break;
      }
      case 'otocSoucastku':
        o.polozka = p < .5 ? A.pred.drzi : A.po.drzi;
        o.uhelPolozky = (p < .5 ? p : p - 1) * Math.PI;
        break;
      case 'doKapsy': case 'zKapsy': case 'prohod': {
        // ruce s věcí dolů ke kapse, výměna v polovině, zpátky nahoru
        const k = Math.sin(p * Math.PI);
        o.kapsaK = k;
        o.polozka = p < .5 ? A.pred.drzi : A.po.drzi;
        o.nahoru = (p < .5 ? A.pred.drzi : A.po.drzi) ? 1 : 0;
        break;
      }
    }
    return { x: pos.x, y: pos.y, smer, o, cil };
  }

  function prepnuti(ev) { return ev.typ === 'zvedni' ? .45 : (ev.typ === 'poloz' || ev.typ === 'rozsyp') ? .55 : .5; }

  function kresli(now) {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, CW, CH);
    g.drawImage(podklad, 0, 0, CW, CH);
    const ev = vis.ev, p = ev ? (vis.dur ? Math.min(1, (now - vis.t0) / vis.dur) : 1) : 1;
    const sn = ev ? (p < prepnuti(ev) ? vis.pred : vis.po) : vis.stav;
    const figury = [];
    for (let i = 0; i < pocetPanacku(); i++) {
      const evI = ev ? (ev.typ === 'vice' ? ev.udalosti.find(e => e.panacek === i) || null : ev) : null;
      const A = evI ? { stav: pohled(vis.stav, i), pred: pohled(vis.pred, i), po: pohled(vis.po, i) }
        : { stav: pohled(ev ? vis.po : vis.stav, i) };
      figury.push(postava(now, evI, p, A, i));
    }
    for (const f of figury) if (f.cil) kresliCil(g, f.cil.x, f.cil.y);
    kresliObvod(g, sn, false);
    kresliPodlahu(g, sn);
    kresliObvod(g, sn, true);
    // zásobníky a panáček podle hloubky (co je níž, je blíž)
    const veci = [];
    if (level.privodPos) veci.push([level.privodPos.y + level.privodPos.posun[1], () => kresliPrivod(g, sn, false)]);
    for (const v of level.vystupy) veci.push([level.kontrola === 'dojdi' ? v.y : v.y + v.posun[1], () => kresliVystup(g, sn, v)]);
    const hlavy = [];
    figury.forEach((f, i) => {
      const py = f.visi ? (f.visi.y - OY) / T : (f.y - OY) / T - .5;
      veci.push([py, () => { hlavy[i] = f.visi ? kresliVisiciho(g, f.visi.x, f.visi.y, f.smer, now, BARVY_CEPIC[i]) : kresliPanacka(g, f.x, f.y, f.smer, f.o); }]);
    });
    veci.sort((a, b) => a[0] - b[0]).forEach(v => v[1]());
    hlavy.forEach((h, i) => { const b = vis.bubliny[i]; if (b && h && now < b.do) kresliBublinu(g, b.text, h.x, h.y); });
    kresliOziveni(g, now);
  }

  // ---------- oživení desky po finále ----------

  function ozivit() {
    vis.oziveni = performance.now();
    try {                                              // krátká znělka, smí selhat
      const A = window.AudioContext || window.webkitAudioContext, a = new A();
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
        const o = a.createOscillator(), gn = a.createGain(), t = a.currentTime + 1.4 + i * .14;
        o.type = 'square'; o.frequency.value = f;
        gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.06, t + .01); gn.gain.exponentialRampToValueAtTime(.001, t + (i === 5 ? .5 : .13));
        o.connect(gn); gn.connect(a.destination); o.start(t); o.stop(t + .6);
      });
    } catch (e) { /* bez zvuku */ }
  }

  function kresliOziveni(c, now) {
    if (!vis.oziveni) return;
    const t = (now - vis.oziveni) / 1000;
    if (t < 1.2) {                                     // světla probliknou jedno po druhém
      const n = (level.obvod || []).filter(o => o.druh === 'led');
      n.forEach((o, i) => {
        if (Math.floor(t * 8) % n.length !== i) return;
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(stredX(o.x), stredY(o.y), .22 * T, 0, TAU); c.fill();
      });
      return;
    }
    const w = Math.min(CW - 16, 7.2 * T), h = 2.2 * T, x = (CW - w) / 2, y = OY + (level.vyska * T - h) / 2;
    const k = Math.min(1, (t - 1.2) / .3);
    c.save(); c.globalAlpha = k;
    c.fillStyle = '#0b1f14'; c.strokeStyle = K; c.lineWidth = 2;
    zaoblene(c, x, y, w, h, .12 * T); c.fill(); c.stroke();
    const radky = ['MALY.CZ BASIC 1.0', '64K RAM OK', '', 'MALY.CZ READY'];
    const fs = Math.max(11, Math.round(T * .24));
    c.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.fillStyle = '#7dff9a'; c.textAlign = 'left'; c.textBaseline = 'top';
    let znaku = Math.floor((t - 1.5) * 28);
    radky.forEach((r, i) => {
      if (znaku <= 0) return;
      c.fillText(r.slice(0, znaku), x + .3 * T, y + .25 * T + i * fs * 1.25);
      znaku -= r.length + 4;
    });
    if (znaku > 0 && Math.floor(t * 2.5) % 2) c.fillRect(x + .3 * T, y + .25 * T + 4 * fs * 1.25, fs * .6, fs);
    c.restore();
  }

  // ---------- běh programu ----------

  const BUBLINY = {
    naraz: 'Au!', hmat: 'Nic tu není.', plnaRuka: 'Mám plné ruce.', prazdnaRuka: 'Nic nedržím.', rozsyp: 'Jejda!', pad: 'Áááá!',
    plnaKapsa: 'Kapsa je plná.', prazdnaKapsa: 'Kapsa je prázdná.',
    pajejNaprazdno: 'Není co pájet.', uzPajeno: 'Už je zapájeno.', neniCin: 'Tady nic připájené není.', pripajeno: 'Je to připájené.',
    hvizd: '♪ Fííí!', ceka: '…',
  };
  const sKapsou = () => (level.bloky || []).includes('uloz');

  function bublina(text, ms, i = 0) { vis.bubliny[i] = { text, do: performance.now() + (ms || 1500) }; }
  function bublinaVsem(text, ms) { for (let i = 0; i < pocetPanacku(); i++) bublina(text, ms, i); }

  // Víc panáčků: pohled na stav pro panáčka i (svět společný, poloha a ruce jeho).
  const pocetPanacku = () => level.startPoz ? level.startPoz.length : 1;
  const pohled = (sn, i) => sn && sn.ag ? Object.assign({}, sn, sn.ag[i]) : sn;
  const pozaPro = i => (vis.pozy && vis.pozy[i]) || vis.poza;
  const BARVY_CEPIC = ['#006c86', '#e0820b'];
  const programyProBeh = () => level.startPoz ? programy : program;
  const prazdnyProgram = () => level.startPoz ? programy.every(p => !p.length) : !program.length;

  function zacni() {
    vis = vychoziVis();
    beh = { stav: S.novyStav(level, S.zadani(level, testIdx)), stroj: level.startPoz ? programy.map(S.stroj) : S.stroj(program), bezi: false, hotovo: false, krokovani: false };
    document.body.classList.add('bezi');
  }

  function zastav() {
    document.querySelectorAll('#program .podezrely').forEach(e => e.classList.remove('podezrely'));
    beh = null;
    vis = vychoziVis();
    document.body.classList.remove('bezi');
    zvyrazni(null);
    ovladani(); stavRadek();
  }

  function dalsiTakt() {
    const pred = vis.stav;
    const ev = S.takt(level, beh.stav, beh.stroj);
    if (!ev) return;
    if (ev.typ === 'konec' || ev.typ === 'konecSmeny' || ev.typ === 'usnul' || (ev.typ === 'vice' && !ev.udalosti.length)) {
      vis.stav = S.snimek(beh.stav); konecBehu(); return;
    }
    vis.pred = pred; vis.po = S.snimek(beh.stav); vis.ev = ev;
    vis.t0 = performance.now(); vis.dur = beh.krokovani ? KROKOVANI : RYCHLOST[rychlost] || KROKOVANI;
    for (const u of ev.typ === 'vice' ? ev.udalosti : [ev])
      if (BUBLINY[u.typ]) bublina(BUBLINY[u.typ], u.typ === 'ceka' ? vis.dur * 1.2 : Math.max(900, vis.dur * 2.5), u.panacek || 0);
    zapamatuj(ev);
    zvyrazni(ev);
    stavRadek();
  }

  function dokonciUdalost() {
    vis.ev = null; vis.stav = vis.po;
    if (beh.stav.konec) { konecBehu(); return; }
    if (beh.bezi) dalsiTakt(); else { ovladani(); stavRadek(); }
  }

  // Kdo co naposledy vykonal; při pádu je to blok, kvůli kterému spadl.
  function zapamatuj(ev) {
    if (!ev || !beh) return;
    for (const u of ev.typ === 'vice' ? ev.udalosti : [ev]) if (u.id) (beh.posledni || (beh.posledni = []))[u.panacek || 0] = u.id;
  }

  function okamzite() {
    if (vis.ev) { vis.ev = null; vis.stav = vis.po; }
    while (!beh.stav.konec) zapamatuj(S.takt(level, beh.stav, beh.stroj));
    vis.stav = S.snimek(beh.stav);
    konecBehu();
  }

  const KRATCE = [
    [/Rozsypal/, 'Jejda.'], [/drží/, 'A kam s tím?'], [/válí/, 'Uklidí to někdo?'],
    [/přívodu/, 'Něco tu zbylo.'], [/výstupu/, 'Málo.'],
  ];

  function konecBehu() {
    beh.bezi = false; beh.hotovo = true;
    const k = beh.stav.konec;
    zvyrazni(null);
    if (k.piskoviste) {
      vis.poza = 'stoji'; bublinaVsem('Hotovo.', 2500);
      stavRadek(`Směna skončila po ${kroku(beh.stav.takt)}.`, '');
    } else if (k.uspech) {
      const v = S.vyhodnotReseni(level, programyProBeh());
      if (v.vsechny) {
        vis.poza = 'jasa'; bublinaVsem('Hotovo!', 1e9); neuspechu = 0;
        stavRadek('Splněno.', 'ok');
        uspech(v);
      } else {
        const f = v.vysledky.find(x => !x.uspech);
        vis.poza = 'krci'; bublinaVsem('Hm.', 1e9); neuspechu++;
        const kde = f.test < level.pocetTestu ? 'na zadání č. ' + (f.test + 1) : 'na skrytém zadání';
        stavRadek('Tohle zadání prošlo, ale ' + kde + ' ne: ' + f.zprava, 'chyba');
      }
    } else {
      neuspechu++;
      let zprava = k.zprava || S.ZPRAVY[k.duvod] || '';
      // po třetím neúspěchu za sebou panáček ukáže, kde to spadlo
      const kdo = k.panacek || 0, id = beh.posledni && beh.posledni[kdo];
      if (k.duvod === 'pad' && neuspechu >= 3 && id) {
        if (programy && aktivniPanacek !== kdo) prepniPanacka(kdo);
        const e = document.querySelector(`#program li.blok[data-id="${id}"]`);
        if (e) {
          e.classList.add('podezrely');
          zprava += ' Panáček ukazuje na blok č. ' + e.querySelector('.cislo').textContent + '.';
        }
      }
      if (k.duvod === 'pad') {
        if (pocetPanacku() > 1) { vis.poza = 'krci'; vis.pozy = []; vis.pozy[kdo] = 'visi'; bublinaVsem('Jejda.', 1e9); }
        else vis.poza = 'visi';
        bublina(BUBLINY.pad, 1e9, kdo);
      }
      else if (k.duvod === 'usnul') { vis.poza = 'spi'; bublinaVsem('Zzz…', 1e9); }
      else { vis.poza = 'krci'; bublinaVsem((KRATCE.find(x => x[0].test(zprava)) || [0, 'Hm.'])[1], 1e9); }
      stavRadek(zprava, 'chyba');
    }
    ovladani();
  }

  function spust() {
    if (prazdnyProgram()) { stavRadek('Program je prázdný. Přidej bloky z palety.', 'chyba'); return; }
    if (beh && beh.hotovo) zastav();
    if (!beh) zacni();
    beh.krokovani = false;
    if (rychlost === '0') { okamzite(); return; }
    beh.bezi = true;
    if (!vis.ev) dalsiTakt();
    ovladani();
  }

  function pauza() { if (beh) beh.bezi = false; ovladani(); }

  function krokuj() {
    if (prazdnyProgram()) { stavRadek('Program je prázdný. Přidej bloky z palety.', 'chyba'); return; }
    if (beh && beh.hotovo) zastav();
    if (!beh) zacni();
    beh.bezi = false; beh.krokovani = true;
    if (!vis.ev) dalsiTakt();
    ovladani();
  }

  // ---------- výsledky ----------

  const sklon = (n, a, b, c) => n === 1 ? a : n >= 2 && n <= 4 ? b : c;
  const bloku = n => n + ' ' + sklon(n, 'blok', 'bloky', 'bloků');
  const kroku = n => String(n).replace('.', ',') + ' ' + (Number.isInteger(n) ? sklon(n, 'krok', 'kroky', 'kroků') : 'kroku');

  function uspech(v) {
    const z = zaznam(), staryB = z.nejlepsi ? z.nejlepsi.bloky : Infinity, staryK = z.nejlepsi ? z.nejlepsi.kroky : Infinity;
    const rekord = z.nejlepsi && (v.bloky < staryB || v.kroky < staryK);
    z.splneno = true;
    z.nejlepsi = { bloky: Math.min(staryB, v.bloky), kroky: Math.min(staryK, v.kroky) };
    uloz();
    const c = level.cile;
    const dlouhe = v.bloky > c.bloky * 1.5 || v.kroky > c.kroky * 1.5;
    const reakce = rekord ? 'Rekord! Tohle si pověsím nad ponk.' : dlouhe ? 'Zíív… Šlo by to i kratší.' : 'Hotovo. Další směna?';
    const ok = (h, cil) => h <= cil ? '<b class="spl">splněno</b>' : '<b class="nespl">nesplněno</b>';
    $('#vysledek').innerHTML = `
      <div class="karta" role="dialog" aria-labelledby="vy-titul">
        <div class="vy-stitek">Level ${level.id}</div>
        <h2 id="vy-titul">${level.finale ? 'Deska ožila!' : 'Splněno'}</h2>
        <table>
          <tr><th>Bloky</th><td>${v.bloky}</td><td>cíl nejvýš ${c.bloky}</td><td>${ok(v.bloky, c.bloky)}</td></tr>
          <tr><th>Kroky</th><td>${String(v.kroky).replace('.', ',')}</td><td>cíl nejvýš ${c.kroky}</td><td>${ok(v.kroky, c.kroky)}</td></tr>
        </table>
        <p class="vy-nej">Nejlepší: ${bloku(z.nejlepsi.bloky)}, ${kroku(z.nejlepsi.kroky)}</p>
        <p class="vy-reakce">„${level.finale ? 'Tak tohle jsme postavili. Pískoviště je otevřené.' : reakce}“</p>
        <div class="vy-tl">
          <button type="button" class="tl" data-akce="zpet">Zpět k programu</button>
          ${dalsiLevel()
            ? `<button type="button" class="tl hlavni" data-akce="dalsi">${dalsiLevel().kontrola === 'piskoviste' ? 'Pískoviště' : 'Další level ' + dalsiLevel().id}</button>`
            : '<button type="button" class="tl hlavni" disabled>Další kapitola se staví</button>'}
        </div>
      </div>`;
    if (level.finale) ozivit();
    setTimeout(() => { if (beh && beh.hotovo && vis.poza === 'jasa') $('#vysledek').hidden = false; }, level.finale ? 6200 : 900);
    vykresliZadani(); vykresliLevely();
  }

  function vykresliLevely() {
    const nav = $('#levely'); nav.innerHTML = '';
    LEVELY.forEach((l, i) => {
      if (i && l.kapitola !== LEVELY[i - 1].kapitola) nav.appendChild(el('span', 'predel'));
      const z = data.levely[l.id] || {}, b = el('button', 'tl lv' + (z.splneno ? ' hotovo' : ''), l.kontrola === 'piskoviste' ? 'Pískoviště' : l.id);
      b.type = 'button'; b.dataset.level = l.id; b.disabled = !odemceno(i);
      b.title = l.nazev + (z.splneno ? ' (splněno)' : b.disabled ? ' (zamčeno)' : '');
      if (l.id === level.id) b.setAttribute('aria-current', 'step');
      nav.appendChild(b);
    });
    const akt = nav.querySelector('[aria-current]');
    if (akt) nav.scrollLeft = Math.max(0, akt.offsetLeft - nav.clientWidth / 2);
  }

  function dalsiLevel() { return LEVELY[LEVELY.findIndex(l => l.id === level.id) + 1] || null; }
  function odemceno(i) { return i === 0 || !!(data.levely[LEVELY[i - 1].id] || {}).splneno; }

  // ---------- rozhraní ----------

  const IKONY = {
    krok: '<path d="M10 17V4M5 9l5-5 5 5"/>',
    vlevo: '<path d="M14 17v-7a4 4 0 0 0-4-4H4M7 3 4 6l3 3"/>',
    vpravo: '<path d="M6 17v-7a4 4 0 0 1 4-4h6M13 3l3 3-3 3"/>',
    skoc: '<path d="M3 16C5 4 15 4 17 16M13.5 13.5 17 16l1-4"/>',
    zvedni: '<path d="M4 3h12M10 17V7M6 11l4-4 4 4"/>',
    poloz: '<path d="M4 17h12M10 3v10M6 9l4 4 4-4"/>',
    opakuj: '<path d="M4 10a6 6 0 0 1 10-4.5L16 7M16 3v4h-4M16 10a6 6 0 0 1-10 4.5L4 13M4 17v-4h4"/>',
    stale: '<path d="M10 10c-2-3-6-3-6 0s4 3 6 0 6-3 6 0-4 3-6 0"/>',
    opakujKdyz: '<path d="M4 10a6 6 0 0 1 10-4.5L16 7M16 3v4h-4M10 9l3 3-3 3-3-3z"/>',
    kdyz: '<path d="M10 2 18 10 10 18 2 10Z"/><path d="M8.3 8a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1v.3M10 13.6v.1"/>',
    uloz: '<path d="M4 10h12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 13h12M10 2v6M7.5 5.5 10 8l2.5-2.5"/>',
    vyndej: '<path d="M4 10h12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 13h12M10 8V2M7.5 4.5 10 2l2.5 2.5"/>',
    prohod: '<path d="M4 7h11M12 4l3 3-3 3M16 13H5M8 10l-3 3 3 3"/>',
    pajej: '<path d="M3 3l7 7M8.5 8.5l3 3-2 2-3-3zM11.5 11.5 16 16M14 18c1-1 3-1 4 0"/>',
    vypajej: '<path d="M3 3l7 7M8.5 8.5l3 3-2 2-3-3zM11.5 11.5 14 14M16 18v-6M13.5 14.5 16 12l2.5 2.5"/>',
    otoc: '<path d="M4 10a6 6 0 1 0 2-4.5M4 3v4h4M8 10h4"/>',
    hvizdni: '<path d="M3 9h7a3 3 0 0 1 0 6H3zM13 12h2M15 7l2-2M15 17l2 2"/>',
    cekej: '<path d="M10 3a7 7 0 1 0 .01 0M10 6v4l3 2"/>',
  };
  const ikona = op => `<svg class="ikona" viewBox="0 0 20 20" aria-hidden="true">${IKONY[op] || ''}</svg>`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function vykresliZadani() {
    $('#lv-stitek').textContent = level.kontrola === 'piskoviste' ? 'Bez zadání' : `Kapitola ${level.kapitola} · ${level.kapitolaNazev}`;
    $('#lv-nazev').textContent = level.kontrola === 'piskoviste' ? level.nazev : `${level.id} ${level.nazev}`;
    $('#lv-text').textContent = level.zadani;
    $('#lv-napoveda').textContent = level.napoveda || '';
    $('#lv-napoveda').hidden = !level.napoveda;
    const z = data.levely[level.id], n = z && z.nejlepsi;
    const lg = $('#legenda');
    lg.hidden = !level.legenda;
    lg.innerHTML = level.legenda ? '<span class="lg-titul">První pruh</span>' + S.PRUHY.map((k, i) =>
      `<span class="lg"><i style="background:${PRUHY[k]}"></i>${i + 1}</span>`).join('') : '';
    $('#lv-cile').hidden = level.kontrola === 'piskoviste';
    $('#lv-cile').innerHTML =
      `<span class="cip">Cíl: nejvýš ${bloku(level.cile.bloky)}</span><span class="cip">v průměru nejvýš ${kroku(level.cile.kroky)}</span>` +
      (n ? `<span class="cip nej">Nejlepší: ${bloku(n.bloky)}, ${kroku(n.kroky)}</span>` : '');
  }

  function vykresliPaletu() {
    const pal = $('#paleta'); pal.innerHTML = '';
    for (const op of level.bloky) {
      const b = S.BLOKY[op];
      const e = el('button', 'blok b-' + b.druh, `${ikona(op)}<span class="nazev">${b.nazev}</span>`);
      e.type = 'button'; e.dataset.op = op; e.setAttribute('aria-label', 'Přidat blok ' + b.nazev);
      pal.appendChild(e);
    }
  }

  // ---------- program: strom bloků ----------
  // Kurzor určuje, kam se vloží blok klepnutím v paletě:
  // { id, dovnitr: false } = za blok, { id, dovnitr: 'telo' | 'jinak' } = na konec těla, null = na konec programu.

  function najdi(id, seznam = program, rodic = null) {
    for (let i = 0; i < seznam.length; i++) {
      const u = seznam[i];
      if (u.id === id) return { seznam, i, uzel: u, rodic };
      if (u.telo) { const r = najdi(id, u.telo, u); if (r) return r; }
      if (u.jinak) { const r = najdi(id, u.jinak, u); if (r) return r; }
    }
    return null;
  }
  const obsahuje = (u, id) => u.id === id || (u.telo || []).concat(u.jinak || []).some(c => obsahuje(c, id));

  function mistoKurzoru() {
    const f = kurzor && najdi(kurzor.id);
    if (!f) return { seznam: program, i: program.length };
    const telo = kurzor.dovnitr && f.uzel[kurzor.dovnitr];
    if (telo) return { seznam: telo, i: telo.length };
    return { seznam: f.seznam, i: f.i + 1 };
  }

  function vykresliProgram() {
    const ol = $('#program'); ol.innerHTML = '';
    if (!program.length) ol.appendChild(el('li', 'prazdny', 'Klepni na blok v paletě, nebo ho sem přetáhni.'));
    let cislo = 0;
    const smaz = '<button type="button" class="smaz" aria-label="Smazat blok">×</button>';
    const uzelEl = u => {
      const b = S.BLOKY[u.op];
      if (!b.telo) {
        const li = el('li', 'blok b-' + b.druh + (kurzor && kurzor.id === u.id && !kurzor.dovnitr ? ' vybrany' : ''),
          `<span class="cislo">${++cislo}</span>${ikona(u.op)}<span class="nazev">${b.nazev}</span>${smaz}`);
        li.dataset.id = u.id; li.tabIndex = 0;
        return li;
      }
      const li = el('li', 'smycka'); li.dataset.id = u.id;
      const n = u.op === 'opakuj'
        ? `<button type="button" class="pocet-n" aria-label="Počet opakování" aria-expanded="${volbaN === u.id}">${u.n}×</button>` : '';
      const volba = volbaN === u.id
        ? `<div class="volba-n" role="group" aria-label="Kolikrát">${Array.from({ length: MAX_N - 1 }, (_, i) => i + 2).map(k =>
          `<button type="button" data-n="${k}" aria-pressed="${k === u.n}">${k}</button>`).join('')}</div>` : '';
      const kdyz = u.op === 'kdyz', sPodminkou = kdyz || u.op === 'opakujKdyz';
      const pod = sPodminkou ? `<button type="button" class="podminka-n" aria-label="Podmínka" aria-expanded="${volbaP === u.id}">${S.PODMINKY[u.podminka]}</button>` : '';
      const volbaPod = sPodminkou && volbaP === u.id
        ? `<div class="volba-p" role="group" aria-label="Podmínka">${(level.podminky || []).map(k =>
          `<button type="button" data-p="${k}" aria-pressed="${k === u.podminka}">${S.PODMINKY[k]}</button>`).join('')}</div>` : '';
      const vyb = d => kurzor && kurzor.id === u.id && kurzor.dovnitr === d ? ' vybrany' : '';
      if (kdyz) li.classList.add('vetveni');
      const hlava = el('div', 'blok hlava b-' + b.druh + vyb('telo'),
        `<span class="cislo">${++cislo}</span>${ikona(u.op)}<span class="nazev">${kdyz ? 'když' : u.op === 'stale' ? 'opakuj stále' : u.op === 'opakujKdyz' ? 'opakuj, když' : 'opakuj'}</span>${n}${pod}<span class="kolo"></span>${smaz}${volba}${volbaPod}`);
      hlava.dataset.id = u.id; hlava.tabIndex = 0;
      const telo = el('ol', 'telo');
      if (!u.telo.length) telo.appendChild(el('li', 'prazdne-telo', kdyz ? 'sem patří, co dělat, když platí' : 'sem patří opakované bloky'));
      u.telo.forEach(c => telo.appendChild(uzelEl(c)));
      li.append(hlava, telo);
      if (kdyz) {
        const jh = el('div', 'jinak-hlava' + vyb('jinak'), 'jinak');
        jh.dataset.id = u.id; jh.tabIndex = 0;
        const jinak = el('ol', 'telo jinak');
        if (!u.jinak.length) jinak.appendChild(el('li', 'prazdne-telo', 'sem patří, co dělat jinak'));
        u.jinak.forEach(c => jinak.appendChild(uzelEl(c)));
        li.append(jh, jinak);
      }
      const pata = el('div', 'pata' + vyb(false));
      pata.dataset.id = u.id; pata.title = kdyz ? 'Vkládat za blok když' : 'Vkládat za smyčku';
      li.appendChild(pata);
      return li;
    };
    program.forEach(u => ol.appendChild(uzelEl(u)));
    const n = programy ? programy.reduce((a, p) => a + S.pocetBloku(p), 0) : S.pocetBloku(program);
    $('#pocet').textContent = level.kontrola === 'piskoviste' ? bloku(n) : n + ' / ' + level.cile.bloky;
    $('#pocet').title = bloku(n) + ', cíl nejvýš ' + level.cile.bloky;
    $('#pocet').classList.toggle('pres', n > level.cile.bloky);
    $('#vymaz').disabled = !program.length;
  }

  function vykresliZalozky() {
    const z = $('#zalozky'); z.hidden = !programy; z.innerHTML = '';
    if (!programy) return;
    programy.forEach((pr, i) => {
      const b = el('button', 'zal', `<i style="background:${BARVY_CEPIC[i]}"></i>Panáček ${i + 1}`);
      b.type = 'button'; b.dataset.ag = i; b.setAttribute('aria-pressed', i === aktivniPanacek);
      z.appendChild(b);
    });
  }
  function prepniPanacka(i) {
    aktivniPanacek = i; program = programy[i];
    kurzor = program.length ? { id: program[program.length - 1].id, dovnitr: false } : null;
    volbaN = volbaP = null;
    vykresliZalozky(); vykresliProgram();
    if (vis && vis.ev) zvyrazni(vis.ev);
  }

  function zvyrazni(ev) {
    if (ev && ev.typ === 'vice') ev = ev.udalosti.find(e => e.panacek === aktivniPanacek) || null;
    document.querySelectorAll('#program .aktivni').forEach(e => e.classList.remove('aktivni'));
    document.querySelectorAll('#program .bezi-vetev').forEach(e => e.classList.remove('bezi-vetev'));
    document.querySelectorAll('#program .smycka.bezi-smycka').forEach(e => {
      e.classList.remove('bezi-smycka'); e.querySelector(':scope > .hlava .kolo').textContent = '';
    });
    if (!ev || !ev.id) return;
    for (const s of ev.smycky || []) {
      const e = document.querySelector(`#program li.smycka[data-id="${s.id}"]`);
      if (!e) continue;
      e.classList.add('bezi-smycka');
      if (s.vetev) { const t = e.querySelector(s.vetev === 'jinak' ? ':scope > ol.jinak' : ':scope > ol.telo'); if (t) t.classList.add('bezi-vetev'); continue; }
      e.querySelector(':scope > .hlava .kolo').textContent = s.n ? `${s.kolo}/${s.n}` : `${s.kolo}.`;
    }
    const e = document.querySelector(`#program li.blok[data-id="${ev.id}"]`);
    if (!e) return;
    e.classList.add('aktivni');
    // Posouvá se jen vlastní posuvník programu (desktop), nikdy stránka: deska musí zůstat na očích.
    const ol = $('#program');
    if (ol.scrollHeight > ol.clientHeight + 1) {
      const r = e.getBoundingClientRect(), o = ol.getBoundingClientRect();
      if (r.top < o.top) ol.scrollTop -= o.top - r.top + 8;
      else if (r.bottom > o.bottom) ol.scrollTop += r.bottom - o.bottom + 8;
    }
  }

  function vykresliTesty() {
    const t = $('#testy'); t.innerHTML = '';
    t.hidden = level.pocetTestu < 2;
    for (let i = 0; i < level.pocetTestu; i++) {
      const b = el('button', 'tl test', String(i + 1));
      b.type = 'button'; b.dataset.test = i; b.setAttribute('aria-pressed', i === testIdx);
      t.appendChild(b);
    }
  }

  function ovladani() {
    const bezi = !!(beh && beh.bezi);
    const sp = $('#spust');
    sp.innerHTML = bezi ? '<span aria-hidden="true">❚❚</span> Pauza' : '<span aria-hidden="true">▶</span> Spusť';
    sp.setAttribute('aria-label', bezi ? 'Pauza' : 'Spusť');
    $('#zastav').disabled = !beh;
    document.querySelectorAll('#rychlost button').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === rychlost));
    if (!beh) $('#vysledek').hidden = true;
  }

  function drzenoText(p) {
    if (p.druh === 'odpor' && p.pruh && level.legenda) return 'odpor ' + S.hodnota(p) + ' (' + S.BARVY[p.pruh] + ')';
    if (p.druh === 'odpor' && p.pruh) return 'odpor, první pruh ' + S.BARVY[p.pruh];
    return { propojka: 'propojku', spaleny: 'spálený kus' }[p.druh] || S.nazevDruhu(p.druh, 1);
  }

  function stavRadek(text, druh) {
    const e = $('#stav');
    if (text == null) {
      const st = beh ? (vis.ev ? vis.po : vis.stav) : null;
      if (st && st.ag) text = `Takt ${st.takt}` + st.ag.map((a, i) => ` · ${i + 1}: ` + (a.hotovo ? 'skončil' : a.ceka ? 'čeká' : a.drzi ? 'drží ' + drzenoText(a.drzi) : 'volné ruce')).join('');
      else text = st ? `Takt ${st.takt}` + (st.drzi ? ' · drží ' + drzenoText(st.drzi) : '') + (st.kapsa ? ' · v kapse ' + drzenoText(st.kapsa) : '') : 'Připraven.';
      druh = '';
    }
    e.textContent = text; e.className = 'stav' + (druh ? ' ' + druh : '');
  }

  function zmenaProgramu() {
    if (beh) zastav();
    ulozProgram(); vykresliProgram();
  }

  function vlozBlok(op, misto) {
    const u = novyUzel(op), m = misto || mistoKurzoru();
    m.seznam.splice(m.i, 0, u);
    kurzor = { id: u.id, dovnitr: u.telo ? 'telo' : false };
    zmenaProgramu();
  }

  function smazBlok(id) {
    const f = najdi(id);
    if (!f) return;
    f.seznam.splice(f.i, 1);
    if (kurzor && obsahuje(f.uzel, kurzor.id)) {
      const pred = f.seznam[f.i - 1];
      kurzor = pred ? { id: pred.id, dovnitr: false }
        : f.rodic ? { id: f.rodic.id, dovnitr: f.seznam === f.rodic.jinak ? 'jinak' : 'telo' } : null;
    }
    zmenaProgramu();
  }

  function presunBlok(id, slot) {
    const f = najdi(id);
    if (!f || (slot.uzel && obsahuje(f.uzel, slot.uzel))) return;
    f.seznam.splice(f.i, 1);
    let i = slot.i;
    if (slot.seznam === f.seznam && slot.i > f.i) i--;
    slot.seznam.splice(i, 0, f.uzel);
    kurzor = { id: f.uzel.id, dovnitr: false };
    zmenaProgramu();
  }

  // ---------- přetahování ----------

  let tah = null;

  // Možná místa vložení: { seznam, i, y, x, uzel (smyčka, do které se vkládá) }.
  function sloty(vyjma) {
    const out = [], li = id => document.querySelector(`#program li[data-id="${id}"]`);
    const projdi = (seznam, smycka) => {
      const vid = seznam.filter(u => u.id !== vyjma);
      for (const u of vid) {
        const e = li(u.id), r = e.getBoundingClientRect();
        out.push({ seznam, i: seznam.indexOf(u), y: r.top - 2, x: r.left, uzel: smycka });
        for (const [klic, sel] of [['telo', ':scope > ol.telo:not(.jinak)'], ['jinak', ':scope > ol.jinak']]) {
          if (!u[klic]) continue;
          projdi(u[klic], u.id);
          if (!u[klic].some(c => c.id !== vyjma)) {
            const t = e.querySelector(sel).getBoundingClientRect();
            out.push({ seznam: u[klic], i: 0, y: t.top + t.height / 2, x: t.left, uzel: u.id });
          }
        }
      }
      if (vid.length) {
        const last = vid[vid.length - 1], r = li(last.id).getBoundingClientRect();
        out.push({ seznam, i: seznam.indexOf(last) + 1, y: r.bottom + 2, x: r.left, uzel: smycka });
      }
    };
    projdi(program, null);
    if (!program.some(u => u.id !== vyjma)) {
      const r = $('#program').getBoundingClientRect();
      out.push({ seznam: program, i: 0, y: r.top + 24, x: r.left + 8, uzel: null });
    }
    return out;
  }

  function nadProgramem(x, y) {
    const b = $('#panel-program').getBoundingClientRect(), o = 24;
    return x > b.left - o && x < b.right + o && y > b.top - o && y < b.bottom + o;
  }

  function onDown(e) {
    if (e.button > 0 || tah) return;
    if (e.target.closest('.smaz, .pocet-n, .volba-n, .podminka-n, .volba-p')) return;
    const blok = e.target.closest('.blok');
    if (!blok) return;
    const zdroj = blok.closest('#paleta') ? 'paleta' : 'program';
    tah = {
      zdroj, op: blok.dataset.op, id: blok.dataset.id,
      el: blok.classList.contains('hlava') ? blok.parentElement : blok,
      x0: e.clientX, y0: e.clientY, pid: e.pointerId, aktivni: false,
    };
    // Prstem v programu se táhne až po podržení, jinak by řádky blokovaly posun stránky.
    if (e.pointerType !== 'mouse' && zdroj === 'program') {
      tah.ceka = setTimeout(() => {
        if (!tah || tah.aktivni) return;
        tah.ceka = null; zacniTah();
        if (navigator.vibrate) try { navigator.vibrate(12); } catch (err) { /* nic */ }
      }, PODRZENI);
    }
    try { blok.setPointerCapture(e.pointerId); } catch (err) { /* nic */ }
  }

  function zacniTah() {
    tah.aktivni = true;
    if (volbaN || volbaP) { volbaN = volbaP = null; vykresliProgram(); tah.el = document.querySelector(`#program li[data-id="${tah.id}"]`) || tah.el; }
    const r = tah.el.getBoundingClientRect();
    const d = tah.el.cloneNode(true);
    d.querySelectorAll('.vybrany, .aktivni').forEach(x => x.classList.remove('vybrany', 'aktivni'));
    d.classList.remove('vybrany', 'aktivni'); d.classList.add('duch');
    d.style.width = r.width + 'px';
    tah.dx = tah.x0 - r.left; tah.dy = tah.y0 - r.top;
    document.body.appendChild(d); tah.duch = d;
    if (tah.zdroj === 'program') tah.el.classList.add('tazeny');
    tah.znacka = el('div', 'vkladani');
    $('#panel-program').appendChild(tah.znacka); tah.znacka.hidden = true;
    d.style.transform = `translate(${r.left}px, ${r.top}px)`;
    document.body.classList.add('tahne');
  }

  function onMove(e) {
    if (!tah || e.pointerId !== tah.pid) return;
    if (!tah.aktivni) {
      if (Math.hypot(e.clientX - tah.x0, e.clientY - tah.y0) < 7) return;
      if (tah.ceka) { clearTimeout(tah.ceka); tah = null; return; }   // posun stránky, ne tah
      zacniTah();
    }
    e.preventDefault();
    if (e.clientY < 56) window.scrollBy(0, -10);
    else if (e.clientY > window.innerHeight - 56) window.scrollBy(0, 10);
    tah.duch.style.transform = `translate(${e.clientX - tah.dx}px, ${e.clientY - tah.dy}px)`;
    const nad = nadProgramem(e.clientX, e.clientY);
    tah.duch.classList.toggle('pryc', !nad && tah.zdroj === 'program');
    const pr = $('#program .prazdny');
    if (nad) {
      const vse = sloty(tah.zdroj === 'program' ? tah.id : null);
      let best = vse[0];
      for (const s of vse) if (Math.abs(s.y - e.clientY) < Math.abs(best.y - e.clientY)) best = s;
      tah.slot = best;
      const p = $('#panel-program').getBoundingClientRect();
      Object.assign(tah.znacka.style, { top: (best.y - p.top - 2) + 'px', left: (best.x - p.left) + 'px' });
      tah.znacka.hidden = false;
      if (pr) pr.hidden = true;
    } else {
      tah.slot = null; tah.znacka.hidden = true;
      if (pr) pr.hidden = false;
    }
  }

  function konecTahu(e, zrusit) {
    if (!tah || (e && e.pointerId !== tah.pid)) return;
    const t = tah; tah = null;
    if (t.ceka) clearTimeout(t.ceka);
    document.body.classList.remove('tahne');
    if (!t.aktivni) {
      if (zrusit) return;
      if (t.zdroj === 'paleta') vlozBlok(t.op);
      else {
        const f = najdi(t.id);
        kurzor = { id: t.id, dovnitr: f && f.uzel.telo ? 'telo' : false };
        volbaN = volbaP = null; vykresliProgram();
      }
      return;
    }
    t.duch.remove(); t.znacka.remove(); t.el.classList.remove('tazeny');
    if (zrusit || t.slot === undefined) { vykresliProgram(); return; }   // podržel a pustil bez pohybu
    if (t.slot) {
      if (t.zdroj === 'paleta') vlozBlok(t.op, t.slot);
      else presunBlok(t.id, t.slot);
    } else if (t.zdroj === 'program') smazBlok(t.id);
    else vykresliProgram();
  }

  // ---------- události ----------

  function navaz() {
    const kod = $('#hra');
    kod.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', e => konecTahu(e, false));
    window.addEventListener('pointercancel', e => konecTahu(e, true));
    // během tahu prstem nesmí stránka ujet
    document.addEventListener('touchmove', e => { if (tah && tah.aktivni) e.preventDefault(); }, { passive: false });
    // klávesnice: Enter na bloku v paletě ho vloží
    $('#paleta').addEventListener('click', e => { const b = e.target.closest('.blok'); if (b && e.detail === 0) vlozBlok(b.dataset.op); });
    $('#program').addEventListener('click', e => {
      const s = e.target.closest('.smaz');
      if (s) { smazBlok(s.closest('[data-id]').dataset.id); return; }
      const n = e.target.closest('.pocet-n');
      if (n) { const id = n.closest('[data-id]').dataset.id; volbaN = volbaN === id ? null : id; vykresliProgram(); return; }
      const k = e.target.closest('.volba-n button');
      if (k) {
        const f = najdi(k.closest('[data-id]').dataset.id);
        if (f) f.uzel.n = +k.dataset.n;
        volbaN = volbaP = null; zmenaProgramu(); return;
      }
      const pp = e.target.closest('.podminka-n');
      if (pp) { const id = pp.closest('[data-id]').dataset.id; volbaP = volbaP === id ? null : id; volbaN = null; vykresliProgram(); return; }
      const kp = e.target.closest('.volba-p button');
      if (kp) {
        const f = najdi(kp.closest('[data-id]').dataset.id);
        if (f) f.uzel.podminka = kp.dataset.p;
        volbaP = null; zmenaProgramu(); return;
      }
      const jh = e.target.closest('.jinak-hlava');
      if (jh) { kurzor = { id: jh.dataset.id, dovnitr: 'jinak' }; volbaN = volbaP = null; vykresliProgram(); return; }
      const pata = e.target.closest('.pata');
      if (pata) { kurzor = { id: pata.dataset.id, dovnitr: false }; volbaN = volbaP = null; vykresliProgram(); }
    });
    document.addEventListener('pointerdown', e => {
      if ((volbaN || volbaP) && !e.target.closest('.volba-n, .pocet-n, .volba-p, .podminka-n')) {
        volbaN = volbaP = null;                            // bez překreslení, ať nezmizí cíl právě začínajícího tahu
        document.querySelectorAll('#program .volba-n, #program .volba-p').forEach(x => x.remove());
        document.querySelectorAll('#program .pocet-n, #program .podminka-n').forEach(x => x.setAttribute('aria-expanded', 'false'));
      }
    }, true);
    $('#program').addEventListener('keydown', e => {
      const b = e.target.closest('.blok'); if (!b) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazBlok(b.dataset.id); }
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('button')) return;
        e.preventDefault(); kurzor = { id: b.dataset.id, dovnitr: b.classList.contains('hlava') ? 'telo' : false }; vykresliProgram();
      }
    });
    $('#vymaz').addEventListener('click', () => { program.splice(0); kurzor = null; zmenaProgramu(); });
    $('#zalozky').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !programy) return;
      prepniPanacka(+b.dataset.ag);
    });
    $('#spust').addEventListener('click', () => (beh && beh.bezi ? pauza() : spust()));
    $('#krok').addEventListener('click', krokuj);
    $('#zastav').addEventListener('click', zastav);
    $('#rychlost').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      rychlost = b.dataset.r; data.rychlost = rychlost; uloz();
      if (beh && !beh.hotovo && rychlost === '0' && beh.bezi) okamzite();
      ovladani();
    });
    $('#testy').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      testIdx = +b.dataset.test; level = S.instance(zaklad, testIdx);
      zastav(); vykresliTesty(); rozmer();
    });
    $('#vysledek').addEventListener('click', e => {
      if (e.target.closest('[data-akce="dalsi"]')) { const d = dalsiLevel(); if (d) nactiLevel(d); return; }
      if (e.target.closest('[data-akce="zpet"]') || e.target === $('#vysledek')) $('#vysledek').hidden = true;
    });
    $('#levely').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      nactiLevel(LEVELY.find(l => l.id === b.dataset.level));
    });
    if (window.ResizeObserver) new ResizeObserver(() => rozmer()).observe(cv.parentElement);
    else window.addEventListener('resize', rozmer);
  }

  function smycka(now) {
    if (vis.ev && vis.dur && now - vis.t0 >= vis.dur) dokonciUdalost();
    kresli(now);
    requestAnimationFrame(smycka);
  }

  function nactiLevel(def) {
    zaklad = S.pripravLevel(def);
    level = S.instance(zaklad, 0);
    data.aktualni = level.id; uloz();
    document.body.classList.remove('bezi');
    $('#vysledek').hidden = true;
    const z = data.levely[level.id] || {};
    if (level.startPoz) {
      programy = level.startPoz.map((_, i) => ocisti((z.programy || [])[i], level.bloky));
      aktivniPanacek = 0; program = programy[0];
    } else { programy = null; program = ocisti(z.program, level.bloky); }
    vykresliZalozky();
    kurzor = program.length ? { id: program[program.length - 1].id, dovnitr: false } : null;
    volbaN = null;
    testIdx = 0; beh = null; neuspechu = 0;
    vis = vychoziVis();
    document.title = `Plošňák ${level.id}: ${level.nazev}`;
    vykresliZadani(); vykresliLevely(); vykresliPaletu(); vykresliProgram(); vykresliTesty();
    rozmer(); ovladani(); stavRadek();
  }

  navaz();
  const ulozeny = LEVELY.findIndex(l => l.id === data.aktualni);
  nactiLevel(LEVELY[ulozeny > 0 && odemceno(ulozeny) ? ulozeny : 0]);
  requestAnimationFrame(smycka);

  // pro automatické testy
  window.Plosnak = {
    get program() { return bezId(program); },
    get programy() { return programy && programy.map(bezId); },
    get beh() { return beh && { bezi: beh.bezi, hotovo: beh.hotovo, konec: beh.stav.konec, takt: beh.stav.takt }; },
    get vis() { return { poza: vis.poza, pozy: vis.pozy, ev: vis.ev && vis.ev.typ, bublina: vis.bubliny[0] && vis.bubliny[0].text }; },
    get T() { return T; },
    get neuspechu() { return neuspechu; },
    get level() { return level.id; },
  };
})();
