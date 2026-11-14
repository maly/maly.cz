// Spuštění: node --test plosnak/testy/
const test = require('node:test');
const assert = require('node:assert');
const S = require('../sim.js');
const LEVELY = require('../levely.js');
const RESENI = require('./reseni.js');

let id = 0;
// Zápis programu: ['krok', 'zvedni', ['opakuj', 3, [...]], ['stale', [...]], ['kdyz', 'podminka', [pak], [jinak]]]
function prg(zapis) {
  return zapis.map(z => {
    if (typeof z === 'string') return { id: 'u' + ++id, op: z };
    if (z[0] === 'opakuj') return { id: 'u' + ++id, op: 'opakuj', n: z[1], telo: prg(z[2]) };
    if (z[0] === 'opakujKdyz') return { id: 'u' + ++id, op: 'opakujKdyz', podminka: z[1], telo: prg(z[2]) };
    if (z[0] === 'kdyz') return { id: 'u' + ++id, op: 'kdyz', podminka: z[1], telo: prg(z[2]), jinak: prg(z[3] || []) };
    return { id: 'u' + ++id, op: z[0], telo: prg(z[1]) };
  });
}

for (const def of LEVELY.filter(l => l.kontrola !== 'piskoviste')) {
  const level = S.pripravLevel(def);
  const r = RESENI[def.id];
  const prgL = def.panacci ? (x => x.map(prg)) : prg;     // víc panáčků: pole programů
  test(`level ${def.id}: má referenční řešení a chybná řešení`, () => {
    assert.ok(r, 'chybí záznam v reseni.js');
    assert.ok(r.chybna.length >= 3, 'aspoň tři chybná řešení');
  });
  test(`level ${def.id}: referenční řešení projde`, () => {
    const v = S.vyhodnotReseni(level, prgL(r.reference));
    assert.ok(v.vsechny, JSON.stringify(v.vysledky));
  });
  test(`level ${def.id}: cíle jsou splnitelné (referenčním nebo alternativním řešením)`, () => {
    const vse = [r.reference, ...(r.alternativy || [])].map(p => S.vyhodnotReseni(level, prgL(p)));
    const b = Math.min(...vse.map(v => v.bloky)), k = Math.min(...vse.map(v => v.kroky));
    assert.ok(b <= def.cile.bloky, `bloky ${b} > ${def.cile.bloky}`);
    assert.ok(k <= def.cile.kroky, `kroky ${k} > ${def.cile.kroky}`);
  });
  for (const [i, alt] of (r.alternativy || []).entries()) {
    test(`level ${def.id}: alternativní řešení ${i + 1} projde`, () => {
      const v = S.vyhodnotReseni(level, prgL(alt));
      assert.ok(v.vsechny, JSON.stringify(v.vysledky));
    });
  }
  for (const [i, ch] of r.chybna.entries()) {
    test(`level ${def.id}: chybné řešení ${i + 1} neprojde (${ch.duvod})`, () => {
      const v = S.vyhodnotReseni(level, prgL(ch.program));
      assert.ok(!v.vsechny);
      const spatne = v.vysledky.find(x => !x.uspech);
      if (ch.duvod) assert.strictEqual(spatne.duvod, ch.duvod);
      if (ch.zprava) assert.match(spatne.zprava, ch.zprava);
    });
  }
  test(`level ${def.id}: palety obsahují jen známé bloky a podmínky`, () => {
    for (const b of def.bloky) assert.ok(S.BLOKY[b], b);
    for (const p of def.podminky || []) assert.ok(S.PODMINKY[p], p);
  });
}

// ---------- interpret ----------

const rovna = S.pripravLevel({
  id: 'test-rovna', mapa: ['..........', '.P#######V', '..........'],
  privod: { druh: 'propojka', pocet: [3, 3] },
});

test('opakuj 3× vykoná tělo třikrát', () => {
  const s = S.novyStav(rovna, S.zadani(rovna, 0)), m = S.stroj(prg([['opakuj', 3, ['krok']]]));
  while (!s.konec) S.takt(rovna, s, m);
  assert.strictEqual(s.x, 4);
  assert.strictEqual(s.takt, 3);
});

test('vnořené opakování 2× 3×', () => {
  const s = S.novyStav(rovna, S.zadani(rovna, 0)), m = S.stroj(prg([['opakuj', 2, [['opakuj', 3, ['krok']], 'vlevo', 'vlevo', 'vlevo', 'vlevo']]]));
  while (!s.konec) S.takt(rovna, s, m);
  assert.strictEqual(s.x, 7);
});

test('opakuj stále končí prázdným přívodem a nepočítá poslední zvednutí', () => {
  const p = prg([['stale', ['zvedni', ...Array(8).fill('krok'), 'poloz', 'vlevo', 'vlevo', ...Array(8).fill('krok'), 'vlevo', 'vlevo']]]);
  const v = S.spustTest(rovna, p, 0);
  assert.ok(v.uspech, v.zprava);
  assert.strictEqual(v.duvod, 'konecSmeny');
  assert.strictEqual(v.takty, 3 * 22);
});

test('prázdná nekonečná smyčka uspí panáčka', () => {
  const v = S.spustTest(rovna, prg([['stale', []]]), 0);
  assert.strictEqual(v.duvod, 'usnul');
});

test('po 999 taktech usne', () => {
  const v = S.spustTest(rovna, prg([['stale', ['vlevo']]]), 0);
  assert.strictEqual(v.duvod, 'usnul');
  assert.strictEqual(v.takty, 999);
});

