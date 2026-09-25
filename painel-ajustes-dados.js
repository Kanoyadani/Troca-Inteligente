function desenharAjustesDeDados(caixa, arquivados) {
  const logo = estadoEquipe.dados.config.logo_url;
  caixa.innerHTML = `
    <section class="card secao-ajustes">
      <h2>🖼️ Logo</h2>
      <div class="linha-logo">
        ${logo ? `<img class="logo-bazar" src="${esc(urlDeFoto(logo))}" alt="Logo atual">` : '<img class="logo-bazar logo-padrao" src="icone.svg" alt="Logo padrão">'}
        <button type="button" class="botao botao-pequeno botao-contorno" id="trocar-logo">📸 Trocar logo</button>
      </div>
    </section>
    <form class="card secao-ajustes" id="form-senha-nova" novalidate>
      <h2>🔒 Trocar a senha da equipe</h2>
      <p class="texto-suave">Quem estiver com o app aberto em outros celulares vai precisar digitar a senha nova.</p>
      <div class="campo"><label class="campo-rotulo" for="senha-atual">Senha atual</label>
        <input class="campo-entrada" id="senha-atual" name="senha_atual" type="password" autocomplete="current-password"></div>
      <div class="campo"><label class="campo-rotulo" for="senha-nova">Senha nova (pelo menos 6 caracteres)</label>
        <input class="campo-entrada" id="senha-nova" name="senha_nova" type="password" autocomplete="new-password"></div>
      <div class="campo"><label class="campo-rotulo" for="senha-repetida">Repita a senha nova</label>
        <input class="campo-entrada" id="senha-repetida" type="password" autocomplete="new-password">
        <span class="campo-lembrete" id="lembrete-senha">Preencha os três campos. A senha nova precisa ser igual nas duas vezes.</span></div>
      <button type="submit" class="botao botao-largo" disabled>🔒 Trocar a senha</button>
    </form>
    <section class="card secao-ajustes">
      <h2>📦 Caixa de arquivados</h2>
      <p>${arquivados} ${arquivados === 1 ? 'item arquivado' : 'itens arquivados'}. Dá para tirar do arquivo quando quiser.</p>
      <a class="botao botao-pequeno botao-contorno" href="#equipe/itens/arquivados">📦 Abrir arquivados</a>
    </section>
    <section class="card secao-ajustes">
      <h2>⬇️ Baixar tudo em CSV</h2>
      <p class="texto-suave">Abre no Excel ou no Google Planilhas. Serve de cópia de segurança.</p>
      <div class="grade-acoes">
        ${[['itens', '📦 Itens'], ['reservas', '🙋 Reservas'], ['pessoas', '👥 Pessoas'], ['registro', '📜 Registro']]
          .map(([qual, rotulo]) => `<button type="button" class="botao botao-pequeno botao-contorno" data-csv="${qual}">${rotulo}</button>`).join('')}
      </div>
    </section>`;

  $('#trocar-logo', caixa).addEventListener('click', e => trocarLogo(e.currentTarget));
  ligarTrocaDeSenha($('#form-senha-nova', caixa));
  $$('[data-csv]', caixa).forEach(b => b.addEventListener('click', () => baixarCsv(b)));
}

function trocarLogo(botao) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'image/*';
  ligarEntradaDeFoto(entrada, async foto => {
    const liberar = botaoOcupado(botao, 'Enviando a logo…');
    try {
      aplicarResposta(await chamarEquipe('trocarLogo', { foto }, { tempoLimite: CONFIG.TEMPO_LIMITE_FOTO_MS }));
      mostrarToast('Logo trocada.', 'sucesso', '🖼️');
    } catch (erro) {
      if (botao.isConnected) liberar();
      mostrarErro(erro);
    }
  });
  entrada.click();
}

function ligarTrocaDeSenha(form) {
  const atual = $('#senha-atual', form);
  const nova = $('#senha-nova', form);
  const repetida = $('#senha-repetida', form);
  const botao = $('button[type=submit]', form);
  const conferir = () => {
    const ok = atual.value.length > 0 && nova.value.trim().length >= 6 && nova.value === repetida.value;
    botao.disabled = !ok;
    form.querySelector('.campo:last-of-type').classList.toggle('campo-ok', ok);
  };
  [atual, nova, repetida].forEach(c => c.addEventListener('input', conferir));
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (botao.disabled) return;
    const liberar = botaoOcupado(botao, 'Trocando…');
    try {
      await chamarEquipe('trocarSenha', { senha_atual: atual.value, senha_nova: nova.value });
      vibrar();
      form.reset();
      liberar();
      botao.disabled = true;
      mostrarToast('Senha trocada. Avise a equipe da senha nova pessoalmente.', 'sucesso', '🔒');
    } catch (erro) {
      liberar();
      conferir();
      mostrarErro(erro);
    }
  });
}

async function baixarCsv(botao) {
  const liberar = botaoOcupado(botao, 'Preparando…');
  try {
    const resposta = await chamarEquipe('exportarCsv', { qual: botao.dataset.csv });
    baixarArquivo(resposta.nome, resposta.conteudo);
  } catch (erro) {
    mostrarErro(erro);
  } finally {
    liberar();
  }
}
