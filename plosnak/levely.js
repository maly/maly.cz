/*
 * Plošňák: levely jako data. Formát popisuje hlavička sim.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlosnakLevely = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: '1.1',
      kapitola: 1,
      kapitolaNazev: 'Ruce',
      nazev: 'První krok',
      zadani: 'Přívod vydá jednu propojku. Přenes ji na výstup.',
      napoveda: 'Bloky přidáš klepnutím nebo přetažením do programu. Pak dej Spusť a sleduj panáčka.',
      mapa: [
        '......',
        '.P##V.',
        '......',
      ],
      start: { smer: 'vychod' },
      privod: { strana: 'sever', druh: 'propojka', pocet: [1, 1] },
      vystup: { strana: 'sever' },
      bloky: ['krok', 'zvedni', 'poloz'],
      cile: { bloky: 5, kroky: 5 },
      testy: { viditelne: 1, skryte: 0 },
    },
    {
      id: '1.2',
      kapitola: 1,
      kapitolaNazev: 'Ruce',
      nazev: 'Zatáčka',
      zadani: 'Cestička se jednou lomí. Přenes propojku na výstup.',
      napoveda: 'Otáčení je vždy vzhledem k panáčkovi, ne k obrazovce. Kam míří kšilt, tam je vpředu.',
      mapa: [
        '......',
        '.P##..',
        '...#..',
        '...V..',
        '......',
      ],
      start: { smer: 'vychod' },
      privod: { strana: 'sever', druh: 'propojka', pocet: [1, 1] },
      vystup: { strana: 'vychod' },
      bloky: ['krok', 'vlevo', 'vpravo', 'zvedni', 'poloz'],
      cile: { bloky: 7, kroky: 7 },
      testy: { viditelne: 1, skryte: 0 },
    },
    {
      id: '1.3',
      kapitola: 1,
      kapitolaNazev: 'Ruce',
      nazev: 'Tři kusy',
      zadani: 'Přívod vydá tři propojky. Všechny musí na výstup.',
      napoveda: 'Panáček unese jen jednu věc. Na cíl pro počet bloků zatím nestačí, co umí.',
      mapa: [
        '.......',
        '.P#V...',
        '.......',
      ],
      start: { smer: 'vychod' },
      privod: { strana: 'sever', druh: 'propojka', pocet: [3, 3] },
      vystup: { strana: 'sever' },
      bloky: ['krok', 'vlevo', 'vpravo', 'zvedni', 'poloz'],
      cile: { bloky: 11, kroky: 24 },
      testy: { viditelne: 1, skryte: 0 },
    },
    {
      id: '1.4',
      kapitola: 1,
      kapitolaNazev: 'Ruce',
      nazev: 'Mezera',
      zadani: 'Cestička je přerušená. Přenes propojku na druhou stranu.',
      napoveda: 'Skok přeletí právě jedno políčko. Kdo skočí o krok dřív, spadne.',
      mapa: [
        '.......',
        'P##.##V',
        '.......',
      ],
      start: { smer: 'vychod' },
      privod: { strana: 'sever', druh: 'propojka', pocet: [1, 1] },
      vystup: { strana: 'sever' },
      bloky: ['krok', 'vlevo', 'vpravo', 'skoc', 'zvedni', 'poloz'],
      cile: { bloky: 5, kroky: 5 },
      testy: { viditelne: 1, skryte: 0 },
    },
  ];
});
