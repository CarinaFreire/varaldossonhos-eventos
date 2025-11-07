// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

// Em produção (Vercel) a API está na mesma origem: /api/eventos
const API_URL = "/api/eventos";

function $(id){ return document.getElementById(id); }

// ====================== Datas sem fuso ======================
function localDateFromISO(iso) {
  // Esperado "YYYY-MM-DD" (Airtable)
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  return new Date(y, mo, d); // local, sem UTC
}

function formatarDataISO(iso) {
  const d = localDateFromISO(iso);
  if (!d || isNaN(d)) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  }).format(d);
}

// ====================== Aparência ======================
function badgeClasse(status){
  if(!status) return "badge";
  const s = status.toLowerCase();
  if(s === "em andamento") return "badge andamento";
  if(s === "proximo") return "badge proximo";
  if(s === "encerrado") return "badge encerrado";
  return "badge";
}

function primeiraImagem(ev){
  if (Array.isArray(ev.imagem) && ev.imagem.length > 0) {
    const it = ev.imagem[0];
    return (it.url || it);
  }
  return "../imagens/placeholder-evento.jpg";
}

// ====================== Ordenação ======================
const STATUS_ORDER = { "em andamento": 0, "proximo": 1, "encerrado": 2 };

function ordenarEventos(lista){
  return [...lista].sort((a,b)=>{
    const sa = STATUS_ORDER[a.status_evento] ?? 9;
    const sb = STATUS_ORDER[b.status_evento] ?? 9;
    if (sa !== sb) return sa - sb;

    // por data_evento (asc)
    const da = localDateFromISO(a.data_evento)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = localDateFromISO(b.data_evento)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

// ====================== Carrossel ======================
function initCardCarousel(cardEl) {
  const imgs = cardEl.querySelectorAll(".card-media .card-img");
  const dots = cardEl.querySelectorAll(".dots .dot");
  const prev = cardEl.querySelector(".img-nav.prev");
  const next = cardEl.querySelector(".img-nav.next");
  if (imgs.length <= 1) return; // nada a fazer

  let i = 0;
  let timer = null;

  function show(idx) {
    imgs.forEach((im, k) => { im.style.display = (k === idx) ? "block" : "none"; });
    dots.forEach((d, k) => {
      if (k === idx) d.classList.add("on");
      else d.classList.remove("on");
    });
    i = idx;
  }
  function go(delta) {
    const n = imgs.length;
    let j = i + delta;
    if (j < 0) j = n - 1;
    if (j >= n) j = 0;
    show(j);
    resetTimer();
  }
  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(()=>go(1), 4000);
  }

  // eventos
  prev?.addEventListener("click", ()=>go(-1));
  next?.addEventListener("click", ()=>go(1));
  dots.forEach((d, idx) => d.addEventListener("click", ()=>{ show(idx); resetTimer(); }));

  // pausa no hover
  const media = cardEl.querySelector(".card-media");
  media?.addEventListener("mouseenter", ()=> timer && clearInterval(timer));
  media?.addEventListener("mouseleave", ()=> resetTimer());

  show(0);
  resetTimer();
}

// ====================== Renderização ======================
function cardEvento(ev){
  const hasMultiImg = Array.isArray(ev.imagem) && ev.imagem.length > 1;
  const imagesHtml = (Array.isArray(ev.imagem) ? ev.imagem : [])
    .slice(0, 6) // cap: 6 por card
    .map((x, idx)=>`
      <img
        class="card-img"
        src="${x.url || x}"
     alt="${ev.nome_evento ? ev.nome_evento.replace(/"/g,"&quot;") : "Imagem do evento"}"
        loading="lazy"
        style="display:${idx===0?"block":"none"}"
      >
    `).join("");

  const dotsHtml = (Array.isArray(ev.imagem) && ev.imagem.length > 1)
    ? `<div class="dots">${ev.imagem.map((_,i)=>`<button class="dot ${i===0?"on":""}" aria-label="Ir para imagem ${i+1}"></button>`).join("")}</div>`
    : "";

  const navHtml = hasMultiImg
    ? `
      <button class="img-nav prev" aria-label="Imagem anterior" type="button">‹</button>
      <button class="img-nav next" aria-label="Próxima imagem" type="button">›</button>
    `
    : "";

  // contadores
  const cartinhas = Number(ev.cartinhas_total || 0);
  const adocoes  = Number(ev.adocoes_total  || 0);
  const contadores = (cartinhas > 0 || adocoes > 0)
    ? `
      <div class="pills">
        ${cartinhas > 0 ? `<span class="pill">Cartinhas: <b>${cartinhas}</b></span>` : ""}
        ${adocoes > 0 ? `<span class="pill">Adoções: <b>${adocoes}</b></span>` : ""}
      </div>
    `
    : "";

  return `
    <article class="card" tabindex="0">
      <div class="card-media" aria-label="Galeria de imagens do evento">
        ${imagesHtml || `<img class="card-img" src="${primeiraImagem(ev)}" alt="${ev.nome_evento || "-"}" loading="lazy">`}
        ${navHtml}
        ${dotsHtml}
      </div>

      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(ev.status_evento)}">${ev.status_evento ?? "-"}</span>
        </div>

        <p class="clamp-3">${ev.descricao ?? ""}</p>

        ${contadores}

        <div class="meta">
          <div>
            <div class="label">Início</div>
            <div class="value">${formatarDataISO(ev.data_evento)}</div>
          </div>
          <div>
            <div class="label">Data limite</div>
            <div class="value">${formatarDataISO(ev.data_limite_recebimento)}</div>
          </div>
        </div>

        <div class="local"><strong>Local:</strong> ${ev.local_evento ?? "-"}</div>
      </div>
    </article>
  `;
}

// ====================== Data & UI ======================
async function obterEventos(statusFiltro=""){
  const url = statusFiltro ? `${API_URL}?status=${encodeURIComponent(statusFiltro)}` : API_URL;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if(!json?.sucesso || !Array.isArray(json.eventos)) throw new Error("Resposta inválida da API");
  // Normaliza e filtra cartões sem sentido
  const arr = json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
  return ordenarEventos(arr);
}

async function carregarEventos(statusFiltro=""){
  const grid = $("eventos-grid");
  const estado = $("estado-lista");
  grid.innerHTML = "";
  estado.textContent = "Carregando eventos…";
  grid.setAttribute("aria-busy", "true");
  try{
    const eventos = await obterEventos(statusFiltro);
    if(!eventos.length){
      estado.textContent = "Nenhum evento encontrado.";
      grid.setAttribute("aria-busy", "false");
      return;
    }
    estado.textContent = "";
    grid.innerHTML = eventos.map(cardEvento).join("");

    // ativa carrossel em cada card
    grid.querySelectorAll(".card").forEach(initCardCarousel);

  }catch(e){
    console.error("[eventos] erro:", e);
    estado.textContent = "Erro ao carregar eventos.";
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

// ====================== Boot ======================
document.addEventListener("DOMContentLoaded", ()=>{
  const seletor = $("filtro-status");
  carregarEventos("");
  seletor?.addEventListener("change", ()=> carregarEventos(seletor.value));
});






