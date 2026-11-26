import { serializeJsonLd, type JsonLdData } from "@/lib/seo/json-ld";

/** Structured data for search engines, as the Next guide on JSON-LD renders it. */
export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
