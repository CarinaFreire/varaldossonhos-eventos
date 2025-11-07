// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

// Em produção a API está na mesma origem: /api/eventos
const API_URL = "/api/eventos";

function $(id){ return document.getElementById(id); }

function formatarData(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  if(isNaN(d)) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" }).format(d);
}

function badgeClasse(status){
  if(!status) return "badge";
  const s = status.toLowerCase();
  if(s === "em andamento") return "badge andamento";
  if(s === "proximo" || s === "próximo") return "badge proximo";
  if(s === "encerrado") return "badge encerrado";
  return "badge";
}

function primeiraImagemArray(arr){
  return (Array.isArray(arr) && arr[0] && arr[0].url) ? arr[0].url : "../imagens/placeholder-evento.jpg";
}

function buildCarouselHTML(imagens){
  // imagens: array de anexos do Airtable (cada item possui .url)
  const urls = Array.isArray(imagens) ? imagens.map(i => i.url).filter(Boolean) : [];
  const temVarias = urls.length > 1;

  const imgs = urls.length
    ? urls.map((u, i) => `<img src="${u}" alt="" class="card-img" style="display:${i===0?'block':'none'}">`).join("")
    : `<img src="../imagens/placeholder-evento.jpg" alt="" class="card-img" style="display:block">`;

  const nav = temVarias
    ? `
      <button class="img-nav prev" aria-label="Imagem anterior">‹</button>
      <button class="img-nav next" aria-label="Próxima imagem">›</button>
      <div class="dots">
        ${urls.map((_, i) => `<button class="dot${i===0?' on':''}" aria-label="Ir para imagem ${i+1}"></button>`).join("")}
      </div>
    `
    : "";

  return `<div class="card-media">${imgs}${nav}</div>`;
}

function cardEvento(ev){
  const status = ev.status_evento;
  const local = ev.local_evento || "-";
  const inicio = ev.data_evento || null;
  const limite = ev.data_limite_recebimento || null;

  return `
    <article class="card">
      ${buildCarouselHTML(ev.imagem)}
      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(status)}">${status ?? "-"}</span>
        </div>
        ${ev.descricao ? `<p>${ev.descricao}</p>` : ""}
        <div class="meta">
          <div>
            <div class="label">Início</div>
            <div class="value">${formatarData(inicio)}</div>
          </div>
          <div>
            <div class="label">Data limite</div>
            <div class="value">${formatarData(limite)}</div>
          </div>
        </div>
        <div class="local"><strong>Local:</strong> ${local}</div>
      </div>
    </article>
  `;
}

async function obterEventos(statusFiltro=""){
  const url = statusFiltro ? `${API_URL}?status=${encodeURIComponent(statusFiltro)}` : API_URL;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if(!json?.sucesso || !Array.isArray(json.eventos)) throw new Error("Resposta inválida da API");
  // segurança extra no client: não renderiza cartões vazios
  return json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
}

/* Inicializa carrosséis em todos os cards renderizados */
function setupCarousels(opcoes = { autoMs: 4000 }) {
  document.querySelectorAll(".card-media").forEach(media => {
    const imgs = media.querySelectorAll("img.card-img");
    if (imgs.length <= 1) return; // nada a fazer se só tem 1 imagem

    let index = 0;
    const btnPrev = media.querySelector(".img-nav.prev");
    const btnNext = media.querySelector(".img-nav.next");
    const dots = media.querySelectorAll(".dot");

    const showSlide = (i) => {
      index = (i + imgs.length) % imgs.length;
      imgs.forEach((img, idx) => { img.style.display = (idx === index ? "block" : "none"); });
      dots.forEach((d, idx) => d.classList.toggle("on", idx === index));
    };

    const next = () => showSlide(index + 1);
    const prev = () => showSlide(index - 1);

    btnNext?.addEventListener("click", next);
    btnPrev?.addEventListener("click", prev);
    dots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));

    // autoplay 4s
    let auto = setInterval(next, opcoes.autoMs || 4000);
    media.addEventListener("mouseenter", () => clearInterval(auto));
    media.addEventListener("mouseleave", () => auto = setInterval(next, opcoes.autoMs || 4000));

    showSlide(0);
  });
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

    // depois de renderizar os cards, ativa os carrosséis
    setupCarousels({ autoMs: 4000 });

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
