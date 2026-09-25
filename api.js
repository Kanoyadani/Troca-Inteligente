class ErroDoServidor extends Error {
  constructor(mensagem, codigo = '', extra = null, semConexao = false) {
    super(mensagem);
    this.codigo = codigo;
    this.extra = extra;
    this.semConexao = semConexao;
  }
}

function servidorConfigurado() {
  return /^https?:\/\//.test(CONFIG.URL_SERVIDOR);
}

async function chamarServidor(acao, dados = {}, opcoes = {}) {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), opcoes.tempoLimite || CONFIG.TEMPO_LIMITE_MS);
  let resposta;
  try {
    const http = await fetch(CONFIG.URL_SERVIDOR, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, dados }),
      signal: controle.signal,
      redirect: 'follow'
    });
    resposta = await lerJson(http);
  } catch (erro) {
    if (erro instanceof ErroDoServidor) throw erro;
    if (erro.name === 'AbortError') {
      throw new ErroDoServidor('A internet está lenta e a resposta não chegou. Espere um pouco e tente de novo.', 'SEM_CONEXAO', null, true);
    }
    throw new ErroDoServidor('Sem conexão com a internet. Confira o Wi-Fi ou os dados móveis e tente de novo.', 'SEM_CONEXAO', null, true);
  } finally {
    clearTimeout(limite);
  }
  if (!resposta || !resposta.ok) {
    throw new ErroDoServidor((resposta && resposta.erro) || 'Algo deu errado. Espere um minutinho e tente de novo.',
      resposta && resposta.codigo, resposta && resposta.extra);
  }
  return resposta;
}

async function lerJson(http) {
  const texto = await http.text();
  try {
    return JSON.parse(texto);
  } catch (erro) {
    throw new ErroDoServidor('O servidor respondeu de um jeito inesperado. Tente de novo; se continuar, avise a equipe para conferir a instalação.');
  }
}

async function chamarPublico(acao, dados = {}, opcoes = {}) {
  try {
    return await chamarServidor(acao, { ...dados, id_aparelho: idAparelho() }, opcoes);
  } catch (erro) {
    if (erro.codigo === 'BANIDO') {
      estado.banido = erro.extra;
      mostrarTelaBanido(erro.extra);
    } else if (erro.codigo === 'SEM_CADASTRO') {
      esquecerUsuario();
      mostrarTelaIdentificacao();
    }
    throw erro;
  }
}

async function chamarEquipe(acao, dados = {}, opcoes = {}) {
  try {
    return await chamarServidor(acao, { ...dados, token: tokenEquipe() }, opcoes);
  } catch (erro) {
    if (erro.codigo === 'SESSAO') {
      apagarSessaoEquipe();
      estadoEquipe.dados = null;
      mostrarToast(erro.message, 'atencao', '🔒');
      irPara('#equipe');
    } else if (erro.codigo === 'SEM_NOME') {
      irPara('#equipe/quem');
    }
    throw erro;
  }
}
