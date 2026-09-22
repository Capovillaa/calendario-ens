// UI do editor (PLANO.md, seção 9).

import {
  PALETA, NOMES_MESES, DIAS_SEMANA, LIMITES, diasNoMes, diaDaSemana, somarMes, rotuloData, rotuloDiaSemana,
  temNome, validarEvento, eventosInvalidos, limparDocumento, idDoMes, novoId,
} from './calendar.js';
import { renderizarImagem } from './render.js';
import { gerarPng, baixar, compartilhar } from './export.js';
import * as storage from './storage.js';

const $ = (id) => document.getElementById(id);

const estado = {
  usuario: null,
  ano: 0,
  mes: 0,
  doc: null,              // documento do mês aberto; null enquanto carrega
  pararDeObservar: null,
  editandoId: null,       // id do evento aberto no formulário; null = evento novo
  imagem: null,           // { promessa } do PNG da prévia atual
};

const nomeDoMes = (mes) => NOMES_MESES[mes - 1];
const noMeioDaFrase = (mes) => nomeDoMes(mes).toLowerCase(); // "em setembro"

const tituloMes = () => `${nomeDoMes(estado.mes)} ${estado.ano}`;

// ---------- Telas ----------

const TELAS = ['carregando', 'login', 'sem-permissao', 'app'];

function mostrarTela(nome) {
  for (const t of TELAS) $(`tela-${t}`).hidden = t !== nome;
}

let temporizadorToast;
function toast(mensagem, ms = 2200) {
  const t = $('toast');
  t.textContent = mensagem;
  t.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => { t.hidden = true; }, ms);
}

function statusImagem(texto) {
  $('status-imagem').textContent = texto;
}

// ---------- Início e login ----------

async function iniciar() {
  registrarServiceWorker();
  ligarEventos();
  $('aviso-local').hidden = storage.modo !== 'local';
  try {
    await storage.iniciar(aoMudarUsuario);
  } catch (erro) {
    console.error(erro);
    $('tela-carregando').querySelector('p').textContent =
      'Não foi possível abrir o calendário. Verifique a internet e abra de novo.';
  }
}

function aoMudarUsuario(usuario) {
  estado.usuario = usuario;
  if (!usuario) {
    pararObservacao();
    $('btn-menu').hidden = true;
    mostrarTela('login');
    return;
  }
  $('btn-menu').hidden = false;
  const nuvem = storage.modo === 'nuvem';
  $('btn-sair').hidden = !nuvem;
  $('info-conta').hidden = !nuvem;
  $('info-conta').textContent = nuvem ? `Conectado como ${usuario.email}` : '';
  mostrarTela('app');
  const { ano, mes } = mesInicial();
  abrirMes(ano, mes);
  mostrarDicaInstalar();
}

async function aoEntrar() {
  $('erro-login').hidden = true;
  $('btn-entrar').disabled = true;
  try {
    await storage.entrar();
  } catch (erro) {
    console.error(erro);
    $('erro-login').textContent = erro?.code === 'auth/unauthorized-domain'
      ? 'Este endereço do site ainda não foi autorizado no Firebase.'
      : 'Não foi possível entrar. Verifique a internet e tente de novo.';
    $('erro-login').hidden = false;
  } finally {
    $('btn-entrar').disabled = false;
  }
}

function mostrarSemPermissao() {
  pararObservacao();
  $('email-sem-permissao').textContent = estado.usuario?.email ?? '';
  $('btn-menu').hidden = true;
  mostrarTela('sem-permissao');
}

/** Último mês editado (se não for passado); senão, o mês seguinte ao atual. */
function mesInicial() {
  const hoje = new Date();
  const atual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const ultimo = storage.lerUltimoMes();
  if (ultimo && ultimo.ano * 12 + ultimo.mes >= atual.ano * 12 + atual.mes) return ultimo;
  return somarMes(atual.ano, atual.mes, 1);
}

// ---------- Mês aberto ----------

function pararObservacao() {
  estado.pararDeObservar?.();
  estado.pararDeObservar = null;
}

