function mostrarTelaIdentificacao() {
  if (!lerLocal(CHAVES.viuBoasVindas, false)) {
    mostrarBoasVindas();
    return;
  }
  mostrarFormularioIdentificacao();
}

function mostrarBoasVindas() {
  entrarModo('sozinha');
  const raiz = novaTela('tela-identificacao');
  raiz.innerHTML = `
    <div class="boas-vindas entrar">
      ${logoDoBazar()}
      <p class="logotipo">${nomeEmDuasLinhas()}</p>
      <p class="assinatura">passa adiante</p>
      <h1>Um bazar solidário no seu celular</h1>
    </div>
    <ul class="passos-boas-vindas">
      <li class="entrar" style="--ordem:1"><span class="emoji" aria-hidden="true">🎁</span>Doe o que não usa mais</li>
      <li class="entrar" style="--ordem:2"><span class="emoji" aria-hidden="true">🔍</span>Ache o que precisa</li>
      <li class="entrar" style="--ordem:3"><span class="emoji" aria-hidden="true">🤝</span>Combine a retirada</li>
    </ul>
    <button type="button" class="botao botao-largo entrar" style="--ordem:4" id="vamos-la">Vamos lá</button>`;
  $('#vamos-la', raiz).addEventListener('click', () => {
    gravarLocal(CHAVES.viuBoasVindas, true);
    mostrarFormularioIdentificacao();
  });
}

function mostrarFormularioIdentificacao() {
  entrarModo('sozinha');
  const raiz = novaTela('tela-identificacao');
  raiz.innerHTML = `
    <div class="boas-vindas entrar">
      <h1>Antes, conte pra gente quem é você 👋</h1>
      <p>Com isso a equipe consegue te avisar sobre as suas doações e reservas.</p>
    </div>
    <form id="form-identificacao" class="card entrar" style="--ordem:1" novalidate>
      <div class="campo" id="campo-nome">
        <label class="campo-rotulo" for="nome">Seu nome</label>
        <input class="campo-entrada" id="nome" name="nome" autocomplete="name" maxlength="60" required>
        <span class="campo-lembrete">Escreva seu nome para continuar.</span>
      </div>
      <div class="campo" id="campo-telefone">
        <label class="campo-rotulo" for="telefone">Seu WhatsApp (com DDD)</label>
        <input class="campo-entrada" id="telefone" name="telefone" type="tel" inputmode="tel" maxlength="15"
          autocomplete="tel-national" placeholder="(11) 98765-4321" aria-describedby="lembrete-telefone" required>
        <span class="campo-lembrete" id="lembrete-telefone">Escreva o DDD e o número. Ex.: (11) 98765-4321</span>
      </div>
      <p class="aviso-privacidade">🔒 Seu telefone é usado só para avisar sobre suas doações e reservas.
        Ele não é compartilhado com ninguém.</p>
      <button class="botao botao-largo" type="submit" disabled>Começar</button>
    </form>`;

  const form = $('#form-identificacao', raiz);
  const nome = $('#nome', raiz);
  const telefone = $('#telefone', raiz);
  const botao = $('button[type=submit]', form);
  const conferir = (mostrarErroTelefone = false) => {
    const nomeOk = nome.value.trim().length >= 2;
    const digitos = telefone.value.replace(/\D/g, '').length;
    const telefoneOk = digitos === 10 || digitos === 11;
    const campoTelefone = $('#campo-telefone', raiz);
    $('#campo-nome', raiz).classList.toggle('campo-ok', nomeOk);
    campoTelefone.classList.toggle('campo-ok', telefoneOk);
    if (telefoneOk || !digitos) campoTelefone.classList.remove('campo-erro');
    else if (mostrarErroTelefone) campoTelefone.classList.add('campo-erro');
    $('#lembrete-telefone', raiz).textContent = digitos && !telefoneOk && campoTelefone.classList.contains('campo-erro')
      ? `Esse número tem ${digitos} ${digitos === 1 ? 'dígito' : 'dígitos'}. Com o DDD, são 10 ou 11. Ex.: (11) 98765-4321`
      : 'Escreva o DDD e o número. Ex.: (11) 98765-4321';
    telefone.setAttribute('aria-invalid', String(campoTelefone.classList.contains('campo-erro')));
    botao.disabled = !(nomeOk && telefoneOk);
  };
  nome.addEventListener('input', () => conferir());
  telefone.addEventListener('input', () => {
    telefone.value = formatarTelefoneDigitado(telefone.value);
    conferir();
  });
  telefone.addEventListener('blur', () => conferir(true));
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (botao.disabled) return;
    const liberar = botaoOcupado(botao, 'Só um instante…');
    try {
      const resposta = await chamarServidor('cadastrarUsuario', {
        id_aparelho: idAparelho(), nome: nome.value, telefone: telefone.value
      });
      guardarUsuario(resposta.usuario);
      vibrar();
      mostrarToast(`Prontinho, ${primeiroNome(resposta.usuario.nome)}!`, 'sucesso', '🎉');
      irPara('#vitrine');
    } catch (erro) {
      liberar();
      if (erro.codigo === 'BANIDO') {
        estado.banido = erro.extra;
        mostrarTelaBanido(erro.extra);
        return;
      }
      mostrarErro(erro);
    }
  });
}

function mostrarTelaBanido(ban) {
  entrarModo('sozinha');
  const raiz = novaTela('tela-banido');
  const permanente = !ban || ban.ate === 'PERMANENTE';
  const prazo = permanente ? 'Essa suspensão não tem data para acabar.'
    : `Você pode voltar a usar o aplicativo a partir de ${formatarDataCompleta(ban.ate)}.`;
  const telefone = estado.config && estado.config.telefone_instituicao;
  raiz.innerHTML = `
    <div class="card cartao-aviso entrar">
      <p class="emoji-grande" aria-hidden="true">🚫</p>
      <h1>Seu acesso está suspenso</h1>
      <p><strong>Motivo:</strong> ${esc((ban && ban.motivo) || 'não informado')}</p>
      <p>${esc(prazo)}</p>
      <p class="texto-suave">Se você acha que foi um engano, converse com a equipe da instituição.</p>
      ${telefone ? `<a class="botao botao-secundario botao-largo" target="_blank" rel="noopener"
        href="${esc(linkWhatsapp(telefone, 'Olá! Meu acesso ao bazar foi suspenso e gostaria de conversar.'))}">
        <i class="ph-duotone ph-whatsapp-logo"></i> Falar com a instituição</a>` : ''}
    </div>`;
}

function mostrarFaltaConfigurar() {
  entrarModo('sozinha');
  const raiz = novaTela();
  raiz.innerHTML = `
    <div class="card cartao-aviso entrar">
      <p class="emoji-grande" aria-hidden="true">🛠️</p>
      <h1>Falta um passo da instalação</h1>
      <p>Abra o arquivo <strong>config.js</strong> e cole o endereço do Web App do Google Apps Script
        no lugar de COLE_AQUI_A_URL_DO_WEB_APP. O passo a passo está no Manual de instalação.</p>
    </div>`;
}

function logoDoBazar() {
  const logo = estado.config && estado.config.logo_url;
  return logo
    ? `<img class="logo-bazar" src="${esc(urlDeFoto(logo))}" alt="Logo do bazar">`
    : '<img class="logo-bazar logo-padrao" src="icone.svg" alt="">';
}
