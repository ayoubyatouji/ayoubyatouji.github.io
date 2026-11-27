(function () {
  const supportedLocales = ["fr", "en", "ar"];
  const pathParts = location.pathname.split("/").filter(Boolean);
  const routeLocale = supportedLocales.includes(pathParts[0]) ? pathParts.shift() : "";
  const locale = routeLocale || document.documentElement.lang || "fr";
  const relativeRoot = "../".repeat(Math.max(0, pathParts.length - 1));
  const pageHref = path => `${relativeRoot}${path}`;
  const routeFile = pathParts.join("/") || "index.html";

  function translateAddedContent(container) {
    const translate = window.yatoujiI18n?.t;
    if (!translate) return;
    container.querySelectorAll("[data-i18n]").forEach(element => {
      const value = translate(element.dataset.i18n);
      if (value === element.dataset.i18n) return;
      const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = value;
      else element.textContent = value;
    });
  }

  function navigationLinks(header) {
    let nav = header.querySelector("#hub-nav, nav.main-nav");
    if (!nav) {
      const wrapper = header.querySelector(".hub-nav-wrap, .nav-wrap");
      if (!wrapper) return;
      nav = document.createElement("nav");
      wrapper.append(nav);
    }

    nav.id = "hub-nav";
    nav.classList.add("hub-nav", "site-nav");
    nav.setAttribute("aria-label", "Main navigation");
    nav.setAttribute("data-i18n-aria", "navLabel");
    nav.dataset.navigationInitialized = "true";

    const menuButton = header.querySelector(".menu-toggle") || document.createElement("button");
    if (!menuButton.isConnected) {
      menuButton.className = "menu-toggle";
      menuButton.type = "button";
      menuButton.textContent = "☰";
      header.querySelector(".hub-nav-wrap, .nav-wrap")?.insertBefore(menuButton, nav);
    }
    menuButton.classList.add("hub-menu-toggle");
    menuButton.setAttribute("aria-label", "Open menu");
    menuButton.setAttribute("data-i18n-aria", "navMenuToggle");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-controls", "hub-nav");

    const brand = header.querySelector(".hub-brand, .brand");
    if (brand) {
      const markClass = brand.querySelector(".hub-brand-mark") ? "hub-brand-mark" : "brand-mark";
      brand.href = pageHref("index.html");
      brand.setAttribute("aria-label", "AYOUB YATOUJI — AI & DIGITAL HUB");
      brand.innerHTML = `<span class="${markClass}">AY</span><span class="nav-brand-full">AYOUB YATOUJI <b>AI &amp; DIGITAL HUB</b></span>`;
    }

    const link = (path, key, extraClass = "") =>
      `<a href="${pageHref(path)}" data-i18n="${key}"${extraClass ? ` class="${extraClass}"` : ""}>${key}</a>`;
    const downloadableResourcesPage = locale === "fr" ? "ressources.html" : "resources.html";
    const marketingToolsPage = locale === "fr" ? "outils.html" : "tools.html";
    nav.innerHTML = `
      <button class="nav-close" type="button" data-i18n="navMenuClose">Close menu</button>
      ${link("index.html", "navHome", "nav-home")}
      <details class="nav-group">
        <summary data-i18n="navExplore">Explore</summary>
        <div class="nav-group-menu">
          ${link("agents.html", "navAgents")}
          ${link("skills.html", "navSkills")}
          ${link("workflows.html", "navWorkflows")}
          ${link("code-library.html", "navCode")}
          ${link("prompts.html", "navPrompts")}
          ${link("models-arena.html", "navModels")}
          ${link(`${locale === "fr" ? "ressources.html" : "resources.html"}?q=template`, "navTemplates")}
          ${link(downloadableResourcesPage, "navDownloads")}
          ${link("contribute.html", "navContribute")}
          ${link("open-source-ai.html", "navOpenSourceAi")}
        </div>
      </details>
      <details class="nav-group">
        <summary data-i18n="navKnowledge">Knowledge Hub</summary>
        <div class="nav-group-menu">
          ${link("knowledge.html", "navAllKnowledge")}
          ${link("knowledge/seo-geo.html", "navSeoGeo")}
          ${link("knowledge/meta-ads.html", "navMetaAds")}
          ${link("knowledge/google-ads.html", "navGoogleAds")}
          ${link("knowledge/linkedin-ads.html", "navLinkedinAds")}
          ${link("knowledge/artificial-intelligence.html", "navAiAutomation")}
          ${link("knowledge/automation-productivity.html", "navAutomation")}
          ${link("learning.html", "navWrittenPaths")}
          ${link("ai-comparisons.html", "navModelComparisons")}
          ${link("ai-reviews.html", "navAiReviews")}
          ${link("ai-use-cases.html", "navAiUseCases")}
        </div>
      </details>
      <details class="nav-group">
        <summary data-i18n="navTools">Tools</summary>
        <div class="nav-group-menu">
          ${link("ai-tools.html", "navAiDirectory")}
          ${link(marketingToolsPage, "navFreeMarketingTools")}
          ${link("marketing-toolbox.html", "navMarketingGenerators")}
          ${link("playground.html", "navDeveloperUtilities")}
        </div>
      </details>
      ${link("portfolio.html", "navPortfolio")}
      ${link("project-builder.html", "navBuilder")}
      <details class="nav-group nav-secondary">
        <summary data-i18n="navMore">More</summary>
        <div class="nav-group-menu">
          ${link("portfolio.html#apropos", "navAbout")}
          ${link("ai-news.html", "navNews")}
          ${link("portfolio.html#contact", "navContact")}
          ${link("ai-new-releases.html", "navAiReleases")}
        </div>
      </details>
      <form class="nav-search" action="${pageHref("search.html")}" role="search">
        <label class="sr-only" for="global-site-search" data-i18n="navSearch">Search the website</label>
        <input id="global-site-search" name="q" type="search" placeholder="Search..." data-i18n-placeholder="navSearchPlaceholder">
        <button type="submit" data-i18n="navSearchButton">Search</button>
      </form>
      <details class="nav-account">
        <summary aria-label="User account" data-i18n-aria="navAccount"><svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path></svg><span class="sr-only" data-i18n="navAccount">Account</span></summary>
        <div class="nav-account-menu"></div>
      </details>
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Enable light theme" aria-pressed="true">☀</button>`;

    const renderAccountMenu = event => {
      let authenticated = event?.detail?.authenticated;
      if (typeof authenticated !== "boolean") {
        authenticated = false;
        try {
          authenticated = localStorage.getItem("yatouji-ai-hub-authenticated") === "true";
        } catch (error) {
          console.error("Could not read the account navigation state.", error);
        }
      }
      const accountMenu = nav.querySelector(".nav-account-menu");
      if (!accountMenu) return;
      accountMenu.innerHTML = authenticated
        ? `<a href="${pageHref("account.html")}#dashboard" data-i18n="accountDashboard">Dashboard</a>
          <a href="${pageHref("account.html")}#profile" data-i18n="accountProfile">Profile</a>
          <a href="${pageHref("account.html")}#favorites" data-i18n="accountFavorites">Favorites</a>
          <a href="${pageHref("account.html")}#saved-resources" data-i18n="accountSavedResources">Saved resources</a>
          <a href="${pageHref("account.html")}#saved-projects" data-i18n="accountSavedProjects">Saved projects</a>
          <a href="${pageHref("account.html")}#settings" data-i18n="accountSettings">Account settings</a>
          <a href="${pageHref("account.html")}?logout=1" data-i18n="accountSignOut">Log out</a>`
        : `<a href="${pageHref("account.html")}?mode=signup" data-i18n="accountSignUp">Sign up</a>
          <a href="${pageHref("account.html")}?mode=signin" data-i18n="accountSignIn">Log in</a>`;
      translateAddedContent(accountMenu);
    };
    renderAccountMenu();
    window.addEventListener("yatouji:auth-state", event => renderAccountMenu(event));
    window.addEventListener("storage", event => {
      if (event.key === "yatouji-ai-hub-authenticated") renderAccountMenu();
    });

    const currentRoute = routeFile.toLowerCase();
    const sectionFor = {
      "agents.html": "explore", "skills.html": "explore", "workflows.html": "explore",
      "code-library.html": "explore", "prompts.html": "explore", "models-arena.html": "explore",
      "resources.html": "explore", "ressources.html": "explore", "contribute.html": "explore",
      "open-source-ai.html": "explore",
      "article-audit-seo.html": "knowledge", "article-pages-piliers.html": "knowledge",
      "article-seo-geo.html": "knowledge",
      "knowledge.html": "knowledge", "learning.html": "knowledge",
      "tools.html": "tools", "outils.html": "tools", "ai-tools.html": "tools",
      "marketing-toolbox.html": "tools", "playground.html": "tools",
      "ai-reviews.html": "knowledge", "ai-use-cases.html": "knowledge",
      "ai-comparisons.html": "knowledge",
      "portfolio.html": "portfolio", "en.html": "portfolio",
      "project-builder.html": "builder", "ai-news.html": "news", "ai-new-releases.html": "news",
      "account.html": "account", "carte.html": "portfolio", "links.html": "portfolio"
    };
    for (const prefix of ["articles/", "knowledge/", "resources/"]) {
      if (currentRoute.startsWith(prefix)) {
        sectionFor[currentRoute] = prefix === "articles/" || prefix === "knowledge/" ? "knowledge" : "explore";
      }
    }
    const section = sectionFor[currentRoute];
    nav.querySelectorAll("a[href]").forEach(anchor => {
      const target = new URL(anchor.href, location.href);
      const targetPath = decodeURIComponent(target.pathname).replace(/\/+$/, "").toLowerCase();
      const currentPath = decodeURIComponent(location.pathname).replace(/\/+$/, "").toLowerCase();
      const exactRoute = targetPath === currentPath && !target.hash && !target.search;
      if (exactRoute) anchor.setAttribute("aria-current", "page");
      const group = anchor.closest(".nav-group");
      if (section && group && group.querySelector("summary")?.dataset.i18n === `nav${section[0].toUpperCase()}${section.slice(1)}`) {
        group.classList.add("is-active");
      }
    });
    const activeGroup = section === "explore" ? "navExplore"
      : section === "knowledge" ? "navKnowledge"
        : section === "tools" ? "navTools" : "";
    if (activeGroup) {
      const summary = nav.querySelector(`.nav-group > summary[data-i18n="${activeGroup}"]`);
      summary?.parentElement.classList.add("is-active");
    }

    const closeMenu = () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", window.yatoujiI18n?.t("navMenuToggle") || "Open menu");
      nav.querySelectorAll(".nav-group[open], .nav-account[open]").forEach(item => { item.open = false; });
    };
    menuButton.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", window.yatoujiI18n?.t(open ? "navMenuClose" : "navMenuToggle") || (open ? "Close menu" : "Open menu"));
      if (open) nav.querySelector(".nav-close")?.focus();
    });
    nav.querySelector(".nav-close")?.addEventListener("click", () => {
      closeMenu();
      menuButton.focus();
    });
    nav.addEventListener("click", event => {
      if (event.target instanceof HTMLAnchorElement) closeMenu();
    });
    nav.querySelectorAll(".nav-group").forEach(group => {
      group.addEventListener("toggle", () => {
        group.querySelector("summary")?.setAttribute("aria-expanded", String(group.open));
      });
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        closeMenu();
        menuButton.focus();
      }
    });
    document.addEventListener("click", event => {
      if (nav.classList.contains("open") && !nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });

    const breadcrumbs = header.parentElement?.querySelector(".hub-breadcrumbs") ||
      document.querySelector(".hub-breadcrumbs");
    if (breadcrumbs && routeFile !== "index.html") {
      const sectionDetails = {
        explore: { href: "agents.html", key: "navExplore" },
        knowledge: { href: "knowledge.html", key: "navKnowledge" },
        tools: { href: "ai-tools.html", key: "navTools" },
        portfolio: { href: "portfolio.html", key: "navPortfolio" },
        builder: { href: "project-builder.html", key: "navBuilder" },
        news: { href: "ai-news.html", key: "navNews" },
        account: { href: "account.html", key: "navAccount" }
      };
      const breadcrumbSection = sectionFor[currentRoute];
      const parent = sectionDetails[breadcrumbSection];
      if (parent && currentRoute !== parent.href.toLowerCase()) {
        const heading = document.querySelector("main h1")?.textContent.trim() || document.title;
        breadcrumbs.innerHTML = `<a href="${pageHref("index.html")}" data-i18n="navHome">Home</a>
          <span aria-hidden="true">/</span>
          <a href="${pageHref(parent.href)}" data-i18n="${parent.key}">${parent.key}</a>
          <span aria-hidden="true">/</span>
          <span>${heading}</span>`;
      } else if (parent) {
        breadcrumbs.innerHTML = `<a href="${pageHref("index.html")}" data-i18n="navHome">Home</a>
          <span aria-hidden="true">/</span><span>${document.querySelector("main h1")?.textContent.trim() || document.title}</span>`;
      }
    }
  }

  function setupSiteNavigation() {
    if (!document.getElementById("site-navigation-styles")) {
      const stylesheet = document.createElement("link");
      stylesheet.id = "site-navigation-styles";
      stylesheet.rel = "stylesheet";
      stylesheet.href = "/navigation.css?v=5";
      document.head.append(stylesheet);
    }

    document.querySelectorAll(".hub-header, .site-header").forEach(navigationLinks);

    if (!document.querySelector(".yatouji-assistant-float")) {
      const assistant = document.createElement("a");
      assistant.className = "yatouji-assistant-float";
      assistant.href = `/${locale}/assistant.html`;
      assistant.setAttribute("aria-label", "Open Yatouji Assistant");
      assistant.dataset.i18nAria = "assistantFloatingLabel";
      assistant.innerHTML = `<span aria-hidden="true">✦</span><span data-i18n="navAssistant">Yatouji Assistant</span>`;
      document.body.append(assistant);
      translateAddedContent(assistant);
    }
  }

  setupSiteNavigation();
  const isEnglish = document.documentElement.lang === "en";
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const themeButtons = document.querySelectorAll("[data-theme-toggle]");
  let savedTheme = "dark";
  try {
    savedTheme = localStorage.getItem("ayoub-theme") || "dark";
  } catch (error) {
    console.error("Could not read the saved theme preference.", error);
  }
  const setTheme = theme => {
    document.body.dataset.theme = theme;
    themeButtons.forEach(button => {
      const isDark = theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark
        ? (isEnglish ? "Enable light theme" : "Activer le thème clair")
        : (isEnglish ? "Enable dark theme" : "Activer le thème sombre"));
      button.textContent = isDark ? "☀" : "◐";
    });
  };
  setTheme(savedTheme === "light" ? "light" : "dark");
  themeButtons.forEach(button => button.addEventListener("click", () => {
    const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
    setTheme(theme);
    try {
      localStorage.setItem("ayoub-theme", theme);
    } catch (error) {
      console.error("Could not save the selected theme.", error);
    }
  }));

  const audienceButtons = document.querySelectorAll("[data-audience]");
  const setAudience = audience => {
    document.querySelectorAll(".audience-message").forEach(message => {
      message.hidden = !message.classList.contains(`audience-${audience}`);
    });
    audienceButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.audience === audience));
    });
    const primary = document.getElementById("audience-primary");
    const secondary = document.getElementById("audience-secondary");
    const cvLink = document.querySelector(".audience-cv-link");
    if (primary) {
      const label = primary.querySelector("[data-client-label]");
      if (label) label.textContent = label.dataset[`${audience}Label`];
      const isRecruiter = audience === "recruiter";
      primary.href = isRecruiter
        ? (isEnglish ? "CV_Ayoub_Yatouji_EN.pdf" : "CV_Ayoub_Yatouji_FR.pdf")
        : "#projets";
      if (isRecruiter) primary.setAttribute("download", "");
      else primary.removeAttribute("download");
    }
    if (secondary) {
      const label = secondary.querySelector("[data-client-label]");
      if (label) label.textContent = label.dataset[`${audience}Label`];
    }
    if (cvLink) cvLink.hidden = audience === "recruiter";
  };
  audienceButtons.forEach(button => button.addEventListener("click", () => {
    setAudience(button.dataset.audience);
  }));
  if (audienceButtons.length) setAudience("client");

  const installButtons = document.querySelectorAll("[data-install-app]");
  let installPrompt = null;
  const setInstallVisibility = visible => installButtons.forEach(button => {
    button.hidden = !visible;
  });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    setInstallVisibility(true);
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    setInstallVisibility(false);
  });
  installButtons.forEach(button => button.addEventListener("click", async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      setInstallVisibility(false);
    } catch (error) {
      console.error("The portfolio app could not be installed.", error);
    }
  }));

  document.querySelectorAll("[data-whatsapp-form]").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(form);
      const message = [
        isEnglish ? "Hello Ayoub, I’m contacting you from your portfolio." : "Bonjour Ayoub, je vous contacte depuis votre portfolio.",
        `${isEnglish ? "Need" : "Besoin"}: ${data.get("need")}`,
        `${isEnglish ? "Estimated budget" : "Budget estimé"}: ${data.get("budget")} TND`,
        data.get("name") ? `${isEnglish ? "Name" : "Nom"}: ${data.get("name")}` : "",
        `${isEnglish ? "Details" : "Détails"}: ${data.get("details")}`
      ].filter(Boolean).join("\n");
      window.location.href = `https://wa.me/21654123866?text=${encodeURIComponent(message)}`;
    });
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("/service-worker.js").catch(error => {
      console.error("Portfolio offline support could not be enabled.", error);
    });
  }
})();
