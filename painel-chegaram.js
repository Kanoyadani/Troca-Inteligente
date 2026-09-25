let recusaRecente = null;

function mostrarChegaram() {
  const { corpo } = telaDaEquipe('tela-chegaram', '📥 Chegaram para conferir');
  const dados = estadoEquipe.dados;
  const pendentes = dados.itens.filter(i => i.situacao === 'AGUARDANDO')
    .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  corpo.innerHTML = avisoDeRecusa() + (pendentes.length
    ? pendentes.map((item, i) => cartaoParaConferir(item, dados, i)).join('')
    : telaVazia({ ilustracao: 'festa', frase: 'Tudo conferido! Nenhuma doação esperando por enquanto.',
      botaoTexto: '🏠 Voltar ao painel', botaoHref: '#equipe' }));
  corpo.addEventListener('click', evento => {
    const aprovar = evento.target.closest('[data-aprovar]');
    const recusar = evento.target.closest('[data-recusar]');
    if (aprovar) aprovarDoacao(aprovar);
    if (recusar) recusarDoacao(recusar);
    if (evento.target.closest('[data-fechar-aviso]')) {
      recusaRecente = null;
      evento.target.closest('.aviso-recusa').remove();
    }
  });
}

function pessoaPorId(id) {
  return estadoEquipe.dados.usuarios.find(u => u.id === id) || null;
}

function cartaoParaConferir(item, dados, ordem) {
  const categoria = categoriaPorId(item.categoria, dados.config.categorias);
  const doador = pessoaPorId(item.doador_id);
  return `
    <article class="card cartao-conferir entrar" style="--ordem:${Math.min(ordem, 8)}">
      <img class="foto-grande" src="${esc(urlDeFoto(item.foto_url))}" alt="Foto: ${esc(item.nome)}">
      <div class="cartao-conferir-corpo">
        <p class="texto-suave">${esc(item.codigo)} · chegou ${esc(formatarDataHora(item.criado_em))}</p>
        <h2>${esc(item.nome)}</h2>
        <span class="etiqueta" style="--cor:${esc(categoria.cor)}">${esc(categoria.emoji)} ${esc(categoria.nome)}</span>
        <p class="descricao-completa">${esc(item.descricao)}</p>
        <div class="caixa-doador">
          <p>🙋 Doado por <strong>${esc(item.doador_nome)}</strong></p>
          ${doador && doador.telefone ? `<a class="botao botao-pequeno botao-secundario" target="_blank" rel="noopener"
            href="${esc(linkWhatsapp(doador.telefone, ''))}">💬 ${esc(doador.telefone)}</a>` : ''}
        </div>
        <div class="botoes-lado-a-lado">
          <button type="button" class="botao botao-sucesso" data-aprovar="${esc(item.codigo)}">✅ Aprovar</button>
          <button type="button" class="botao botao-perigo" data-recusar="${esc(item.codigo)}">❌ Recusar</button>
        </div>
      </div>
    </article>`;
}

function avisoDeRecusa() {
  const item = recusaRecente && estadoEquipe.dados.itens.find(i => i.codigo === recusaRecente.codigo);
  if (!item || item.situacao !== 'RECUSADO') {
    recusaRecente = null;
    return '';
  }
  return `
    <div class="card aviso-recusa entrar">
      <p>Doação <strong>${esc(recusaRecente.codigo)}</strong> recusada. Quer avisar ${esc(primeiroNome(recusaRecente.nome))}?</p>
      <div class="botoes-lado-a-lado">
        <a class="botao botao-pequeno botao-secundario" target="_blank" rel="noopener" href="${esc(recusaRecente.link)}">💬 Avisar no Zap</a>
        <button type="button" class="botao botao-pequeno botao-contorno" data-fechar-aviso>Agora não</button>
      </div>
    </div>`;
}

async function aprovarDoacao(botao) {
  const liberar = botaoOcupado(botao, 'Aprovando…');
  try {
    aplicarResposta(await chamarEquipe('aprovarItem', { codigo: botao.dataset.aprovar }));
    vibrar();
    mostrarToast('Aprovada! Já está na vitrine.', 'sucesso', '✅');
  } catch (erro) {
    liberar();
    mostrarErro(erro);
    if (erro.codigo !== 'SESSAO') atualizarEquipeEmSilencio();
  }
}

const MOTIVOS_RAPIDOS = ['Item danificado', 'Não aceitamos esse tipo de item', 'A foto não mostra o item', 'Item repetido'];

async function recusarDoacao(botao) {
  const codigo = botao.dataset.recusar;
  const { valor, campos } = await abrirDialogo({
    titulo: 'Por que recusar?',
    corpo: `
      <div class="pilulas pilulas-quebra">${MOTIVOS_RAPIDOS.map(m => `<button type="button" class="pilula" data-motivo="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <div class="campo">
        <label class="campo-rotulo" for="motivo">Motivo</label>
        <textarea class="campo-entrada" id="motivo" name="motivo" maxlength="200" placeholder="Toque num motivo acima ou escreva aqui"></textarea>
        <span class="campo-lembrete" id="lembrete-motivo">Escreva o motivo para continuar.</span>
      </div>`,
    botoes: [{ texto: '❌ Recusar doação', valor: true, classe: 'botao-perigo' }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }],
    preparar: form => form.addEventListener('click', evento => {
      const pilula = evento.target.closest('[data-motivo]');
      if (pilula) $('#motivo', form).value = pilula.dataset.motivo;
    }),
    validar: form => $('#motivo', form).value.trim().length >= 3
  });
  if (!valor) return;
  const item = estadoEquipe.dados.itens.find(i => i.codigo === codigo) || {};
  const doador = pessoaPorId(item.doador_id);
  const liberar = botaoOcupado(botao, 'Recusando…');
  try {
    const resposta = await chamarEquipe('recusarItem', { codigo, motivo: campos.motivo });
    const config = estadoEquipe.dados.config;
    recusaRecente = doador && doador.telefone ? {
      codigo, nome: doador.nome,
      link: linkWhatsapp(doador.telefone, preencherMensagem(config.msg_recusa,
        { nome: primeiroNome(doador.nome), item: item.nome, motivo: campos.motivo.trim(), bazar: config.nome_bazar, codigo }))
    } : null;
    aplicarResposta(resposta);
    oferecerDesfazer(`Doação ${codigo} recusada.`, resposta);
  } catch (erro) {
    if (botao.isConnected) liberar();
    mostrarErro(erro);
  }
}

async function atualizarEquipeEmSilencio() {
  const antes = JSON.stringify(estadoEquipe.dados);
  try {
    await carregarDadosEquipe();
    if (JSON.stringify(estadoEquipe.dados) !== antes) aplicarResposta(null);
  } catch (erro) {
    console.warn('Não deu para atualizar a lista agora.');
  }
}
