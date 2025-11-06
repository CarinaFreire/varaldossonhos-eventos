// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

const API_URL = "/api/eventos";
function $(id){ return document.getElementById(id); }

// formata 'YYYY-MM-DD' em 'DD/MM/AAAA' sem usar Date()
function formatarData(dateStr){
  if(!dateStr) return null;
  const s = String(dateStr).split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(!m) return null;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
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
  return (ev.imagem && ev.imagem[0] && ev.imagem[0].url)
    ? ev.imagem[0].url
    : "../imagens/placeholder-evento.jpg";
}

function cardEvento(ev){
  const img = primeiraImagem(ev);
  const status = ev.status_evento || "";
  const iniFmt = formatarData(ev.data_evento);
  const limiteFmt = formatarData(ev.data_limite_recebimento); // <- usa data_limite

  const blocoInicio = `
    <div>
      <div class="label">Início</div>
      <div class="value">${iniFmt ?? "-"}</div>
    </div>`;

  const blocoLimite = limiteFmt ? `
    <div>
      <div class="label">Data limite</div>
      <div class="value">${limiteFmt}</div>
    </div>` : "";

  return `
    <article class="card">
      <img class="card-img" src="${img}" alt="${ev.nome_evento ?? "-"}" loading="lazy">
      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(status)}">${status || "-"}</span>
        </div>
        <p>${ev.descricao ?? ""}</p>
        <div class="meta">
          ${blocoInicio}
          ${blocoLimite}
        </div>
        <div class="local"><strong>Local:</strong> ${ev.local_evento ?? "-"}</div>
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
  // segurança extra: não renderiza cartões totalmente vazios
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

