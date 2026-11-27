import {
  buildRobotsTxt,
  buildSchemaMarkup,
  buildUtmUrl,
  calculateMetric,
  clusterKeywords,
  formatJson,
  makeMetaDescription,
  makeSeoTitle
} from "./marketing-tools.js";

const app = document.getElementById("platform-app");
const page = app?.dataset.platformApp || "";
const locale = document.body.dataset.locale || document.documentElement.lang || "fr";
const messages = window.yatoujiI18n?.messages || {};
const t = key => window.yatoujiI18n?.t(key) || messages[key] || key;
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
  .match(/[\p{L}\p{N}]+/gu) || [];
const setTranslatedText = (element, value) => {
  const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = value;
  else element.textContent = value;
};

async function loadJson(file) {
  const response = await fetch(`content/${file}?v=2`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load ${file} (HTTP ${response.status}).`);
  return response.json();
}

function showStatus(container, message, isError = false) {
  const status = container?.querySelector("[data-platform-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

async function copyText(text, button, status) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.dir = "ltr";
      field.className = "platform-visually-hidden";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Clipboard access is unavailable.");
    }
    if (button) {
      const original = button.textContent;
      button.textContent = t("toolCopied");
      window.setTimeout(() => { button.textContent = original; }, 1500);
    }
    if (status) status.textContent = t("toolCopied");
  } catch (error) {
    console.error("Could not copy platform content.", error);
    if (status) status.textContent = t("toolCopyFailed");
  }
}

function downloadText(text, filename, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function contentLink(item) {
  if (item.kind === "article") {
    return item.existingPath || `articles/${item.slug}.html`;
  }
  return `resources/${item.slug}.html`;
}

function renderRecommendation(item) {
  const kind = item.kind === "article" ? item.category : item.resourceType;
  const linkLabel = item.kind === "article" ? t("articleReadGuide") : t("resourceDetails");
  const tags = item.tags ?? [];
  return `<article class="platform-card">
    <p class="platform-card-kicker">${escapeHtml(kind)}</p>
    <h3><a href="${escapeHtml(contentLink(item))}">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.description || item.summary)}</p>
    <div class="hub-card-tags">${tags.slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <a class="hub-text-link" href="${escapeHtml(contentLink(item))}">${escapeHtml(linkLabel)} ↗</a>
  </article>`;
}

function setupAssistant(resources, articles) {
  const container = app;
  const form = document.getElementById("assistant-form");
  const result = document.getElementById("assistant-results");
  if (!form || !result) return;
  const input = document.getElementById("assistant-query");
  const synonyms = [
    { terms: ["seo", "référencement", "تحسين", "zoekmachine"], match: ["seo", "search", "technical"] },
    { terms: ["ads", "advertising", "publicité", "إعلانات", "annonces"], match: ["ads", "campaign", "advertising"] },
    { terms: ["ecommerce", "e-commerce", "boutique", "متجر", "commerce"], match: ["ecommerce", "product", "online store"] },
    { terms: ["automation", "automatisation", "automatiser", "أتمتة", "workflow", "n8n"], match: ["automation", "workflow", "n8n"] },
    { terms: ["content", "contenu", "محتوى", "blog", "article"], match: ["content", "blog", "article"] },
    { terms: ["lead", "prospect", "leads", "عميل", "prospection"], match: ["lead", "campaign"] },
    { terms: ["data", "reporting", "rapport", "تقرير", "analytics"], match: ["report", "analytics", "data"] },
    { terms: ["prompt", "prompts", "موجّه", "مطالبة"], match: ["prompt", "agent", "skill"] }
  ];
  form.addEventListener("submit", event => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!raw) {
      showStatus(container, t("assistantPlaceholder"), true);
      return;
    }
    const tokens = new Set(normalize(raw));
    const normalizedText = normalize(raw).join(" ");
    for (const group of synonyms) {
      if (group.terms.some(term => normalizedText.includes(normalize(term).join(" ")))) {
        group.match.forEach(term => normalize(term).forEach(token => tokens.add(token)));
      }
    }
    const candidates = [
      ...resources.map(item => ({ ...item, kind: "resource" })),
      ...articles.map(item => ({ ...item, kind: "article" }))
    ];
    const matches = candidates.map(item => {
      const searchable = normalize([
        item.title, item.description, item.summary, item.category, item.resourceType,
        ...(item.tags ?? []), ...(item.useCases ?? [])
      ].join(" ")).join(" ");
      let score = 0;
      for (const token of tokens) {
        if (normalize(item.title).includes(token)) score += 4;
        if ((item.tags ?? []).some(tag => normalize(tag).includes(token))) score += 3;
        if ((item.useCases ?? []).some(useCase => normalize(useCase).includes(token))) score += 2;
        if (searchable.includes(token)) score += 1;
      }
      return { item, score };
    }).filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 8);
    result.innerHTML = matches.map(({ item }) => renderRecommendation(item)).join("") ||
      `<p class="hub-empty-state">${escapeHtml(t("promptEmpty"))}</p>`;
    showStatus(container, `${matches.length} · ${t("assistantResults")}`);
  });
}

function localizedPrompt(item) {
  const translation = item.translations?.[locale];
  return {
    ...item,
    ...(translation || {}),
    displayLanguage: translation ? locale : item.language
  };
}

function renderPrompt(item) {
  const languageName = window.yatoujiI18n?.sourceLanguageName(item.displayLanguage) || item.displayLanguage;
  return `<article class="platform-card platform-prompt-card">
    <div class="platform-card-meta"><span>${escapeHtml(t(`categories.${item.category}`) || item.category)}</span><span>${escapeHtml(languageName)} · v${escapeHtml(item.version)}</span></div>
    <h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p>
    <dl class="platform-prompt-meta">
      <dt>${escapeHtml(t("promptUseCase"))}</dt><dd>${escapeHtml(item.useCase)}</dd>
      <dt>${escapeHtml(t("promptModels"))}</dt><dd>${(item.compatibleModels ?? []).map(escapeHtml).join("; ")}</dd>
      <dt>${escapeHtml(t("promptVariables"))}</dt><dd><code dir="ltr">${(item.variables ?? []).map(escapeHtml).join(" · ")}</code></dd>
      <dt>${escapeHtml(t("promptExampleInput"))}</dt><dd dir="auto">${escapeHtml(item.exampleInput)}</dd>
      <dt>${escapeHtml(t("promptExampleOutput"))}</dt><dd dir="auto">${escapeHtml(item.exampleOutput)}</dd>
    </dl>
    <details class="platform-prompt-preview"><summary>${escapeHtml(t("promptLanguage"))}: ${escapeHtml(languageName)}</summary><pre dir="auto">${escapeHtml(item.prompt)}</pre></details>
    <div class="platform-actions"><button type="button" class="hub-button hub-button-primary" data-copy-prompt="${escapeHtml(item.id)}">${escapeHtml(t("promptCopy"))}</button></div>
    <p class="hub-status" data-prompt-status="${escapeHtml(item.id)}" role="status" aria-live="polite"></p>
  </article>`;
}

function setupPrompts(prompts) {
  const list = document.getElementById("prompt-list");
  const search = document.getElementById("prompt-search");
  const category = document.getElementById("prompt-category");
  const language = document.getElementById("prompt-language");
  if (!list) return;
  const variants = prompts.map(localizedPrompt);
  const categories = [...new Set(variants.map(item => item.category))].sort();
  category.innerHTML = `<option value="">${escapeHtml(t("allCategories"))}</option>` +
    categories.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(t(`categories.${value}`) || value)}</option>`).join("");
  const update = () => {
    const terms = normalize(search.value);
    const results = variants.filter(item => {
      const text = normalize([item.title, item.description, item.useCase, item.prompt, item.category].join(" "));
      const matchesSearch = terms.every(term => text.includes(term));
      const matchesCategory = !category.value || item.category === category.value;
      const matchesLanguage = !language.value || item.displayLanguage === language.value;
      return matchesSearch && matchesCategory && matchesLanguage;
    });
    list.innerHTML = results.map(renderPrompt).join("") ||
      `<p class="hub-empty-state">${escapeHtml(t("promptEmpty"))}</p>`;
    document.getElementById("prompt-count").textContent = String(results.length);
  };
  for (const item of variants) item.copyText = item.prompt;
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-copy-prompt]");
    if (!button) return;
    const item = variants.find(prompt => prompt.id === button.dataset.copyPrompt);
    copyText(item.prompt, button, list.querySelector(`[data-prompt-status="${CSS.escape(item.id)}"]`));
  });
  search.addEventListener("input", update);
  category.addEventListener("change", update);
  language.addEventListener("change", update);
  update();
}

