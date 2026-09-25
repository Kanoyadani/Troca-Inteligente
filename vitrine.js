const vitrine = {
  itens: [],
  versao: '',
  salvoEm: null,
  semConexao: false,
  categoria: 'todas',
  busca: '',
  buscaAberta: false
};

(function carregarCopiaGuardada() {
  const copia = lerLocal(CHAVES.vitrine);
  if (copia) Object.assign(vitrine, { itens: copia.itens || [], versao: copia.versao || '', salvoEm: copia.salvoEm });
})();

function mostrarVitrine() {
  const raiz = novaTela('tela-vitrine');
  const buscaAberta = vitrine.buscaAberta || Boolean(vitrine.busca.trim());
  raiz.innerHTML = `
    <header class="cabecalho-app">
      <div class="cabecalho-marca">
        <h1 class="logotipo">${nomeEmDuasLinhas()}</h1>
        <p class="assinatura">passa adiante</p>
      </div>
      <button type="button" class="botao-circulo" id="abrir-busca" aria-label="Procurar item"
        aria-controls="caixa-busca" aria-expanded="${buscaAberta}"><i class="ph ph-magnifying-glass" aria-hidden="true"></i></button>
    </header>
    <div class="aviso-conexao" id="aviso-conexao" role="status" hidden></div>
    <label class="busca" id="caixa-busca" ${buscaAberta ? '' : 'hidden'}>
      <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
      <input type="search" id="busca" placeholder="Procurar: casaco, livro, tênis…" aria-label="Procurar item"
        value="${esc(vitrine.busca)}" enterkeyhint="search">
    </label>
    <div class="pilulas" id="pilulas" role="group" aria-label="Filtrar por categoria"></div>
    <p class="contador-itens" id="contador" aria-live="polite"></p>
    <div class="grade-itens" id="grade">${vitrine.salvoEm ? '' : esqueletosDeCards()}</div>`;

  $('#abrir-busca', raiz).addEventListener('click', evento => alternarBusca(raiz, evento.currentTarget));
  $('#busca', raiz).addEventListener('input', evento => {
    vitrine.busca = evento.target.value;
    desenharItens(raiz, false);
  });
  $('#pilulas', raiz).addEventListener('click', evento => {
    const pilula = evento.target.closest('[data-categoria]');
    if (!pilula) return;
    vitrine.categoria = pilula.dataset.categoria;
    desenharPilulas(raiz);
    desenharItens(raiz, true);
  });
  $('#grade', raiz).addEventListener('click', evento => {
    if (!evento.target.closest('#ver-tudo')) return;
    vitrine.busca = '';
    vitrine.categoria = 'todas';
    mostrarVitrine();
  });

  const temCopia = Boolean(vitrine.salvoEm);
  if (temCopia) desenharTudo(raiz, true);
  atualizarVitrine(raiz, !temCopia);
  iniciarAtualizacaoAutomatica(() => atualizarVitrine(raiz, false));
  definirPuxarParaAtualizar(() => atualizarVitrine(raiz, false));
}

function alternarBusca(raiz, botao) {
  const caixa = $('#caixa-busca', raiz);
  vitrine.buscaAberta = caixa.hidden;
  caixa.hidden = !vitrine.buscaAberta;
  botao.setAttribute('aria-expanded', String(vitrine.buscaAberta));
  if (vitrine.buscaAberta) {
    $('#busca', raiz).focus();
  } else if (vitrine.busca) {
    vitrine.busca = '';
    $('#busca', raiz).value = '';
    desenharItens(raiz, false);
  }
}

async function atualizarVitrine(raiz, precisaDesenhar) {
  const estavaSemConexao = vitrine.semConexao;
  let mudou = false;
  try {
    const resposta = await chamarServidor('vitrine', { versao: vitrine.versao });
    vitrine.semConexao = false;
    vitrine.salvoEm = Date.now();
    if (resposta.mudou) {
      mudou = true;
      vitrine.itens = resposta.itens;
      vitrine.versao = resposta.versao;
      aplicarConfigPublica(resposta.config);
    }
    gravarLocal(CHAVES.vitrine, { itens: vitrine.itens, versao: vitrine.versao, salvoEm: vitrine.salvoEm });
  } catch (erro) {
    vitrine.semConexao = true;
  }
  if (!raiz.isConnected) return;
  if (mudou || precisaDesenhar || estavaSemConexao !== vitrine.semConexao) desenharTudo(raiz, precisaDesenhar);
}

function desenharTudo(raiz, animar) {
  desenharAvisoDeConexao(raiz);
  desenharPilulas(raiz);
  desenharItens(raiz, animar);
}

function desenharAvisoDeConexao(raiz) {
  const aviso = $('#aviso-conexao', raiz);
  aviso.hidden = !vitrine.semConexao;
  if (!vitrine.semConexao) return;
  aviso.innerHTML = vitrine.salvoEm
    ? `📡 Sem conexão — mostrando a lista das ${esc(formatarHora(vitrine.salvoEm))}. Para reservar, conecte-se à internet.`
    : '📡 Sem conexão. Conecte-se à internet para ver a vitrine.';
}

