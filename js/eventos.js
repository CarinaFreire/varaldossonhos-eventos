// js/eventos.js

const API_URL = '/api/eventos';

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

/* ====== datas SEM bug de -1 dia ====== */
function formatDate(d) {
  if (!d) return '-';
  // se vier como 'YYYY-MM-DD', não criamos Date()
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd2 = String(date.getDate()).padStart(2, '0');
  return `${dd2}/${m}/${y}`;
}

function sortEventos(evts) {
  return evts.slice().sort((a, b) => {
    const sa = statusOrder[a.status_evento] ?? 99;
    const sb = statusOrder[b.status_evento] ?? 99;
    if (sa !== sb) return sa - sb;

    const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
    const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
    return da - db;
  });
}

/* =======================
   Lightbox (imagens)
   ======================= */
const lightbox = (() => {
  let box, imgEl, prevBtn, nextBtn, closeBtn;
  let imgs = [], idx = 0;
  let mounted = false;

  function mount() {
    if (mounted) return true;
    box = document.getElementById('lightbox');
    if (!box) return false;

    imgEl   = box.querySelector('.lb-img');
    prevBtn = box.querySelector('.lb-prev');
    nextBtn = box.querySelector('.lb-next');
    closeBtn= box.querySelector('.lb-close');

    function show() { imgEl.src = imgs[idx].url; }
    function prev() { idx = (idx - 1 + imgs.length) % imgs.length; show(); }
    function next() { idx = (idx + 1) % imgs.length; show(); }
    function close() {
      box.classList.remove('on');
      box.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }

    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    closeBtn.addEventListener('click', close);

    lightbox._show = show;
    lightbox._onKey = onKey;

    mounted = true;
    return true;
  }

  return {
    open(list, start = 0) {
      if (!mount()) return;
      imgs = list; idx = start;
      this._show();
      box.classList.add('on');
      box.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', this._onKey);
    }
  };
})();

/* =======================
   Modal genérico (descrição)
   ======================= */
function ensureDescModal() {
  if (document.getElementById('desc-modal')) return;
  const el = document.createElement('div');
  el.id = 'desc-modal';
  el.innerHTML = `
    <div class="desc-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;z-index:55;">
      <div class="desc-dialog" style="width:min(820px,92vw);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(2,6,23,.25);padding:18px;position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <h3 style="margin:0;font-size:1.2rem;color:#0f172a">Descrição do evento</h3>
          <button class="desc-close" style="border:0;background:#f1f5f9;color:#0f172a;width:36px;height:36px;border-radius:999px;cursor:pointer;font-size:20px;line-height:36px;text-align:center">×</button>
        </div>
        <div class="desc-body" style="white-space:pre-wrap;color:#0f172a;line-height:1.55;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const backdrop = el.querySelector('.desc-backdrop');
  const btnClose = el.querySelector('.desc-close');
  btnClose.addEventListener('click', () => backdrop.style.display = 'none');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.style.display = 'none';
  });
}

function openDescModal(text) {
  ensureDescModal();
  const backdrop = document.querySelector('#desc-modal .desc-backdrop');
  const body = document.querySelector('#desc-modal .desc-body');
  body.textContent = text || '-';
  backdrop.style.display = 'flex';
}

/* =======================
   Modal CARTINHAS
   ======================= */
function ensureCartinhasModal() {
  if (document.getElementById('cartinhas-modal')) return;

  const el = document.createElement('div');
  el.id = 'cartinhas-modal';
  el.innerHTML = `
    <div class="cm-dialog">
      <div class="cm-header">
        <h3 class="cm-title"><span>📩</span> Cartinhas disponíveis</h3>
        <button class="cm-close" aria-label="Fechar">×</button>
      </div>
      <p class="cm-sub">Selecione uma cartinha disponível para adotar. (Demonstração — sem integração com outra tabela)</p>
      <div class="cm-content">
        <div class="cm-grid"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const modal = el;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCartinhasModal();
  });
  el.querySelector('.cm-close').addEventListener('click', closeCartinhasModal);
}

function openCartinhasModal(ev) {
  ensureCartinhasModal();

  const modal = document.getElementById('cartinhas-modal');
  const grid  = modal.querySelector('.cm-grid');

  const total = Number(ev.cartinhas_total || 0);
  const adotadas = Number(ev.adocoes_total || 0);
  const disponiveis = Math.max(total - adotadas, 0);

  grid.innerHTML = '';

  if (disponiveis <= 0) {
    grid.innerHTML = `<div class="cm-empty">Nenhuma cartinha disponível no momento.</div>`;
  } else {
    // Geramos "cartinhas" genéricas numeradas (apenas visual)
    for (let i = 1; i <= disponiveis; i++) {
      const card = document.createElement('div');
      card.className = 'cm-card';
      card.innerHTML = `
        <h4>Cartinha #${i}</h4>
        <p>Disponível para adoção 💙</p>
      `;
      grid.appendChild(card);
    }
  }

  modal.classList.add('on');
}

function closeCartinhasModal() {
  const modal = document.getElementById('cartinhas-modal');
  if (modal) modal.classList.remove('on');
}

