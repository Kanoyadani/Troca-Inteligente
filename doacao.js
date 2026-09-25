const MINIMO_DESCRICAO = 15;

function mostrarFormularioDoacao() {
  const raiz = novaTela('tela-doacao');
  if (!categoriasPublicas().some(c => c.id === rascunho.categoria)) rascunho.categoria = '';
  raiz.innerHTML = `
    <h1 class="titulo-tela">Doar um item</h1>
    <p class="texto-suave">Depois de enviar, a equipe confere e o item aparece na vitrine.</p>
    <ol class="progresso-doacao" id="progresso" aria-label="Passos da doação">
      <li data-passo="foto">Foto</li>
      <li data-passo="oque">O que é</li>
      <li data-passo="categoria">Categoria</li>
    </ol>
    <form id="form-doacao" novalidate>
      <div class="campo" id="campo-foto">
        <span class="campo-rotulo" id="rotulo-foto">Foto do item</span>
        <div id="area-foto-conteudo"></div>
        ${campoDeFoto('entrada-foto')}
        <span class="campo-lembrete" id="lembrete-foto">Falta a foto: toque no quadro para tirar.</span>
      </div>
      <div class="campo" id="campo-nome-item">
        <label class="campo-rotulo" for="nome-item">Nome do item</label>
        <input class="campo-entrada" id="nome-item" maxlength="60" placeholder="Ex.: Casaco de lã azul" value="${esc(rascunho.nome)}">
        <span class="campo-lembrete">Falta o nome: escreva o que é o item.</span>
      </div>
      <div class="campo" id="campo-descricao">
        <label class="campo-rotulo" for="descricao">Descrição</label>
        <textarea class="campo-entrada" id="descricao" maxlength="500" aria-describedby="contador-descricao"
          placeholder="Ex.: Tamanho M, pouco usado, sem manchas.">${esc(rascunho.descricao)}</textarea>
        <span class="contador-gentil" id="contador-descricao" aria-live="polite"></span>
      </div>
      <div class="campo" id="campo-categoria">
        <span class="campo-rotulo" id="rotulo-categoria">Categoria</span>
        <div class="grade-categorias" role="radiogroup" aria-labelledby="rotulo-categoria">
          ${categoriasPublicas().map(c => `
            <button type="button" class="opcao-categoria" role="radio" data-categoria="${esc(c.id)}" style="${coresDaCategoria(c)}"
              aria-checked="false"><span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>${esc(c.nome)}</button>`).join('')}
        </div>
        <span class="campo-lembrete">Falta a categoria: toque numa delas.</span>
      </div>
      <button type="submit" class="botao botao-doar botao-largo" id="enviar-doacao" disabled>
        <i class="ph-duotone ph-paper-plane-tilt" aria-hidden="true"></i> Enviar doação</button>
    </form>`;

  $('#campo-foto', raiz).addEventListener('click', evento => {
    if (evento.target.closest('[data-escolher-foto]')) $('#entrada-foto', raiz).click();
  });
  ligarEntradaDeFoto($('#entrada-foto', raiz), foto => { rascunho.foto = foto; aoMudarDoacao(raiz, true); });
  $('#nome-item', raiz).addEventListener('input', e => { rascunho.nome = e.target.value; aoMudarDoacao(raiz); });
  $('#descricao', raiz).addEventListener('input', e => { rascunho.descricao = e.target.value; aoMudarDoacao(raiz); });
  $('.grade-categorias', raiz).addEventListener('click', evento => {
    const opcao = evento.target.closest('[data-categoria]');
    if (!opcao) return;
    rascunho.categoria = opcao.dataset.categoria;
    aoMudarDoacao(raiz);
  });
  $('#form-doacao', raiz).addEventListener('submit', evento => {
    evento.preventDefault();
    enviarDoacao(raiz);
  });
  desenharFoto(raiz);
  conferirDoacao(raiz);
}

function aoMudarDoacao(raiz, fotoMudou = false) {
  guardarRascunho();
  if (fotoMudou) desenharFoto(raiz);
  conferirDoacao(raiz);
}

