/* ==========================
   Agenda de Eventos — Frontend
   ETAPA 1: corrigir exibição de datas (sem timezone)
   ========================== */

const $grid = document.getElementById("eventos-grid");
const $status = document.getElementById("filtro-status");
const $estado = document.getElementById("estado-lista");

/* -------- Utils de data sem timezone -------- */

// Recebe 'YYYY-MM-DD' e devolve 'DD/MM/YYYY'.
// Não cria Date(), logo não sofre offset de fuso.
function fmtBR(ymd) {
  if (!ymd || typeof ymd !== "string") return "-";
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

// Comparação segura de duas strings 'YYYY-MM-DD' (sem criar Date)
function cmpYMD(a, b) {
  const A = (a && a.length === 10) ? a : "9999-12-31";
  const B = (b && b.length === 10) ? b : "9999-12-31";
  if (A < B) return -1;
  if (A > B) return 1;
  return 0;
}

/* -------- API -------- */

async function fetchEventos(status = "") {
  try {
    $estado.textContent = "Carregando eventos...";
    $grid.setAttribute("aria-busy", "true");

    const url = status ? `/api/eventos?status=${encodeURIComponent(status)}` : "/api/eventos";
    const r = await fetch(url);
    const j = await r.json();

    if (!j.sucesso) throw new Error(j.mensagem || "Falha na API");
    return j.eventos || [];
  } catch (e) {
    console.error(e);
    $estado.textContent = "Erro ao carregar eventos.";
    return [];
  } finally {
    $grid.setAttribute("aria-busy", "false");
  }
}

/* -------- Ordenação por status + data_evento -------- */

const STATUS_ORDER = {
  "em andamento": 0,
  "proximo": 1,
  "encerrado": 2,
};

function sortEventos(evts) {
  return [...evts].sort((a, b) => {
    const sa = STATUS_ORDER[a.status_evento] ?? 99;
    const sb = STATUS_ORDER[b.status_evento] ?? 99;
    if (sa !== sb) return sa - sb;
    // dentro do mesmo status, ordenar por data_evento ascendente
    return cmpYMD(a.data_evento, b.data_evento);
  });
}

/* -------- Renderização -------- */

function pillStatus(status) {
  const s = (status || "").toLowerCase();
  const classes = ["badge"];
  let text = s;
  if (s === "em andamento") { classes.push("andamento"); text = "em andamento"; }
  else if (s === "proximo")  { classes.push("proximo");    text = "proximo"; }
  else if (s === "encerrado"){ classes.push("encerrado");  text = "encerrado"; }
  return `<span class="${classes.join(" ")}">${text}</span>`;
}

// Monta o HTML do card de um evento
function cardEvento(ev) {
  // imagens
  const imgs = Array.isArray(ev.imagem) ? ev.imagem : [];
  const primeira = imgs[0]?.url || "";

  // descrição (truncável)
  const desc = (ev.descricao || "").trim();

  return `
  <article class="card" tabindex="0">
    <div class="card-media" ${primeira ? `data-has-img="1"` : ""}>
      ${primeira ? `<img class="card-img" src="${primeira}" alt="${ev.nome_evento}" loading="lazy" />` : ""}
      <!-- botões do carrossel permanecem, caso tenha múltiplas imagens -->
      ${imgs.length > 1 ? `
        <button class="img-nav prev" aria-label="Imagem anterior">‹</button>
        <button class="img-nav next" aria-label="Próxima imagem">›</button>
        <div class="dots">
          ${imgs.map((_, i) => `<button class="dot ${i===0?"on":""}" aria-label="Ir para imagem ${i+1}"></button>`).join("")}
        </div>
      ` : ""}
    </div>

    <div class="card-body">
      <div class="card-title">
        <h3>${ev.nome_evento || "Evento"}</h3>
        ${pillStatus(ev.status_evento)}
      </div>

      <p class="desc clamp" data-full="${encodeURIComponent(desc)}">
        ${desc ? escapeHtml(desc) : ""}
      </p>
      ${desc && desc.length > 140 ? `<button class="ver-mais" type="button">Ler mais</button>` : ""}

      <div class="meta">
        <div>
          <div class="label">Início das adoções</div>
          <div class="value">${fmtBR(ev.data_evento)}</div>
        </div>
        <div>
          <div class="label">Data limite</div>
          <div class="value">${fmtBR(ev.data_limite_recebimento)}</div>
        </div>
      </div>

      <div class="local"><strong>Local:</strong> ${ev.local_evento || "-"}</div>
    </div>
  </article>
  `;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEventos(lista) {
  $grid.innerHTML = lista.map(cardEvento).join("");
  $estado.textContent = lista.length ? "" : "Nenhum evento encontrado.";

  // ligar interações extras que você já usa (carrossel, lightbox, ver mais)
  wireLeiaMais();
  wireLightbox();
  wireCarrossel();
}

/* -------- Interações: "Ler mais", Lightbox, Carrossel (placeholders) -------- */

function wireLeiaMais() {
  $grid.querySelectorAll(".ver-mais").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = btn.previousElementSibling;
      const full = decodeURIComponent(p.getAttribute("data-full") || "");
      showLongText(full);
    });
  });
}

function showLongText(texto) {
  // simples modal de texto (você pode já ter um)
  const win = window.open("", "_blank", "width=600,height=600");
  win.document.write(`<pre style="white-space:pre-wrap; font-family:inherit; padding:16px;">${escapeHtml(texto)}</pre>`);
  win.document.close();
}

function wireLightbox() {
  // se você já tem um lightbox no HTML, conecte aqui
  $grid.querySelectorAll(".card-media img").forEach(img => {
    img.addEventListener("click", () => {
      const src = img.getAttribute("src");
      openLightbox([src], 0);
    });
  });
}

function openLightbox(urls, index) {
  // implementação simplificada (caso já tenha outro, ignora)
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  const $img = lb.querySelector(".lb-img");
  const $prev = lb.querySelector(".lb-prev");
  const $next = lb.querySelector(".lb-next");
  let i = index;

  function show() {
    $img.src = urls[i];
  }
  function prev() { i = (i - 1 + urls.length) % urls.length; show(); }
  function next() { i = (i + 1) % urls.length; show(); }

  lb.classList.add("on");
  lb.setAttribute("aria-hidden", "false");
  show();

  $prev.onclick = () => urls.length > 1 && prev();
  $next.onclick = () => urls.length > 1 && next();
  lb.querySelector(".lb-close").onclick = close;
  function close() {
    lb.classList.remove("on");
    lb.setAttribute("aria-hidden", "true");
    $img.src = "";
  }
}

function wireCarrossel() {
  // caso tenha múltiplas imagens por card, implemente aqui como já estava
  // (deixei como placeholder para não alongar)
}

/* -------- Boot -------- */

async function boot() {
  const status = ($status.value || "").trim();
  const eventos = await fetchEventos(status);
  const ordenados = sortEventos(eventos);
  renderEventos(ordenados);
}

$status.addEventListener("change", boot);
document.addEventListener("DOMContentLoaded", boot);







