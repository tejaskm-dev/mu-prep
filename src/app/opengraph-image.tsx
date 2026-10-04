import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "µPrep — Everything you need. All in one place.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const mark = await readFile(path.join(process.cwd(), "public/brand/mu-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f8f9f2", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by satori */}
          <img src={markSrc} width={84} height={84} alt="" />
          <span style={{ fontSize: 54, fontWeight: 900, letterSpacing: -2, color: "#0e1512" }}>PREP</span>
          <span style={{ marginLeft: 12, padding: "8px 18px", borderRadius: 10, background: "#eaf6de", color: "#1e951f", fontSize: 26 }}>Notes Hub</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>
          <span style={{ color: "#0e1512" }}>Everything you need.</span>
          <span style={{ color: "#1e951f" }}>All in one place.</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#4b5249" }}>Notes · Previous papers · Syllabus — free, by µLearn</div>
      </div>
    ),
    size,
  );
}
