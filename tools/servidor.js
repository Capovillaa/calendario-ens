// Servidor local para testar: serve os arquivos e aplica os mesmos cabeçalhos do vercel.json
// (inclusive a Content-Security-Policy), para os problemas aparecerem aqui e não em produção.
// Uso: node tools/servidor.js  →  http://localhost:5173
//      node tools/servidor.js --local  →  http://localhost:5174, ignora o Firebase e roda em modo local (dados só no navegador)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const MODO_LOCAL = process.argv.includes('--local');
const PORTA = Number(process.env.PORT) || (MODO_LOCAL ? 5174 : 5173);
const CONFIG_VAZIA = "export const firebaseConfig = { apiKey: '', authDomain: '', projectId: '', appId: '' };\n";

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const vercel = JSON.parse(await readFile(join(RAIZ, 'vercel.json'), 'utf8'));

function cabecalhos(caminho) {
  const saida = {};
  for (const regra of vercel.headers) {
    const re = new RegExp('^' + regra.source.replace(/\(\.\*\)/g, '.*') + '$');
    if (re.test(caminho)) for (const h of regra.headers) saida[h.key] = h.value;
  }
  delete saida['Strict-Transport-Security']; // não faz sentido em http://localhost
  return saida;
}

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let arquivo = normalize(join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ.replace(/[\\/]$/, '') + sep) && arquivo !== RAIZ) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, 'index.html');
    const corpo = MODO_LOCAL && caminho === '/js/firebase-config.js' ? CONFIG_VAZIA : await readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...cabecalhos(caminho),
    });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(PORTA, () => console.log(`Calendário ENS em http://localhost:${PORTA}${MODO_LOCAL ? ' (modo local)' : ''}`));
