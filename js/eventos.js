// js/eventos.js

const API_URL = '/api/eventos';
const VARAL_URL = 'https://varaldossonnhos2-0.vercel.app/pages/cartinha.html';
const statusOrder = { 'em andamento': 0, 'proximo': 1, 'encerrado': 2 };

/* =============================
   Datas sem timezone / helpers
==============================*/
function formatDate(d) {
  if (!d) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`;
  }
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${dd}/${m}/${y}`;
}

function parseISODateLocal(str){
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y,m,d] = str.split('-').map(Number);
    return new Date(y, m-1, d);                 // meia-noite local
  }
  return new Date(str);
}
function endOfDay(dt){
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
}

/* =============================
   Status automático por datas
   - próximo     : hoje < início
   - andamento   : início <= hoje <= fim (ou <= data do evento se não houver fim)
   - encerrado   : hoje > data do evento (ou > fim se não houver evento)
==============================*/
function getStatusAuto(ev){
  const hoje = endOfDay(new Date());

  const dtInicio = parseISODateLocal(ev.data_evento);
  const dtFim    = endOfDay(parseISODateLocal(ev.data_limite_recebimento));
  const dtEvento = endOfDay(parseISODateLocal(ev.data_realizacao_evento));

  if (dtInicio && hoje < dtInicio) return 'proximo';

  if (dtEvento && hoje > dtEvento) return 'encerrado';
  if (!dtEvento && dtFim && hoje > dtFim) return 'encerrado';

  if (dtInicio && hoje >= dtInicio) {
    if (dtFim && hoje <= dtFim) return 'em andamento';
    if (!dtFim && dtEvento && hoje <= dtEvento) return 'em andamento';
    if (!dtFim && !dtEvento) return 'em andamento';
  }
  // fallback seguro
  return 'em andamento';
}

/* =============================
   Ordenação por (status auto) + data
==============================*/
function sortEventos(evts) {
  return evts.slice().sort((a,b) => {
    const sa = statusOrder[getStatusAuto(a)] ?? 99;
    const sb = statusOrder[getStatusAuto(b)] ?? 99;
    if (sa !== sb) return sa - sb;

    const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
    const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
    return da - db;
  });
}

/* =============================
   Lightbox
==============================*/
const lightbox = (() => {
  let box, imgEl, prevBtn, nextBtn, closeBtn;
  let imgs = [], idx = 0, mounted = false;
  function mount() {
    if (mounted) return true;
    box = document.getElementById('lightbox');
    if (!box) return false;
    imgEl = box.querySelector('.lb-img');
    prevBtn = box.querySelector('.lb-prev');
    nextBtn = box.querySelector('.lb-next');
    closeBtn = box.querySelector('.lb-close');
    function show(){ imgEl.src = imgs[idx].url; }
    function prev(){ idx = (idx-1+imgs.length)%imgs.length; show(); }
    function next(){ idx = (idx+1)%imgs.length; show(); }
    function close(){ box.classList.remove('on'); box.setAttribute('aria-hidden','true'); }
    box.addEventListener('click', e=>{ if(e.target===box) close(); });
    prevBtn.addEventListener('click', prev); nextBtn.addEventListener('click', next);
    closeBtn.addEventListener('click', close);
    lightbox._show = show; mounted = true; return true;
  }
  return {
    open(list,start=0){
      if(!mount()) return;
      imgs = list; idx = start; this._show();
      const box = document.getElementById('lightbox');
      box.classList.add('on'); box.setAttribute('aria-hidden','false');
    }
  };
})();