function abrirMes(ano, mes) {
  pararObservacao();
  estado.ano = ano;
  estado.mes = mes;
  estado.doc = null;
  renderizar();
  estado.pararDeObservar = storage.observarMes(
    ano, mes,
    (doc) => {
      if (doc.ano !== estado.ano || doc.mes !== estado.mes) return;
      estado.doc = doc;
      renderizar();
    },
    (tipo, erro) => {
      console.error(erro);
      if (tipo === 'sem-permissao') mostrarSemPermissao();
      else toast('Não foi possível carregar os eventos. Verifique a internet.', 4000);
    },
  );
}

function mudarMes(delta) {
  const { ano, mes } = somarMes(estado.ano, estado.mes, delta);
  abrirMes(ano, mes);
}

/** Aplica uma alteração no mês aberto, redesenha e salva. */
async function alterar(mudanca, mensagem = 'Salvo') {
  if (!estado.doc) return;
  const novo = structuredClone(estado.doc);
  mudanca(novo);
  estado.doc = novo;
  renderizar();
  storage.gravarUltimoMes(novo.ano, novo.mes);
  await salvarComAviso(novo, mensagem);
}

async function salvarComAviso(doc, mensagem) {
  // Sem internet, o Firebase guarda no aparelho e só confirma quando sincronizar.
  const demorou = setTimeout(() => toast('Salvo neste aparelho. Vai sincronizar quando a internet voltar.', 4000), 4000);
  try {
    await storage.salvarMes(doc);
    clearTimeout(demorou);
    toast(mensagem);
  } catch (erro) {
    clearTimeout(demorou);
    console.error(erro);
    if (erro?.code === 'permission-denied') mostrarSemPermissao();
    else toast('Não foi possível salvar. Tente de novo.', 4000);
  }
}

// ---------- Desenho do editor ----------

function renderizar() {
  $('titulo-mes').textContent = tituloMes();
  const carregado = estado.doc !== null;
  for (const id of ['btn-adicionar', 'btn-compartilhar', 'btn-baixar']) $(id).disabled = !carregado;
  statusImagem('');
  if (!carregado) {
    $('lista-eventos').replaceChildren();
    $('aviso-invalidos').hidden = true;
    $('sem-eventos').hidden = false;
    $('sem-eventos').textContent = 'Carregando…';
    $('previa-escala').replaceChildren();
    $('previa').style.height = '';
    estado.imagem = null;
    return;
  }
  renderizarListaEditor();
  renderizarPrevia();
}

function eventosOrdenados(doc) {
  return doc.eventos
    .map((evento, ordem) => ({ evento, ordem }))
    .sort((a, b) => a.evento.inicio - b.evento.inicio || a.evento.fim - b.evento.fim || a.ordem - b.ordem)
    .map(({ evento }) => evento);
}

