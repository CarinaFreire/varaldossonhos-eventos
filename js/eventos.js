// eventos.js

const API_EVENTOS = '/api/eventos';
const API_CARTINHAS = '/api/cartinha.js'; // URL da sua colega

const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

/* ===== datas sem “-1 dia” ===== */
function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${dd}/${m}/${y}`;
}

/* ===== ordenação ===== */
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

/* ===== Lightbox (lazy mount) ===== */
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

    function show(){ imgEl.src = imgs[idx].url || imgs[idx]; }
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

    box.addEventListener('click', (e)=>{ if (e.target === box) close(); });
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    closeBtn.addEventListener('click', close);

    lightbox._show = show; lightbox._onKey = onKey;
    mounted = true; return true;
  }

  return {
    open(list, start=0){
      if (!mount()) return;
      imgs = list; idx = start;
      this._show();
      box.classList.add('on');
      box.setAttribute('aria-hidden','false');
      document.addEventListener('keydown', this._onKey);
    }
  };
})();

/* ===== Ler mais / Ler menos ===== */
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

/* ===== Cache dos eventos renderizados ===== */
let _eventosCache = [];

/* ===== Carregar eventos ===== */
async function carregarEventos(status = '') {
  const estadoLista = document.getElementById('estado-lista');
  const grid = document.getElementById('eventos-grid');

  estadoLista.textContent = 'Carregando eventos...';
  grid.setAttribute('aria-busy','true');

  try {
    const url = status ? `${API_EVENTOS}?status=${encodeURIComponent(status)}` : API_EVENTOS;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.sucesso) throw new Error(data.mensagem || 'Falha');

    const eventos = sortEventos(data.eventos || []);
    _eventosCache = eventos;
    grid.innerHTML = '';
    if (!eventos.length) {
      estadoLista.textContent = 'Nenhum evento encontrado.';
      grid.removeAttribute('aria-busy'); 
      return;
    }
    for (const ev of eventos) grid.appendChild(criarCard(ev));
    estadoLista.textContent = '';

    // delegação de clique para o chip de cartinhas (uma única vez)
    grid.addEventListener('click', onGridClickOnce, { once:true });
  } catch (e) {
    console.error(e);
    document.getElementById('estado-lista').textContent = 'Erro ao carregar eventos.';
  } finally {
    document.getElementById('eventos-grid').removeAttribute('aria-busy');
  }
}

function onGridClickOnce() {
  const grid = document.getElementById('eventos-grid');
  grid.addEventListener('click', (e)=>{
    const pill = e.target.closest('.pill-cartinhas');
    if (!pill) return;

    const card = pill.closest('article.card');
    const evId = card?.dataset?.id;
    const ev   = _eventosCache.find(x => (x.id === evId) || (String(x.id_evento||'') === String(evId)));
    if (ev) openCartinhasModal(ev);
  });
}

/* ===== Render ===== */
function criarCard(ev) {
  const descricao = (ev.descricao || '').trim();
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  const firstImg = imgs[0]?.url || '';

  const wrapper = document.createElement('article');
  wrapper.className = 'card';
  wrapper.dataset.id = ev.id || ev.id_evento || '';

  // header / carrossel
  const media = document.createElement('div');
  media.className = 'card-media';

  if (imgs.length) {
    let idx = 0, auto;

    const show = (n)=>{
      const imgsEls = media.querySelectorAll('.card-img');
      const dotsEls = media.querySelectorAll('.dot');
      imgsEls.forEach((el,i)=> el.style.display = i===n ? 'block':'none');
      dotsEls.forEach((el,i)=> el.classList.toggle('on', i===n));
      idx = n;
    };
    const setSlide = (n)=>{ show(n); restartAuto(); };
    const prevSlide = ()=> setSlide((idx - 1 + imgs.length) % imgs.length);
    const nextSlide = ()=> setSlide((idx + 1) % imgs.length);
    const startAuto = ()=> { auto = setInterval(nextSlide, 4000); };
    const stopAuto  = ()=> { clearInterval(auto); };
    const restartAuto = ()=> { stopAuto(); startAuto(); };

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
      d.className = 'dot' + (i===0 ? ' on':'');
      d.type = 'button';
      d.addEventListener('click', ()=> setSlide(i));
      dots.appendChild(d);
    });
    media.appendChild(dots);

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

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    ${renderStatus(ev.status_evento)}
  `;

  const desc = document.createElement('p');
  desc.className = 'desc clamp-3';
  desc.textContent = descricao;

  // chips
  const pills = document.createElement('div');
  pills.className = 'pills';

  const disp = (ev.cartinhas_total || 0);
  const p1 = document.createElement('button');
  p1.type = 'button';
  p1.className = 'pill pill-cartinhas';
  p1.innerHTML = `💌 <b>Cartinhas:</b> <span>${disp}</span>`;
  pills.appendChild(p1);

  if ((ev.adocoes_total || 0) > 0) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.innerHTML = `🎁 <b>Adoções:</b> <span>${ev.adocoes_total}</span>`;
    pills.appendChild(p);
  }

  const meta = document.createElement('div');
  meta.className = 'meta meta-compact';
  meta.innerHTML = `
    <div class="chip-row">
      <div class="chip chip-ghost">
        📬 <b>Adoções</b>
        <span class="sep"></span>
        <span class="kv"><em>início:</em> ${formatDate(ev.data_evento)}</span>
        <span class="sep">|</span>
        <span class="kv"><em>fim:</em> ${formatDate(ev.data_limite_recebimento)}</span>
      </div>
      <div class="chip chip-ghost">
        🎉 <b>Evento</b>
        <span class="sep"></span>
        <span class="kv"><em>data:</em> ${formatDate(ev.data_realizacao_evento)}</span>
      </div>
    </div>
  `;

  const local = document.createElement('div');
  local.className = 'local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;

  body.appendChild(title);
  body.appendChild(desc);
  setTimeout(()=> applyReadMore(desc), 0);
  if (pills.childElementCount) body.appendChild(pills);
  body.appendChild(meta);
  body.appendChild(local);

  wrapper.appendChild(media);
  wrapper.appendChild(body);
  return wrapper;
}

