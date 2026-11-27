# YATOUJI AI HUB editorial guidelines

## Publishing an article

1. Copy `article-template.json` into `articles.json`'s `articles` array.
2. Assign a unique `id` and URL-safe `slug`. Do not reuse an existing article ID or slug.
3. Use one of the declared categories in `articles.json`; add a category there only when the site will support it.
4. Write original, useful explanations for a defined reader. Prefer a practical example, a verification step, or first-hand experience over generic keyword-focused copy.
5. Add official or primary sources for changing product, policy, and platform details. Open each source, record its verification date in `lastVerified`, and link to it from the article.
6. Keep claims proportionate to the evidence. Do not invent dates, capabilities, prices, statistics, case studies, quotations, rankings, or reviews.
7. Use `blocks` with `paragraph`, `heading`, `list`, and `callout` types. Heading levels should follow a logical outline and start with level 2.
8. Add useful article/resource IDs to `relatedArticles` and `relatedResources`. Every ID must exist in the corresponding JSON catalogue.
9. Run `node scripts/build-hub.mjs`. It generates the static article route, metadata, Article and BreadcrumbList structured data, sitemap entry, RSS item, and PWA shell entry.
10. Review the generated page, citation URLs, canonical URL, internal links, and mobile layout before publishing.

## Content standards

- Clearly distinguish facts, interpretations, and recommendations.
- Date-check details that may change, and include a visible disclaimer where platform policies or product information are time-sensitive.
- Do not describe a curated link as live news. The AI directory links to official update pages but does not ingest a feed.
- Do not promise search rankings, AI citations, advertising results, or tool compatibility without evidence.
- Use only images with permission and accurate alt text. The current shared editorial cover is illustrative and not a screenshot of the article subject.
- Never publish personal data, credentials, client material, or private analytics without authorization.
- Keep newsletter, feedback, and contact functionality honest about whether a backend stores or sends data.

