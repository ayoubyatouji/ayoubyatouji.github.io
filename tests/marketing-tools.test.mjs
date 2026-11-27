import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRobotsTxt,
  buildSchemaMarkup,
  buildUtmUrl,
  calculateMetric,
  clusterKeywords,
  formatJson,
  makeMetaDescription,
  makeSeoTitle
} from "../marketing-tools.js";

test("calculators return correct ratios, percentages, and budget", () => {
  assert.deepEqual(calculateMetric("roas", { revenue: 500, adSpend: 100 }), { value: 5, unit: "x" });
  assert.deepEqual(calculateMetric("roi", { investment: 100, returnValue: 150 }), { value: 50, unit: "%" });
  assert.deepEqual(calculateMetric("cpa", { adSpend: 120, conversions: 6 }), { value: 20, unit: "currency" });
  assert.deepEqual(calculateMetric("cpc", { adSpend: 90, clicks: 30 }), { value: 3, unit: "currency" });
  assert.deepEqual(calculateMetric("cpm", { adSpend: 8, impressions: 4000 }), { value: 2, unit: "currency" });
  assert.deepEqual(calculateMetric("ctr", { clicks: 25, impressions: 1000 }), { value: 2.5, unit: "%" });
  assert.deepEqual(calculateMetric("conversion", { conversions: 12, visitors: 400 }), { value: 3, unit: "%" });
  assert.deepEqual(calculateMetric("budget", { targetConversions: 20, targetCpa: 15 }), { value: 300, unit: "currency" });
});

test("calculators reject zero denominators and invalid values", () => {
  assert.throws(() => calculateMetric("roas", { revenue: 2, adSpend: 0 }), /greater than zero/);
  assert.throws(() => calculateMetric("roi", { investment: 0, returnValue: 20 }), /greater than zero/);
  assert.throws(() => calculateMetric("ctr", { clicks: 2, impressions: -1 }), /non-negative/);
});

test("UTM generation preserves existing query values and rejects unsafe URLs", () => {
  const url = new URL(buildUtmUrl({
    url: "https://example.com/page?ref=mail",
    source: "newsletter",
    medium: "email",
    campaign: "spring launch"
  }));
  assert.equal(url.searchParams.get("ref"), "mail");
  assert.equal(url.searchParams.get("utm_campaign"), "spring launch");
  assert.throws(() => buildUtmUrl({ url: "javascript:alert(1)" }), /HTTP or HTTPS/);
});

test("content utilities validate and produce deterministic output", () => {
  assert.equal(makeSeoTitle("SEO audit", "Yatouji"), "SEO audit | Yatouji");
  assert.equal(makeMetaDescription("  Clear   description. "), "Clear description.");
  assert.equal(formatJson('{"ok":true}'), '{\n  "ok": true\n}\n');
  assert.throws(() => formatJson("{"), SyntaxError);
  assert.deepEqual(clusterKeywords("seo audit\ntechnical seo audit\nemail campaign"), [
    { phrases: ["seo audit", "technical seo audit"] },
    { phrases: ["email campaign"] }
  ]);
});

test("robots and schema generators validate inputs", () => {
  assert.match(buildRobotsTxt({ origin: "https://example.com", disallow: "/private\n/admin" }), /Disallow: \/private[\s\S]*Sitemap: https:\/\/example.com\/sitemap.xml/);
  assert.throws(() => buildRobotsTxt({ origin: "https://example.com", disallow: "//other.test" }), /site-relative/);
  const schema = JSON.parse(buildSchemaMarkup("WebSite", { name: "Example", url: "https://example.com" }));
  assert.equal(schema["@type"], "WebSite");
  assert.throws(() => buildSchemaMarkup("Rating", { name: "Example" }), /Unsupported/);
});