function renderModels(data) {
  const container = document.getElementById("model-directory");
  if (!container) return;
  const modelCards = (data.models ?? []).map(model => {
    const links = [
      ["modelDocs", model.sourceUrl],
      ["modelPricing", model.pricingUrl]
    ].filter(([, url]) => url);
    return `<article class="platform-card platform-model-card">
      <p class="platform-card-kicker">${escapeHtml(model.provider)} · ${escapeHtml(t("modelSpecs"))}</p>
      <h2>${escapeHtml(model.name)}</h2>
      <dl class="platform-prompt-meta">
        <dt>${escapeHtml(t("modelIdLabel"))}</dt><dd><code dir="ltr">${escapeHtml(model.modelId)}</code></dd>
        <dt>${escapeHtml(t("modelContextLabel"))}</dt><dd dir="auto">${escapeHtml(model.contextWindow)}</dd>
        <dt>${escapeHtml(t("modelModalitiesLabel"))}</dt><dd dir="auto">${escapeHtml(model.modalities)}</dd>
        <dt>${escapeHtml(t("modelApiAvailabilityLabel"))}</dt><dd dir="auto">${escapeHtml(model.apiAvailability)}</dd>
        <dt>${escapeHtml(t("modelPriceLabel"))}</dt><dd dir="auto">${escapeHtml(model.priceNote)}</dd>
      </dl>
      <p class="platform-model-honesty">${escapeHtml(t("modelVendorClaim"))}</p>
      <p class="hub-status">${escapeHtml(t("modelVerified"))}: ${escapeHtml(data.verifiedOn)}</p>
      <div class="platform-model-links">${links.map(([key, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(key))} ↗</a>`).join("")}</div>
    </article>`;
  });
  const providerCards = data.providers.map(provider => {
    const links = [
      ["modelDocs", provider.modelsUrl],
      ["modelApi", provider.apiUrl],
      ["modelPricing", provider.pricingUrl]
    ].filter(([, url]) => url);
    return `<article class="platform-card platform-model-card">
      <p class="platform-card-kicker">${escapeHtml(t("modelProvider"))}</p>
      <h2>${escapeHtml(provider.name)}</h2>
      <p>${escapeHtml(provider.notes)}</p>
      <p class="platform-model-honesty">${escapeHtml(t("modelNotPublished"))}</p>
      <div class="platform-model-links">${links.map(([key, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(key))} ↗</a>`).join("")}</div>
      <p class="hub-status">${escapeHtml(t("modelVerified"))}: ${escapeHtml(data.verifiedOn || "—")}</p>
    </article>`;
  });
  container.innerHTML = [...modelCards, ...providerCards].join("");
}

