import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  diasNoMes, diaDaSemana, somarMes, gerarGrade, eventoDoDia,
  montarCalendario, montarLista, validarEvento, eventosInvalidos, corDe,
  idDoMes, limparDocumento,
} from '../js/calendar.js';

const agosto = JSON.parse(readFileSync(new URL('./exemplos/agosto-2026.json', import.meta.url), 'utf8'));

const celula = (cal, dia) => cal.semanas.flat().find((c) => c?.dia === dia);

test('Agosto/2026 começa no sábado, tem 31 dias e 6 semanas', () => {
  assert.equal(diaDaSemana(2026, 8, 1), 6);
  assert.equal(diasNoMes(2026, 8), 31);
  const grade = gerarGrade(2026, 8);
  assert.equal(grade.length, 6);
  assert.deepEqual(grade[0], [null, null, null, null, null, null, 1]);
  assert.deepEqual(grade[5], [30, 31, null, null, null, null, null]);
});

test('Fevereiro: 28 dias em ano comum, 29 em ano bissexto', () => {
  assert.equal(diasNoMes(2026, 2), 28);
  assert.equal(diasNoMes(2028, 2), 29);
  // Fev/2026 começa no domingo e fecha em exatamente 4 semanas.
  assert.equal(gerarGrade(2026, 2).length, 4);
  assert.equal(gerarGrade(2028, 2).length, 5);
});

test('Setembro/2026 (30 dias) tem 5 semanas', () => {
  assert.equal(diasNoMes(2026, 9), 30);
  assert.equal(gerarGrade(2026, 9).length, 5);
});

test('toda semana da grade tem 7 posições e cada dia aparece uma vez', () => {
  for (let mes = 1; mes <= 12; mes++) {
    const grade = gerarGrade(2026, mes);
    assert.ok(grade.every((s) => s.length === 7));
    const dias = grade.flat().filter((d) => d !== null);
    assert.deepEqual(dias, Array.from({ length: diasNoMes(2026, mes) }, (_, i) => i + 1));
  }
});

