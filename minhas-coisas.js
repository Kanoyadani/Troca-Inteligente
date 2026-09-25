let minhasCoisas = lerLocal(CHAVES.minhas, null);

function mostrarMinhasCoisas(aba) {
  const raiz = novaTela('tela-minhas');
  const nome = primeiroNome((usuarioAtual() || {}).nome);
  raiz.innerHTML = `
    <h1 class="titulo-tela">Minhas coisas</h1>
    <p class="texto-suave">Olá, ${esc(nome)}! Aqui estão suas doações e reservas.</p>
    <div class="abas" role="tablist">
      <a class="aba ${aba === 'doacoes' ? 'ativa' : ''}" role="tab" aria-selected="${aba === 'doacoes'}" href="#minhas/doacoes">🎁 Minhas doações</a>
      <a class="aba ${aba === 'reservas' ? 'ativa' : ''}" role="tab" aria-selected="${aba === 'reservas'}" href="#minhas/reservas">🙋 Minhas reservas</a>
    </div>
    <div id="lista-minhas" class="lista" aria-live="polite">${minhasCoisas ? '' : esqueletosDeLista()}</div>
    <div class="rodape-minhas">
      <button type="button" class="link-discreto" id="apagar-dados">Apagar meus dados</button>
    </div>`;
  $('#apagar-dados', raiz).addEventListener('click', evento => apagarMeusDados(evento.currentTarget));
  $('#lista-minhas', raiz).addEventListener('click', evento => {
    const botao = evento.target.closest('[data-desistir]');
    if (botao && !botao.disabled) desistirDaReserva(raiz, aba, botao);
  });
  if (minhasCoisas) desenharMinhasCoisas(raiz, aba);
  carregarMinhasCoisas(raiz, aba);
  definirPuxarParaAtualizar(() => carregarMinhasCoisas(raiz, aba));
}

async function carregarMinhasCoisas(raiz, aba) {
  try {
    const resposta = await chamarPublico('minhasCoisas');
    minhasCoisas = { doacoes: resposta.doacoes, reservas: resposta.reservas };
    gravarLocal(CHAVES.minhas, minhasCoisas);
    if (raiz.isConnected) desenharMinhasCoisas(raiz, aba);
  } catch (erro) {
    if (!raiz.isConnected || erro.codigo === 'BANIDO' || erro.codigo === 'SEM_CADASTRO') return;
    if (!minhasCoisas) {
      $('#lista-minhas', raiz).innerHTML = telaVazia({ ilustracao: 'busca', frase: erro.message });
    } else {
      mostrarErro(erro);
    }
  }
}

function desenharMinhasCoisas(raiz, aba) {
  const lista = $('#lista-minhas', raiz);
  const itens = aba === 'reservas' ? minhasCoisas.reservas : minhasCoisas.doacoes;
  if (!itens.length) {
    lista.innerHTML = aba === 'reservas'
      ? telaVazia({ ilustracao: 'caixa', frase: 'Você ainda não reservou nada. Dá uma olhada na vitrine!', botaoTexto: '🏠 Ver a vitrine', botaoHref: '#vitrine' })
      : telaVazia({ ilustracao: 'presente', frase: 'Você ainda não doou nada. Que tal começar agora?', botaoTexto: '🎁 Doar agora', botaoHref: '#doar', botaoClasse: 'botao-doar' });
    return;
  }
  lista.innerHTML = itens.map((coisa, i) => (aba === 'reservas' ? linhaDeReserva(coisa, i) : linhaDeDoacao(coisa, i))).join('');
}

function linhaDeDoacao(doacao, ordem) {
  const naVitrine = doacao.situacao === 'DISPONIVEL' && doacao.visivel === 'SIM';
  return `
    <article class="linha-lista entrar" style="--ordem:${Math.min(ordem, 10)}">
      <img class="linha-lista-foto" src="${esc(urlDeFoto(doacao.foto_url))}" alt="" loading="lazy">
      <div class="linha-lista-corpo">
        <h3>${esc(doacao.nome)}</h3>
        <p class="texto-suave">${esc(doacao.codigo)} · enviado em ${esc(formatarData(doacao.criado_em))}</p>
        ${etiqueta(ROTULOS_ITEM, doacao.situacao, naVitrine ? 'Na vitrine' : '')}
      </div>
    </article>`;
}

function linhaDeReserva(reserva, ordem) {
  const aberta = reserva.situacao === 'AGUARDANDO';
  const dias = diasAte(reserva.expira_em);
  const config = estado.config || {};
  const mensagem = preencherMensagem(config.msg_reserva, {
    nome: (usuarioAtual() || {}).nome || '', item: reserva.item_nome, codigo: reserva.codigo,
    validade: formatarDataCompleta(reserva.expira_em), bazar: config.nome_bazar || ''
  });
  return `
    <article class="linha-lista entrar" style="--ordem:${Math.min(ordem, 10)}">
      <img class="linha-lista-foto" src="${esc(urlDeFoto(reserva.foto_url))}" alt="" loading="lazy">
      <div class="linha-lista-corpo">
        <h3>${esc(reserva.item_nome || reserva.item_codigo)}</h3>
        <p class="texto-suave">Código <strong>${esc(reserva.codigo)}</strong> · reservado em ${esc(formatarData(reserva.reservado_em))}</p>
        ${aberta && dias >= 0
          ? `<p>Busque até <strong>${esc(formatarData(reserva.expira_em))}</strong> (${esc(textoDeDias(dias))})</p>`
          : ''}
        ${etiqueta(ROTULOS_RESERVA, aberta && dias < 0 ? 'EXPIRADA' : reserva.situacao)}
        ${aberta && dias >= 0 ? `
          <div class="linha-lista-acoes">
            ${config.telefone_instituicao ? `<a class="botao botao-pequeno botao-secundario" target="_blank" rel="noopener"
              href="${esc(linkWhatsapp(config.telefone_instituicao, mensagem))}">💬 Avisar no WhatsApp</a>` : ''}
            <button type="button" class="botao botao-pequeno botao-contorno" data-desistir="${esc(reserva.codigo)}">Desistir</button>
          </div>` : ''}
      </div>
    </article>`;
}

async function desistirDaReserva(raiz, aba, botao) {
  const certeza = await confirmar('Desistir da reserva?', 'O item volta para a vitrine e outra pessoa pode reservar.',
    'Sim, desistir', 'botao-perigo');
  if (!certeza) return;
  const liberar = botaoOcupado(botao, 'Cancelando…');
  try {
    await chamarPublico('desistirDaReserva', { codigo: botao.dataset.desistir });
    vibrar();
    vitrine.versao = '';
    mostrarToast('Reserva cancelada. O item voltou para a vitrine.', 'sucesso', '👍');
    await carregarMinhasCoisas(raiz, aba);
  } catch (erro) {
    if (botao.isConnected) liberar();
    mostrarErro(erro);
  }
}

async function apagarMeusDados(botao) {
  const certeza = await confirmar('Apagar meus dados?',
    'Seu nome e seu telefone serão apagados. Reservas em aberto serão canceladas. As doações continuam, mas sem o seu nome.',
    'Sim, apagar meus dados', 'botao-perigo');
  if (!certeza) return;
  const liberar = botaoOcupado(botao, 'Apagando…');
  try {
    await chamarPublico('apagarMeusDados');
    esquecerUsuario();
    limparRascunho();
    minhasCoisas = null;
    mostrarToast('Pronto. Seus dados foram apagados.', 'sucesso', '✅');
    irPara('#vitrine');
  } catch (erro) {
    if (botao.isConnected) liberar();
    mostrarErro(erro);
  }
}