const toolDefinitions = [
  { id: "roas", title: "toolRoas", kind: "metric", fields: [["revenue", "labelRevenue"], ["adSpend", "labelAdSpend"]], formula: "formulaRoas", result: "resultRoas", example: "500 ÷ 100 = 5x" },
  { id: "roi", title: "toolRoi", kind: "metric", fields: [["investment", "labelInvestment"], ["returnValue", "labelReturn"]], formula: "formulaRoi", result: "resultRoi", example: "(150 − 100) ÷ 100 × 100 = 50%" },
  { id: "cpa", title: "toolCpa", kind: "metric", fields: [["adSpend", "labelAdSpend"], ["conversions", "labelConversions"]], formula: "formulaCpa", result: "resultCpa", example: "120 ÷ 6 = 20" },
  { id: "cpc", title: "toolCpc", kind: "metric", fields: [["adSpend", "labelAdSpend"], ["clicks", "labelClicks"]], formula: "formulaCpc", result: "resultCpc", example: "90 ÷ 30 = 3" },
  { id: "cpm", title: "toolCpm", kind: "metric", fields: [["adSpend", "labelAdSpend"], ["impressions", "labelImpressions"]], formula: "formulaCpm", result: "resultCpm", example: "8 ÷ 4,000 × 1,000 = 2" },
  { id: "ctr", title: "toolCtr", kind: "metric", fields: [["clicks", "labelClicks"], ["impressions", "labelImpressions"]], formula: "formulaCtr", result: "resultCtr", example: "25 ÷ 1,000 × 100 = 2.5%" },
  { id: "conversion", title: "toolConversion", kind: "metric", fields: [["conversions", "labelConversions"], ["visitors", "labelVisitors"]], formula: "formulaConversion", result: "resultConversion", example: "12 ÷ 400 × 100 = 3%" },
  { id: "budget", title: "toolBudget", kind: "metric", fields: [["targetConversions", "labelTargetConversions"], ["targetCpa", "labelTargetCpa"]], formula: "formulaBudget", result: "resultBudget", example: "20 × 15 = 300" },
  { id: "utm", title: "toolUtm", fields: [["url", "labelUrl", "url"], ["source", "labelSource"], ["medium", "labelMedium"], ["campaign", "labelCampaign"], ["content", "labelContent"], ["term", "labelTerm"]] },
  { id: "seo-title", title: "toolTitle", fields: [["title", "labelTitle"], ["brand", "labelBrand"]] },
  { id: "meta-description", title: "toolMeta", fields: [["description", "labelDescription", "textarea"]] },
  { id: "keyword-cluster", title: "toolCluster", fields: [["keywords", "labelKeywords", "textarea", "ltr"]] },
  { id: "robots", title: "toolRobots", fields: [["origin", "labelOrigin", "url"], ["disallow", "labelDisallow", "textarea", "ltr"], ["allow", "labelAllow", "textarea", "ltr"]] },
  { id: "schema", title: "toolSchema", fields: [["schemaType", "labelSchemaType", "schema"], ["name", "labelName"], ["url", "labelUrl", "url"], ["description", "labelDescription", "textarea"]] },
  { id: "json", title: "toolJson", fields: [["json", "labelJsonInput", "textarea", "ltr"]], outputLtr: true },
  { id: "regex", title: "toolRegex", fields: [["pattern", "labelPattern", "text", "ltr"], ["sample", "labelSample", "textarea", "ltr"]], outputLtr: true },
  { id: "prompt", title: "toolPrompt", fields: [["role", "labelRole"], ["task", "labelTask"], ["context", "labelContext", "textarea"], ["outputFormat", "labelOutput"]] }
];

