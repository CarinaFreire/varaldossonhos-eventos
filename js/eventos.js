// =========================
// Agenda de Eventos (JS)
// =========================

const API_URL = '/api/eventos';

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

// Simple date -> DD/MM/YYYY (datas já vêm corretas do Airtable)
function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${dd}/${m}/${y}`;
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
   Lightbox (lazy mount)
======================= */
const lightbox = (() => {
  let box, imgEl, prevBtn, nextBtn, closeBtn;
  let imgs = [], idx = 0, mounted = false;

  function mount() {
    if (mounted) return true;
    box = document.getElementById('lightbox');
    if (!box) return false;

    imgEl   = box.querySelector('.lb-img');
    prevBtn = box.querySelector('.lb-prev');
    nextBtn = box.querySelector('.lb-next');
    closeBtn= box.querySelector('.lb-close');

    function show(){ imgEl.src = imgs[idx].url; }
    function prev(){ idx = (idx - 1 + imgs.length) % imgs.length; show(); }
    function next(){ idx = (idx + 1) % imgs.length; show(); }
    function close(){
      box.classList.remove('on');
      box.setAttribute('aria-hidden','true');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }

    box.addEventListener('click', e => { if (e.target === box) close(); });
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    closeBtn.addEventListener('click', close);

    lightbox._show = show;
    lightbox._onKey = onKey;
    mounted = true;
    return true;
  }

  return {
    open(list, start = 0){
      if (!mount()) return;
      imgs = list; idx = start;
      this._show();
      box.classList.add('on');
      box.setAttribute('aria-hidden','false');
      document.addEventListener('keydown', this._onKey);
    }
  };
})();

/* =======================
   Modal "Ler mais"
======================= */
function openDescModal(text) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Descrição do evento">
      <header>
        <h3>Descrição do evento</h3>
        <button class="close" aria-label="Fechar">✕</button>
      </header>
      <div class="body">${(text || '').replace(/\n/g,'<br/>')}</div>
    </div>
  `;
  document.body.appendChild(backdrop);

  function close(){
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e){ if (e.key === 'Escape') close(); }

  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

/* =======================
   Fetch & render
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

    for (const ev of eventos) grid.appendChild(criarCard(ev));
    estadoLista.textContent = '';
  } catch (e) {
    console.error(e);
    estadoLista.textContent = 'Erro ao carregar eventos.';
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

/* Badge de status com emoji + classe de cor */
function statusBadgeHTML(status) {
  const s = (status || '').toLowerCase();
  if (s === 'em andamento') return `<span class="status-badge status--andamento">⏳ <span>em andamento</span></span>`;
  if (s === 'proximo')       return `<span class="status-badge status--proximo">📅 <span>próximo</span></span>`;
  if (s === 'encerrado')     return `<span class="status-badge status--encerrado">🔒 <span>encerrado</span></span>`;
  return '';
}

/* Criação de cada card */
function criarCard(ev) {
  const wrapper = document.createElement('article');
  wrapper.className = 'card';

  /* media */
  const media = document.createElement('div');
  media.className = 'card-media';

  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  if (imgs.length) {
    imgs.forEach((im, i) => {
      const img = document.createElement('img');
      img.src = im.url;
      img.alt = ev.nome_evento || 'Imagem do evento';
      img.className = 'card-img';
      if (i === 0) img.style.display = 'block';
      img.addEventListener('click', () => lightbox.open(imgs, i));
      media.appendChild(img);
    });

    // dots
    const dots = document.createElement('div');
    dots.className = 'dots';
    imgs.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'dot' + (i === 0 ? ' on' : '');
      d.type = 'button';
      d.addEventListener('click', () => setSlide(i));
      dots.appendChild(d);
    });
    media.appendChild(dots);

    // arrows
    const prev = document.createElement('button');
    prev.className = 'img-nav prev';
    prev.setAttribute('aria-label','Imagem anterior');
    prev.textContent = '‹';

    const next = document.createElement('button');
    next.className = 'img-nav next';
    next.setAttribute('aria-label','Próxima imagem');
    next.textContent = '›';

    media.appendChild(prev); media.appendChild(next);

    let idx = 0, auto;
    function show(n){
      const imgsEls = media.querySelectorAll('.card-img');
      const dotsEls = media.querySelectorAll('.dot');
      imgsEls.forEach((el,i)=> el.style.display = i===n ? 'block' : 'none');
      dotsEls.forEach((el,i)=> el.classList.toggle('on', i===n));
      idx = n;
    }
    function setSlide(n){ show(n); restartAuto(); }
    function prevSlide(){ setSlide((idx - 1 + imgs.length) % imgs.length); }
    function nextSlide(){ setSlide((idx + 1) % imgs.length); }
    function startAuto(){ auto = setInterval(nextSlide, 4000); }
    function stopAuto(){ clearInterval(auto); }
    function restartAuto(){ stopAuto(); startAuto(); }

    prev.addEventListener('click', prevSlide);
    next.addEventListener('click', nextSlide);
    media.addEventListener('mouseenter', stopAuto);
    media.addEventListener('mouseleave', startAuto);
    startAuto();
  }

  /* body */
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${statusBadgeHTML(ev.status_evento)}
  `;

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = (ev.descricao || '').trim();

  const readMore = document.createElement('button');
  readMore.className = 'read-more';
  readMore.textContent = 'Ler mais';
  readMore.addEventListener('click', () => openDescModal(desc.textContent));

  /* contadores (mantidos como antes) */
  const counts = document.createElement('div');
  counts.className = 'counts';
  const c1 = document.createElement('span');
  c1.className = 'count-pill';
  c1.textContent = `Cartinhas: ${ev.cartinhas_total ?? 0}`;
  const c2 = document.createElement('span');
  c2.className = 'count-pill';
  c2.textContent = `Adoções: ${ev.adocoes_total ?? 0}`;
  counts.appendChild(c1); counts.appendChild(c2);

  /* chips */
  const chips = document.createElement('div');
  chips.className = 'chips';

  // Adoções: título central + linha "início | fim"
  const chipA = document.createElement('div');
  chipA.className = 'chip';
  chipA.innerHTML = `
    <div class="chip-title">📬 <span>Adoções</span></div>
    <div class="chip-kv">
      <span class="label">Início:</span><span class="value">${formatDate(ev.data_evento)}</span>
      <span class="sep">|</span>
      <span class="label">Fim:</span><span class="value">${formatDate(ev.data_limite_recebimento)}</span>
    </div>
  `;

  // Evento: título central + "Data: ..."
  const chipE = div('chip', `
    <div class="chip-title">🎉 <span>Evento</span></div>
    <div class="chip-date"><span class="label">Data:</span><span class="value">${formatDate(ev.data_realizacao_evento)}</span></div>
  `);

  chips.appendChild(chipA);
  chips.appendChild(chipE);

  /* local */
  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;

  body.appendChild(title);
  body.appendChild(desc);
  if (desc.textContent.length > 120) body.appendChild(readMore);
  body.appendChild(counts);
  body.appendChild(chips);
  body.appendChild(local);

  wrapper.appendChild(media);
  wrapper.appendChild(body);
  return wrapper;
}

/* helper */
function div(cls, html){ const d=document.createElement('div'); d.className=cls; d.innerHTML=html; return d; }

/* Filtro topo */
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  const v = (e.target.value || '').toLowerCase();
  carregarEventos(v);
});

/* Boot */
document.addEventListener('DOMContentLoaded', () => {
  carregarEventos('');
});




