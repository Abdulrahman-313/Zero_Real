import { ImageResponse } from "next/og";

export const alt = "Synthetic Data Platform — realistic, privacy-safe tabular, relational and document data.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const chips = ["Tabular data", "Relational structures", "Document generator"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F2A3F",
          color: "#FAFAF7",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#DCEDE9", letterSpacing: 2 }}>HACKDATAV2 · SUBMISSION</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>Synthetic data platform</div>
          <div style={{ display: "flex", fontSize: 34, color: "#DCEDE9", maxWidth: 920 }}>
            Realistic, privacy-safe tabular, relational and document data — generated on demand.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                background: "#1C7C6C",
                color: "#FAFAF7",
                fontSize: 26,
                padding: "12px 24px",
                borderRadius: 999,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
