// Camada de dados. A UI só conversa com este módulo, nunca com o Firebase direto.
//
// - Firebase configurado (js/firebase-config.js): dados na nuvem, com login Google (storage-firebase.js).
// - Sem configuração: modo local, dados em localStorage deste aparelho.
//
// Interface comum:
//   iniciar(aoMudarUsuario)          aoMudarUsuario(usuario | null), usuario = { email, nome }
//   entrar() / sair()
//   observarMes(ano, mes, aoMudar, aoErro) → função para parar de observar
//   lerMes(ano, mes) → Promise<doc>
//   salvarMes(doc) → Promise
//   listarMeses() → Promise<doc[]>

import { firebaseConfig } from './firebase-config.js';
import { limparDocumento, idDoMes } from './calendar.js';

export const modo = firebaseConfig.apiKey ? 'nuvem' : 'local';

let impl;

export async function iniciar(aoMudarUsuario) {
  impl = modo === 'nuvem' ? await import('./storage-firebase.js') : local;
  return impl.iniciar(aoMudarUsuario);
}

export const entrar = () => impl.entrar();
export const sair = () => impl.sair();
export const observarMes = (ano, mes, aoMudar, aoErro) => impl.observarMes(ano, mes, aoMudar, aoErro);
export const lerMes = (ano, mes) => impl.lerMes(ano, mes);
export const salvarMes = (doc) => impl.salvarMes(limparDocumento(doc));
export const listarMeses = () => impl.listarMeses();

// Preferência do aparelho (não é dado do calendário): último mês editado.
const CHAVE_ULTIMO = 'ens-cal:ultimo-mes';

export function lerUltimoMes() {
  try {
    const [ano, mes] = (localStorage.getItem(CHAVE_ULTIMO) ?? '').split('-').map(Number);
    return ano && mes ? { ano, mes } : null;
  } catch { return null; }
}

export function gravarUltimoMes(ano, mes) {
  try { localStorage.setItem(CHAVE_ULTIMO, idDoMes(ano, mes)); } catch { /* sem armazenamento: ignora */ }
}

// ---------- Modo local ----------

const PREFIXO = 'ens-cal:v1:';

const local = {
  async iniciar(aoMudarUsuario) {
    aoMudarUsuario({ email: null, nome: 'Este aparelho' });
  },
  async entrar() {},
  async sair() {},

  observarMes(ano, mes, aoMudar) {
    const chave = PREFIXO + idDoMes(ano, mes);
    const ler = () => {
      let dados = null;
      try { dados = JSON.parse(localStorage.getItem(chave)); } catch { /* corrompido: trata como vazio */ }
      aoMudar(limparDocumento(dados ?? { ano, mes, eventos: [] }, ano, mes));
    };
    const aoArmazenar = (e) => { if (e.key === chave) ler(); };
    window.addEventListener('storage', aoArmazenar);
    queueMicrotask(ler);
    return () => window.removeEventListener('storage', aoArmazenar);
  },

  async lerMes(ano, mes) {
    let dados = null;
    try { dados = JSON.parse(localStorage.getItem(PREFIXO + idDoMes(ano, mes))); } catch { /* vazio */ }
    return limparDocumento(dados ?? { ano, mes, eventos: [] }, ano, mes);
  },

  async salvarMes(doc) {
    localStorage.setItem(PREFIXO + idDoMes(doc.ano, doc.mes), JSON.stringify(doc));
  },

  async listarMeses() {
    const meses = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!chave.startsWith(PREFIXO)) continue;
      try { meses.push(limparDocumento(JSON.parse(localStorage.getItem(chave)))); } catch { /* ignora */ }
    }
    return meses;
  },
};
