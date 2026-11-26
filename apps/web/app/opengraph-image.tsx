import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SHARE_IMAGE } from "@/lib/seo/page-metadata";

/** The default share card. It reads no request data, so it is built once at build time. */

export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = "image/png";

const appDir = join(process.cwd(), "app");

export default async function OpenGraphImage() {
  const [display, icon] = await Promise.all([
    readFile(join(appDir, "fonts/function-two-xbold.ttf")),
    readFile(join(appDir, "icon.svg")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 88px",
        background: "#0d0c17",
        color: "#f3eee3",
      }}
    >
      <img
        src={`data:image/svg+xml;base64,${icon.toString("base64")}`}
        width={240}
        height={240}
        alt=""
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontFamily: "Function Two", fontSize: 80, lineHeight: 1, color: "#e3a83b" }}>
          Planar Standard
        </div>
        <div style={{ fontSize: 31, lineHeight: 1.3, color: "#d8cfbb" }}>
          A community Magic: The Gathering format
        </div>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Function Two", data: display, weight: 800, style: "normal" }] },
  );
}
