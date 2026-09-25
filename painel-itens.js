const FILTROS_ITENS = {
  tudo: ['Tudo', i => i.situacao !== 'ARQUIVADO'],
  vitrine: ['Só na vitrine', i => i.situacao === 'DISPONIVEL' && i.visivel === 'SIM'],
  escondidos: ['Só escondidos', i => i.situacao === 'DISPONIVEL' && i.visivel !== 'SIM'],
  arquivados: ['Arquivados', i => i.situacao === 'ARQUIVADO']
};
let buscaItens = '';

function mostrarItens(filtro) {
  const ativo = FILTROS_ITENS[filtro] ? filtro : 'tudo';
  const { corpo } = telaDaEquipe('tela-itens', '📦 Itens');
  corpo.innerHTML = `
    <label class="busca"><i class="ph-duotone ph-magnifying-glass" aria-hidden="true"></i>
      <input type="search" id="busca-itens" placeholder="Nome, código ou quem doou" aria-label="Procurar item" value="${esc(buscaItens)}"></label>
    <div class="pilulas" role="group" aria-label="Filtro">
      ${Object.entries(FILTROS_ITENS).map(([id, [rotulo]]) => `<a class="pilula ${id === ativo ? 'ativa' : ''}"
        href="#equipe/itens/${id}" aria-current="${id === ativo}">${rotulo}</a>`).join('')}
    </div>
    <div class="lista" id="lista-itens"></div>`;
  const desenhar = () => desenharListaDeItens($('#lista-itens', corpo), ativo);
  $('#busca-itens', corpo).addEventListener('input', e => { buscaItens = e.target.value; desenhar(); });
  $('#lista-itens', corpo).addEventListener('click', tratarCliqueNoItem);
  $('#lista-itens', corpo).addEventListener('change', evento => {
    const chave = evento.target.closest('[data-visivel]');
    if (chave) mudarVisibilidade(chave);
  });
  desenhar();
}

function desenharListaDeItens(lista, filtro) {
  const termo = normalizarBusca(buscaItens.trim());
  const itens = estadoEquipe.dados.itens.filter(FILTROS_ITENS[filtro][1])
    .filter(i => !termo || normalizarBusca(`${i.nome} ${i.codigo} ${i.doador_nome} ${i.descricao}`).includes(termo))
    .reverse();
  if (!itens.length) {
    const frases = {
      tudo: 'Nenhum item por aqui ainda. Que tal cadastrar o primeiro?',
      vitrine: 'Nada na vitrine agora. Que tal cadastrar um item?',
      escondidos: 'Nenhum item escondido. Tudo o que está livre aparece na vitrine.',
      arquivados: 'Nenhum item arquivado.'
    };
    lista.innerHTML = termo
      ? telaVazia({ ilustracao: 'busca', frase: 'Nenhum item com essa busca. Tente outra palavra.' })
      : telaVazia({ ilustracao: 'caixa', frase: frases[filtro],
        botaoTexto: filtro === 'tudo' || filtro === 'vitrine' ? '➕ Cadastrar item' : '', botaoHref: '#equipe/cadastrar' });
    return;
  }
  lista.innerHTML = itens.slice(0, 200).map((item, i) => cartaoDeItem(item, i)).join('')
    + (itens.length > 200 ? '<p class="texto-suave centro">Mostrando os 200 mais recentes. Use a busca para achar os outros.</p>' : '');
}

function cartaoDeItem(item, ordem) {
  const categoria = categoriaPorId(item.categoria, estadoEquipe.dados.config.categorias);
  const disponivel = item.situacao === 'DISPONIVEL';
  const arquivado = item.situacao === 'ARQUIVADO';
  const codigo = esc(item.codigo);
  return `
    <article class="card cartao-item-equipe entrar" style="--ordem:${Math.min(ordem, 8)}">
      <div class="cartao-item-topo">
        <img class="linha-lista-foto" src="${esc(urlDeFoto(item.foto_url))}" alt="" loading="lazy">
        <div>
          <h3>${esc(item.nome)}</h3>
          <p class="texto-suave">${codigo} · ${esc(categoria.emoji)} ${esc(categoria.nome)} · ${esc(item.doador_nome)}</p>
          ${etiqueta(ROTULOS_ITEM, item.situacao, disponivel ? (item.visivel === 'SIM' ? 'Na vitrine' : 'Escondido') : '')}
        </div>
      </div>
      ${disponivel ? `<label class="interruptor"><input type="checkbox" data-visivel="${codigo}" ${item.visivel === 'SIM' ? 'checked' : ''}>
        <span class="interruptor-trilho"></span> 👁️ Aparece na vitrine</label>` : ''}
      <div class="grade-acoes">
        ${item.situacao === 'AGUARDANDO' ? `<a class="botao botao-pequeno botao-atencao" href="#equipe/chegaram">📥 Conferir</a>` : ''}
        <button type="button" class="botao botao-pequeno botao-contorno" data-acao="editar" data-codigo="${codigo}">✏️ Editar</button>
        <button type="button" class="botao botao-pequeno botao-contorno" data-acao="foto" data-codigo="${codigo}">📸 Trocar foto</button>
        ${disponivel ? `<button type="button" class="botao botao-pequeno botao-contorno" data-acao="reservar" data-codigo="${codigo}">🙋 Reservar para alguém</button>` : ''}
        ${arquivado
          ? `<button type="button" class="botao botao-pequeno botao-contorno" data-acao="desarquivar" data-codigo="${codigo}">↩️ Tirar do arquivo</button>`
          : (item.situacao !== 'RESERVADO' ? `<button type="button" class="botao botao-pequeno botao-contorno" data-acao="arquivar" data-codigo="${codigo}">📦 Arquivar</button>` : '')}
      </div>
    </article>`;
}

