function mostrarConfirmacaoReserva(codigo, jaProcurou = false) {
  const raiz = novaTela('tela-reserva tela-detalhe');
  const item = vitrine.itens.find(i => i.codigo === codigo);
  if (!item && !jaProcurou) {
    raiz.innerHTML = esqueletoDoDetalhe();
    procurarItemNaVitrine(raiz, codigo);
    return;
  }
  if (!item) {
    entrarModo('publico');
    raiz.innerHTML = telaVazia({ ilustracao: 'caixa', frase: 'Esse item já saiu da vitrine. Dê uma olhada nos outros!',
      botaoTexto: '🏠 Ver a vitrine', botaoHref: '#vitrine' });
    return;
  }
  const categoria = categoriaPorId(item.categoria, categoriasPublicas());
  raiz.innerHTML = `
    <div class="detalhe-topo" style="${coresDaCategoria(categoria)}">
      <a class="botao-circulo detalhe-voltar" href="#vitrine" aria-label="Voltar para a vitrine">
        <i class="ph ph-caret-left" aria-hidden="true"></i></a>
      <span class="detalhe-marca-dagua" aria-hidden="true">${esc(categoria.nome)}</span>
      <img class="detalhe-foto" src="${esc(urlDeFoto(item.foto_url))}" alt="Foto: ${esc(item.nome)}">
    </div>
    <article class="detalhe-corpo entrar" style="--ordem:1">
      <div class="detalhe-titulo">
        <h1>${esc(item.nome)}</h1>
        <span class="pilula-codigo" aria-label="Código ${esc(item.codigo)}">${esc(item.codigo)}</span>
      </div>
      <span class="etiqueta" style="${coresDaCategoria(categoria)}">${esc(categoria.emoji)} ${esc(categoria.nome)}</span>
      <p class="detalhe-descricao">${esc(item.descricao)}</p>
      <p class="texto-suave">Doado por: ${esc(item.doador || 'alguém especial')}</p>
    </article>
    <div class="detalhe-acao" id="acao-reserva"></div>`;
  desenharAcaoDeReserva(raiz, item);
  if (!vitrine.semConexao) atualizarReservasDaPessoa().then(() => { if (raiz.isConnected) desenharAcaoDeReserva(raiz, item); });
}

function esqueletoDoDetalhe() {
  return `
    <div class="detalhe-topo"><div class="esqueleto esqueleto-detalhe"></div></div>
    <div class="detalhe-corpo">
      <div class="esqueleto esqueleto-linha"></div>
      <div class="esqueleto esqueleto-linha curta"></div>
    </div>`;
}

async function procurarItemNaVitrine(raiz, codigo) {
  try {
    const resposta = await chamarServidor('vitrine', { versao: '' });
    if (resposta.mudou) {
      vitrine.itens = resposta.itens;
      vitrine.versao = resposta.versao;
      aplicarConfigPublica(resposta.config);
    }
    vitrine.semConexao = false;
    vitrine.salvoEm = Date.now();
    gravarLocal(CHAVES.vitrine, { itens: vitrine.itens, versao: vitrine.versao, salvoEm: vitrine.salvoEm });
  } catch (erro) {
    vitrine.semConexao = true;
  }
  if (raiz.isConnected) mostrarConfirmacaoReserva(codigo, true);
}

function limiteDeReservas() {
  return Number(estado.config && estado.config.limite_reservas_ativas) || 3;
}

function reservasAtivas() {
  if (!minhasCoisas) return null;
  return minhasCoisas.reservas.filter(r => r.situacao === 'AGUARDANDO' && diasAte(r.expira_em) >= 0).length;
}

async function atualizarReservasDaPessoa() {
  try {
    const resposta = await chamarPublico('minhasCoisas');
    minhasCoisas = { doacoes: resposta.doacoes, reservas: resposta.reservas };
    gravarLocal(CHAVES.minhas, minhasCoisas);
    return true;
  } catch (erro) {
    return false;
  }
}

