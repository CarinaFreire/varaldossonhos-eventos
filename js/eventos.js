// ================================
// CONFIG
// ================================
const API_URL = "/api/eventos"; // sua rota no Vercel / API interna
const IMG_PLACEHOLDER = "../imagens/sem-foto.png"; // fallback se evento não tiver imagem
const AUTOPLAY_MS = 4000; // autoplay do carrossel

// ================================
// ELEMENTOS
// ================================
const grid = document.getElementById("eventos-grid");
const estadoLista = document.getElementById("estado-lista");
const filtroStatus = document.getElementById("filtro-status");

// ================================
// FORMATAÇÃO DE DATA (SEM FUSO!)
// ================================
function formatarData(iso){
  if (!iso) return "-";
  const [y,m,d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

// ================================
// BUSCAR EVENTOS
// ================================
async function carregarEventos() {
  estadoLista.textContent = "Carregando eventos...";
  estadoLista.style.color = "#475569";
  grid.setAttribute("aria-busy", "true");

  try {
    const resp = await fetch(API_URL);
    const json = await resp.json();

    if (!json?.sucesso || !Array.isArray(json.eventos)) {
      throw new Error("Resposta inválida da API");
    }

    renderizarEventos(json.eventos);
  } catch (e) {
    console.error(e);
    estadoLista.textContent = "Erro ao carregar eventos.";
    estadoLista.style.color = "#b91c1c";
  }

  grid.setAttribute("aria-busy", "false");
}

// ================================
// RENDERIZAR EVENTOS
// ================================
function renderizarEventos(lista) {
  grid.innerHTML = "";

  const filtro = filtroStatus.value;
  let filtrados = lista;

  if (filtro) {
    filtrados = lista.filter(ev => ev.status_evento === filtro);
  }

  if (filtrados.length === 0) {
    estadoLista.textContent = "Nenhum evento encontrado.";
    return;
  }

  estadoLista.textContent = "";

  filtrados.forEach(evento => {
    grid.appendChild(criarCard(evento));
  });
}

// ================================
// CRIA O CARD DO EVENTO
// ================================
function criarCard(ev) {
  const imagens = Array.isArray(ev.imagem) && ev.imagem.length > 0
    ? ev.imagem.map(img => img.url)
    : [IMG_PLACEHOLDER];

  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;

  const statusClass = ev.status_evento?.replace(" ", "-") || "";

  card.innerHTML = `
    <div class="card-media">
      ${imagens.map((src,i) =>
        `<img src="${src}" class="card-img" data-idx="${i}" alt="${ev.nome_evento}">`
      ).join("")}
      <button class="img-nav prev" aria-label="Imagem anterior">&#10094;</button>
      <button class="img-nav next" aria-label="Próxima imagem">&#10095;</button>
      <div class="dots">
        ${imagens.map((_,i)=>`<button class="dot" data-idx="${i}"></button>`).join("")}
      </div>
    </div>

    <div class="card-body">
      <div class="card-title">
        <h3>${ev.nome_evento}</h3>
        <span class="badge ${statusClass}">${ev.status_evento}</span>
      </div>

      <p>${ev.descricao || ""}</p>

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

      <p class="local"><strong>Local:</strong> ${ev.local_evento || "-"}</p>
    </div>
  `;

  iniciarCarrossel(card);
  return card;
}

// ================================
// CARROSSEL
// ================================
function iniciarCarrossel(card) {
  const imgs = card.querySelectorAll(".card-img");
  const dots = card.querySelectorAll(".dot");
  const btnPrev = card.querySelector(".prev");
  const btnNext = card.querySelector(".next");

  let i = 0;
  let timer;

  function mostrar(n) {
    i = (n + imgs.length) % imgs.length;
    imgs.forEach((img,idx)=> img.style.display = (idx===i?"block":"none"));
    dots.forEach((d,idx)=> d.classList.toggle("on", idx===i));
  }

  function prox() { mostrar(i+1); }
  function prev() { mostrar(i-1); }

  btnNext.onclick = () => { prox(); resetAuto(); }
  btnPrev.onclick = () => { prev(); resetAuto(); }
  dots.forEach(d => d.onclick = () => {
    mostrar(Number(d.dataset.idx));
    resetAuto();
  });

  function auto() {
    timer = setInterval(prox, AUTOPLAY_MS);
  }
  function resetAuto(){
    clearInterval(timer);
    auto();
  }

  mostrar(0);
  auto();
}

// ================================
// EVENTOS DO FILTRO
// ================================
filtroStatus.addEventListener("change", carregarEventos);

// ================================
// INICIAR
// ================================
carregarEventos();



