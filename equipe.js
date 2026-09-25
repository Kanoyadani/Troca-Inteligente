const estadoEquipe = { dados: null };

const TELAS_EQUIPE = {
  '': () => mostrarPainel(),
  chegaram: () => mostrarChegaram(),
  itens: parametro => mostrarItens(parametro),
  cadastrar: () => mostrarCadastroRapido(false),
  reservas: () => mostrarReservas(),
  pessoas: parametro => mostrarPessoas(parametro),
  categorias: () => mostrarCategorias(),
  ajustes: () => mostrarAjustes(),
  relatorio: () => mostrarRelatorio(),
  registro: () => mostrarRegistro()
};

async function abrirAreaEquipe(parametro) {
  if (!temSessaoEquipe()) {
    apagarSessaoEquipe();
    mostrarLoginEquipe();
    return;
  }
  if (parametro === 'quem' || !nomeNaEquipe()) {
    mostrarQuemEsta();
    return;
  }
  const [tela, detalhe] = parametro.split('/');
  const abrir = TELAS_EQUIPE[tela] || TELAS_EQUIPE[''];
  if (!estadoEquipe.dados) {
    const raiz = novaTela('tela-equipe');
    raiz.innerHTML = topoEquipe() + `<div class="lista">${esqueletosDeLista()}</div>`;
    ligarTopoEquipe(raiz);
    try {
      await carregarDadosEquipe();
    } catch (erro) {
      if (!raiz.isConnected) return;
      raiz.innerHTML = topoEquipe() + telaVazia({ ilustracao: 'busca', frase: erro.message, botaoTexto: 'Tentar de novo', botaoId: 'tentar' });
      ligarTopoEquipe(raiz);
      $('#tentar', raiz).addEventListener('click', () => abrirAreaEquipe(parametro));
      return;
    }
    if (!raiz.isConnected) return;
    abrir(detalhe || '');
    return;
  }
  abrir(detalhe || '');
  if (tela) atualizarEquipeEmSilencio();
}

async function carregarDadosEquipe() {
  const resposta = await chamarEquipe('carregarEquipe');
  estadoEquipe.dados = resposta.dados;
  return resposta.dados;
}

function aplicarResposta(resposta) {
  if (resposta && resposta.dados) estadoEquipe.dados = resposta.dados;
  const { nome, parametro } = rotaAtual();
  if (nome !== 'equipe') return;
  const [tela, detalhe] = parametro.split('/');
  if (tela !== 'cadastrar') (TELAS_EQUIPE[tela] || TELAS_EQUIPE[''])(detalhe || '');
}

function oferecerDesfazer(texto, resposta) {
  if (!resposta.desfazer) return;
  mostrarDesfazer(texto, async () => {
    try {
      aplicarResposta(await chamarEquipe('desfazer', { id: resposta.desfazer }));
      mostrarToast('Pronto, desfeito.', 'sucesso', '↩️');
    } catch (erro) {
      mostrarErro(erro);
    }
  });
}

function mostrarLoginEquipe() {
  const raiz = novaTela('tela-login');
  raiz.innerHTML = `
    <a class="link-voltar" href="#vitrine"><i class="ph-duotone ph-arrow-left" aria-hidden="true"></i> Voltar para a vitrine</a>
    <form class="card entrar" id="form-senha" novalidate>
      <p class="emoji-grande" aria-hidden="true">🔒</p>
      <h1>Área da equipe</h1>
      <div class="campo">
        <label class="campo-rotulo" for="senha">Senha da equipe</label>
        <input class="campo-entrada" id="senha" type="password" autocomplete="current-password" required>
      </div>
      <label class="interruptor"><input type="checkbox" id="mostrar-senha"><span class="interruptor-trilho"></span> Mostrar a senha</label>
      <p class="mensagem-erro" id="erro-senha" role="alert" hidden></p>
      <button class="botao botao-largo" type="submit" disabled>Entrar</button>
    </form>`;
  const senha = $('#senha', raiz);
  const botao = $('button[type=submit]', raiz);
  senha.addEventListener('input', () => { botao.disabled = !senha.value.trim(); });
  $('#mostrar-senha', raiz).addEventListener('change', e => { senha.type = e.target.checked ? 'text' : 'password'; });
  $('#form-senha', raiz).addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!senha.value.trim()) return;
    const liberar = botaoOcupado(botao, 'Conferindo…');
    const aviso = $('#erro-senha', raiz);
    try {
      const resposta = await chamarServidor('entrarEquipe', { senha: senha.value, id_aparelho: idAparelho() });
      guardarSessaoEquipe(resposta.token, resposta.expira_em, resposta.nomes_equipe);
      estadoEquipe.dados = null;
      vibrar();
      irPara('#equipe/quem');
    } catch (erro) {
      if (!raiz.isConnected) return;
      liberar();
      senha.value = '';
      botao.disabled = true;
      aviso.textContent = erro.message;
      aviso.hidden = false;
      senha.focus();
    }
  });
}