function renderStatus(s){
  const v = (s || '').toLowerCase();
  if (!v) return '';
  if (v.includes('andamento')) return `<span class="badge badge-andamento">⏳ em andamento</span>`;
  if (v.includes('proximo'))    return `<span class="badge badge-proximo">📅 próximo</span>`;
  if (v.includes('encerrado'))  return `<span class="badge badge-encerrado">🔒 encerrado</span>`;
  return `<span class="badge">${s}</span>`;
}

/* ===== Modal de cartinhas (usando /api/cartinha.js) ===== */

/* Adaptador tolerante */
function normalizeCartinhasPayload(json){
  const list = Array.isArray(json) ? json
              : Array.isArray(json?.cartinhas) ? json.cartinhas
              : Array.isArray(json?.records) ? json.records
              : [];

  return list.map(r => {
    const f = r.fields || r;

    const id = r.id || f.id || f.ID || f.uid || String(Math.random());

    const nome = f.nome || f['criança'] || f.crianca || f.child || f.aluno || f.titulo || 'Cartinha';

    const idade = f.idade || f.age || '';

    const sonho = f.sonho || f.desejo || f.pedido || f.objetivo || '';

    let foto = '';
    if (Array.isArray(f.imagem) && f.imagem[0]?.url) foto = f.imagem[0].url;
    if (!foto && Array.isArray(f.foto) && f.foto[0]?.url) foto = f.foto[0].url;

    let status = '';
    for (const k of ['status','situacao','disponibilidade']) {
      if (f[k]) { status = String(Array.isArray(f[k])? f[k][0] : f[k]); break; }
    }
    status = (status || '').toLowerCase();

    const adocoesCount = Array.isArray(f.adocoes) ? f.adocoes.length : 0;

    const evRefs = [];
    for (const k of [
      'nome_evento', 'nome_evento (from data_evento)', 'evento', 'eventos',
      'data_evento', 'id_evento', 'evento_id', 'event_id'
    ]) {
      const v = f[k];
      if (!v) continue;
      if (Array.isArray(v)) evRefs.push(...v);
      else evRefs.push(v);
    }

    const url = f.url || f.link || f.permalink || '';

    return { id, nome, idade, sonho, foto, status, adocoesCount, evRefs, url, raw:f };
  });
}

