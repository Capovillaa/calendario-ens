// Dados na nuvem com Firebase (Auth com Google + Firestore).
// Só é carregado quando js/firebase-config.js está preenchido.
//
// Segurança: quem decide quem lê e grava são as regras em `firestore.rules` (lista fixa de e-mails).
// Este arquivo não guarda nada além do calendário: ano, mês e eventos (nome, dias, cor, observação).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, onSnapshot, setDoc, getDocs, collection, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';
import { limparDocumento, idDoMes } from './calendar.js';

const COLECAO = 'calendarios';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt';
// Cache local (IndexedDB) para abrir rápido e funcionar sem internet; sincroniza quando voltar.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export async function iniciar(aoMudarUsuario) {
  onAuthStateChanged(auth, (u) => {
    aoMudarUsuario(u ? { email: u.email, nome: u.displayName || u.email } : null);
  });
}

export async function entrar() {
  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provedor);
  } catch (erro) {
    // Navegadores que bloqueiam janelas pop-up: tenta pelo redirecionamento.
    if (erro?.code === 'auth/popup-blocked' || erro?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provedor);
      return;
    }
    if (erro?.code === 'auth/popup-closed-by-user' || erro?.code === 'auth/cancelled-popup-request') return;
    throw erro;
  }
}

export const sair = () => signOut(auth);

export function observarMes(ano, mes, aoMudar, aoErro) {
  return onSnapshot(
    doc(db, COLECAO, idDoMes(ano, mes)),
    (snap) => aoMudar(limparDocumento(snap.exists() ? snap.data() : { ano, mes, eventos: [] }, ano, mes)),
    (erro) => aoErro?.(erro.code === 'permission-denied' ? 'sem-permissao' : 'falha', erro),
  );
}

export async function lerMes(ano, mes) {
  const snap = await getDoc(doc(db, COLECAO, idDoMes(ano, mes)));
  return limparDocumento(snap.exists() ? snap.data() : { ano, mes, eventos: [] }, ano, mes);
}

export async function salvarMes(d) {
  await setDoc(doc(db, COLECAO, idDoMes(d.ano, d.mes)), {
    ano: d.ano,
    mes: d.mes,
    eventos: d.eventos,
    atualizadoEm: serverTimestamp(),
  });
}

export async function listarMeses() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs.map((s) => limparDocumento(s.data()));
}
