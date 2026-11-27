(function () {
  const en = document.documentElement.lang === "en";
  const text = en ? {
    consent: "Please confirm you want to send this public URL to Google PageSpeed Insights.",
    invalid: "Enter a public website URL using http or https.",
    loading: "Requesting a mobile performance report…",
    timeout: "The request timed out. Try Google PageSpeed Insights directly.",
    quota: "Google’s free quota is temporarily unavailable. Try again later or use the direct link.",
    failed: "The report could not be loaded. Try the direct Google PageSpeed link.",
    result: "Performance score",
    copy: "Copied.",
    copyError: "Copy failed. Select and copy the result manually.",
    answers: "Answer every question to see your result."
  } : {
    consent: "Confirmez l’envoi de cette URL publique à Google PageSpeed Insights.",
    invalid: "Saisissez l’URL publique d’un site en http ou https.",
    loading: "Demande du rapport de performance mobile…",
    timeout: "La demande a expiré. Essayez directement Google PageSpeed Insights.",
    quota: "Le quota gratuit de Google est temporairement indisponible. Réessayez plus tard ou utilisez le lien direct.",
    failed: "Le rapport n’a pas pu être chargé. Essayez le lien Google PageSpeed direct.",
    result: "Score de performance",
    copy: "Copié.",
    copyError: "La copie a échoué. Sélectionnez et copiez le résultat manuellement.",
    answers: "Répondez à toutes les questions pour voir le résultat."
  };

  const byId = id => document.getElementById(id);
  const show = (element, message, isError) => {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", Boolean(isError));
    element.hidden = false;
  };
  const isPublicUrl = value => {
    let url;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    return !private172 || Number(private172[1]) < 16 || Number(private172[1]) > 31;
  };

  const speedForm = byId("speed-form");
  if (speedForm) {
    const status = byId("speed-status");
    const output = byId("speed-output");
    speedForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (output) output.hidden = true;
      if (!byId("speed-consent").checked) {
        show(status, text.consent, true);
        return;
      }
      const url = byId("speed-url").value.trim();
      if (!isPublicUrl(url)) {
        show(status, text.invalid, true);
        return;
      }
      show(status, text.loading, false);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
        endpoint.searchParams.set("url", url);
        endpoint.searchParams.set("strategy", "mobile");
        endpoint.searchParams.set("category", "PERFORMANCE");
        const response = await fetch(endpoint, { signal: controller.signal });
        if (response.status === 429) {
          show(status, text.quota, true);
          return;
        }
        if (!response.ok) throw new Error(`PageSpeed request failed: ${response.status}`);
        const data = await response.json();
        const score = data.lighthouseResult?.categories?.performance?.score;
        if (typeof score !== "number") throw new Error("PageSpeed response did not contain a performance score.");
        const metrics = data.lighthouseResult.audits;
        const scoreValue = Math.round(score * 100);
        byId("speed-score").textContent = `${scoreValue}/100`;
        byId("speed-score").className = `speed-score ${scoreValue >= 90 ? "good" : scoreValue >= 50 ? "medium" : "low"}`;
        byId("speed-lcp").textContent = metrics["largest-contentful-paint"]?.displayValue || "—";
        byId("speed-cls").textContent = metrics["cumulative-layout-shift"]?.displayValue || "—";
        output.hidden = false;
        show(status, text.result, false);
      } catch (error) {
        if (error.name === "AbortError") {
          show(status, text.timeout, true);
        } else {
          console.error("PageSpeed report failed.", error);
          show(status, text.failed, true);
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  const titleInput = byId("serp-title");
  const descriptionInput = byId("serp-description");
  const updateSerp = () => {
    if (!titleInput || !descriptionInput) return;
    byId("serp-title-preview").textContent = titleInput.value || (en ? "Your page title" : "Titre de votre page");
    byId("serp-description-preview").textContent = descriptionInput.value || (en ? "Your page description will appear here." : "La description de votre page apparaîtra ici.");
    byId("serp-title-count").textContent = `${titleInput.value.length}/60`;
    byId("serp-description-count").textContent = `${descriptionInput.value.length}/160`;
  };
  titleInput?.addEventListener("input", updateSerp);
  descriptionInput?.addEventListener("input", updateSerp);
  updateSerp();

  const roasForm = byId("roas-form");
  if (roasForm) {
    const updateRoas = () => {
      const spend = Number(byId("roas-spend").value);
      const cpc = Number(byId("roas-cpc").value);
      const rate = Number(byId("roas-rate").value) / 100;
      const orderValue = Number(byId("roas-order").value);
      const margin = Number(byId("roas-margin").value) / 100;
      const valid = spend > 0 && cpc > 0 && rate >= 0 && rate <= 1 && orderValue > 0 && margin >= 0 && margin <= 1;
      const result = byId("roas-result");
      if (!valid) {
        show(result, en ? "Use positive amounts and percentages from 0 to 100." : "Utilisez des montants positifs et des pourcentages de 0 à 100.", true);
        return;
      }
      const visits = spend / cpc;
      const conversions = visits * rate;
      const revenue = conversions * orderValue;
      const roas = revenue / spend;
      const profit = revenue * margin - spend;
      byId("roas-conversions").textContent = Math.round(conversions).toLocaleString(en ? "en" : "fr");
      byId("roas-revenue").textContent = `${revenue.toLocaleString(en ? "en" : "fr", { maximumFractionDigits: 0 })} TND`;
      byId("roas-ratio").textContent = `${roas.toFixed(2)}×`;
      byId("roas-break-even").textContent = `${(orderValue * margin).toFixed(2)} TND`;
      byId("roas-profit").textContent = `${profit.toLocaleString(en ? "en" : "fr", { maximumFractionDigits: 0 })} TND`;
      result.hidden = false;
      result.classList.remove("is-error");
    };
    roasForm.addEventListener("input", updateRoas);
    updateRoas();
  }

  const utmForm = byId("utm-form");
  if (utmForm) {
    utmForm.addEventListener("submit", event => {
      event.preventDefault();
      const result = byId("utm-result");
      try {
        const target = new URL(byId("utm-url").value.trim());
        if (!["http:", "https:"].includes(target.protocol)) throw new Error("Only web URLs are supported.");
        [["utm_source", "utm-source"], ["utm_medium", "utm-medium"], ["utm_campaign", "utm-campaign"], ["utm_term", "utm-term"], ["utm_content", "utm-content"]]
          .forEach(([key, id]) => {
            const value = byId(id).value.trim();
            if (value) target.searchParams.set(key, value);
          });
        byId("utm-output").value = target.toString();
        result.hidden = false;
      } catch (error) {
        show(result, en ? "Enter a valid http or https URL." : "Saisissez une URL http ou https valide.", true);
      }
    });
  }

  document.querySelectorAll("[data-copy-target]").forEach(button => {
    button.addEventListener("click", async () => {
      const target = byId(button.dataset.copyTarget);
      try {
        await navigator.clipboard.writeText(target.value || target.textContent);
        show(byId("copy-status"), text.copy, false);
      } catch (error) {
        console.error("Clipboard write failed.", error);
        show(byId("copy-status"), text.copyError, true);
      }
    });
  });

  const briefForm = byId("brief-form");
  if (briefForm) {
    briefForm.addEventListener("submit", event => {
      event.preventDefault();
      const fields = [...briefForm.querySelectorAll("[data-brief-label]")];
      const lines = fields.map(field => `${field.dataset.briefLabel}: ${field.value.trim()}`).filter(line => !line.endsWith(": "));
      byId("brief-output").value = lines.join("\n");
      byId("brief-result").hidden = false;
      const phone = "21654123866";
      byId("brief-whatsapp").href = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    });
  }

  const maturity = byId("maturity-form");
  if (maturity) {
    const questions = en
      ? ["My website is connected to Search Console.", "I know the search terms my customers use.", "Every important page has a clear purpose.", "My website works well on mobile.", "My key pages load quickly.", "I publish useful content regularly.", "I track leads or sales, not just clicks.", "My campaigns use conversion tracking.", "I review results at least monthly.", "I have a clear next action for visitors."]
      : ["Mon site est connecté à Search Console.", "Je connais les recherches de mes clients.", "Chaque page importante a un objectif clair.", "Mon site fonctionne bien sur mobile.", "Mes pages clés se chargent rapidement.", "Je publie régulièrement des contenus utiles.", "Je mesure les demandes ou ventes, pas seulement les clics.", "Mes campagnes suivent les conversions.", "J’analyse les résultats au moins une fois par mois.", "Mes visiteurs ont une prochaine étape évidente."];
    questions.forEach((question, index) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "tool-question";
      const legend = document.createElement("legend");
      legend.textContent = `${index + 1}. ${question}`;
      fieldset.append(legend);
      [[2, en ? "Yes" : "Oui"], [1, en ? "Partly" : "En partie"], [0, en ? "No" : "Non"]].forEach(([score, label]) => {
        const option = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `maturity-${index}`;
        input.value = String(score);
        input.required = true;
        option.append(input, document.createTextNode(label));
        fieldset.append(option);
      });
      maturity.insertBefore(fieldset, maturity.querySelector("button"));
    });
    maturity.addEventListener("submit", event => {
      event.preventDefault();
      const values = [...maturity.querySelectorAll('input[type="radio"]:checked')];
      if (values.length !== 10) {
        show(byId("maturity-result"), text.answers, true);
        return;
      }
      const score = values.reduce((total, input) => total + Number(input.value), 0);
      const message = score >= 16
        ? (en ? "Strong foundations. Focus on measurement and continuous improvement." : "De bonnes bases. Concentrez-vous sur la mesure et l’amélioration continue.")
        : score >= 9
          ? (en ? "Some foundations are in place; prioritize the highest-impact gaps." : "Certaines bases sont en place ; priorisez les lacunes qui comptent le plus.")
          : (en ? "There is room to improve. Start with a clear audit and a short action plan." : "Il y a une marge de progression. Commencez par un audit clair et un plan d’action court.");
      show(byId("maturity-result"), `${score}/20 — ${message}`, false);
    });
  }

  const compareForm = byId("compare-form");
  if (compareForm) {
    compareForm.addEventListener("input", () => {
      const horizon = Number(byId("compare-horizon").value);
      const urgency = Number(byId("compare-urgency").value);
      const budget = Number(byId("compare-budget").value);
      let recommendation;
      if (urgency >= 7 && budget >= 7) recommendation = en ? "Use paid ads to learn quickly, while building SEO as a durable channel." : "Utilisez la publicité pour apprendre vite, tout en construisant le SEO comme levier durable.";
      else if (urgency >= 7) recommendation = en ? "Start with a focused, small paid test; keep expectations tied to the test budget." : "Commencez par un test publicitaire ciblé et modeste ; adaptez les attentes au budget.";
      else if (horizon >= 6) recommendation = en ? "Prioritize SEO foundations and content; add ads when you need faster validation." : "Priorisez les bases SEO et le contenu ; ajoutez la publicité pour valider plus vite.";
      else recommendation = en ? "Combine a focused SEO foundation with a measured paid test." : "Combinez des fondations SEO ciblées avec un test publicitaire mesuré.";
      show(byId("compare-result"), recommendation, false);
    });
    compareForm.dispatchEvent(new Event("input"));
  }
})();
