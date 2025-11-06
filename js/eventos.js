// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

// Usa a própria origem do deploy (ex.: https://varaldossonhos-eventos.vercel.app)
const API_URL = `${location.origin}/api/eventos`;

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
  if(s === "em breve" || s === "proximo") return "badge proximo";
  if(s === "encerrado") return "badge encerrado";
  return "badge";
}

function primeiraImagem(ev){
  return (ev.imagem && ev.imagem[0] && ev.imagem[0].url)
    ? ev.imagem[0].url
    : "/imagens/placeholder-evento.jpg"; // usar caminho absoluto
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
          <span class="${badgeClasse(status)}">${status ?? "-"}</span>
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
  const url = new URL(API_URL);
  if (statusFiltro) url.searchParams.set("status", statusFiltro);
  url.searchParams.set("_t", Date.now()); // cache-buster

  const r = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);

  // pode acontecer de vir HTML em vez de JSON; vamos checar content-type
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const txt = await r.text();
    console.error("[eventos] Resposta não-JSON:", txt.slice(0, 500));
    throw new Error("A API não retornou JSON.");
  }

  const json = await r.json();
  console.log("[eventos] JSON recebido:", json);

  if (!json || json.sucesso !== true || !Array.isArray(json.eventos)) {
    const msg = json?.mensagem || "Resposta inválida da API";
    const det = json?.detalhe ? ` — ${json.detalhe}` : "";
    throw new Error(msg + det);
  }

  // segurança extra no client: não renderiza cartões vazios
  return json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
}

async function carregarEventos(statusFiltro=""){
  const grid = $("eventos-grid");
  const estado = $("estado-lista");
  grid.innerHTML = "";
  estado.textContent = "Carregando eventos…";
  estado.setAttribute("aria-busy", "true");

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
    estado.textContent = `Erro ao carregar eventos. ${e.message ?? ""}`;
  }finally{
    estado.setAttribute("aria-busy", "false");
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  const seletor = $("filtro-status");
  carregarEventos("");
  seletor?.addEventListener("change", ()=> carregarEventos(seletor.value));
});



