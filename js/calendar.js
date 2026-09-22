// Regras do calendário (PLANO.md, seções 6 e 8).
// Módulo puro: não toca no DOM nem no armazenamento, então roda no navegador e no Node (testes).
// Convenções: `mes` vai de 1 a 12; dia da semana vai de 0 (domingo) a 6 (sábado).

export const PALETA = {
  azul:    { nome: 'Azul',         fundo: '#2B55B5', texto: '#FFFFFF' },
  amarelo: { nome: 'Amarelo',      fundo: '#F2B705', texto: '#3A2C00' },
  laranja: { nome: 'Laranja',      fundo: '#EE7433', texto: '#FFFFFF' },
  rosa:    { nome: 'Rosa',         fundo: '#E0457B', texto: '#FFFFFF' },
  marinho: { nome: 'Azul-marinho', fundo: '#1B2F66', texto: '#FFFFFF' },
  celeste: { nome: 'Azul-claro',   fundo: '#8FB8E8', texto: '#12305F' },
  verde:    { nome: 'Verde',       fundo: '#2E8B57', texto: '#FFFFFF' },
  roxo:     { nome: 'Roxo',        fundo: '#7B4FC9', texto: '#FFFFFF' },
  vermelho: { nome: 'Vermelho',    fundo: '#C62828', texto: '#FFFFFF' },
  marrom:   { nome: 'Marrom',      fundo: '#8A5A3B', texto: '#FFFFFF' },
  lilas:    { nome: 'Lilás',       fundo: '#B9A2E8', texto: '#2D1B5C' },
};

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DIAS_SEMANA_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Cor da paleta pelo id. Id desconhecido cai no azul para nunca quebrar a imagem. */
export function corDe(id) {
  return PALETA[id] ?? PALETA.azul;
}

export function diasNoMes(ano, mes) {
  // Dia 0 do mês seguinte = último dia deste mês.
  return new Date(ano, mes, 0).getDate();
}

export function diaDaSemana(ano, mes, dia) {
  return new Date(ano, mes - 1, dia).getDay();
}

