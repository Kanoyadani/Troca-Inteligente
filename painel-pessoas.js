let buscaPessoas = '';

function mostrarPessoas(aba) {
  const banidos = aba === 'banidos';
  const { corpo } = telaDaEquipe('tela-pessoas', '👥 Pessoas');
  corpo.innerHTML = `
    <div class="abas" role="tablist">
      <a class="aba ${banidos ? '' : 'ativa'}" role="tab" aria-selected="${!banidos}" href="#equipe/pessoas">Todas</a>
      <a class="aba ${banidos ? 'ativa' : ''}" role="tab" aria-selected="${banidos}" href="#equipe/pessoas/banidos">🚫 Banidos</a>
    </div>
    <label class="busca"><i class="ph-duotone ph-magnifying-glass" aria-hidden="true"></i>
      <input type="search" id="busca-pessoas" placeholder="Nome ou telefone" aria-label="Procurar pessoa" value="${esc(buscaPessoas)}"></label>
    <div class="lista" id="lista-pessoas"></div>`;
  const desenhar = () => desenharPessoas($('#lista-pessoas', corpo), banidos);
  $('#busca-pessoas', corpo).addEventListener('input', e => { buscaPessoas = e.target.value; desenhar(); });
  $('#lista-pessoas', corpo).addEventListener('click', tratarCliqueNaPessoa);
  desenhar();
}

function contarDaPessoa(id) {
  const { itens, reservas } = estadoEquipe.dados;
  return {
    doacoes: itens.filter(i => i.doador_id === id).length,
    reservas: reservas.filter(r => r.usuario_id === id).length
  };
}

