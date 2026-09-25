function mostrarReservas() {
  const { corpo } = telaDaEquipe('tela-reservas', '⏳ Esperando retirada');
  const dados = estadoEquipe.dados;
  const abertas = dados.reservas.filter(r => r.situacao === 'AGUARDANDO')
    .sort((a, b) => new Date(a.expira_em) - new Date(b.expira_em));
  const semanaPassada = Date.now() - 7 * 86400000;
  const vencidas = dados.reservas.filter(r => r.situacao === 'EXPIRADA' && new Date(r.finalizado_em).getTime() > semanaPassada);

  const porPessoa = new Map();
  abertas.forEach(r => {
    if (!porPessoa.has(r.usuario_id)) porPessoa.set(r.usuario_id, []);
    porPessoa.get(r.usuario_id).push(r);
  });
  corpo.innerHTML = (porPessoa.size
    ? Array.from(porPessoa.entries()).map(([id, lista], i) => cartaoDaPessoa(id, lista, i)).join('')
    : telaVazia({ ilustracao: 'festa', frase: 'Ninguém esperando retirada agora. Tudo em dia!', botaoTexto: '🏠 Voltar ao painel', botaoHref: '#equipe' }))
    + (vencidas.length ? `<h2 class="subtitulo">Venceram nos últimos 7 dias</h2>
      <p class="texto-suave">Esses itens já voltaram para a vitrine. Se a pessoa ainda quiser, dá para reativar.</p>
      ${vencidas.map(r => blocoDeReserva(r, true)).join('')}` : '');
  corpo.addEventListener('click', tratarCliqueNaReserva);
}

function cartaoDaPessoa(usuarioId, reservas, ordem) {
  const pessoa = pessoaPorId(usuarioId) || { nome: reservas[0].usuario_nome, telefone: '' };
  return `
    <article class="card cartao-pessoa-reserva entrar" style="--ordem:${Math.min(ordem, 8)}">
      <h2>🙋 ${esc(pessoa.nome)}</h2>
      ${pessoa.telefone ? `<p class="texto-suave">${esc(pessoa.telefone)}</p>` : ''}
      ${reservas.map(r => blocoDeReserva(r, false)).join('')}
    </article>`;
}

function blocoDeReserva(reserva, vencida) {
  const item = estadoEquipe.dados.itens.find(i => i.codigo === reserva.item_codigo) || {};
  const dias = diasAte(reserva.expira_em);
  const passou = new Date(reserva.expira_em).getTime() <= Date.now();
  const classe = vencida || passou ? 'reserva-vencida' : (dias <= 1 ? 'reserva-vence-logo' : '');
  const reservadoHa = -diasAte(reserva.reservado_em);
  const codigo = esc(reserva.codigo);
  const botao = (acao, texto, classeBotao = 'botao-contorno') =>
    `<button type="button" class="botao botao-pequeno ${classeBotao}" data-acao-reserva="${acao}" data-codigo="${codigo}">${texto}</button>`;
  let acoes;
  if (vencida) {
    acoes = item.situacao === 'DISPONIVEL' ? botao('prorrogar', '⏰ Reativar por mais uns dias') : '<p class="texto-suave">O item já foi para outra pessoa.</p>';
  } else if (passou) {
    acoes = botao('devolver', '🏠 Devolver à vitrine') + botao('entregar', '✅ Entreguei', 'botao-sucesso');
  } else {
    acoes = botao('entregar', '✅ Entreguei', 'botao-sucesso') + botao('zap', '💬 Chamar no Zap', 'botao-secundario')
      + botao('prorrogar', '⏰ Dar mais uns dias') + botao('cancelar', '❌ Cancelar');
  }
  return `
    <div class="bloco-reserva ${classe}">
      <div class="cartao-item-topo">
        <img class="linha-lista-foto" src="${esc(urlDeFoto(item.foto_url))}" alt="" loading="lazy">
        <div>
          <h3>${esc(item.nome || reserva.item_codigo)}</h3>
          <p>Código <strong>${codigo}</strong> · reservado ${reservadoHa <= 0 ? 'hoje' : `há ${reservadoHa} ${reservadoHa === 1 ? 'dia' : 'dias'}`}</p>
          <p><strong>${vencida || passou ? `Venceu ${esc(textoDeDias(dias))} (${esc(formatarData(reserva.expira_em))})`
            : `Vence ${esc(textoDeDias(dias))} (${esc(formatarData(reserva.expira_em))})`}</strong></p>
        </div>
      </div>
      <div class="grade-acoes">${acoes}</div>
    </div>`;
}

async function tratarCliqueNaReserva(evento) {
  const botao = evento.target.closest('[data-acao-reserva]');
  if (!botao) return;
  const reserva = estadoEquipe.dados.reservas.find(r => r.codigo === botao.dataset.codigo);
  if (!reserva) return;
  const acao = botao.dataset.acaoReserva;
  if (acao === 'zap') return chamarNoZap(reserva);
  if (acao === 'prorrogar') return darMaisDias(reserva, botao);
  if (acao === 'entregar') return marcarEntregue(reserva, botao);
  if (acao === 'cancelar') {
    const resposta = await executarNoItem(botao, 'cancelarReserva', { codigo: reserva.codigo }, 'Cancelando…');
    if (resposta) oferecerDesfazer(`Reserva ${reserva.codigo} cancelada. O item voltou à vitrine.`, resposta);
  }
  if (acao === 'devolver') {
    const resposta = await executarNoItem(botao, 'devolverAVitrine', { codigo: reserva.codigo }, 'Devolvendo…');
    if (resposta) oferecerDesfazer(`O item da reserva ${reserva.codigo} voltou à vitrine.`, resposta);
  }
}

