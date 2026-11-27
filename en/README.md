# YATOUJI AI HUB

**Discover. Download. Automate.**

A static, GitHub Pages-compatible AI resource marketplace and Knowledge Hub integrated with Ayoub Yatouji's existing bilingual portfolio. The site uses HTML, CSS, vanilla JavaScript, and structured JSON. No backend, account, build framework, or third-party API key is required for the core experience.

## Local preview

From the project directory on Windows, run:

```powershell
py -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. If the `py` launcher is unavailable, try `python -m http.server 8000`. A local HTTP server is recommended because browser module imports and JSON fetches do not work reliably from a `file://` URL.

## Build and validation

After editing resource or article data, regenerate the committed static pages and SEO files:

```powershell
node scripts\build-hub.mjs
node --test tests\marketing-tools.test.mjs tests\zip-builder.test.mjs
```

The generator validates resource file paths and related IDs, creates marketplace and platform pages, builds `/fr/`, `/en/`, and `/ar/` route trees, and updates `sitemap.xml`, `feed.xml`, `robots.txt`, and the service-worker app shell. No npm install is required. GitHub Pages serves the generated HTML directly; it does not run this generator automatically.

## Pages

- `index.html` — YATOUJI AI HUB landing page and search.
- `/fr/`, `/en/`, `/ar/` — language-specific static routes. The selector remembers the choice and keeps the equivalent route where available.
- `agents.html`, `skills.html`, `workflows.html`, `code-library.html` — searchable, filterable resource catalogues.
- `resources/<slug>.html` — static SEO-friendly resource details with real file previews and downloads.
- `project-builder.html` — local, curated recommendations and a browser-generated ZIP containing selected files and setup documentation.
- `ai-tools.html` — curated official product, documentation, and announcement links; not a live news feed or product ranking.
- `knowledge.html` — article search, six topic filters, and pagination.
- `articles/<slug>.html` — static article pages with metadata, sources, Article/BreadcrumbList JSON-LD, reading progress, table of contents, and sharing links.
- `assistant.html` — local, metadata-based recommendations; it does not call an AI model.
- `account.html` — multilingual sign-up, sign-in, password recovery, and profile screen. It remains disabled until `supabase-client-config.js` contains a hosted project's URL and public key.
- `prompts.html` — searchable, versioned prompt library with per-prompt language availability.
- `models-arena.html` — model/provider references linked to official documentation. Provider claims are labeled and dated; this is not an independent benchmark.
- `marketing-toolbox.html` — browser-only calculators and content utilities; no API key is needed.
- `learning.html` — structured learning-path metadata, modules, and linked catalogue resources.
- `playground.html` — safe Markdown, JSON, and code previews. User input is rendered as text and is never executed.
- `contribute.html` — contribution requirements and a downloadable metadata template.
- `portfolio.html` — preserved French portfolio; `en.html` remains the English portfolio. Existing tools, resource pages, and French articles remain available.

## Languages and content availability

The interface dictionaries live in `content/platform-i18n.json`. Update all three locale entries for any new interface key, and use `data-i18n`, `data-i18n-placeholder`, or `data-i18n-aria` in page markup. The generator creates locale copies, sets `lang` and `dir`, adds canonical and `hreflang` metadata, and includes the localized routes in the sitemap.

Article and marketplace content is separate from interface strings. Existing article and resource copy remains in its source language until a reviewed translation is added; localized pages show a source-language notice rather than claiming that the content was translated. For prompts, add locale-specific variants under each prompt's `translations` object in `content/prompts.json`. For learning paths, localize the `title`, `description`, and lesson metadata in `content/learning-paths.json`.

The language selector stores its preference in `localStorage` under `yatouji-ai-hub-language`. The default for an unprefixed visit is French. Portfolio language switching pairs `portfolio.html` (French) with `en.html` (English); Arabic uses the French portfolio route with an explicit source-language notice.

## Adding platform content

- **Prompts:** add a record to `content/prompts.json` with category, prompt text, use case, compatible models, variables, examples, language, and version. Add `translations.fr` or `translations.ar` only when that complete translated variant exists.
- **Models:** update `content/ai-model-sources.json` from official provider sources. Set `verifiedOn`, include direct model/API/pricing links, and distinguish vendor claims from independent testing. Omit details that cannot be verified.
- **Learning paths:** edit `content/learning-paths.json`; keep lessons educational and link only to existing resources. Do not claim certification or completion tracking.
- **Tools:** calculator and formatting logic lives in `marketing-tools.js`; add focused expected-value and invalid-input cases to `tests/marketing-tools.test.mjs`.
- **Contributions:** edit `content/contribution-template.md` when metadata or review requirements change. The static site does not store submissions.

## Adding a marketplace resource

1. Add the actual downloadable file under `marketplace/` (or another repository path that belongs to the project).
2. Copy `content/resource-template.json` and add a complete record to the `resources` array in `content/resources.json`.
3. Use a unique `id` and `slug`; set the actual file path, type, format, license, version, dates, compatible platform, dependencies, installation steps, examples, tags, and safety notes.
4. Add related resource IDs only when they exist. For new agents or skills, state format/runtime compatibility precisely; a `SKILL.md` file is not automatically universal.
5. Keep workflow JSON inactive for examples. Document credentials, network requests, file or shell operations, data handling, and any side effects. Never include a real key, token, password, or customer data.
6. Run the build command above. Review the generated detail page, preview, download, metadata, and internal links.

