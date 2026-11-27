(function () {
  const article = document.querySelector(".article");
  if (!article) return;

  const language = document.documentElement.lang === "en" ? "en" : "fr";
  const content = article.querySelector(".article-body") || article;
  const headings = [...content.querySelectorAll("h2")];
  const utility = document.createElement("div");
  utility.className = "article-utility hub-article-utility";
  utility.innerHTML = language === "en"
    ? '<span class="read-time"></span><nav class="article-share" aria-label="Share this article"><a data-share="linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a><a data-share="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a></nav>'
    : '<span class="read-time"></span><nav class="article-share" aria-label="Partager cet article"><a data-share="linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a><a data-share="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a></nav>';

  const title = article.querySelector("h1");
  if (title) title.insertAdjacentElement("afterend", utility);

  const words = content.textContent.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  utility.querySelector(".read-time").textContent = language === "en"
    ? `${minutes} min read`
    : `${minutes} min de lecture`;

  const pageUrl = encodeURIComponent(location.href);
  const pageTitle = encodeURIComponent(document.title);
  utility.querySelector('[data-share="linkedin"]').href = `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`;
  utility.querySelector('[data-share="whatsapp"]').href = `https://wa.me/?text=${pageTitle}%20${pageUrl}`;

  if (headings.length) {
    const toc = document.createElement("nav");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", language === "en" ? "On this page" : "Sommaire");
    const label = document.createElement("strong");
    label.textContent = language === "en" ? "On this page" : "Dans cet article";
    const list = document.createElement("ol");
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `article-section-${index + 1}`;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent.trim();
      item.append(link);
      list.append(item);
    });
    toc.append(label, list);
    utility.insertAdjacentElement("afterend", toc);
  }

  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", language === "en" ? "Reading progress" : "Progression de lecture");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  document.body.append(progress);
  const updateProgress = () => {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const value = available > 0 ? Math.min(100, Math.max(0, window.scrollY / available * 100)) : 100;
    progress.style.setProperty("--reading-progress", `${value}%`);
    progress.setAttribute("aria-valuenow", String(Math.round(value)));
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();
})();