function chamarNoZap(reserva) {
  const pessoa = pessoaPorId(reserva.usuario_id);
  if (!pessoa || !pessoa.telefone) {
    mostrarToast('Essa pessoa não tem WhatsApp cadastrado. Confira em Pessoas.', 'atencao', '📵');
    return;
  }
  const item = estadoEquipe.dados.itens.find(i => i.codigo === reserva.item_codigo) || {};
  const config = estadoEquipe.dados.config;
  const texto = preencherMensagem(config.msg_lembrete, {
    nome: primeiroNome(pessoa.nome), item: item.nome || '', codigo: reserva.codigo,
    validade: formatarDataCompleta(reserva.expira_em), bazar: config.nome_bazar
  });
  window.open(linkWhatsapp(pessoa.telefone, texto), '_blank', 'noopener');
}

async function darMaisDias(reserva, botao) {
  const { valor } = await abrirDialogo({
    titulo: 'Quantos dias a mais?',
    corpo: `<p>Reserva ${esc(reserva.codigo)} de ${esc(reserva.usuario_nome)}.</p>`,
    botoes: [3, 7, 15].map(d => ({ texto: `+ ${d} dias`, valor: d, classe: 'botao-secundario' }))
      .concat([{ texto: 'Voltar', valor: null, classe: 'botao-contorno' }])
  });
  if (!valor) return;
  const resposta = await executarNoItem(botao, 'prorrogarReserva', { codigo: reserva.codigo, dias: valor }, 'Salvando…');
  if (resposta) mostrarToast(`Pronto! Mais ${valor} dias para buscar.`, 'sucesso', '⏰');
}

async function marcarEntregue(reserva, botao) {
  const resposta = await executarNoItem(botao, 'entregarReserva', { codigo: reserva.codigo }, 'Registrando…');
  if (!resposta) return;
  soltarConfete();
  const doMes = resposta.entregues_no_mes;
  mostrarToast(`Boa! 🎉 Mais uma pessoa ajudada. ${doMes === 1 ? 'É a primeira do mês.' : `São ${doMes} esse mês.`}`, 'sucesso');
  if (resposta.entregues_total > 0 && resposta.entregues_total % 50 === 0) {
    mostrarFaixaComemoracao(`🎊 ${resposta.entregues_total} itens entregues! Que orgulho dessa equipe!`);
  }
  oferecerDesfazer(`Entrega da reserva ${reserva.codigo} registrada.`, resposta);
}

async function reservarParaAlguem(item, botao) {
  const pessoas = estadoEquipe.dados.usuarios.filter(u => u.telefone && !u.ban_vigente)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const { valor, campos } = await abrirDialogo({
    titulo: `Reservar ${item.nome}`,
    corpo: `
      <div class="campo"><label class="campo-rotulo" for="rp-pessoa">Pessoa já cadastrada</label>
        <select class="campo-entrada" id="rp-pessoa" name="usuario_id">
          <option value="">— Pessoa nova (preencher abaixo) —</option>
          ${pessoas.map(p => `<option value="${esc(p.id)}">${esc(p.nome)} · ${esc(p.telefone)}</option>`).join('')}
        </select></div>
      <div id="rp-nova">
        <div class="campo"><label class="campo-rotulo" for="rp-nome">Nome</label>
          <input class="campo-entrada" id="rp-nome" name="nome" maxlength="60"></div>
        <div class="campo"><label class="campo-rotulo" for="rp-telefone">WhatsApp</label>
          <input class="campo-entrada" id="rp-telefone" name="telefone" type="tel" inputmode="tel" placeholder="(11) 91234-5678"></div>
      </div>
      <p class="campo-lembrete">Escolha alguém da lista ou preencha nome e WhatsApp.</p>`,
    botoes: [{ texto: '🙋 Reservar', valor: true, classe: 'botao-sucesso' }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }],
    preparar: form => {
      $('#rp-pessoa', form).addEventListener('change', e => { $('#rp-nova', form).hidden = Boolean(e.target.value); });
      $('#rp-telefone', form).addEventListener('input', e => { e.target.value = formatarTelefoneDigitado(e.target.value); });
    },
    validar: form => Boolean($('#rp-pessoa', form).value) || ($('#rp-nome', form).value.trim().length >= 2
      && $('#rp-telefone', form).value.replace(/\D/g, '').length >= 10)
  });
  if (!valor) return;
  const resposta = await executarNoItem(botao, 'reservarParaAlguem', { codigo: item.codigo, ...campos }, 'Reservando…');
  if (resposta) mostrarToast(`Reserva ${resposta.reserva.codigo} feita. Ela aparece em "Esperando retirada".`, 'sucesso', '🙋');
}
