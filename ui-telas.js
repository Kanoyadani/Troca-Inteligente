function novaTela(classe = '') {
  const tela = $('#tela');
  tela.innerHTML = '';
  const raiz = document.createElement('div');
  raiz.className = `tela ${classe}`;
  tela.appendChild(raiz);
  window.scrollTo(0, 0);
  return raiz;
}

const ILUSTRACOES = {
  caixa: 'vazio-caixa.svg',
  presente: 'vazio-presente.svg',
  busca: 'vazio-busca.svg',
  festa: 'vazio-festa.svg'
};

function telaVazia({ ilustracao = 'caixa', frase, botaoTexto = '', botaoHref = '', botaoId = '', botaoClasse = '', extra = '' }) {
  const botao = (botaoTexto
    ? (botaoHref
      ? `<a class="botao ${botaoClasse}" href="${esc(botaoHref)}">${botaoTexto}</a>`
      : `<button class="botao ${botaoClasse}" type="button" id="${esc(botaoId)}">${botaoTexto}</button>`)
    : '') + extra;
  return `<div class="tela-vazia entrar">
    <img src="${ILUSTRACOES[ilustracao]}" alt="" width="220" height="160">
    <p>${esc(frase)}</p>
    ${botao}
  </div>`;
}

function esqueletosDeCards(quantidade = 6) {
  return Array.from({ length: quantidade }, () => `
    <div class="card-item" aria-hidden="true">
      <div class="esqueleto esqueleto-foto"></div>
      <div class="card-item-corpo">
        <div class="esqueleto esqueleto-linha"></div>
        <div class="esqueleto esqueleto-linha curta"></div>
      </div>
    </div>`).join('');
}

function esqueletosDeLista(quantidade = 4) {
  return Array.from({ length: quantidade }, () => `
    <div class="linha-lista" aria-hidden="true">
      <div class="esqueleto linha-lista-foto"></div>
      <div class="linha-lista-corpo">
        <div class="esqueleto esqueleto-linha"></div>
        <div class="esqueleto esqueleto-linha curta"></div>
      </div>
    </div>`).join('');
}

function abrirDialogo({ titulo, corpo = '', botoes = [], preparar = null, validar = null }) {
  return new Promise(resolver => {
    const fundo = document.createElement('div');
    fundo.className = 'dialogo-fundo';
    fundo.innerHTML = `
      <div class="dialogo entrar" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">
        <h2 id="dialogo-titulo">${esc(titulo)}</h2>
        <form class="dialogo-corpo" novalidate>${corpo}
          <div class="dialogo-botoes">
            ${botoes.map((b, i) => `<button type="${b.valor === null ? 'button' : 'submit'}" data-indice="${i}"
              class="botao botao-largo ${b.classe || ''}">${b.texto}</button>`).join('')}
          </div>
        </form>
      </div>`;
    const anterior = document.activeElement;
    document.body.appendChild(fundo);
    document.body.classList.add('com-dialogo');
    const form = $('form', fundo);
    let escolhido = null;

    const fechar = valor => {
      fundo.remove();
      document.body.classList.remove('com-dialogo');
      if (anterior && anterior.focus) anterior.focus();
      resolver({ valor, campos: Object.fromEntries(new FormData(form)) });
    };
    $$('button[data-indice]', fundo).forEach(b => b.addEventListener('click', () => {
      escolhido = botoes[Number(b.dataset.indice)].valor;
      if (escolhido === null) fechar(null);
    }));
    form.addEventListener('submit', evento => {
      evento.preventDefault();
      const valido = !validar || validar(form, escolhido);
      if (valido) fechar(escolhido === null ? botoes.find(b => b.valor !== null).valor : escolhido);
    });
    fundo.addEventListener('click', evento => { if (evento.target === fundo) fechar(null); });
    fundo.addEventListener('keydown', evento => { if (evento.key === 'Escape') fechar(null); });
    if (preparar) preparar(form);
    const primeiro = $('input, textarea, select', form) || $('button', form);
    if (primeiro) primeiro.focus();
  });
}

async function confirmar(titulo, texto, textoSim, classeSim = '') {
  const { valor } = await abrirDialogo({
    titulo,
    corpo: `<p>${esc(texto)}</p>`,
    botoes: [{ texto: textoSim, valor: true, classe: classeSim }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }]
  });
  return valor === true;
}

let aoPuxar = null;

function definirPuxarParaAtualizar(funcao) {
  aoPuxar = funcao;
}

function ativarPuxarParaAtualizar() {
  const indicador = $('#puxar');
  let inicioY = null;
  let distancia = 0;
  window.addEventListener('touchstart', evento => {
    inicioY = aoPuxar && window.scrollY <= 0 && !document.body.classList.contains('com-dialogo')
      ? evento.touches[0].clientY : null;
    distancia = 0;
  }, { passive: true });
  window.addEventListener('touchmove', evento => {
    if (inicioY === null) return;
    distancia = Math.max(0, evento.touches[0].clientY - inicioY);
    indicador.style.transform = `translateY(${Math.min(distancia, 90) - 60}px)`;
    indicador.textContent = distancia > 80 ? 'Solte para atualizar' : 'Puxe para atualizar';
    indicador.classList.toggle('visivel', distancia > 10);
  }, { passive: true });
  const recolher = () => {
    indicador.classList.remove('visivel');
    indicador.style.transform = '';
  };
  window.addEventListener('touchend', async () => {
    if (inicioY === null) return;
    inicioY = null;
    if (distancia > 80 && aoPuxar) {
      indicador.textContent = 'Atualizando…';
      vibrar();
      try {
        await aoPuxar();
      } finally {
        recolher();
      }
    } else {
      recolher();
    }
  });
}

function mostrarFaixaComemoracao(texto) {
  const faixa = document.createElement('div');
  faixa.className = 'faixa-comemoracao';
  faixa.setAttribute('role', 'status');
  faixa.textContent = texto;
  document.body.appendChild(faixa);
  soltarConfete();
  setTimeout(() => faixa.classList.add('saindo'), 5000);
  setTimeout(() => faixa.remove(), 5600);
}
