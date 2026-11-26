---
title: "SEO metadata and JSON-LD: what constrains them"
author: Sean
date: 2026-11-25
branch: main
cost: { minutes: 2, tokens: 68171 }
touches:
  - seo-handoff.md
---

## Decided

- No FAQPage schema: rules.mdx and getting-started.mdx are not question/answer content.
- JSON-LD only on crawlable pages (home, info pages, posts); deck/event/member pages are robots-blocked (E17.17).

## Tried and ruled out

- Static `metadata` with `metadataBase` in app/layout.tsx: siteOrigin() is async (reads headers), so the root needs generateMetadata.

## Watch out

- A child page's `openGraph` replaces the parent's whole object (siteName, locale, image drop out); the title template does not apply to og:title. Build page metadata through one shared helper.
- robots.ts disallows everything not listed, including /icon.svg and /opengraph-image, so Google cannot fetch a JSON-LD logo or fallback image unless those exact paths are allowed. Widening robots needs the user's OK.
- Canonical URLs follow the request host unless NEXT_PUBLIC_SITE_URL is set in production.
- JSON-LD from community post titles must escape `<` (<) so a title cannot close the script tag.
