---
title: "Keep PII out of stored data, logs and the browser"
author: Sean
date: 2026-10-16
standing: true
---

## Decided

- Data from melee.gg and Challonge is scrubbed on the server before anything is saved. Keep only IDs, results and decklists. Never keep names, emails or Discord handles.
- Raw API access stays server-only, behind a few exported helper functions. Nothing outside `lib/melee/` may import the unscrubbed transport.
- Never log or return a raw error message from an external API. Log a short code or error name only. A response body can contain PII.
- Private profile fields such as the Arena and Discord names stay out of public views. The user also doesn't want things like "last played" shown publicly.

_Told to Claude in 2 past sessions here, most recently on Sep 25._