function desenharAcaoDeReserva(raiz, item) {
  const area = $('#acao-reserva', raiz);
  if (raiz.dataset.reservando) return;
  const dias = (estado.config && estado.config.dias_reserva) || 7;
  const limite = limiteDeReservas();
  const noLimite = (reservasAtivas() || 0) >= limite;
  let aviso = `<p class="detalhe-aviso texto-suave">Fica guardado para você por <strong>${esc(dias)} dias</strong>.</p>`;
  if (vitrine.semConexao) {
    aviso = '<p class="detalhe-aviso detalhe-aviso-bloqueio" role="status" id="motivo-bloqueio">📡 Sem conexão. Conecte-se à internet para reservar.</p>';
  } else if (noLimite) {
    aviso = `<p class="detalhe-aviso detalhe-aviso-bloqueio" role="status" id="motivo-bloqueio">Você já tem ${esc(limite)} reservas
      esperando retirada. Retire ou desista de uma para reservar outra.</p>
      <a class="botao botao-pequeno botao-secundario" href="#minhas/reservas">📋 Ver minhas reservas</a>`;
  }
  const bloqueado = vitrine.semConexao || noLimite;
  area.innerHTML = `${aviso}
    <button type="button" class="botao botao-largo botao-reservar" id="confirmar-reserva"
      ${bloqueado ? 'disabled aria-describedby="motivo-bloqueio"' : ''}>Reservar</button>`;
  $('#confirmar-reserva', raiz).addEventListener('click', evento => confirmarReserva(raiz, item, evento.currentTarget));
}

async function confirmarReserva(raiz, item, botao) {
  if (botao.disabled || raiz.dataset.reservando) return;
  raiz.dataset.reservando = '1';
  const liberar = botaoOcupado(botao, 'Reservando…');
  try {
    const resposta = await chamarPublico('reservar', { item_codigo: item.codigo });
    vibrar();
    tirarDaVitrineLocal(item.codigo);
    lembrarReservaNova(resposta.reserva, item);
    if (raiz.isConnected) {
      entrarModo('publico');
      mostrarSucessoDaReserva(resposta.reserva);
    }
  } catch (erro) {
    delete raiz.dataset.reservando;
    if (!raiz.isConnected) return;
    liberar();
    if (erro.codigo === 'INDISPONIVEL') {
      tirarDaVitrineLocal(item.codigo);
      entrarModo('publico');
      raiz.innerHTML = telaVazia({ ilustracao: 'caixa', frase: erro.message, botaoTexto: '🏠 Ver outros itens', botaoHref: '#vitrine' });
      return;
    }
    mostrarErro(erro);
    if (!erro.semConexao) {
      await atualizarReservasDaPessoa();
      if (raiz.isConnected) desenharAcaoDeReserva(raiz, item);
    }
  }
}

function lembrarReservaNova(reserva, item) {
  if (!minhasCoisas) return;
  minhasCoisas.reservas.unshift({
    codigo: reserva.codigo, item_codigo: item.codigo, item_nome: item.nome, foto_url: item.foto_url,
    situacao: 'AGUARDANDO', reservado_em: new Date().toISOString(), expira_em: reserva.expira_em
  });
  gravarLocal(CHAVES.minhas, minhasCoisas);
}

function mostrarSucessoDaReserva(reserva) {
  const raiz = novaTela('tela-sucesso');
  const usuario = usuarioAtual() || {};
  const config = estado.config || {};
  const validade = formatarDataCompleta(reserva.expira_em);
  const mensagem = preencherMensagem(config.msg_reserva, {
    nome: usuario.nome || '', item: reserva.item_nome, codigo: reserva.codigo,
    validade, bazar: config.nome_bazar || ''
  });
  raiz.innerHTML = `
    <div class="card cartao-sucesso entrar">
      <p class="emoji-grande" aria-hidden="true">🎉</p>
      <h1>Reservado!</h1>
      <p>${esc(reserva.item_nome)} está guardado para você.</p>
      <p class="rotulo-codigo">Seu código</p>
      <p class="codigo-grande">${esc(reserva.codigo)}</p>
      <p>Mostre este código na retirada.</p>
    </div>
    <section class="proximos-passos entrar" style="--ordem:1">
      <h2>O que acontece agora</h2>
      <ol>
        <li>Avise no WhatsApp</li>
        <li>Combine o dia</li>
        <li>Retire até ${esc(formatarData(reserva.expira_em))}</li>
      </ol>
    </section>
    <div class="pilha-botoes entrar" style="--ordem:2">
      ${config.telefone_instituicao ? `<a class="botao botao-largo" target="_blank" rel="noopener"
        href="${esc(linkWhatsapp(config.telefone_instituicao, mensagem))}">
        <i class="ph-duotone ph-whatsapp-logo" aria-hidden="true"></i> Avisar no WhatsApp</a>` : ''}
      <a class="botao botao-contorno botao-largo" href="#minhas/reservas">📋 Ver minhas reservas</a>
      <a class="botao botao-contorno botao-largo" href="#vitrine">🏠 Voltar para a vitrine</a>
    </div>`;
  soltarConfete();
}
