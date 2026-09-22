// Gera o PNG da imagem e abre a folha de compartilhar do celular (ou baixa o arquivo).
// Usa html-to-image (js/vendor/html-to-image.js, carregado como script clássico em window.htmlToImage).

const LARGURA = 1080;

// Safari (iPhone/iPad/Mac) às vezes gera a 1ª imagem sem fontes ou sem o logo. Workaround: gerar duas vezes.
const ehSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

async function esperarRecursos(no) {
  await document.fonts.ready;
  await Promise.all([...no.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {})));
}

/** PNG (Blob) do nó `.ens-img`. O nó precisa estar no documento (pode estar escalado por um pai). */
export async function gerarPng(no) {
  await esperarRecursos(no);
  const opcoes = { width: LARGURA, height: no.offsetHeight, pixelRatio: 1, backgroundColor: '#F3F6FB' };
  if (ehSafari) await window.htmlToImage.toBlob(no, opcoes);
  const blob = await window.htmlToImage.toBlob(no, opcoes);
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

export function baixar(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function podeCompartilharArquivo() {
  try {
    const teste = new File([new Blob(['x'], { type: 'image/png' })], 'teste.png', { type: 'image/png' });
    return Boolean(navigator.canShare?.({ files: [teste] }));
  } catch { return false; }
}

/**
 * Abre a folha de compartilhar com o PNG anexado. Sem suporte, baixa o arquivo.
 * Retorna 'compartilhado' | 'cancelado' | 'baixado' | 'precisa-toque'.
 * 'precisa-toque': o navegador exige um toque novo (a imagem demorou a ficar pronta).
 */
export async function compartilhar(blob, nomeArquivo, titulo) {
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [arquivo] })) {
    baixar(blob, nomeArquivo);
    return 'baixado';
  }
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return 'compartilhado';
  } catch (erro) {
    if (erro?.name === 'AbortError') return 'cancelado';
    if (erro?.name === 'NotAllowedError') return 'precisa-toque';
    throw erro;
  }
}
