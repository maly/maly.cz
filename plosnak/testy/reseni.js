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
};
