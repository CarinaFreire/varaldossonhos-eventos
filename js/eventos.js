// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

// Em produção (Vercel) a API está na mesma origem: /api/eventos
// Se você abrir o HTML em file:// durante testes, não vai funcionar.
// Teste pelo Vercel (Preview/Production) ou por um servidor estático simples.
const API_URL = "/api/eventos";

function $(id){ return document.getElementById(id); }

function formatarData(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  if(isNaN(d)) return "-";
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}

function badgeClasse(status){
  if(!status) return "badge";
  const s = status.toLowerCase();
  if(s === "em andamento") return "badge andamento";
  if(s === "proximo")       return "badge proximo";
  if(s === "encerrado")     return "badge encerrado";
  return "badge";
}

function rotuloStatus(status){
  if(!status) return "-";
  const s = status.toLowerCase();
  if(s === "proximo") return "próximo"; // exibe com acento
  return status; // "em andamento", "encerrado"
}

function primeiraImagem(ev){
  // servidor devolve "imagem" (array de anexos do Airtable)
  return (ev.imagem && ev.imagem[0] && ev.imagem[0].url)
    ? ev.imagem[0].url
    : "../imagens/placeholder-evento.jpg";
}

function cardEvento(ev){
  const img = primeiraImagem(ev);
  const status = ev.status_evento;

  return `
    <article class="card">
      <img class="card-img" src="${img}" alt="${ev.nome_evento ?? "-"}" loading="lazy">
      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(status)}">${rotuloStatus(status)}</span>
        </div>
        <p>${ev.descricao ?? ""}</p>
        <div class="meta">
          <div>
            <div class="label">Início</div>
            <div class="value">${formatarData(ev.data_evento)}</div>
          </div>
          <div>
            <div class="label">Fim</div>
            <div class="value">${formatarData(ev.data_fim)}</div>
          </div>
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
