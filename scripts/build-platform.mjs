import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ayoubyatouji.github.io";
const translations = JSON.parse(await readFile(path.join(root, "content/platform-i18n.json"), "utf8"));
const pages = [
  ["account.html", "account", "pageAccount", "accountIntro"],
  ["assistant.html", "assistant", "pageAssistant", "assistantIntro"],
  ["prompts.html", "prompts", "pagePrompts", "promptsIntro"],
  ["models-arena.html", "models", "pageModels", "modelsIntro"],
  ["marketing-toolbox.html", "toolbox", "pageToolbox", "toolboxIntro"],
  ["learning.html", "learning", "pageLearning", "learningIntro"],
  ["playground.html", "playground", "pagePlayground", "playgroundIntro"],
  ["contribute.html", "contribute", "pageContribute", "contributeIntro"]
];

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function platformShell({ file, id, titleKey, descriptionKey }) {
  const text = translations.fr;
  const title = `${text[titleKey]} | YATOUJI AI HUB`;
  const description = text[descriptionKey];
  const nav = [
    ["index.html", "navHome"],
    ["agents.html", "navMarketplace"],
    ["knowledge.html", "navKnowledge"],
    ["portfolio.html", "navPortfolio"],
    ["account.html", "navAccount"]
  ].map(([href, key]) => `<a href="${href}" data-i18n="${key}">${escapeHtml(text[key])}</a>`).join("");
  const featureLinks = [
    ["assistant.html", "navAssistant"],
    ["prompts.html", "navPrompts"],
    ["models-arena.html", "navModels"],
    ["marketing-toolbox.html", "navToolbox"],
    ["learning.html", "navLearning"],
    ["playground.html", "navPlayground"],
    ["contribute.html", "navContribute"]
  ].map(([href, key]) => `<a href="${href}" data-i18n="${key}">${escapeHtml(text[key])}</a>`).join("");
  const canonical = `${siteUrl}/${file}`;
  return `<!doctype html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${siteUrl}/social-card.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#07030d">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css?v=11">
  <link rel="stylesheet" href="hub.css?v=2">
  <link rel="stylesheet" href="platform.css?v=2">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="hub-body platform-body" data-theme="dark" data-platform-page="${id}" data-content-language="fr">
  <a class="skip-link" href="#main" data-i18n="skipToContent">Aller au contenu</a>
  <header class="hub-header">
    <div class="hub-shell hub-nav-wrap">
      <a class="hub-brand" href="index.html" aria-label="YATOUJI AI HUB"><span class="hub-brand-mark">Y</span><span>YATOUJI <b>AI HUB</b></span></a>
      <button class="menu-toggle hub-menu-toggle" type="button" aria-label="Ouvrir le menu" data-i18n-aria="navMenuToggle" aria-expanded="false" aria-controls="hub-nav">☰</button>
      <nav class="main-nav hub-nav" id="hub-nav" aria-label="Navigation principale" data-i18n-aria="navLabel">
        ${nav}
        <details class="hub-nav-more">
          <summary data-i18n="navMore">${escapeHtml(text.navMore)}</summary>
          <div class="hub-nav-more-menu">${featureLinks}</div>
        </details>
        <label class="locale-selector"><span class="sr-only" data-i18n="language">Langue</span><select data-locale-switcher aria-label="Langue"><option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option></select></label>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Changer de thème" aria-pressed="true">☀</button>
      </nav>
    </div>
  </header>
  <main id="main">
    <section class="hub-page-hero">
      <div class="hub-shell">
        <nav class="hub-breadcrumbs" aria-label="Fil d’Ariane" data-i18n-aria="breadcrumbsLabel"><a href="index.html" data-i18n="navHome">Accueil</a><span aria-hidden="true">/</span><span data-i18n="${titleKey}">${escapeHtml(text[titleKey])}</span></nav>
        <p class="hub-eyebrow">YATOUJI AI HUB</p>
        <h1 data-i18n="${titleKey}">${escapeHtml(text[titleKey])}</h1>
        <p class="hub-page-intro" data-i18n="${descriptionKey}">${escapeHtml(description)}</p>
      </div>
    </section>
    <section class="hub-section"><div class="hub-shell" id="platform-app" data-platform-app="${id}" aria-live="polite"><p class="hub-status" role="status">Chargement du module…</p></div></section>
  </main>
  <footer class="hub-footer">
    <div class="hub-shell hub-footer-inner">
      <a class="hub-brand" href="index.html"><span class="hub-brand-mark">Y</span><span>YATOUJI <b>AI HUB</b></span></a>
      <p data-i18n="footerTagline">Discover. Download. Automate. · Curated by Ayoub Yatouji</p>
      <div><a href="portfolio.html" data-i18n="navPortfolio">Portfolio</a><a href="confidentialite.html" data-i18n="footerPrivacy">Confidentialité</a><a href="README.md" data-i18n="footerGuide">Guide de publication</a></div>
    </div>
  </footer>
  ${file === "account.html" ? '<script src="supabase-client-config.js?v=2"></script>' : ""}
  <script src="site.js?v=1"></script>
  <script src="i18n.js?v=2"></script>
  <script type="module" src="platform.js?v=3"></script>
</body>
</html>`;
}

for (const [file, id, titleKey, descriptionKey] of pages) {
  const destination = path.join(root, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, platformShell({ file, id, titleKey, descriptionKey }), "utf8");
}

console.log(`Built ${pages.length} platform feature pages.`);
