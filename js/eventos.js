// js/eventos.js

const API_URL = '/api/eventos';

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

/* -------- Datas sem timezone -------- */
// Aceita "YYYY-MM-DD" e também "YYYY-MM-DDTHH:MM:SSZ" (corta no 'T').
function formatDateBR(ymdOrIso) {
  if (!ymdOrIso) return '-';
  const ymd = String(ymdOrIso).split('T')[0]; // garante só a parte YYYY-MM-DD
  const parts = ymd.split('-');
  if (parts.length !== 3) return '-';
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// Ordena por status e depois por data_evento (string YYYY-MM-DD)
function sortEventos(evts) {
  return evts.slice().sort((a, b) => {
    const sa = statusOrder[a.status_evento] ?? 99;
    const sb = statusOrder[b.status_evento] ?? 99;
    if (sa !== sb) return sa - sb;

    const A = (a.data_evento && typeof a.data_evento === 'string')
      ? a.data_evento.split('T')[0]
      : '9999-12-31';
    const B = (b.data_evento && typeof b.data_evento === 'string')
      ? b.data_evento.split('T')[0]
      : '9999-12-31';
    return A.localeCompare(B);
  });
}

/* =======================
   Lightbox (montagem preguiçosa)
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
   “Ler mais / Ler menos”
   ======================= */
function applyReadMore(descEl) {
  const needs = descEl.scrollHeight > descEl.clientHeight + 2;
  if (!needs) return;

  const btn = document.createElement('button');
  btn.className = 'read-more';
  btn.type = 'button';
  btn.textContent = 'Ler mais';
  btn.addEventListener('click', () => {
    const expanded = descEl.classList.toggle('expanded');
    btn.textContent = expanded ? 'Ler menos' : 'Ler mais';
  });
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

function criarCard(ev) {
  const descricao = (ev.descricao || '').trim();
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  const firstImg = imgs[0]?.url || '';

  const wrapper = document.createElement('article');
  wrapper.className = 'card';

  // HEADER
  const media = document.createElement('div');
  media.className = 'card-media';

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

    const prev = document.createElement('button');
    prev.className = 'img-nav prev';
    prev.setAttribute('aria-label', 'Imagem anterior');
    prev.textContent = '‹';
    const next = document.createElement('button');
    next.className = 'img-nav next';
    next.setAttribute('aria-label', 'Próxima imagem');
    next.textContent = '›';
    media.appendChild(prev);
    media.appendChild(next);

    let idx = 0, auto;
    function show(n) {
      const imgsEls = media.querySelectorAll('.card-img');
      const dotsEls = media.querySelectorAll('.dot');
      imgsEls.forEach((el, i) => el.style.display = i === n ? 'block' : 'none');
      dotsEls.forEach((el, i) => el.classList.toggle('on', i === n));
      idx = n;
    }
    function setSlide(n) { show(n); restartAuto(); }
    function prevSlide() { setSlide((idx - 1 + imgs.length) % imgs.length); }
    function nextSlide() { setSlide((idx + 1) % imgs.length); }
    function startAuto() { auto = setInterval(nextSlide, 4000); }
    function stopAuto() { clearInterval(auto); }
    function restartAuto() { stopAuto(); startAuto(); }

    prev.addEventListener('click', prevSlide);
    next.addEventListener('click', nextSlide);
    media.addEventListener('mouseenter', stopAuto);
    media.addEventListener('mouseleave', startAuto);
    startAuto();

  } else if (firstImg) {
    const img = document.createElement('img');
    img.src = firstImg;
    img.alt = ev.nome_evento || 'Imagem do evento';
    img.className = 'card-img';
    img.style.display = 'block';
    img.addEventListener('click', () => lightbox.open([{ url: firstImg }], 0));
    media.appendChild(img);
  }

  // BODY
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  // status badge (menor)
  const badge = ev.status_evento
    ? `<span class="status-badge">
         ${ev.status_evento === 'em andamento' ? '⏳' :
            ev.status_evento === 'proximo' ? '📅' : '🔒'}
         <span>${ev.status_evento}</span>
       </span>`
    : '';

  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${badge}
  `;

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = descricao;

  // Pills (centralizadas)
  const pills = document.createElement('div');
  pills.className = 'pills';
  if ((ev.cartinhas_total || 0) > 0) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.innerHTML = `Cartinhas: <b>${ev.cartinhas_total}</b>`;
    pills.appendChild(p);
  }
  if ((ev.adocoes_total || 0) > 0) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.innerHTML = `Adoções: <b>${ev.adocoes_total}</b>`;
    pills.appendChild(p);
  }

  // Bloco de Adoções + Evento (layout novo, clean)
  const meta = document.createElement('div');
  meta.className = 'meta clean-meta';

  // ADOÇÕES (título + linha com chips início/limite)
  const adocoesBlock = document.createElement('div');
  adocoesBlock.className = 'chip-block';
  adocoesBlock.innerHTML = `
    <div class="chip-title">📬 Adoções</div>
    <div class="chip-row">
      <span class="chip"><span class="chip-label">início:</span> ${formatDateBR(ev.data_evento)}</span>
      <span class="chip"><span class="chip-label">limite:</span> ${formatDateBR(ev.data_limite_recebimento)}</span>
    </div>
  `;

  // EVENTO (título + data)
  const eventoBlock = document.createElement('div');
  eventoBlock.className = 'chip-block';
  eventoBlock.innerHTML = `
    <div class="chip-title">🎉 Evento</div>
    <div class="chip-row single">
      <span class="chip"><span class="chip-label sr-only">data:</span> ${formatDateBR(ev.data_realizacao_evento)}</span>
    </div>
  `;

  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;

  body.appendChild(title);
  body.appendChild(desc);
  setTimeout(() => applyReadMore(desc), 0);
  if (pills.childElementCount) body.appendChild(pills);
  meta.appendChild(adocoesBlock);
  meta.appendChild(eventoBlock);
  body.appendChild(meta);
  body.appendChild(local);

  wrapper.appendChild(media);
  wrapper.appendChild(body);
  return wrapper;
}

/* Filtro topo */
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  const v = (e.target.value || '').toLowerCase();
  carregarEventos(v);
});

/* Boot */
document.addEventListener('DOMContentLoaded', () => {
  carregarEventos('');
});




