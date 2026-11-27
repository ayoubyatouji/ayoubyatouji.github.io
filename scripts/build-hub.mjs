import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ayoubyatouji.github.io";
const today = new Date().toISOString().slice(0, 10);

const readJson = async relativePath =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const exists = async relativePath => {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const jsonForHtml = value => JSON.stringify(value).replace(/</g, "\\u003c");
const absoluteUrl = relativePath => `${siteUrl}/${relativePath.replace(/^\/+/, "")}`;
const niceDate = value => {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
};
const wordsIn = text => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

const resourceData = await readJson("content/resources.json");
const articleData = await readJson("content/articles.json");
const toolData = await readJson("content/ai-tools.json");
const resources = resourceData.resources.map(item => ({
  ...resourceData.defaults,
  ...item
}));
const articles = articleData.articles;
const resourceById = new Map(resources.map(item => [item.id, item]));
const articleById = new Map(articles.map(item => [item.id, item]));
const generatedPages = [];
const generatedFiles = [];

function assertUnique(items, label) {
  const ids = new Set();
  const slugs = new Set();
  for (const item of items) {
    if (!item.id || !item.slug || !item.title || !item.description && label === "resource") {
      throw new Error(`A ${label} is missing required identifying metadata.`);
    }
    if (ids.has(item.id) || slugs.has(item.slug)) {
      throw new Error(`Duplicate ${label} id or slug: ${item.id} / ${item.slug}`);
    }
    ids.add(item.id);
    slugs.add(item.slug);
  }
}

async function validateFiles() {
  assertUnique(resources, "resource");
  assertUnique(articles, "article");
  const resourceIds = new Set(resources.map(item => item.id));
  const articleIds = new Set(articles.map(item => item.id));

  for (const resource of resources) {
    for (const file of resource.files ?? []) {
      const normalized = path.normalize(file.path);
      if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
        throw new Error(`Resource file path must stay inside the site: ${file.path}`);
      }
      if (!file.name || !(await exists(file.path))) {
        throw new Error(`Resource file is missing or unnamed: ${file.path}`);
      }
      if (file.path.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(await readFile(path.join(root, file.path), "utf8"));
        if (resource.category === "workflows") {
          if (!Array.isArray(parsed.nodes) || parsed.active !== false || !parsed.connections) {
            throw new Error(`Workflow must be a valid inactive n8n export: ${file.path}`);
          }
          if (parsed.nodes.some(node => node.credentials)) {
            throw new Error(`Workflow export must not contain credentials: ${file.path}`);
          }
        }
      }
    }
    for (const id of resource.relatedResources ?? []) {
      if (!resourceIds.has(id)) throw new Error(`Unknown related resource ${id} on ${resource.id}`);
    }
  }
  for (const article of articles) {
    if (!article.metaDescription || !article.category || !article.publishedAt || !article.author) {
      throw new Error(`Article metadata is incomplete: ${article.id}`);
    }
    if (article.existingPath && !(await exists(article.existingPath))) {
      throw new Error(`Existing article page is missing: ${article.existingPath}`);
    }
    for (const id of article.relatedArticles ?? []) {
      if (!articleIds.has(id)) throw new Error(`Unknown related article ${id} on ${article.id}`);
    }
    for (const id of article.relatedResources ?? []) {
      if (!resourceIds.has(id)) throw new Error(`Unknown related resource ${id} on ${article.id}`);
    }
  }
}

function navLink(rootPrefix, href, label, active, activeKey, translationKey) {
  return `<a href="${rootPrefix}${href}" data-i18n="${translationKey}"${active === activeKey ? ' aria-current="page"' : ""}>${label}</a>`;
}

