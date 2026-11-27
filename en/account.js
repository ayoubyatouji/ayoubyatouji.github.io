const SUPABASE_SDK_URL = "https://esm.sh/@supabase/supabase-js@2.119.2";

export function validatePublicSupabaseConfig(config) {
  const urlValue = typeof config?.url === "string" ? config.url.trim() : "";
  const keyValue = typeof config?.publishableKey === "string" ? config.publishableKey : config?.anonKey;
  const publicKey = typeof keyValue === "string" ? keyValue.trim() : "";
  if (!urlValue || !publicKey) return { error: "missing" };

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return { error: "invalid" };
  }
  const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(isLocalHost && url.protocol === "http:"))
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    return { error: "invalid" };
  }

  if (/^sb_secret_/i.test(publicKey) || jwtRole(publicKey) === "service_role") {
    return { error: "unsafe" };
  }

  return { url: url.origin, publicKey };
}

function jwtRole(key) {
  const payload = key.split(".")[1];
  if (!payload) return "";
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded).role || "";
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function setStatus(status, message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function authErrorMessage(error, t) {
  if (["invalid_credentials", "email_not_confirmed"].includes(error?.code)) {
    return t("accountCredentialsInvalid");
  }
  if (error?.code === "weak_password") return t("accountWeakPassword");
  const detail = typeof error?.message === "string" ? ` ${error.message}` : "";
  return `${t("accountRequestFailed")}${detail}`;
}

export async function initializeAccount(app, t, config) {
  const configuration = validatePublicSupabaseConfig(config);
  if (configuration.error) {
    const message = configuration.error === "unsafe"
      ? t("accountUnsafeKey")
      : configuration.error === "invalid"
        ? t("accountInvalidConfig")
        : t("accountNotConfigured");
    app.innerHTML = `<div class="platform-card"><p class="hub-notice" role="status">${escapeHtml(message)}</p></div>`;
    return;
  }

  app.innerHTML = `<div class="platform-card"><p class="hub-status" role="status">${escapeHtml(t("accountLoadFailed"))}</p></div>`;
  let createClient;
  try {
    ({ createClient } = await import(SUPABASE_SDK_URL));
  } catch (error) {
    console.error("Could not load the Supabase browser client.", error);
    app.innerHTML = `<div class="platform-card"><p class="hub-empty-state" role="alert">${escapeHtml(t("accountLoadFailed"))}</p></div>`;
    return;
  }

  const client = createClient(configuration.url, configuration.publicKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true
    }
  });
  let viewVersion = 0;
  const callbackUrl = () => `${location.origin}${location.pathname}`;
  const publishAuthState = authenticated => {
    try {
      localStorage.setItem("yatouji-ai-hub-authenticated", String(authenticated));
    } catch (error) {
      console.error("Could not save the account navigation state.", error);
    }
    window.dispatchEvent(new CustomEvent("yatouji:auth-state", {
      detail: { authenticated }
    }));
  };

  function renderAuth(mode = "signin", message = "", isError = false, rememberedEmail = "") {
    viewVersion += 1;
    const isSignup = mode === "signup";
    const isForgot = mode === "forgot";
    const isRecovery = mode === "recovery";
    const heading = isSignup
      ? t("accountSignUp")
      : isForgot
        ? t("accountForgotPassword")
        : isRecovery
          ? t("accountNewPassword")
          : t("accountSignIn");
    const modeButtons = isForgot || isRecovery
      ? `<button class="hub-button hub-button-quiet" type="button" data-account-back>${escapeHtml(t("accountSignIn"))}</button>`
      : `<div class="account-mode-tabs" role="group" aria-label="${escapeHtml(t("pageAccount"))}">
          <button class="hub-button ${isSignup ? "hub-button-quiet" : "hub-button-primary"}" type="button" data-account-mode="signin" aria-pressed="${!isSignup}">${escapeHtml(t("accountSignIn"))}</button>
          <button class="hub-button ${isSignup ? "hub-button-primary" : "hub-button-quiet"}" type="button" data-account-mode="signup" aria-pressed="${isSignup}">${escapeHtml(t("accountSignUp"))}</button>
        </div>`;
    const fields = isForgot
      ? `<label class="platform-field" for="account-email">${escapeHtml(t("accountEmail"))}<input id="account-email" name="email" type="email" autocomplete="email" dir="ltr" maxlength="254" required value="${escapeHtml(rememberedEmail)}"></label>`
      : isRecovery
        ? `<label class="platform-field" for="account-password">${escapeHtml(t("accountNewPassword"))}<input id="account-password" name="password" type="password" autocomplete="new-password" dir="ltr" minlength="8" required><span>${escapeHtml(t("accountPasswordHint"))}</span></label>`
        : `<label class="platform-field" for="account-email">${escapeHtml(t("accountEmail"))}<input id="account-email" name="email" type="email" autocomplete="email" dir="ltr" maxlength="254" required value="${escapeHtml(rememberedEmail)}"></label>
          ${isSignup ? `<label class="platform-field" for="account-first-name">${escapeHtml(t("accountFirstName"))}<input id="account-first-name" name="firstName" type="text" autocomplete="given-name" dir="auto" maxlength="80"></label>
          <label class="platform-field" for="account-last-name">${escapeHtml(t("accountLastName"))}<input id="account-last-name" name="lastName" type="text" autocomplete="family-name" dir="auto" maxlength="80"></label>` : ""}
          <label class="platform-field" for="account-password">${escapeHtml(t("accountPassword"))}<input id="account-password" name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" dir="ltr" ${isSignup ? 'minlength="8"' : ""} required>${isSignup ? `<span>${escapeHtml(t("accountPasswordHint"))}</span>` : ""}</label>`;

    app.innerHTML = `<section class="platform-card account-card" aria-labelledby="account-form-heading">
      <h2 id="account-form-heading">${escapeHtml(heading)}</h2>
      ${modeButtons}
      <form class="platform-form account-form" id="account-auth-form">
        ${fields}
        <button class="hub-button hub-button-primary" type="submit">${escapeHtml(isForgot ? t("accountSendReset") : isRecovery ? t("accountNewPassword") : heading)}</button>
        ${mode === "signin" ? `<button class="account-text-button" type="button" data-account-forgot>${escapeHtml(t("accountForgotPassword"))}</button>` : ""}
        ${isSignup ? `<p class="account-privacy-note">${escapeHtml(t("accountPrivacyNotice"))} <a href="confidentialite.html">${escapeHtml(t("footerPrivacy"))}</a></p>` : ""}
        <p class="platform-tool-status${isError ? " is-error" : ""}" data-account-status role="status" aria-live="polite">${escapeHtml(message)}</p>
      </form>
    </section>`;

    const status = app.querySelector("[data-account-status]");
    app.querySelectorAll("[data-account-mode]").forEach(button => {
      button.addEventListener("click", () => renderAuth(button.dataset.accountMode));
    });
    app.querySelector("[data-account-forgot]")?.addEventListener("click", () => {
      const email = app.querySelector("#account-email")?.value || "";
      renderAuth("forgot", "", false, email);
    });
    app.querySelector("[data-account-back]")?.addEventListener("click", () => renderAuth("signin"));
    app.querySelector("#account-auth-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      setStatus(status, "");
      try {
        if (isForgot) {
          const { error } = await client.auth.resetPasswordForEmail(String(formData.get("email")), {
            redirectTo: callbackUrl()
          });
          if (error) throw error;
          setStatus(status, t("accountResetSent"));
          return;
        }
        if (isRecovery) {
          const { data, error } = await client.auth.updateUser({ password: String(formData.get("password")) });
          if (error) throw error;
          if (data.user) await renderProfile(data.user);
          else setStatus(status, t("accountPasswordUpdated"));
          return;
        }
        const email = String(formData.get("email")).trim();
        const password = String(formData.get("password"));
        if (isSignup) {
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: String(formData.get("firstName") || "").trim(),
                last_name: String(formData.get("lastName") || "").trim()
              },
              emailRedirectTo: callbackUrl()
            }
          });
          if (error) throw error;
          if (data.session && data.user) await renderProfile(data.user);
          else renderAuth("signin", t("accountCheckEmail"));
          return;
        }
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await renderProfile(data.user);
      } catch (error) {
        console.error("The account request failed.", error);
        const currentStatus = app.querySelector("[data-account-status]");
        setStatus(currentStatus, authErrorMessage(error, t), true);
      }
    });
  }

  async function renderProfile(user) {
    const version = ++viewVersion;
    app.innerHTML = `<div class="platform-card"><p class="hub-status" role="status">${escapeHtml(t("accountProfile"))}…</p></div>`;
    const { data, error } = await client
      .from("profiles")
      .select("first_name,last_name,preferred_locale")
      .eq("id", user.id)
      .single();
    if (version !== viewVersion) return;
    if (error) {
      console.error("Could not load the signed-in user's profile.", error);
      app.innerHTML = `<div class="platform-card"><p class="hub-empty-state" role="alert">${escapeHtml(t("accountProfileLoadFailed"))}</p></div>`;
      return;
    }

    const [savedResult, projectsResult] = await Promise.all([
      client.from("saved_items").select("item_type,item_id,created_at").order("created_at", { ascending: false }),
      client.from("projects").select("id,title,description,status,locale,updated_at").order("updated_at", { ascending: false })
    ]);
    if (version !== viewVersion) return;
    if (savedResult.error) console.error("Could not load the signed-in user's saved resources.", savedResult.error);
    if (projectsResult.error) console.error("Could not load the signed-in user's saved projects.", projectsResult.error);
    const savedItems = savedResult.data || [];
    const projects = projectsResult.data || [];
    const projectItemResult = projects.length
      ? await client.from("project_items").select("project_id,item_id").in("project_id", projects.map(project => project.id))
      : { data: [], error: null };
    if (version !== viewVersion) return;
    if (projectItemResult.error) console.error("Could not load saved project resources.", projectItemResult.error);
    const projectItems = projectItemResult.data || [];
    let resources = [];
    if (savedItems.length || projectItems.length) {
      try {
        const response = await fetch("content/resources.json?v=2", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Could not load resources (HTTP ${response.status}).`);
        resources = (await response.json()).resources || [];
      } catch (resourceError) {
        console.error("Could not resolve saved resource titles.", resourceError);
      }
    }
    const resourceById = new Map(resources.map(resource => [resource.id, resource]));
    const resourceCatalogPath = document.documentElement.lang === "fr" ? "ressources.html" : "resources.html";
    const savedResources = savedItems.filter(item => item.item_type === "resource");
    const savedResourceList = savedResources.length
      ? savedResources.map(item => {
        const resource = resourceById.get(item.item_id);
        const label = resource?.title || item.item_id;
        const href = resource ? `resources/${encodeURIComponent(resource.slug)}.html` : `${resourceCatalogPath}?q=${encodeURIComponent(item.item_id)}`;
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
      }).join("")
      : `<li>${escapeHtml(t("accountEmptyResources"))}</li>`;
    const projectResources = new Map();
    projectItems.forEach(item => {
      const current = projectResources.get(item.project_id) || [];
      current.push(item);
      projectResources.set(item.project_id, current);
    });
    const projectList = projects.length
      ? projects.map(project => {
        const selected = projectResources.get(project.id) || [];
        const resourcesList = selected.map(item => {
          const resource = resourceById.get(item.item_id);
          const label = resource?.title || item.item_id;
          const href = resource ? `resources/${encodeURIComponent(resource.slug)}.html` : `${resourceCatalogPath}?q=${encodeURIComponent(item.item_id)}`;
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
        }).join("");
        return `<article class="platform-card account-project-card" data-saved-project="${escapeHtml(project.id)}">
          <h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p>
          <p>${escapeHtml(t("accountProjectResources"))}: ${selected.length}</p>
          ${resourcesList ? `<ul>${resourcesList}</ul>` : ""}
          <button class="hub-button hub-button-quiet" type="button" data-delete-project="${escapeHtml(project.id)}">${escapeHtml(t("accountProjectDelete"))}</button>
        </article>`;
      }).join("")
      : `<p>${escapeHtml(t("accountEmptyProjects"))}</p>`;
    const savedLoadError = savedResult.error || projectsResult.error || projectItemResult.error;

    app.innerHTML = `<section class="platform-card account-card" id="dashboard">
      <h2>${escapeHtml(t("accountWelcome"))}</h2><p dir="ltr">${escapeHtml(user.email || "")}</p>
      <div class="account-dashboard-links">
        <a href="#favorites">${escapeHtml(t("accountFavorites"))} (${savedResources.length})</a>
        <a href="#saved-resources">${escapeHtml(t("accountSavedResources"))} (${savedItems.length})</a>
        <a href="#saved-projects">${escapeHtml(t("accountSavedProjects"))} (${projects.length})</a>
        <a href="#profile">${escapeHtml(t("accountProfile"))}</a>
      </div>
      <button class="hub-button hub-button-quiet" id="account-sign-out" type="button">${escapeHtml(t("accountSignOut"))}</button>
    </section>
    <section class="platform-card account-card" id="favorites"><h2>${escapeHtml(t("accountFavorites"))}</h2>
      <p>${savedResources.length ? `${savedResources.length}` : escapeHtml(t("accountEmptyFavorites"))}</p>
      ${savedResources.length ? `<a href="#saved-resources">${escapeHtml(t("accountSavedResources"))}</a>` : ""}
    </section>
    <section class="platform-card account-card" id="saved-resources"><h2>${escapeHtml(t("accountSavedResources"))}</h2>
      ${savedLoadError ? `<p role="status">${escapeHtml(t("accountSavedLoadFailed"))}</p>` : ""}
      <ul>${savedResourceList}</ul>
    </section>
    <section class="platform-card account-card" id="saved-projects"><h2>${escapeHtml(t("accountSavedProjects"))}</h2>
      ${savedLoadError ? `<p role="status">${escapeHtml(t("accountSavedLoadFailed"))}</p>` : ""}
      <div class="account-project-list">${projectList}</div>
      <p class="platform-tool-status" data-saved-project-status role="status" aria-live="polite"></p>
    </section>
    <section class="platform-card account-card" id="profile" aria-labelledby="account-profile-heading">
      <div class="account-profile-heading"><div><h2 id="account-profile-heading">${escapeHtml(t("accountProfile"))}</h2></div></div>
      <form class="platform-form account-form" id="account-profile-form">
        <label class="platform-field" for="account-first-name">${escapeHtml(t("accountFirstName"))}<input id="account-first-name" name="firstName" type="text" autocomplete="given-name" dir="auto" maxlength="80" value="${escapeHtml(data.first_name || "")}"></label>
        <label class="platform-field" for="account-last-name">${escapeHtml(t("accountLastName"))}<input id="account-last-name" name="lastName" type="text" autocomplete="family-name" dir="auto" maxlength="80" value="${escapeHtml(data.last_name || "")}"></label>
        <label class="platform-field" id="settings" for="account-locale">${escapeHtml(t("accountPreferredLanguage"))}<select id="account-locale" name="preferredLocale">
          <option value="fr" ${data.preferred_locale === "fr" ? "selected" : ""}>${escapeHtml(t("localeFrench"))}</option>
          <option value="en" ${data.preferred_locale === "en" ? "selected" : ""}>${escapeHtml(t("localeEnglish"))}</option>
          <option value="ar" ${data.preferred_locale === "ar" ? "selected" : ""}>${escapeHtml(t("localeArabic"))}</option>
        </select></label>
        <button class="hub-button hub-button-primary" type="submit">${escapeHtml(t("accountSaveProfile"))}</button>
        <p class="platform-tool-status" data-account-status role="status" aria-live="polite"></p>
      </form>
    </section>`;

    app.querySelector("#account-sign-out")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) throw signOutError;
        renderAuth("signin", t("accountSignedOut"));
      } catch (signOutError) {
        console.error("Could not sign out.", signOutError);
        button.disabled = false;
        setStatus(app.querySelector("[data-account-status]"), authErrorMessage(signOutError, t), true);
      }
    });
    app.querySelectorAll("[data-delete-project]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const projectCard = button.closest("[data-saved-project]");
        const status = app.querySelector("[data-saved-project-status]");
        try {
          const { error: deleteError } = await client
            .from("projects")
            .delete()
            .eq("id", button.dataset.deleteProject);
          if (deleteError) throw deleteError;
          projectCard?.remove();
          setStatus(status, t("accountProjectDeleted"));
        } catch (deleteError) {
          console.error("Could not delete the signed-in user's saved project.", deleteError);
          setStatus(status, t("accountProjectDeleteFailed").replace("{error}", deleteError.message), true);
          button.disabled = false;
        }
      });
    });
    app.querySelector("#account-profile-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector("[data-account-status]");
      button.disabled = true;
      setStatus(status, "");
      try {
        const { error: updateError } = await client
          .from("profiles")
          .update({
            first_name: String(fields.get("firstName") || "").trim() || null,
            last_name: String(fields.get("lastName") || "").trim() || null,
            preferred_locale: String(fields.get("preferredLocale"))
          })
          .eq("id", user.id);
        if (updateError) throw updateError;
        setStatus(status, t("accountProfileSaved"));
      } catch (updateError) {
        console.error("Could not update the signed-in user's profile.", updateError);
        setStatus(status, authErrorMessage(updateError, t), true);
      } finally {
        button.disabled = false;
      }
    });
  }

  try {
    const recoveryLink = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery"
      || new URLSearchParams(location.search).get("type") === "recovery";
    const query = new URLSearchParams(location.search);
    const requestedMode = query.get("mode") === "signup" ? "signup" : "signin";
    const logoutRequested = query.get("logout") === "1";
    client.auth.onAuthStateChange((event, session) => {
      if (["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        publishAuthState(Boolean(session?.user));
      }
      if (event === "PASSWORD_RECOVERY") {
        window.setTimeout(() => renderAuth("recovery"), 0);
      } else if (event === "SIGNED_OUT") {
        window.setTimeout(() => renderAuth("signin", t("accountSignedOut")), 0);
      }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    publishAuthState(Boolean(data.session?.user));
    if (logoutRequested && data.session) {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      history.replaceState(null, "", location.pathname);
      renderAuth("signin", t("accountSignedOut"));
      return;
    }
    if (recoveryLink) renderAuth("recovery");
    else if (data.session?.user) await renderProfile(data.session.user);
    else renderAuth(requestedMode);
  } catch (error) {
    console.error("Could not initialize the account session.", error);
    app.innerHTML = `<div class="platform-card"><p class="hub-empty-state" role="alert">${escapeHtml(authErrorMessage(error, t))}</p></div>`;
  }
}
