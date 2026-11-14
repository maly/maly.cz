// Spuštění: node --test plosnak/testy/
const test = require('node:test');
const assert = require('node:assert');
const S = require('../sim.js');
const LEVELY = require('../levely.js');
const RESENI = require('./reseni.js');

let id = 0;
// Zápis programu: ['krok', 'zvedni', ['opakuj', 3, [...]], ['stale', [...]]]
function prg(zapis) {
  return zapis.map(z => {
    if (typeof z === 'string') return { id: 'u' + ++id, op: z };
    if (z[0] === 'opakuj') return { id: 'u' + ++id, op: 'opakuj', n: z[1], telo: prg(z[2]) };
    return { id: 'u' + ++id, op: z[0], telo: prg(z[1]) };
  });
}

for (const def of LEVELY) {
  const level = S.pripravLevel(def);
  const r = RESENI[def.id];
  test(`level ${def.id}: má referenční řešení a chybná řešení`, () => {
    assert.ok(r, 'chybí záznam v reseni.js');
    assert.ok(r.chybna.length >= 3, 'aspoň tři chybná řešení');
  });
  test(`level ${def.id}: referenční řešení projde a splní cíle`, () => {
    const v = S.vyhodnotReseni(level, prg(r.reference));
    assert.ok(v.vsechny, JSON.stringify(v.vysledky));
    assert.ok(v.bloky <= def.cile.bloky, `bloky ${v.bloky} > ${def.cile.bloky}`);
    assert.ok(v.kroky <= def.cile.kroky, `kroky ${v.kroky} > ${def.cile.kroky}`);
  });
  for (const [i, ch] of r.chybna.entries()) {
    test(`level ${def.id}: chybné řešení ${i + 1} neprojde (${ch.duvod})`, () => {
      const v = S.vyhodnotReseni(level, prg(ch.program));
      assert.ok(!v.vsechny);
      const spatne = v.vysledky.find(x => !x.uspech);
      if (ch.duvod) assert.strictEqual(spatne.duvod, ch.duvod);
      if (ch.zprava) assert.match(spatne.zprava, ch.zprava);
    });
  }
  test(`level ${def.id}: palety obsahují jen známé bloky`, () => {
    for (const b of def.bloky) assert.ok(S.BLOKY[b], b);
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
