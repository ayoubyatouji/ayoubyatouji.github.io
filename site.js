(function () {
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
