# embed-registry

**Purpose.** Say what a component in an article is, and how it is written out
for a platform that cannot run it.

**Inputs.** `defineEmbed({ name, label, description, attributes, parse, export })`.
**Outputs.** A `RegisteredEmbed`; `expandEmbeds(markdown, target, registry, context, data)`
→ Markdown with every registered call replaced.

**Gotchas.** `export` is a `Record<ExportTarget, …>`, so a component without a
Reddit or Discord answer does not compile. `data` is what the site loaded to
show the component, keyed by the call's source line; it may be null and the
export must cope. Unknown names are left as written, on purpose.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
