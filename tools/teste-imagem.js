import { renderizarImagem } from '../js/render.js';
import { gerarPng } from '../js/export.js';

const params = new URLSearchParams(location.search);
const doc = await fetch(params.get('json') ?? '/tests/exemplos/agosto-2026.json').then((r) => r.json());
const no = renderizarImagem(doc);
document.body.append(no);

if (params.get('modo') !== 'dom') {
  const blob = await gerarPng(no);
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  no.remove();
  document.body.append(img);
  document.title = `pronto ${img.naturalWidth}x${img.naturalHeight}`;
}