function toolField(toolId, field) {
  const [name, labelKey, type = "text", direction = "auto"] = field;
  const id = `tool-${toolId}-${name}`;
  let input;
  if (type === "textarea") {
    input = `<textarea id="${id}" name="${name}" rows="3" ${direction === "ltr" ? 'dir="ltr"' : 'dir="auto"'}></textarea>`;
  } else if (type === "schema") {
    input = `<select id="${id}" name="${name}"><option>Organization</option><option>Person</option><option>WebSite</option><option>Article</option></select>`;
  } else if (type === "url") {
    input = `<input id="${id}" name="${name}" type="url" inputmode="url" dir="ltr">`;
  } else if (toolDefinitions.find(item => item.id === toolId)?.kind === "metric") {
    input = `<input id="${id}" name="${name}" type="number" min="0" step="any" inputmode="decimal" required>`;
  } else {
    input = `<input id="${id}" name="${name}" type="text" ${direction === "ltr" ? 'dir="ltr"' : 'dir="auto"'}>`;
  }
  return `<label class="platform-field" for="${id}"><span>${escapeHtml(t(labelKey))}</span>${input}</label>`;
}

function renderTool(tool) {
  const fields = tool.fields.map(field => toolField(tool.id, field)).join("");
  const formula = tool.formula
    ? `<p class="platform-formula"><strong>${escapeHtml(t("toolFormula"))}:</strong> <span>${escapeHtml(t(tool.formula))}</span></p>`
    : "";
  const example = tool.example
    ? `<p class="platform-example"><strong>${escapeHtml(t("toolExample"))}:</strong> <code dir="ltr">${escapeHtml(tool.example)}</code></p>`
    : "";
  return `<details class="platform-tool" data-tool-card="${tool.id}">
    <summary><span>${escapeHtml(t(tool.title))}</span><span aria-hidden="true">＋</span></summary>
    <form class="platform-tool-form" data-tool="${tool.id}">
      <div class="platform-field-grid">${fields}</div>
      ${formula}${example}
      <div class="platform-actions">
        <button class="hub-button hub-button-primary" type="submit">${escapeHtml(t(tool.kind === "metric" ? "toolRun" : tool.id === "json" ? "formatJson" : "toolGenerate"))}</button>
        <button class="hub-button hub-button-quiet" type="reset">${escapeHtml(t("toolReset"))}</button>
      </div>
      <label class="platform-output-label"><span>${escapeHtml(t("toolResult"))}</span><textarea data-tool-output readonly rows="3" ${tool.outputLtr ? 'dir="ltr"' : 'dir="auto"'}></textarea></label>
      <div class="platform-actions">
        <button class="hub-button hub-button-quiet" type="button" data-tool-copy disabled>${escapeHtml(t("toolCopy"))}</button>
        <button class="hub-button hub-button-quiet" type="button" data-tool-download disabled>${escapeHtml(t("toolDownload"))}</button>
      </div>
      <p class="hub-status platform-tool-status" data-platform-status role="status" aria-live="polite"></p>
    </form>
  </details>`;
}

