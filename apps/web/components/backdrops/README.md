# Backdrops

Seasonal background effects for the home page. Each one is a folder holding a component and its
CSS module; `index.tsx` registers them by name. `app/page.tsx` picks one with its `BACKDROP`
constant, or `null` for none.

- `glass` — frosted glass with a passing sheen. CSS only.
- `fracture` — glass that cracks from an impact and drifts apart. WebGL.
- `nauctis` — light rain, with water rising until the page is underwater. WebGL.

To add one: make `<name>/<name>.tsx` and `<name>.module.css`, add it to `BACKDROPS`. Keep it
decorative and faint: it paints behind everything, the header included.

A CSS effect must stop its animation under `prefers-reduced-motion` and under
`:root[data-backdrop-motion="off"]` (the footer's Motion toggle). A WebGL effect is a `Scene` run by
`shader-backdrop.tsx`, which handles both for it, along with sizing, frame rate and reading its
colours from the CSS module for the current theme.
