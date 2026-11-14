/*
 * Plošňák: simulace světa a interpret bloků. Bez DOM, běží v prohlížeči i v Node.
 *
 * Mapa levelu: '#' cestička, '.' mezera, 'X' překážka, 'P' přívod, 'V' výstup.
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
  };

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
    let privod = null, vystup = null;
    for (let y = 0; y < vyska; y++) for (let x = 0; x < sirka; x++) {
      if (bunky[y][x] === 'P') privod = { x, y };
      if (bunky[y][x] === 'V') vystup = { x, y };
    }
    const start = def.start || {};
    return Object.assign({}, def, {
      sirka, vyska, bunky,
      privodPos: privod && Object.assign(privod, { strana: SMER[(def.privod || {}).strana || 'sever'] }),
      vystupPos: vystup && Object.assign(vystup, { strana: SMER[(def.vystup || {}).strana || 'sever'] }),
      startPos: {
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
  const jeCesta = c => c === '#' || c === 'P' || c === 'V';

  // Zadání testu i (0.. viditelná, pak skrytá). Ze semínka, takže opakovatelné.
  function zadani(level, i) {
    const r = nahoda(hashText(level.id) + i * 7919);
    const p = level.privod || {};
    const [od, do_] = p.pocet || [1, 1];
    const n = od + Math.floor(r() * (do_ - od + 1));
    const druhy = Array.isArray(p.druh) ? p.druh : [p.druh || 'propojka'];
    const polozky = [];
    for (let k = 0; k < n; k++) polozky.push({ id: k, druh: druhy[Math.floor(r() * druhy.length)] });
    return { privod: polozky };
  }

  // ---------- stav ----------

  function novyStav(level, zad) {
    const s = level.startPos;
    return {
      x: s.x, y: s.y, smer: s.smer,
      drzi: null,
      privod: zad.privod.map(p => Object.assign({}, p)),
      celkem: zad.privod.length,
      vystup: [],
      podlaha: {},
      rozsypano: [],
      takt: 0,
      konec: null,
    };
  }

  function snimek(s) {
    return {
      x: s.x, y: s.y, smer: s.smer, drzi: s.drzi, takt: s.takt, konec: s.konec,
      privod: s.privod.slice(), vystup: s.vystup.slice(), celkem: s.celkem,
      podlaha: Object.assign({}, s.podlaha), rozsypano: s.rozsypano.slice(),
    };
  }

  // ---------- interpret ----------

  function stroj(program) { return { zasobnik: [{ seznam: program, i: 0, uzel: null, zbyva: 0 }] }; }

  // Projde řídicí bloky a vrátí další akční uzel, nebo null na konci programu.
  function dalsiAkce(m) {
    let pojistka = 0;
    for (;;) {
      if (++pojistka > POJISTKA) return { op: '_prazdnaSmycka' };
      const ram = m.zasobnik[m.zasobnik.length - 1];
      if (!ram) return null;
      if (ram.i >= ram.seznam.length) {
        if (ram.uzel && (ram.uzel.op === 'stale' || --ram.zbyva > 0)) { ram.i = 0; continue; }
        m.zasobnik.pop();
        continue;
      }
      const u = ram.seznam[ram.i++];
      const b = BLOKY[u.op];
      if (!b) continue;
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
  function aktivniUzly(m) { return m.zasobnik.filter(r => r.uzel).map(r => r.uzel.id); }

  const klic = (x, y) => x + ',' + y;

  // Jeden takt: vykoná další akční blok a vrátí událost pro vykreslení.
  function takt(level, s, m) {
    if (s.konec) return null;
    const u = dalsiAkce(m);
    if (!u) { s.konec = vyhodnot(level, s, 'konec'); return { typ: 'konec', konec: s.konec }; }
    if (u.op === '_prazdnaSmycka') { s.konec = { duvod: 'usnul', uspech: false }; return { typ: 'usnul', konec: s.konec }; }

    const z = { x: s.x, y: s.y, smer: s.smer };
    const ev = { id: u.id, op: u.op, z, smycky: aktivniUzly(m) };
    const [dx, dy] = SMERY[s.smer];
    s.takt++;

    switch (u.op) {
      case 'krok': {
        const nx = s.x + dx, ny = s.y + dy, c = bunka(level, nx, ny);
        if (c === 'X') { ev.typ = 'naraz'; break; }
        s.x = nx; s.y = ny;
        if (!jeCesta(c)) { ev.typ = 'pad'; s.konec = { duvod: 'pad', uspech: false }; break; }
        ev.typ = 'krok';
        break;
      }
      case 'skoc': {
        const nx = s.x + 2 * dx, ny = s.y + 2 * dy, c = bunka(level, nx, ny);
        if (c === 'X') { ev.typ = 'naraz'; break; }
        s.x = nx; s.y = ny;
        if (!jeCesta(c)) { ev.typ = 'pad'; ev.skok = true; s.konec = { duvod: 'pad', uspech: false }; break; }
        ev.typ = 'skok';
        break;
      }
      case 'vlevo': s.smer = (s.smer + 3) % 4; ev.typ = 'otoc'; break;
      case 'vpravo': s.smer = (s.smer + 1) % 4; ev.typ = 'otoc'; break;
      case 'zvedni': {
        const p = level.privodPos, k = klic(s.x, s.y);
        if (s.drzi) { ev.typ = 'plnaRuka'; break; }
        if (p && s.x === p.x && s.y === p.y) {
          if (!s.privod.length) {
            s.takt--;
            ev.typ = 'konecSmeny';
            s.konec = vyhodnot(level, s, 'konecSmeny');
            break;
          }
          s.drzi = s.privod.shift(); ev.typ = 'zvedni'; ev.odkud = 'privod'; ev.polozka = s.drzi;
          break;
        }
        if (s.podlaha[k]) { s.drzi = s.podlaha[k]; delete s.podlaha[k]; ev.typ = 'zvedni'; ev.odkud = 'podlaha'; ev.polozka = s.drzi; break; }
        ev.typ = 'hmat';
        break;
      }
      case 'poloz': {
        const v = level.vystupPos, p = level.privodPos, k = klic(s.x, s.y);
        if (!s.drzi) { ev.typ = 'prazdnaRuka'; break; }
        ev.polozka = s.drzi;
        if (v && s.x === v.x && s.y === v.y) { s.vystup.push(s.drzi); s.drzi = null; ev.typ = 'poloz'; ev.kam = 'vystup'; break; }
        if ((p && s.x === p.x && s.y === p.y) || s.podlaha[k]) {
          s.rozsypano.push({ x: s.x, y: s.y, polozka: s.drzi });
          if (s.podlaha[k]) { s.rozsypano.push({ x: s.x, y: s.y, polozka: s.podlaha[k] }); delete s.podlaha[k]; }
          s.drzi = null; ev.typ = 'rozsyp';
          break;
        }
        s.podlaha[k] = s.drzi; s.drzi = null; ev.typ = 'poloz'; ev.kam = 'podlaha';
        break;
      }
      default: ev.typ = 'nic';
    }
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
    const chyby = [];
    if (s.rozsypano.length) chyby.push('Rozsypal součástky.');
    if (s.drzi) chyby.push('Směna skončila a panáček pořád drží ' + (s.drzi.druh === 'led' ? 'LED' : nazevDruhu(s.drzi.druh, 1).replace(/a$/, 'u')) + '.');
    const naPodlaze = Object.keys(s.podlaha).length;
    if (naPodlaze) chyby.push('Na desce se válí ' + soucastky(naPodlaze) + '.');
    if (s.privod.length) chyby.push('V přívodu ' + (s.privod.length === 1 ? 'zůstala ' : 'zůstaly ') + soucastky(s.privod.length) + '.');
    if (!chyby.length && s.vystup.length !== s.celkem) chyby.push('Na výstupu je ' + s.vystup.length + ' z ' + s.celkem + '.');
    return chyby.length ? { duvod, uspech: false, zprava: chyby[0] } : { duvod, uspech: true };
  }

  const ZPRAVY = { pad: 'Spadl z cestičky.', usnul: 'Po 999 taktech usnul.' };

  function spustTest(level, program, i) {
    const s = novyStav(level, zadani(level, i)), m = stroj(program);
    while (!s.konec) takt(level, s, m);
    return {
      test: i, uspech: s.konec.uspech, duvod: s.konec.duvod, takty: s.takt,
      zprava: s.konec.zprava || ZPRAVY[s.konec.duvod] || '',
    };
  }

  function pocetBloku(program) {
    let n = 0;
    for (const u of program) { n++; if (u.telo) n += pocetBloku(u.telo); }
    return n;
  }

  // Všechna zadání (viditelná i skrytá). Kroky = průměr taktů přes zadání.
  function vyhodnotReseni(level, program) {
    const vysledky = [];
    for (let i = 0; i < level.pocetTestu + level.pocetSkrytych; i++) vysledky.push(spustTest(level, program, i));
    const vsechny = vysledky.every(v => v.uspech);
    const kroky = vysledky.reduce((a, v) => a + v.takty, 0) / vysledky.length;
    return { vsechny, vysledky, bloky: pocetBloku(program), kroky: Math.round(kroky * 10) / 10 };
  }

  return {
    SMERY, SMER, BLOKY, DRUHY, MAX_TAKTU,
    nahoda, hashText, pripravLevel, bunka, jeCesta, zadani,
    novyStav, snimek, stroj, takt, spustTest, vyhodnotReseni, pocetBloku, nazevDruhu, ZPRAVY,
  };
});
