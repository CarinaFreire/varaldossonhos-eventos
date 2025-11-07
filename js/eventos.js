// js/eventos.js

const API_URL = '/api/eventos';

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

function formatDate(d) {
  if (!d) return '-';
  // força timezone local (sem -1 dia)
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  return `${dd}/${m}/${y}`;
}

function sortEventos(evts) {
  return evts.slice().sort((a,b) => {
    const sa = statusOrder[a.status_evento] ?? 99;
    const sb = statusOrder[b.status_evento] ?? 99;
    if (sa !== sb) return sa - sb;

    const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
    const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
    return da - db;
  });
}

// ==== Lightbox simples ====
const lightbox = (() => {
  let box, imgEl, prevBtn, nextBtn, closeBtn, imgs = [], idx = 0;

  function mount() {
    box = document.getElementById('lightbox');
    imgEl = box.querySelector('.lb-img');
    prevBtn = box.querySelector('.lb-prev');
    nextBtn = box.querySelector('.lb-next');
    closeBtn = box.querySelector('.lb-close');

    function show() {
      imgEl.src = imgs[idx].url;
    }
    function prev() {
      idx = (idx - 1 + imgs.length) % imgs.length;
      show();
    }
    function next() {
      idx = (idx + 1) % imgs.length;
      show();
    }
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

    box.addEventListener('click', (e) => {
      if (e.target === box) close();
    });
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    closeBtn.addEventListener('click', close);

    return {
      open(list, start = 0) {
        imgs = list; idx = start;
        show();
        box.classList.add('on');
        box.setAttribute('aria-hidden', 'false');
        document.addEventListener('keydown', onKey);
      }
    };
  }

  return mount();
})();

// === “Ler mais / Ler menos” ===
function applyReadMore(descEl) {
  // só adiciona se estiver truncado
  const needs = descEl.scrollHeight > descEl.clientHeight + 2;
  if (!needs) return;

  const btn = document.createElement('button');
  btn.className = 'read-more';
  btn.type = 'button';
  btn.textContent = 'Ler mais';
  btn.addEventListener('click', () => {
    const expanded = descEl.classList.toggle('expanded');
    if (expanded) {
      btn.textContent = 'Ler menos';
    } else {
      btn.textContent = 'Ler mais';
    }
  });
  descEl.after(btn);
}

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
  // rótulos das datas
  const labelInicio = 'Início das adoções';
  const labelLimite = 'Data limite';

  // descrição com quebras de linha preservadas
  const descricao = (ev.descricao || '').trim();

  // imagens
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  const firstImg = imgs[0]?.url || '';

  const wrapper = document.createElement('article');
  wrapper.className = 'card';

  // HEADER (carrossel simples)
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
    img.addEventListener('click', () => lightbox.open([{url:firstImg}], 0));
    media.appendChild(img);
  }

  // BODY
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${ev.status_evento ? `<span class="badge ${ev.status_evento.includes('andamento')?'andamento':ev.status_evento}">${ev.status_evento}</span>` : ''}
  `;

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = descricao;

  // Pills (só se > 0)
  const pills = document.createElement('div');
  pills.className = 'pills';
  if ((ev.cartinhas_total||0) > 0) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.innerHTML = `Cartinhas: <b>${ev.cartinhas_total}</b>`;
    pills.appendChild(p);
  }
  if ((ev.adocoes_total||0) > 0) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.innerHTML = `Adoções: <b>${ev.adocoes_total}</b>`;
    pills.appendChild(p);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `
    <div>
      <div class="label">${labelInicio}</div>
      <div class="value">${formatDate(ev.data_evento)}</div>
    </div>
    <div>
      <div class="label">${labelLimite}</div>
      <div class="value">${formatDate(ev.data_limite_recebimento)}</div>
    </div>
  `;

  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;

  body.appendChild(title);
  body.appendChild(desc);
  // adiciona "ler mais" se necessário depois de renderizar
  setTimeout(() => applyReadMore(desc), 0);
  if (pills.childElementCount) body.appendChild(pills);
  body.appendChild(meta);
  body.appendChild(local);

  wrapper.appendChild(media);
  wrapper.appendChild(body);
  return wrapper;
}

// filtro topo
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  const v = (e.target.value || '').toLowerCase();
  carregarEventos(v);
});

// start
carregarEventos('');







