export function buildUtmUrl(inputUrl, campaign) {
  const url = new URL(inputUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Only HTTP and HTTPS URLs are supported.");
  }

  const fields = ["source", "medium", "campaign", "term", "content"];
  for (const field of fields) {
    const value = campaign[field];
    if (value !== undefined && String(value).trim()) {
      url.searchParams.set(`utm_${field}`, String(value).trim());
    }
  }

  return url.toString();
}
