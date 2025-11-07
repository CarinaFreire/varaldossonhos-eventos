// /js/eventos.js — consome a API do Vercel: /api/eventos
console.log("[eventos] carregado");

// API na mesma origem (Vercel)
const API_URL = "/api/eventos";

function $(id){ return document.getElementById(id); }

// ========================= Utils =========================
function formatarData(iso){
  if(!iso) return "-";
  // força fuso de SP para não “adiantar/atrasar” 1 dia
  const d = new Date(iso + "T00:00:00-03:00");
  if(isNaN(d)) return "-";
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function badgeClasse(status){
  if(!status) return "badge";
  const s = String(status).toLowerCase();
  if(s === "em andamento") return "badge andamento";
  if(s === "proximo" || s === "próximo") return "badge proximo";
  if(s === "encerrado") return "badge encerrado";
  return "badge";
}

// tenta obter a 1ª imagem válida do array de anexos do Airtable
function primeiraImagem(ev){
  const arr = Array.isArray(ev.imagem) ? ev.imagem : [];
  const ok = arr.find(x => x && (x.url || x.thumbnails?.large?.url));
  return ok?.url || ok?.thumbnails?.large?.url || "../imagens/placeholder-evento.jpg";
}

// normaliza contagem (aceita número, string "12", ou array/linkRecords)
function parseCount(v){
  if (Array.isArray(v)) return v.length;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d-]/g,""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// bloco de mídia (carrossel) — retorna HTML + data para o JS ligar
function mediaBlock(ev){
  const imgs = (Array.isArray(ev.imagem) ? ev.imagem : [])
    .map(x => x?.url || x?.thumbnails?.large?.url)
    .filter(Boolean);

  // se não houver mais de 1 imagem, usa uma só sem setas/pontos
  if (imgs.length <= 1) {
    const src = imgs[0] || primeiraImagem(ev);
    return {
      html: `
      <div class="card-media" data-has-slider="0">
        <img class="card-img" src="${src}" alt="${ev.nome_evento ?? "-"}" loading="lazy">
      </div>`,
      imgs
    };
  }

  const dots = imgs.map((_,i)=>`<button class="dot${i===0?" on":""}" data-idx="${i}" aria-label="ir para imagem ${i+1}"></button>`).join("");
  return {
    html: `
    <div class="card-media" data-has-slider="1" data-total="${imgs.length}">
      <button class="img-nav prev" aria-label="Imagem anterior">‹</button>
      <button class="img-nav next" aria-label="Próxima imagem">›</button>
      ${imgs.map((src,i)=> `<img class="card-img" data-idx="${i}" src="${src}" alt="${ev.nome_evento ?? "-"}" ${i? 'style="display:none"' : ""} loading="lazy">`).join("")}
      <div class="dots">${dots}</div>
    </div>`,
    imgs
  };
}

// bloco de ADOÇÕES / CARTINHAS
function adocoesBlock(ev){
  // tenta várias chaves: adocoes/adopcoes/adoções e cartinha/cartinhas/total_cartinhas
  const total = parseCount(ev.cartinha ?? ev.cartinhas ?? ev.total_cartinhas);
  const adotadas = parseCount(ev.adocoes ?? ev.adopcoes ?? ev["adoções"] ?? ev.adoçoes);

  if (!total || total < 0) return ""; // não mostra nada se não tiver total

  const usadas = Math.min(adotadas, total);
  const restantes = Math.max(total - usadas, 0);
  const pct = total ? Math.min(usadas/total, 1) : 0;
  const pctTxt = Math.round(pct*100);

  const msg =
    restantes > 0
      ? `Faltam <strong>${restantes}</strong> cartinhas 💌`
      : `<strong>Todas as cartinhas foram adotadas! 🎉</strong>`;

  return `
    <div class="adocoes">
      <div class="adocoes-head">
        <span>Cartinhas</span>
        <span class="adocoes-numbers">${usadas} / ${total} adotadas</span>
      </div>
      <div class="progress"><div class="bar" style="width:${pctTxt}%"></div></div>
      <div class="adocoes-foot">${msg}</div>
    </div>
  `;
}

// ========================= Card =========================
function cardEvento(ev){
  const media = mediaBlock(ev);
  const status = ev.status_evento;
  const adocoes = adocoesBlock(ev);

  return `
    <article class="card" tabindex="0">
      ${media.html}
      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(status)}">${status ?? "-"}</span>
        </div>

        ${ev.descricao ? `<p>${ev.descricao}</p>` : ""}

        ${adocoes}

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

// ========================= Fetch/Render =========================
async function obterEventos(statusFiltro=""){
  const url = statusFiltro ? `${API_URL}?status=${encodeURIComponent(statusFiltro)}` : API_URL;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if(!json?.sucesso || !Array.isArray(json.eventos)) throw new Error("Resposta inválida da API");
  // segurança extra no client: não renderiza cartões vazios
  return json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
}

function ligarCarrosseis(scopeEl){
  const cards = scopeEl.querySelectorAll(".card-media[data-has-slider='1']");
  cards.forEach((root) => {
    const imgs = Array.from(root.querySelectorAll(".card-img"));
    const dots = Array.from(root.querySelectorAll(".dot"));
    let i = 0;
    let timer = null;

    const show = (idx) => {
      i = (idx + imgs.length) % imgs.length;
      imgs.forEach((im,ix)=> im.style.display = ix===i ? "block" : "none");
      dots.forEach((d,ix)=> d.classList.toggle("on", ix===i));
    };
    const next = () => show(i+1);
    const prev = () => show(i-1);

    root.querySelector(".next")?.addEventListener("click", next);
    root.querySelector(".prev")?.addEventListener("click", prev);
    dots.forEach(d => d.addEventListener("click", ()=> show(Number(d.dataset.idx)||0)));

    const start = () => { stop(); timer = setInterval(next, 4000); };
    const stop  = () => { if (timer) { clearInterval(timer); timer = null; } };

    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);

    show(0);
    start();
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
    ligarCarrosseis(grid);
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