function runRegexInWorker(pattern, sample) {
  if (pattern.length > 256 || sample.length > 10000) {
    return Promise.reject(new RangeError("Keep the expression under 257 characters and the sample under 10,001 characters."));
  }
  const source = `self.onmessage = ({data}) => {
    try {
      const expression = new RegExp(data.pattern, "g");
      const matches = [];
      let match;
      while ((match = expression.exec(data.sample)) && matches.length < 100) {
        matches.push({text: match[0], index: match.index});
        if (match[0].length === 0) expression.lastIndex += 1;
      }
      self.postMessage({matches});
    } catch (error) { self.postMessage({error: error.message}); }
  };`;
  const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl);
    const timeout = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error("Pattern evaluation exceeded the 200 ms safety limit."));
    }, 200);
    worker.onmessage = event => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      if (event.data.error) reject(new SyntaxError(event.data.error));
      else resolve(event.data.matches);
    };
    worker.onerror = event => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(event.message || "The expression could not be tested."));
    };
    worker.postMessage({ pattern, sample });
  });
}

function toolOutput(toolId, data) {
  if (["roas", "roi", "cpa", "cpc", "cpm", "ctr", "conversion", "budget"].includes(toolId)) {
    const result = calculateMetric(toolId, data);
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(result.value);
    return `${t(toolDefinitions.find(tool => tool.id === toolId).result)}: ${value}${result.unit === "currency" ? "" : result.unit === "x" ? "×" : "%"}`;
  }
  if (toolId === "utm") return buildUtmUrl(data);
  if (toolId === "seo-title") return makeSeoTitle(data.title, data.brand);
  if (toolId === "meta-description") return makeMetaDescription(data.description);
  if (toolId === "keyword-cluster") {
    const clusters = clusterKeywords(data.keywords);
    if (!clusters.length) throw new TypeError(t("toolEmpty"));
    return clusters.map((cluster, index) => `Cluster ${index + 1}\n${cluster.phrases.map(phrase => `- ${phrase}`).join("\n")}`).join("\n\n");
  }
  if (toolId === "robots") return buildRobotsTxt(data);
  if (toolId === "schema") return buildSchemaMarkup(data.schemaType, data);
  if (toolId === "json") return formatJson(data.json);
  if (toolId === "prompt") {
    const role = data.role.trim();
    const task = data.task.trim();
    if (!role || !task) throw new TypeError(t("toolInvalid"));
    return `Role: ${role}\nTask: ${task}\nContext: ${data.context.trim() || "Not provided"}\nExpected output: ${data.outputFormat.trim() || "Not specified"}\n\nState assumptions, identify missing information, and do not invent facts.`;
  }
  throw new RangeError(`Unknown tool: ${toolId}`);
}

function setupToolbox() {
  const list = document.getElementById("tool-list");
  const search = document.getElementById("tool-search");
  if (!list) return;
  list.innerHTML = toolDefinitions.map(renderTool).join("");
  list.addEventListener("input", event => {
    if (event.target.matches("[data-tool=\"meta-description\"] textarea")) {
      const count = event.target.value.length;
      const counter = event.target.closest("form").querySelector("[data-character-count]");
      if (counter) counter.textContent = String(count);
    }
  });
  list.addEventListener("submit", async event => {
    const form = event.target.closest("[data-tool]");
    if (!form) return;
    event.preventDefault();
    const id = form.dataset.tool;
    const output = form.querySelector("[data-tool-output]");
    const status = form.querySelector("[data-platform-status]");
    const copyButton = form.querySelector("[data-tool-copy]");
    const downloadButton = form.querySelector("[data-tool-download]");
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      let result;
      if (id === "regex") {
        const matches = await runRegexInWorker(data.pattern, data.sample);
        result = matches.length
          ? matches.map(match => `[${match.index}] ${match.text}`).join("\n")
          : "No matches.";
      } else {
        result = toolOutput(id, data);
      }
      output.value = result;
      output.dataset.filename = `${id}-result.${id === "json" || id === "schema" ? "json" : id === "robots" ? "txt" : "txt"}`;
      output.dir = ["utm", "robots", "schema", "json", "regex"].includes(id) ? "ltr" : "auto";
      copyButton.disabled = false;
      downloadButton.disabled = false;
      showStatus(form, "");
    } catch (error) {
      output.value = "";
      copyButton.disabled = true;
      downloadButton.disabled = true;
      showStatus(form, error.message || t("toolInvalid"), true);
    }
  });
  list.addEventListener("reset", event => {
    const form = event.target.closest("[data-tool]");
    if (!form) return;
    window.setTimeout(() => {
      form.querySelector("[data-tool-output]").value = "";
      form.querySelector("[data-tool-copy]").disabled = true;
      form.querySelector("[data-tool-download]").disabled = true;
      showStatus(form, "");
    }, 0);
  });
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-tool-copy], [data-tool-download]");
    if (!button) return;
    const form = button.closest("[data-tool]");
    const output = form.querySelector("[data-tool-output]");
    if (!output.value) return;
    if (button.matches("[data-tool-copy]")) {
      copyText(output.value, button, form.querySelector("[data-platform-status]"));
    } else {
      downloadText(output.value, output.dataset.filename || "tool-result.txt");
    }
  });
  search?.addEventListener("input", () => {
    const terms = normalize(search.value);
    for (const card of list.querySelectorAll("[data-tool-card]")) {
      card.hidden = !terms.every(term => normalize(card.textContent).includes(term));
    }
  });
}