/** Avança ou volta `delta` meses. Ex.: somarMes(2026, 12, 1) → { ano: 2027, mes: 1 }. */
export function somarMes(ano, mes, delta) {
  const d = new Date(ano, mes - 1 + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/**
 * Grade do mês em semanas de 7 posições, começando no domingo.
 * Posições fora do mês são `null` (a primeira e a última semana são completadas).
 */
export function gerarGrade(ano, mes) {
  const total = diasNoMes(ano, mes);
  const vazios = diaDaSemana(ano, mes, 1);
  const celulas = Array(vazios).fill(null);
  for (let dia = 1; dia <= total; dia++) celulas.push(dia);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export function duracao(evento) {
  return evento.fim - evento.inicio + 1;
}

export function temNome(evento) {
  return (evento.nome ?? '').trim() !== '';
}

/**
 * Evento que dá a cor ao dia, ou `null` se nenhum cobre o dia.
 * O de menor duração vence; no empate, o último adicionado (último no array) vence.
 */
export function eventoDoDia(eventos, dia) {
  let vencedor = null;
  for (const ev of eventos) {
    if (dia < ev.inicio || dia > ev.fim) continue;
    if (vencedor === null || duracao(ev) <= duracao(vencedor)) vencedor = ev;
  }
  return vencedor;
}

/**
 * Tudo o que a imagem precisa para desenhar a grade.
 * Cada célula é `null` (fora do mês) ou { dia, domingo, evento, cor }.
 * `cor` é { fundo, texto } quando há evento, senão `null`.
 */
export function montarCalendario({ ano, mes, eventos = [] }) {
  const semanas = gerarGrade(ano, mes).map((semana) =>
    semana.map((dia, coluna) => {
      if (dia === null) return null;
      const evento = eventoDoDia(eventos, dia);
      return {
        dia,
        domingo: coluna === 0,
        evento,
        cor: evento ? { fundo: corDe(evento.cor).fundo, texto: corDe(evento.cor).texto } : null,
      };
    }),
  );
  return { ano, mes, nomeMes: NOMES_MESES[mes - 1], semanas };
}

/** "1" ou "14 a 16". */
export function rotuloData(evento) {
  return evento.inicio === evento.fim ? `${evento.inicio}` : `${evento.inicio} a ${evento.fim}`;
}

/** "Sábado" ou "Sexta a Domingo". */
export function rotuloDiaSemana(ano, mes, evento) {
  const inicio = DIAS_SEMANA[diaDaSemana(ano, mes, evento.inicio)];
  if (evento.inicio === evento.fim) return inicio;
  return `${inicio} a ${DIAS_SEMANA[diaDaSemana(ano, mes, evento.fim)]}`;
}

/**
 * Linhas da lista de eventos: só eventos com nome, ordenados por início, depois fim,
 * depois ordem de criação (posição no array). Lista vazia = esconder o card.
 */
export function montarLista({ ano, mes, eventos = [] }) {
  return eventos
    .map((evento, ordem) => ({ evento, ordem }))
    .filter(({ evento }) => temNome(evento))
    .sort((a, b) =>
      a.evento.inicio - b.evento.inicio ||
      a.evento.fim - b.evento.fim ||
      a.ordem - b.ordem,
    )
    .map(({ evento }) => ({
      evento,
      data: rotuloData(evento),
      diaSemana: rotuloDiaSemana(ano, mes, evento),
      nome: evento.nome.trim(),
      obs: (evento.obs ?? '').trim(),
      cor: corDe(evento.cor),
    }));
}

/** Problemas do evento naquele mês, em texto para mostrar ao usuário. Vazio = válido. */
export function validarEvento(evento, ano, mes) {
  const erros = [];
  const total = diasNoMes(ano, mes);
  const { inicio, fim } = evento;

  if (!Number.isInteger(inicio) || inicio < 1 || inicio > total) {
    erros.push(`O dia inicial precisa estar entre 1 e ${total}.`);
  }
  if (!Number.isInteger(fim) || fim < 1 || fim > total) {
    erros.push(`O dia final precisa estar entre 1 e ${total}.`);
  }
  if (Number.isInteger(inicio) && Number.isInteger(fim) && fim < inicio) {
    erros.push('O dia final não pode ser antes do dia inicial.');
  }
  if (!(evento.cor in PALETA)) {
    erros.push('Escolha uma cor.');
  }
  return erros;
}

/** Eventos que não cabem no mês (ex.: dia 31 levado para setembro). Serve para avisar ao trocar de mês. */
export function eventosInvalidos({ ano, mes, eventos = [] }) {
  return eventos.filter((ev) => validarEvento(ev, ano, mes).length > 0);
}

// ---------- Documento do mês (formato salvo) ----------

export const LIMITES = { eventos: 60, nome: 80, obs: 120 };

/** "2026-08": id do documento no banco e sufixo da chave local. */
export function idDoMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function novoId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function texto(valor, limite) {
  return typeof valor === 'string' ? valor.slice(0, limite) : '';
}

/**
 * Deixa o documento só com os campos conhecidos e tipos certos (dados vindos do banco ou de um backup).
 * Dias fora do mês são mantidos para o editor avisar e o usuário corrigir.
 * Lança erro se não der para saber o mês.
 */
export function limparDocumento(dados, anoPadrao, mesPadrao) {
  const ano = Number.isInteger(dados?.ano) ? dados.ano : anoPadrao;
  const mes = Number.isInteger(dados?.mes) ? dados.mes : mesPadrao;
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error('Documento sem ano ou mês válido.');
  }

  const vistos = new Set();
  const eventos = (Array.isArray(dados?.eventos) ? dados.eventos : [])
    .filter((ev) => ev && Number.isInteger(ev.inicio) && Number.isInteger(ev.fim))
    .slice(0, LIMITES.eventos)
    .map((ev) => {
      let id = texto(ev.id, 40);
      if (!id || vistos.has(id)) id = novoId();
      vistos.add(id);
      return {
        id,
        nome: texto(ev.nome, LIMITES.nome),
        inicio: ev.inicio,
        fim: ev.fim,
        cor: ev.cor in PALETA ? ev.cor : 'azul',
        obs: texto(ev.obs, LIMITES.obs),
      };
    });

  return { ano, mes, eventos };
}