function desenharPilulas(raiz) {
  const categorias = categoriasPublicas();
  if (vitrine.categoria !== 'todas' && !categorias.some(c => c.id === vitrine.categoria)) vitrine.categoria = 'todas';
  const pilula = (id, rotulo, estilo) => `
    <button type="button" class="pilula ${vitrine.categoria === id ? 'ativa' : ''}" data-categoria="${esc(id)}"
      aria-pressed="${vitrine.categoria === id}" ${estilo ? `style="${estilo}"` : ''}>${rotulo}</button>`;
  $('#pilulas', raiz).innerHTML = pilula('todas', '✨ Tudo', '')
    + categorias.map(c => pilula(c.id, `<span aria-hidden="true">${esc(c.emoji)}</span> ${esc(c.nome)}`, coresDaCategoria(c))).join('');
}

function dataDoItem(item) {
  const data = paraData(item.aprovado_em || item.criado_em);
  return data ? data.getTime() : 0;
}

function itensFiltrados() {
  const termo = vitrine.busca;
  return vitrine.itens
    .filter(item => (vitrine.categoria === 'todas' || item.categoria === vitrine.categoria) &&
      (!normalizarBusca(termo) || combinaBusca(`${item.nome} ${item.descricao} ${item.codigo}`, termo)))
    .sort((a, b) => dataDoItem(b) - dataDoItem(a));
}

function desenharItens(raiz, animar) {
  const grade = $('#grade', raiz);
  const contador = $('#contador', raiz);
  if (!vitrine.salvoEm) {
    contador.textContent = '';
    grade.innerHTML = telaVazia({ ilustracao: 'busca', frase: 'Sem conexão agora. Assim que a internet voltar, a vitrine aparece aqui.' });
    return;
  }
  const lista = itensFiltrados();
  contador.textContent = lista.length === 1 ? '1 item disponível' : `${lista.length} itens disponíveis`;
  contador.hidden = lista.length === 0;
  grade.classList.toggle('grade-vazia', lista.length === 0);
  grade.innerHTML = lista.length
    ? lista.map((item, i) => cardDoItem(item, animar ? i : -1)).join('')
    : mensagemDeVitrineVazia();
}

function mensagemDeVitrineVazia() {
  const doar = '<a class="botao botao-doar" href="#doar">🎁 Doar agora</a>';
  if (vitrine.busca.trim()) {
    return telaVazia({ ilustracao: 'busca', frase: `Não achamos nada com “${vitrine.busca.trim().replace(/\s+/g, ' ')}”. Tente outra palavra.`,
      botaoTexto: 'Ver todas as categorias', botaoId: 'ver-tudo' });
  }
  if (vitrine.categoria !== 'todas') {
    const categoria = categoriaPorId(vitrine.categoria, categoriasPublicas());
    return telaVazia({ ilustracao: 'caixa', frase: `Ainda não tem ${categoria.nome} por aqui. Dê uma olhada no resto da vitrine!`,
      botaoTexto: '✨ Ver todas as categorias', botaoId: 'ver-tudo',
      extra: '<a class="link-discreto" href="#doar">ou doe o primeiro item desta categoria</a>' });
  }
  return telaVazia({ ilustracao: 'presente', frase: 'A vitrine está vazia por enquanto. Que tal doar a primeira coisa?', extra: doar });
}

function eNovo(item) {
  const aprovado = paraData(item.aprovado_em);
  return aprovado && Date.now() - aprovado.getTime() < 24 * 60 * 60 * 1000;
}

function cardDoItem(item, ordem) {
  const primeiraLinha = String(item.descricao || '').split('\n')[0];
  const categoria = categoriaPorId(item.categoria, categoriasPublicas());
  return `
    <a class="card-item ${ordem >= 0 ? 'entrar' : ''}" href="#reservar/${esc(encodeURIComponent(item.codigo))}"
      style="--ordem:${Math.min(ordem, 12)};${coresDaCategoria(categoria)}">
      <div class="card-item-foto">
        <span class="card-item-blob" aria-hidden="true"></span>
        <img src="${esc(urlDeFoto(item.foto_url))}" alt="Foto: ${esc(item.nome)}" loading="lazy">
      </div>
      <span class="card-item-codigo">${esc(item.codigo)}</span>
      <div class="card-item-corpo">
        ${eNovo(item) ? '<span class="pilula-novo">NOVO</span>' : ''}
        <h3 class="card-item-nome">${esc(item.nome)}</h3>
        <p class="card-item-descricao">${esc(primeiraLinha)}</p>
        <p class="card-item-doador">Doado por: ${esc(item.doador || 'alguém especial')}</p>
      </div>
    </a>`;
}

function tirarDaVitrineLocal(codigo) {
  vitrine.itens = vitrine.itens.filter(i => i.codigo !== codigo);
  vitrine.versao = '';
  gravarLocal(CHAVES.vitrine, { itens: vitrine.itens, versao: '', salvoEm: vitrine.salvoEm });
}
