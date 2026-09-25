function mostrarPainel() {
  const raiz = novaTela('tela-equipe tela-painel');
  desenharPainel(raiz, true);
  definirPuxarParaAtualizar(() => atualizarPainel(raiz));
  atualizarPainel(raiz);
}

async function atualizarPainel(raiz) {
  try {
    await carregarDadosEquipe();
    if (raiz.isConnected) desenharPainel(raiz, false);
  } catch (erro) {
    if (erro.codigo !== 'SESSAO' && erro.codigo !== 'SEM_NOME') mostrarErro(erro);
  }
}

function contagensDoPainel(dados) {
  return {
    chegaram: dados.itens.filter(i => i.situacao === 'AGUARDANDO').length,
    esperando: dados.reservas.filter(r => r.situacao === 'AGUARDANDO').length,
    vitrine: dados.itens.filter(i => i.situacao === 'DISPONIVEL' && i.visivel === 'SIM').length
  };
}

function desenharPainel(raiz, animar) {
  const dados = estadoEquipe.dados;
  const conta = contagensDoPainel(dados);
  const cartao = (href, destaque, emoji, numero, rotulo, ordem) => `
    <a class="cartao-painel ${destaque ? 'cartao-painel-destaque' : ''} ${animar ? 'entrar' : ''}" href="${href}" style="--ordem:${ordem}">
      <span class="emoji" aria-hidden="true">${emoji}</span>
      ${numero === null ? '<span class="numero-destaque" aria-hidden="true"><i class="ph ph-gear-six"></i></span>'
        : `<span class="numero-destaque" data-numero="${numero}">${animar ? 0 : numero}</span>`}
      <span class="cartao-painel-rotulo">${rotulo}</span>
    </a>`;
  raiz.innerHTML = `${topoEquipe()}
    <h1 class="titulo-tela">Olá, ${esc(primeiroNome(nomeNaEquipe()))}! 👋</h1>
    ${avisoDeAjustesPendentes(dados.config)}
    <div class="grade-painel">
      ${cartao('#equipe/chegaram', false, '📥', conta.chegaram, 'CHEGARAM<br>para conferir', 0)}
      ${cartao('#equipe/reservas', false, '⏳', conta.esperando, 'ESPERANDO<br>retirada', 1)}
      ${cartao('#equipe/itens/vitrine', false, '🏠', conta.vitrine, 'NA VITRINE<br>agora', 2)}
      ${cartao('#equipe/ajustes', true, '', null, 'AJUSTES<br>do bazar', 3)}
    </div>
    <button type="button" class="botao botao-largo botao-cadastrar ${animar ? 'entrar' : ''}" style="--ordem:4" id="cadastrar-novo">
      <i class="ph-duotone ph-plus-circle" aria-hidden="true"></i> CADASTRAR ITEM NOVO</button>
    <nav class="lista-atalhos" aria-label="Outras telas da equipe">
      ${atalho('#equipe/itens', '📦', 'Todos os itens', 'Editar, trocar foto, esconder, arquivar')}
      ${atalho('#equipe/pessoas', '👥', 'Pessoas', 'Quem doou, quem reservou, banimentos')}
      ${atalho('#equipe/categorias', '🏷️', 'Categorias', 'Criar, reordenar, desativar')}
      ${atalho('#equipe/relatorio', '📊', 'Relatório do mês', 'Quanto chegou e quanto foi entregue')}
      ${atalho('#equipe/registro', '📜', 'Registro de ações', 'Quem fez o quê, e quando')}
    </nav>`;
  ligarTopoEquipe(raiz);
  $('#cadastrar-novo', raiz).addEventListener('click', () => {
    history.pushState(null, '', '#equipe/cadastrar');
    mostrarCadastroRapido(true);
  });
  $$('[data-numero]', raiz).forEach(el => { if (animar) animarNumero(el, el.dataset.numero); });
}

function avisoDeAjustesPendentes(config) {
  const faltando = [];
  if (!config.telefone_instituicao) faltando.push('o WhatsApp da instituição');
  if (!config.nomes_equipe.length) faltando.push('os nomes da equipe');
  if (!faltando.length) return '';
  return atalho('#equipe/ajustes', '📝', 'Falta completar os ajustes', `Coloque ${faltando.join(' e ')}.`, 'atalho-pendente');
}

function atalho(href, emoji, titulo, subtitulo, classe = '') {
  return `
    <a class="atalho ${classe}" href="${href}">
      <span class="emoji" aria-hidden="true">${emoji}</span>
      <span><strong>${titulo}</strong><br><span class="texto-suave">${subtitulo}</span></span>
      <i class="ph-duotone ph-caret-right" aria-hidden="true"></i>
    </a>`;
}
