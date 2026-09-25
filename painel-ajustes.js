function mostrarAjustes() {
  const { corpo } = telaDaEquipe('tela-ajustes', '⚙️ Ajustes');
  const config = estadoEquipe.dados.config;
  const arquivados = estadoEquipe.dados.itens.filter(i => i.situacao === 'ARQUIVADO').length;
  const numero = (id, rotulo, valor, min, max, ajuda) => `
    <div class="campo"><label class="campo-rotulo" for="${id}">${rotulo}</label>
      <input class="campo-entrada campo-numero" id="${id}" name="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${esc(valor)}">
      <span class="campo-dica">${ajuda}</span></div>`;
  const mensagem = (id, rotulo, valor, marcadores) => `
    <div class="campo"><label class="campo-rotulo" for="${id}">${rotulo}</label>
      <textarea class="campo-entrada" id="${id}" name="${id}" maxlength="500">${esc(valor)}</textarea>
      <span class="campo-dica">Pode usar: ${marcadores}</span></div>`;

  corpo.innerHTML = `
    <form id="form-ajustes" novalidate>
      <section class="card secao-ajustes">
        <h2>🏪 O bazar</h2>
        <div class="campo"><label class="campo-rotulo" for="nome_bazar">Nome do bazar</label>
          <input class="campo-entrada" id="nome_bazar" name="nome_bazar" maxlength="60" value="${esc(config.nome_bazar)}"></div>
        <div class="campo"><label class="campo-rotulo" for="telefone_instituicao">WhatsApp da instituição</label>
          <input class="campo-entrada" id="telefone_instituicao" name="telefone_instituicao" type="tel" inputmode="tel"
            placeholder="(11) 91234-5678" value="${esc(config.telefone_instituicao)}">
          <span class="campo-dica">É para esse número que as pessoas mandam mensagem depois de reservar.</span></div>
      </section>
      <section class="card secao-ajustes">
        <h2>👥 Nomes da equipe</h2>
        <p class="texto-suave">Aparecem na tela "Quem está usando?".</p>
        <ul class="lista-nomes" id="lista-nomes"></ul>
        <div class="linha-adicionar">
          <input class="campo-entrada" id="novo-nome" maxlength="40" placeholder="Nome de quem entrou na equipe" aria-label="Nome novo">
          <button type="button" class="botao botao-pequeno botao-secundario" id="adicionar-nome">➕ Pôr</button>
        </div>
      </section>
      <section class="card secao-ajustes">
        <h2>⏰ Reservas</h2>
        <p class="campo-rotulo" id="rotulo-dias">Quantos dias a reserva fica guardada</p>
        <div class="pilulas pilulas-quebra" role="radiogroup" aria-labelledby="rotulo-dias">
          ${[3, 5, 7, 15, 30].map(d => `<label class="pilula pilula-radio"><input type="radio" name="dias_reserva" value="${d}"
            ${Number(config.dias_reserva) === d ? 'checked' : ''}> ${d} dias</label>`).join('')}
        </div>
      </section>
      <section class="card secao-ajustes">
        <h2>🛡️ Limites contra abuso</h2>
        ${numero('limite_doacoes_dia', 'Doações por pessoa, por dia', config.limite_doacoes_dia, 1, 100, 'De 1 a 100.')}
        ${numero('limite_reservas_ativas', 'Reservas ao mesmo tempo, por pessoa', config.limite_reservas_ativas, 1, 20, 'De 1 a 20.')}
        ${numero('intervalo_minimo_segundos', 'Segundos entre um envio e outro', config.intervalo_minimo_segundos, 0, 600, 'De 0 a 600.')}
        ${numero('meta_mensal', 'Meta de itens entregues por mês', config.meta_mensal, 1, 10000, 'Aparece no relatório do mês.')}
      </section>
      <section class="card secao-ajustes">
        <h2>💬 Textos das mensagens</h2>
        ${mensagem('msg_reserva', 'Quando a pessoa reserva (ela manda para a instituição)', config.msg_reserva, '{nome} {item} {codigo} {validade} {bazar}')}
        ${mensagem('msg_lembrete', 'Lembrete para buscar (a equipe manda)', config.msg_lembrete, '{nome} {item} {codigo} {validade} {bazar}')}
        ${mensagem('msg_recusa', 'Doação recusada (a equipe manda)', config.msg_recusa, '{nome} {item} {motivo} {bazar}')}
      </section>
      <button type="submit" class="botao botao-sucesso botao-largo botao-fixo-salvar">💾 Salvar ajustes</button>
    </form>
    <div id="ajustes-dados"></div>`;

  let nomes = config.nomes_equipe.slice();
  const desenharNomes = () => {
    $('#lista-nomes', corpo).innerHTML = nomes.length
      ? nomes.map((n, i) => `<li><span>${esc(n)}</span><button type="button" class="botao botao-pequeno botao-contorno" data-tirar="${i}"
        aria-label="Tirar ${esc(n)} da lista">✖ Tirar</button></li>`).join('')
      : '<li class="texto-suave">Nenhum nome ainda. Ponha o nome de quem usa o app.</li>';
  };
  desenharNomes();
  $('#lista-nomes', corpo).addEventListener('click', evento => {
    const botao = evento.target.closest('[data-tirar]');
    if (botao) { nomes.splice(Number(botao.dataset.tirar), 1); desenharNomes(); }
  });
  const adicionar = () => {
    const campo = $('#novo-nome', corpo);
    const nome = campo.value.trim().replace(/\s+/g, ' ');
    if (nome.length < 2) { mostrarToast('Escreva o nome com pelo menos 2 letras.', 'atencao', '✍️'); return; }
    if (!nomes.includes(nome)) nomes.push(nome);
    campo.value = '';
    desenharNomes();
  };
  $('#adicionar-nome', corpo).addEventListener('click', adicionar);
  $('#novo-nome', corpo).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
  $('#telefone_instituicao', corpo).addEventListener('input', e => { e.target.value = formatarTelefoneDigitado(e.target.value); });
  $('#form-ajustes', corpo).addEventListener('submit', evento => {
    evento.preventDefault();
    salvarAjustes(evento.target, nomes);
  });
  desenharAjustesDeDados($('#ajustes-dados', corpo), arquivados);
}

async function salvarAjustes(form, nomes) {
  const campos = Object.fromEntries(new FormData(form));
  const ajustes = { ...campos, nomes_equipe: nomes };
  const botao = $('button[type=submit]', form);
  const liberar = botaoOcupado(botao, 'Salvando…');
  try {
    aplicarResposta(await chamarEquipe('salvarAjustes', { ajustes }));
    vibrar();
    mostrarToast('Ajustes salvos.', 'sucesso', '💾');
  } catch (erro) {
    liberar();
    mostrarErro(erro);
  }
}
