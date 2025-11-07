// /js/eventos.js
console.log("[eventos] carregado");

const API_URL = "/api/eventos";

function $(id) { return document.getElementById(id); }

function formatarDataOnly(iso) {
  if (!iso) return "-";
  const [y, m, d] = `${iso}`.split("T")[0].split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return "-";
  // mantém a data *sem* fuso para evitar “voltar 1 dia”
  const dt = new Date(y, m - 1, d, 12, 0, 0); // 12:00 evita mudanças por DST
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(dt);
  } catch {
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
}

function badgeClasse(status) {
  if (!status) return "badge";
  const s = status.toLowerCase();
  if (s === "em andamento") return "badge andamento";
  if (s === "proximo") return "badge proximo";
  if (s === "encerrado") return "badge encerrado";
  return "badge";
}

function primeiraImagem(ev) {
  return (ev.imagem && ev.imagem[0] && ev.imagem[0].url)
    ? ev.imagem[0].url
    : "../imagens/placeholder-evento.jpg";
}

function bullets(num) {
  if (!num || num <= 1) return "";
  return `
    <div class="dots" role="tablist" aria-label="Páginas do carrossel">
      ${Array.from({ length: num })
        .map((_, i) => `<button class="dot${i === 0 ? " on" : ""}" data-idx="${i}" aria-label="Imagem ${i + 1}"></button>`)
        .join("")}
    </div>`;
}

function imgsHtml(ev) {
  if (!Array.isArray(ev.imagem) || ev.imagem.length === 0) {
    return `<img class="card-img" src="${primeiraImagem(ev)}" alt="${ev.nome_evento ?? "-"}" loading="lazy" style="display:block">`;
  }
  // várias imagens -> carrossel
  return `
    ${ev.imagem.map((img, i) => `
      <img class="card-img${i === 0 ? "" : ""}" 
           src="${img.url}" 
           alt="${ev.nome_evento ?? "-"} — ${i + 1}/${ev.imagem.length}" 
           loading="${i === 0 ? "eager" : "lazy"}"
           style="display:${i === 0 ? "block" : "none"}">
    `).join("")}
    <button class="img-nav prev" aria-label="Imagem anterior" data-dir="-1">‹</button>
    <button class="img-nav next" aria-label="Próxima imagem"  data-dir="1">›</button>
    ${bullets(ev.imagem.length)}
  `;
}

function cardEvento(ev) {
  const status = ev.status_evento;
  const inicio = formatarDataOnly(ev.data_evento);
  const fim = formatarDataOnly(ev.data_limite_recebimento);

  // contadores (vêm da API já normalizados)
  const cartinhas = Number(ev.cartinhas_total || 0);
  const adocoes = Number(ev.adocoes_total || 0);

  const infoExtras =
    cartinhas > 0 || adocoes > 0
      ? `<div class="extras">
          ${cartinhas > 0 ? `<span class="pill">Cartinhas: <strong>${cartinhas}</strong></span>` : ""}
          ${adocoes  > 0 ? `<span class="pill">Adoções:  <strong>${adocoes}</strong></span>`  : ""}
        </div>`
      : "";

  return `
    <article class="card" tabindex="0">
      <div class="card-media" data-has-carousel="${Array.isArray(ev.imagem) && ev.imagem.length > 1}">
        ${imgsHtml(ev)}
      </div>

      <div class="card-body">
        <div class="card-title">
          <h3>${ev.nome_evento ?? "-"}</h3>
          <span class="${badgeClasse(status)}">${status ?? "-"}</span>
        </div>

        <p>${ev.descricao ?? ""}</p>

        ${infoExtras}

        <div class="meta">
          <div>
            <div class="label">Início</div>
            <div class="value">${inicio}</div>
          </div>
          <div>
            <div class="label">Data limite</div>
            <div class="value">${fim}</div>
          </div>
        </div>

        <div class="local"><strong>Local:</strong> ${ev.local_evento ?? "-"}</div>
      </div>
    </article>
  `;
}

function montarCarrossel(card) {
  const media = card.querySelector(".card-media");
  if (!media || media.dataset.hasCarousel !== "true") return;

  const imgs = Array.from(media.querySelectorAll(".card-img"));
  if (imgs.length <= 1) return;

  const prevBtn = media.querySelector(".img-nav.prev");
  const nextBtn = media.querySelector(".img-nav.next");
  const dots = Array.from(media.querySelectorAll(".dot"));
  let idx = 0;
  let timer = null;

  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    imgs.forEach((img, k) => { img.style.display = k === idx ? "block" : "none"; });
    dots.forEach((d, k) => d.classList.toggle("on", k === idx));
  }

  function auto() {
    clearInterval(timer);
    timer = setInterval(() => show(idx + 1), 4000);
  }

  prevBtn?.addEventListener("click", () => { show(idx - 1); auto(); });
  nextBtn?.addEventListener("click", () => { show(idx + 1); auto(); });
  dots.forEach(d => d.addEventListener("click", () => { show(Number(d.dataset.idx)); auto(); }));

  show(0);
  auto();

  media.addEventListener("mouseenter", () => clearInterval(timer));
  media.addEventListener("mouseleave", auto);
}

async function obterEventos(statusFiltro = "") {
  const url = statusFiltro ? `${API_URL}?status=${encodeURIComponent(statusFiltro)}` : API_URL;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if (!json?.sucesso || !Array.isArray(json.eventos)) throw new Error("Resposta inválida");
  // segurança extra
  return json.eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);
}

async function carregarEventos(statusFiltro = "") {
  const grid = $("eventos-grid");
  const estado = $("estado-lista");
  grid.innerHTML = "";
  estado.textContent = "Carregando eventos…";

  try {
    const eventos = await obterEventos(statusFiltro);
    if (!eventos.length) {
      estado.textContent = "Nenhum evento encontrado.";
      return;
    }
    estado.textContent = "";
    grid.innerHTML = eventos.map(cardEvento).join("");

    // ligar os carrosséis
    grid.querySelectorAll(".card").forEach(montarCarrossel);
  } catch (e) {
    console.error("[eventos] erro:", e);
    estado.textContent = "Erro ao carregar eventos.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const seletor = $("filtro-status");
  carregarEventos("");
  seletor?.addEventListener("change", () => carregarEventos(seletor.value));
});





