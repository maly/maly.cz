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
};
