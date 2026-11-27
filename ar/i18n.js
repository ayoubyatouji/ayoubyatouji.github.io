(() => {
  const supported = new Set(["fr", "en", "ar"]);
  const pathParts = location.pathname.split("/").filter(Boolean);
  const routeLocale = supported.has(pathParts[0]) ? pathParts[0] : "";
  const storedLocale = (() => {
    try {
      const value = localStorage.getItem("yatouji-ai-hub-language");
      return supported.has(value) ? value : "";
    } catch (error) {
      console.error("Could not read the saved language preference.", error);
      return "";
    }
  })();
  const locale = routeLocale || storedLocale || "fr";
  const routeParts = routeLocale ? pathParts.slice(1) : pathParts;
  const currentFile = routeParts.join("/") || "index.html";

  if (!routeLocale) {
    const initialTarget = `/${locale}/${currentFile}`;
    if (location.pathname !== initialTarget) {
      location.replace(`${initialTarget}${location.search}${location.hash}`);
      return;
    }
  }

  const depth = Math.max(1, routeParts.length);
  const siteRoot = "../".repeat(depth);
  const dictionaryUrl = `${siteRoot}content/platform-i18n.json?v=4`;
  const labels = {
    fr: { fr: "Français", en: "Anglais", ar: "Arabe" },
    en: { fr: "French", en: "English", ar: "Arabic" },
    ar: { fr: "الفرنسية", en: "الإنجليزية", ar: "العربية" }
  };

  function getByPath(object, key) {
    return key.split(".").reduce((value, part) => value && value[part], object);
  }

  function setTranslatedText(element, translated) {
    const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = translated;
    else element.textContent = translated;
  }

  function translatedValue(element) {
    let value = window.yatoujiI18n.t(element.dataset.i18n);
    for (const [name, replacement] of Object.entries({
      count: element.dataset.i18nCount,
      date: element.dataset.i18nDate
    })) {
      if (replacement !== undefined) value = value.replaceAll(`{${name}}`, replacement);
    }
    return value;
  }

  function addLanguageSelector() {
    const nav = document.querySelector("nav");
    if (!nav || nav.querySelector("[data-locale-switcher]")) return;
    const label = document.createElement("label");
    label.className = "locale-selector";
    label.innerHTML = `<span class="sr-only"></span><select data-locale-switcher></select>`;
    const select = label.querySelector("select");
    select.setAttribute("aria-label", "Language");
    for (const code of supported) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code.toUpperCase();
      select.append(option);
    }
    const themeButton = nav.querySelector("[data-theme-toggle]");
    if (themeButton) nav.insertBefore(label, themeButton);
    else nav.append(label);
  }

  function routeForLanguage(nextLocale) {
    let targetFile = currentFile;
    if (targetFile === "portfolio.html" || targetFile === "en.html") {
      targetFile = nextLocale === "en" ? "en.html" : "portfolio.html";
    }
    return `/${nextLocale}/${targetFile}`;
  }

  function setupSelector() {
    const select = document.querySelector("[data-locale-switcher]");
    if (!select) return;
    select.value = locale;
    select.setAttribute("aria-label", window.yatoujiI18n?.t("language") || "Language");
    select.addEventListener("change", () => {
      const nextLocale = select.value;
      if (!supported.has(nextLocale)) return;
      try {
        localStorage.setItem("yatouji-ai-hub-language", nextLocale);
      } catch (error) {
        console.error("Could not save the selected language.", error);
      }
      location.assign(`${routeForLanguage(nextLocale)}${location.search}${location.hash}`);
    });
  }

  function addFallbackNotice(dictionary) {
    const contentLocale = document.body?.dataset.contentLanguage;
    if (!contentLocale || contentLocale === locale || document.body?.dataset.platformPage) return;
    const notice = document.createElement("p");
    notice.className = "platform-language-notice";
    notice.setAttribute("role", "note");
    notice.textContent = dictionary.fallbackNotice
      .replace("{interfaceLanguage}", labels[locale][locale])
      .replace("{contentLanguage}", labels[locale][contentLocale] || contentLocale);
    document.querySelector(".hub-header, .site-header")?.after(notice);
  }

  function addPlatformContentNotice(dictionary) {
    const page = document.body?.dataset.platformPage;
    if (!page || page === "home") return;
    const notice = document.createElement("p");
    notice.className = "platform-language-notice";
    notice.setAttribute("role", "note");
    notice.textContent = dictionary.platformContentNotice;
    document.querySelector(".hub-header")?.after(notice);
  }

  window.yatoujiI18nReady = fetch(dictionaryUrl, { headers: { Accept: "application/json" } })
    .then(response => {
      if (!response.ok) throw new Error(`Could not load translations (HTTP ${response.status}).`);
      return response.json();
    })
    .then(messages => {
      const dictionary = messages[locale] || messages.fr;
      window.yatoujiI18n = {
        locale,
        direction: locale === "ar" ? "rtl" : "ltr",
        messages: dictionary,
        t(key) {
          const value = getByPath(dictionary, key);
          return typeof value === "string" ? value : key;
        },
        sourceLanguageName(code) {
          return labels[locale][code] || code;
        }
      };
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.body.dataset.locale = locale;
      if (routeLocale) {
        try {
          localStorage.setItem("yatouji-ai-hub-language", locale);
        } catch (error) {
          console.error("Could not save the selected language.", error);
        }
      }
      document.querySelectorAll("[data-i18n]").forEach(element => {
        const translated = translatedValue(element);
        if (translated !== element.dataset.i18n) setTranslatedText(element, translated);
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
        element.setAttribute("placeholder", window.yatoujiI18n.t(element.dataset.i18nPlaceholder));
      });
      document.querySelectorAll("[data-i18n-aria]").forEach(element => {
        element.setAttribute("aria-label", window.yatoujiI18n.t(element.dataset.i18nAria));
      });
      document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        button.setAttribute("aria-label", window.yatoujiI18n.t("navTheme"));
      });
      addLanguageSelector();
      setupSelector();
      addFallbackNotice(dictionary);
      addPlatformContentNotice(dictionary);
      return window.yatoujiI18n;
    })
    .catch(error => {
      console.error("The multilingual interface could not be initialized.", error);
      document.querySelectorAll("[data-locale-switcher]").forEach(select => {
        select.setAttribute("aria-invalid", "true");
        select.title = error.message;
      });
      throw error;
    });
})();
