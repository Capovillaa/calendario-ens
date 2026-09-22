// Monta o DOM da imagem (layout do protótipo E) a partir do documento do mês.
// Só usa textContent/propriedades de estilo: nada do usuário vira HTML.

import { DIAS_SEMANA_CURTOS, montarCalendario, montarLista, eventosInvalidos } from './calendar.js';

const URL_LOGO = new URL('../assets/logo-ens.png', import.meta.url).href;

function el(tag, classe, texto) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/** Documento só com os eventos que cabem no mês (os inválidos são avisados no editor). */
export function documentoValido(doc) {
  const invalidos = new Set(eventosInvalidos(doc));
  return { ...doc, eventos: doc.eventos.filter((ev) => !invalidos.has(ev)) };
}

/** Retorna um nó `.ens-img` de 1080 px de largura. */
export function renderizarImagem(docOriginal) {
  const doc = documentoValido(docOriginal);
  const cal = montarCalendario(doc);
  const lista = montarLista(doc);

  const raiz = el('div', 'ens-img');

  // Faixa azul
  const band = el('div', 'band');
  const logo = el('div', 'logo');
  const img = el('img');
  img.src = URL_LOGO;
  img.alt = 'Equipes de Nossa Senhora';
  logo.append(img);
  const titulo = el('div', 'm', `${cal.nomeMes} `);
  titulo.append(el('span', null, String(cal.ano)));
  band.append(logo, titulo);
  raiz.append(band);

  // Card do calendário
  const wrap = el('div', 'wrap');
  const card = el('div', 'card');
  const cabecalho = el('div', 'mwd');
  for (const d of DIAS_SEMANA_CURTOS) cabecalho.append(el('div', null, d));
  const grade = el('div', 'mg');
  for (const c of cal.semanas.flat()) {
    if (c === null) { grade.append(el('div')); continue; }
    const dia = el('div', 'md', String(c.dia));
    if (c.cor) {
      dia.classList.add('on');
      dia.style.background = c.cor.fundo;
      dia.style.color = c.cor.texto;
    } else if (c.domingo) {
      dia.classList.add('sun');
    }
    grade.append(dia);
  }
  card.append(cabecalho, grade);
  wrap.append(card);

  // Lista (escondida quando não há eventos com nome)
  if (lista.length > 0) {
    const cardLista = el('div', 'list');
    for (const item of lista) {
      const row = el('div', 'row');
      const bar = el('div', 'bar');
      bar.style.background = item.cor.fundo;
      const data = el('div', 'date');
      data.append(el('div', 'dn', item.data), el('div', 'dw', item.diaSemana));
      const info = el('div', 'info');
      info.append(el('div', 'en', item.nome));
      if (item.obs) info.append(el('div', 'sub', item.obs));
      row.append(bar, data, info);
      cardLista.append(row);
    }
    wrap.append(cardLista);
  }

  raiz.append(wrap);
  return raiz;
}
