export async function fetchJsonFromPublicEndpoint(endpoint, { signal } = {}) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Only HTTP and HTTPS endpoints are supported.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }

  return response.json();
}