function renderizarListaEditor() {
  const doc = estado.doc;
  const invalidos = new Set(eventosInvalidos(doc));
  const itens = eventosOrdenados(doc).map((ev) => {
    const cor = PALETA[ev.cor];
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'evento-card' + (invalidos.has(ev) ? ' invalido' : '');
    botao.addEventListener('click', () => abrirFormulario(ev));

    const bolinha = document.createElement('span');
    bolinha.className = 'evento-cor';
    bolinha.style.background = cor.fundo;

    const textos = document.createElement('span');
    textos.className = 'evento-textos';
    const dias = document.createElement('span');
    dias.className = 'evento-dias';
    const nome = document.createElement('span');
    nome.className = 'evento-nome' + (temNome(ev) ? '' : ' sem-nome');
    nome.textContent = temNome(ev) ? ev.nome.trim() : 'Só destaque (sem nome)';
    textos.append(dias, nome);

    if (invalidos.has(ev)) {
      dias.textContent = `Dia ${rotuloData(ev)}`;
      const alerta = document.createElement('span');
      alerta.className = 'evento-alerta';
      alerta.textContent = `Este dia não existe em ${noMeioDaFrase(doc.mes)}. Toque para corrigir.`;
      textos.append(alerta);
    } else {
      dias.textContent = `${rotuloData(ev)} · ${rotuloDiaSemana(doc.ano, doc.mes, ev)}`;
    }

    const editar = document.createElement('span');
    editar.className = 'evento-editar';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-hidden', 'true');

    botao.setAttribute('aria-label', `Editar: ${nome.textContent}, dia ${dias.textContent}`);
    botao.append(bolinha, textos, editar);
    const li = document.createElement('li');
    li.append(botao);
    return li;
  });
  $('lista-eventos').replaceChildren(...itens);

  $('sem-eventos').textContent = 'Nenhum evento neste mês ainda.';
  $('sem-eventos').hidden = itens.length > 0;

  const n = invalidos.size;
  $('aviso-invalidos').hidden = n === 0;
  $('aviso-invalidos').textContent = n === 1
    ? `1 evento tem um dia que não existe em ${noMeioDaFrase(doc.mes)}. Ele não aparece na imagem até ser corrigido.`
    : `${n} eventos têm dias que não existem em ${noMeioDaFrase(doc.mes)}. Eles não aparecem na imagem até serem corrigidos.`;
}

// ---------- Prévia e imagem ----------

let observadorPrevia;
let temporizadorImagem;

function renderizarPrevia() {
  const no = renderizarImagem(estado.doc);
  $('previa-escala').replaceChildren(no);
  observadorPrevia?.disconnect();
  observadorPrevia = new ResizeObserver(ajustarEscalaPrevia);
  observadorPrevia.observe(no);
  observadorPrevia.observe($('previa'));
  ajustarEscalaPrevia();

  // Prepara o PNG com antecedência: o celular só abre o compartilhar se for logo depois do toque.
  estado.imagem = null;
  clearTimeout(temporizadorImagem);
  temporizadorImagem = setTimeout(() => prepararImagem().catch(() => {}), 800);
}

function ajustarEscalaPrevia() {
  const no = $('previa-escala').firstElementChild;
  if (!no) return;
  const escala = $('previa').clientWidth / 1080;
  $('previa-escala').style.transform = `scale(${escala})`;
  $('previa').style.height = `${Math.ceil(no.offsetHeight * escala)}px`;
}

function prepararImagem() {
  if (estado.imagem) return estado.imagem.promessa;
  const no = $('previa-escala').firstElementChild;
  if (!no) return Promise.reject(new Error('Prévia vazia'));
  const registro = { promessa: gerarPng(no) };
  estado.imagem = registro;
  registro.promessa.catch(() => { if (estado.imagem === registro) estado.imagem = null; });
  return registro.promessa;
}

const nomeArquivo = () => `calendario-ens-${idDoMes(estado.ano, estado.mes)}.png`;

async function comImagem(acao) {
  const botoes = [$('btn-compartilhar'), $('btn-baixar')];
  botoes.forEach((b) => { b.disabled = true; });
  statusImagem('Preparando a imagem…');
  try {
    await acao(await prepararImagem());
  } catch (erro) {
    console.error(erro);
    statusImagem('Não foi possível gerar a imagem. Tente de novo.');
  } finally {
    botoes.forEach((b) => { b.disabled = false; });
  }
}

function aoCompartilhar() {
  return comImagem(async (blob) => {
    const r = await compartilhar(blob, nomeArquivo(), `Calendário ENS – ${tituloMes()}`);
    if (r === 'baixado') {
      statusImagem('Este navegador não compartilha direto. A imagem foi baixada: envie pelo WhatsApp como foto.');
    } else if (r === 'precisa-toque') {
      statusImagem('A imagem está pronta. Toque de novo em "Compartilhar no WhatsApp".');
    } else {
      statusImagem('');
    }
  });
}

function aoBaixar() {
  return comImagem(async (blob) => {
    baixar(blob, nomeArquivo());
    statusImagem('Imagem baixada.');
  });
}

// ---------- Formulário do evento ----------

