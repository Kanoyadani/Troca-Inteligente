const EMOJIS_CATEGORIA = ['👕', '👟', '✏️', '🧸', '📚', '🏠', '👜', '🧥', '👶', '🎒', '🍼', '🛏️', '🍳', '🪑', '💡', '📱',
  '🎮', '⚽', '🚲', '🧴', '💊', '🎨', '🧶', '🎁'];
const CORES_CATEGORIA = ['#FF6B35', '#7B61FF', '#2EC4B6', '#EF476F', '#118AB2', '#06D6A0', '#FFD166', '#8D6E63'];

function mostrarCategorias() {
  const { corpo } = telaDaEquipe('tela-categorias', '🏷️ Categorias');
  const categorias = estadoEquipe.dados.config.categorias;
  corpo.innerHTML = `
    <p class="texto-suave">Arraste pela alça ⠿ ou use Subir e Descer para mudar a ordem. A vitrine segue esta ordem.</p>
    <ul class="lista-categorias" id="lista-categorias">
      ${categorias.map((c, i) => linhaDeCategoria(c, i, categorias.length)).join('')}
    </ul>
    <button type="button" class="botao botao-sucesso botao-largo" id="nova-categoria">➕ Nova categoria</button>`;
  const lista = $('#lista-categorias', corpo);
  lista.addEventListener('click', tratarCliqueNaCategoria);
  ligarArrastar(lista);
  $('#nova-categoria', corpo).addEventListener('click', () => editarCategoria(null));
}

function linhaDeCategoria(categoria, indice, total) {
  const quantidade = estadoEquipe.dados.itens.filter(i => i.categoria === categoria.id).length;
  const id = esc(categoria.id);
  const inativa = categoria.ativa === false;
  return `
    <li class="linha-categoria ${inativa ? 'categoria-inativa' : ''}" data-id="${id}" style="--cor:${esc(categoria.cor)}">
      <span class="alca" aria-hidden="true">⠿</span>
      <span class="emoji" aria-hidden="true">${esc(categoria.emoji)}</span>
      <span class="linha-categoria-nome"><strong>${esc(categoria.nome)}</strong><br>
        <span class="texto-suave">${quantidade} ${quantidade === 1 ? 'item' : 'itens'}${inativa ? ' · desativada' : ''}</span></span>
      <span class="grade-acoes">
        <button type="button" class="botao botao-pequeno botao-contorno" data-mover="-1" ${indice === 0 ? 'disabled' : ''}>⬆️ Subir</button>
        <button type="button" class="botao botao-pequeno botao-contorno" data-mover="1" ${indice === total - 1 ? 'disabled' : ''}>⬇️ Descer</button>
        <button type="button" class="botao botao-pequeno botao-contorno" data-categoria-acao="editar">✏️ Editar</button>
        ${inativa ? '<button type="button" class="botao botao-pequeno botao-sucesso" data-categoria-acao="reativar">✅ Reativar</button>'
          : '<button type="button" class="botao botao-pequeno botao-contorno" data-categoria-acao="desativar">🚫 Desativar</button>'}
      </span>
    </li>`;
}

function categoriasNaOrdemDaTela(lista) {
  const todas = estadoEquipe.dados.config.categorias;
  return $$('.linha-categoria', lista).map(li => todas.find(c => c.id === li.dataset.id));
}

async function salvarCategorias(categorias, mensagem) {
  const lista = $('#lista-categorias');
  if (lista) lista.classList.add('salvando');
  try {
    aplicarResposta(await chamarEquipe('salvarCategorias', { categorias }));
    vibrar();
    if (mensagem) mostrarToast(mensagem, 'sucesso', '🏷️');
  } catch (erro) {
    mostrarErro(erro);
    aplicarResposta(null);
  }
}

function tratarCliqueNaCategoria(evento) {
  const linha = evento.target.closest('.linha-categoria');
  if (!linha) return;
  const lista = linha.parentElement;
  if (lista.classList.contains('salvando')) return;
  const categoria = estadoEquipe.dados.config.categorias.find(c => c.id === linha.dataset.id);
  const mover = evento.target.closest('[data-mover]');
  if (mover) {
    const vizinha = mover.dataset.mover === '-1' ? linha.previousElementSibling : linha.nextElementSibling;
    if (!vizinha) return;
    lista.insertBefore(linha, mover.dataset.mover === '-1' ? vizinha : vizinha.nextElementSibling);
    salvarCategorias(categoriasNaOrdemDaTela(lista), 'Ordem salva.');
    return;
  }
  const acao = evento.target.closest('[data-categoria-acao]');
  if (!acao) return;
  if (acao.dataset.categoriaAcao === 'editar') editarCategoria(categoria);
  if (acao.dataset.categoriaAcao === 'desativar') desativarCategoria(categoria);
  if (acao.dataset.categoriaAcao === 'reativar') {
    const todas = estadoEquipe.dados.config.categorias.map(c => (c.id === categoria.id ? { ...c, ativa: true } : c));
    salvarCategorias(todas, `${categoria.nome} voltou a aparecer.`);
  }
}