function desenharPessoas(lista, banidos) {
  const termo = normalizarBusca(buscaPessoas.trim());
  const digitos = buscaPessoas.replace(/\D/g, '');
  const pessoas = estadoEquipe.dados.usuarios
    .filter(p => p.nome !== '(dados apagados)')
    .filter(p => (banidos ? Boolean(p.ban_vigente) : true))
    .filter(p => !termo || normalizarBusca(p.nome).includes(termo) || (digitos && String(p.telefone).replace(/\D/g, '').includes(digitos)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  if (!pessoas.length) {
    lista.innerHTML = telaVazia({ ilustracao: banidos ? 'festa' : 'busca',
      frase: banidos ? 'Ninguém banido. Que bom!' : 'Ninguém encontrado. Tente outro nome ou telefone.' });
    return;
  }
  lista.innerHTML = pessoas.map((p, i) => cartaoDePessoa(p, i)).join('');
}

function cartaoDePessoa(pessoa, ordem) {
  const conta = contarDaPessoa(pessoa.id);
  const ban = pessoa.ban_vigente;
  const id = esc(pessoa.id);
  return `
    <article class="card cartao-pessoa entrar ${ban ? 'pessoa-banida' : ''}" style="--ordem:${Math.min(ordem, 8)}">
      <h3>${esc(pessoa.nome)} ${ban ? '<span class="etiqueta etiqueta-recusado">🚫 Acesso suspenso</span>' : ''}</h3>
      <p>${pessoa.telefone ? `<a href="${esc(linkWhatsapp(pessoa.telefone, ''))}" target="_blank" rel="noopener">💬 ${esc(pessoa.telefone)}</a>` : '<span class="texto-suave">Sem telefone</span>'}</p>
      <p class="texto-suave">Entrou em ${esc(formatarData(pessoa.criado_em)) || '—'} · último acesso ${esc(formatarData(pessoa.ultimo_acesso)) || '—'}</p>
      <p>🎁 ${conta.doacoes} ${conta.doacoes === 1 ? 'doação' : 'doações'} · 🙋 ${conta.reservas} ${conta.reservas === 1 ? 'reserva' : 'reservas'}</p>
      ${ban ? `<p><strong>Motivo:</strong> ${esc(ban.motivo)}<br><strong>Até:</strong> ${ban.ate === 'PERMANENTE' ? 'sem data para acabar' : esc(formatarDataCompleta(ban.ate))}</p>` : ''}
      <div class="grade-acoes">
        <button type="button" class="botao botao-pequeno botao-contorno" data-pessoa="ver" data-id="${id}">📋 Ver tudo</button>
        ${ban ? `<button type="button" class="botao botao-pequeno botao-sucesso" data-pessoa="desbanir" data-id="${id}">✅ Desbanir</button>`
          : `<button type="button" class="botao botao-pequeno botao-perigo" data-pessoa="banir" data-id="${id}">⚠️ Banir</button>`}
      </div>
    </article>`;
}

async function tratarCliqueNaPessoa(evento) {
  const botao = evento.target.closest('[data-pessoa]');
  if (!botao) return;
  const pessoa = pessoaPorId(botao.dataset.id);
  if (!pessoa) return;
  if (botao.dataset.pessoa === 'ver') verTudoDaPessoa(pessoa);
  if (botao.dataset.pessoa === 'banir') banirPessoa(pessoa, botao);
  if (botao.dataset.pessoa === 'desbanir') {
    const resposta = await executarNoItem(botao, 'desbanirPessoa', { id: pessoa.id }, 'Desbanindo…');
    if (resposta) mostrarToast(`${primeiroNome(pessoa.nome)} pode usar o app de novo.`, 'sucesso', '✅');
  }
}

function verTudoDaPessoa(pessoa) {
  const { itens, reservas } = estadoEquipe.dados;
  const doacoes = itens.filter(i => i.doador_id === pessoa.id).reverse();
  const daPessoa = reservas.filter(r => r.usuario_id === pessoa.id).reverse();
  const nomeDoItem = codigo => (itens.find(i => i.codigo === codigo) || {}).nome || codigo;
  abrirDialogo({
    titulo: pessoa.nome,
    corpo: `
      <h3>🎁 Doações (${doacoes.length})</h3>
      ${doacoes.length ? `<ul class="lista-simples">${doacoes.map(i => `<li>${esc(i.codigo)} · ${esc(i.nome)} ${etiqueta(ROTULOS_ITEM, i.situacao)}</li>`).join('')}</ul>`
        : '<p class="texto-suave">Nenhuma doação.</p>'}
      <h3>🙋 Reservas (${daPessoa.length})</h3>
      ${daPessoa.length ? `<ul class="lista-simples">${daPessoa.map(r => `<li>${esc(r.codigo)} · ${esc(nomeDoItem(r.item_codigo))} · ${esc(formatarData(r.reservado_em))} ${etiqueta(ROTULOS_RESERVA, r.situacao)}</li>`).join('')}</ul>`
        : '<p class="texto-suave">Nenhuma reserva.</p>'}`,
    botoes: [{ texto: 'Fechar', valor: null, classe: 'botao-contorno' }]
  });
}

async function banirPessoa(pessoa, botao) {
  const pendentes = estadoEquipe.dados.itens.filter(i => i.doador_id === pessoa.id && i.situacao === 'AGUARDANDO').length;
  const { valor, campos } = await abrirDialogo({
    titulo: `Banir ${pessoa.nome}?`,
    corpo: `
      <div class="campo"><label class="campo-rotulo" for="ban-motivo">Motivo (a pessoa vai ler)</label>
        <textarea class="campo-entrada" id="ban-motivo" name="motivo" maxlength="200"></textarea>
        <span class="campo-lembrete">Escreva o motivo para continuar.</span></div>
      <fieldset class="campo escolha-prazo"><legend class="campo-rotulo">Por quanto tempo?</legend>
        <label><input type="radio" name="prazo" value="7" checked> 7 dias</label>
        <label><input type="radio" name="prazo" value="30"> 30 dias</label>
        <label><input type="radio" name="prazo" value="PERMANENTE"> Permanente</label>
      </fieldset>
      ${pendentes ? `<p class="aviso-conexao">${pendentes} ${pendentes === 1 ? 'doação desta pessoa ainda não conferida será recusada' : 'doações desta pessoa ainda não conferidas serão recusadas'}. As que já estão na vitrine continuam lá.</p>` : ''}`,
    botoes: [{ texto: '⚠️ Banir', valor: true, classe: 'botao-perigo' }, { texto: 'Voltar', valor: null, classe: 'botao-contorno' }],
    validar: form => $('#ban-motivo', form).value.trim().length >= 3
  });
  if (!valor) return;
  const resposta = await executarNoItem(botao, 'banirPessoa', { id: pessoa.id, motivo: campos.motivo, prazo: campos.prazo }, 'Enviando…');
  if (resposta) mostrarToast(`Pronto. O acesso de ${primeiroNome(pessoa.nome)} foi suspenso.`, 'sucesso', '🚫');
}
