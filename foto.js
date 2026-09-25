const LADO_MAXIMO = 1400;
const BYTES_MAXIMOS = 600 * 1024;

function carregarImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(endereco); resolver(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(endereco); rejeitar(new Error('imagem inválida')); };
    imagem.src = endereco;
  });
}

function areaDeDesenho(largura, altura) {
  const area = document.createElement('canvas');
  area.width = largura;
  area.height = altura;
  const contexto = area.getContext('2d');
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.fillStyle = '#FFFFFF';
  contexto.fillRect(0, 0, largura, altura);
  return area;
}

function desenharReduzida(imagem, ladoMaximo) {
  const escala = Math.min(1, ladoMaximo / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const larguraFinal = Math.max(1, Math.round(imagem.naturalWidth * escala));
  const alturaFinal = Math.max(1, Math.round(imagem.naturalHeight * escala));
  let origem = imagem;
  let largura = imagem.naturalWidth;
  let altura = imagem.naturalHeight;
  while (largura >= larguraFinal * 2 && altura >= alturaFinal * 2) {
    largura = Math.max(larguraFinal, Math.round(largura / 2));
    altura = Math.max(alturaFinal, Math.round(altura / 2));
    const etapa = areaDeDesenho(largura, altura);
    etapa.getContext('2d').drawImage(origem, 0, 0, largura, altura);
    origem = etapa;
  }
  const tela = areaDeDesenho(larguraFinal, alturaFinal);
  tela.getContext('2d').drawImage(origem, 0, 0, larguraFinal, alturaFinal);
  return tela;
}

function tamanhoEmBytes(dataUrl) {
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
}

async function comprimirFoto(arquivo) {
  if (!arquivo || !arquivo.type.startsWith('image/')) {
    throw new Error('Esse arquivo não é uma foto. Toque em "Tirar foto" e fotografe o item.');
  }
  let imagem;
  try {
    imagem = await carregarImagem(arquivo);
  } catch (erro) {
    throw new Error('Não conseguimos abrir essa foto. Tente tirar outra.');
  }
  let lado = LADO_MAXIMO;
  let resultado = '';
  for (let rodada = 0; rodada < 5; rodada++) {
    const tela = desenharReduzida(imagem, lado);
    for (const qualidade of [0.88, 0.8, 0.72, 0.64]) {
      resultado = tela.toDataURL('image/jpeg', qualidade);
      if (tamanhoEmBytes(resultado) <= BYTES_MAXIMOS) return resultado;
    }
    lado = Math.round(lado * 0.8);
  }
  return resultado;
}

function ligarEntradaDeFoto(entrada, aoEscolher) {
  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = '';
    if (!arquivo) return;
    try {
      aoEscolher(await comprimirFoto(arquivo));
    } catch (erro) {
      mostrarErro(erro);
    }
  });
}

function campoDeFoto(id) {
  return `<input type="file" id="${id}" accept="image/*" capture="environment" class="escondido" tabindex="-1" aria-hidden="true">`;
}
