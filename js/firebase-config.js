// Configuração do app web do Firebase (Console do Firebase → Configurações do projeto → Seus apps → SDK).
//
// Estes valores NÃO são senha nem segredo: todo site com Firebase os expõe. Quem protege os dados são
// o login com Google e as regras em `firestore.rules`, que só liberam os e-mails autorizados.
//
// Com `apiKey` vazio o app roda em MODO LOCAL: os dados ficam só neste aparelho (bom para testar).
export const firebaseConfig = {
  apiKey: 'AIzaSyDiVRhTKZ_EByu2ewVBHQKdlfmViUSkwug',
  authDomain: 'calendario-ens.firebaseapp.com',
  projectId: 'calendario-ens',
  appId: '1:222864174098:web:64b78576c07af7a6157ccb',
};
