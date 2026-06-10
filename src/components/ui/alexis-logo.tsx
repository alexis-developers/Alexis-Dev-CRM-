import React from "react";

export function AlexisLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icon Group */}
      <g className="text-emerald-500">
        {/* Screen Outline */}
        <path
          d="M 64 54 H 20 C 14.5 54 10 49.5 10 44 V 24 C 10 18.5 14.5 14 20 14 H 60 C 65.5 14 70 18.5 70 24 V 38"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Code Glyphs </> */}
        <path
          d="M 22 32 L 16 38 L 22 44"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 31 29 L 26 47"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 35 32 L 41 38 L 35 44"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Swooping Arrow */}
        <path
          d="M 32 54 C 44 54 54 48 66 30"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow Head */}
        <path
          d="M 54 28 L 68 26 L 66 40 Z"
          fill="currentColor"
        />

        {/* Concentric Click Target */}
        <circle
          cx="74"
          cy="20"
          r="8"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="74"
          cy="20"
          r="2.5"
          fill="currentColor"
        />
      </g>

      {/* Typography Group */}
      <g fill="currentColor">
        {/* "ALEXIS" text */}
        <text
          x="92"
          y="39"
          fontFamily="var(--font-sans), sans-serif"
          fontSize="34px"
          fontWeight="800"
          letterSpacing="0.02em"
          className="text-white"
        >
          ALEXIS
        </text>
        {/* "MARKETING • DEV" text */}
        <text
          x="92"
          y="58"
          fontFamily="var(--font-sans), sans-serif"
          fontSize="11.5px"
          fontWeight="600"
          letterSpacing="0.22em"
          className="text-slate-400"
        >
          MARKETING • DEV
        </text>
      </g>
    </svg>
  );
}
