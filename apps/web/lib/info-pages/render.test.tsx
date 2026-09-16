import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type InfoPageComponentRegistry } from "./components";
import { renderInfoPage } from "./render";

const registry: InfoPageComponentRegistry = {
  LegalSets: () => (
    <ul data-testid="legal-sets">
      <li>FDN</li>
    </ul>
  ),
};

const render = async (body: string, components?: readonly ["LegalSets"]) =>
  renderToStaticMarkup(await renderInfoPage({ body, components, registry }));

describe("renderInfoPage", () => {
  it("renders Markdown, including GFM tables", async () => {
    const html = await render("## Pool\n\n| Code |\n|---|\n| FDN |\n");
    expect(html).toContain("<h2>Pool</h2>");
    expect(html).toContain("<td>FDN</td>");
  });

  it("renders a component the page declared", async () => {
    const html = await render("Before\n\n<LegalSets />\n", ["LegalSets"]);
    expect(html).toContain('data-testid="legal-sets"');
  });

  it("refuses a component the page did not declare", async () => {
    // MDX executes. An undeclared component is not silently dropped and is not
    // silently rendered — it is a failure, so the page cannot quietly gain a
    // capability nobody reviewed.
    await expect(render("<LegalSets />\n")).rejects.toThrow(/LegalSets/);
  });

  it.each(["script", "iframe", "object", "embed", "link", "form", "div"])(
    "refuses <%s>, which MDX would otherwise emit as a real element",
    async (tag) => {
      // The `components` map never sees these: MDX compiles a literal tag
      // straight to the element. The whitelist catches them at compile time.
      await expect(render(`<${tag}>x</${tag}>\n`)).rejects.toThrow(/not available to this page/);
    },
  );

  it("refuses an expression in braces", async () => {
    // The point is that the server's environment is one brace away otherwise.
    await expect(render("{process.env.HOME}\n")).rejects.toThrow(/expressions in braces/);
  });

  it("allows a comment in braces, which is how generated regions are marked", async () => {
    expect(await render("{/* generated:start docs/x.md */}\n\nText.\n")).toContain("Text.");
  });

  it("refuses an import", async () => {
    await expect(render('import x from "node:fs"\n')).rejects.toThrow(
      /not allowed in an info page/,
    );
  });
});