/* =======================
   Ler mais / Ler menos
   ======================= */
function applyReadMore(descEl, fullText) {
  // substituí pela versão com modal, para não "empurrar" os outros cards
  // (só mostra botão que abre modal)
  const btn = document.createElement('button');
  btn.className = 'read-more';
  btn.type = 'button';
  btn.textContent = 'Ler mais';
  btn.addEventListener('click', () => openDescModal(fullText || descEl.textContent.trim()));
  descEl.after(btn);
}

/* =======================
   Carregamento / render
   ======================= */
async function carregarEventos(status = '') {
  const estadoLista = document.getElementById('estado-lista');
  const grid = document.getElementById('eventos-grid');

  estadoLista.textContent = 'Carregando eventos...';
  grid.setAttribute('aria-busy', 'true');

  try {
    const url = status ? `${API_URL}?status=${encodeURIComponent(status)}` : API_URL;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.sucesso) throw new Error(data.mensagem || 'Falha');

    const eventos = sortEventos(data.eventos || []);
    grid.innerHTML = '';
    if (!eventos.length) {
      estadoLista.textContent = 'Nenhum evento encontrado.';
      grid.removeAttribute('aria-busy');
      return;
    }

    for (const ev of eventos) {
      grid.appendChild(criarCard(ev));
    }

    estadoLista.textContent = '';
  } catch (e) {
    estadoLista.textContent = 'Erro ao carregar eventos.';
    console.error(e);
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

function estadoBadge(ev) {
  const s = (ev.status_evento || '').toLowerCase();
  if (s === 'em andamento')
    return `<span class="badge-estado andamento"><span class="emoji">⏳</span> em andamento</span>`;
  if (s === 'proximo')
    return `<span class="badge-estado proximo"><span class="emoji">📅</span> próximo</span>`;
  if (s === 'encerrado')
    return `<span class="badge-estado encerrado"><span class="emoji">🔒</span> encerrado</span>`;
  return '';
}

function criarCard(ev) {
  const descricao = (ev.descricao || '').trim();
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  const firstImg = imgs[0]?.url || '';

  const wrapper = document.createElement('article');
  wrapper.className = 'card';

  /* header (imagem única ou carrossel simples) */
  const media = document.createElement('div');
  media.className = 'card-media';
  if (firstImg) {
    const img = document.createElement('img');
    img.src = firstImg;
    img.alt = ev.nome_evento || 'Imagem do evento';
    img.className = 'card-img';
    img.style.display = 'block';
    img.addEventListener('click', () => lightbox.open(imgs.length ? imgs : [{ url: firstImg }], 0));
    media.appendChild(img);
  }
  wrapper.appendChild(media);

  /* body */
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${estadoBadge(ev)}
  `;
  body.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = descricao;
  body.appendChild(desc);
  applyReadMore(desc, descricao);

  /* pills (Cartinhas/Adoções) */
  const pills = document.createElement('div');
  pills.className = 'pills';

  const totalCart = Number(ev.cartinhas_total || 0);
  const totalAdot = Number(ev.adocoes_total || 0);
  const disponiveis = Math.max(totalCart - totalAdot, 0);

  // Cartinhas (clicável)
  const cartBtn = document.createElement('button');
  cartBtn.type = 'button';
  cartBtn.className = 'pill-cartinhas';
  cartBtn.innerHTML = `<span class="emoji">📩</span> Cartinhas: <b>${totalCart}</b>${disponiveis >= 0 ? ` <span style="color:#64748b;font-weight:600;">(${disponiveis} disp.)</span>` : ''}`;

  const st = (ev.status_evento || '').toLowerCase();
  const ativo = (st === 'em andamento' || st === 'proximo');
  if (!ativo) cartBtn.classList.add('disabled');
  else {
    cartBtn.addEventListener('click', () => openCartinhasModal(ev));
  }
  pills.appendChild(cartBtn);

  // Adoções (não clicável)
  const adoSpan = document.createElement('span');
  adoSpan.className = 'pill-adocoes';
  adoSpan.innerHTML = `<span class="emoji">🎁</span> Adoções: <b>${totalAdot}</b>`;
  pills.appendChild(adoSpan);

  if (pills.childElementCount) body.appendChild(pills);

  /* bloco de datas (chips) — já estava ajustado */
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <div>
      <div class="label">📬 Adoções</div>
      <div class="value mini"><b>Início:</b> ${formatDate(ev.data_evento)} &nbsp; | &nbsp; <b>Fim:</b> ${formatDate(ev.data_limite_recebimento)}</div>
    </div>
    <div>
      <div class="label">🎉 Evento</div>
      <div class="value mini"><b>Data:</b> ${formatDate(ev.data_realizacao_evento)}</div>
    </div>
  `;
  body.appendChild(meta);

  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;
  body.appendChild(local);

  wrapper.appendChild(body);
  return wrapper;
}

/* filtro topo */
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  const v = (e.target.value || '').toLowerCase();
  carregarEventos(v);
});

/* boot */
document.addEventListener('DOMContentLoaded', () => {
  carregarEventos('');
});
