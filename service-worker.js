const CACHE_NAME = "ayoub-portfolio-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/en.html",
  "/article-audit-seo.html",
  "/article-pages-piliers.html",
  "/article-seo-geo.html",
  "/outils.html",
  "/tools.html",
  "/ressources.html",
  "/resources.html",
  "/links.html",
  "/carte.html",
  "/confidentialite.html",
  "/CV_Ayoub_Yatouji_FR.pdf",
  "/CV_Ayoub_Yatouji_EN.pdf",
  "/Checklist_SEO_Ads_Automatisation.pdf",
  "/Checklist_SEO_Ads_Automation_EN.pdf",
  "/modele-plan-contenu.csv",
  "/modele-calendrier-editorial.csv",
  "/modele-rapport-mensuel.csv",
  "/content-plan-template.csv",
  "/editorial-calendar-template.csv",
  "/monthly-report-template.csv",
  "/exemple-workflow-n8n.json",
  "/ayoub-yatouji.vcf",
  "/style.css?v=10",
  "/script.js?v=6",
  "/site.js?v=1",
  "/tools.js?v=1",
  "/article.js?v=1",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/photo-ayoub.jpg",
  "/photo-ayoub.webp",
  "/social-card.png",
  "/logo-e2b.png",
  "/logo-kartago.png",
  "/logo-stihl.png",
  "/logo-uas.png",
  "/stand-e2b-1.jpg",
  "/stand-e2b-1.webp",
  "/stand-e2b-2.jpg",
  "/stand-e2b-2.webp",
  "/stand-medrh-i2business.jpg",
  "/stand-medrh-i2business.webp",
  "/assets/contact-qr.svg"
];

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
      keys.filter(key => key.startsWith("ayoub-portfolio-") && key !== CACHE_NAME)
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
