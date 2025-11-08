// js/eventos.js

const API_URL = '/api/eventos';

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

// ---- datas SEM timezone (YYYY-MM-DD -> DD/MM/YYYY)
function formatYMD(ymd) {
  if (!ymd || typeof ymd !== 'string') return '-';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function sortEventos(evts) {
  return evts.slice().sort((a, b) => {
    const sa = statusOrder[a.status_evento] ?? 99;
    const sb = statusOrder[b.status_evento] ?? 99;
    if (sa !== sb) return sa - sb;

    const da = a.data_evento || '9999-12-31';
    const db = b.data_evento || '9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

/* =======================
   Modal de texto "Ler mais"
   ======================= */
(function mountTextModal(){
  const tpl = document.createElement('div');
  tpl.id = 'text-modal';
  tpl.innerHTML = `
    <div class="tm-backdrop" data-close="1"></div>
    <div class="tm-dialog" role="dialog" aria-modal="true" aria-label="Texto completo">
      <button class="tm-close" aria-label="Fechar">×</button>
      <div class="tm-body"></div>
    </div>
  `;
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(tpl);
    tpl.addEventListener('click', (e) => {
      if (e.target.dataset.close) closeTextModal();
    });
    tpl.querySelector('.tm-close').addEventListener('click', closeTextModal);
  });

  function closeTextModal() {
    tpl.classList.remove('on');
  }

  window.openTextModal = (html) => {
    tpl.querySelector('.tm-body').innerHTML = html;
    tpl.classList.add('on');
  };
})();

/* =======================
   Lightbox (imagens)
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
   Carregar / Renderizar
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
    estadoLista.textContent = 'Erro ao carregar eventos.';
    console.error(e);
  } finally {
    document.getElementById('eventos-grid').removeAttribute('aria-busy');
  }
}

/* =======================
   Helpers de UI
   ======================= */
function statusBadge(statusRaw) {
  const s = (statusRaw || '').toLowerCase();
  let cls = '', emoji = '', text = s;
  if (s === 'em andamento') { cls = 'andamento'; emoji = '⏳'; text = 'em andamento'; }
  else if (s === 'proximo') { cls = 'proximo'; emoji = '📅'; text = 'proximo'; }
  else if (s === 'encerrado') { cls = 'encerrado'; emoji = '🔒'; text = 'encerrado'; }
  return `<span class="status-badge ${cls}"><span class="emoji">${emoji}</span>${text}</span>`;
}

function applyReadMore(btn, descText) {
  btn.addEventListener('click', () => {
    const html = `<div class="tm-title">Descrição do evento</div><div class="tm-text">${descText
      .replace(/\n/g, '<br>')}</div>`;
    window.openTextModal(html);
  });
}

/* =======================
   Card
   ======================= */
function criarCard(ev) {
  const wrapper = document.createElement('article');
  wrapper.className = 'card';

  // HEADER (imagem / carrossel simples)
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
  }

  // BODY
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${statusBadge(ev.status_evento)}
  `;

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = (ev.descricao || '').trim();

  const btnLM = document.createElement('button');
  btnLM.className = 'read-more';
  btnLM.type = 'button';
  btnLM.textContent = 'Ler mais';
  applyReadMore(btnLM, (ev.descricao || '').trim());

  // Pills de contadores (como estavam)
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

  // ======= CHIP ADOÇÕES =======
  const chipA = document.createElement('div');
  chipA.className = 'chip chip-ado';
  chipA.innerHTML = `
    <div class="chip-title">📬 <span>Adoções</span></div>
    <div class="chip-row">
      <span><b>início:</b> ${formatYMD(ev.data_evento)}</span>
      <span class="sep">|</span>
      <span><b>fim:</b> ${formatYMD(ev.data_limite_recebimento)}</span>
    </div>
  `;

  // ======= BLOCO EVENTO =======
  const chipE = document.createElement('div');
  chipE.className = 'chip chip-evento';
  chipE.innerHTML = `
    <div class="chip-title">🎉 <span>Evento</span></div>
    <div class="chip-line"><b>Data:</b> ${formatYMD(ev.data_realizacao_evento)}</div>
  `;

  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(btnLM);
  if (pills.childElementCount) body.appendChild(pills);
  body.appendChild(chipA);
  body.appendChild(chipE);
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



