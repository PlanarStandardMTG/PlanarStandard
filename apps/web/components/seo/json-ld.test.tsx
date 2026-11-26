import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("renders one JSON-LD script holding valid, escaped JSON", () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ "@type": "WebSite", name: "</script>", url: "https://ps.test" }} />,
    );

    const match = /^<script type="application\/ld\+json">(.*)<\/script>$/.exec(html);
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? "")).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "</script>",
      url: "https://ps.test",
    });
  });
});