Resource metadata and UI are separate. Shared defaults in `content/resources.json` fill common fields; each resource can override them. Project Builder recommendations use `useCases`, `tags`, title, and description with transparent local keyword matching.

## Adding an article

Follow `content/editorial-guidelines.md` and copy `content/article-template.json` into the `articles` array in `content/articles.json`. Add original, source-aware content using the supported `blocks` types (`paragraph`, `heading`, `list`, and `callout`). Verify official sources and update `lastVerified` when claims may change. Related article/resource IDs are validated by the generator. Run the build command to generate the article route, metadata, sitemap, RSS item, and PWA shell entry.

The three existing portfolio articles (`article-audit-seo.html`, `article-pages-piliers.html`, and `article-seo-geo.html`) are preserved and appear in the Knowledge Hub catalogue.

## Updating the AI Tools Directory

Edit `content/ai-tools.json`. Link directly to official product, documentation, pricing, or announcement pages. Set a real verification date, avoid unverified price/capability claims, and keep announcements as links unless a real dated item has been checked and curated. The current directory is static; no RSS/API feed is connected.

## Project Builder and downloads

The Project Builder reads only the checked-in JSON catalogue and actual same-origin files. Users can inspect recommendations, choose files, and download a store-only ZIP made in their browser. The package includes selected files, a README, installation notes, a dependency list, and a non-secret configuration example. The site does not execute downloaded scripts or workflows.

Favorites are stored in the visitor's browser using `localStorage`; they are not yet synced to the account or across devices. Downloads are not tracked and popularity rankings are intentionally omitted.

## Portfolio and existing functionality

The original portfolio information and project routes have been kept separate from the new root landing page. Existing qualifications, client/project content, published articles, contact details, calculators, static downloads, and PWA assets should remain intact. Contact links open email or WhatsApp for the visitor to review; no message is sent automatically.

## Static MVP limitations

- Newsletter, article feedback, ratings, comments, and submissions are not connected to a live backend. The account screens and Supabase RLS foundation are implemented and tested locally, but hosted authentication is disabled until a Supabase project is configured. Contact/update links open an email client.
- No AI API, live AI news feed, keyword metrics, search-volume data, or model comparison service is connected.
- Some existing articles and marketplace descriptions are not translated yet; locale routes preserve their source-language content and identify that language. Do not advertise those bodies as translated.
- Tool pages link to official sources and show when those links were checked. Products, model versions, prices, terms, and platform policies can change; verify them at the source.
- Resource prompts and workflows are demonstrations, not tested production services. Review compatibility and security before installation or execution.
- Google Fonts and external official links need an internet connection. Core pages and checked-in resource files are static.

## Supabase account foundation (not connected yet)

The site remains static on GitHub Pages. The initial Supabase migration defines private profiles, member/contributor/admin roles, saved items, projects, project items, and moderated submissions. Row Level Security scopes private records to `auth.uid()`. New Auth users receive a basic profile and the `member` role; only contributors and administrators can submit content. Role assignment and submission approval are not exposed to the browser. The pgTAP RLS suite passes all 22 assertions against the local Supabase stack.

The migration and pgTAP checks are in `supabase/migrations/` and `supabase/tests/database/`. On a development machine with the Supabase CLI and Docker installed, run:

```powershell
npx.cmd --yes supabase@latest start
npx.cmd --yes supabase@latest test db
```

Only after reviewing the schema and tests should an owner link a Supabase project and apply the migration:

```powershell
npx.cmd --yes supabase@latest login
npx.cmd --yes supabase@latest link --project-ref YOUR_PROJECT_REF
npx.cmd --yes supabase@latest db push
```

`supabase/config.toml` allows the GitHub Pages origin and local preview URLs as authentication redirects. Configure production SMTP and review the allowed redirect URLs in the Supabase dashboard before enabling signup. The account page is at `/fr/account.html`, `/en/account.html`, and `/ar/account.html`; it intentionally shows a disabled state until a project is configured.

To connect a hosted project, set `url` and `publishableKey` in `supabase-client-config.js` to the project's Supabase URL and public publishable key, then apply the reviewed migration with `npx.cmd --yes supabase@latest db push`. These values are public browser configuration; RLS—not the key—protects data. Never place a `service_role`/secret key in HTML, JavaScript, the public repository, or browser configuration; reserve it for trusted server-side/Edge Function secrets. Bootstrap the first administrator only from the Supabase SQL editor after creating that account, using its verified Auth user UUID. Never expose role assignment through user-editable metadata.

## Deploy with GitHub Pages

1. Create or use the repository `ayoubyatouji.github.io`.
2. Before pushing content changes, run `node scripts\build-hub.mjs` and both test files above.
3. Upload the entire project contents to the repository root, including `content`, `marketplace`, `resources`, `articles`, `scripts`, and `tests`.
4. In **Settings → Pages**, choose **Deploy from a branch**, select `main`, and choose `/ (root)`.
5. Keep `index.html` at the repository root. No GitHub Pages build command is needed because generated pages are committed.

## Privacy and publication review

- Files in a public GitHub Pages repository are publicly downloadable, including CVs and project documents.
- Check that project information, measurements, images, and client names are approved for publication.
- Never publish personal credentials, client exports, private data, or proprietary automation.
- The PageSpeed tool on the preserved portfolio may send a submitted public URL to Google's service only after the visitor's consent; its free quota can be limited.
- The static newsletter and email feedback links do not collect or store addresses.

