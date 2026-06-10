import { ImageResponse } from "next/og";

// Replaces the default Next.js favicon with the brand mark — Hostinger
// violet rounded square + white chat-square glyph — matching the
// sidebar logo in `src/components/layout/sidebar.tsx`. Next.js renders
// this at build time and auto-injects <link rel="icon"> into <head>.
//
// This route takes precedence over src/app/favicon.ico, which is the
// Next.js default and can stay on disk harmlessly (or be removed).

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090d16",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 80 80"
          fill="none"
        >
          <path
            d="M 64 54 H 20 C 14.5 54 10 49.5 10 44 V 24 C 10 18.5 14.5 14 20 14 H 60 C 65.5 14 70 18.5 70 24 V 38"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 22 32 L 16 38 L 22 44"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 31 29 L 26 47"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 35 32 L 41 38 L 35 44"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 32 54 C 44 54 54 48 66 30"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 54 28 L 68 26 L 66 40 Z"
            fill="#10b981"
          />
          <circle
            cx="74"
            cy="20"
            r="8"
            stroke="#10b981"
            strokeWidth="3.5"
            fill="none"
          />
          <circle
            cx="74"
            cy="20"
            r="2.5"
            fill="#10b981"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
