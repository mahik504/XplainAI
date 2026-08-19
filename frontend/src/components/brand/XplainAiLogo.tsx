import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/**
 * The Epistemic Prism Monogram:
 * A faceted architectural prism that visibly refracts incoming inquiry
 * into discrete spectral evidence bands (Amber Claims, Jade Evidence, Alabaster Synthesis).
 */
export function XplainAiLogo({ className, size = 30 }: XplainAiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-transform duration-300 hover:scale-105", className)}
      aria-hidden
    >
      <defs>
        {/* Prism Face Gradient */}
        <linearGradient id="prism-facet-a" x1="6" y1="4" x2="22" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" stopOpacity="0.9" />
          <stop offset="1" stopColor="#D97706" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="prism-facet-b" x1="18" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" stopOpacity="0.8" />
          <stop offset="1" stopColor="#059669" stopOpacity="0.3" />
        </linearGradient>

        <linearGradient id="prism-core-glow" x1="18" y1="8" x2="18" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F4F4F0" />
          <stop offset="1" stopColor="#A1A1AA" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Outer Chamber Frame */}
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="9"
        fill="#0D0D12"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth="1.2"
      />

      {/* Refraction Rays */}
      <path
        d="M6 18 H14"
        stroke="#F4F4F0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
        opacity="0.8"
      />

      {/* The Central Faceted Prism */}
      <polygon
        points="18,7 27,24 9,24"
        fill="url(#prism-facet-a)"
        stroke="#F59E0B"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <polygon
        points="18,7 27,24 18,28"
        fill="url(#prism-facet-b)"
        stroke="#10B981"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Internal Geometry & Core Focal Point */}
      <line x1="18" y1="7" x2="18" y2="28" stroke="#F4F4F0" strokeWidth="1.4" opacity="0.95" />
      <circle cx="18" cy="18" r="2.2" fill="#F4F4F0" className="shadow-[0_0_8px_#f59e0b]" />

      {/* Discrete Spectral Exit Beams */}
      <path d="M26 14 L30 11" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M27 18 L31 18" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M26 22 L30 25" stroke="#38BDF8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
