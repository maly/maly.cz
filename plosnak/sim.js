/*
 * Plošňák: simulace světa a interpret bloků. Bez DOM, běží v prohlížeči i v Node.
 *
 * Mapa levelu: '#' cestička, '.' mezera, 'X' překážka, 'P' přívod, 'V' výstup,
 * 'R' páska se součástkami (zvednutí z prázdné pásky = konec směny), 'O' patice,
 * 'A', 'B', 'C' další výstupy, 'K' koš. Výstup může mít pravidlo, co na něj patří (prijima).
 * Level s `bludiste` dostane pro každé zadání vlastní vygenerovanou mapu (instance()).
 * Přívod a výstup jsou políčka cestičky; panáček na nich stojí a zvedá / pokládá.
 * Zásobník přívodu a přihrádka výstupu se kreslí na sousední políčko ve směru `strana`.
 *
 * Program je pole uzlů { id, op, n?, telo? }. Řídicí bloky (opakuj) takt nestojí,
 * každý akční blok stojí jeden takt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlosnakSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SMERY = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const SMER = { sever: 0, vychod: 1, jih: 2, zapad: 3 };
  const STRANY = {
    sever: [0, -1], vychod: [1, 0], jih: [0, 1], zapad: [-1, 0],
    severovychod: [1, -1], jihovychod: [1, 1], jihozapad: [-1, 1], severozapad: [-1, -1],
  };
  const MAX_TAKTU = 999;
  const POJISTKA = 10000;

  const BLOKY = {
    krok:   { nazev: 'krok', druh: 'pohyb' },
    vlevo:  { nazev: 'otoč vlevo', druh: 'pohyb' },
    vpravo: { nazev: 'otoč vpravo', druh: 'pohyb' },
    skoc:   { nazev: 'skoč', druh: 'pohyb' },
    zvedni: { nazev: 'zvedni', druh: 'ruce' },
    poloz:  { nazev: 'polož', druh: 'ruce' },
    opakuj: { nazev: 'opakuj', druh: 'rizeni', telo: true },
    stale:  { nazev: 'opakuj stále', druh: 'rizeni', telo: true },
    kdyz:   { nazev: 'když', druh: 'rozhod', telo: true, jinak: true },
    uloz:   { nazev: 'ulož do kapsy', druh: 'kapsa' },
    vyndej: { nazev: 'vyndej z kapsy', druh: 'kapsa' },
    prohod: { nazev: 'prohoď', druh: 'kapsa' },
    pajej:  { nazev: 'pájej', druh: 'pajka' },
    vypajej: { nazev: 'vypájej', druh: 'pajka' },
    otoc:   { nazev: 'otoč součástku v ruce', druh: 'pajka' },
    hvizdni: { nazev: 'hvízdni', druh: 'signal' },
    cekej:  { nazev: 'čekej na hvízdnutí', druh: 'signal' },
  };

  // Podmínky bloku když; stejné klíče slouží i jako pravidla výstupů (prijima).
  const PODMINKY = {
    'cesta:vpred': 'vpředu je cesta',
    'cesta:vlevo': 'vlevo je cesta',
    'cesta:vpravo': 'vpravo je cesta',
    'drzim': 'držím něco',
    'druh:propojka': 'držím propojku',
    'druh:odpor': 'držím odpor',
    'druh:led': 'držím LED',
    'druh:spaleny': 'držím spálený kus',
    'pruh:hneda': 'první pruh je hnědý',
    'pruh:cervena': 'první pruh je červený',
    'pruh:oranzova': 'první pruh je oranžový',
    'kapsa:vetsi': 'držená je větší než v kapse',
    'kapsa:mensi': 'držená je menší než v kapse',
    'kapsa:stejna': 'držená je stejná jako v kapse',
    'kapsa:neco': 'v kapse něco je',
    'patice:volna': 'stojím na volné patici',
    'patice:osazena': 'stojím na osazené patici',
    'znacka:obracena': 'značka je obráceně',
  };
  // Barevný kód odporu: první pruh = číslice 1 až 9.
  const PRUHY = ['hneda', 'cervena', 'oranzova', 'zluta', 'zelena', 'modra', 'fialova', 'seda', 'bila'];
  const BARVY = { hneda: 'hnědý', cervena: 'červený', oranzova: 'oranžový', zluta: 'žlutý', zelena: 'zelený', modra: 'modrý', fialova: 'fialový', seda: 'šedý', bila: 'bílý' };
  const BARVY7 = { hneda: 'hnědým', cervena: 'červeným', oranzova: 'oranžovým', zluta: 'žlutým', zelena: 'zeleným', modra: 'modrým', fialova: 'fialovým', seda: 'šedým', bila: 'bílým' };
  const hodnota = p => p && p.druh === 'odpor' ? PRUHY.indexOf(p.pruh) + 1 : 0;
  const stejne = (a, b) => !!a && !!b && a.druh === b.druh && (a.druh !== 'odpor' || a.pruh === b.pruh);

  const DRUHY = {
    propojka:    { jednotne: 'propojka', mnozne: 'propojky' },
    odpor:       { jednotne: 'odpor', mnozne: 'odpory' },
    led:         { jednotne: 'LED', mnozne: 'LED' },
    kondenzator: { jednotne: 'kondenzátor', mnozne: 'kondenzátory' },
    spaleny:     { jednotne: 'spálený kus', mnozne: 'spálené kusy' },
  };

  function nahoda(seed) {                       // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashText(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---------- level ----------

  function pripravLevel(def) {
    const bunky = def.mapa.map(r => r.split(''));
    const vyska = bunky.length, sirka = bunky[0].length;
    let privod = null;
    const paska = [], patice = [], vystupy = [];
    for (let y = 0; y < vyska; y++) for (let x = 0; x < sirka; x++) {
      const c = bunky[y][x];
      if (c === 'P') privod = { x, y };
      if (JE_VYSTUP.includes(c)) {
        const cfg = (def.vystupy || {})[c] || (c === 'V' ? def.vystup : null) || {};
        vystupy.push({ znak: c, x, y, strana: SMER[cfg.strana || 'sever'], posun: STRANY[cfg.strana || 'sever'],
          prijima: cfg.prijima || null, popis: cfg.popis || (c === 'K' ? 'KOŠ' : c === 'V' ? 'VÝSTUP' : 'VÝSTUP ' + c) });
      }
      if (c === 'R') paska.push({ x, y });
      if (c === 'O') patice.push({ x, y });
    }
    const strana = (pos, def) => pos && Object.assign(pos, { strana: SMER[def || 'sever'], posun: STRANY[def || 'sever'] });
    const start = def.start || {};
    return Object.assign({}, def, {
      sirka, vyska, bunky, paska_: paska, patice, vystupy,
      obvodMapa: Object.fromEntries((def.obvod || []).map((o, i) => [o.x + ',' + o.y, Object.assign({ poradi: i }, o)])),
      privodPos: strana(privod, (def.privod || {}).strana),
      vystupPos: vystupy[0] || null,
      startPoz: def.panacci ? def.panacci.map(p => ({ x: p.x, y: p.y, smer: SMER[p.smer || 'vychod'] })) : null,
      startPos: def.panacci ? { x: def.panacci[0].x, y: def.panacci[0].y, smer: SMER[def.panacci[0].smer || 'vychod'] } : {
        x: start.x != null ? start.x : privod.x,
        y: start.y != null ? start.y : privod.y,
        smer: SMER[start.smer || 'vychod'],
      },
      pocetTestu: (def.testy || {}).viditelne || 1,
      pocetSkrytych: (def.testy || {}).skryte || 0,
    });
  }

  function bunka(level, x, y) {
    if (x < 0 || y < 0 || x >= level.sirka || y >= level.vyska) return '.';
    return level.bunky[y][x];
  }
  const JE_VYSTUP = 'VABCK';
  const jeCesta = c => c === '#' || c === 'P' || c === 'R' || c === 'O' || c === 'H' || (!!c && JE_VYSTUP.includes(c));
  const vystupNa = (level, x, y) => level.vystupy.find(v => v.x === x && v.y === y) || null;

  // Dokonalé bludiště: buňky na sudých souřadnicích, chodby mezi nimi. Start vlevo nahoře, výstup vpravo dole.
  function generujBludiste(r, bw, bh) {
    const w = 2 * bw - 1, h = 2 * bh - 1;
    const m = Array.from({ length: h }, () => Array(w).fill('.'));
    const byl = new Set(), zas = [[0, 0]];
    byl.add('0,0'); m[0][0] = '#';
    while (zas.length) {
      const [cx, cy] = zas[zas.length - 1];
      const sousedi = SMERY.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < bw && y < bh && !byl.has(x + ',' + y));
      if (!sousedi.length) { zas.pop(); continue; }
      const [nx, ny, dx, dy] = sousedi[Math.floor(r() * sousedi.length)];
      m[2 * cy + dy][2 * cx + dx] = '#'; m[2 * ny][2 * nx] = '#';
      byl.add(nx + ',' + ny); zas.push([nx, ny]);
    }
    m[h - 1][w - 1] = 'V';
    return m.map(row => row.join(''));
  }

  const instance = (() => {
    const cache = new Map();
    return function (level, i) {
      if (!level.bludiste) return level;
      const k = level.id + ':' + i;
      if (!cache.has(k)) {
        const [bw, bh] = level.bludiste;
        cache.set(k, pripravLevel(Object.assign({}, level, { mapa: generujBludiste(nahoda(hashText(level.id) * 31 + i), bw, bh) })));
      }
      return cache.get(k);
    };
  })();

  function plati(level, s, k) {
    const [typ, h] = k.split(':');
    if (typ === 'cesta') {
      const [dx, dy] = SMERY[(s.smer + { vpred: 0, vpravo: 1, vlevo: 3 }[h]) % 4];
      return jeCesta(bunka(level, s.x + dx, s.y + dy));
    }
    if (typ === 'drzim') return !!s.drzi;
    if (typ === 'patice' || typ === 'znacka') {
      const o = level.obvodMapa[klic(s.x, s.y)];
      if (!o) return false;
      if (typ === 'znacka') return !!s.znacky[klic(s.x, s.y)];
      return h === 'volna' ? !s.podlaha[klic(s.x, s.y)] : !!s.podlaha[klic(s.x, s.y)];
    }
    if (typ === 'kapsa') {
      if (h === 'neco') return !!s.kapsa;
      if (!s.drzi || !s.kapsa) return false;
      if (h === 'stejna') return stejne(s.drzi, s.kapsa);
      if (s.drzi.druh !== 'odpor' || s.kapsa.druh !== 'odpor') return false;
      return h === 'vetsi' ? hodnota(s.drzi) > hodnota(s.kapsa) : hodnota(s.drzi) < hodnota(s.kapsa);
    }
    return splnuje(s.drzi, k);
  }
  function splnuje(polozka, k) {
    if (!polozka) return false;
    const [typ, h] = k.split(':');
    if (typ === 'druh') return polozka.druh === h;
    if (typ === 'pruh') return polozka.druh === 'odpor' && polozka.pruh === h;
    return true;
  }

  // Zadání testu i (0.. viditelná, pak skrytá). Ze semínka, takže opakovatelné.
  function zadani(level, i) {
    const r = nahoda(hashText(level.id) + i * 7919);
    let id = 0;
    const generuj = p => {
      const [od, do_] = p.pocet || [1, 1];
      const n = (od + Math.floor(r() * (do_ - od + 1))) * (p.skupina || 1);   // pocet = počet skupin, je-li skupina
      const druhy = Array.isArray(p.druh) ? p.druh : [p.druh || 'propojka'];
      const out = [];
      const novy = druh => {
        const pol = { id: id++, druh };
        if (druh === 'odpor') { const pr = p.pruh || ['hneda', 'cervena', 'oranzova']; pol.pruh = pr[Math.floor(r() * pr.length)]; }
        return pol;
      };
      if (p.poradi) return p.poradi.map(novy);                // pevné pořadí
      if (p.slozeni) {                                       // daný počet kusů každého druhu, zamíchaný
        for (const [druh, [a, b]] of Object.entries(p.slozeni)) {
          const m = a + Math.floor(r() * (b - a + 1));
          for (let k = 0; k < m; k++) out.push(novy(druh));
        }
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
      }
      if (p.pary) {                                          // skupiny v náhodném pořadí uvnitř skupiny
        const skup = od + Math.floor(r() * (do_ - od + 1));
        for (let k = 0; k < skup; k++) {
          const g = p.pary.slice();
          for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
          g.forEach(d => out.push(novy(d)));
        }
        for (const [druh, [a, b]] of Object.entries(p.primes || {})) {   // vmíchané kusy navíc (spálené)
          const m = a + Math.floor(r() * (b - a + 1));
          for (let k = 0; k < m; k++) out.splice(Math.floor(r() * (out.length + 1)), 0, novy(druh));
        }
        return out;
      }
      for (let k = 0; k < n; k++) {
        if (k && p.opakovani && r() < p.opakovani) { out.push(Object.assign({}, out[k - 1], { id: id++ })); continue; }
        const pol = { id: id++, druh: druhy[Math.floor(r() * druhy.length)] };
        if (pol.druh === 'odpor') { const pr = p.pruh || ['hneda', 'cervena', 'oranzova']; pol.pruh = pr[Math.floor(r() * pr.length)]; }
        out.push(pol);
      }
      return out;
    };
    const privod = level.privodPos ? generuj(level.privod || {}) : [];
    // obvod: polarita značek, předem osazená deska s jedním spáleným kusem
    const znacky = {}, cin = [], rz = nahoda(hashText(level.id + ':znacky') + i * 104729);
    for (const o of level.obvod || []) {
      const k = o.x + ',' + o.y;
      znacky[k] = o.polarita === 'nahodna' ? (i < 2 ? i : rz() < .5 ? 1 : 0) : (o.polarita | 0);   // první dvě zadání vždy obě varianty
    }
    const predem = [];
    if (level.osazeno) {
      const kandidati = (level.obvod || []).filter(o => o.druh === level.osazeno.spaleny);
      const vadny = kandidati[Math.floor(r() * kandidati.length)];
      for (const o of level.obvod) {
        const pol = { id: id++, druh: o === vadny ? 'spaleny' : o.druh };
        if (pol.druh === 'odpor') pol.pruh = 'cervena';
        if (pol.druh === 'led') pol.otoceno = !!znacky[o.x + ',' + o.y];
        predem.push({ x: o.x, y: o.y, polozka: pol }); cin.push(o.x + ',' + o.y);
      }
    }
    const skupin = (level.privod || {}).pary ? privod.filter(p => p.druh !== 'spaleny').length / level.privod.pary.length
      : level.skupinZ === 'dobre' ? privod.filter(p => p.druh !== 'spaleny').length : 0;
    const podlaha = (level.podlaha || []).map(p => ({ x: p.x, y: p.y, polozka: { id: id++, druh: p.druh || 'propojka' } }));
    if (level.paska) generuj(level.paska).forEach((p, i) => podlaha.push({ x: level.paska_[i].x, y: level.paska_[i].y, polozka: p }));
    return { privod, podlaha: podlaha.concat(predem), znacky, cin, skupin };
  }

  // ---------- stav ----------

  function novyStav(level, zad) {
    const s = level.startPos;
    return {
      x: s.x, y: s.y, smer: s.smer,
      drzi: null,
      kapsa: null,
      zadano: zad.privod.map(p => Object.assign({}, p)),
      privod: zad.privod.map(p => Object.assign({}, p)),
      celkem: zad.privod.length + zad.podlaha.length,
      vystup: [],
      podlaha: Object.fromEntries(zad.podlaha.map(p => [klic(p.x, p.y), Object.assign({}, p.polozka)])),
      cin: Object.fromEntries((zad.cin || []).map(k => [k, true])),
      znacky: zad.znacky || {},
      skupin: zad.skupin || 0,
      rozsypano: [],
      takt: 0,
      konec: null,
      ag: level.startPoz ? level.startPoz.map(p => ({ x: p.x, y: p.y, smer: p.smer, drzi: null, kapsa: null, hotovo: false, ceka: null })) : null,
      signaly: level.startPoz ? level.startPoz.map(() => 0) : null,
    };
  }

  function snimek(s) {
    return {
      x: s.x, y: s.y, smer: s.smer, drzi: s.drzi, kapsa: s.kapsa, takt: s.takt, konec: s.konec,
      privod: s.privod.slice(), vystup: s.vystup.slice(), celkem: s.celkem,
      podlaha: Object.assign({}, s.podlaha), rozsypano: s.rozsypano.slice(),
      cin: Object.assign({}, s.cin), znacky: s.znacky, skupin: s.skupin,
      ag: s.ag ? s.ag.map(a => ({ x: a.x, y: a.y, smer: a.smer, drzi: a.drzi, kapsa: a.kapsa, hotovo: a.hotovo, ceka: !!a.ceka })) : null,
      signaly: s.signaly ? s.signaly.slice() : null,
    };
  }

  // ---------- interpret ----------

  function stroj(program) { return { zasobnik: [{ seznam: program, i: 0, uzel: null, zbyva: 0 }] }; }

  // Projde řídicí bloky a vrátí další akční uzel, nebo null na konci programu.
  function dalsiAkce(m, level, s) {
    let pojistka = 0;
    for (;;) {
      if (++pojistka > POJISTKA) return { op: '_prazdnaSmycka' };
      const ram = m.zasobnik[m.zasobnik.length - 1];
      if (!ram) return null;
      if (ram.i >= ram.seznam.length) {
        if (ram.uzel && (ram.uzel.op === 'stale' || --ram.zbyva > 0)) { ram.i = 0; ram.kolo = (ram.kolo || 0) + 1; continue; }
        m.zasobnik.pop();
        continue;
      }
      const u = ram.seznam[ram.i++];
      const b = BLOKY[u.op];
      if (!b) continue;
      if (u.op === 'kdyz') {
        const ano = plati(level, s, u.podminka || 'drzim'), vetev = ano ? u.telo : u.jinak;
        if (vetev && vetev.length) m.zasobnik.push({ seznam: vetev, i: 0, uzel: u, zbyva: 1, vetev: ano ? 'telo' : 'jinak' });
        continue;
      }
      if (b.telo) {
        const n = u.op === 'stale' ? Infinity : (u.n | 0);
        if (n <= 0 || !(u.telo && u.telo.length)) { if (u.op === 'stale') return { op: '_prazdnaSmycka' }; continue; }
        m.zasobnik.push({ seznam: u.telo, i: 0, uzel: u, zbyva: n });
        continue;
      }
      return u;
    }
  }

  // Uzly, které právě běží (smyčky a akční blok), pro podsvícení v rozhraní.
  function aktivniUzly(m) {
    return m.zasobnik.filter(r => r.uzel).map(r => r.uzel.op === 'kdyz' ? { id: r.uzel.id, vetev: r.vetev } : ({
      id: r.uzel.id, n: r.uzel.op === 'stale' ? 0 : r.uzel.n,
      kolo: r.uzel.op === 'stale' ? (r.kolo || 0) + 1 : r.uzel.n - r.zbyva + 1,
    }));
  }

  const klic = (x, y) => x + ',' + y;

  const obsazeno = (s, x, y) => !!s._jini && s._jini.some(a => a.x === x && a.y === y);

  // Akční blok na stavu s (pro víc panáčků je v s nahraný ten, kdo je na řadě).
  function vykonej(level, s, u, ev) {
    const [dx, dy] = SMERY[s.smer];
    switch (u.op) {
      case 'krok': {
        const nx = s.x + dx, ny = s.y + dy, c = bunka(level, nx, ny);
        if (c === 'X' || obsazeno(s, nx, ny)) { ev.typ = 'naraz'; break; }
        s.x = nx; s.y = ny;
        if (!jeCesta(c)) { ev.typ = 'pad'; s.konec = { duvod: 'pad', uspech: false }; break; }
        ev.typ = 'krok';
        if (level.kontrola === 'dojdi' && c === 'V') s.konec = { duvod: 'dosel', uspech: true };
        break;
      }
      case 'skoc': {
        const nx = s.x + 2 * dx, ny = s.y + 2 * dy, c = bunka(level, nx, ny);
        if (c === 'X' || obsazeno(s, nx, ny)) { ev.typ = 'naraz'; break; }
        s.x = nx; s.y = ny;
        if (!jeCesta(c)) { ev.typ = 'pad'; ev.skok = true; s.konec = { duvod: 'pad', uspech: false }; break; }
        ev.typ = 'skok';
        if (level.kontrola === 'dojdi' && c === 'V') s.konec = { duvod: 'dosel', uspech: true };
        break;
      }
      case 'vlevo': s.smer = (s.smer + 3) % 4; ev.typ = 'otoc'; break;
      case 'vpravo': s.smer = (s.smer + 1) % 4; ev.typ = 'otoc'; break;
      case 'zvedni': {
        const p = level.privodPos, k = klic(s.x, s.y);
        if (s.drzi) { ev.typ = 'plnaRuka'; break; }
        if (p && s.x === p.x && s.y === p.y) {
          if (!s.privod.length) { ev.typ = 'konecSmeny'; ev.konecSmeny = true; break; }
          s.drzi = s.privod.shift(); ev.typ = 'zvedni'; ev.odkud = 'privod'; ev.polozka = s.drzi;
          break;
        }
        if (s.podlaha[k] && s.cin[k]) { ev.typ = 'pripajeno'; break; }
        if (s.podlaha[k]) { s.drzi = s.podlaha[k]; delete s.podlaha[k]; ev.typ = 'zvedni'; ev.odkud = 'podlaha'; ev.polozka = s.drzi; break; }
        if (bunka(level, s.x, s.y) === 'R') { ev.typ = 'konecSmeny'; ev.konecSmeny = true; break; }   // prázdná páska
        ev.typ = 'hmat';
        break;
      }
      case 'poloz': {
        const v = vystupNa(level, s.x, s.y), p = level.privodPos, k = klic(s.x, s.y);
        if (!s.drzi) { ev.typ = 'prazdnaRuka'; break; }
        ev.polozka = s.drzi;
        if (v) {
          s.vystup.push(Object.assign({}, s.drzi, { kam: v.znak })); s.drzi = null;
          ev.typ = 'poloz'; ev.kam = 'vystup'; ev.vystup = v.znak;
          break;
        }
        if ((p && s.x === p.x && s.y === p.y) || s.podlaha[k]) {
          s.rozsypano.push({ x: s.x, y: s.y, polozka: s.drzi });
          if (s.podlaha[k]) { s.rozsypano.push({ x: s.x, y: s.y, polozka: s.podlaha[k] }); delete s.podlaha[k]; }
          s.drzi = null; ev.typ = 'rozsyp';
          break;
        }
        s.podlaha[k] = s.drzi; s.drzi = null; ev.typ = 'poloz'; ev.kam = 'podlaha';
        break;
      }
      case 'pajej': {
        const k = klic(s.x, s.y);
        if (!level.obvodMapa[k] || !s.podlaha[k]) { ev.typ = 'pajejNaprazdno'; break; }
        if (s.cin[k]) { ev.typ = 'uzPajeno'; break; }
        s.cin[k] = true; ev.typ = 'pajej';
        break;
      }
      case 'vypajej': {
        const k = klic(s.x, s.y);
        if (!s.cin[k]) { ev.typ = 'neniCin'; break; }
        delete s.cin[k]; ev.typ = 'vypajej';
        break;
      }
      case 'otoc':
        if (!s.drzi) { ev.typ = 'prazdnaRuka'; break; }
        s.drzi = Object.assign({}, s.drzi, { otoceno: !s.drzi.otoceno }); ev.typ = 'otocSoucastku'; ev.polozka = s.drzi;
        break;
      case 'uloz':
        if (!s.drzi) { ev.typ = 'prazdnaRuka'; break; }
        if (s.kapsa) { ev.typ = 'plnaKapsa'; break; }
        s.kapsa = s.drzi; s.drzi = null; ev.typ = 'doKapsy'; ev.polozka = s.kapsa;
        break;
      case 'vyndej':
        if (!s.kapsa) { ev.typ = 'prazdnaKapsa'; break; }
        if (s.drzi) { ev.typ = 'plnaRuka'; break; }
        s.drzi = s.kapsa; s.kapsa = null; ev.typ = 'zKapsy'; ev.polozka = s.drzi;
        break;
      case 'prohod': {
        if (!s.drzi && !s.kapsa) { ev.typ = 'prazdnaKapsa'; break; }
        const d = s.drzi; s.drzi = s.kapsa; s.kapsa = d;
        ev.typ = 'prohod'; ev.doKapsy = s.kapsa; ev.zKapsy = s.drzi;
        break;
      }
      default: ev.typ = 'nic';
    }
  }

  // Jeden takt pro víc panáčků: každý vykoná jeden blok, nejdřív první, pak druhý.
  // Hvízdnutí přidá druhému signál, čekej jeden spotřebuje, jinak stojí.
  // Směna skončí, když se už nikdo nemůže pohnout (všichni skončili nebo marně čekají).
  const POLE = ['x', 'y', 'smer', 'drzi', 'kapsa'];
  function taktVice(level, s, stroje) {
    if (s.konec) return null;
    const udalosti = [];
    let pohyb = false;
    for (let i = 0; i < s.ag.length && !s.konec; i++) {
      const a = s.ag[i];
      if (a.hotovo) continue;
      for (const k of POLE) s[k] = a[k];
      s._jini = s.ag.filter((_, j) => j !== i);
      const u = a.ceka || dalsiAkce(stroje[i], level, s);
      if (!u) { a.hotovo = true; continue; }
      if (u.op === '_prazdnaSmycka') { s.konec = { duvod: 'usnul', uspech: false, panacek: i }; break; }
      const ev = { id: u.id, op: u.op, z: { x: s.x, y: s.y, smer: s.smer }, smycky: aktivniUzly(stroje[i]), panacek: i };
      if (u.op === 'cekej') {
        if (s.signaly[i] > 0) { s.signaly[i]--; a.ceka = null; ev.typ = 'dockal'; pohyb = true; }
        else { a.ceka = u; ev.typ = 'ceka'; }
      } else if (u.op === 'hvizdni') {
        s.signaly[1 - i]++; ev.typ = 'hvizd'; pohyb = true;
      } else {
        vykonej(level, s, u, ev);
        if (ev.konecSmeny) a.hotovo = true; else pohyb = true;
        if (s.konec) s.konec.panacek = i;
      }
      for (const k of POLE) a[k] = s[k];
      ev.na = { x: s.x, y: s.y, smer: s.smer };
      udalosti.push(ev);
    }
    s._jini = null;
    if (!s.konec) {
      if (!pohyb) s.konec = vyhodnot(level, s, 'konec');
      else if (++s.takt >= MAX_TAKTU) s.konec = { duvod: 'usnul', uspech: false };
    }
    return { typ: 'vice', udalosti, konec: s.konec };
  }

  // Jeden takt: vykoná další akční blok a vrátí událost pro vykreslení.
  function takt(level, s, m) {
    if (level.startPoz) return taktVice(level, s, m);
    if (s.konec) return null;
    const u = dalsiAkce(m, level, s);
    if (!u) { s.konec = vyhodnot(level, s, 'konec'); return { typ: 'konec', konec: s.konec }; }
    if (u.op === '_prazdnaSmycka') { s.konec = { duvod: 'usnul', uspech: false }; return { typ: 'usnul', konec: s.konec }; }

    const z = { x: s.x, y: s.y, smer: s.smer };
    const ev = { id: u.id, op: u.op, z, smycky: aktivniUzly(m) };
    s.takt++;

    vykonej(level, s, u, ev);
    if (ev.konecSmeny) { s.takt--; s.konec = vyhodnot(level, s, 'konecSmeny'); }
    if (!s.konec && s.takt >= MAX_TAKTU) { s.konec = { duvod: 'usnul', uspech: false }; ev.usnul = true; }
    if (s.konec) ev.konec = s.konec;
    ev.na = { x: s.x, y: s.y, smer: s.smer };
    return ev;
  }

  function nazevDruhu(druh, n) {
    const d = DRUHY[druh] || { jednotne: 'součástka', mnozne: 'součástky' };
    return n === 1 ? d.jednotne : d.mnozne;
  }
  function soucastky(n) { return n === 1 ? '1 součástka' : n < 5 ? n + ' součástky' : n + ' součástek'; }

  // Vyhodnocení na konci směny. Vrací { duvod, uspech, zprava }.
  function vyhodnot(level, s, duvod) {
    if (level.kontrola === 'piskoviste') return { duvod, uspech: false, piskoviste: true, zprava: 'Směna skončila. Na pískovišti se nic nehodnotí.' };
    const chyby = [];
    if (s.ag) {                                         // víc panáčků: co drží a mají v kapsách
      const d = s.ag.find(a => a.drzi), k = s.ag.find(a => a.kapsa);
      s.drzi = d ? d.drzi : null; s.kapsa = k ? k.kapsa : null;
    }
    if (level.kontrola === 'dojdi') return { duvod, uspech: false, zprava: 'Nedošel k výstupu.' };
    if (s.rozsypano.length) chyby.push('Rozsypal součástky.');
    if (s.drzi) chyby.push('Směna skončila a panáček pořád drží ' + (s.drzi.druh === 'led' ? 'LED' : nazevDruhu(s.drzi.druh, 1).replace(/a$/, 'u')) + '.');
    if (s.kapsa && !level.kapsaSmiZustat) chyby.push('Směna skončila a v kapse zůstal' + (s.kapsa.druh === 'odpor' || s.kapsa.druh === 'spaleny' ? ' ' : 'a ') + nazevPolozky(s.kapsa) + '.');
    const lezi = Object.keys(s.podlaha).map(k => k.split(',').map(Number));
    const naPasce = lezi.filter(([x, y]) => bunka(level, x, y) === 'R').length;
    const vPaticich = lezi.filter(([x, y]) => bunka(level, x, y) === 'O').length;
    const vObvodu = lezi.filter(([x, y]) => level.obvodMapa[x + ',' + y]).length;
    const naPodlaze = lezi.length - naPasce - (level.kontrola === 'patice' ? vPaticich : 0) - vObvodu;
    if (naPasce) chyby.push('Na pásce ' + (naPasce === 1 ? 'zůstala ' : 'zůstaly ') + soucastky(naPasce) + '.');
    if (naPodlaze) chyby.push('Na desce se válí ' + soucastky(naPodlaze) + '.');
    if (level.obvod) {
      if (s.privod.length) chyby.push('V přívodu ' + (s.privod.length === 1 ? 'zůstala ' : 'zůstaly ') + soucastky(s.privod.length) + '.');
      chyby.push(...chybyObvodu(level, s));
      for (const p of s.vystup) {
        const v = level.vystupy.find(x => x.znak === p.kam);
        if (v && v.prijima && !splnuje(p, v.prijima)) { chyby.push(`Do koše patří ${popisPravidla(v.prijima)}, ale skončil tam ${nazevPolozky(p)}.`); break; }
      }
      return chyby.length ? { duvod, uspech: false, zprava: chyby[0] } : { duvod, uspech: true };
    }
    if (level.kontrola === 'patice') {
      if (!chyby.length && s.privod.length) chyby.push('V přívodu ' + (s.privod.length === 1 ? 'zůstala ' : 'zůstaly ') + soucastky(s.privod.length) + '.');
      if (!chyby.length && vPaticich !== s.celkem) chyby.push('Osazeno je ' + vPaticich + ' z ' + s.celkem + ' patic.');
      if (!chyby.length && level.patice.slice(0, s.celkem).some(p => !s.podlaha[klic(p.x, p.y)]))
        chyby.push('Patice se mají osazovat popořadě, bez mezer.');
      return chyby.length ? { duvod, uspech: false, zprava: chyby[0] } : { duvod, uspech: true };
    }
    if (s.privod.length) chyby.push('V přívodu ' + (s.privod.length === 1 ? 'zůstala ' : 'zůstaly ') + soucastky(s.privod.length) + '.');
    for (const p of s.vystup) {
      const v = level.vystupy.find(x => x.znak === p.kam);
      if (v && v.prijima && !splnuje(p, v.prijima)) {
        chyby.unshift(`Na ${v.znak === 'K' ? 'koš' : v.znak === 'V' ? 'výstup' : 'výstup ' + v.znak} patří ${popisPravidla(v.prijima)}, ale skončil${p.druh === 'odpor' || p.druh === 'spaleny' || p.druh === 'kondenzator' ? '' : 'a'} tam ${nazevPolozky(p)}.`);
        break;
      }
    }
    if (level.poradi && !chyby.length) {                  // na výstupu V záleží na pořadí
      const cil = OCEKAVANI[level.poradi](s.zadano), maV = s.vystup.filter(p => p.kam === 'V');
      for (let i = 0; i < cil.length && !chyby.length; i++) {
        if (!maV[i]) chyby.push('Na výstupu chybí ' + (cil.length - maV.length === 1 ? 'jedna součástka' : soucastky(cil.length - maV.length)) + ': je tam ' + maV.length + ' z ' + cil.length + '.');
        else if (!stejne(maV[i], cil[i])) chyby.push('Na výstupu je na ' + (i + 1) + '. místě ' + nazevPolozky(maV[i]) + ', ale patří tam ' + nazevPolozky(cil[i]) + '.');
      }
      if (!chyby.length && maV.length > cil.length) chyby.push('Na výstupu je o ' + soucastky(maV.length - cil.length) + ' víc, než má být.');
      const zbyva = s.celkem - s.vystup.length - (s.kapsa && level.kapsaSmiZustat ? 1 : 0);
      if (!chyby.length && zbyva) chyby.push('Nedoručen' + (zbyva === 1 ? 'a zůstala ' : 'é zůstaly ') + soucastky(zbyva) + '.');
      return chyby.length ? { duvod, uspech: false, zprava: chyby[0] } : { duvod, uspech: true };
    }
    if (!chyby.length && s.vystup.length !== s.celkem) chyby.push('Na výstupu je ' + s.vystup.length + ' z ' + s.celkem + '.');
    return chyby.length ? { duvod, uspech: false, zprava: chyby[0] } : { duvod, uspech: true };
  }

  // Obvod: každá potřebná patice osazená správným, nespáleným kusem, zapájená, LED správně otočená.
  // U skupin (řada světel) jsou potřeba jen patice skupin, na které přívod vydal součástky.
  function paticePotreba(level, s, o) { return o.skupina == null || o.skupina < s.skupin; }
  function chybyObvodu(level, s) {
    const out = [];
    for (const o of Object.values(level.obvodMapa)) {
      const k = o.x + ',' + o.y, p = s.podlaha[k], jm = 'Patice ' + (o.poradi + 1) + ' (' + (o.druh === 'led' ? 'LED' : 'odpor') + ')';
      if (!paticePotreba(level, s, o)) { if (p) out.push(jm + ' měla zůstat prázdná.'); continue; }
      if (!p) { out.push(jm + ' není osazená.'); continue; }
      if (p.druh === 'spaleny') { out.push(jm + ': v obvodu zůstal spálený kus.'); continue; }
      if (p.druh !== o.druh) { out.push(jm + ': je v ní ' + nazevPolozky(p) + '.'); continue; }
      if (o.druh === 'led' && !!p.otoceno !== !!s.znacky[k]) { out.push(jm + ': LED je otočená obráceně.'); continue; }
      if (!s.cin[k]) out.push(jm + ' není zapájená.');
    }
    return out;
  }
  // Svítí LED? Skupina je hotová, když jsou všechny její patice v pořádku.
  function sviti(level, s, o) {
    const sk = o.skupina;
    return level.obvod.filter(x => x.skupina === sk).every(x => {
      const k = x.x + ',' + x.y, p = s.podlaha[k];
      return p && p.druh === x.druh && s.cin[k] && (x.druh !== 'led' || !!p.otoceno === !!s.znacky[k]);
    });
  }

  // Co má skončit na výstupu V, v tomto pořadí, podle toho, co přívod vydal.
  const skupiny = (a, n) => { const o = []; for (let i = 0; i + n <= a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const OCEKAVANI = {
    'obrat-dvojice': z => skupiny(z, 2).flatMap(([a, b]) => [b, a]),
    'serad-dvojice': z => skupiny(z, 2).flatMap(([a, b]) => hodnota(b) < hodnota(a) ? [b, a] : [a, b]),
    'max-z-trojice': z => skupiny(z, 3).map(t => t.reduce((m, p) => hodnota(p) > hodnota(m) ? p : m)),
    'dvojcata': z => z.filter((p, i) => i && stejne(p, z[i - 1])),
  };

  function popisPravidla(k) {
    const [typ, h] = k.split(':');
    if (typ === 'druh') return { propojka: 'jen propojky', odpor: 'jen odpory', led: 'jen LED', spaleny: 'jen spálené kusy' }[h];
    if (typ === 'pruh') return 'jen odpory s ' + BARVY7[h] + ' prvním pruhem';
    return 'cokoli';
  }
  function nazevPolozky(p) {
    if (p.druh === 'odpor' && p.pruh) return 'odpor ' + hodnota(p) + ' (s ' + BARVY7[p.pruh] + ' pruhem)';
    return nazevDruhu(p.druh, 1);
  }

  const ZPRAVY = { pad: 'Spadl z cestičky.', usnul: 'Po 999 taktech usnul.' };

  function spustTest(level, program, i) {
    level = instance(level, i);
    const s = novyStav(level, zadani(level, i)), m = level.startPoz ? program.map(stroj) : stroj(program);
    while (!s.konec) takt(level, s, m);
    return {
      test: i, uspech: s.konec.uspech, duvod: s.konec.duvod, takty: s.takt,
      zprava: s.konec.zprava || ZPRAVY[s.konec.duvod] || '',
    };
  }

  function pocetBloku(program) {
    let n = 0;
    for (const u of program) { n++; if (u.telo) n += pocetBloku(u.telo); if (u.jinak) n += pocetBloku(u.jinak); }
    return n;
  }

  // Všechna zadání (viditelná i skrytá). Kroky = průměr taktů přes zadání.
  function vyhodnotReseni(level, program) {
    const vysledky = [];
    for (let i = 0; i < level.pocetTestu + level.pocetSkrytych; i++) vysledky.push(spustTest(level, program, i));
    const vsechny = vysledky.every(v => v.uspech);
    const kroky = vysledky.reduce((a, v) => a + v.takty, 0) / vysledky.length;
    const bloky = level.startPoz ? program.reduce((a, p) => a + pocetBloku(p), 0) : pocetBloku(program);
    return { vsechny, vysledky, bloky, kroky: Math.round(kroky * 10) / 10 };
  }

  return {
    SMERY, SMER, STRANY, BLOKY, PODMINKY, sviti, BARVY, PRUHY, hodnota, stejne, nazevPolozky, OCEKAVANI, instance, plati, splnuje, vystupNa, generujBludiste, DRUHY, MAX_TAKTU,
    nahoda, hashText, pripravLevel, bunka, jeCesta, zadani,
    novyStav, snimek, stroj, takt, spustTest, vyhodnotReseni, pocetBloku, nazevDruhu, ZPRAVY,
  };
});
