import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Texas Grid Intel — ERCOT Energy Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0a1628 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            ⚡
          </div>
          <span style={{ color: "#f97316", fontSize: "28px", fontWeight: "700", letterSpacing: "-0.5px" }}>
            Texas Grid Intel
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            color: "#ffffff",
            fontSize: "52px",
            fontWeight: "800",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: "24px",
            maxWidth: "900px",
          }}
        >
          ERCOT Energy Intelligence
          <br />
          <span style={{ color: "#f97316" }}>for Texas Operations</span>
        </div>

        {/* Subline */}
        <div
          style={{
            color: "#94a3b8",
            fontSize: "22px",
            textAlign: "center",
            maxWidth: "700px",
            marginBottom: "48px",
          }}
        >
          Real-time power prices · Weather demand · Natural gas supply · Updated every 5 minutes
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["ERCOT", "NOAA", "EIA", "Live Risk Score"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.3)",
                borderRadius: "8px",
                padding: "8px 20px",
                color: "#f97316",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