function setupLearning(data, resources) {
  const container = document.getElementById("learning-path-list");
  if (!container) return;
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const levelLabels = new Set(["learningBeginner", "learningIntermediate", "learningAdvanced"]);
  const renderPath = learningPath => {
    const title = learningPath.title[locale] || learningPath.title.en;
    const topics = learningPath.topics[locale] || learningPath.topics.en;
    const modules = topics.map((topic, index) => `<details class="platform-module">
      <summary><span>${index + 1}. ${escapeHtml(topic)}</span><span aria-hidden="true">＋</span></summary>
      <div class="platform-module-content">
        <h3>${escapeHtml(t("learningLessons"))}</h3>
        <ol><li>${escapeHtml(t("learningStudy"))}</li><li>${escapeHtml(t("learningPractice"))}</li><li>${escapeHtml(t("learningCheck"))}</li></ol>
        <h3>${escapeHtml(t("learningExercise"))}</h3>
        <p>${escapeHtml(topic)} — ${escapeHtml(t("learningPractice"))}</p>
      </div>
    </details>`).join("");
    const resource = byId.get(learningPath.resourceId);
    const level = levelLabels.has(learningPath.level) ? t(learningPath.level) : learningPath.level;
    return `<article class="platform-learning-card">
      <div class="platform-card-meta"><span>${escapeHtml(level)}</span><span>${topics.length} ${escapeHtml(t("learningModules"))}</span></div>
      <h2>${escapeHtml(title)}</h2>
      <div class="platform-modules">${modules}</div>
      ${resource ? `<p><strong>${escapeHtml(t("learningResource"))}:</strong> <a href="resources/${escapeHtml(resource.slug)}.html">${escapeHtml(resource.title)}</a></p>` : ""}
    </article>`;
  };
  container.innerHTML = data.paths.map(renderPath).join("");
}

function renderMarkdown(text, container) {
  container.replaceChildren();
  let list = null;
  for (const line of String(text).split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (!line.trim()) {
      list = null;
      continue;
    }
    if (heading) {
      list = null;
      const element = document.createElement(`h${heading[1].length}`);
      element.textContent = heading[2];
      container.append(element);
    } else if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      if (!list || list.tagName.toLowerCase() !== (isOrdered ? "ol" : "ul")) {
        list = document.createElement(isOrdered ? "ol" : "ul");
        container.append(list);
      }
      const item = document.createElement("li");
      item.textContent = (bullet || ordered)[1];
      list.append(item);
    } else {
      list = null;
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      container.append(paragraph);
    }
  }
}

function highlightSource(source, language) {
  const patterns = language === "json"
    ? /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b|[{}[\]:,])/gy
    : /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\b(?:const|let|var|function|return|if|else|new|throw|class|async|await|true|false|null)\b|\b\d+(?:\.\d+)?\b)/gy;
  const code = String(source);
  const fragment = document.createDocumentFragment();
  let position = 0;
  while (position < code.length) {
    patterns.lastIndex = position;
    const match = patterns.exec(code);
    if (match) {
      if (match.index > position) fragment.append(document.createTextNode(code.slice(position, match.index)));
      const span = document.createElement("span");
      span.className = language === "json" && /^(?:true|false|null|-?\d)/.test(match[0]) ? "syntax-literal" : "syntax-token";
      span.textContent = match[0];
      fragment.append(span);
      position = patterns.lastIndex;
    } else {
      fragment.append(document.createTextNode(code[position]));
      position += 1;
    }
  }
  return fragment;
}

