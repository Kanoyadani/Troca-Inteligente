const CHAVES = {
  aparelho: 'ti_aparelho',
  usuario: 'ti_usuario',
  token: 'ti_equipe_token',
  expira: 'ti_equipe_expira',
  nomeEquipe: 'ti_equipe_nome',
  nomesEquipe: 'ti_equipe_nomes',
  vitrine: 'ti_vitrine',
  config: 'ti_config',
  minhas: 'ti_minhas',
  rascunho: 'ti_rascunho_doacao',
  viuBoasVindas: 'ti_viu_boas_vindas'
};

function lerLocal(chave, padrao = null) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch (erro) {
    return padrao;
  }
}

function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (erro) {
    console.warn('Não foi possível guardar no aparelho:', chave);
  }
}

function apagarLocal(chave) {
  try {
    localStorage.removeItem(chave);
  } catch (erro) {
    console.warn('Não foi possível apagar do aparelho:', chave);
  }
}

function gerarUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function idAparelho() {
  let id = lerLocal(CHAVES.aparelho);
  if (!id) {
    id = gerarUuid();
    gravarLocal(CHAVES.aparelho, id);
  }
  return id;
}

function usuarioAtual() {
  return lerLocal(CHAVES.usuario);
}

function guardarUsuario(usuario) {
  gravarLocal(CHAVES.usuario, { id: usuario.id, nome: usuario.nome });
}

function esquecerUsuario() {
  apagarLocal(CHAVES.usuario);
  apagarLocal(CHAVES.minhas);
  apagarLocal(CHAVES.rascunho);
  if (typeof limparRascunho === 'function') limparRascunho();
}

function tokenEquipe() {
  return lerLocal(CHAVES.token, '');
}

function temSessaoEquipe() {
  const expira = lerLocal(CHAVES.expira);
  return Boolean(tokenEquipe()) && Boolean(expira) && new Date(expira).getTime() > Date.now();
}

function guardarSessaoEquipe(token, expira, nomes) {
  gravarLocal(CHAVES.token, token);
  gravarLocal(CHAVES.expira, expira);
  gravarLocal(CHAVES.nomesEquipe, nomes || []);
  apagarLocal(CHAVES.nomeEquipe);
}

function nomeNaEquipe() {
  return lerLocal(CHAVES.nomeEquipe, '');
}

function guardarNomeNaEquipe(nome) {
  gravarLocal(CHAVES.nomeEquipe, nome);
}

function apagarSessaoEquipe() {
  [CHAVES.token, CHAVES.expira, CHAVES.nomeEquipe, CHAVES.nomesEquipe].forEach(apagarLocal);
}
