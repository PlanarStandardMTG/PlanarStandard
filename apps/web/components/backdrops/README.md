# Backdrops

Seasonal background effects for the home page. Each one is a folder holding a component and its
CSS module; `index.tsx` registers them by name. `app/page.tsx` picks one with its `BACKDROP`
constant, or `null` for none.

To add one: make `<name>/<name>.tsx` and `<name>.module.css`, add it to `BACKDROPS`. Keep it
decorative (no content, no pointer events), CSS-only where possible (`fracture` is a WebGL shader because cracks that grow can't be done in CSS; it reads the motion setting and theme from `<html>` itself), and stop its animation under
`prefers-reduced-motion` and under `:root[data-backdrop-motion="off"]` (the footer's Motion toggle). It paints behind everything, the header included, so keep it faint.