test('somarMes vira o ano nos dois sentidos', () => {
  assert.deepEqual(somarMes(2026, 12, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(somarMes(2026, 1, -1), { ano: 2025, mes: 12 });
  assert.deepEqual(somarMes(2026, 8, 0), { ano: 2026, mes: 8 });
});

test('Agosto/2026: cores dos dias iguais ao protótipo E', () => {
  const cal = montarCalendario(agosto);
  const fundo = (dia) => celula(cal, dia).cor?.fundo ?? null;

  assert.equal(cal.nomeMes, 'Agosto');
  assert.equal(fundo(1), '#2B55B5');
  assert.equal(fundo(3), '#8FB8E8');   // só destaque, sem nome
  assert.equal(fundo(12), '#F2B705');
  for (const d of [14, 15, 16]) assert.equal(fundo(d), '#EE7433');
  assert.equal(fundo(24), '#8FB8E8');
  assert.equal(fundo(28), '#1B2F66');
  assert.equal(fundo(29), '#E0457B');  // Festiva (1 dia) vence Reunião SRB (3 dias)
  assert.equal(fundo(30), '#1B2F66');
  assert.equal(fundo(31), '#F2B705');
  assert.equal(fundo(2), null);
  assert.equal(celula(cal, 3).cor.texto, '#12305F');
});

test('domingo é marcado para receber a cor especial', () => {
  const cal = montarCalendario(agosto);
  assert.equal(celula(cal, 2).domingo, true);
  assert.equal(celula(cal, 9).domingo, true);
  assert.equal(celula(cal, 3).domingo, false);
});

test('sobreposição com mesma duração: o último adicionado vence', () => {
  const eventos = [
    { id: 'a', nome: 'A', inicio: 5, fim: 5, cor: 'azul' },
    { id: 'b', nome: 'B', inicio: 5, fim: 5, cor: 'rosa' },
  ];
  assert.equal(eventoDoDia(eventos, 5).id, 'b');
});

test('sobreposição: o menor vence mesmo se foi adicionado antes', () => {
  const eventos = [
    { id: 'curto', nome: 'C', inicio: 10, fim: 10, cor: 'rosa' },
    { id: 'longo', nome: 'L', inicio: 8, fim: 12, cor: 'azul' },
  ];
  assert.equal(eventoDoDia(eventos, 10).id, 'curto');
  assert.equal(eventoDoDia(eventos, 9).id, 'longo');
  assert.equal(eventoDoDia(eventos, 13), null);
});

test('Agosto/2026: lista na ordem certa, sem os dias só destacados', () => {
  const lista = montarLista(agosto);
  assert.deepEqual(lista.map((l) => l.data), ['1', '12', '14 a 16', '28 a 30', '29', '31']);
  assert.deepEqual(lista.map((l) => l.diaSemana), [
    'Sábado', 'Quarta', 'Sexta a Domingo', 'Sexta a Domingo', 'Sábado', 'Segunda',
  ]);
  assert.equal(lista[2].nome, 'Retiro');
  assert.equal(lista[2].obs, 'Encontro Colégio Nacional');
  assert.equal(lista[0].obs, '');
});

test('lista: empate de início e fim segue a ordem de criação', () => {
  const lista = montarLista({
    ano: 2026, mes: 8,
    eventos: [
      { id: 'x', nome: 'Primeiro', inicio: 5, fim: 5, cor: 'azul' },
      { id: 'y', nome: 'Segundo', inicio: 5, fim: 5, cor: 'rosa' },
    ],
  });
  assert.deepEqual(lista.map((l) => l.evento.id), ['x', 'y']);
});

test('nome só com espaços conta como sem nome', () => {
  const doc = { ano: 2026, mes: 8, eventos: [{ id: 'z', nome: '   ', inicio: 7, fim: 7, cor: 'azul' }] };
  assert.equal(montarLista(doc).length, 0);
  assert.equal(celula(montarCalendario(doc), 7).cor.fundo, '#2B55B5');
});

test('mês vazio: grade sem cor e lista vazia', () => {
  const doc = { ano: 2026, mes: 9, eventos: [] };
  assert.ok(montarCalendario(doc).semanas.flat().every((c) => c === null || c.cor === null));
  assert.deepEqual(montarLista(doc), []);
});

test('validação bloqueia dias fora do mês e fim antes do início', () => {
  assert.deepEqual(validarEvento({ inicio: 31, fim: 31, cor: 'azul' }, 2026, 8), []);
  assert.equal(validarEvento({ inicio: 31, fim: 31, cor: 'azul' }, 2026, 9).length, 2);
  assert.equal(validarEvento({ inicio: 29, fim: 29, cor: 'azul' }, 2026, 2).length, 2);
  assert.deepEqual(validarEvento({ inicio: 29, fim: 29, cor: 'azul' }, 2028, 2), []);
  assert.deepEqual(validarEvento({ inicio: 10, fim: 8, cor: 'azul' }, 2026, 8),
    ['O dia final não pode ser antes do dia inicial.']);
  assert.deepEqual(validarEvento({ inicio: 1, fim: 1, cor: 'verde' }, 2026, 8), ['Escolha uma cor.']);
});

test('trocar agosto para setembro aponta os eventos que não cabem', () => {
  const invalidos = eventosInvalidos({ ...agosto, mes: 9 });
  assert.deepEqual(invalidos.map((e) => e.id), ['e8']); // dia 31
});

test('cor desconhecida cai no azul em vez de quebrar', () => {
  assert.equal(corDe('verde').fundo, '#2B55B5');
});

test('idDoMes usa dois dígitos no mês', () => {
  assert.equal(idDoMes(2026, 8), '2026-08');
  assert.equal(idDoMes(2026, 12), '2026-12');
});

test('limparDocumento mantém agosto intacto', () => {
  assert.deepEqual(limparDocumento(agosto), agosto);
});

test('limparDocumento remove campos estranhos e corrige tipos', () => {
  const sujo = {
    ano: 2026, mes: 8, extra: 'x',
    eventos: [
      { id: 'a', nome: 'Ok', inicio: 1, fim: 1, cor: 'roxo', obs: 5, hack: '<script>' },
      { id: 'a', nome: 'Id repetido', inicio: 2, fim: 2, cor: 'rosa' },
      { nome: 'Sem dias' },
      { id: 'b', nome: 'x'.repeat(500), inicio: 3, fim: 3, cor: 'azul', obs: '' },
    ],
  };
  const limpo = limparDocumento(sujo);
  assert.deepEqual(Object.keys(limpo), ['ano', 'mes', 'eventos']);
  assert.equal(limpo.eventos.length, 3);
  assert.deepEqual(limpo.eventos[0], { id: 'a', nome: 'Ok', inicio: 1, fim: 1, cor: 'azul', obs: '' });
  assert.notEqual(limpo.eventos[1].id, 'a');
  assert.equal(limpo.eventos[2].nome.length, 80);
});

test('limparDocumento usa o mês padrão e recusa documento sem mês', () => {
  assert.deepEqual(limparDocumento(null, 2026, 10), { ano: 2026, mes: 10, eventos: [] });
  assert.throws(() => limparDocumento({ eventos: [] }));
  assert.throws(() => limparDocumento({ ano: 2026, mes: 13, eventos: [] }));
});
