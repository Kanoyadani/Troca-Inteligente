const cadastro = { foto: '', categoria: '', nome: '', nomeMexido: false, descricao: '', doador: '' };

function mostrarCadastroRapido(abrirCamera) {
  const { corpo } = telaDaEquipe('tela-cadastro', '➕ Cadastrar item');
  const categorias = estadoEquipe.dados.config.categorias.filter(c => c.ativa !== false);
  if (!categorias.some(c => c.id === cadastro.categoria)) cadastro.categoria = '';
  corpo.innerHTML = `
    <form id="form-cadastro" novalidate>
      <div class="campo" id="cad-campo-foto">
        <span class="campo-rotulo">1. Foto</span>
        <button type="button" class="area-foto" id="cad-botao-foto"></button>
        ${campoDeFoto('cad-entrada-foto')}
        <span class="campo-lembrete">Falta a foto: toque no quadro.</span>
      </div>
      <div class="campo" id="cad-campo-categoria">
        <span class="campo-rotulo" id="cad-rotulo-categoria">2. Categoria</span>
        <div class="grade-categorias" role="radiogroup" aria-labelledby="cad-rotulo-categoria">
          ${categorias.map(c => `<button type="button" class="opcao-categoria" role="radio" aria-checked="false"
            data-categoria="${esc(c.id)}" style="${coresDaCategoria(c)}"><span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>${esc(c.nome)}</button>`).join('')}
        </div>
        <span class="campo-lembrete">Falta a categoria: toque numa delas.</span>
      </div>
      <details class="card detalhar">
        <summary>✏️ Quer detalhar mais?</summary>
        <div class="campo"><label class="campo-rotulo" for="cad-nome">Nome do item</label>
          <input class="campo-entrada" id="cad-nome" maxlength="60"></div>
        <div class="campo"><label class="campo-rotulo" for="cad-descricao">Descrição</label>
          <textarea class="campo-entrada" id="cad-descricao" maxlength="500" placeholder="Tamanho, cor, estado…"></textarea></div>
        <div class="campo"><label class="campo-rotulo" for="cad-doador">Quem doou (opcional)</label>
          <input class="campo-entrada" id="cad-doador" maxlength="60" placeholder="${esc(estadoEquipe.dados.config.nome_bazar)}"></div>
      </details>
      <button type="submit" class="botao botao-sucesso botao-largo" id="cad-salvar" disabled>💾 3. Salvar</button>
    </form>`;

  const entrada = $('#cad-entrada-foto', corpo);
  $('#cad-botao-foto', corpo).addEventListener('click', () => entrada.click());
  ligarEntradaDeFoto(entrada, foto => { cadastro.foto = foto; conferirCadastro(corpo); });
  $('.grade-categorias', corpo).addEventListener('click', evento => {
    const opcao = evento.target.closest('[data-categoria]');
    if (!opcao) return;
    cadastro.categoria = opcao.dataset.categoria;
    if (!cadastro.nomeMexido) cadastro.nome = categoriaPorId(cadastro.categoria, categorias).nome;
    conferirCadastro(corpo);
  });
  $('#cad-nome', corpo).addEventListener('input', e => { cadastro.nome = e.target.value; cadastro.nomeMexido = true; conferirCadastro(corpo, false); });
  $('#cad-descricao', corpo).addEventListener('input', e => { cadastro.descricao = e.target.value; });
  $('#cad-doador', corpo).addEventListener('input', e => { cadastro.doador = e.target.value; });
  $('#form-cadastro', corpo).addEventListener('submit', evento => {
    evento.preventDefault();
    salvarCadastro(corpo);
  });
  conferirCadastro(corpo);
  if (abrirCamera) entrada.click();
}

function conferirCadastro(corpo, reescreverNome = true) {
  const ok = Boolean(cadastro.foto) && Boolean(cadastro.categoria) && cadastro.nome.trim().length >= 2;
  $('#cad-campo-foto', corpo).classList.toggle('campo-ok', Boolean(cadastro.foto));
  $('#cad-campo-categoria', corpo).classList.toggle('campo-ok', Boolean(cadastro.categoria));
  $('#cad-botao-foto', corpo).innerHTML = cadastro.foto
    ? `<img src="${esc(cadastro.foto)}" alt="Foto escolhida"><span class="area-foto-trocar">📸 Trocar foto</span>`
    : '<span class="emoji" aria-hidden="true">📸</span><strong>Tirar foto</strong><span>Toque aqui para abrir a câmera</span>';
  $$('.opcao-categoria', corpo).forEach(opcao => {
    const marcada = opcao.dataset.categoria === cadastro.categoria;
    opcao.classList.toggle('selecionada', marcada);
    opcao.setAttribute('aria-checked', String(marcada));
  });
  if (reescreverNome) $('#cad-nome', corpo).value = cadastro.nome;
  $('#cad-descricao', corpo).value = cadastro.descricao;
  $('#cad-doador', corpo).value = cadastro.doador;
  $('#cad-salvar', corpo).disabled = !ok;
}

async function salvarCadastro(corpo) {
  const botao = $('#cad-salvar', corpo);
  if (botao.disabled) return;
  const liberar = botaoOcupado(botao, 'Salvando…');
  try {
    const resposta = await chamarEquipe('cadastrarItem', {
      foto: cadastro.foto, categoria: cadastro.categoria, nome: cadastro.nome,
      descricao: cadastro.descricao, doador_nome: cadastro.doador
    }, { tempoLimite: CONFIG.TEMPO_LIMITE_FOTO_MS });
    estadoEquipe.dados = resposta.dados;
    vibrar();
    Object.assign(cadastro, { foto: '', descricao: '', nomeMexido: false,
      nome: categoriaPorId(cadastro.categoria, estadoEquipe.dados.config.categorias).nome });
    if (corpo.isConnected) mostrarCadastroFeito(corpo, resposta.codigo);
  } catch (erro) {
    if (corpo.isConnected) { liberar(); conferirCadastro(corpo); }
    mostrarErro(erro);
  }
}

function mostrarCadastroFeito(corpo, codigo) {
  corpo.innerHTML = `
    <div class="card cartao-sucesso entrar">
      <p class="emoji-grande" aria-hidden="true">✅</p>
      <h2>Pronto! ${esc(codigo)} já está na vitrine.</h2>
    </div>
    <div class="pilha-botoes entrar" style="--ordem:1">
      <button type="button" class="botao botao-sucesso botao-largo" id="outro-parecido">📸 Cadastrar outro parecido</button>
      <a class="botao botao-contorno botao-largo" href="#equipe">🏠 Voltar ao painel</a>
    </div>`;
  $('#outro-parecido', corpo).addEventListener('click', () => mostrarCadastroRapido(true));
}
