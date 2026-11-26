---
title: Respect the Challonge and melee.gg request limits
author: Sean
date: 2026-10-16
standing: true
---

## Decided

- Challonge allows about 500 requests a month (the user thinks it is a rolling cap). melee.gg allows about 3 requests at a time. Both are tight.
- Read cached rows from our own database. Only call an API when the cache window has expired or an admin forces a refresh.
- Once an event has finished and been stored, never query it again.

## Watch out

- Preview deploys that share production credentials spend the same budget. A 429 from Challonge means the budget is used up. Wait for it to reset; don't retry in a loop.

_Told to Claude in 3 past sessions here, most recently on Sep 25._