function desenharFoto(raiz) {
  $('#area-foto-conteudo', raiz).innerHTML = rascunho.foto
    ? `<div class="miniatura-foto">
        <img src="${esc(rascunho.foto)}" alt="Foto escolhida">
        <div class="miniatura-texto">
          <p>Foto escolhida ✓</p>
          <button type="button" class="botao botao-pequeno botao-contorno" data-escolher-foto>📸 Trocar foto</button>
        </div>
      </div>`
    : `<button type="button" class="area-foto" data-escolher-foto aria-describedby="lembrete-foto">
        <span class="emoji" aria-hidden="true">📸</span><strong>Tirar foto</strong><span>Toque aqui para abrir a câmera</span>
      </button>`;
}

function conferirDoacao(raiz) {
  const faltamLetras = Math.max(0, MINIMO_DESCRICAO - rascunho.descricao.trim().length);
  const certo = {
    foto: Boolean(rascunho.foto),
    nome: rascunho.nome.trim().length >= 2,
    descricao: faltamLetras === 0,
    categoria: Boolean(rascunho.categoria)
  };
  $('#campo-foto', raiz).classList.toggle('campo-ok', certo.foto);
  $('#campo-nome-item', raiz).classList.toggle('campo-ok', certo.nome);
  $('#campo-descricao', raiz).classList.toggle('campo-ok', certo.descricao);
  $('#campo-categoria', raiz).classList.toggle('campo-ok', certo.categoria);
  $('#contador-descricao', raiz).textContent = textoDoContador(faltamLetras);
  $$('.opcao-categoria', raiz).forEach(opcao => {
    const marcada = opcao.dataset.categoria === rascunho.categoria;
    opcao.classList.toggle('selecionada', marcada);
    opcao.setAttribute('aria-checked', String(marcada));
  });
  desenharProgresso(raiz, [certo.foto, certo.nome && certo.descricao, certo.categoria]);
  $('#enviar-doacao', raiz).disabled = !Object.values(certo).every(Boolean);
}

function desenharProgresso(raiz, prontos) {
  const atual = prontos.indexOf(false);
  $$('#progresso li', raiz).forEach((passo, i) => {
    passo.classList.toggle('feito', prontos[i]);
    passo.classList.toggle('atual', i === atual);
    if (i === atual) passo.setAttribute('aria-current', 'step');
    else passo.removeAttribute('aria-current');
  });
}

async function enviarDoacao(raiz) {
  const botao = $('#enviar-doacao', raiz);
  if (botao.disabled) return;
  const liberar = botaoOcupado(botao, 'Enviando a doação…');
  try {
    const resposta = await chamarPublico('doar', {
      foto: rascunho.foto, nome: rascunho.nome, descricao: rascunho.descricao, categoria: rascunho.categoria
    }, { tempoLimite: CONFIG.TEMPO_LIMITE_FOTO_MS });
    vibrar();
    limparRascunho();
    apagarLocal(CHAVES.minhas);
    minhasCoisas = null;
    if (raiz.isConnected) mostrarSucessoDaDoacao(resposta.codigo);
  } catch (erro) {
    if (raiz.isConnected) {
      liberar();
      conferirDoacao(raiz);
    }
    mostrarErro(erro);
  }
}

function mostrarSucessoDaDoacao(codigo) {
  const raiz = novaTela('tela-sucesso');
  raiz.innerHTML = `
    <div class="card cartao-sucesso entrar">
      <p class="emoji-grande" aria-hidden="true">💛</p>
      <h1>Obrigado pela doação!</h1>
      <p class="rotulo-codigo">Código da doação</p>
      <p class="codigo-grande">${esc(codigo)}</p>
      <p>A equipe vai conferir e, logo depois, ela aparece na vitrine.</p>
    </div>
    <div class="pilha-botoes entrar" style="--ordem:1">
      <button type="button" class="botao botao-doar botao-largo" id="doar-outra">🎁 Doar outra coisa</button>
      <a class="botao botao-contorno botao-largo" href="#minhas">📋 Ver minhas doações</a>
    </div>`;
  $('#doar-outra', raiz).addEventListener('click', () => irPara('#doar'));
  soltarConfete();
}
