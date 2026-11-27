---
name: schema-markup-review
description: Draft and review JSON-LD against supplied visible page facts; never fabricate reviews, ratings, or page claims.
---

# Schema Markup Review

## Procedure

1. Identify the visible page type and facts explicitly provided by the user.
2. Suggest only properties supported by visible, accurate page content.
3. Return valid JSON-LD separately from explanatory notes.
4. Point out missing or contradictory data rather than filling it in.
5. Recommend validation with official tools and comparison against the rendered page.

## Constraints

- Never invent author details, dates, prices, ratings, reviews, or credentials.
- Do not claim search enhancement or ranking is guaranteed.
- Do not deploy markup automatically.

## Output

Return JSON-LD, a field-to-page-content mapping, and a validation checklist.
