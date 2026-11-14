// Složí hru do jednoho HTML souboru (náhled pro claude.ai, kde CSP nedovolí načíst další soubory).
// Použití: node plosnak/nahled.js cesta/k/vystupu.html
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, 'nahled.html');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) =>
  '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
html = html.replace(/\s*<link rel="icon"[^>]*>/, '');
fs.writeFileSync(out, html);
console.log(out, html.length, 'B');