test('skok přes mezeru a pád do mezery', () => {
  const l = S.pripravLevel({ id: 't', mapa: ['P#.#V'], privod: { pocet: [1, 1] } });
  assert.ok(S.spustTest(l, prg(['zvedni', 'krok', 'skoc', 'krok', 'poloz']), 0).uspech);
  assert.strictEqual(S.spustTest(l, prg(['zvedni', 'krok', 'krok']), 0).duvod, 'pad');
  assert.strictEqual(S.spustTest(l, prg(['zvedni', 'skoc', 'krok']), 0).duvod, 'pad');
});

test('náraz do překážky panáčka zastaví, ale směna běží dál', () => {
  const l = S.pripravLevel({ id: 't', mapa: ['P#XV'], privod: { pocet: [1, 1] } });
  const s = S.novyStav(l, S.zadani(l, 0)), m = S.stroj(prg(['krok', 'krok', 'krok']));
  const ev = [];
  while (!s.konec) ev.push(S.takt(l, s, m));
  assert.deepStrictEqual(ev.map(e => e.typ), ['krok', 'naraz', 'naraz', 'konec']);
  assert.strictEqual(s.x, 1);
});

test('položení na obsazené místo rozsype', () => {
  const l = S.pripravLevel({ id: 't', mapa: ['P#V'], privod: { pocet: [2, 2] } });
  const v = S.spustTest(l, prg(['zvedni', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'zvedni', 'vlevo', 'vlevo', 'krok', 'poloz']), 0);
  assert.ok(!v.uspech);
  assert.match(v.zprava, /Rozsypal/);
});

test('zadání ze semínka jsou opakovatelná a liší se', () => {
  const l = S.pripravLevel({ id: 'nahodny', mapa: ['PV'], privod: { druh: ['odpor', 'led'], pocet: [3, 8] } });
  assert.deepStrictEqual(S.zadani(l, 2), S.zadani(l, 2));
  const pocty = new Set([0, 1, 2, 3, 4, 5].map(i => S.zadani(l, i).privod.length));
  assert.ok(pocty.size > 1);
});

test('bludiště: každé zadání jiné, opakovatelné, výstup dosažitelný', () => {
  const def = LEVELY.find(l => l.bludiste), l = S.pripravLevel(def);
  const mapy = [0, 1, 2, 3, 4].map(i => S.instance(l, i).mapa.join('|'));
  assert.ok(new Set(mapy).size >= 4);
  assert.deepStrictEqual(S.instance(l, 2).mapa, S.instance(S.pripravLevel(def), 2).mapa);
});

test('podmínky čtou desku vzhledem k natočení panáčka', () => {
  const l = S.pripravLevel({ id: 't', mapa: ['.#.', '#P.', '...'], privod: { pocet: [1, 1] }, start: { smer: 'vychod' } });
  const s = S.novyStav(l, S.zadani(l, 0));
  assert.strictEqual(S.plati(l, s, 'cesta:vpred'), false);
  assert.strictEqual(S.plati(l, s, 'cesta:vlevo'), true);
  assert.strictEqual(S.plati(l, s, 'cesta:vpravo'), false);
  s.smer = 2;
  assert.strictEqual(S.plati(l, s, 'cesta:vpravo'), true);
});

test('dva panáčci: čekání bez hvízdnutí skončí vyhodnocením, ne nekonečnou smyčkou', () => {
  const l = S.pripravLevel({ id: 't2', mapa: ['P#V'], panacci: [{ x: 0, y: 0 }, { x: 2, y: 0, smer: 'zapad' }], privod: { pocet: [1, 1] } });
  const v = S.spustTest(l, [prg([['stale', ['cekej']]]), prg([['stale', ['cekej']]])], 0);
  assert.strictEqual(v.duvod, 'konec');
  assert.ok(v.takty < 5);
});

test('dva panáčci: krok na políčko druhého je náraz', () => {
  const l = S.pripravLevel({ id: 't3', mapa: ['P##V'], panacci: [{ x: 0, y: 0 }, { x: 1, y: 0, smer: 'zapad' }], privod: { pocet: [1, 1] } });
  const s = S.novyStav(l, S.zadani(l, 0)), m = [S.stroj(prg(['krok'])), S.stroj(prg([]))];
  const ev = S.takt(l, s, m);
  assert.strictEqual(ev.udalosti[0].typ, 'naraz');
  assert.strictEqual(s.ag[0].x, 0);
});

test('pískoviště: nic se nehodnotí, program doběhne', () => {
  const l = S.pripravLevel(LEVELY.find(x => x.kontrola === 'piskoviste'));
  const v = S.spustTest(l, prg(['zvedni', 'krok', 'krok', 'poloz']), 0);
  assert.ok(!v.uspech);
  assert.match(v.zprava, /nehodnotí/);
});

test('opakuj, když: podmínka se ověří před každým průchodem', () => {
  const l = S.pripravLevel({ id: 'tk', mapa: ['P####.'], privod: { pocet: [1, 1] }, start: { smer: 'vychod' } });
  const s = S.novyStav(l, S.zadani(l, 0)), m = S.stroj(prg([['opakujKdyz', 'cesta:vpred', ['krok']], 'vlevo']));
  while (!s.konec) S.takt(l, s, m);
  assert.strictEqual(s.x, 4);                       // došel na konec cestičky a nespadl
  assert.strictEqual(s.takt, 5);
  const v = S.spustTest(l, prg([['opakujKdyz', 'cesta:vlevo', ['krok']]]), 0);   // neplatí hned: tělo se nevykoná
  assert.strictEqual(v.takty, 0);
  assert.strictEqual(S.spustTest(l, prg([['opakujKdyz', 'cesta:vpred', []]]), 0).duvod, 'usnul');
});
