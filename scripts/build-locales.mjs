import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ayoubyatouji.github.io";
const locales = ["fr", "en", "ar"];
const dictionaries = JSON.parse(await readFile(path.join(root, "content/platform-i18n.json"), "utf8"));
const publicDirectories = ["articles", "assets", "content", "knowledge", "marketplace", "resources"];
const excludedRootFiles = new Set(["feed.xml", "robots.txt", "service-worker.js", "sitemap.xml"]);
const platformPages = {
  "account.html": ["pageAccount", "accountIntro"],
  "assistant.html": ["pageAssistant", "assistantIntro"],
  "prompts.html": ["pagePrompts", "promptsIntro"],
  "models-arena.html": ["pageModels", "modelsIntro"],
  "marketing-toolbox.html": ["pageToolbox", "toolboxIntro"],
  "learning.html": ["pageLearning", "learningIntro"],
  "playground.html": ["pagePlayground", "playgroundIntro"],
  "contribute.html": ["pageContribute", "contributeIntro"]
};
const languageNames = {
  fr: { fr: "français", en: "anglais", ar: "arabe" },
  en: { fr: "French", en: "English", ar: "Arabic" },
  ar: { fr: "الفرنسية", en: "الإنجليزية", ar: "العربية" }
};

const escapeAttribute = value => String(value).replace(/[&"]/g, character => (
  character === "&" ? "&amp;" : "&quot;"
));

