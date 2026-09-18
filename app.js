const state = { catalog: null, activeCategory: null, includeReview: false, previousView: "home" };
const views = ["home-view", "listing-view", "document-view", "search-view"];
const marks = { overview: "總", combat: "戰", campaign: "史", collection: "將", territory: "城" };

function showView(id) {
  views.forEach(viewId => document.getElementById(viewId).hidden = viewId !== id);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function visibleDocuments(categoryId = null) {
  return state.catalog.documents.filter(doc => (!categoryId || doc.category === categoryId) && (state.includeReview || !doc.review));
}

function statusChip(doc) {
  return `<span class="status ${doc.tone}">${doc.status}</span>`;
}

function documentRow(doc) {
  return `<button class="document-row" data-document="${doc.id}"><div><h3>${doc.title}</h3><p>${doc.summary}</p></div><aside>${statusChip(doc)}<span class="arrow">›</span></aside></button>`;
}

function bindDocumentRows(root = document) {
  root.querySelectorAll("[data-document]").forEach(button => button.addEventListener("click", () => openDocument(button.dataset.document)));
}

function renderNavigation() {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = `<button class="nav-button active" data-home>스펙 홈 <small>⌂</small></button>` + state.catalog.categories.map(category => {
    const count = visibleDocuments(category.id).length;
    return `<button class="nav-button" data-category="${category.id}">${category.name}<small>${count}</small></button>`;
  }).join("");
  nav.querySelector("[data-home]").addEventListener("click", openHome);
  nav.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => openCategory(button.dataset.category)));
}

function setActiveNav(categoryId = null) {
  document.querySelectorAll(".nav-button").forEach(button => button.classList.toggle("active", categoryId ? button.dataset.category === categoryId : button.hasAttribute("data-home")));
}

function renderHome() {
  document.getElementById("doc-count").textContent = visibleDocuments().length;
  document.getElementById("category-count").textContent = state.catalog.categories.length;
  document.getElementById("category-grid").innerHTML = state.catalog.categories.map(category => {
    const docs = visibleDocuments(category.id);
    return `<button class="category-card" data-category="${category.id}" data-mark="${marks[category.id]}"><small>${category.eyebrow}</small><h2>${category.name}</h2><p>${category.description}</p><footer><span>${docs.length}개 문서</span><span>읽기 →</span></footer></button>`;
  }).join("");
  const featured = ["spec-map", "skills-overview", "campaign-baseline", "territory-city"].map(id => state.catalog.documents.find(doc => doc.id === id)).filter(Boolean);
  document.getElementById("featured-list").innerHTML = featured.map(documentRow).join("");
  document.querySelectorAll(".category-card").forEach(button => button.addEventListener("click", () => openCategory(button.dataset.category)));
  bindDocumentRows(document.getElementById("featured-list"));
}

function openHome() {
  state.activeCategory = null;
  state.previousView = "home";
  document.getElementById("search").value = "";
  history.replaceState(null, "", location.pathname);
  renderHome();
  setActiveNav();
  showView("home-view");
  document.querySelector(".sidebar").classList.remove("open");
}

function openCategory(categoryId) {
  const category = state.catalog.categories.find(item => item.id === categoryId);
  if (!category) return;
  state.activeCategory = categoryId;
  state.previousView = "listing";
  history.replaceState(null, "", `${location.pathname}#category=${categoryId}`);
  document.getElementById("listing-eyebrow").textContent = category.eyebrow;
  document.getElementById("listing-title").textContent = category.name;
  document.getElementById("listing-description").textContent = category.description;
  document.getElementById("document-list").innerHTML = visibleDocuments(categoryId).map(documentRow).join("") || "<p>표시할 문서가 없습니다.</p>";
  bindDocumentRows(document.getElementById("document-list"));
  setActiveNav(categoryId);
  showView("listing-view");
  document.querySelector(".sidebar").classList.remove("open");
}

async function openDocument(documentId) {
  const response = await fetch(`data/documents/${encodeURIComponent(documentId)}.json`);
  if (!response.ok) return;
  const doc = await response.json();
  document.getElementById("document-content").innerHTML = doc.html;
  history.replaceState(null, "", `${location.pathname}#doc=${doc.id}`);
  const status = document.getElementById("document-status");
  status.className = `status ${doc.tone}`;
  status.textContent = doc.status;
  document.getElementById("document-path").textContent = doc.path;
  document.getElementById("source-link").href = `https://github.com/hyeonQ/ThreeKingdomHero/blob/main/${doc.path}${doc.anchor ? `#${doc.anchor}` : ""}`;
  document.getElementById("outline-nav").innerHTML = doc.outline.filter(item => item.level > 1).slice(0, 16).map(item => `<a class="${item.level === 3 ? "sub" : ""}" href="#${item.anchor}">${item.title}</a>`).join("");
  document.querySelectorAll("#outline-nav a").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    document.getElementById(link.getAttribute("href").slice(1))?.scrollIntoView({ behavior: "smooth" });
  }));
  document.querySelectorAll("#document-content a").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (/^https?:\/\//.test(href)) {
      link.target = "_blank";
      link.rel = "noreferrer";
      return;
    }
    if (href.startsWith("#")) return;
    const sourceParts = doc.path.split("/").slice(0, -1);
    const targetParts = [...sourceParts, ...href.split("#")[0].split("/")].reduce((parts, part) => {
      if (!part || part === ".") return parts;
      if (part === "..") parts.pop(); else parts.push(part);
      return parts;
    }, []);
    const targetPath = targetParts.join("/");
    const target = state.catalog.documents.find(item => item.path === targetPath);
    if (target) {
      link.addEventListener("click", event => { event.preventDefault(); openDocument(target.id); });
    }
  });
  showView("document-view");
}

async function runSearch(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) { state.activeCategory ? openCategory(state.activeCategory) : openHome(); return; }
  showView("search-view");
  const documents = visibleDocuments();
  const loaded = await Promise.all(documents.map(async doc => {
    const response = await fetch(`data/documents/${encodeURIComponent(doc.id)}.json`);
    return response.ok ? response.json() : doc;
  }));
  const results = loaded.filter(doc => `${doc.title} ${doc.summary} ${doc.searchText || ""}`.toLowerCase().includes(normalized));
  document.getElementById("search-summary").textContent = `“${query}”에 해당하는 문서 ${results.length}개`;
  document.getElementById("search-list").innerHTML = results.map(documentRow).join("") || "<p>일치하는 스펙을 찾지 못했습니다.</p>";
  bindDocumentRows(document.getElementById("search-list"));
  setActiveNav("__search__");
}

async function init() {
  const response = await fetch("data/catalog.json");
  state.catalog = await response.json();
  renderNavigation();
  renderHome();

  document.getElementById("listing-back").addEventListener("click", openHome);
  document.getElementById("document-back").addEventListener("click", () => state.activeCategory ? openCategory(state.activeCategory) : openHome());
  document.getElementById("mobile-menu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
  document.getElementById("review-toggle").addEventListener("click", event => {
    state.includeReview = !state.includeReview;
    event.currentTarget.setAttribute("aria-pressed", String(state.includeReview));
    renderNavigation();
    if (state.activeCategory) openCategory(state.activeCategory); else openHome();
  });

  let searchTimer;
  document.getElementById("search").addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(event.target.value), 180);
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("search").focus();
    }
  });
  const route = location.hash.slice(1);
  if (route.startsWith("doc=")) openDocument(route.slice(4));
  else if (route.startsWith("category=")) openCategory(route.slice(9));
}

init();
