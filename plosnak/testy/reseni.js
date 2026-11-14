// Referenční a chybná řešení levelů. Zápis viz prg() v sim.test.js.
module.exports = {
  '1.1': {
    reference: ['zvedni', 'krok', 'krok', 'krok', 'poloz'],
    chybna: [
      { program: [], duvod: 'konec', zprava: /V přívodu zůstala/ },
      { program: ['krok', 'krok', 'krok', 'poloz'], duvod: 'konec', zprava: /V přívodu zůstala/ },
      { program: ['zvedni', 'krok', 'krok', 'poloz'], duvod: 'konec', zprava: /válí/ },
      { program: ['zvedni', 'krok', 'krok', 'krok', 'krok', 'poloz'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'krok'], duvod: 'konec', zprava: /drží propojku/ },
    ],
  },
  '1.2': {
    reference: ['zvedni', 'krok', 'krok', 'vpravo', 'krok', 'krok', 'poloz'],
    chybna: [
      { program: ['zvedni', 'krok', 'krok', 'vlevo', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'vpravo', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'vpravo', 'krok', 'poloz'], duvod: 'konec', zprava: /válí/ },
    ],
  },
  '1.3': {
    reference: [
      'zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo',
      'zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo',
      'zvedni', 'krok', 'krok', 'poloz',
    ],
    // Cíl na bloky (11) jde splnit až s opakováním v kapitole 2: opakuj 3× [10 bloků].
    alternativy: [[['opakuj', 3, ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]]],
    chybna: [
      { program: ['zvedni', 'krok', 'krok', 'poloz'], duvod: 'konec', zprava: /zůstaly 2 součástky/ },
      { program: ['zvedni', 'krok', 'krok', 'poloz', 'krok', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'zvedni', 'krok', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo', 'zvedni', 'krok', 'poloz'], duvod: 'konec', zprava: /válí/ },
    ],
  },
  '1.4': {
    // Skok funguje i přes cestičku, takže nejkratší řešení přeskáče celou desku.
    reference: ['zvedni', 'skoc', 'skoc', 'skoc', 'poloz'],
    alternativy: [['zvedni', 'krok', 'krok', 'skoc', 'krok', 'krok', 'poloz']],
    chybna: [
      { program: ['zvedni', 'krok', 'krok', 'krok'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'skoc'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'skoc', 'skoc', 'skoc'], duvod: 'pad' },
      { program: ['zvedni', 'krok', 'krok', 'skoc', 'krok', 'poloz'], duvod: 'konec', zprava: /válí/ },
    ],
  },
  '2.1': {
    reference: [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
    chybna: [
      { program: [['opakuj', 3, ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /V přívodu zůstal/ },
      { program: [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok']]], duvod: 'pad' },
      { program: [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'krok']]], duvod: 'pad' },
      { program: [['stale', ['vpravo', 'vpravo']]], duvod: 'usnul' },
    ],
  },
  '2.2': {
    reference: [['stale', [
      'zvedni', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz',
      'vlevo', ['opakuj', 3, ['krok', 'vlevo', 'krok', 'vpravo']], 'vpravo',
    ]]],
    chybna: [
      { program: ['zvedni', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz'], zprava: /V přívodu zůstal/ },
      { program: [['stale', ['zvedni', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz', 'vpravo', 'vpravo', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']]]]], duvod: 'pad' },
      { program: [['stale', ['zvedni', ['opakuj', 3, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz', 'vlevo', ['opakuj', 3, ['krok', 'vlevo', 'krok', 'vpravo']]]]], duvod: 'pad' },
      { program: [['stale', ['zvedni', ['opakuj', 2, ['krok', 'vpravo', 'krok', 'vlevo']], 'poloz']]], duvod: 'pad' },
    ],
  },
  '2.3': {
    reference: [['stale', ['zvedni', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'krok']]],
    alternativy: [[['opakuj', 6, ['zvedni', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'krok']]]],
    chybna: [
      { program: [['opakuj', 3, ['zvedni', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'krok']]], zprava: /Na pásce zůstal/ },
      // po pásu patic se dá jít taky, ale za šestou patici už cestička nevede
      { program: [['stale', ['zvedni', 'vpravo', 'krok', 'poloz', 'vlevo', 'krok', 'vlevo', 'krok', 'vpravo']]], duvod: 'pad' },
      { program: [['stale', ['zvedni', 'krok', 'poloz']]], zprava: /Rozsypal/ },
      { program: [['stale', ['zvedni', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'krok', 'krok']]], zprava: /Patice se mají osazovat popořadě|Na pásce/ },
    ],
  },
  '2.4': {
    reference: [['opakuj', 4, ['krok', 'krok', 'zvedni', 'vpravo', 'vpravo', 'krok', 'krok', 'poloz', 'vpravo']]],
    chybna: [
      { program: [['opakuj', 4, ['krok', 'krok', 'zvedni', 'vpravo', 'vpravo', 'krok', 'krok', 'poloz']]], zprava: /válí/ },
      { program: [['opakuj', 4, ['krok', 'krok', 'krok', 'zvedni']]], duvod: 'pad' },
      { program: [['opakuj', 4, ['krok', 'krok', 'zvedni', 'vpravo', 'vpravo', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo']]], zprava: /válí/ },
      { program: [['stale', ['krok', 'krok', 'zvedni', 'vpravo', 'vpravo', 'krok', 'krok', 'poloz', 'vpravo']]], duvod: 'usnul' },
    ],
  },
};
