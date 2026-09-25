const estado = {
  config: lerLocal(CHAVES.config, null),
  banido: null
};

const TELAS_PUBLICAS = {
  vitrine: () => mostrarVitrine(),
  doar: () => mostrarDoacao(),
  minhas: parametro => mostrarMinhasCoisas(parametro === 'reservas' ? 'reservas' : 'doacoes'),
  reservar: parametro => mostrarConfirmacaoReserva(parametro)
};

function irPara(endereco) {
  if (location.hash === endereco) navegar();
  else location.hash = endereco;
}

function rotaAtual() {
  const partes = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  return { nome: partes[0] || 'vitrine', parametro: partes.slice(1).join('/') };
}

function navegar() {
  pararAtualizacaoAutomatica();
  definirPuxarParaAtualizar(null);
  esconderDesfazer();
  const { nome, parametro } = rotaAtual();
  if (nome === 'equipe') {
    entrarModo('equipe');
    abrirAreaEquipe(parametro);
    return;
  }
  if (estado.banido) {
    mostrarTelaBanido(estado.banido);
    return;
  }
  if (!usuarioAtual()) {
    mostrarTelaIdentificacao();
    return;
  }
  const tela = TELAS_PUBLICAS[nome] ? nome : 'vitrine';
  entrarModo(tela === 'reservar' ? 'detalhe' : 'publico');
  marcarAbaAtiva(tela === 'reservar' ? 'vitrine' : tela);
  TELAS_PUBLICAS[tela](parametro);
  $('#tela').focus({ preventScroll: true });
}

function entrarModo(modo) {
  document.body.classList.toggle('modo-equipe', modo === 'equipe');
  document.body.classList.toggle('modo-detalhe', modo === 'detalhe');
  $('#barra').hidden = modo !== 'publico';
  $('#rodape').hidden = modo === 'equipe' || modo === 'detalhe';
  document.body.classList.toggle('sem-barra', modo === 'equipe' || modo === 'sozinha');
}

function ligarBarraInferior() {
  $('#barra').addEventListener('click', evento => {
    const botao = evento.target.closest('a[data-aba]');
    if (!botao) return;
    evento.preventDefault();
    irPara(botao.getAttribute('href'));
  });
}

function marcarAbaAtiva(nome) {
  $$('#barra .barra-inferior-botao').forEach(botao => {
    const ativa = botao.dataset.aba === nome;
    botao.classList.toggle('ativo', ativa);
    if (ativa) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  });
}

function aplicarConfigPublica(config) {
  if (!config) return;
  estado.config = config;
  gravarLocal(CHAVES.config, config);
  document.title = config.nome_bazar || 'Troca Inteligente';
}

function categoriasPublicas() {
  return (estado.config && estado.config.categorias) || [];
}

let relogioAtualizacao = null;

function iniciarAtualizacaoAutomatica(funcao) {
  pararAtualizacaoAutomatica();
  relogioAtualizacao = setInterval(() => {
    if (!document.hidden) funcao();
  }, CONFIG.SEGUNDOS_ATUALIZACAO * 1000);
}

function pararAtualizacaoAutomatica() {
  clearInterval(relogioAtualizacao);
  relogioAtualizacao = null;
}

async function iniciarApp() {
  const splashMinimo = new Promise(resolver => setTimeout(resolver, 1000));
  aplicarConfigPublica(estado.config);
  prepararSplash();
  if (!servidorConfigurado()) {
    await splashMinimo;
    esconderSplash();
    mostrarFaltaConfigurar();
    return;
  }
  try {
    const resposta = await chamarServidor('iniciar', { id_aparelho: idAparelho() });
    aplicarConfigPublica(resposta.config);
    if (resposta.usuario) guardarUsuario(resposta.usuario);
    else esquecerUsuario();
    estado.banido = resposta.banido || null;
  } catch (erro) {
    console.warn('Sem conexão ao abrir; usando o que está guardado no aparelho.');
  }
  await splashMinimo;
  esconderSplash();
  navegar();
}

function prepararSplash() {
  if (!estado.config) return;
  if (estado.config.logo_url) {
    $('.splash-logo').innerHTML = `<img src="${esc(urlDeFoto(estado.config.logo_url))}" alt="">`;
  }
  if (estado.config.nome_bazar) $('.splash-nome').innerHTML = nomeEmDuasLinhas();
}

function nomeEmDuasLinhas() {
  const nome = String((estado.config && estado.config.nome_bazar) || 'Troca Inteligente').trim();
  const [primeira, ...resto] = nome.split(/\s+/);
  return `<span>${esc(primeira)}</span>${resto.length ? `<span>${esc(resto.join(' '))}</span>` : ''}`;
}

function esconderSplash() {
  const splash = $('#splash');
  splash.classList.add('saindo');
  setTimeout(() => splash.remove(), 400);
}

document.addEventListener('error', evento => {
  const imagem = evento.target;
  if (imagem.tagName === 'IMG' && !imagem.dataset.falhou) {
    imagem.dataset.falhou = '1';
    imagem.src = 'sem-foto.svg';
  }
}, true);

window.addEventListener('hashchange', navegar);
window.addEventListener('online', () => { if (rotaAtual().nome === 'vitrine') navegar(); });
window.addEventListener('offline', () => { if (rotaAtual().nome === 'vitrine') navegar(); });
window.addEventListener('DOMContentLoaded', () => {
  ativarPuxarParaAtualizar();
  ligarBarraInferior();
  iniciarApp();
});
