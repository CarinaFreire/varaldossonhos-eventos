// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

const API_URL = "/api/eventos"; // mesma origem (Vercel)

function $(id){ return document.getElementById(id); }

function formatarData(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  if(isNaN(d)) return "-";
  return new Intl.DateTimeFormat("pt-BR",{ day:"2-digit", month:"2-digit", year:"numeric" }).format(d);
}

function badgeClasse(status){
  if(!status) return "badge";
  const s = status.toLowerCase();
  if(s === "em andamento") return "badge andamento";
  if(s === "proximo" || s === "em breve") return "badge proximo";
  if(s === "encerrado") return "badge encerrado";
  return "badge";
}

function primeiraImagem(ev){
  const imgs = ev.imagem || ev.imagem_evento || [];
  return (imgs[0] && imgs[0].url) ? imgs[0].url : "../imagens/placeholder-evento.jpg";
}

/* === Card com carrossel interno === */
function cardEvento(ev){
  const imgs = ev.imagem || ev.imagem_evento || [];
  const temVarias = Array.isArray(imgs) && imgs.length > 1;
  const status = ev.status_evento;

  // Dots (um por imagem)
  const dots = Array.isArray(imgs)
    ? imgs.map((_,i)=>`<button class="dot${i===0?" on":""}" data-i="${i}" aria-label="Ir para imagem ${i+1}"></button>`).join("")
    : "";

  // Todas as imagens (exibidas via JS)
  const imagensHTML = Array.isArray(imgs) && imgs.length
    ? imgs.map((im, i)=>`<img class="card-img" src="${im.url}" alt="${ev.nome_evento ?? "-"} - imagem ${i+1}">`).join("")
    : `<img class="card-img" src="${primeiraImagem(ev)}" alt="${ev.nome_evento ?? "-"}">`;

  return `
  <article class="card">
    <div class="card-media">
      ${imagensHTML}
      <button class="img-nav prev${temVarias?"":" hidden"}" aria-label="Imagem anterior">‹</button>
      <button class="img-nav next${temVarias?"":" hidden"}" aria-label="Próxima imagem">›</button>
      <div class="dots${temVarias?"":" hidden"}">${dots}</div>
    </div>

    <div class="card-body">
      <div class="card-title">
        <h3>${ev.nome_evento ?? "-"}</h3>
        <span class="${badgeClasse(status)}">${status ?? "-"}</span>
      </div>

      <p>${ev.descricao ?? ""}</p>

      <div class="meta">
        <div>
          <div class="label">Início</div>
          <div class="value">${formatarData(ev.data_evento)}</div>
        </div>
        <div>
          <div class="label">Data limite</div>
          <div class="value">${formatarData(ev.data_limite_recebimento)}</div>
        </div>
      </div>

      <div class="local"><strong>Local:</strong> ${ev.local_evento ?? "-"}</div>
    </div>
  </article>
  `;
}

/* === Inicializa carrossel por card === */
function iniciarCarrossel(cardElem){
  const imgs = [...cardElem.querySelectorAll('.card-img')];
  const dots = [...cardElem.querySelectorAll('.dot')];
  const btnPrev = cardElem.querySelector('.img-nav.prev');
  const btnNext = cardElem.querySelector('.img-nav.next');

  // Se não há imagens, nada a fazer
  if (!imgs.length) return;

  // Se só 1 imagem, mostra e encerra (sem controles)
  if (imgs.length === 1) {
    imgs[0].style.display = 'block';
    btnPrev?.classList.add('hidden');
    btnNext?.classList.add('hidden');
    cardElem.querySelector('.dots')?.classList.add('hidden');
    return;
  }

  let idx = 0;
  let timer = null;
  const INTERVALO = 4000;

  function mostrar(i){
    idx = (i + imgs.length) % imgs.length;
    imgs.forEach((im, k)=>{ im.style.display = (k===idx) ? 'block':'none'; });
    dots.forEach((d, k)=>{ d.classList.toggle('on', k===idx); });
  }
  function proximo(){ mostrar(idx + 1); }
  function anterior(){ mostrar(idx - 1); }

  function iniciarAuto(){
    pararAuto();
    timer = setInterval(()=>{ proximo(); }, INTERVALO);
  }
  function pararAuto(){
    if (timer) { clearInterval(timer); timer = null; }
  }

  btnPrev?.addEventListener('click', ()=>{ anterior(); iniciarAuto(); });
  btnNext?.addEventListener('click', ()=>{ proximo(); iniciarAuto(); });
  dots.forEach(d=>{
    d.addEventListener('click', ()=>{
      const i = Number(d.getAttribute('data-i')||"0");
      mostrar(i); iniciarAuto();
    });
  });

  // Pausa no hover
  cardElem.addEventListener('mouseenter', pararAuto);
  cardElem.addEventListener('mouseleave', iniciarAuto);

  // Pausa quando a aba não está visível
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden) pararAuto(); else iniciarAuto();
  });

  // Inicializa
  mostrar(0);
  iniciarAuto();
}

/* === Consumo da API === */
async function obterEventos(statusFiltro=""){
  const url = statusFiltro ? `${API_URL}?status=${encodeURIComponent(statusFiltro)}` : API_URL;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if(!json?.sucesso || !Array.isArray(json.eventos)) throw new Error("Resposta inválida da API");
  // segurança extra no client: não renderiza cartões vazios
  return json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
}

async function carregarEventos(statusFiltro=""){
  const grid = $("eventos-grid");
  const estado = $("estado-lista");
  grid.innerHTML = "";
  estado.textContent = "Carregando eventos…";
  try{
    const eventos = await obterEventos(statusFiltro);

    if(!eventos.length){
      estado.textContent = "Nenhum evento encontrado.";
      return;
    }
    estado.textContent = "";
    grid.innerHTML = eventos.map(cardEvento).join("");

    // inicializa o carrossel para cada card renderizado
    [...grid.querySelectorAll('.card')].forEach(card => iniciarCarrossel(card));
  }catch(e){
    console.error("[eventos] erro:", e);
    estado.textContent = "Erro ao carregar eventos.";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  const seletor = $("filtro-status");
  carregarEventos("");
  seletor?.addEventListener("change", ()=> carregarEventos(seletor.value));
});