function opcoesDeDias(select, selecionado) {
  const total = diasNoMes(estado.ano, estado.mes);
  const opcoes = [];
  for (let d = 1; d <= total; d++) {
    const o = document.createElement('option');
    o.value = String(d);
    o.textContent = `${d} · ${DIAS_SEMANA[diaDaSemana(estado.ano, estado.mes, d)]}`;
    opcoes.push(o);
  }
  select.replaceChildren(...opcoes);
  select.value = String(Math.min(Math.max(selecionado, 1), total));
}

function montarCores() {
  const opcoes = Object.entries(PALETA).map(([id, cor]) => {
    const label = document.createElement('label');
    label.className = 'cor-opcao';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'cor';
    input.value = id;
    const bolinha = document.createElement('span');
    bolinha.className = 'cor-bolinha';
    bolinha.style.background = cor.fundo;
    bolinha.style.color = cor.texto;
    const nome = document.createElement('span');
    nome.className = 'cor-nome';
    nome.textContent = cor.nome;
    label.append(input, bolinha, nome);
    return label;
  });
  $('campo-cor').replaceChildren(...opcoes);
}

function atualizarVariosDias() {
  const varios = $('campo-varios').checked;
  $('bloco-fim').hidden = !varios;
  $('rotulo-inicio').textContent = varios ? 'Do dia' : 'Dia';
  if (varios && Number($('campo-fim').value) <= Number($('campo-inicio').value)) {
    const total = diasNoMes(estado.ano, estado.mes);
    $('campo-fim').value = String(Math.min(Number($('campo-inicio').value) + 1, total));
  }
}

function mostrarErroForm(texto) {
  $('erro-form').textContent = texto;
  $('erro-form').hidden = !texto;
}

function abrirFormulario(evento) {
  if (!estado.doc) return;
  const novo = !evento;
  if (novo && estado.doc.eventos.length >= LIMITES.eventos) {
    toast(`Limite de ${LIMITES.eventos} eventos por mês.`, 4000);
    return;
  }
  const ev = evento ?? { nome: '', inicio: 1, fim: 1, cor: 'azul', obs: '' };
  estado.editandoId = evento?.id ?? null;

  $('titulo-form').textContent = novo ? 'Novo evento' : 'Editar evento';
  $('campo-nome').value = ev.nome;
  $('campo-obs').value = ev.obs;
  opcoesDeDias($('campo-inicio'), ev.inicio);
  opcoesDeDias($('campo-fim'), ev.fim);
  $('campo-varios').checked = ev.fim > ev.inicio;
  atualizarVariosDias();
  for (const r of document.querySelectorAll('input[name=cor]')) r.checked = r.value === ev.cor;
  $('btn-excluir').hidden = novo;

  const total = diasNoMes(estado.ano, estado.mes);
  mostrarErroForm(ev.inicio > total || ev.fim > total
    ? `O dia ${ev.fim > total ? ev.fim : ev.inicio} não existe em ${noMeioDaFrase(estado.mes)}. Escolha outro dia e salve.`
    : '');

  $('dlg-evento').showModal();
  $('titulo-form').focus();
}

function aoSalvarEvento(e) {
  e.preventDefault();
  const inicio = Number($('campo-inicio').value);
  const cor = document.querySelector('input[name=cor]:checked')?.value;
  const ev = {
    id: estado.editandoId ?? novoId(),
    nome: $('campo-nome').value.trim(),
    inicio,
    fim: $('campo-varios').checked ? Number($('campo-fim').value) : inicio,
    cor,
    obs: $('campo-obs').value.trim(),
  };
  const erros = validarEvento(ev, estado.ano, estado.mes);
  if (erros.length) { mostrarErroForm(erros.join(' ')); return; }

  $('dlg-evento').close();
  alterar((doc) => {
    const i = doc.eventos.findIndex((x) => x.id === ev.id);
    if (i >= 0) doc.eventos[i] = ev;
    else doc.eventos.push(ev);
  });
}

