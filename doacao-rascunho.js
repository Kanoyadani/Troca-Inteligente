const RASCUNHO_VAZIO = { foto: '', nome: '', descricao: '', categoria: '' };
const rascunho = Object.assign({}, RASCUNHO_VAZIO, lerLocal(CHAVES.rascunho, {}));
let relogioRascunho = null;

function rascunhoTemAlgo() {
  return Boolean(rascunho.foto || rascunho.nome.trim() || rascunho.descricao.trim() || rascunho.categoria);
}

function guardarRascunho() {
  clearTimeout(relogioRascunho);
  relogioRascunho = setTimeout(() => {
    if (rascunhoTemAlgo()) gravarLocal(CHAVES.rascunho, rascunho);
    else apagarLocal(CHAVES.rascunho);
  }, 400);
}

function limparRascunho() {
  clearTimeout(relogioRascunho);
  Object.assign(rascunho, RASCUNHO_VAZIO);
  apagarLocal(CHAVES.rascunho);
}

function mostrarDoacao() {
  if (!rascunhoTemAlgo()) {
    mostrarFormularioDoacao();
    return;
  }
  const raiz = novaTela('tela-doacao');
  const titulo = rascunho.nome.trim() ? `“${rascunho.nome.trim()}”` : 'uma doação';
  raiz.innerHTML = `
    <h1 class="titulo-tela">Doar um item</h1>
    <div class="card retomar-rascunho entrar">
      ${rascunho.foto ? `<div class="miniatura-foto"><img src="${esc(rascunho.foto)}" alt="Foto que você escolheu">
        <p>Você começou a doar ${esc(titulo)}.</p></div>` : `<p><strong>Você começou a doar ${esc(titulo)}.</strong></p>`}
      <p class="texto-suave">Guardamos o que você já tinha preenchido.</p>
      <button type="button" class="botao botao-doar botao-largo" id="continuar-rascunho">Continuar de onde parou</button>
      <button type="button" class="botao botao-contorno botao-largo" id="descartar-rascunho">Começar do zero</button>
    </div>`;
  $('#continuar-rascunho', raiz).addEventListener('click', () => mostrarFormularioDoacao());
  $('#descartar-rascunho', raiz).addEventListener('click', () => {
    limparRascunho();
    mostrarFormularioDoacao();
  });
}

function textoDoContador(faltam) {
  if (faltam === 0) return 'boa, já dá 👍';
  return faltam === 1 ? 'falta 1 letrinha' : `faltam ${faltam} letrinhas`;
}