function mostrarQuemEsta() {
  const raiz = novaTela('tela-quem');
  const nomes = (estadoEquipe.dados && estadoEquipe.dados.config.nomes_equipe) || lerLocal(CHAVES.nomesEquipe, []);
  raiz.innerHTML = `
    <div class="entrar">
      <h1 class="titulo-tela">Quem está usando?</h1>
      <p class="texto-suave">Seu nome fica anotado em tudo o que você fizer aqui, para a equipe saber quem fez o quê.</p>
    </div>
    <div class="grade-nomes entrar" style="--ordem:1">
      ${nomes.map(n => `<button type="button" class="botao botao-contorno botao-nome" data-nome="${esc(n)}">${esc(n)}</button>`).join('')}
    </div>
    <form class="card entrar" id="form-outra" style="--ordem:2" novalidate>
      <label class="campo-rotulo" for="outra-pessoa">Outra pessoa</label>
      <input class="campo-entrada" id="outra-pessoa" maxlength="40" placeholder="Escreva seu nome" autocomplete="given-name">
      <button type="submit" class="botao botao-largo" disabled>Continuar</button>
    </form>
    <button type="button" class="link-discreto" id="sair-quem">Sair da área da equipe</button>`;
  const campo = $('#outra-pessoa', raiz);
  const continuar = $('#form-outra button', raiz);
  campo.addEventListener('input', () => { continuar.disabled = campo.value.trim().length < 2; });
  $('.grade-nomes', raiz).addEventListener('click', evento => {
    const botao = evento.target.closest('[data-nome]');
    if (botao) escolherNome(botao, botao.dataset.nome);
  });
  $('#form-outra', raiz).addEventListener('submit', evento => {
    evento.preventDefault();
    if (campo.value.trim().length >= 2) escolherNome(continuar, campo.value.trim());
  });
  $('#sair-quem', raiz).addEventListener('click', sairDaEquipe);
}

async function escolherNome(botao, nome) {
  const liberar = botaoOcupado(botao, 'Só um instante…');
  try {
    const resposta = await chamarEquipe('definirNome', { nome });
    guardarNomeNaEquipe(resposta.nome);
    vibrar();
    irPara('#equipe');
  } catch (erro) {
    liberar();
    mostrarErro(erro);
  }
}

async function sairDaEquipe(evento) {
  const botao = evento && evento.currentTarget;
  if (botao && botao.disabled) return;
  if (botao) botaoOcupado(botao, 'Saindo…');
  try {
    await chamarEquipe('sairEquipe');
  } catch (erro) {
    console.warn('Não deu para avisar o servidor da saída; o token vence sozinho em 12 horas.');
  }
  apagarSessaoEquipe();
  estadoEquipe.dados = null;
  mostrarToast('Você saiu da área da equipe.', '', '👋');
  irPara('#vitrine');
}

function topoEquipe() {
  return `
    <header class="topo-equipe">
      <p>Você está como: <strong>${esc(nomeNaEquipe())}</strong>
        <a class="link-trocar" href="#equipe/quem">trocar</a></p>
      <button type="button" class="botao botao-pequeno botao-contorno" data-sair>
        <i class="ph-duotone ph-sign-out" aria-hidden="true"></i> Sair</button>
    </header>`;
}

function ligarTopoEquipe(raiz) {
  $('[data-sair]', raiz).addEventListener('click', sairDaEquipe);
}

function telaDaEquipe(classe, titulo) {
  const raiz = novaTela(`tela-equipe ${classe}`);
  raiz.innerHTML = `${topoEquipe()}
    <a class="link-voltar" href="#equipe"><i class="ph-duotone ph-arrow-left" aria-hidden="true"></i> Voltar ao painel</a>
    <h1 class="titulo-tela">${titulo}</h1>
    <div class="corpo-tela"></div>`;
  ligarTopoEquipe(raiz);
  definirPuxarParaAtualizar(async () => {
    try {
      await carregarDadosEquipe();
      aplicarResposta(null);
    } catch (erro) {
      mostrarErro(erro);
    }
  });
  return { raiz, corpo: $('.corpo-tela', raiz) };
}