function aoExcluirEvento() {
  const ev = estado.doc?.eventos.find((x) => x.id === estado.editandoId);
  if (!ev) return;
  const descricao = temNome(ev) ? `"${ev.nome.trim()}"` : `do dia ${rotuloData(ev)}`;
  if (!confirm(`Excluir o evento ${descricao}?`)) return;
  $('dlg-evento').close();
  alterar((doc) => { doc.eventos = doc.eventos.filter((x) => x.id !== ev.id); }, 'Evento excluído');
}

// ---------- Mais opções ----------

async function aoCopiarMesAnterior() {
  if (!estado.doc) return;
  const anterior = somarMes(estado.ano, estado.mes, -1);
  const nomeAnterior = nomeDoMes(anterior.mes);
  let origem;
  try {
    origem = await storage.lerMes(anterior.ano, anterior.mes);
  } catch (erro) {
    console.error(erro);
    toast('Não foi possível ler o mês anterior. Verifique a internet.', 4000);
    return;
  }
  if (origem.eventos.length === 0) {
    toast(`${nomeAnterior} não tem eventos para copiar.`, 3000);
    return;
  }
  const destino = { ano: estado.ano, mes: estado.mes };
  const cabem = origem.eventos.filter((ev) => validarEvento(ev, destino.ano, destino.mes).length === 0);
  const naoCabem = origem.eventos.length - cabem.length;
  const espaco = LIMITES.eventos - estado.doc.eventos.length;
  const copiar = cabem.slice(0, espaco);

  if (copiar.length === 0) {
    toast(naoCabem ? `Nenhum evento de ${noMeioDaFrase(anterior.mes)} cabe em ${noMeioDaFrase(destino.mes)}.` : 'Este mês já está cheio.', 4000);
    return;
  }
  let pergunta = `Copiar ${copiar.length} evento(s) de ${noMeioDaFrase(anterior.mes)} para ${noMeioDaFrase(destino.mes)}?`;
  if (estado.doc.eventos.length) pergunta += '\n\nEles serão somados aos eventos que já existem.';
  if (naoCabem) pergunta += `\n\n${naoCabem} evento(s) caem em dias que não existem em ${noMeioDaFrase(destino.mes)} e não serão copiados.`;
  if (!confirm(pergunta)) return;

  $('dlg-menu').close();
  alterar((doc) => {
    doc.eventos.push(...copiar.map((ev) => ({ ...ev, id: novoId() })));
  }, 'Eventos copiados');
}

async function aoFazerBackup() {
  try {
    const meses = (await storage.listarMeses())
      .filter((m) => m.eventos.length > 0)
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    const conteudo = { app: 'calendario-ens', versao: 1, geradoEm: new Date().toISOString(), meses };
    const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
    const hoje = new Date();
    const data = `${idDoMes(hoje.getFullYear(), hoje.getMonth() + 1)}-${String(hoje.getDate()).padStart(2, '0')}`;
    baixar(blob, `backup-calendario-ens-${data}.json`);
    toast(`Backup com ${meses.length} mês(es) baixado`, 3000);
  } catch (erro) {
    console.error(erro);
    toast('Não foi possível fazer o backup. Verifique a internet.', 4000);
  }
}

async function aoEscolherBackup(e) {
  const arquivo = e.target.files?.[0];
  e.target.value = '';
  if (!arquivo) return;
  if (arquivo.size > 1_000_000) { toast('Arquivo grande demais para ser um backup.', 4000); return; }

  let meses;
  try {
    const dados = JSON.parse(await arquivo.text());
    meses = (Array.isArray(dados?.meses) ? dados.meses : [dados]).map((m) => limparDocumento(m));
    if (meses.length === 0) throw new Error('vazio');
  } catch {
    toast('Este arquivo não é um backup válido do Calendário ENS.', 4000);
    return;
  }

  const nomes = meses.map((m) => `${nomeDoMes(m.mes)} ${m.ano}`).join(', ');
  if (!confirm(`Restaurar ${nomes}?\n\nOs eventos desses meses serão substituídos pelos do backup.`)) return;

  $('dlg-menu').close();
  try {
    for (const m of meses) await storage.salvarMes(m);
    toast('Backup restaurado');
    if (meses.length === 1) abrirMes(meses[0].ano, meses[0].mes);
    else abrirMes(estado.ano, estado.mes);
  } catch (erro) {
    console.error(erro);
    toast('Não foi possível restaurar o backup. Tente de novo.', 4000);
  }
}