function pageShell({ title, description, canonical, body, rootPrefix = "", active = "", schema = null, pageType = "", extraHead = "", scripts = [] }) {
  const schemaTag = schema
    ? `<script type="application/ld+json">${jsonForHtml(schema)}</script>`
    : "";
  const scriptTags = [
    `<script src="${rootPrefix}site.js?v=1"></script>`,
    ...scripts.map(source => `<script src="${rootPrefix}${source}"></script>`),
    `<script type="module" src="${rootPrefix}hub.js?v=2"></script>`
  ].join("\n  ");
  const nav = [
    navLink(rootPrefix, "index.html", "Home", active, "home", "navHome"),
    navLink(rootPrefix, "agents.html", "AI Agents", active, "agents", "navAgents"),
    navLink(rootPrefix, "skills.html", "AI Skills", active, "skills", "navSkills"),
    navLink(rootPrefix, "workflows.html", "Workflows", active, "workflows", "navWorkflows"),
    navLink(rootPrefix, "code-library.html", "Code Library", active, "code", "navCode"),
    navLink(rootPrefix, "project-builder.html", "Project Builder", active, "builder", "navBuilder"),
    navLink(rootPrefix, "ai-tools.html", "AI Tools", active, "tools", "navTools"),
    navLink(rootPrefix, "knowledge.html", "Knowledge Hub", active, "knowledge", "navKnowledge"),
    navLink(rootPrefix, "portfolio.html", "About / Portfolio", active, "portfolio", "navPortfolio"),
    navLink(rootPrefix, "account.html", "Account", active, "account", "navAccount"),
    `<a href="${rootPrefix}index.html#contact" data-i18n="navContact">Contact</a>`,
    `<details class="hub-nav-more"><summary data-i18n="navMore">More</summary><div class="hub-nav-more-menu">
      <a href="${rootPrefix}assistant.html" data-i18n="navAssistant">Assistant</a>
      <a href="${rootPrefix}prompts.html" data-i18n="navPrompts">Prompts</a>
      <a href="${rootPrefix}models-arena.html" data-i18n="navModels">AI models</a>
      <a href="${rootPrefix}marketing-toolbox.html" data-i18n="navToolbox">Toolbox</a>
      <a href="${rootPrefix}learning.html" data-i18n="navLearning">Learning</a>
      <a href="${rootPrefix}playground.html" data-i18n="navPlayground">Playground</a>
      <a href="${rootPrefix}contribute.html" data-i18n="navContribute">Contribute</a>
    </div></details>`,
    '<button class="theme-toggle" type="button" data-theme-toggle aria-label="Enable light theme" aria-pressed="true">☀</button>'
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="${pageType === "article" ? "article" : "website"}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${siteUrl}/social-card.png">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#07030d">
  <link rel="icon" href="${rootPrefix}favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${rootPrefix}apple-touch-icon.png">
  <link rel="manifest" href="${rootPrefix}manifest.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="YATOUJI AI HUB Knowledge Hub" href="${rootPrefix}feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${rootPrefix}style.css?v=11">
  <link rel="stylesheet" href="${rootPrefix}hub.css?v=2">
  <link rel="stylesheet" href="${rootPrefix}platform.css?v=2">
  ${extraHead}
  ${schemaTag}
</head>
<body class="hub-body" data-theme="dark" data-hub-root="${rootPrefix}"${pageType ? ` data-page-type="${pageType}"` : ""}>
  <a class="skip-link" href="#main" data-i18n="skipToContent">Skip to content</a>
  <header class="hub-header">
    <div class="hub-shell hub-nav-wrap">
      <a class="hub-brand" href="${rootPrefix}index.html" aria-label="YATOUJI AI HUB home"><span class="hub-brand-mark">Y</span><span>YATOUJI <b>AI HUB</b></span></a>
      <button class="menu-toggle hub-menu-toggle" type="button" aria-label="Open menu" data-i18n-aria="navMenuToggle" aria-expanded="false" aria-controls="hub-nav">☰</button>
      <nav class="main-nav hub-nav" id="hub-nav" aria-label="Main navigation" data-i18n-aria="navLabel">${nav}</nav>
    </div>
  </header>
  <main id="main">${body}</main>
  <footer class="hub-footer">
    <div class="hub-shell hub-footer-inner">
      <a class="hub-brand" href="${rootPrefix}index.html"><span class="hub-brand-mark">Y</span><span>YATOUJI <b>AI HUB</b></span></a>
      <p data-i18n="footerTagline">Discover. Download. Automate. · Curated by Ayoub Yatouji</p>
      <div><a href="${rootPrefix}portfolio.html" data-i18n="navPortfolio">Portfolio</a><a href="${rootPrefix}confidentialite.html" data-i18n="footerPrivacy">Privacy</a><a href="${rootPrefix}README.md" data-i18n="footerGuide">Publishing guide</a></div>
    </div>
  </footer>
  ${scriptTags}
</body>
</html>`;
}

function resourceHref(item) {
  return `resources/${item.slug}.html`;
}

function articleHref(item) {
  return item.existingPath || `articles/${item.slug}.html`;
}

function resourceCard(item, rootPrefix = "") {
  return `<article class="hub-resource-card">
    <div class="hub-resource-meta"><span>${escapeHtml(item.resourceType)}</span><span>${escapeHtml(item.price)}</span></div>
    <h3><a href="${rootPrefix}${resourceHref(item)}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.description)}</p>
    <div class="hub-card-tags">${(item.tags ?? []).slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="hub-resource-card-footer">
      <a href="${rootPrefix}${resourceHref(item)}">Details &amp; files <span aria-hidden="true">↗</span></a>
      <button type="button" data-favorite="${escapeHtml(item.id)}" aria-label="Save ${escapeHtml(item.title)} to favorites" aria-pressed="false">☆</button>
    </div>
  </article>`;
}

function articleCard(item, rootPrefix = "") {
  const readingWords = item.blocks
    ? item.blocks.map(block => block.text ?? (block.items ?? []).join(" ")).join(" ")
    : item.summary;
  const readMinutes = Math.max(1, Math.ceil(wordsIn(readingWords) / 220));
  return `<article class="hub-article-card">
    <div class="hub-article-card-meta"><span>${escapeHtml(item.category)}</span><span>${readMinutes} min read</span></div>
    <h3><a href="${rootPrefix}${articleHref(item)}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="hub-article-card-footer"><span>${escapeHtml(item.author)} · ${niceDate(item.publishedAt)}</span><a href="${rootPrefix}${articleHref(item)}">Read guide <span aria-hidden="true">↗</span></a></div>
  </article>`;
}

function filterMarkup() {
  return `<div class="hub-filter-panel" role="search">
    <label class="hub-filter-search" data-i18n="filterSearch">Search
      <input id="catalog-query" type="search" placeholder="Search title, description, tags…" data-i18n-placeholder="filterSearchPlaceholder" autocomplete="off">
    </label>
    <label data-i18n="filterCategory">Category<select id="filter-category"><option value="" data-i18n="filterAllCategories">All categories</option></select></label>
    <label data-i18n="filterType">Resource type<select id="filter-type"><option value="" data-i18n="filterAllTypes">All types</option></select></label>
    <label data-i18n="filterPlatform">Platform<select id="filter-platform"><option value="" data-i18n="filterAllPlatforms">All platforms</option></select></label>
    <label data-i18n="filterFormat">Format<select id="filter-format"><option value="" data-i18n="filterAllFormats">All formats</option></select></label>
    <label data-i18n="filterLicense">License<select id="filter-license"><option value="" data-i18n="filterAllLicenses">All licenses</option></select></label>
    <label data-i18n="filterDifficulty">Difficulty<select id="filter-difficulty"><option value="" data-i18n="filterAllLevels">All levels</option></select></label>
    <label data-i18n="filterPrice">Price<select id="filter-price"><option value="" data-i18n="filterAllPrices">All prices</option></select></label>
    <label data-i18n="filterSort">Sort<select id="filter-sort"><option value="newest" data-i18n="sortNewest">Newest</option><option value="alphabetical" data-i18n="sortAlphabetical">Alphabetical</option></select></label>
    <button class="hub-button hub-button-quiet" id="clear-filters" type="button" data-i18n="clearFilters">Clear filters</button>
  </div>
  <p class="hub-status" id="filter-count" role="status" aria-live="polite"></p>
  <div class="hub-resource-grid" id="catalog-results"></div>
  <p class="hub-empty-state" id="catalog-empty" data-i18n="noResourcesMatch" hidden>No resources match these filters. Clear a filter or browse all categories.</p>`;
}

function catalogPage(category) {
  const configs = {
    agents: ["AI Agents", "Reusable prompt-based assistants for SEO, content, advertising, and lead workflows.", "AI agent prompts for focused, human-reviewed work."],
    skills: ["AI Skills", "Reusable SKILL.md packages with a portable Markdown fallback and clearly stated runtime requirements.", "Review each skill's format and runtime compatibility before installing."],
    workflows: ["Workflow Marketplace", "Inactive n8n demonstration workflows with real JSON downloads, setup notes, and safety warnings.", "The examples are starters, not production-ready automations."],
    code: ["Code Library", "Downloadable scripts and templates for analytics, reporting, structured data, and explicit API calls.", "Preview code and inspect any file operation or network request before use."]
  };
  const [heading, description, note] = configs[category];
  const canonical = absoluteUrl(category === "code" ? "code-library.html" : `${category}.html`);
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><span>${escapeHtml(heading)}</span></nav>
    <p class="hub-eyebrow">YATOUJI AI HUB · MARKETPLACE</p><h1>${escapeHtml(heading)}</h1>
    <p class="hub-page-intro">${escapeHtml(description)}</p><p class="hub-notice">${escapeHtml(note)}</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell" data-page="catalog" data-category="${category}">
    ${filterMarkup()}
  </div></section>`;
  const categoryActive = category === "code" ? "code" : category;
  return pageShell({
    title: `${heading} | YATOUJI AI HUB`,
    description,
    canonical,
    body,
    active: categoryActive,
    pageType: "catalog"
  });
}

function searchPage() {
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><span data-i18n="filterSearch">Search</span></nav>
    <p class="hub-eyebrow">SEARCH THE LIBRARY</p><h1 data-i18n="searchPageHeading">Find a resource or guide.</h1>
    <p class="hub-page-intro" data-i18n="searchPageIntro">Search the curated resource catalogue and Knowledge Hub. No popularity ranking is shown because downloads are not tracked.</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell" data-page="search">
    ${filterMarkup()}
    <div class="hub-search-articles"><div class="hub-section-heading"><div><p class="hub-eyebrow" data-i18n="navKnowledge">Knowledge Hub</p><h2 data-i18n="searchRelatedGuides">Related guides</h2></div></div><div class="hub-article-grid" id="search-articles"></div></div>
  </div></section>`;
  return pageShell({
    title: "Search resources and guides | YATOUJI AI HUB",
    description: "Search the YATOUJI AI HUB resource catalogue and practical guides.",
    canonical: absoluteUrl("search.html"),
    body,
    active: "",
    pageType: "search"
  });
}

function projectBuilderPage() {
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><span data-i18n="navBuilder">Project Builder</span></nav>
    <p class="hub-eyebrow">LOCAL CURATED RECOMMENDATIONS</p><h1 data-i18n="builderPageHeading">Build a project pack.</h1>
    <p class="hub-page-intro" data-i18n="builderPageIntro">Describe your project, review suggested resources, choose the actual files you need, and create a ZIP in your browser.</p>
    <p class="hub-notice" data-i18n="builderSafetyNote">Recommendations use transparent keyword rules and curated collections. No AI API, account, or user profile is connected. Inspect every file before using it.</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell hub-builder" data-page="builder">
    <form id="project-form" class="hub-builder-form">
      <label for="project-description" data-i18n="builderDescriptionLabel">What are you building?</label>
      <textarea id="project-description" name="project" rows="4" dir="auto" placeholder="Example: I want to improve SEO for an e-commerce website…" data-i18n-placeholder="builderDescriptionPlaceholder" required></textarea>
      <div class="hub-builder-form-row"><label for="project-name" data-i18n="builderProjectName">Package name <input id="project-name" name="name" type="text" dir="ltr" maxlength="60" placeholder="my-project" data-i18n-placeholder="builderProjectNamePlaceholder"></label><button class="hub-button hub-button-primary" type="submit" data-i18n="builderFindResources">Find resources <span aria-hidden="true">↗</span></button></div>
    </form>
    <div class="hub-builder-summary" id="builder-status" role="status" aria-live="polite"></div>
    <div class="hub-builder-results" id="builder-recommendations"></div>
    <div class="hub-builder-download"><div><h2 data-i18n="builderSelectedFiles">Selected files</h2><p id="builder-selection-count" data-i18n="builderNoFiles">No files selected.</p></div><button class="hub-button hub-button-primary" id="download-project-pack" type="button" disabled data-i18n="builderDownloadZip">Download project ZIP</button></div>
    <p class="hub-status" id="builder-download-status" role="status" aria-live="polite"></p>
    <div id="builder-selection" class="hub-builder-selection"></div>
  </div></section>`;
  return pageShell({
    title: "Project Builder | Create a curated resource ZIP",
    description: "Describe a project, choose relevant AI Hub resources, and download a ZIP containing the actual selected files and setup notes.",
    canonical: absoluteUrl("project-builder.html"),
    body,
    active: "builder",
    pageType: "builder"
  });
}

function knowledgePage() {
  const categories = articleData.categories.map(category =>
    `<button type="button" class="hub-topic-chip" data-article-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
  const topicLinks = articleData.categoryDetails.map(category =>
    `<a class="hub-topic-card" href="knowledge/${escapeHtml(category.slug)}.html"><span>${escapeHtml(category.name)}</span><i aria-hidden="true">↗</i><small>${escapeHtml(category.description)}</small></a>`
  ).join("");
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><span data-i18n="knowledgePageHeading">Knowledge Hub</span></nav>
    <p class="hub-eyebrow">PRACTICAL GUIDES · SOURCES · NO FAKE LIVE NEWS</p><h1 data-i18n="knowledgePageHeading">Knowledge Hub</h1>
    <p class="hub-page-intro" data-i18n="knowledgePageIntro">Editorial guides on SEO &amp; GEO, paid media, AI tools, and automation — with official sources and verification dates where relevant.</p>
    <form class="hub-search hub-knowledge-search" id="article-search" role="search"><label class="sr-only" for="article-query" data-i18n="knowledgeSearchLabel">Search Knowledge Hub articles</label><span aria-hidden="true">⌕</span><input id="article-query" type="search" placeholder="Search articles, topics, tags…" data-i18n-placeholder="knowledgeSearchPlaceholder" autocomplete="off"><button type="submit" data-i18n="searchButton">Search</button></form>
    <div class="hub-topic-list" aria-label="Filter by topic"><button type="button" class="hub-topic-chip is-active" data-article-category="" data-i18n="knowledgeAllTopics">All topics</button>${categories}</div>
  </div></section>
  <section class="hub-section"><div class="hub-shell" data-page="knowledge">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Editorial library</p><h2 data-i18n="knowledgeGuidesTitle">Guides and articles</h2></div><p data-i18n="knowledgeSourceNotice">Articles with platform or product details show a verification date and link to official sources.</p></div>
    <div class="hub-topic-page-grid" aria-label="Browse topic landing pages">${topicLinks}</div>
    <p class="hub-status" id="article-count" role="status" aria-live="polite"></p>
    <div class="hub-article-grid" id="knowledge-articles"></div>
    <div class="hub-pagination"><button type="button" id="articles-prev" class="hub-button hub-button-quiet" disabled data-i18n="knowledgePrevious">Previous</button><span id="articles-page-status" aria-live="polite"></span><button type="button" id="articles-next" class="hub-button hub-button-quiet" disabled data-i18n="knowledgeNext">Next</button></div>
  </div></section>
  <section class="hub-section hub-section-tint"><div class="hub-shell hub-newsletter-inner">
    <div><p class="hub-eyebrow" data-i18n="homeStayInTouch">Email updates</p><h2 data-i18n="knowledgeUpdatesHeading">Stay current without a fake signup form.</h2><p data-i18n="knowledgeUpdatesText">No subscription service is connected and this site does not store email addresses. Contact Ayoub directly to request occasional updates.</p></div>
    <a class="hub-button hub-button-primary" href="mailto:ayoubyatoujii@gmail.com?subject=YATOUJI%20AI%20HUB%20updates" data-i18n="knowledgeRequestUpdates">Request updates <span aria-hidden="true">↗</span></a>
  </div></section>`;
  return pageShell({
    title: "Knowledge Hub | SEO, Ads, AI and Automation Guides",
    description: "Practical, sourced guides on SEO and GEO, Meta Ads, Google Ads, LinkedIn Ads, AI, and automation.",
    canonical: absoluteUrl("knowledge.html"),
    body,
    active: "knowledge",
    pageType: "knowledge"
  });
}

function aiToolsPage() {
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><span>AI Tools Directory</span></nav>
    <p class="hub-eyebrow">OFFICIAL LINKS · STATIC CURATION</p><h1>AI tools and official updates.</h1>
    <p class="hub-page-intro">A small directory of official product, documentation, and announcement pages. Entries are not live news, endorsements, or product rankings.</p>
    <p class="hub-notice" id="tool-directory-notice"></p>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Explore AI topics</p><h2>News, projects, comparisons, and use cases.</h2></div></div>
    <div class="hub-topic-page-grid">
      <a class="hub-topic-card" href="ai-news.html"><span>AI news sources</span><i aria-hidden="true">↗</i><small>Official announcement pages, not an imported live feed.</small></a>
      <a class="hub-topic-card" href="ai-new-releases.html"><span>New releases</span><i aria-hidden="true">↗</i><small>Official release notes with no unverified summaries.</small></a>
      <a class="hub-topic-card" href="open-source-ai.html"><span>Open-source AI</span><i aria-hidden="true">↗</i><small>Official project links and license-review reminders.</small></a>
      <a class="hub-topic-card" href="ai-comparisons.html"><span>Model comparisons</span><i aria-hidden="true">↗</i><small>A repeatable evaluation method; no fabricated rankings.</small></a>
      <a class="hub-topic-card" href="ai-reviews.html"><span>Product reviews</span><i aria-hidden="true">↗</i><small>Review methodology and a transparent note on what is not reviewed.</small></a>
      <a class="hub-topic-card" href="ai-use-cases.html"><span>AI use cases</span><i aria-hidden="true">↗</i><small>Practical, clearly bounded examples connected to real Hub files.</small></a>
    </div>
  </div></section>
  <section class="hub-section"><div class="hub-shell" data-page="tools">
    <div class="hub-filter-panel"><label>Search tools <input id="tool-query" type="search" placeholder="Search by name, type, or description"></label><label>Category<select id="tool-category"><option value="">All categories</option></select></label></div>
    <p class="hub-status" id="tool-count" role="status" aria-live="polite"></p>
    <div class="hub-tool-grid" id="tool-directory"></div>
  </div></section>
  <section class="hub-section hub-section-tint"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Official sources</p><h2>AI news and product updates</h2></div><p>These are links to publisher-maintained pages, not imported feeds or summaries of live news.</p></div>
    <div class="hub-official-updates" id="official-updates"></div>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Fair comparison</p><h2>Compare tools on the same task.</h2></div></div>
    <ol class="hub-comparison-list" id="comparison-guidance"></ol>
    <p class="hub-notice">No model ranking, price comparison, or capability claim is published here. Check official documentation, terms, and current pricing before use.</p>
  </div></section>`;
  return pageShell({
    title: "AI Tools Directory | Official Links and Updates",
    description: "A curated static directory linking to official AI products, documentation, and announcement pages with verification dates.",
    canonical: absoluteUrl("ai-tools.html"),
    body,
    active: "tools",
    pageType: "tools"
  });
}

function aiTopicPage(kind) {
  const config = {
    news: {
      file: "ai-news.html",
      title: "AI News Sources",
      description: "Official AI news and announcement pages curated by YATOUJI AI HUB. This static page does not publish or summarize live news.",
      eyebrow: "OFFICIAL ANNOUNCEMENT SOURCES",
      heading: "AI news: follow the official source.",
      notice: "No live feed is connected and no individual news claim is published here. Open the publisher's page to check its date, context, and details.",
      records: toolData.officialUpdates,
      section: "Official update pages"
    },
    releases: {
      file: "ai-new-releases.html",
      title: "New AI Releases",
      description: "Official release notes and product update pages for AI tools. Check each release date and current availability at the publisher.",
      eyebrow: "RELEASE NOTES · SOURCE LINKS",
      heading: "New AI releases, from official sources.",
      notice: "This directory does not claim that a particular tool or feature is newly released. It links to publisher-maintained release information for visitors to verify.",
      records: toolData.releaseSources,
      section: "Publisher-maintained release sources"
    },
    openSource: {
      file: "open-source-ai.html",
      title: "Open-source AI Projects",
      description: "A small directory of official open-model platforms, runtimes, and protocols with reminders to check project-level licenses and security.",
      eyebrow: "OPEN MODEL AND SOFTWARE SOURCES",
      heading: "Explore open-source AI carefully.",
      notice: "A platform or protocol does not make every hosted model, dataset, application, or implementation open-source or compatible. Review its own license, terms, and security.",
      records: toolData.openSourceProjects,
      section: "Official project pages"
    }
  }[kind];
  const cards = config.records.map(item => `<article class="hub-official-card">
    <p class="hub-eyebrow">Official source · checked ${niceDate(item.verifiedOn)}</p>
    <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p>
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open official page <span aria-hidden="true">↗</span></a>
  </article>`).join("");
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="ai-tools.html">AI Tools Directory</a><span aria-hidden="true">/</span><span>${escapeHtml(config.title)}</span></nav>
    <p class="hub-eyebrow">${escapeHtml(config.eyebrow)}</p><h1>${escapeHtml(config.heading)}</h1>
    <p class="hub-page-intro">${escapeHtml(config.description)}</p><p class="hub-notice">${escapeHtml(config.notice)}</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Verified links</p><h2>${escapeHtml(config.section)}</h2></div><p>Pages were checked on ${niceDate(toolData.verifiedOn)}. Publisher pages can change at any time.</p></div>
    <div class="hub-official-updates">${cards}</div>
  </div></section>
  <section class="hub-section hub-section-tint"><div class="hub-shell">
    <a class="hub-text-link" href="ai-tools.html">← Back to AI Tools Directory</a>
  </div></section>`;
  return pageShell({
    title: `${config.title} | YATOUJI AI HUB`,
    description: config.description,
    canonical: absoluteUrl(config.file),
    body,
    active: "tools",
    pageType: "ai-directory"
  });
}

function aiComparisonsPage() {
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="ai-tools.html">AI Tools Directory</a><span aria-hidden="true">/</span><span>Model comparisons</span></nav>
    <p class="hub-eyebrow">NO UNIVERSAL RANKINGS</p><h1>Compare AI models on your task.</h1>
    <p class="hub-page-intro">This page provides a repeatable comparison method, not a leaderboard. Outputs depend on task, model version, configuration, and evaluation data.</p>
    <p class="hub-notice">No independent benchmark has been run for this page. Do not treat the tool directory as a comparison or endorsement.</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">A useful experiment</p><h2>Keep the comparison fair and auditable.</h2></div></div>
    <ol class="hub-comparison-list">${toolData.comparisonGuidance.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    <p class="hub-notice">Record what was actually tested; do not infer price, privacy, speed, or general capability from a brief trial. Verify product terms and pricing directly with each provider.</p>
    <a class="hub-button hub-button-primary" href="ai-tools.html">Browse official AI tool links <span aria-hidden="true">↗</span></a>
  </div></section>`;
  return pageShell({
    title: "AI Model Comparisons | A Repeatable Evaluation Method",
    description: "A practical, non-ranking method for comparing AI tools using common tasks, evaluation criteria, source checks, and privacy review.",
    canonical: absoluteUrl("ai-comparisons.html"),
    body,
    active: "tools",
    pageType: "ai-comparison"
  });
}

function aiReviewsPage() {
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="ai-tools.html">AI Tools Directory</a><span aria-hidden="true">/</span><span>Product reviews</span></nav>
    <p class="hub-eyebrow">EDITORIAL TRANSPARENCY</p><h1>AI product reviews.</h1>
    <p class="hub-page-intro">There are no product reviews or ratings published in this static MVP. We will not present untested tools as reviewed or manufacture community feedback.</p>
    <p class="hub-notice">The directory contains official source links only. It is not a review, recommendation, or endorsement.</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Review method</p><h2>What a useful review should include.</h2></div></div>
    <ol class="hub-comparison-list">${toolData.reviewMethod.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    <a class="hub-button hub-button-primary" href="mailto:ayoubyatoujii@gmail.com?subject=AI%20tool%20review%20suggestion">Suggest a tool for evaluation <span aria-hidden="true">↗</span></a>
    <p class="hub-status">This opens an email draft. The site does not store submissions.</p>
  </div></section>`;
  return pageShell({
    title: "AI Product Reviews | YATOUJI AI HUB",
    description: "A transparent AI product review policy. No untested products, ratings, or community reviews are presented as real.",
    canonical: absoluteUrl("ai-reviews.html"),
    body,
    active: "tools",
    pageType: "ai-reviews"
  });
}

function aiUseCasesPage() {
  const cards = toolData.useCases.map(useCase => {
    const linkedResources = useCase.resourceIds.map(id => resourceById.get(id)).filter(Boolean);
    return `<article class="hub-use-case-card"><p class="hub-eyebrow">Demonstration use case</p><h2>${escapeHtml(useCase.title)}</h2><p>${escapeHtml(useCase.description)}</p>
      <div class="hub-related-links">${linkedResources.map(item => `<a href="resources/${escapeHtml(item.slug)}.html">${escapeHtml(item.title)} ↗</a>`).join("")}</div>
    </article>`;
  }).join("");
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="ai-tools.html">AI Tools Directory</a><span aria-hidden="true">/</span><span>AI use cases</span></nav>
    <p class="hub-eyebrow">PRACTICAL · HUMAN-REVIEWED · BOUNDED</p><h1>AI use cases for real project work.</h1>
    <p class="hub-page-intro">These are examples of where the Hub's downloadable prompts, skills, and scripts may support a workflow. They are not claims of measured business impact or autonomous capability.</p>
    <p class="hub-notice">Use fictional or authorized data, verify every output, and review each tool's current terms and data handling before use.</p>
  </div></section>
  <section class="hub-section"><div class="hub-shell hub-use-case-grid">${cards}</div></section>`;
  return pageShell({
    title: "AI Use Cases | Practical Project Examples",
    description: "Bounded AI-assisted use cases for SEO evidence, content briefs, campaign planning, and local reporting, linked to real downloadable resources.",
    canonical: absoluteUrl("ai-use-cases.html"),
    body,
    active: "tools",
    pageType: "ai-use-cases"
  });
}

async function resourcePage(item) {
  const files = [];
  for (let index = 0; index < (item.files ?? []).length; index += 1) {
    const file = item.files[index];
    const fileText = await readFile(path.join(root, file.path), "utf8");
    const preview = fileText.length > 8000 ? `${fileText.slice(0, 8000)}\n\n[Preview shortened. Download the file for the complete contents.]` : fileText;
    const previewId = `resource-preview-${index + 1}`;
    files.push(`<article class="hub-file-card">
      <div class="hub-file-heading"><div><span class="hub-eyebrow">REAL FILE · ${escapeHtml((file.path.split(".").pop() ?? "").toUpperCase())}</span><h3>${escapeHtml(file.name)}</h3><p>${escapeHtml(file.path)}</p></div>
        <div class="hub-file-actions"><button class="hub-button hub-button-quiet" type="button" data-copy-target="${previewId}" data-i18n="copyPreview">Copy preview</button><a class="hub-button hub-button-primary" href="../${escapeHtml(file.path)}" download="${escapeHtml(file.name)}" data-i18n="downloadFile">Download file</a></div>
      </div>
      <details class="hub-preview-details"><summary data-i18n="previewFileContents">Preview file contents</summary><pre id="${previewId}" tabindex="0" dir="ltr"><code>${escapeHtml(preview)}</code></pre><p class="hub-status" data-copy-status role="status" aria-live="polite"></p></details>
    </article>`);
  }

  const related = (item.relatedResources ?? [])
    .map(id => resourceById.get(id))
    .filter(Boolean)
    .slice(0, 4)
    .map(resource => resourceCard(resource, "../"))
    .join("");
  const examples = (item.examples ?? []).map(example => `<li>${escapeHtml(example)}</li>`).join("");
  const workflowIo = item.inputs || item.outputs
    ? `<section class="hub-detail-section"><h2 data-i18n="inputsOutputs">Inputs and outputs</h2><div class="hub-io-grid"><div><h3 data-i18n="inputs">Inputs</h3><ul>${(item.inputs ?? []).map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div><div><h3 data-i18n="outputs">Outputs</h3><ul>${(item.outputs ?? []).map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div></div></section>`
    : "";
  const dependencies = (item.dependencies ?? []).length
    ? (item.dependencies ?? []).map(value => `<li>${escapeHtml(value)}</li>`).join("")
    : '<li data-i18n="noExternalDependencies">No external dependencies listed.</li>';
  const installation = (item.installationGuide ?? []).map(step => `<li>${escapeHtml(step)}</li>`).join("");
  const changelog = (item.changelog ?? []).map(entry => `<li>${escapeHtml(entry)}</li>`).join("");
  const tags = (item.tags ?? []).map(tag => `<span class="hub-tag">${escapeHtml(tag)}</span>`).join("");
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="../index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><a href="../${item.category === "code" ? "code-library.html" : `${item.category}.html`}">${escapeHtml(item.category)}</a><span aria-hidden="true">/</span><span>${escapeHtml(item.title)}</span></nav>
    <p class="hub-eyebrow">${escapeHtml(item.category)} · ${escapeHtml(item.resourceType)}</p><h1>${escapeHtml(item.title)}</h1>
    <p class="hub-page-intro">${escapeHtml(item.description)}</p>
    <div class="hub-detail-actions"><button type="button" class="hub-button hub-button-quiet" data-favorite="${escapeHtml(item.id)}" aria-label="Save ${escapeHtml(item.title)} to favorites" aria-pressed="false" data-i18n="saveResource">☆ Save resource</button><a class="hub-button hub-button-primary" href="#resource-files" data-i18n="previewDownload">Preview and download <span aria-hidden="true">↓</span></a><a class="hub-button hub-button-quiet" href="../project-builder.html?resource=${encodeURIComponent(item.id)}" data-i18n="addToProjectPack">Add to a project pack</a></div>
  </div></section>
  <section class="hub-section"><div class="hub-shell hub-detail-layout">
    <div class="hub-detail-main">
      <section class="hub-detail-section"><h2 data-i18n="aboutThisResource">About this resource</h2><p>${escapeHtml(item.description)}</p><div class="hub-tag-list">${tags}</div></section>
      <section class="hub-detail-section" id="resource-files"><h2 data-i18n="filesAndPreview">Files and preview</h2>${files.join("")}</section>
      <section class="hub-detail-section"><h2 data-i18n="installationGuide">Installation guide</h2><ol>${installation}</ol></section>
      <section class="hub-detail-section"><h2 data-i18n="examples">Examples</h2><ul>${examples || `<li data-i18n="noExample">No example supplied.</li>`}</ul></section>
      ${workflowIo}
      ${related ? `<section class="hub-detail-section"><div class="hub-section-heading"><div><p class="hub-eyebrow" data-i18n="keepExploring">Keep exploring</p><h2 data-i18n="relatedResources">Related resources</h2></div></div><div class="hub-resource-grid hub-resource-grid-compact">${related}</div></section>` : ""}
    </div>
    <aside class="hub-detail-sidebar">
      <h2 data-i18n="resourceDetails">Resource details</h2>
      <dl>
        <dt data-i18n="version">Version</dt><dd>${escapeHtml(item.version)}</dd>
        <dt data-i18n="published">Published</dt><dd>${niceDate(item.publishedAt)}</dd>
        <dt data-i18n="updated">Updated</dt><dd>${niceDate(item.updatedAt)}</dd>
        <dt data-i18n="author">Author</dt><dd>${escapeHtml(item.author)}</dd>
        <dt data-i18n="license">License</dt><dd>${escapeHtml(item.license)}</dd>
        <dt data-i18n="price">Price</dt><dd>${escapeHtml(item.price)}</dd>
        <dt data-i18n="difficulty">Difficulty</dt><dd>${escapeHtml(item.difficultyLevel)}</dd>
        <dt data-i18n="format">Format</dt><dd>${(item.fileFormat ?? []).map(escapeHtml).join(", ")}</dd>
        <dt data-i18n="compatiblePlatforms">Compatible platforms</dt><dd>${(item.compatiblePlatforms ?? []).map(escapeHtml).join("; ")}</dd>
        <dt data-i18n="dependencies">Dependencies</dt><dd><ul>${dependencies}</ul></dd>
      </dl>
      <h3 data-i18n="safetyNotes">Safety notes</h3><p>${escapeHtml(item.safetyNotes)}</p>
      <h3 data-i18n="changelog">Changelog</h3><ul>${changelog}</ul>
      <p class="hub-notice" data-i18n="inspectBeforeUse">Inspect this resource before use. Never execute downloaded files automatically or include private credentials.</p>
    </aside>
  </div></section>`;
  const canonical = absoluteUrl(resourceHref(item));
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: item.title,
    description: item.description,
    identifier: item.id,
    version: item.version,
    datePublished: item.publishedAt,
    dateModified: item.updatedAt,
    author: { "@type": "Person", name: item.author, url: `${siteUrl}/portfolio.html` },
    license: item.license === "MIT"
      ? "https://opensource.org/license/mit"
      : "https://creativecommons.org/licenses/by/4.0/",
    url: canonical,
    isAccessibleForFree: true
  };
  return pageShell({
    title: `${item.title} | YATOUJI AI HUB`,
    description: item.description,
    canonical,
    body,
    rootPrefix: "../",
    active: item.category === "code" ? "code" : item.category,
    schema,
    pageType: "resource"
  });
}

function renderArticleBlocks(blocks = []) {
  return blocks.map((block, index) => {
    if (block.type === "heading") {
      const level = Math.min(3, Math.max(2, Number(block.level) || 2));
      return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
    }
    if (block.type === "list") {
      return `<ul>${(block.items ?? []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (block.type === "callout") {
      return `<aside class="hub-article-callout"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.text)}</p></aside>`;
    }
    if (block.type === "code") {
      const previewId = `article-code-${index + 1}`;
      return `<div class="hub-article-code"><div class="hub-code-toolbar"><span>Example</span><button class="hub-button hub-button-quiet" type="button" data-copy-target="${previewId}">Copy code</button></div><pre id="${previewId}" tabindex="0"><code>${escapeHtml(block.text)}</code></pre><p class="hub-status" data-copy-status role="status" aria-live="polite"></p></div>`;
    }
    return `<p>${escapeHtml(block.text)}</p>`;
  }).join("\n");
}

function breadcrumbSchema(article, canonical) {
  const category = articleData.categoryDetails.find(item => item.name === article.category);
  const categoryUrl = category ? absoluteUrl(`knowledge/${category.slug}.html`) : `${siteUrl}/knowledge.html`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.metaDescription,
        image: [absoluteUrl(article.featuredImage)],
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: { "@type": "Person", name: article.author, url: `${siteUrl}/portfolio.html` },
        publisher: { "@type": "Person", name: article.author, url: `${siteUrl}/portfolio.html` },
        articleSection: article.category,
        keywords: article.tags,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Knowledge Hub", item: `${siteUrl}/knowledge.html` },
          { "@type": "ListItem", position: 3, name: article.category, item: categoryUrl },
          { "@type": "ListItem", position: 4, name: article.title, item: canonical }
        ]
      }
    ]
  };
}

function knowledgeCategoryPage(category) {
  const detail = articleData.categoryDetails.find(item => item.name === category.name);
  if (!detail) throw new Error(`Missing Knowledge Hub category metadata: ${category.name}`);
  const matches = articles.filter(article => article.category === category.name);
  const cards = matches.map(item => articleCard(item, "../")).join("");
  const canonical = absoluteUrl(`knowledge/${detail.slug}.html`);
  const body = `<section class="hub-page-hero"><div class="hub-shell">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="../index.html">Home</a><span aria-hidden="true">/</span><a href="../knowledge.html">Knowledge Hub</a><span aria-hidden="true">/</span><span>${escapeHtml(category.name)}</span></nav>
    <p class="hub-eyebrow">KNOWLEDGE HUB · TOPIC CLUSTER</p><h1>${escapeHtml(category.name)} guides</h1>
    <p class="hub-page-intro">${escapeHtml(detail.description)}</p>
    <p class="hub-notice">Articles are curated static content. Where policies, product details, or platform features can change, check the article's visible verification date and official sources.</p>
    <a class="hub-text-link" href="../knowledge.html">← All Knowledge Hub topics</a>
  </div></section>
  <section class="hub-section"><div class="hub-shell">
    <div class="hub-section-heading"><div><p class="hub-eyebrow">Topic library</p><h2>${matches.length} ${matches.length === 1 ? "guide" : "guides"} in ${escapeHtml(category.name)}</h2></div></div>
    <div class="hub-article-grid">${cards || '<p class="hub-empty-state">No articles have been published in this topic yet.</p>'}</div>
  </div></section>`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Knowledge Hub", item: `${siteUrl}/knowledge.html` },
      { "@type": "ListItem", position: 3, name: category.name, item: canonical }
    ]
  };
  return pageShell({
    title: `${category.name} Guides and Articles | YATOUJI AI HUB`,
    description: detail.description,
    canonical,
    body,
    rootPrefix: "../",
    active: "knowledge",
    schema,
    pageType: "topic"
  });
}

function articlePage(article) {
  const canonical = absoluteUrl(articleHref(article));
  const sources = (article.sources ?? []).map(source =>
    `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a> — ${escapeHtml(source.publisher)}</li>`
  ).join("");
  const relatedArticles = (article.relatedArticles ?? [])
    .map(id => articleById.get(id))
    .filter(item => item && item.id !== article.id)
    .slice(0, 3)
    .map(item => articleCard(item, "../"))
    .join("");
  const relatedResources = (article.relatedResources ?? [])
    .map(id => resourceById.get(id))
    .filter(Boolean)
    .slice(0, 3)
    .map(item => resourceCard(item, "../"))
    .join("");
  const readingWords = article.blocks
    .map(block => block.text ?? (block.items ?? []).join(" "))
    .join(" ");
  const readMinutes = Math.max(1, Math.ceil(wordsIn(readingWords) / 220));
  const body = `<article class="hub-article-page container article">
    <nav class="hub-breadcrumbs" aria-label="Breadcrumb"><a href="../index.html" data-i18n="navHome">Home</a><span aria-hidden="true">/</span><a href="../knowledge.html" data-i18n="navKnowledge">Knowledge Hub</a><span aria-hidden="true">/</span><span>${escapeHtml(article.category)}</span></nav>
    <header class="hub-article-header">
      <p class="hub-eyebrow">${escapeHtml(article.category)}</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="lead">${escapeHtml(article.summary)}</p>
      <div class="hub-article-byline"><span><span data-i18n="articleByline">By </span><a href="../portfolio.html">${escapeHtml(article.author)}</a></span><span><span data-i18n="articlePublished">Published </span>${niceDate(article.publishedAt)}</span><span><span data-i18n="articleUpdated">Updated </span>${niceDate(article.updatedAt)}</span><span data-i18n="articleReadMinutes" data-i18n-count="${readMinutes}">${readMinutes} min read</span></div>
      ${article.lastVerified ? `<p class="hub-verified-date"><span data-i18n="articleLastVerified">Information last checked:</span> <time datetime="${escapeHtml(article.lastVerified)}">${niceDate(article.lastVerified)}</time></p>` : ""}
      ${article.disclaimer ? `<p class="hub-notice" role="note">${escapeHtml(article.disclaimer)}</p>` : ""}
      <figure class="hub-article-cover"><img src="../${escapeHtml(article.featuredImage)}" alt="${escapeHtml(article.featuredImageAlt)}" width="1200" height="630" fetchpriority="high"><figcaption data-i18n="articleCoverCaption">YATOUJI AI HUB editorial cover; illustrative, not a screenshot of the article topic.</figcaption></figure>
    </header>
    <div class="article-body hub-article-content">${renderArticleBlocks(article.blocks)}</div>
    ${sources ? `<section class="hub-article-sources"><h2 data-i18n="articleSources">Sources and further reading</h2><ul>${sources}</ul><p class="hub-verified-date" data-i18n="articleSourceCheck" data-i18n-date="${niceDate(article.lastVerified || article.updatedAt)}">Official source links checked ${niceDate(article.lastVerified || article.updatedAt)}. Confirm current details at the source.</p></section>` : ""}
    <section class="hub-article-feedback"><p data-i18n="articleFeedbackQuestion">Was this guide useful?</p><a href="mailto:ayoubyatoujii@gmail.com?subject=${encodeURIComponent(`Feedback on: ${article.title}`)}&body=${encodeURIComponent("Your feedback (optional): ")}" data-i18n="articleFeedbackEmail">Send feedback by email</a><p data-i18n="articleFeedbackPrivacy">This opens your email app; feedback is not collected or stored by the website.</p></section>
    ${relatedArticles ? `<section class="hub-section hub-related-section"><div class="hub-section-heading"><div><p class="hub-eyebrow" data-i18n="articleContinueLearning">Continue learning</p><h2 data-i18n="articleRelatedArticles">Related articles</h2></div></div><div class="hub-article-grid">${relatedArticles}</div></section>` : ""}
    ${relatedResources ? `<section class="hub-section hub-related-section"><div class="hub-section-heading"><div><p class="hub-eyebrow" data-i18n="articleApplyMethod">Apply the method</p><h2 data-i18n="articleRelatedResources">Related marketplace resources</h2></div></div><div class="hub-resource-grid">${relatedResources}</div></section>` : ""}
    <div class="article-cta"><p data-i18n="articleCtaQuestion">Want to apply this to a project?</p><a class="button button-primary" href="../project-builder.html" data-i18n="articleCtaButton">Build a project pack <span>↗</span></a></div>
  </article>`;
  const schema = breadcrumbSchema(article, canonical);
  return pageShell({
    title: `${article.title} | YATOUJI AI HUB`,
    description: article.metaDescription,
    canonical,
    body,
    rootPrefix: "../",
    active: "knowledge",
    schema,
    pageType: "article",
    extraHead: `<meta property="article:published_time" content="${escapeHtml(article.publishedAt)}"><meta property="article:modified_time" content="${escapeHtml(article.updatedAt)}"><meta property="article:section" content="${escapeHtml(article.category)}">`,
    scripts: ["article.js?v=1"]
  });
}

async function writeGenerated(relativePath, contents) {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf8");
  generatedFiles.push(relativePath);
}

async function buildPages() {
  const rootPages = {
    "agents.html": catalogPage("agents"),
    "skills.html": catalogPage("skills"),
    "workflows.html": catalogPage("workflows"),
    "code-library.html": catalogPage("code"),
    "search.html": searchPage(),
    "project-builder.html": projectBuilderPage(),
    "knowledge.html": knowledgePage(),
    "ai-tools.html": aiToolsPage(),
    "ai-news.html": aiTopicPage("news"),
    "ai-new-releases.html": aiTopicPage("releases"),
    "open-source-ai.html": aiTopicPage("openSource"),
    "ai-comparisons.html": aiComparisonsPage(),
    "ai-reviews.html": aiReviewsPage(),
    "ai-use-cases.html": aiUseCasesPage()
  };
  for (const [file, contents] of Object.entries(rootPages)) {
    await writeGenerated(file, contents);
    generatedPages.push(file);
  }

  for (const item of resources) {
    const relativePath = resourceHref(item);
    await writeGenerated(relativePath, await resourcePage(item));
    generatedPages.push(relativePath);
  }

  for (const article of articles.filter(item => !item.existingPath)) {
    const relativePath = articleHref(article);
    await writeGenerated(relativePath, articlePage(article));
    generatedPages.push(relativePath);
  }

  for (const category of articleData.categories) {
    const detail = articleData.categoryDetails.find(item => item.name === category);
    if (!detail) throw new Error(`Missing topic page metadata for ${category}`);
    const relativePath = `knowledge/${detail.slug}.html`;
    await writeGenerated(relativePath, knowledgeCategoryPage({ name: category }));
    generatedPages.push(relativePath);
  }
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[character]);
}

async function buildSitemapAndFeed(localizedRoutes) {
  const locales = ["fr", "en", "ar"];
  const entries = localizedRoutes.flatMap(file => locales.map(locale => {
    const url = file === "index.html" ? `${siteUrl}/${locale}/` : `${siteUrl}/${locale}/${file}`;
    const alternates = locales.map(alternate => {
      const href = file === "index.html" ? `${siteUrl}/${alternate}/` : `${siteUrl}/${alternate}/${file}`;
      return `    <xhtml:link rel="alternate" hreflang="${alternate}" href="${xmlEscape(href)}"/>`;
    });
    const fallback = file === "index.html" ? `${siteUrl}/` : `${siteUrl}/fr/${file}`;
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(fallback)}"/>`);
    return `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${today}</lastmod>\n${alternates.join("\n")}\n  </url>`;
  }));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`;
  await writeGenerated("sitemap.xml", sitemap);

  const feedArticles = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>YATOUJI AI HUB Knowledge Hub</title>\n  <link>${siteUrl}/knowledge.html</link>\n  <description>Practical guides on SEO, advertising, AI, and automation.</description>\n  <language>en</language>\n${feedArticles.map(article => `  <item>\n    <title>${xmlEscape(article.title)}</title>\n    <link>${xmlEscape(absoluteUrl(articleHref(article)))}</link>\n    <guid>${xmlEscape(absoluteUrl(articleHref(article)))}</guid>\n    <description>${xmlEscape(article.metaDescription)}</description>\n    <category>${xmlEscape(article.category)}</category>\n    <pubDate>${new Date(`${article.publishedAt}T12:00:00Z`).toUTCString()}</pubDate>\n  </item>`).join("\n")}\n</channel></rss>\n`;
  await writeGenerated("feed.xml", feed);
}

async function buildServiceWorker(localizedRoutes) {
  const staticAssets = [
    "style.css?v=11",
    "hub.css?v=2",
    "platform.css?v=2",
    "hub.js?v=2",
    "platform.js?v=3",
    "marketing-tools.js",
    "i18n.js?v=2",
    "marketplace/zip-builder.js",
    "site.js?v=1",
    "account.js?v=2",
    "supabase-client-config.js?v=2",
    "article.js?v=1",
    "content/resources.json?v=2",
    "content/articles.json?v=2",
    "content/ai-tools.json?v=2",
    "content/platform-i18n.json?v=2",
    "content/prompts.json?v=2",
    "content/learning-paths.json?v=2",
    "content/ai-model-sources.json?v=2",
    "content/contribution-template.md",
    "manifest.webmanifest",
    "favicon.svg",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "photo-ayoub.webp",
    "social-card.png",
    "robots.txt",
    "sitemap.xml",
    "feed.xml"
  ];
  const existingPages = [
    "index.html", "en.html", "portfolio.html", "confidentialite.html", "outils.html",
    "tools.html", "ressources.html", "resources.html", "links.html", "carte.html",
    "article-audit-seo.html", "article-pages-piliers.html", "article-seo-geo.html", "account.html"
  ];
  const resourceFiles = resources.flatMap(item => item.files.map(file => file.path));
  const cachePaths = [...new Set([
    ...generatedPages,
    "account.html",
    "assistant.html",
    "prompts.html",
    "models-arena.html",
    "marketing-toolbox.html",
    "learning.html",
    "playground.html",
    "contribute.html",
    ...existingPages,
    ...resourceFiles,
    ...staticAssets,
    ...["fr", "en", "ar"].flatMap(locale => [
      ...localizedRoutes.map(file => `${locale}/${file}`),
      ...staticAssets
        .filter(file => !["robots.txt", "sitemap.xml", "feed.xml"].includes(file))
        .map(file => `${locale}/${file}`)
    ])
  ])];
  const missingFiles = [];
  for (const cachePath of cachePaths) {
    const localPath = cachePath.replace(/^\/+/, "").split("?")[0];
    if (!(await exists(localPath))) missingFiles.push(localPath);
  }
  if (missingFiles.length) {
    throw new Error(`PWA app shell references missing files: ${missingFiles.join(", ")}`);
  }
  const cacheHash = createHash("sha256");
  for (const cachePath of [...cachePaths].sort()) {
    const localPath = cachePath.replace(/^\/+/, "").split("?")[0];
    cacheHash.update(localPath);
    cacheHash.update(await readFile(path.join(root, localPath)));
  }
  const cacheName = `yatouji-ai-hub-${cacheHash.digest("hex").slice(0, 10)}`;
  const worker = `const CACHE_NAME = "${cacheName}";
const APP_SHELL = ${JSON.stringify(cachePaths.map(file => `/${file}`), null, 2)};

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(
      keys.filter(key => (key.startsWith("ayoub-portfolio-") || key.startsWith("yatouji-ai-hub-")) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )),
    self.clients.claim()
  ]));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (!response.ok) return response;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).then(() => response);
    }).catch(() => caches.match(request).then(cached => cached || caches.match("/index.html"))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      return caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).then(() => response);
    }
    return response;
  })));
});
`;
  await writeGenerated("service-worker.js", worker);
}

await validateFiles();
await buildPages();
await import("./build-platform.mjs");
const { buildLocales } = await import("./build-locales.mjs");
const localizedRoutes = await buildLocales();
await buildSitemapAndFeed(localizedRoutes);
const localizedFeed = await readFile(path.join(root, "feed.xml"), "utf8");
for (const locale of ["fr", "en", "ar"]) {
  await writeGenerated(`${locale}/feed.xml`, localizedFeed);
}
await writeGenerated("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
await buildServiceWorker(localizedRoutes);
console.log(`Built ${generatedPages.length + 7} static pages, localized ${localizedRoutes.length} routes, and updated SEO files and service worker.`);