function ligarArrastar(lista) {
  let arrastada = null;
  let ordemAntes = '';
  const ordemAtual = () => $$('.linha-categoria', lista).map(li => li.dataset.id).join('|');
  lista.addEventListener('pointerdown', evento => {
    if (!evento.target.closest('.alca') || lista.classList.contains('salvando')) return;
    ordemAntes = ordemAtual();
    arrastada = evento.target.closest('.linha-categoria');
    arrastada.classList.add('arrastando');
    try { lista.setPointerCapture(evento.pointerId); } catch (erro) { console.warn('Arrastar sem captura do ponteiro.'); }
    evento.preventDefault();
  });
  lista.addEventListener('pointermove', evento => {
    if (!arrastada) return;
    const outras = $$('.linha-categoria:not(.arrastando)', lista);
    const antesDe = outras.find(li => evento.clientY < li.getBoundingClientRect().top + li.offsetHeight / 2);
    lista.insertBefore(arrastada, antesDe || null);
  });
  const soltar = () => {
    if (!arrastada) return;
    arrastada.classList.remove('arrastando');
    arrastada = null;
    if (ordemAtual() !== ordemAntes) salvarCategorias(categoriasNaOrdemDaTela(lista), 'Ordem salva.');
  };
  lista.addEventListener('pointerup', soltar);
  lista.addEventListener('pointercancel', soltar);
}

async function editarCategoria(categoria) {
  const atual = categoria || { nome: '', emoji: EMOJIS_CATEGORIA[0], cor: CORES_CATEGORIA[0] };
  const { valor, campos } = await abrirDialogo({
    titulo: categoria ? `Editar ${categoria.nome}` : 'Nova categoria',
    corpo: `
      <div class="campo"><label class="campo-rotulo" for="cat-nome">Nome</label>
        <input class="campo-entrada" id="cat-nome" name="nome" maxlength="30" value="${esc(atual.nome)}"></div>
      <fieldset class="campo"><legend class="campo-rotulo">Ícone</legend>
        <div class="grade-emojis">${EMOJIS_CATEGORIA.map(e => `<label class="opcao-emoji"><input type="radio" name="emoji" value="${e}"
          ${e === atual.emoji ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div></fieldset>
      <fieldset class="campo"><legend class="campo-rotulo">Cor</legend>
        <div class="grade-cores">${CORES_CATEGORIA.map(c => `<label class="opcao-cor" style="--cor:${c}"><input type="radio" name="cor" value="${c}"
          ${c === String(atual.cor).toUpperCase() ? 'checked' : ''}><span aria-label="cor ${c}"></span></label>`).join('')}</div></fieldset>`,
    botoes: [{ texto: '💾 Salvar', valor: true, classe: 'botao-sucesso' }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }],
    validar: form => $('#cat-nome', form).value.trim().length >= 2 && Boolean(new FormData(form).get('emoji')) && Boolean(new FormData(form).get('cor'))
  });
  if (!valor) return;
  const todas = estadoEquipe.dados.config.categorias;
  const nova = { ...(categoria || { ativa: true }), nome: campos.nome.trim(), emoji: campos.emoji, cor: campos.cor };
  const lista = categoria ? todas.map(c => (c.id === categoria.id ? nova : c)) : todas.concat([nova]);
  salvarCategorias(lista, categoria ? 'Categoria atualizada.' : 'Categoria criada.');
}

async function desativarCategoria(categoria) {
  const dentro = estadoEquipe.dados.itens.filter(i => i.categoria === categoria.id).length;
  const destinos = estadoEquipe.dados.config.categorias.filter(c => c.ativa !== false && c.id !== categoria.id);
  if (!destinos.length) {
    mostrarToast('Deixe pelo menos uma categoria ativa. Crie outra antes de desativar esta.', 'atencao', '🏷️');
    return;
  }
  const { valor, campos } = await abrirDialogo({
    titulo: `Desativar ${categoria.nome}?`,
    corpo: dentro
      ? `<p>Tem <strong>${dentro} ${dentro === 1 ? 'item' : 'itens'}</strong> nessa categoria. Para qual categoria ${dentro === 1 ? 'ele vai' : 'eles vão'}?</p>
        <select class="campo-entrada" name="mover_para">${destinos.map(c => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nome)}</option>`).join('')}</select>`
      : '<p>Ela some da vitrine e da tela de doação. Dá para reativar depois.</p>',
    botoes: [{ texto: dentro ? 'Mover e desativar' : 'Desativar', valor: true, classe: 'botao-perigo' },
      { texto: 'Voltar', valor: null, classe: 'botao-contorno' }]
  });
  if (!valor) return;
  $('#lista-categorias').classList.add('salvando');
  try {
    aplicarResposta(await chamarEquipe('desativarCategoria', { id: categoria.id, mover_para: campos.mover_para || '' }));
    vibrar();
    mostrarToast(`Categoria ${categoria.nome} desativada.`, 'sucesso', '🏷️');
  } catch (erro) {
    mostrarErro(erro);
    aplicarResposta(null);
  }
}
