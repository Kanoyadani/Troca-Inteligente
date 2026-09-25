let mesDoRelatorio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function mesmoMesDe(valor, mes) {
  const d = paraData(valor);
  return Boolean(d) && d.getFullYear() === mes.getFullYear() && d.getMonth() === mes.getMonth();
}

function calcularRelatorio(dados, mes) {
  const porCodigo = new Map(dados.itens.map(i => [i.codigo, i]));
  const entregues = dados.reservas.filter(r => r.situacao === 'ENTREGUE' && mesmoMesDe(r.finalizado_em, mes));
  const porCategoria = new Map();
  entregues.forEach(r => {
    const categoria = (porCodigo.get(r.item_codigo) || {}).categoria || '';
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + 1);
  });
  const barras = dados.config.categorias
    .map(c => ({ categoria: c, total: porCategoria.get(c.id) || 0 }))
    .sort((a, b) => b.total - a.total);
  return {
    recebidos: dados.itens.filter(i => i.situacao !== 'RECUSADO' && mesmoMesDe(i.criado_em, mes)).length,
    entregues: entregues.length,
    pessoas: new Set(entregues.map(r => r.usuario_id)).size,
    campea: barras[0] && barras[0].total ? barras[0].categoria : null,
    barras
  };
}

function fraseDaMeta(feito, meta) {
  if (feito >= meta) return 'meta batida! 🎉';
  const parte = feito / meta;
  if (parte >= 0.75) return 'falta pouco!';
  if (parte >= 0.4) return 'estamos no caminho!';
  return 'vamos juntos!';
}

function mostrarRelatorio() {
  const { corpo } = telaDaEquipe('tela-relatorio', '📊 Relatório do mês');
  const dados = estadoEquipe.dados;
  const r = calcularRelatorio(dados, mesDoRelatorio);
  const meta = Number(dados.config.meta_mensal) || 100;
  const mesPorExtenso = mesDoRelatorio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const nomeDoMes = mesPorExtenso.charAt(0).toUpperCase() + mesPorExtenso.slice(1);
  const maior = Math.max(1, ...r.barras.map(b => b.total));
  const hoje = new Date();
  const eMesAtual = mesDoRelatorio.getFullYear() === hoje.getFullYear() && mesDoRelatorio.getMonth() === hoje.getMonth();
  corpo.innerHTML = `
    <div class="seletor-mes">
      <button type="button" class="botao botao-pequeno botao-contorno" data-mes="-1">◀ Anterior</button>
      <strong>${esc(nomeDoMes)}</strong>
      <button type="button" class="botao botao-pequeno botao-contorno" data-mes="1" ${eMesAtual ? 'disabled' : ''}>Próximo ▶</button>
    </div>
    <div class="card caixa-meta">
      <p><strong>${r.entregues} de ${meta} itens</strong> — ${fraseDaMeta(r.entregues, meta)}</p>
      <div class="barra-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${meta}" aria-valuenow="${r.entregues}">
        <span style="--progresso:${Math.min(100, (r.entregues / meta) * 100)}%"></span></div>
    </div>
    <div class="grade-numeros">
      ${numeroDoRelatorio('📥', r.recebidos, 'itens recebidos', 'var(--atencao)')}
      ${numeroDoRelatorio('🎁', r.entregues, 'itens entregues', 'var(--sucesso)')}
      ${numeroDoRelatorio('🙋', r.pessoas, 'pessoas atendidas', 'var(--secundaria)')}
      <div class="card cartao-numero" style="--cor:var(--primaria)"><span class="emoji" aria-hidden="true">🏆</span>
        <span class="cartao-numero-texto">${r.campea ? `${esc(r.campea.emoji)} ${esc(r.campea.nome)}` : '—'}</span>
        <span>categoria que mais sai</span></div>
    </div>
    <section class="card">
      <h2>Entregas por categoria</h2>
      <div class="grafico-barras">
        ${r.barras.map(b => `
          <div class="barra-linha">
            <span class="barra-rotulo">${esc(b.categoria.emoji)} ${esc(b.categoria.nome)}</span>
            <span class="barra-trilho"><span class="barra" style="--cor:${esc(b.categoria.cor)};--tamanho:${(b.total / maior) * 100}%"></span></span>
            <strong class="barra-valor">${b.total}</strong>
          </div>`).join('')}
      </div>
    </section>`;
  $$('[data-numero]', corpo).forEach(el => animarNumero(el, el.dataset.numero));
  $$('[data-mes]', corpo).forEach(b => b.addEventListener('click', () => {
    mesDoRelatorio = new Date(mesDoRelatorio.getFullYear(), mesDoRelatorio.getMonth() + Number(b.dataset.mes), 1);
    mostrarRelatorio();
  }));
}

function numeroDoRelatorio(emoji, valor, rotulo, cor) {
  return `<div class="card cartao-numero" style="--cor:${cor}"><span class="emoji" aria-hidden="true">${emoji}</span>
    <span class="numero-destaque" data-numero="${valor}">0</span><span>${rotulo}</span></div>`;
}

async function mostrarRegistro() {
  const { corpo } = telaDaEquipe('tela-registro', '📜 Registro de ações');
  corpo.innerHTML = `
    <label class="busca"><i class="ph-duotone ph-magnifying-glass" aria-hidden="true"></i>
      <input type="search" id="busca-registro" placeholder="Nome, ação ou código" aria-label="Procurar no registro"></label>
    <div class="lista" id="lista-registro">${esqueletosDeLista(6)}</div>`;
  let registro = [];
  const desenhar = () => {
    const termo = normalizarBusca($('#busca-registro', corpo).value.trim());
    const lista = registro.filter(l => !termo || normalizarBusca(`${l.nome_pessoa} ${l.acao} ${l.alvo} ${l.detalhe}`).includes(termo));
    $('#lista-registro', corpo).innerHTML = lista.length ? `<ol class="linha-do-tempo">${lista.map(l => `
      <li>
        <span class="texto-suave">${esc(formatarDataHora(l.data_hora))}</span>
        <p><strong>${esc(l.nome_pessoa || '—')}</strong> ${esc(l.acao)} ${l.alvo ? `<strong>${esc(l.alvo)}</strong>` : ''}</p>
        ${l.detalhe ? `<p class="texto-suave">${esc(l.detalhe)}</p>` : ''}
      </li>`).join('')}</ol>`
      : telaVazia({ ilustracao: 'busca', frase: termo ? 'Nada encontrado com essa busca.' : 'Nenhuma ação registrada ainda.' });
  };
  $('#busca-registro', corpo).addEventListener('input', desenhar);
  try {
    registro = (await chamarEquipe('listarLog')).log;
    if (corpo.isConnected) desenhar();
  } catch (erro) {
    if (corpo.isConnected) $('#lista-registro', corpo).innerHTML = telaVazia({ ilustracao: 'busca', frase: erro.message });
  }
}
