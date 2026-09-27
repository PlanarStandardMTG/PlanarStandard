import { loadCurrentFormat } from "@/lib/format/current-format";
import { publishedInfoPages } from "@/lib/info-pages/pages";
import { llmsIndex } from "@/lib/llms/index-text";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const format = await loadCurrentFormat();
  const body = llmsIndex(publishedInfoPages(), format.ok ? format.value : null, await siteOrigin());
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
