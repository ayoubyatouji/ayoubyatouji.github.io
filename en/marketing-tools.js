const numericInputs = {
  roas: ["revenue", "adSpend"],
  roi: ["investment", "returnValue"],
  cpa: ["adSpend", "conversions"],
  cpc: ["adSpend", "clicks"],
  cpm: ["adSpend", "impressions"],
  ctr: ["clicks", "impressions"],
  conversion: ["conversions", "visitors"],
  budget: ["targetConversions", "targetCpa"]
};

function readNonNegative(values, keys) {
  const numbers = {};
  for (const key of keys) {
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`${key} must be a finite, non-negative number.`);
    }
    numbers[key] = value;
  }
  return numbers;
}

export function calculateMetric(id, values) {
  const keys = numericInputs[id];
  if (!keys) throw new RangeError(`Unknown calculator: ${id}`);
  const input = readNonNegative(values, keys);
  const divide = (numerator, denominator, key) => {
    if (denominator === 0) throw new RangeError(`${key} must be greater than zero.`);
    return numerator / denominator;
  };

  switch (id) {
    case "roas":
      return { value: divide(input.revenue, input.adSpend, "adSpend"), unit: "x" };
    case "roi":
      if (input.investment === 0) throw new RangeError("investment must be greater than zero.");
      return { value: ((input.returnValue - input.investment) / input.investment) * 100, unit: "%" };
    case "cpa":
      return { value: divide(input.adSpend, input.conversions, "conversions"), unit: "currency" };
    case "cpc":
      return { value: divide(input.adSpend, input.clicks, "clicks"), unit: "currency" };
    case "cpm":
      return { value: divide(input.adSpend, input.impressions, "impressions") * 1000, unit: "currency" };
    case "ctr":
      return { value: divide(input.clicks, input.impressions, "impressions") * 100, unit: "%" };
    case "conversion":
      return { value: divide(input.conversions, input.visitors, "visitors") * 100, unit: "%" };
    case "budget":
      return { value: input.targetConversions * input.targetCpa, unit: "currency" };
    default:
      throw new RangeError(`Unknown calculator: ${id}`);
  }
}

export function buildUtmUrl(values) {
  let url;
  try {
    url = new URL(String(values.url || "").trim());
  } catch {
    throw new TypeError("Enter a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError("Use a public HTTP or HTTPS URL without embedded credentials.");
  }
  const params = {
    utm_source: values.source,
    utm_medium: values.medium,
    utm_campaign: values.campaign,
    utm_content: values.content,
    utm_term: values.term
  };
  for (const [key, value] of Object.entries(params)) {
    const cleaned = String(value || "").trim();
    if (cleaned) url.searchParams.set(key, cleaned);
  }
  return url.toString();
}

export function makeSeoTitle(title, brand = "") {
  const cleanTitle = String(title || "").trim();
  const cleanBrand = String(brand || "").trim();
  if (!cleanTitle) throw new TypeError("Enter a title.");
  return cleanBrand ? `${cleanTitle} | ${cleanBrand}` : cleanTitle;
}

export function makeMetaDescription(description) {
  const clean = String(description || "").replace(/\s+/g, " ").trim();
  if (!clean) throw new TypeError("Enter a description.");
  return clean;
}

const stopWords = new Set([
  "and", "the", "for", "with", "from", "how", "what", "les", "des", "pour",
  "avec", "dans", "une", "est", "sur", "aux", "من", "في", "على", "إلى"
]);

function keywordTokens(value) {
  return [...new Set(String(value).toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length > 2 && !stopWords.has(token)))];
}

export function clusterKeywords(text) {
  const phrases = [...new Set(String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  const clusters = [];
  for (const phrase of phrases) {
    const tokens = keywordTokens(phrase);
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < clusters.length; index += 1) {
      const clusterTokens = new Set(clusters[index].phrases.flatMap(keywordTokens));
      const shared = tokens.filter(token => clusterTokens.has(token)).length;
      const score = shared / Math.max(1, Math.min(tokens.length, clusterTokens.size));
      if (score >= 0.5 && score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex === -1) clusters.push({ phrases: [phrase] });
    else clusters[bestIndex].phrases.push(phrase);
  }
  return clusters;
}

function safeRobotsPath(value) {
  const path = String(value || "").trim();
  if (!path) return "";
  if (!path.startsWith("/") || /[\r\n#]/.test(path) || path.startsWith("//")) {
    throw new TypeError(`Robots paths must be site-relative paths starting with one slash: ${path}`);
  }
  return path;
}

export function buildRobotsTxt(values) {
  const origin = new URL(String(values.origin || "").trim());
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) {
    throw new TypeError("Enter a valid HTTP or HTTPS site origin.");
  }
  const lines = ["User-agent: *"];
  for (const item of String(values.disallow || "").split(/\r?\n/).map(safeRobotsPath).filter(Boolean)) {
    lines.push(`Disallow: ${item}`);
  }
  for (const item of String(values.allow || "").split(/\r?\n/).map(safeRobotsPath).filter(Boolean)) {
    lines.push(`Allow: ${item}`);
  }
  lines.push("", `Sitemap: ${origin.origin}/sitemap.xml`, "");
  return lines.join("\n");
}

export function buildSchemaMarkup(type, values) {
  const allowedTypes = new Set(["Organization", "Person", "WebSite", "Article"]);
  if (!allowedTypes.has(type)) throw new RangeError(`Unsupported schema type: ${type}`);
  const name = String(values.name || "").trim();
  if (!name) throw new TypeError("Enter a name or title.");
  const schema = { "@context": "https://schema.org", "@type": type, name };
  const description = String(values.description || "").trim();
  if (description) schema.description = description;
  const rawUrl = String(values.url || "").trim();
  if (rawUrl) {
    let url;
    try { url = new URL(rawUrl); } catch { throw new TypeError("Enter a valid absolute URL."); }
    if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Schema URLs must use HTTP or HTTPS.");
    schema.url = url.toString();
  }
  return `${JSON.stringify(schema, null, 2)}\n`;
}

export function formatJson(text) {
  return `${JSON.stringify(JSON.parse(String(text)), null, 2)}\n`;
}