/* =============================
   Modal genérico
==============================*/
function openModal({ title='', bodyHTML='' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay on';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="x" aria-label="Fechar">×</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
  overlay.querySelector('.x').addEventListener('click', close);
  return { close };
}

/* =============================
   Ler mais -> modal texto
==============================*/
function applyReadMore(descEl) {
  const needs = descEl.scrollHeight > descEl.clientHeight + 2;
  if (!needs) return;
  const btn = document.createElement('button');
  btn.className = 'read-more'; btn.type = 'button'; btn.textContent = 'Ler mais';
  btn.addEventListener('click', () => {
    openModal({ title: 'Descrição do evento', bodyHTML: `<p style="white-space:pre-wrap">${descEl.textContent}</p>` });
  });
  descEl.after(btn);
}

/* =============================
   Carregar
==============================*/
async function carregarEventos(status='') {
  const estadoLista = document.getElementById('estado-lista');
  const grid = document.getElementById('eventos-grid');
  estadoLista.textContent = 'Carregando eventos...'; grid.setAttribute('aria-busy','true');
  try{
    const url = status ? `${API_URL}?status=${encodeURIComponent(status)}` : API_URL;
    const resp = await fetch(url); const data = await resp.json();
    if(!data.sucesso) throw new Error(data.mensagem || 'Falha');
    const eventos = sortEventos(data.eventos || []);
    grid.innerHTML=''; if(!eventos.length){ estadoLista.textContent='Nenhum evento encontrado.'; return; }
    eventos.forEach(ev => grid.appendChild(criarCard(ev)));
    estadoLista.textContent='';
  }catch(e){ console.error(e); estadoLista.textContent='Erro ao carregar eventos.'; }
  finally{ grid.removeAttribute('aria-busy'); }
}

/* =============================
   Utils cartinhas linkadas
==============================*/
function getLinkedCartinhaIds(ev) {
  for (const key of ['cartinha', 'cartinhas', 'cartinha_ids', 'cartinhas_ids']) {
    const v = ev?.[key];
    if (Array.isArray(v) && v.length) return v.map(String);
  }
  return [];
}

/* =============================
   Card
==============================*/
function criarCard(ev){
  const status = getStatusAuto(ev); // <<< status calculado

  const wrapper = document.createElement('article'); 
  wrapper.className='card';

  /* header imgs */
  const media = document.createElement('div'); media.className='card-media';
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  if (imgs.length){
    imgs.forEach((im,i)=>{
      const img=document.createElement('img');
      img.src=im.url; img.alt=ev.nome_evento||'Imagem do evento'; img.className='card-img';
      if(i===0) img.style.display='block'; img.addEventListener('click',()=>lightbox.open(imgs,i));
      media.appendChild(img);
    });
    const dots=document.createElement('div'); dots.className='dots';
    imgs.forEach((_,i)=>{ const d=document.createElement('button'); d.className='dot'+(i===0?' on':''); d.type='button';
      d.addEventListener('click',()=>setSlide(i)); dots.appendChild(d); });
    media.appendChild(dots);
    const prev=document.createElement('button'); prev.className='img-nav prev'; prev.textContent='‹';
    const next=document.createElement('button'); next.className='img-nav next'; next.textContent='›';
    media.appendChild(prev); media.appendChild(next);
    let idx=0, auto;
    function show(n){ const imEls=media.querySelectorAll('.card-img'); const ds=media.querySelectorAll('.dot');
      imEls.forEach((el,i)=>el.style.display=i===n?'block':'none'); ds.forEach((el,i)=>el.classList.toggle('on',i===n)); idx=n; }
    function setSlide(n){ show(n); restartAuto(); }
    function prevSlide(){ setSlide((idx-1+imgs.length)%imgs.length); }
    function nextSlide(){ setSlide((idx+1)%imgs.length); }
    function startAuto(){ auto=setInterval(nextSlide,4000); }
    function stopAuto(){ clearInterval(auto); }
    function restartAuto(){ stopAuto(); startAuto(); }
    prev.addEventListener('click',prevSlide); next.addEventListener('click',nextSlide);
    media.addEventListener('mouseenter',stopAuto); media.addEventListener('mouseleave',startAuto);
    startAuto();
  }
  wrapper.appendChild(media);

  /* body */
  const body=document.createElement('div'); body.className='card-body';
  const title=document.createElement('div'); title.className='card-title';

  const isAnd = status === 'em andamento';
  const badgeClass = isAnd ? 'andamento' : (status === 'proximo' ? 'proximo' : 'encerrado');
  const badgeEmoji = isAnd ? '⏳' : (status === 'proximo' ? '📅' : '🔒');
  title.innerHTML = `
    <h3>${ev.nome_evento || ''}</h3>
    <span class="badge ${badgeClass}">${badgeEmoji}&nbsp;${status}</span>`;
  body.appendChild(title);

  const desc=document.createElement('p'); desc.className='desc clamp-3'; desc.textContent=(ev.descricao||'').trim();
  body.appendChild(desc); setTimeout(()=>applyReadMore(desc),0);

  /* pills */
  const pills=document.createElement('div'); pills.className='pills';
  const totalCart=Number(ev.cartinhas_total||0); const totalAdoc=Number(ev.adocoes_total||0);
  const disponiveis=Math.max(0, totalCart - totalAdoc);

  const pillCart=document.createElement('span');
  pillCart.className='pill pill-cartinhas'+(disponiveis>0 && status!=='encerrado' ? ' clickable':' disabled');
  pillCart.innerHTML=`💌 <span class="k">Cartinhas:</span> <span class="v">${totalCart}</span> <span class="k">( ${disponiveis} disp.)</span>`;

  if (disponiveis > 0 && status !== 'encerrado') {
    pillCart.addEventListener('click', (e) => {
      e.preventDefault();
      const linked = getLinkedCartinhaIds(ev);
      if (linked.length) {
        const url = `${VARAL_URL}?ids=${encodeURIComponent(linked.join(','))}`;
        window.open(url, '_blank', 'noopener');
      } else {
        window.open(VARAL_URL, '_blank', 'noopener');
      }
    });
  }

  const pillAd=document.createElement('span'); pillAd.className='pill';
  pillAd.innerHTML=`🎁 <span class="k">Adoções:</span> <span class="v">${totalAdoc}</span>`;
  pills.appendChild(pillCart); pills.appendChild(pillAd); body.appendChild(pills);

  /* chips */
  const infoWrap=document.createElement('div'); infoWrap.className='info-cards';
  const chipAd=document.createElement('div'); chipAd.className='info-chip';
  chipAd.innerHTML=`
    <div class="chip-title">📬 Adoções</div>
    <div class="row">
      <span class="label">Início:</span><span class="date">${formatDate(ev.data_evento)}</span>
      <span class="label">|</span>
      <span class="label">Fim:</span><span class="date">${formatDate(ev.data_limite_recebimento)}</span>
    </div>`;
  infoWrap.appendChild(chipAd);

  const chipEv=document.createElement('div'); chipEv.className='info-chip';
  chipEv.innerHTML=`
    <div class="chip-title">🎉 Evento</div>
    <div class="row"><span class="label">Data:</span><span class="date">${formatDate(ev.data_realizacao_evento)}</span></div>`;
  infoWrap.appendChild(chipEv);
  body.appendChild(infoWrap);

  /* local */
  const local=document.createElement('div'); local.className='local';
  local.innerHTML = `<b>Local:</b> ${ev.local_evento || '-'}`;
  body.appendChild(local);

  wrapper.appendChild(body);
  return wrapper;
}

/* =============================
   Modal fallback (se quiser manter)
==============================*/
function abrirModalCartinhasFallback(disponiveis){
  const itens = Array.from({length: disponiveis}, (_,i)=>`
    <div class="cartinha-item">
      <span class="name">Cartinha #${i+1}</span>
      <span class="status">Disponível 💙</span>
    </div>`).join('');
  openModal({
    title:'💌 Cartinhas disponíveis',
    bodyHTML:`<div class="cartinhas-list">${itens}</div>
      <p style="margin-top:12px;color:#64748b;font-size:.9rem">* Para abrir as cartinhas reais, adicione um campo de URL no evento (ex.: <code>cartinhas_url</code>).</p>`
  });
}

/* =============================
   Filtro topo & boot
==============================*/
document.getElementById('filtro-status')?.addEventListener('change', e=>{
  const v=(e.target.value||'').toLowerCase(); carregarEventos(v);
});
document.addEventListener('DOMContentLoaded', ()=>carregarEventos(''));