function matchesEvento(cartinha, ev){
  const evName = (ev.nome_evento || '').toLowerCase();
  const evId   = String(ev.id_evento || ev.id || '').toLowerCase();

  const hay = (cartinha.evRefs || []).map(x => String(x).toLowerCase()).join(' | ');
  return (evName && hay.includes(evName)) || (evId && hay.includes(evId));
}

function isDisponivel(cartinha){
  const s = cartinha.status || '';
  if (s.includes('dispon')) return true;
  if (s.includes('adot'))   return false;
  return (cartinha.adocoesCount || 0) === 0;
}

async function openCartinhasModal(ev){
  try {
    const r = await fetch(API_CARTINHAS, { cache:'no-store' });
    const j = await r.json();
    const all  = normalizeCartinhasPayload(j);
    const list = all.filter(c => matchesEvento(c, ev) && isDisponivel(c));

    ensureCartinhasUI();
    renderCartinhasUI(ev, list);
  } catch(err){
    console.error('Erro ao carregar cartinhas:', err);
    ensureCartinhasUI();
    renderCartinhasUI(ev, [], 'Não foi possível carregar as cartinhas.');
  }
}

/* Montagem do modal de cartinhas (uma vez) */
let _cartinhasModalBuilt = false;
function ensureCartinhasUI(){
  if (_cartinhasModalBuilt) return;
  const container = document.createElement('div');
  container.id = 'cartinhas-modal';
  container.innerHTML = `
    <div class="cm-backdrop" data-close="1"></div>
    <div class="cm-dialog" role="dialog" aria-modal="true" aria-labelledby="cm-title">
      <button class="cm-close" aria-label="Fechar">×</button>
      <h3 id="cm-title">Cartinhas disponíveis</h3>
      <div class="cm-list" id="cm-list"></div>
    </div>
  `;
  document.body.appendChild(container);

  container.addEventListener('click', (e)=>{
    if (e.target.hasAttribute('data-close') || e.target.classList.contains('cm-close')) {
      container.classList.remove('on');
    }
  });

  _cartinhasModalBuilt = true;
}

function renderCartinhasUI(ev, list, errorMsg=''){
  const wrap = document.getElementById('cartinhas-modal');
  const ul = wrap.querySelector('#cm-list');
  const title = wrap.querySelector('#cm-title');

  title.textContent = `Cartinhas disponíveis — ${ev.nome_evento || ''}`;
  ul.innerHTML = '';

  if (errorMsg) {
    ul.innerHTML = `<p class="cm-empty">${errorMsg}</p>`;
  } else if (!list.length) {
    ul.innerHTML = `<p class="cm-empty">Não há cartinhas disponíveis para este evento no momento.</p>`;
  } else {
    for (const c of list) {
      const li = document.createElement('div');
      li.className = 'cm-item';
      li.innerHTML = `
        ${c.foto ? `<img class="cm-photo" src="${c.foto}" alt="Cartinha de ${escapeHtml(c.nome)}">` : ''}
        <div class="cm-meta">
          <h4>${escapeHtml(c.nome || 'Cartinha')}</h4>
          <p class="cm-line">${c.idade ? `<b>Idade:</b> ${escapeHtml(String(c.idade))}` : ''}</p>
          ${c.sonho ? `<p class="cm-dream"><b>Sonho:</b> ${escapeHtml(String(c.sonho))}</p>` : ''}
          <div class="cm-actions">
            <a class="cm-btn" target="_blank" href="${c.url || '/varal'}">Adotar</a>
          </div>
        </div>
      `;
      ul.appendChild(li);
    }
  }
  wrap.classList.add('on');
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
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