function sourceLanguage(html) {
  const body = html.match(/<body\b[^>]*>/i)?.[0] ?? "";
  const declared = body.match(/\bdata-content-language=["'](fr|en|ar)["']/i)?.[1];
  if (declared) return declared.toLowerCase();
  return html.match(/<html\b[^>]*\blang=["'](fr|en|ar)["']/i)?.[1]?.toLowerCase() || "en";
}

function setBodyLanguage(html, language) {
  return html.replace(/<body\b[^>]*>/i, tag => {
    if (/\bdata-content-language=["']/.test(tag)) {
      return tag.replace(/\bdata-content-language=["'][^"']*["']/, `data-content-language="${language}"`);
    }
    return tag.replace(/>$/, ` data-content-language="${language}">`);
  });
}

function addAlternateLinks(html, relativePath) {
  const links = locales.map(locale => {
    const target = relativePath === "index.html"
      ? `${siteUrl}/${locale}/`
      : `${siteUrl}/${locale}/${relativePath}`;
    return `<link rel="alternate" hreflang="${locale}" href="${target}">`;
  });
  const fallback = relativePath === "index.html"
    ? `${siteUrl}/`
    : `${siteUrl}/fr/${relativePath}`;
  links.push(`<link rel="alternate" hreflang="x-default" href="${fallback}">`);
  const output = links.join("\n  ");
  const withoutOld = html.replace(/<link\b[^>]*\bhreflang=["'][^"']+["'][^>]*>\s*/gi, "");
  return withoutOld.replace("</head>", `  ${output}\n</head>`);
}

function injectRuntime(html, relativePath) {
  if (/\bsrc=["'][^"']*i18n\.js(?:\?[^"']*)?["']/i.test(html)) return html;
  const depth = path.posix.dirname(relativePath) === "." ? 0 : path.posix.dirname(relativePath).split("/").length;
  const rootPrefix = "../".repeat(depth);
  return html.replace("</body>", `  <script src="${rootPrefix}i18n.js?v=2"></script>\n</body>`);
}

function updateTag(html, expression, update) {
  return expression.test(html) ? html.replace(expression, update) : html;
}

function setMeta(html, selector, content) {
  const expression = new RegExp(`<meta\\b(?=[^>]*\\b${selector})[^>]*>`, "i");
  if (!expression.test(html)) return html;
  return html.replace(expression, tag => {
    if (/\bcontent=["']/.test(tag)) {
      return tag.replace(/\bcontent=["'][^"']*["']/, `content="${escapeAttribute(content)}"`);
    }
    return tag.replace(/>$/, ` content="${escapeAttribute(content)}">`);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

function addCanonical(html, canonical) {
  const expression = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i;
  const replacement = `<link rel="canonical" href="${canonical}">`;
  return expression.test(html)
    ? html.replace(expression, replacement)
    : html.replace("</head>", `  ${replacement}\n</head>`);
}

function addOrUpdateMeta(html, attribute, key, content) {
  const selector = `${attribute}=["']${key}["']`;
  const expression = new RegExp(`<meta\\b(?=[^>]*\\b${selector})[^>]*>`, "i");
  if (expression.test(html)) return setMeta(html, selector, content);
  return html.replace("</head>", `  <meta ${attribute}="${key}" content="${escapeAttribute(content)}">\n</head>`);
}

function localizeWebsiteSchema(html, locale, description, canonical) {
  if (!/<body\b[^>]*\bdata-platform-page=["']home["']/i.test(html)) return html;
  return html.replace(
    /<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/i,
    (_, json) => {
      try {
        const schema = JSON.parse(json);
        schema.url = canonical;
        schema.description = description;
        schema.inLanguage = locale;
        return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
      } catch (error) {
        console.error("Could not update localized WebSite structured data.", error);
        throw error;
      }
    }
  );
}

function localeMetadata(relativePath, locale, original, originalLanguage) {
  const messages = dictionaries[locale];
  let title = original.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "YATOUJI AI HUB";
  let description = original.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*\bcontent=["']([^"']*)["'][^>]*>/i)?.[1] || "";
  let translated = false;

  if (relativePath === "index.html") {
    title = `YATOUJI AI HUB | ${messages.homeTitle}`;
    description = messages.homeDescription;
    translated = true;
  } else if (platformPages[path.posix.basename(relativePath)]) {
    const [titleKey, descriptionKey] = platformPages[path.posix.basename(relativePath)];
    title = `${messages[titleKey]} | YATOUJI AI HUB`;
    description = messages[descriptionKey];
    translated = true;
  }

  if (!translated && originalLanguage !== locale) {
    const sourceLabel = languageNames[locale][originalLanguage] || originalLanguage;
    const suffix = messages.metadataContentIn.replace("{language}", sourceLabel);
    title = `${title} — ${suffix}`;
    description = `${description} ${suffix}.`.trim();
  }
  return { title, description };
}

async function writeLocalized(relativePath, locale, sourceHtml) {
  const destination = path.join(root, locale, ...relativePath.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });

  const originalLanguage = sourceLanguage(sourceHtml);
  let html = sourceHtml;
  html = html.replace(/<html\b([^>]*)>/i, (_, attributes) => {
    const withoutLanguage = attributes.replace(/\s+lang=["'][^"']*["']/i, "").replace(/\s+dir=["'][^"']*["']/i, "");
    return `<html${withoutLanguage} lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">`;
  });
  html = setBodyLanguage(html, originalLanguage);

  const metadata = localeMetadata(relativePath, locale, sourceHtml, originalLanguage);
  html = updateTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  html = setMeta(html, `name=["']description["']`, metadata.description);
  html = setMeta(html, `property=["']og:title["']`, metadata.title);
  html = setMeta(html, `property=["']og:description["']`, metadata.description);
  const canonical = relativePath === "index.html"
    ? `${siteUrl}/${locale}/`
    : `${siteUrl}/${locale}/${relativePath}`;
  html = addCanonical(html, canonical);
  html = setMeta(html, `property=["']og:url["']`, canonical);
  html = addOrUpdateMeta(html, "property", "og:locale", locale === "ar" ? "ar_AR" : locale === "fr" ? "fr_FR" : "en_US");
  html = addOrUpdateMeta(html, "name", "twitter:title", metadata.title);
  html = addOrUpdateMeta(html, "name", "twitter:description", metadata.description);
  html = localizeWebsiteSchema(html, locale, metadata.description, canonical);
  html = addAlternateLinks(html, relativePath);
  html = injectRuntime(html, relativePath);

  await writeFile(destination, html, "utf8");
}

async function copyPublicTree(locale) {
  await mkdir(path.join(root, locale), { recursive: true });
  const rootEntries = await readdir(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile() || entry.name.endsWith(".zip") || excludedRootFiles.has(entry.name)) continue;
    if (entry.name.endsWith(".html")) {
      const relativePath = entry.name;
      const sourceHtml = await readFile(path.join(root, entry.name), "utf8");
      const language = sourceLanguage(sourceHtml);
      let updatedRoot = sourceHtml
        .replaceAll("style.css?v=10", "style.css?v=11")
        .replaceAll("i18n.js?v=1", "i18n.js?v=2")
        .replaceAll("hub.js?v=1", "hub.js?v=2");
      updatedRoot = setBodyLanguage(updatedRoot, language);
      updatedRoot = injectRuntime(updatedRoot, relativePath);
      updatedRoot = addAlternateLinks(updatedRoot, relativePath);
      await writeFile(path.join(root, entry.name), updatedRoot, "utf8");
      await writeLocalized(relativePath, locale, updatedRoot);
    } else if (entry.name === "manifest.webmanifest") {
      const manifest = JSON.parse(await readFile(path.join(root, entry.name), "utf8"));
      manifest.start_url = "./index.html";
      manifest.scope = "./";
      await writeFile(path.join(root, locale, entry.name), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    } else {
      const destination = path.join(root, locale, entry.name);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(root, entry.name), destination);
    }
  }

  for (const directory of publicDirectories) {
    await copyDirectory(path.join(root, directory), path.join(root, locale, directory));
  }
}

async function copyDirectory(source, destination) {
  let entries;
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".html")) {
        const relativePath = path.relative(root, sourcePath).split(path.sep).join("/");
        const sourceHtml = await readFile(sourcePath, "utf8");
        const language = sourceLanguage(sourceHtml);
        let updatedRoot = setBodyLanguage(sourceHtml, language);
        updatedRoot = injectRuntime(updatedRoot, relativePath);
        updatedRoot = addAlternateLinks(updatedRoot, relativePath);
        await writeFile(sourcePath, updatedRoot, "utf8");
        await writeLocalized(relativePath, "fr", updatedRoot);
        await writeLocalized(relativePath, "en", updatedRoot);
        await writeLocalized(relativePath, "ar", updatedRoot);
      } else {
        await copyFile(sourcePath, destinationPath);
      }
    }
  }
}

export async function buildLocales() {
  const rootFiles = (await readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith(".html"))
    .map(entry => entry.name);
  const nestedHtml = [];
  async function collectHtml(directory) {
    let entries;
    try {
      entries = await readdir(path.join(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await collectHtml(relative);
      else if (entry.isFile() && entry.name.endsWith(".html")) nestedHtml.push(relative);
    }
  }
  for (const directory of ["articles", "knowledge", "resources"]) await collectHtml(directory);
  const routes = [...rootFiles, ...nestedHtml].filter(file => file !== "404.html").sort();

  for (const locale of locales) await copyPublicTree(locale);

  console.log(`Generated ${routes.length} static routes in /fr/, /en/, and /ar/.`);
  return routes;
}
