import { createZip } from "./marketplace/zip-builder.js";

const root = document.body.dataset.hubRoot || "";
const page = document.querySelector("[data-page]")?.dataset.page || "";
const locale = document.documentElement.lang || "en";
const favoritesKey = "yatouji-ai-hub-favorites";
const supabaseSdkUrl = "https://esm.sh/@supabase/supabase-js@2.119.2";
const status = document.getElementById("hub-status");
let favorites = new Set();
let resourceItems = [];
let articleItems = [];
let toolDirectory = null;
let accountClientPromise;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const normalize = value => String(value ?? "")
  .toLocaleLowerCase()
  .normalize("NFD")
  .replace(/\p{M}/gu, "")
  .match(/[\p{L}\p{N}]+/gu)?.join(" ") || "";
const t = key => window.yatoujiI18n?.t(key) || key;
const message = (key, values = {}) => Object.entries(values).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
  t(key)
);
const formatDate = value => {
  if (!value) return t("unknownDate");
  const dateLocale = locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en";
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
};
const resourcePath = item => `${root}resources/${item.slug}.html`;
const articlePath = item => item.existingPath
  ? `${root}${item.existingPath}`
  : `${root}articles/${item.slug}.html`;
const resourceMap = () => new Map(resourceItems.map(item => [item.id, item]));
const articleMap = () => new Map(articleItems.map(item => [item.id, item]));
const setStatus = (element, message) => {
  if (element) element.textContent = message;
};

async function getAccountClient() {
  if (!accountClientPromise) {
    accountClientPromise = (async () => {
      if (!window.yatoujiSupabaseConfig) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/supabase-client-config.js?v=2";
          script.onload = resolve;
          script.onerror = () => reject(new Error(t("accountNotConfigured")));
          document.head.append(script);
        });
      }
      if (!window.yatoujiSupabaseConfig) throw new Error(t("accountNotConfigured"));
      const { validatePublicSupabaseConfig } = await import("./account.js?v=3");
      const configuration = validatePublicSupabaseConfig(window.yatoujiSupabaseConfig);
      if (configuration.error) {
        const key = configuration.error === "unsafe"
          ? "accountUnsafeKey"
          : configuration.error === "invalid"
            ? "accountInvalidConfig"
            : "accountNotConfigured";
        throw new Error(t(key));
      }
      const { createClient } = await import(supabaseSdkUrl);
      return createClient(configuration.url, configuration.publicKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          persistSession: true
        }
      });
    })();
  }
  return accountClientPromise;
}

function isAccountMarkedAuthenticated() {
  try {
    return localStorage.getItem("yatouji-ai-hub-authenticated") === "true";
  } catch (error) {
    console.error("Could not read the account navigation state.", error);
    return false;
  }
}

