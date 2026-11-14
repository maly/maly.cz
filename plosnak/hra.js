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
    return u;
  }
  function ocisti(prg, povolene) {
    return (Array.isArray(prg) ? prg : []).filter(u => u && povolene.includes(u.op)).map(u => {
      const n = novyUzel(u.op);
      if (n.n) n.n = Math.max(2, Math.min(9, u.n | 0));
      if (n.telo) n.telo = ocisti(u.telo, povolene);
      return n;
    });
  }
  function bezId(prg) {
    return prg.map(u => { const o = { op: u.op }; if (u.n) o.n = u.n; if (u.telo) o.telo = bezId(u.telo); return o; });
  }
  function ulozProgram() { zaznam().program = bezId(program); uloz(); }

  // ---------- stav hry ----------

  let level, program = [], vybrany = null, testIdx = 0;
  let rychlost = RYCHLOST[data.rychlost] != null ? data.rychlost : '1';
  let beh = null;     // { stav, stroj, bezi, hotovo, krokovani }
  let vis = null;     // { stav, pred, po, ev, t0, dur, poza, bublina }
  let neuspechu = 0;

  function vychoziVis() {
    const s = S.novyStav(level, S.zadani(level, testIdx));
    return { stav: S.snimek(s), pred: null, po: null, ev: null, t0: 0, dur: 0, poza: 'stoji', bublina: null };
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
  function bodPrivodu() {
    const p = level.privodPos, [dx, dy] = S.SMERY[p.strana];
    return { x: stredX(p.x) + dx * .4 * T, y: stredY(p.y) + dy * .4 * T };
  }
  function bodVystupu() {
    const v = level.vystupPos, [dx, dy] = S.SMERY[v.strana];
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

  function kresliPolozku(c, druh, x, y, s = 1, uhel = 0) {
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
        ['#c0392b', '#7b4b2a', '#e67e22'].forEach((b, i) => { c.fillStyle = b; c.fillRect((-.1 + i * .07) * u, -.075 * u, .035 * u, .15 * u); });
        break;
      case 'led':
        c.fillStyle = '#e74c3c'; c.strokeStyle = K; c.lineWidth = lw;
        c.beginPath(); c.arc(0, 0, .14 * u, 0, TAU); c.fill(); c.stroke();
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
    const [dx, dy] = S.SMERY[p.strana];
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
    if (sn.privod.length) kresliPolozku(c, sn.privod[0].druh, bx - w * .12, by - h * .07, .62);
    // součástka připravená na kraji skluzu
    if (sn.privod.length && !skryjPrvni) kresliPolozku(c, sn.privod[0].druh, ret.x, ret.y, .9, dx ? Math.PI / 2 : 0);
  }

  function kresliVystup(c, sn) {
    const v = level.vystupPos; if (!v) return;
    const [dx, dy] = S.SMERY[v.strana];
    const bx = stredX(v.x + dx), by = stredY(v.y + dy) - .2 * T, lw = Math.max(1.5, T * .03);
    const w = .86 * T, h = .52 * T, celo = .2 * T;
    c.lineWidth = lw; c.strokeStyle = K;
    c.fillStyle = '#f7f8fa'; c.fillRect(bx - w / 2, by - h / 2, w, h); c.strokeRect(bx - w / 2, by - h / 2, w, h);
    c.fillStyle = '#c3ccd5'; c.fillRect(bx - w / 2 + .07 * T, by - h / 2 + .06 * T, w - .14 * T, h - .1 * T);
    sn.vystup.forEach((p, i) => {
      const k = i % 4, r = Math.floor(i / 4) % 2;
      kresliPolozku(c, p.druh, bx - w * .26 + k * w * .17, by - h * .12 + r * h * .28, .55, .5 + i * .7);
    });
    c.fillStyle = '#e4e9ee'; c.fillRect(bx - w / 2, by + h / 2, w, celo); c.strokeRect(bx - w / 2, by + h / 2, w, celo);
    c.fillStyle = K; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.max(7, Math.round(T * .12))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.fillText('VÝSTUP', bx, by + h / 2 + celo * .54);
    c.fillStyle = W; c.beginPath(); c.arc(bx + w / 2 - .06 * T, by - h / 2 + .02 * T, .15 * T, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = K; c.font = `800 ${Math.max(8, Math.round(T * .16))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.fillText(String(sn.vystup.length), bx + w / 2 - .06 * T, by - h / 2 + .03 * T);
  }

  function kresliPodlahu(c, sn) {
    for (const k in sn.podlaha) {
      const [x, y] = k.split(',').map(Number), b = naZemi(x, y);
      kresliPolozku(c, sn.podlaha[k].druh, b.x, b.y, .9, .25);
    }
    sn.rozsypano.forEach((r, i) => {
      const b = naZemi(r.x, r.y);
      kresliPolozku(c, r.polozka.druh, b.x + (i % 2 ? .16 : -.14) * T, b.y - (i % 2) * .06 * T, .75, 1 + i * 2.1);
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
    ruce.forEach((h, i) => oblouk(sh, h, (i ? 1 : -1) * .7 * u, .2 * u));
    // kšilt za hlavou (pohled zezadu)
    const ksiltZezadu = () => {
      c.fillStyle = TEAL; c.beginPath(); c.ellipse(hc.x, hc.y - r * .98, r * .78, r * .3, 0, 0, TAU); c.fill(); c.stroke();
    };
    if (smer === 0) ksiltZezadu();
    // hlava a čepice
    c.fillStyle = W; c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.fill(); c.stroke();
    const a0 = smer === 0 ? -.28 : .18;
    c.fillStyle = TEAL; c.beginPath(); c.arc(hc.x, hc.y, r, Math.PI + a0, -a0); c.closePath(); c.fill(); c.stroke();
    // obličej a kšilt
    c.fillStyle = K;
    const oko = (ex, ey) => {
      if (o.oci === 'zavrene' || spi) { c.lineWidth = lw * .8; c.beginPath(); c.moveTo(ex - .2 * r, ey); c.lineTo(ex + .2 * r, ey); c.stroke(); c.lineWidth = lw; }
      else if (o.oci === 'velke') { c.fillStyle = W; c.beginPath(); c.arc(ex, ey, .2 * r, 0, TAU); c.fill(); c.lineWidth = lw * .7; c.stroke(); c.lineWidth = lw; c.fillStyle = K; c.beginPath(); c.arc(ex, ey, .07 * r, 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(ex, ey, Math.max(1.1, .12 * r), 0, TAU); c.fill(); }
    };
    if (smer === 2) {
      c.fillStyle = TEAL; c.beginPath(); c.ellipse(hc.x, hc.y - .12 * r, r * 1.0, r * .3, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = K; oko(hc.x - .38 * r, hc.y + .36 * r); oko(hc.x + .38 * r, hc.y + .36 * r);
    } else if (bok) {
      const k0 = { x: hc.x + sx * .5 * r, y: hc.y - .3 * r }, k1 = { x: hc.x + sx * 1.62 * r, y: hc.y - .14 * r };
      c.lineWidth = lw * 2.6; c.beginPath(); c.moveTo(k0.x, k0.y); c.lineTo(k1.x, k1.y); c.stroke();
      c.strokeStyle = TEAL; c.lineWidth = lw * 1.2; c.beginPath(); c.moveTo(k0.x, k0.y); c.lineTo(k1.x - sx * lw * .4, k1.y); c.stroke();
      c.strokeStyle = K; c.lineWidth = lw; c.fillStyle = K;
      oko(hc.x + sx * .5 * r, hc.y + .16 * r);
    }
    // nesená součástka mezi rukama
    if (o.polozka) {
      const m = lerpP(ruce[0], ruce[1], .5);
      kresliPolozku(c, o.polozka.druh, m.x, m.y - .35 * u, .9);
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
  function kresliVisiciho(c, gx, gy, smer, t) {
    const u = T / 8.2, r = 1.45 * u, lw = Math.max(1.4, u * .3);
    c.save(); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = K; c.lineWidth = lw;
    if (smer === 0) {                          // za horní hranou: jen temeno a prsty
      const hy = gy - .9 * u;
      c.fillStyle = TEAL; c.beginPath(); c.ellipse(gx, hy - r * .7, r * .72, r * .26, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = W; c.beginPath(); c.arc(gx, hy, r, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = TEAL; c.beginPath(); c.arc(gx, hy, r, Math.PI + .1, -.1); c.closePath(); c.fill(); c.stroke();
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
    c.fillStyle = TEAL; c.beginPath(); c.arc(hc.x, hc.y, r, Math.PI + .18, -.18); c.closePath(); c.fill(); c.stroke();
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
  function postava(now, ev, p) {
    const o = { t: now, dech: true };
    if (!ev) {
      const st = vis.stav, [dx, dy] = S.SMERY[st.smer];
      if (vis.poza === 'visi') {
        const c = stred(st.x, st.y);
        return { visi: { x: c.x - dx * .64 * T, y: c.y - dy * .64 * T }, smer: st.smer };
      }
      Object.assign(o, { polozka: st.drzi, nahoru: st.drzi ? 1 : 0 });
      if (vis.poza === 'jasa') { o.nahoru = 1; o.vyskok = Math.abs(Math.sin(now / 160)) * .2 * T; o.dech = false; }
      if (vis.poza === 'krci' || vis.poza === 'spi') o.poza = vis.poza;
      const z = zem(st.x, st.y);
      return { x: z.x, y: z.y, smer: st.smer, o, cil: vis.poza === 'stoji' ? { x: st.x + dx, y: st.y + dy } : null };
    }
    const z = ev.z, na = ev.na || z, [dx, dy] = S.SMERY[z.smer];
    let pos = zem(z.x, z.y), smer = z.smer;
    o.polozka = vis.pred.drzi; o.nahoru = vis.pred.drzi ? 1 : 0; o.dech = false;
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
        const src = ev.odkud === 'privod' ? bodPrivodu() : naZemi(z.x, z.y);
        o.ruceCil = src;
        if (p < .45) { o.ruceK = ease(p / .45); o.polozka = null; o.nahoru = 0; }
        else { const k = ease((p - .45) / .55); o.ruceK = 1 - k; o.nahoru = k; o.polozka = ev.polozka; }
        break;
      }
      case 'poloz': case 'rozsyp': {
        const dst = ev.kam === 'vystup' ? bodVystupu() : naZemi(z.x, z.y);
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
      case 'plnaRuka': pos = { x: pos.x + Math.sin(p * TAU * 3) * .03 * T, y: pos.y }; break;
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
    const f = postava(now, ev, p);
    if (f.cil) kresliCil(g, f.cil.x, f.cil.y);
    kresliPodlahu(g, sn);
    // zásobníky a panáček podle hloubky (co je níž, je blíž)
    const veci = [];
    if (level.privodPos) veci.push([level.privodPos.y + S.SMERY[level.privodPos.strana][1], () => kresliPrivod(g, sn, false)]);
    if (level.vystupPos) veci.push([level.vystupPos.y + S.SMERY[level.vystupPos.strana][1], () => kresliVystup(g, sn)]);
    let hlava = null;
    const py = f.visi ? (f.visi.y - OY) / T : (f.y - OY) / T - .5;
    veci.push([py, () => { hlava = f.visi ? kresliVisiciho(g, f.visi.x, f.visi.y, f.smer, now) : kresliPanacka(g, f.x, f.y, f.smer, f.o); }]);
    veci.sort((a, b) => a[0] - b[0]).forEach(v => v[1]());
    if (vis.bublina && hlava && now < vis.bublina.do) kresliBublinu(g, vis.bublina.text, hlava.x, hlava.y);
  }

  // ---------- běh programu ----------

  const BUBLINY = { naraz: 'Au!', hmat: 'Nic tu není.', plnaRuka: 'Mám plné ruce.', prazdnaRuka: 'Nic nedržím.', rozsyp: 'Jejda!', pad: 'Áááá!' };

  function bublina(text, ms) { vis.bublina = { text, do: performance.now() + (ms || 1500) }; }

  function zacni() {
    vis = vychoziVis();
    beh = { stav: S.novyStav(level, S.zadani(level, testIdx)), stroj: S.stroj(program), bezi: false, hotovo: false, krokovani: false };
    document.body.classList.add('bezi');
  }

  function zastav() {
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
    if (ev.typ === 'konec' || ev.typ === 'konecSmeny' || ev.typ === 'usnul') { vis.stav = S.snimek(beh.stav); konecBehu(); return; }
    vis.pred = pred; vis.po = S.snimek(beh.stav); vis.ev = ev;
    vis.t0 = performance.now(); vis.dur = beh.krokovani ? KROKOVANI : RYCHLOST[rychlost] || KROKOVANI;
    if (BUBLINY[ev.typ]) bublina(BUBLINY[ev.typ], Math.max(900, vis.dur * 2.5));
    zvyrazni(ev);
    stavRadek();
  }

  function dokonciUdalost() {
    vis.ev = null; vis.stav = vis.po;
    if (beh.stav.konec) { konecBehu(); return; }
    if (beh.bezi) dalsiTakt(); else { ovladani(); stavRadek(); }
  }

  function okamzite() {
    if (vis.ev) { vis.ev = null; vis.stav = vis.po; }
    while (!beh.stav.konec) S.takt(level, beh.stav, beh.stroj);
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
    if (k.uspech) {
      const v = S.vyhodnotReseni(level, program);
      if (v.vsechny) {
        vis.poza = 'jasa'; bublina('Hotovo!', 1e9); neuspechu = 0;
        stavRadek('Splněno.', 'ok');
        uspech(v);
      } else {
        const f = v.vysledky.find(x => !x.uspech);
        vis.poza = 'krci'; bublina('Hm.', 1e9); neuspechu++;
        const kde = f.test < level.pocetTestu ? 'na zadání č. ' + (f.test + 1) : 'na skrytém zadání';
        stavRadek('Tohle zadání prošlo, ale ' + kde + ' ne: ' + f.zprava, 'chyba');
      }
    } else {
      neuspechu++;
      const zprava = k.zprava || S.ZPRAVY[k.duvod] || '';
      if (k.duvod === 'pad') { vis.poza = 'visi'; bublina(BUBLINY.pad, 1e9); }
      else if (k.duvod === 'usnul') { vis.poza = 'spi'; bublina('Zzz…', 1e9); }
      else { vis.poza = 'krci'; bublina((KRATCE.find(x => x[0].test(zprava)) || [0, 'Hm.'])[1], 1e9); }
      stavRadek(zprava, 'chyba');
    }
    ovladani();
  }

  function spust() {
    if (!program.length) { stavRadek('Program je prázdný. Přidej bloky z palety.', 'chyba'); return; }
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
    if (!program.length) { stavRadek('Program je prázdný. Přidej bloky z palety.', 'chyba'); return; }
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
        <h2 id="vy-titul">Splněno</h2>
        <table>
          <tr><th>Bloky</th><td>${v.bloky}</td><td>cíl nejvýš ${c.bloky}</td><td>${ok(v.bloky, c.bloky)}</td></tr>
          <tr><th>Kroky</th><td>${String(v.kroky).replace('.', ',')}</td><td>cíl nejvýš ${c.kroky}</td><td>${ok(v.kroky, c.kroky)}</td></tr>
        </table>
        <p class="vy-nej">Nejlepší: ${bloku(z.nejlepsi.bloky)}, ${kroku(z.nejlepsi.kroky)}</p>
        <p class="vy-reakce">„${reakce}“</p>
        <div class="vy-tl">
          <button type="button" class="tl" data-akce="zpet">Zpět k programu</button>
          ${dalsiLevel()
            ? `<button type="button" class="tl hlavni" data-akce="dalsi">Další level ${dalsiLevel().id}</button>`
            : '<button type="button" class="tl hlavni" disabled>Další kapitola se staví</button>'}
        </div>
      </div>`;
    setTimeout(() => { if (beh && beh.hotovo && vis.poza === 'jasa') $('#vysledek').hidden = false; }, 900);
    vykresliZadani(); vykresliLevely();
  }

  function vykresliLevely() {
    const nav = $('#levely'); nav.innerHTML = '';
    LEVELY.forEach((l, i) => {
      const z = data.levely[l.id] || {}, b = el('button', 'tl lv' + (z.splneno ? ' hotovo' : ''), l.id);
      b.type = 'button'; b.dataset.level = l.id; b.disabled = !odemceno(i);
      b.title = l.nazev + (z.splneno ? ' (splněno)' : b.disabled ? ' (zamčeno)' : '');
      if (l.id === level.id) b.setAttribute('aria-current', 'step');
      nav.appendChild(b);
    });
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
  };
  const ikona = op => `<svg class="ikona" viewBox="0 0 20 20" aria-hidden="true">${IKONY[op] || ''}</svg>`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function vykresliZadani() {
    $('#lv-stitek').textContent = `Kapitola ${level.kapitola} · ${level.kapitolaNazev}`;
    $('#lv-nazev').textContent = `${level.id} ${level.nazev}`;
    $('#lv-text').textContent = level.zadani;
    $('#lv-napoveda').textContent = level.napoveda || '';
    $('#lv-napoveda').hidden = !level.napoveda;
    const z = data.levely[level.id], n = z && z.nejlepsi;
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

  function vykresliProgram() {
    const ol = $('#program'); ol.innerHTML = '';
    if (!program.length) ol.appendChild(el('li', 'prazdny', 'Klepni na blok v paletě, nebo ho sem přetáhni.'));
    program.forEach((u, i) => {
      const b = S.BLOKY[u.op];
      const li = el('li', 'blok b-' + b.druh + (u.id === vybrany ? ' vybrany' : ''),
        `<span class="cislo">${i + 1}</span>${ikona(u.op)}<span class="nazev">${b.nazev}</span><button type="button" class="smaz" aria-label="Smazat blok">×</button>`);
      li.dataset.id = u.id; li.tabIndex = 0;
      ol.appendChild(li);
    });
    const n = S.pocetBloku(program);
    $('#pocet').textContent = n + ' / ' + level.cile.bloky;
    $('#pocet').title = bloku(n) + ', cíl nejvýš ' + level.cile.bloky;
    $('#pocet').classList.toggle('pres', n > level.cile.bloky);
    $('#vymaz').disabled = !program.length;
  }

  function zvyrazni(ev) {
    document.querySelectorAll('#program .blok.aktivni').forEach(e => e.classList.remove('aktivni'));
    if (!ev || !ev.id) return;
    const e = document.querySelector(`#program .blok[data-id="${ev.id}"]`);
    if (e) { e.classList.add('aktivni'); if (e.scrollIntoView && beh && beh.bezi) e.scrollIntoView({ block: 'nearest' }); }
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

  function stavRadek(text, druh) {
    const e = $('#stav');
    if (text == null) {
      const st = beh ? (vis.ev ? vis.po : vis.stav) : null;
      text = st ? `Takt ${st.takt}` + (st.drzi ? ' · drží ' + (st.drzi.druh === 'propojka' ? 'propojku' : S.nazevDruhu(st.drzi.druh, 1)) : '') : 'Připraven.';
      druh = '';
    }
    e.textContent = text; e.className = 'stav' + (druh ? ' ' + druh : '');
  }

  function zmenaProgramu() {
    if (beh) zastav();
    ulozProgram(); vykresliProgram();
  }

  function vlozBlok(op, index) {
    const u = novyUzel(op);
    if (index == null) {
      const i = program.findIndex(x => x.id === vybrany);
      index = i < 0 ? program.length : i + 1;
    }
    program.splice(index, 0, u);
    vybrany = u.id;
    zmenaProgramu();
  }

  function smazBlok(id) {
    const i = program.findIndex(x => x.id === id);
    if (i < 0) return;
    program.splice(i, 1);
    if (vybrany === id) vybrany = program[i - 1] ? program[i - 1].id : null;
    zmenaProgramu();
  }

  // ---------- přetahování ----------

  let tah = null;

  function radky() { return [...document.querySelectorAll('#program li.blok:not(.tazeny)')]; }
  function indexVlozeni(y) {
    const r = radky();
    for (let i = 0; i < r.length; i++) { const b = r[i].getBoundingClientRect(); if (y < b.top + b.height / 2) return i; }
    return r.length;
  }
  function nadProgramem(x, y) {
    const b = $('#panel-program').getBoundingClientRect(), o = 24;
    return x > b.left - o && x < b.right + o && y > b.top - o && y < b.bottom + o;
  }

  function onDown(e) {
    if (e.button > 0 || tah) return;
    const blok = e.target.closest('.blok');
    if (!blok || e.target.closest('.smaz')) return;
    tah = {
      zdroj: blok.closest('#paleta') ? 'paleta' : 'program',
      op: blok.dataset.op, id: blok.dataset.id, el: blok,
      x0: e.clientX, y0: e.clientY, pid: e.pointerId, aktivni: false,
    };
    // Prstem v programu se táhne až po podržení, jinak by řádky blokovaly posun stránky.
    if (e.pointerType !== 'mouse' && tah.zdroj === 'program') {
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
    const r = tah.el.getBoundingClientRect();
    const d = tah.el.cloneNode(true);
    d.classList.remove('vybrany', 'aktivni'); d.classList.add('duch');
    d.style.width = r.width + 'px';
    tah.dx = tah.x0 - r.left; tah.dy = tah.y0 - r.top;
    document.body.appendChild(d); tah.duch = d;
    if (tah.zdroj === 'program') tah.el.classList.add('tazeny');
    tah.znacka = el('li', 'vkladani');
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
    if (nad) {
      const i = indexVlozeni(e.clientY), r = radky(), ol = $('#program');
      const pred = r[i] || null;
      if (tah.znacka.nextSibling !== pred || tah.znacka.parentNode !== ol) ol.insertBefore(tah.znacka, pred);
      const pr = ol.querySelector('.prazdny'); if (pr) pr.hidden = true;
      tah.index = i;
    } else {
      tah.znacka.remove(); tah.index = null;
      const pr = $('#program .prazdny'); if (pr) pr.hidden = false;
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
      else { vybrany = t.id; vykresliProgram(); }
      return;
    }
    t.duch.remove(); t.znacka.remove(); t.el.classList.remove('tazeny');
    if (zrusit || t.index === undefined) { vykresliProgram(); return; }   // podržel a pustil bez pohybu
    if (t.index != null) {
      if (t.zdroj === 'paleta') vlozBlok(t.op, t.index);
      else {
        const i = program.findIndex(x => x.id === t.id), [u] = program.splice(i, 1);
        program.splice(t.index, 0, u); vybrany = u.id; zmenaProgramu();
      }
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
    $('#program').addEventListener('click', e => { const s = e.target.closest('.smaz'); if (s) smazBlok(s.closest('.blok').dataset.id); });
    $('#program').addEventListener('keydown', e => {
      const b = e.target.closest('.blok'); if (!b) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazBlok(b.dataset.id); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vybrany = b.dataset.id; vykresliProgram(); }
    });
    $('#vymaz').addEventListener('click', () => { program = []; vybrany = null; zmenaProgramu(); });
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
      testIdx = +b.dataset.test; zastav(); vykresliTesty();
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
    level = S.pripravLevel(def);
    data.aktualni = level.id; uloz();
    document.body.classList.remove('bezi');
    $('#vysledek').hidden = true;
    const z = data.levely[level.id] || {};
    program = ocisti(z.program, level.bloky);
    vybrany = program.length ? program[program.length - 1].id : null;
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
    get beh() { return beh && { bezi: beh.bezi, hotovo: beh.hotovo, konec: beh.stav.konec, takt: beh.stav.takt }; },
    get vis() { return { poza: vis.poza, ev: vis.ev && vis.ev.typ, bublina: vis.bublina && vis.bublina.text }; },
    get T() { return T; },
    get neuspechu() { return neuspechu; },
    get level() { return level.id; },
  };
})();
