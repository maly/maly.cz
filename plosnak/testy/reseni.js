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
  '3.1': {
    reference: [['stale', ['zvedni', ['kdyz', 'druh:odpor',
      ['vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo'],
      ['vpravo', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'vpravo']]]]],
    chybna: [
      { program: [['stale', ['zvedni', 'vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo']]], zprava: /Na výstup A patří jen odpory, ale skončila tam LED/ },
      { program: [['stale', ['zvedni', ['kdyz', 'druh:led',
        ['vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo'],
        ['vpravo', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'vpravo']]]]], zprava: /patří jen/ },
      { program: [['stale', ['zvedni', ['kdyz', 'druh:odpor',
        ['vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok'],
        ['vpravo', 'krok', 'poloz', 'vlevo', 'vlevo', 'krok', 'vpravo']]]]], duvod: 'pad' },
      { program: [['stale', ['zvedni', ['kdyz', 'druh:odpor', ['vlevo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vlevo'], []]]]], duvod: 'usnul' },
    ],
  },
  '3.2': {
    reference: [['stale', ['zvedni', 'krok', ['kdyz', 'druh:spaleny', ['krok'], []], 'poloz',
      'vpravo', 'vpravo', 'krok', ['kdyz', 'cesta:vpred', ['krok'], []], 'vpravo', 'vpravo']]],
    alternativy: [[['stale', ['zvedni', ['kdyz', 'druh:spaleny',
      ['krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo'],
      ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]]]]],
    chybna: [
      { program: [['stale', ['zvedni', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /Na výstup patří jen propojky/ },
      { program: [['stale', ['zvedni', 'krok', ['kdyz', 'druh:spaleny', ['krok'], []], 'poloz',
        'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], duvod: 'pad' },
      { program: [['stale', ['zvedni', 'krok', ['kdyz', 'druh:spaleny', ['krok'], []], 'poloz',
        'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], duvod: 'usnul' },
      { program: [['stale', ['zvedni', 'krok', ['kdyz', 'druh:propojka', ['krok'], []], 'poloz',
        'vpravo', 'vpravo', 'krok', ['kdyz', 'cesta:vpred', ['krok'], []], 'vpravo', 'vpravo']]], zprava: /patří jen/ },
    ],
  },
  '3.3': {
    // pravá ruka na stěně
    reference: [['stale', [['kdyz', 'cesta:vpravo', ['vpravo', 'krok'], [['kdyz', 'cesta:vpred', ['krok'], ['vlevo']]]]]]],
    alternativy: [
      // levá ruka na stěně
      [['stale', [['kdyz', 'cesta:vlevo', ['vlevo', 'krok'], [['kdyz', 'cesta:vpred', ['krok'], ['vpravo']]]]]]],
    ],
    chybna: [
      { program: [['stale', [['kdyz', 'cesta:vpred', ['krok'], ['vpravo']]]]], duvod: 'usnul' },
      { program: [['opakuj', 6, ['krok']]], duvod: 'pad' },
      { program: [['stale', [['kdyz', 'cesta:vpravo', ['vpravo'], []], 'krok']]], duvod: 'pad' },
      { program: [['stale', [['kdyz', 'cesta:vpravo', ['vpravo', 'krok'], ['krok']]]]], duvod: 'pad' },
    ],
  },
  '3.4': {
    reference: [['stale', ['zvedni', 'krok', ['kdyz', 'pruh:hneda', ['poloz'], []], 'krok', ['kdyz', 'pruh:cervena', ['poloz'], []],
      'krok', 'poloz', 'vpravo', 'vpravo', ['opakuj', 3, ['krok']], 'vpravo', 'vpravo']]],
    alternativy: [[['stale', ['zvedni',
      ['kdyz', 'pruh:hneda', ['krok'], [['kdyz', 'pruh:cervena', ['krok', 'krok'], ['krok', 'krok', 'krok']]]],
      'poloz', 'vpravo', 'vpravo', ['opakuj', 3, [['kdyz', 'cesta:vpred', ['krok'], []]]], 'vpravo', 'vpravo']]]],
    chybna: [
      { program: [['stale', ['zvedni', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /patří jen odpory s hnědým/ },
      { program: [['stale', ['zvedni', 'krok', ['kdyz', 'pruh:hneda', ['poloz'], []], 'krok', ['kdyz', 'pruh:cervena', ['poloz'], []],
        'krok', 'poloz', 'vpravo', 'vpravo', ['opakuj', 4, ['krok']], 'vpravo', 'vpravo']]], duvod: 'pad' },
      { program: [['stale', ['zvedni', 'krok', ['kdyz', 'pruh:cervena', ['poloz'], []], 'krok', ['kdyz', 'pruh:hneda', ['poloz'], []],
        'krok', 'poloz', 'vpravo', 'vpravo', ['opakuj', 3, ['krok']], 'vpravo', 'vpravo']]], zprava: /patří jen/ },
      { program: [['stale', ['zvedni',
        ['kdyz', 'pruh:hneda', ['krok'], [['kdyz', 'pruh:cervena', ['krok', 'krok'], ['krok', 'krok', 'krok']]]],
        'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], duvod: 'pad' },
    ],
  },
  '4.1': {
    reference: [['stale', ['zvedni', 'uloz', 'zvedni', 'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
    alternativy: [[['stale', ['zvedni', 'prohod', 'zvedni', 'krok', 'krok', 'poloz', 'prohod', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]]],
    chybna: [
      { program: [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
      { program: [['stale', ['zvedni', 'uloz', 'zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /kapse|místě|chybí/ },
      { program: [['stale', ['zvedni', 'uloz', 'zvedni', 'krok', 'krok', 'poloz', 'vyndej', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /plné ruce|drží|Rozsypal|místě|chybí|kapse/ },
      { program: [['stale', ['zvedni', 'uloz', 'zvedni', 'krok', 'krok', 'vyndej', 'poloz', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /místě|chybí|drží|kapse/ },
    ],
  },
  '4.2': {
    // Polož s prázdnou rukou nic nezkazí, proto se první kus (prázdná kapsa) obejde bez dalšího když.
    reference: [['stale', ['zvedni', ['kdyz', 'kapsa:stejna',
      ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo'],
      ['prohod', 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']]]]],
    alternativy: [[['stale', ['zvedni', ['kdyz', 'kapsa:stejna',
      ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo'],
      ['prohod', ['kdyz', 'drzim', ['vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok'], []]]]]]]],
    chybna: [
      { program: [['stale', ['zvedni', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /na 1\. místě|víc/ },
      { program: [['stale', ['zvedni', ['kdyz', 'kapsa:stejna',
        ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo'],
        ['vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']]]]], zprava: /chybí|místě/ },
      // větve naopak: dvojčata do koše, ostatní na výstup
      { program: [['stale', ['zvedni', ['kdyz', 'kapsa:stejna',
        ['prohod', 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok'],
        ['prohod', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]]]], zprava: /místě|chybí|víc|Nedoručen/ },
      { program: [['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'kapsa:stejna', ['krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo'], []]]]], duvod: 'usnul' },
    ],
  },
  '4.3': {
    reference: [['stale', ['zvedni', 'uloz',
      ['opakuj', 2, ['zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']],
      'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]],
    alternativy: [[['stale', ['zvedni', 'uloz',
      'zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok',
      'zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok',
      'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]]],
    chybna: [
      { program: [['stale', ['zvedni', 'uloz',
        ['opakuj', 2, ['zvedni', ['kdyz', 'kapsa:mensi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']],
        'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
      { program: [['stale', ['zvedni', 'uloz',
        ['opakuj', 2, ['zvedni', 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']],
        'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
      { program: [['stale', ['zvedni', 'uloz',
        ['opakuj', 3, ['zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []], 'vpravo', 'vpravo', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok']],
        'vyndej', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /místě|kapse|chybí|Nedoručen/ },
      { program: [['stale', ['zvedni', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo']]], zprava: /víc|místě/ },
    ],
  },
  '4.4': {
    reference: [['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'kapsa:vetsi', ['prohod'], []],
      'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]],
    alternativy: [[['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'kapsa:mensi',
      ['krok', 'krok', 'poloz', 'vyndej', 'poloz'],
      ['prohod', 'krok', 'krok', 'poloz', 'vyndej', 'poloz']],
      'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]]],
    chybna: [
      { program: [['stale', ['zvedni', 'uloz', 'zvedni', ['kdyz', 'kapsa:mensi', ['prohod'], []],
        'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
      { program: [['stale', ['zvedni', 'uloz', 'zvedni',
        'krok', 'krok', 'poloz', 'vyndej', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
      { program: [['stale', ['zvedni', 'krok', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo']]], zprava: /místě/ },
    ],
  },
  '5.1': {
    reference: ['zvedni', 'krok', 'poloz', 'pajej', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo', 'zvedni', 'krok', 'krok', 'poloz', 'pajej'],
    chybna: [
      { program: ['zvedni', 'krok', 'poloz', 'vpravo', 'vpravo', 'krok', 'vpravo', 'vpravo', 'zvedni', 'krok', 'krok', 'poloz'], zprava: /není zapájená/ },
      { program: ['zvedni', 'krok', 'krok', 'poloz', 'pajej', 'vpravo', 'vpravo', 'krok', 'krok', 'vpravo', 'vpravo', 'zvedni', 'krok', 'poloz', 'pajej'], zprava: /je v ní/ },
      { program: ['zvedni', 'krok', 'poloz', 'pajej', 'zvedni'], zprava: /přívodu|není osazená/ },
      { program: ['zvedni', 'krok', 'pajej', 'poloz'], zprava: /přívodu/ },
    ],
  },
};