function setupPlayground() {
  const source = document.getElementById("playground-markdown");
  const markdownPreview = document.getElementById("playground-markdown-preview");
  const codeInput = document.getElementById("playground-code");
  const codePreview = document.getElementById("playground-code-preview");
  const jsonInput = document.getElementById("playground-json");
  const jsonPreview = document.getElementById("playground-json-preview");
  const status = document.getElementById("playground-status");
  if (!source || !markdownPreview) return;
  const refreshMarkdown = () => renderMarkdown(source.value, markdownPreview);
  source.addEventListener("input", refreshMarkdown);
  document.getElementById("playground-json-format").addEventListener("click", () => {
    try {
      const formatted = formatJson(jsonInput.value);
      jsonInput.value = formatted.trimEnd();
      jsonPreview.replaceChildren(highlightSource(formatted, "json"));
      status.textContent = t("jsonValid");
      status.classList.remove("is-error");
    } catch (error) {
      jsonPreview.textContent = "";
      status.textContent = `${t("jsonInvalid")}: ${error.message}`;
      status.classList.add("is-error");
    }
  });
  jsonInput.addEventListener("input", () => {
    jsonPreview.textContent = jsonInput.value;
    jsonPreview.dir = "ltr";
  });
  codeInput.addEventListener("input", () => {
    codePreview.replaceChildren(highlightSource(codeInput.value, "javascript"));
  });
  document.getElementById("playground-copy-markdown").addEventListener("click", event =>
    copyText(source.value, event.currentTarget, status));
  document.getElementById("playground-copy-code").addEventListener("click", event =>
    copyText(codeInput.value, event.currentTarget, status));
  document.getElementById("playground-copy-json").addEventListener("click", event =>
    copyText(jsonInput.value, event.currentTarget, status));
  document.getElementById("playground-reset").addEventListener("click", () => {
    source.value = "";
    codeInput.value = "";
    jsonInput.value = "";
    refreshMarkdown();
    codePreview.replaceChildren();
    jsonPreview.replaceChildren();
    status.textContent = "";
    status.classList.remove("is-error");
  });
  refreshMarkdown();
  codePreview.replaceChildren(highlightSource(codeInput.value, "javascript"));
}

