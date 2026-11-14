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
  ];
});