function tratarCliqueNoItem(evento) {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const item = estadoEquipe.dados.itens.find(i => i.codigo === botao.dataset.codigo);
  if (!item) return;
  const acoes = {
    editar: () => editarItem(item, botao),
    foto: () => trocarFotoDoItem(item, botao),
    reservar: () => reservarParaAlguem(item, botao),
    arquivar: () => arquivarItem(item, botao),
    desarquivar: () => desarquivarItem(item, botao)
  };
  acoes[botao.dataset.acao]();
}

async function executarNoItem(botao, acao, dados, textoOcupado, opcoes = {}) {
  const liberar = botao ? botaoOcupado(botao, textoOcupado) : () => {};
  try {
    const resposta = await chamarEquipe(acao, dados, opcoes);
    vibrar();
    aplicarResposta(resposta);
    return resposta;
  } catch (erro) {
    liberar();
    mostrarErro(erro);
    return null;
  }
}

async function mudarVisibilidade(chave) {
  chave.disabled = true;
  const resposta = await executarNoItem(null, 'mudarVisibilidade', { codigo: chave.dataset.visivel, visivel: chave.checked });
  if (resposta) mostrarToast(chave.checked ? 'Agora aparece na vitrine.' : 'Escondido da vitrine.', 'sucesso', '👁️');
  else if (chave.isConnected) { chave.checked = !chave.checked; chave.disabled = false; }
}

async function arquivarItem(item, botao) {
  const resposta = await executarNoItem(botao, 'arquivarItem', { codigo: item.codigo }, 'Arquivando…');
  if (resposta) oferecerDesfazer(`${item.nome} foi arquivado.`, resposta);
}

async function desarquivarItem(item, botao) {
  const resposta = await executarNoItem(botao, 'desarquivarItem', { codigo: item.codigo }, 'Tirando…');
  if (resposta) mostrarToast('Voltou para a lista, escondido. Ligue o 👁️ para aparecer na vitrine.', 'sucesso', '↩️');
}

async function editarItem(item, botao) {
  const categorias = estadoEquipe.dados.config.categorias.filter(c => c.ativa !== false || c.id === item.categoria);
  const doEquipe = !String(item.doador_id).startsWith('U-');
  const { valor, campos } = await abrirDialogo({
    titulo: `Editar ${item.codigo}`,
    corpo: `
      <div class="campo"><label class="campo-rotulo" for="ed-nome">Nome</label>
        <input class="campo-entrada" id="ed-nome" name="nome" maxlength="60" value="${esc(item.nome)}"></div>
      <div class="campo"><label class="campo-rotulo" for="ed-descricao">Descrição</label>
        <textarea class="campo-entrada" id="ed-descricao" name="descricao" maxlength="500">${esc(item.descricao)}</textarea></div>
      <div class="campo"><label class="campo-rotulo" for="ed-categoria">Categoria</label>
        <select class="campo-entrada" id="ed-categoria" name="categoria">${categorias.map(c =>
          `<option value="${esc(c.id)}" ${c.id === item.categoria ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.nome)}</option>`).join('')}</select></div>
      ${doEquipe ? `<div class="campo"><label class="campo-rotulo" for="ed-doador">Quem doou</label>
        <input class="campo-entrada" id="ed-doador" name="doador_nome" maxlength="60" value="${esc(item.doador_nome)}"></div>` : ''}`,
    botoes: [{ texto: '💾 Salvar', valor: true, classe: 'botao-sucesso' }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }],
    validar: form => $('#ed-nome', form).value.trim().length >= 2
  });
  if (!valor) return;
  const resposta = await executarNoItem(botao, 'editarItem', { codigo: item.codigo, ...campos }, 'Salvando…');
  if (resposta) mostrarToast('Item atualizado.', 'sucesso', '✏️');
}

function trocarFotoDoItem(item, botao) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'image/*';
  entrada.setAttribute('capture', 'environment');
  ligarEntradaDeFoto(entrada, async foto => {
    const resposta = await executarNoItem(botao.isConnected ? botao : null, 'trocarFoto', { codigo: item.codigo, foto }, 'Enviando a foto…',
      { tempoLimite: CONFIG.TEMPO_LIMITE_FOTO_MS });
    if (resposta) mostrarToast('Foto trocada.', 'sucesso', '📸');
  });
  entrada.click();
}
