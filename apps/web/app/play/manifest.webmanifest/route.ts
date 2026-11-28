/**
 * The play app's manifest (E26.23), served from here rather than `app/manifest.ts`,
 * which Next would link from every page: only `/play` is meant to install.
 */
export function GET(): Response {
  return Response.json(
    {
      name: "Planar Standard Play",
      short_name: "PS Play",
      description: "Pairings, results and standings for Planar Standard events.",
      id: "/play",
      start_url: "/play",
      scope: "/play",
      display: "standalone",
      background_color: "#0d0c17",
      theme_color: "#0d0c17",
      icons: [
        { src: "/play/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/play/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/play/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
