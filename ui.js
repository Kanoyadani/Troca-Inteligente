const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

function esc(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function urlDeFoto(url) {
  const texto = String(url || '');
  if (/^https:\/\//.test(texto) || texto.startsWith('data:image/') || texto.startsWith(location.origin + '/')) return texto;
  return 'sem-foto.svg';
}

const ROTULOS_ITEM = {
  AGUARDANDO: ['⏳', 'Em análise', 'aguardando'],
  DISPONIVEL: ['✅', 'Aprovado', 'disponivel'],
  RESERVADO: ['🙋', 'Reservado', 'reservado'],
  ENTREGUE: ['🎁', 'Entregue', 'entregue'],
  ARQUIVADO: ['📦', 'Arquivado', 'arquivado'],
  RECUSADO: ['❌', 'Não aceito', 'recusado']
};

const ROTULOS_RESERVA = {
  AGUARDANDO: ['⏳', 'Esperando retirada', 'aguardando'],
  ENTREGUE: ['🎁', 'Retirado', 'entregue'],
  CANCELADA: ['❌', 'Cancelada', 'recusado'],
  EXPIRADA: ['⌛', 'Venceu', 'arquivado']
};

function etiqueta(rotulos, situacao, textoNoLugar) {
  const [emoji, texto, classe] = rotulos[situacao] || ['•', situacao, 'arquivado'];
  return `<span class="etiqueta etiqueta-${classe}">${emoji} ${esc(textoNoLugar || texto)}</span>`;
}

function categoriaPorId(id, lista) {
  return (lista || []).find(c => c.id === id) || { id, nome: 'Sem categoria', emoji: '📦', cor: '#8D6E63' };
}

function paraData(valor) {
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

function formatarData(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
}

function formatarDataCompleta(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '';
}

function formatarHora(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : '';
}

function formatarDataHora(valor) {
  return valor ? `${formatarData(valor)} às ${formatarHora(valor)}` : '';
}

function diasAte(valor) {
  const d = paraData(valor);
  if (!d) return 0;
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((alvo - inicio) / 86400000);
}

function textoDeDias(n) {
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

function normalizarBusca(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function quaseIgual(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i >= Math.min(a.length, b.length)) return true;
  const inverteu = a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  return inverteu || a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}

function combinaBusca(texto, termo) {
  const alvo = normalizarBusca(texto);
  const palavrasAlvo = alvo.split(' ');
  return normalizarBusca(termo).split(' ').filter(Boolean).every(palavra => alvo.includes(palavra)
    || (palavra.length >= 4 && palavrasAlvo.some(p => quaseIgual(p, palavra) || quaseIgual(p.slice(0, palavra.length), palavra))));
}

const PASTEIS = { '#FF6B35': '#FFE4D6', '#7B61FF': '#E8E2FF', '#2EC4B6': '#D6F5F0', '#EF476F': '#FFE0E9', '#118AB2': '#DCEEF7', '#06D6A0': '#DAF5E9' };

function coresDaCategoria(categoria) {
  const cor = String((categoria && categoria.cor) || '').toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(cor)) return '--cor:#1F6F5C;--pastel:#E8F3EF';
  return `--cor:${cor};--pastel:${PASTEIS[cor] || `color-mix(in srgb, ${cor} 18%, white)`}`;
}

let relogioToast = null;
let numeroToast = 0;

function mostrarToast(mensagem, tipo = '', emoji = '') {
  const toast = $('#toast');
  toast.className = `toast ${tipo ? 'toast-' + tipo : ''}`;
  toast.innerHTML = `${emoji ? `<span class="emoji" aria-hidden="true">${emoji}</span>` : ''}<span>${esc(mensagem)}</span>`;
  const numero = ++numeroToast;
  requestAnimationFrame(() => { if (numero === numeroToast) toast.classList.add('visivel'); });
  clearTimeout(relogioToast);
  relogioToast = setTimeout(() => {
    numeroToast++;
    toast.classList.remove('visivel');
  }, tipo === 'erro' ? 6000 : 4000);
}

function mostrarErro(erro) {
  mostrarToast(erro && erro.message ? erro.message : 'Algo deu errado. Tente de novo.', 'erro', '⚠️');
}

let relogioDesfazer = null;

function mostrarDesfazer(texto, aoDesfazer) {
  const barra = $('#desfazer');
  clearTimeout(relogioDesfazer);
  barra.classList.remove('visivel');
  void barra.offsetWidth;
  $('span', barra).textContent = texto;
  const botao = $('button', barra);
  botao.disabled = false;
  botao.onclick = async () => {
    botao.disabled = true;
    esconderDesfazer();
    await aoDesfazer();
  };
  barra.classList.add('visivel');
  document.body.classList.add('com-desfazer');
  relogioDesfazer = setTimeout(esconderDesfazer, 10000);
}

function esconderDesfazer() {
  clearTimeout(relogioDesfazer);
  $('#desfazer').classList.remove('visivel');
  document.body.classList.remove('com-desfazer');
}

function vibrar() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function soltarConfete() {
  if (typeof confetti !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 },
    colors: ['#FF6B35', '#2EC4B6', '#06D6A0', '#FFD166', '#EF476F', '#7B61FF'] });
}

function animarNumero(elemento, alvo) {
  const final = Number(alvo) || 0;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || final === 0) {
    elemento.textContent = final;
    return;
  }
  const inicio = performance.now();
  const duracao = 700;
  const passo = agora => {
    const t = Math.min((agora - inicio) / duracao, 1);
    elemento.textContent = Math.round(final * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

function botaoOcupado(botao, texto = 'Enviando…') {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.setAttribute('aria-busy', 'true');
  botao.innerHTML = esc(texto);
  return () => {
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
    botao.innerHTML = original;
  };
}

function linkWhatsapp(telefone, texto) {
  let digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length <= 11) digitos = '55' + digitos;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto || '')}`;
}

function preencherMensagem(modelo, valores) {
  return String(modelo || '').replace(/\{(\w+)\}/g, (inteiro, chave) => (chave in valores ? valores[chave] : inteiro));
}

function baixarArquivo(nome, conteudo) {
  const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
}

function formatarTelefoneDigitado(texto) {
  const d = String(texto || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const meio = d.length > 10 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}
