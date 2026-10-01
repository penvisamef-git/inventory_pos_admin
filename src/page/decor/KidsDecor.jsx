import React from "react";

// Decorative baby / kid shop drawings in SVG (no image files needed).
// Pure decoration: aria-hidden.
//   <KidsDecor variant="blocks" | "bottle" | "duck" className="..." />
//   <Star className="..." color="#f59e0b" />

function Blocks() {
  const block = (x, y, fill, letter, rot = 0) => (
    <g transform={`rotate(${rot} ${x + 30} ${y + 30})`}>
      <rect x={x} y={y} width="60" height="60" rx="10" fill={fill} />
      <rect x={x + 6} y={y + 6} width="48" height="48" rx="7" fill="rgba(255,255,255,0.22)" />
      <text x={x + 30} y={y + 43} textAnchor="middle" fontSize="34" fontWeight="800" fill="#ffffff" fontFamily="Arial, sans-serif">
        {letter}
      </text>
    </g>
  );
  return (
    <>
      <ellipse cx="100" cy="176" rx="74" ry="9" fill="rgba(31,35,48,0.08)" />
      {block(36, 108, "#1f7a4d", "A")}
      {block(104, 108, "#f59e0b", "B")}
      {block(70, 44, "#f472b6", "C", -8)}
    </>
  );
}

function Bottle() {
  return (
    <>
      <ellipse cx="100" cy="182" rx="40" ry="7" fill="rgba(31,35,48,0.08)" />
      <path d="M88 14 Q100 2 112 14 L114 34 L86 34 Z" fill="#f59e0b" />
      <rect x="76" y="32" width="48" height="16" rx="6" fill="#1f7a4d" />
      <rect x="66" y="46" width="68" height="132" rx="24" fill="#e7f3ec" stroke="#1f7a4d" strokeWidth="4" />
      <rect x="70" y="104" width="60" height="70" rx="20" fill="#ffffff" />
      {[70, 90, 110, 130, 150].map((y) => (
        <line key={y} x1="70" x2="86" y1={y} y2={y} stroke="#1f7a4d" strokeWidth="3" strokeLinecap="round" />
      ))}
      <circle cx="112" cy="80" r="8" fill="#f472b6" opacity="0.8" />
    </>
  );
}

function Duck() {
  return (
    <>
      <ellipse cx="100" cy="178" rx="70" ry="9" fill="rgba(31,35,48,0.08)" />
      <path d="M36 120 Q40 172 104 172 Q164 172 168 128 Q150 140 128 132 Q116 96 80 104 Q56 110 36 120 Z" fill="#fbbf24" />
      <circle cx="118" cy="78" r="38" fill="#fbbf24" />
      <path d="M150 78 Q178 80 178 90 Q166 100 148 94 Z" fill="#f97316" />
      <circle cx="128" cy="70" r="6" fill="#1f2330" />
      <circle cx="130" cy="68" r="2" fill="#ffffff" />
      <path d="M70 128 Q96 118 110 140" stroke="#f59e0b" strokeWidth="6" fill="none" strokeLinecap="round" />
    </>
  );
}

const VARIANTS = { blocks: Blocks, bottle: Bottle, duck: Duck };

function KidsDecor({ variant = "blocks", className = "" }) {
  const Drawing = VARIANTS[variant] || Blocks;
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <Drawing />
    </svg>
  );
}

// Small star used for scattered decoration
export function Star({ className = "", color = "#f59e0b" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path
        d="M20 3 L25 15 L38 16 L28 25 L31 37 L20 30 L9 37 L12 25 L2 16 L15 15 Z"
        fill={color}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default KidsDecor;