async function toggleSavedResource(button) {
  const id = button.dataset.favorite;
  const isSaved = favorites.has(id);
  button.disabled = true;
  try {
    if (isAccountMarkedAuthenticated()) {
      const client = await getAccountClient();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.user) {
        try {
          localStorage.setItem("yatouji-ai-hub-authenticated", "false");
        } catch (storageError) {
          console.error("Could not update the account navigation state.", storageError);
        }
        window.dispatchEvent(new CustomEvent("yatouji:auth-state", {
          detail: { authenticated: false }
        }));
        throw new Error(t("accountSessionExpired"));
      }
      const request = isSaved
        ? client.from("saved_items").delete().eq("item_type", "resource").eq("item_id", id)
        : client.from("saved_items").insert({ item_type: "resource", item_id: id });
      const { error } = await request;
      if (error) throw error;
    }
    isSaved ? favorites.delete(id) : favorites.add(id);
    saveFavorites();
    updateFavoriteButtons();
  } catch (error) {
    console.error("Could not update the saved resource.", error);
    setStatus(status, `${t("favoritesSaveFailed")} ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function loadAccountFavorites() {
  if (!isAccountMarkedAuthenticated()) return;
  try {
    const client = await getAccountClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user) {
      try {
        localStorage.setItem("yatouji-ai-hub-authenticated", "false");
      } catch (error) {
        console.error("Could not update the account navigation state.", error);
      }
      window.dispatchEvent(new CustomEvent("yatouji:auth-state", {
        detail: { authenticated: false }
      }));
      return;
    }
    const { data, error } = await client
      .from("saved_items")
      .select("item_id")
      .eq("item_type", "resource");
    if (error) throw error;
    const savedIds = new Set(data.map(item => item.item_id));
    const guestFavorites = [...favorites].filter(id => !savedIds.has(id));
    if (guestFavorites.length) {
      const { error: saveError } = await client.from("saved_items").insert(
        guestFavorites.map(item_id => ({ item_type: "resource", item_id }))
      );
      if (saveError) throw saveError;
    }
    favorites = new Set([...savedIds, ...guestFavorites]);
    saveFavorites();
    updateFavoriteButtons();
  } catch (error) {
    console.error("Could not load saved resources for the signed-in user.", error);
    setStatus(status, `${t("favoritesLoadFailed")} ${error.message}`);
  }
}

async function loadJson(path) {
  const response = await fetch(`${root}${path}?v=2`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  return response.json();
}

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
    if (!Array.isArray(saved) || saved.some(item => typeof item !== "string")) {
      throw new TypeError("Saved favorites have an invalid format.");
    }
    return new Set(saved);
  } catch (error) {
    console.error("Could not read saved AI Hub favorites.", error);
    setStatus(status, t("favoritesLoadFailed"));
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(favoritesKey, JSON.stringify([...favorites]));
    return true;
  } catch (error) {
    console.error("Could not save AI Hub favorites.", error);
    setStatus(status, t("favoritesSaveFailed"));
    return false;
  }
}

function updateFavoriteButtons() {
  document.querySelectorAll("[data-favorite]").forEach(button => {
    const saved = favorites.has(button.dataset.favorite);
    button.setAttribute("aria-pressed", String(saved));
    const item = resourceMap().get(button.dataset.favorite);
    if (item) {
      button.setAttribute("aria-label", message(saved ? "favoriteRemoveLabel" : "favoriteAddLabel", { title: item.title }));
    }
    if (button.dataset.favoriteLabel !== "true") {
      button.textContent = saved ? t("favoriteSaved") : t("favoriteSave");
    } else {
      button.textContent = saved ? "★" : "☆";
    }
  });
}

function setupNavigation() {
  const menuButton = document.querySelector(".hub-menu-toggle");
  const nav = document.getElementById("hub-nav");
  if (!menuButton || !nav || nav.dataset.navigationInitialized === "true") return;

  const closeMenu = () => {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", t("navMenuToggle"));
  };
  menuButton.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", t(open ? "navMenuClose" : "navMenuToggle"));
  });
  nav.addEventListener("click", event => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
}

async function copyText(text, button) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
    }
    const original = button.textContent;
    button.textContent = t("copied");
    window.setTimeout(() => { button.textContent = original; }, 1400);
  } catch (error) {
    console.error("Could not copy resource text.", error);
    const feedback = button.parentElement?.querySelector("[data-copy-status]");
    setStatus(feedback, t("copyFailed"));
  }
}

function setupInteractions() {
  document.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) {
      toggleSavedResource(favoriteButton);
      return;
    }
    const copyButton = event.target.closest("[data-copy-target]");
    if (copyButton) {
      const target = document.getElementById(copyButton.dataset.copyTarget);
      if (!target) {
        setStatus(copyButton.parentElement?.querySelector("[data-copy-status]"), t("copyMissing"));
        return;
      }
      copyText(target.innerText, copyButton);
    }
  });
}

function resourceCard(item, compact = false) {
  return `<article class="hub-resource-card${compact ? " hub-resource-card-compact" : ""}">
    <div class="hub-resource-meta"><span>${escapeHtml(item.resourceType)}</span><span>${escapeHtml(item.price)}</span></div>
    <h3><a href="${resourcePath(item)}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.description)}</p>
    <div class="hub-card-tags">${(item.tags ?? []).slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="hub-resource-card-footer">
      <a href="${resourcePath(item)}">${escapeHtml(t("resourceDetails"))} <span aria-hidden="true">↗</span></a>
      <button type="button" data-favorite-label="true" data-favorite="${escapeHtml(item.id)}" aria-label="Save ${escapeHtml(item.title)} to favorites" aria-pressed="false">☆</button>
    </div>
  </article>`;
}

function articleCard(item) {
  const text = item.blocks
    ? item.blocks.map(block => block.text ?? (block.items ?? []).join(" ")).join(" ")
    : item.summary;
  const readTime = Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 220));
  return `<article class="hub-article-card">
    <div class="hub-article-card-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(message("articleReadMinutes", { count: readTime }))}</span></div>
    <h3><a href="${articlePath(item)}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="hub-article-card-footer"><span>${escapeHtml(item.author)} · ${formatDate(item.publishedAt)}</span><a href="${articlePath(item)}">${escapeHtml(t("articleReadGuide"))} <span aria-hidden="true">↗</span></a></div>
  </article>`;
}

function sortNewest(items) {
  return [...items].sort((a, b) =>
    (b.updatedAt || b.publishedAt || "").localeCompare(a.updatedAt || a.publishedAt || "") ||
    a.title.localeCompare(b.title)
  );
}

function initHome() {
  document.querySelectorAll("[data-count]").forEach(element => {
    element.textContent = String(resourceItems.filter(item => item.category === element.dataset.count).length);
  });

  const featured = document.getElementById("featured-resources");
  if (featured) {
    featured.innerHTML = resourceItems.filter(item => item.featured).slice(0, 3).map(item => resourceCard(item)).join("");
    if (!featured.children.length) setStatus(document.querySelector("[data-resource-status]"), t("noFeaturedResources"));
  }
  const recent = document.getElementById("recent-resources");
  if (recent) recent.innerHTML = sortNewest(resourceItems).slice(0, 4).map(item => resourceCard(item, true)).join("");

  const homeArticles = document.getElementById("home-articles");
  if (homeArticles) {
    homeArticles.innerHTML = sortNewest(articleItems).slice(0, 3).map(articleCard).join("");
  }

  const datalist = document.getElementById("hub-suggestions");
  if (datalist) {
    datalist.innerHTML = [...new Set([
      ...resourceItems.map(item => item.title),
      ...articleItems.map(item => item.category)
    ])].slice(0, 20).map(value => `<option value="${escapeHtml(value)}"></option>`).join("");
  }
  updateFavoriteButtons();
}

function getResourceSearchText(item) {
  return normalize([
    item.title,
    item.description,
    item.category,
    item.resourceType,
    item.license,
    item.difficultyLevel,
    item.price,
    ...(item.tags ?? []),
    ...(item.useCases ?? []),
    ...(item.fileFormat ?? []),
    ...(item.compatiblePlatforms ?? [])
  ].join(" "));
}

function addSelectOptions(select, values) {
  if (!select) return;
  const unique = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML += unique.map(value =>
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ).join("");
}

function initCatalog() {
  const container = document.querySelector('[data-page="catalog"], [data-page="search"]');
  if (!container) return;

  const categorySelect = document.getElementById("filter-category");
  const typeSelect = document.getElementById("filter-type");
  const platformSelect = document.getElementById("filter-platform");
  const formatSelect = document.getElementById("filter-format");
  const licenseSelect = document.getElementById("filter-license");
  const difficultySelect = document.getElementById("filter-difficulty");
  const priceSelect = document.getElementById("filter-price");
  const queryInput = document.getElementById("catalog-query");
  const resultContainer = document.getElementById("catalog-results");
  const count = document.getElementById("filter-count");
  const empty = document.getElementById("catalog-empty");

  addSelectOptions(categorySelect, resourceItems.map(item => item.category));
  addSelectOptions(typeSelect, resourceItems.map(item => item.resourceType));
  addSelectOptions(platformSelect, resourceItems.flatMap(item => item.compatiblePlatforms ?? []));
  addSelectOptions(formatSelect, resourceItems.flatMap(item => item.fileFormat ?? []));
  addSelectOptions(licenseSelect, resourceItems.map(item => item.license));
  addSelectOptions(difficultySelect, resourceItems.map(item => item.difficultyLevel));
  addSelectOptions(priceSelect, resourceItems.map(item => item.price));

  const presetCategory = container.dataset.category;
  if (presetCategory && categorySelect) categorySelect.value = presetCategory;
  const params = new URLSearchParams(location.search);
  const query = params.get("q") || "";
  if (queryInput) queryInput.value = query;

  const articleResults = document.getElementById("search-articles");
  const update = () => {
    const term = normalize(queryInput?.value);
    const matches = resourceItems.filter(item => {
      const categoryMatch = !categorySelect?.value || item.category === categorySelect.value;
      const typeMatch = !typeSelect?.value || item.resourceType === typeSelect.value;
      const platformMatch = !platformSelect?.value || (item.compatiblePlatforms ?? []).includes(platformSelect.value);
      const formatMatch = !formatSelect?.value || (item.fileFormat ?? []).includes(formatSelect.value);
      const licenseMatch = !licenseSelect?.value || item.license === licenseSelect.value;
      const difficultyMatch = !difficultySelect?.value || item.difficultyLevel === difficultySelect.value;
      const priceMatch = !priceSelect?.value || item.price === priceSelect.value;
      return categoryMatch && typeMatch && platformMatch && formatMatch && licenseMatch &&
        difficultyMatch && priceMatch && (!term || getResourceSearchText(item).includes(term));
    });

    const sort = document.getElementById("filter-sort")?.value;
    if (sort === "alphabetical") matches.sort((a, b) => a.title.localeCompare(b.title));
    else matches.sort((a, b) =>
      (b.updatedAt || b.publishedAt || "").localeCompare(a.updatedAt || a.publishedAt || "") ||
      a.title.localeCompare(b.title)
    );

    if (resultContainer) resultContainer.innerHTML = matches.map(item => resourceCard(item)).join("");
    setStatus(count, message("resourcesCount", { count: matches.length }));
    if (empty) empty.hidden = matches.length > 0;

    if (articleResults) {
      const matchingArticles = sortNewest(articleItems.filter(item => {
        const text = normalize([item.title, item.summary, item.category, ...(item.tags ?? [])].join(" "));
        return !term || text.includes(term);
      }));
      articleResults.innerHTML = matchingArticles.slice(0, 6).map(articleCard).join("") ||
        `<p class="hub-empty-state">${escapeHtml(t("noGuidesMatch"))}</p>`;
    }
    updateFavoriteButtons();
  };

  container.querySelectorAll("input, select").forEach(control => control.addEventListener("input", update));
  container.querySelectorAll("select").forEach(control => control.addEventListener("change", update));
  document.getElementById("clear-filters")?.addEventListener("click", () => {
    container.querySelectorAll("select").forEach(select => { select.value = ""; });
    if (presetCategory && categorySelect) categorySelect.value = presetCategory;
    if (queryInput) queryInput.value = "";
    update();
  });
  update();
}

function initKnowledge() {
  const container = document.querySelector('[data-page="knowledge"]');
  if (!container) return;
  const searchForm = document.getElementById("article-search");
  const queryInput = document.getElementById("article-query");
  const articleContainer = document.getElementById("knowledge-articles");
  const count = document.getElementById("article-count");
  const pageStatus = document.getElementById("articles-page-status");
  const previous = document.getElementById("articles-prev");
  const next = document.getElementById("articles-next");
  const pageSize = 6;
  let currentPage = 1;
  let activeCategory = new URLSearchParams(location.search).get("category") || "";

  if (queryInput) queryInput.value = new URLSearchParams(location.search).get("q") || "";
  const chips = [...container.querySelectorAll("[data-article-category]")];
  const update = () => {
    const term = normalize(queryInput?.value);
    const filtered = sortNewest(articleItems.filter(item => {
      const text = normalize([
        item.title, item.summary, item.metaDescription, item.category, ...(item.tags ?? [])
      ].join(" "));
      return (!activeCategory || item.category === activeCategory) && (!term || text.includes(term));
    }));
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    articleContainer.innerHTML = visible.map(articleCard).join("") ||
      `<p class="hub-empty-state">${escapeHtml(t("noArticlesMatch"))}</p>`;
    setStatus(count, message("articlesCount", { count: filtered.length }));
    setStatus(pageStatus, message("pageCount", { current: currentPage, total: pageCount }));
    previous.disabled = currentPage <= 1;
    next.disabled = currentPage >= pageCount;
    chips.forEach(chip => {
      const active = chip.dataset.articleCategory === activeCategory;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  };

  chips.forEach(chip => chip.addEventListener("click", () => {
    activeCategory = chip.dataset.articleCategory;
    currentPage = 1;
    update();
  }));
  queryInput?.addEventListener("input", () => { currentPage = 1; update(); });
  searchForm?.addEventListener("submit", event => event.preventDefault());
  previous?.addEventListener("click", () => { currentPage -= 1; update(); });
  next?.addEventListener("click", () => { currentPage += 1; update(); });
  update();
}

function initTools() {
  const container = document.querySelector('[data-page="tools"]');
  if (!container || !toolDirectory) return;
  const query = document.getElementById("tool-query");
  const category = document.getElementById("tool-category");
  const cards = document.getElementById("tool-directory");
  const count = document.getElementById("tool-count");
  const notice = document.getElementById("tool-directory-notice");
  setStatus(notice, `${toolDirectory.notice} ${message("toolChecked", { date: formatDate(toolDirectory.verifiedOn) })}.`);
  addSelectOptions(category, toolDirectory.tools.map(item => item.category));

  const update = () => {
    const term = normalize(query?.value);
    const matches = toolDirectory.tools.filter(item => {
      const text = normalize([
        item.name, item.category, item.summary, ...(item.platforms ?? [])
      ].join(" "));
      return (!term || text.includes(term)) && (!category?.value || item.category === category.value);
    });
    cards.innerHTML = matches.map(item => `<article class="hub-tool-card">
      <div class="hub-resource-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(message("toolChecked", { date: formatDate(item.verifiedOn) }))}</span></div>
      <h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.summary)}</p>
      <p class="hub-tool-platforms"><strong>${escapeHtml(t("toolPlatform"))}</strong> ${item.platforms.map(escapeHtml).join("; ")}</p>
      <p class="hub-tool-pricing">${escapeHtml(item.pricingNote)}</p>
      <div class="hub-file-actions"><a class="hub-button hub-button-primary" href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("toolOfficialWebsite"))} <span aria-hidden="true">↗</span></a>
      <a class="hub-button hub-button-quiet" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("toolSourceDocs"))}</a>
      ${item.pricingUrl ? `<a class="hub-text-link" href="${escapeHtml(item.pricingUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("toolOfficialPricing"))} ↗</a>` : ""}</div>
    </article>`).join("") || `<p class="hub-empty-state">${escapeHtml(t("toolNoDirectoryEntries"))}</p>`;
    setStatus(count, message("toolSourcesShown", { count: matches.length }));
  };
  query?.addEventListener("input", update);
  category?.addEventListener("change", update);
  update();

  const updates = document.getElementById("official-updates");
  if (updates) {
    updates.innerHTML = toolDirectory.officialUpdates.map(item => `<article class="hub-official-card">
      <p class="hub-eyebrow">${escapeHtml(message("toolOfficialSourceChecked", { date: formatDate(item.verifiedOn) }))}</p>
      <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p>
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("toolOpenOfficialPage"))} <span aria-hidden="true">↗</span></a>
    </article>`).join("");
  }
  const guidance = document.getElementById("comparison-guidance");
  if (guidance) guidance.innerHTML = toolDirectory.comparisonGuidance.map(item => `<li>${escapeHtml(item)}</li>`).join("");
}

const projectCollections = {
  "ecommerce-seo": {
    title: "E-commerce SEO starter pack",
    ids: ["agent-ecommerce-seo", "agent-seo-audit", "agent-keyword-research", "skill-technical-seo", "skill-content-optimization", "skill-schema-markup", "workflow-seo-audit-prep", "code-article-jsonld"]
  },
  "content-operations": {
    title: "Content operations toolkit",
    ids: ["agent-content-writer", "agent-keyword-research", "skill-content-optimization", "skill-internal-linking", "skill-geo-optimization", "code-article-jsonld", "code-csv-summary"]
  },
  "campaign-planning": {
    title: "Campaign planning essentials",
    ids: ["agent-ads-assistant", "agent-lead-generation", "skill-meta-ads-copy", "skill-google-ads-keywords", "workflow-campaign-brief", "code-utm-builder", "code-csv-summary"]
  }
};

function projectScore(item, queryTerms) {
  const useCases = (item.useCases ?? []).map(normalize);
  const tags = (item.tags ?? []).map(normalize);
  const titleAndDescription = normalize(`${item.title} ${item.description}`);
  let score = 0;
  for (const term of queryTerms) {
    if (useCases.some(value => value === term || value.includes(term))) score += 5;
    if (tags.some(value => value === term || value.includes(term))) score += 3;
    if (titleAndDescription.includes(term)) score += 1;
  }
  return score;
}

function getProjectRecommendations(input, preset) {
  const collection = projectCollections[preset];
  if (collection) {
    return collection.ids.map(id => resourceMap().get(id)).filter(Boolean);
  }

  const normalized = normalize(input);
  if (
    normalized.includes("seo") &&
    (normalized.includes("e commerce") || normalized.includes("ecommerce") || normalized.includes("online store"))
  ) {
    return projectCollections["ecommerce-seo"].ids.map(id => resourceMap().get(id)).filter(Boolean);
  }
  const expanded = new Set(normalized.split(" ").filter(word => word.length > 2));
  if (normalized.includes("e commerce") || normalized.includes("online store")) expanded.add("ecommerce");
  if (normalized.includes("google ads") || normalized.includes("paid search")) expanded.add("ads");
  if (normalized.includes("meta ads") || normalized.includes("paid social")) expanded.add("ads");
  if (normalized.includes("write content") || normalized.includes("blog")) expanded.add("content");
  const matches = resourceItems
    .map(item => ({ item, score: projectScore(item, expanded) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, 8)
    .map(result => result.item);

  return matches;
}

function renderProjectToolSuggestions(input) {
  const section = document.getElementById("builder-tools-section");
  const container = document.getElementById("builder-tool-suggestions");
  if (!section || !container || !toolDirectory?.tools?.length) return;
  const terms = normalize(input).split(" ").filter(term => term.length > 2);
  const matches = toolDirectory.tools
    .map(item => {
      const text = normalize([item.name, item.category, item.summary, ...(item.platforms ?? [])].join(" "));
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 5)
    .map(result => result.item);
  section.hidden = matches.length === 0;
  container.innerHTML = matches.map(item => `<article class="hub-tool-card">
    <div class="hub-resource-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.pricingNote)}</span></div>
    <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary)}</p>
    <a class="hub-button hub-button-quiet" href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("toolOfficialWebsite"))} ↗</a>
  </article>`).join("");
}

const projectNeedRules = [
  { key: "builderPlanNeedVisibility", terms: ["seo", "geo", "search", "keyword", "ecommerce", "e commerce", "online store"] },
  { key: "builderPlanNeedCampaigns", terms: ["ads", "advertising", "campaign", "paid", "marketing", "meta", "google", "linkedin"] },
  { key: "builderPlanNeedAutomation", terms: ["automation", "automate", "workflow", "n8n", "zapier", "make"] },
  { key: "builderPlanNeedContent", terms: ["content", "blog", "copywriting", "writing"] },
  { key: "builderPlanNeedMeasurement", terms: ["analytics", "tracking", "report", "metrics", "data"] }
];

function renderProjectPlan(input, items) {
  const section = document.getElementById("builder-plan");
  const container = document.getElementById("builder-plan-content");
  if (!section || !container) return;
  const selected = items.filter(Boolean);
  if (!input.trim() || !selected.length) {
    section.hidden = true;
    container.replaceChildren();
    return;
  }

  const normalized = normalize(input);
  const inputWords = new Set(normalized.split(" "));
  const needs = projectNeedRules
    .filter(rule => rule.terms.some(term => term.includes(" ")
      ? normalized.includes(term)
      : inputWords.has(term)))
    .map(rule => t(rule.key));
  if (!needs.length) needs.push(t("builderPlanNeedGeneral"));

  container.innerHTML = `
    <article class="hub-tool-card">
      <h3>${escapeHtml(t("builderPlanObjective"))}</h3>
      <p>${escapeHtml(input.trim())}</p>
    </article>
    <article class="hub-tool-card">
      <h3>${escapeHtml(t("builderPlanNeeds"))}</h3>
      <ul>${needs.map(need => `<li>${escapeHtml(need)}</li>`).join("")}</ul>
    </article>
    <article class="hub-tool-card">
      <h3>${escapeHtml(t("builderPlanResources"))}</h3>
      <ul>${selected.map(item => `<li><a href="${escapeHtml(resourcePath(item))}">${escapeHtml(item.title)}</a> <span>${escapeHtml(item.resourceType)}</span></li>`).join("")}</ul>
    </article>
    <article class="hub-tool-card">
      <h3>${escapeHtml(t("builderPlanSteps"))}</h3>
      <ol>
        <li><strong>${escapeHtml(t("builderPlanStepScopeTitle"))}</strong><p>${escapeHtml(t("builderPlanStepScopeBody"))}</p></li>
        <li><strong>${escapeHtml(t("builderPlanStepReviewTitle"))}</strong><p>${escapeHtml(t("builderPlanStepReviewBody"))}</p></li>
        <li><strong>${escapeHtml(t("builderPlanStepImplementTitle"))}</strong><p>${escapeHtml(t("builderPlanStepImplementBody"))}</p></li>
        <li><strong>${escapeHtml(t("builderPlanStepMeasureTitle"))}</strong><p>${escapeHtml(t("builderPlanStepMeasureBody"))}</p></li>
      </ol>
    </article>`;
  section.hidden = false;
}

function initProjectBuilder() {
  const container = document.querySelector('[data-page="builder"]');
  if (!container) return;
  const form = document.getElementById("project-form");
  const description = document.getElementById("project-description");
  const projectName = document.getElementById("project-name");
  const recommendations = document.getElementById("builder-recommendations");
  const builderStatus = document.getElementById("builder-status");
  const selectedList = document.getElementById("builder-selection");
  const selectionCount = document.getElementById("builder-selection-count");
  const saveButton = document.getElementById("save-project");
  const downloadButton = document.getElementById("download-project-pack");
  const downloadStatus = document.getElementById("builder-download-status");
  const selectedIds = new Set();
  const params = new URLSearchParams(location.search);
  const preset = params.get("project");
  const resourceId = params.get("resource");
  let activePreset = projectCollections[preset] ? preset : "";
  if (resourceId && resourceMap().has(resourceId)) {
    selectedIds.add(resourceId);
    description.value = resourceMap().get(resourceId).title;
  }
  if (preset && projectCollections[preset]) {
    description.value = projectCollections[preset].title;
    if (projectName) projectName.value = preset;
    renderRecommendations(projectCollections[preset].ids.map(id => resourceMap().get(id)).filter(Boolean));
    setStatus(builderStatus, message("builderCollectionStatus", { title: projectCollections[preset].title }));
  } else if (resourceId && resourceMap().has(resourceId)) {
    renderRecommendations([resourceMap().get(resourceId)]);
    setStatus(builderStatus, t("builderResourceAdded"));
  }
  if (description.value.trim()) renderProjectToolSuggestions(description.value);
  description.addEventListener("input", () => { activePreset = ""; });

  function renderRecommendations(items) {
    selectedIds.clear();
    items.forEach(item => selectedIds.add(item.id));
    recommendations.innerHTML = items.map(item => `<article class="hub-builder-choice">
      <label class="hub-builder-choice-label">
        <input type="checkbox" data-select-resource="${escapeHtml(item.id)}" checked>
        <span class="hub-builder-check" aria-hidden="true"></span>
        <span class="hub-builder-choice-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.resourceType)} · ${escapeHtml(item.license)} · ${item.files.length} file${item.files.length === 1 ? "" : "s"}</small><span>${escapeHtml(item.description)}</span></span>
      </label>
      <a class="hub-builder-details" href="${resourcePath(item)}" target="_blank" rel="noopener">${escapeHtml(t("builderFindDetails"))} ↗</a>
    </article>`).join("") || `<p class="hub-empty-state">${escapeHtml(t("builderNoResults"))}</p>`;
    recommendations.querySelectorAll("[data-select-resource]").forEach(input => {
      input.addEventListener("change", () => {
        input.checked ? selectedIds.add(input.dataset.selectResource) : selectedIds.delete(input.dataset.selectResource);
        renderSelection();
      });
    });
    renderSelection();
  }

  function renderSelection() {
    const selected = [...selectedIds].map(id => resourceMap().get(id)).filter(Boolean);
    const fileCount = selected.reduce((total, item) => total + item.files.length, 0);
    setStatus(selectionCount, message(selected.length === 1 ? "builderOneSelection" : "builderManySelection", {
      resources: selected.length,
      files: fileCount
    }));
    selectedList.innerHTML = selected.map(item => `<article class="hub-selected-item"><strong>${escapeHtml(item.title)}</strong><span>${item.files.map(file => escapeHtml(file.name)).join(", ")}</span></article>`).join("") ||
      `<p class="hub-empty-state">${escapeHtml(t("builderSelectOne"))}</p>`;
    renderProjectPlan(description.value, selected);
    if (saveButton) saveButton.disabled = selected.length === 0;
    downloadButton.disabled = selected.length === 0;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const projectText = description.value.trim();
    if (!projectText) {
      setStatus(builderStatus, t("builderDescribeFirst"));
      return;
    }
    renderProjectToolSuggestions(projectText);
    const items = getProjectRecommendations(projectText, activePreset);
    activePreset = "";
    if (!items.length) {
      selectedIds.clear();
      renderRecommendations([]);
      setStatus(builderStatus, t("builderNoMatch"));
      return;
    }
    renderRecommendations(items);
    setStatus(builderStatus, message(items.length === 1 ? "builderResourceCount" : "builderCollectionCount", {
      count: items.length
    }));
  });

  saveButton?.addEventListener("click", async () => {
    const selected = [...selectedIds].map(id => resourceMap().get(id)).filter(Boolean);
    const projectDescription = description.value.trim();
    if (!selected.length || !projectDescription) return;
    saveButton.disabled = true;
    setStatus(downloadStatus, t("builderSavingProject"));
    try {
      const client = await getAccountClient();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.user) {
        setStatus(downloadStatus, t("builderSaveRequiresLogin"));
        const signInLink = document.createElement("a");
        signInLink.href = `${root}account.html?mode=signin`;
        signInLink.textContent = t("accountSignIn");
        downloadStatus.append(" ", signInLink);
        return;
      }
      const projectTitle = (projectName?.value.trim() || projectDescription.slice(0, 100)).slice(0, 160);
      const { data: project, error: projectError } = await client
        .from("projects")
        .insert({
          title: projectTitle,
          description: projectDescription,
          status: "draft",
          locale
        })
        .select("id")
        .single();
      if (projectError) throw projectError;
      const { error: itemsError } = await client.from("project_items").insert(
        selected.map((item, position) => ({
          project_id: project.id,
          item_type: "resource",
          item_id: item.id,
          position
        }))
      );
      if (itemsError) {
        const { error: rollbackError } = await client.from("projects").delete().eq("id", project.id);
        if (rollbackError) console.error("Could not remove the incomplete saved project.", rollbackError);
        throw itemsError;
      }
      setStatus(downloadStatus, t("builderProjectSaved"));
      const savedProjectsLink = document.createElement("a");
      savedProjectsLink.href = `${root}account.html#saved-projects`;
      savedProjectsLink.textContent = t("accountSavedProjects");
      downloadStatus.append(" ", savedProjectsLink);
    } catch (error) {
      console.error("Could not save the project to the account.", error);
      setStatus(downloadStatus, message("builderSaveFailed", { error: error.message }));
    } finally {
      saveButton.disabled = selectedIds.size === 0;
    }
  });

  downloadButton.addEventListener("click", async () => {
    const selected = [...selectedIds].map(id => resourceMap().get(id)).filter(Boolean);
    if (!selected.length) return;
    downloadButton.disabled = true;
    setStatus(downloadStatus, t("builderPreparing"));
    try {
      const files = [];
      const fileList = [];
      const dependencies = new Set();
      const installSteps = [];
      for (const item of selected) {
        (item.dependencies ?? []).forEach(dependency => dependencies.add(dependency));
        installSteps.push(`## ${item.title}\n${(item.installationGuide ?? []).map((step, index) => `${index + 1}. ${step}`).join("\n")}`);
        for (const file of item.files) {
          const fileUrl = new URL(`${root}${file.path}`, location.href);
          if (fileUrl.origin !== location.origin) throw new Error("A resource file points outside this website.");
          const response = await fetch(fileUrl.href);
          if (!response.ok) throw new Error(`Could not download ${file.path} (HTTP ${response.status}).`);
          const content = new Uint8Array(await response.arrayBuffer());
          const archiveName = `resources/${item.id}/${file.name}`;
          files.push({ name: archiveName, content });
          fileList.push(`- ${archiveName} (${item.license})`);
        }
      }

      const safeName = (projectName?.value || "yatouji-ai-hub-project")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "yatouji-ai-hub-project";
      const readme = `# ${safeName}\n\nCurated resource package created from YATOUJI AI HUB.\n\nThis package contains the files selected in the Project Builder. Recommendations use local keyword rules; no AI API or user profile was connected.\n\n## Selected resources\n${selected.map(item => `- **${item.title}** — ${item.description}\n  - Version: ${item.version}\n  - License: ${item.license}\n  - Details: ${location.origin}${root}resources/${item.slug}.html`).join("\n")}\n\n## Included files\n${fileList.join("\n")}\n\n## Before use\n- Inspect every file and adapt placeholders.\n- Check the license and attribution requirements for each resource.\n- Do not store API keys, passwords, tokens, or private credentials in this package.\n- Never execute downloaded scripts or activate a workflow automatically.\n- Test with fictional or non-sensitive data first.\n`;
      const dependencyList = [...dependencies].length
        ? [...dependencies].map(value => `- ${value}`).join("\n")
        : "- No additional dependencies are listed.";
      const config = {
        projectName: safeName,
        websiteUrl: "https://example.invalid",
        environment: "replace-with-your-environment",
        note: "No credentials belong in this file. Configure secrets in your runtime's approved secret manager."
      };
      files.push(
        { name: "README.md", content: readme },
        { name: "INSTALLATION.md", content: `# Installation notes\n\n${installSteps.join("\n\n")}\n\n## Dependencies\n${dependencyList}\n\n## Safe configuration\nUse configuration.example.json for non-secret project settings. Configure credentials only through a platform-approved secret manager.\n` },
        { name: "DEPENDENCIES.txt", content: dependencyList },
        { name: "configuration.example.json", content: `${JSON.stringify(config, null, 2)}\n` }
      );

      const archive = createZip(files);
      const blob = new Blob([archive], { type: "application/zip" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${safeName}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setStatus(downloadStatus, message("builderZipCreated", { name: safeName, count: files.length }));
    } catch (error) {
      console.error("Could not create the project ZIP.", error);
      setStatus(downloadStatus, message("builderZipFailed", { error: error.message }));
    } finally {
      downloadButton.disabled = selectedIds.size === 0;
    }
  });

  if (resourceId || preset) renderSelection();
}

function showLoadError(error) {
  console.error("YATOUJI AI HUB data could not be loaded.", error);
  const messageText = t("catalogDataError");
  setStatus(status, `${messageText} ${error.message}`);
  document.querySelectorAll("[data-resource-status], [data-article-status]").forEach(element => setStatus(element, messageText));
  document.querySelectorAll("#catalog-results, #knowledge-articles, #home-articles, #featured-resources, #recent-resources")
    .forEach(element => { element.innerHTML = `<p class="hub-empty-state">${escapeHtml(message)}</p>`; });
}

async function init() {
  if (window.yatoujiI18nReady) {
    try {
      await window.yatoujiI18nReady;
    } catch (error) {
      console.error("The hub translations could not be initialized.", error);
      setStatus(status, error.message);
    }
  }
  setupNavigation();
  setupInteractions();
  favorites = readFavorites();
  try {
    const [resourceFile, articleFile, toolsFile] = await Promise.all([
      loadJson("content/resources.json"),
      loadJson("content/articles.json"),
      loadJson("content/ai-tools.json")
    ]);
    resourceItems = resourceFile.resources.map(item => ({ ...resourceFile.defaults, ...item }));
    articleItems = articleFile.articles;
    toolDirectory = toolsFile;
    initHome();
    initCatalog();
    initKnowledge();
    initTools();
    initProjectBuilder();
    await loadAccountFavorites();
    updateFavoriteButtons();
  } catch (error) {
    showLoadError(error);
  }
}

init();