function renderContribute() {
  if (!app) return;
  const container = app;
  container.innerHTML = `<div class="platform-card">
    <h2>${escapeHtml(t("contributeRequirements"))}</h2>
    <p>${escapeHtml(t("contributeFields"))}</p>
    <h2>${escapeHtml(t("contributeLicense"))}</h2>
    <p>${escapeHtml(t("contributeLicenseText"))}</p>
    <h2>${escapeHtml(t("contributeSecurity"))}</h2>
    <p>${escapeHtml(t("contributeSafetyText"))}</p>
    <ul><li>${escapeHtml(t("contributeSafetySecret"))}</li><li>${escapeHtml(t("contributeSafetyWorkflow"))}</li><li>${escapeHtml(t("contributeSafetyDisclosure"))}</li><li>${escapeHtml(t("contributeSafetyClaims"))}</li></ul>
    <p>${escapeHtml(t("contributeNoCommunity"))}</p>
    <div class="platform-actions">
      <a class="hub-button hub-button-primary" href="content/contribution-template.md" download>${escapeHtml(t("contributeTemplate"))}</a>
      <a class="hub-button hub-button-quiet" href="https://github.com/ayoubyatouji/ayoubyatouji.github.io" target="_blank" rel="noopener noreferrer">${escapeHtml(t("contributeGithub"))} ↗</a>
    </div>
  </div>`;
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

async function init() {
  await window.yatoujiI18nReady;
  setupNavigation();
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const value = t(element.dataset.i18n);
    if (value !== element.dataset.i18n) setTranslatedText(element, value);
  });
  if (!app) return;
  if (page === "account") {
    const { initializeAccount } = await import("./account.js?v=3");
    await initializeAccount(app, t, window.yatoujiSupabaseConfig);
  } else if (page === "assistant") {
    const [resourceData, articleData] = await Promise.all([
      loadJson("resources.json"),
      loadJson("articles.json")
    ]);
    app.innerHTML = `<div class="platform-assistant">
      <form class="platform-form" id="assistant-form">
        <label for="assistant-query">${escapeHtml(t("assistantIntro"))}</label>
        <textarea id="assistant-query" name="query" rows="5" maxlength="1600" dir="auto" placeholder="${escapeHtml(t("assistantPlaceholder"))}" required></textarea>
        <button class="hub-button hub-button-primary" type="submit">${escapeHtml(t("assistantSubmit"))}</button>
      </form>
      <p class="hub-notice">${escapeHtml(t("assistantDisclaimer"))}</p>
      <p class="hub-status" data-platform-status role="status" aria-live="polite"></p>
      <h2>${escapeHtml(t("assistantResults"))}</h2><div class="platform-card-grid" id="assistant-results"></div>
    </div>`;
    const resources = resourceData.resources.map(item => ({ ...resourceData.defaults, ...item }));
    setupAssistant(resources, articleData.articles);
  } else if (page === "prompts") {
    const data = await loadJson("prompts.json");
    app.innerHTML = `<div class="platform-filter-panel">
      <label><span>${escapeHtml(t("promptSearch"))}</span><input id="prompt-search" type="search" autocomplete="off"></label>
      <label><span>${escapeHtml(t("filterCategory"))}</span><select id="prompt-category"><option value="">${escapeHtml(t("allCategories"))}</option></select></label>
      <label><span>${escapeHtml(t("filterLanguage"))}</span><select id="prompt-language"><option value="">${escapeHtml(t("allLanguages"))}</option><option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option></select></label>
    </div><p class="hub-status" id="prompt-count" role="status" aria-live="polite"></p><div class="platform-card-grid" id="prompt-list"></div>`;
    setupPrompts(data.prompts);
  } else if (page === "models") {
    const data = await loadJson("ai-model-sources.json");
    app.innerHTML = `<p class="hub-notice">${escapeHtml(t("modelsDisclaimer"))}</p><p class="hub-status">${escapeHtml(t("modelVerified"))}: ${data.verifiedOn ? escapeHtml(data.verifiedOn) : "—"}</p><div class="platform-card-grid" id="model-directory"></div>`;
    renderModels(data);
  } else if (page === "toolbox") {
    app.innerHTML = `<label class="platform-search"><span>${escapeHtml(t("toolSearch"))}</span><input id="tool-search" type="search" autocomplete="off"></label><p class="hub-notice">${escapeHtml(t("toolSafety"))}</p><div id="tool-list" class="platform-tool-list"></div>`;
    setupToolbox();
  } else if (page === "learning") {
    const [data, resourceData] = await Promise.all([
      loadJson("learning-paths.json"),
      loadJson("resources.json")
    ]);
    app.innerHTML = `<p class="hub-notice">${escapeHtml(t("learningIntro"))}</p><div class="platform-learning-list" id="learning-path-list"></div>`;
    setupLearning(data, resourceData.resources);
  } else if (page === "playground") {
    app.innerHTML = `<p class="hub-notice">${escapeHtml(t("playgroundIntro"))}</p>
      <div class="platform-playground-grid">
        <section class="platform-card"><h2>${escapeHtml(t("labelMarkdown"))}</h2><textarea id="playground-markdown" rows="9" dir="auto"># Example\\n\\n- Markdown is displayed as text content\\n- Raw HTML is not executed</textarea><div class="platform-actions"><button class="hub-button hub-button-quiet" id="playground-copy-markdown" type="button">${escapeHtml(t("toolCopy"))}</button></div><div class="platform-markdown-preview" id="playground-markdown-preview"></div></section>
        <section class="platform-card"><h2>JavaScript</h2><p>${escapeHtml(t("labelPreview"))}</p><textarea id="playground-code" rows="9" dir="ltr">const greeting = "Hello";\\nconsole.log(greeting);</textarea><div class="platform-actions"><button class="hub-button hub-button-quiet" id="playground-copy-code" type="button">${escapeHtml(t("toolCopy"))}</button></div><pre class="platform-code-preview" dir="ltr"><code id="playground-code-preview"></code></pre></section>
        <section class="platform-card"><h2>JSON</h2><label for="playground-json">${escapeHtml(t("labelJsonInput"))}</label><textarea id="playground-json" rows="8" dir="ltr">{"name":"example","enabled":true}</textarea><div class="platform-actions"><button class="hub-button hub-button-primary" id="playground-json-format" type="button">${escapeHtml(t("formatJson"))}</button><button class="hub-button hub-button-quiet" id="playground-copy-json" type="button">${escapeHtml(t("toolCopy"))}</button></div><pre class="platform-code-preview" dir="ltr"><code id="playground-json-preview"></code></pre></section>
      </div><div class="platform-actions"><button class="hub-button hub-button-quiet" id="playground-reset" type="button">${escapeHtml(t("toolReset"))}</button></div><p class="hub-status" id="playground-status" role="status" aria-live="polite"></p>`;
    setupPlayground();
  } else if (page === "contribute") {
    renderContribute();
  }
}

init().catch(error => {
  console.error("The platform feature could not be initialized.", error);
  if (app) {
    app.innerHTML = `<p class="hub-empty-state" role="alert">${escapeHtml(error.message)}. ${escapeHtml(t("promptEmpty"))}</p>`;
  }
});