function aoLimparMes() {
  if (!estado.doc || estado.doc.eventos.length === 0) { toast('Este mês já está vazio.'); return; }
  if (!confirm(`Apagar todos os eventos de ${tituloMes()}?\n\nIsso não pode ser desfeito.`)) return;
  $('dlg-menu').close();
  alterar((doc) => { doc.eventos = []; }, 'Mês limpo');
}

// ---------- Dica "Adicione à tela inicial" ----------

const CHAVE_DICA = 'ens-cal:dica-instalar-vista';
let pedidoInstalar = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoInstalar = e;
  mostrarDicaInstalar();
});

function mostrarDicaInstalar() {
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let vista = false;
  try { vista = localStorage.getItem(CHAVE_DICA) === '1'; } catch { /* ignora */ }
  if (instalado || vista || !matchMedia('(pointer: coarse)').matches || $('tela-app').hidden) return;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('texto-instalar').textContent = ios
    ? 'para abrir mais rápido, toque em Compartilhar (o quadrado com a seta para cima) e depois em "Adicionar à Tela de Início".'
    : pedidoInstalar
      ? 'instale o app para abrir direto da tela inicial do celular.'
      : 'para abrir mais rápido, toque no menu ⋮ do navegador e depois em "Adicionar à tela inicial".';
  $('btn-instalar').hidden = !pedidoInstalar;
  $('aviso-instalar').hidden = false;
}

function fecharDicaInstalar() {
  $('aviso-instalar').hidden = true;
  try { localStorage.setItem(CHAVE_DICA, '1'); } catch { /* ignora */ }
}

async function aoInstalar() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice;
  pedidoInstalar = null;
  fecharDicaInstalar();
}

// ---------- Ligações ----------

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((erro) => console.warn('Service worker:', erro));
  }
}

function ligarEventos() {
  $('btn-entrar').addEventListener('click', aoEntrar);
  $('btn-trocar-conta').addEventListener('click', () => storage.sair());
  $('btn-mes-anterior').addEventListener('click', () => mudarMes(-1));
  $('btn-mes-seguinte').addEventListener('click', () => mudarMes(1));
  $('btn-adicionar').addEventListener('click', () => abrirFormulario(null));
  $('btn-compartilhar').addEventListener('click', aoCompartilhar);
  $('btn-baixar').addEventListener('click', aoBaixar);

  montarCores();
  $('form-evento').addEventListener('submit', aoSalvarEvento);
  $('btn-cancelar').addEventListener('click', () => $('dlg-evento').close());
  $('btn-excluir').addEventListener('click', aoExcluirEvento);
  $('campo-varios').addEventListener('change', atualizarVariosDias);
  $('campo-inicio').addEventListener('change', atualizarVariosDias);

  $('btn-menu').addEventListener('click', () => $('dlg-menu').showModal());
  $('btn-fechar-menu').addEventListener('click', () => $('dlg-menu').close());
  $('btn-copiar').addEventListener('click', aoCopiarMesAnterior);
  $('btn-backup').addEventListener('click', aoFazerBackup);
  $('btn-restaurar').addEventListener('click', () => $('arquivo-backup').click());
  $('arquivo-backup').addEventListener('change', aoEscolherBackup);
  $('btn-limpar').addEventListener('click', aoLimparMes);
  $('btn-sair').addEventListener('click', () => { $('dlg-menu').close(); storage.sair(); });

  $('btn-instalar').addEventListener('click', aoInstalar);
  $('btn-fechar-instalar').addEventListener('click', fecharDicaInstalar);

  window.addEventListener('resize', ajustarEscalaPrevia);
}

iniciar();
