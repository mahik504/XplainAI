import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/**
 * The Epistemic Cabernet Prism Monogram:
 * A faceted tactical prism in a frosted wine-glass chamber that refracts inquiry beams
 * into discrete spectral evidence bands (Wine Core, Amber Claims, Nordic Jade Evidence).
 */
export function XplainAiLogo({ className, size = 32 }: XplainAiLogoProps) {
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
        {/* Cabernet Wine Facet */}
        <linearGradient id="wine-prism-facet-a" x1="6" y1="4" x2="22" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E11D48" stopOpacity="0.95" />
          <stop offset="1" stopColor="#881337" stopOpacity="0.5" />
        </linearGradient>

        {/* Nordic Jade Facet */}
        <linearGradient id="wine-prism-facet-b" x1="18" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" stopOpacity="0.85" />
          <stop offset="1" stopColor="#047857" stopOpacity="0.35" />
        </linearGradient>

        {/* Ambient Wine Core */}
        <radialGradient id="wine-core-glow" cx="18" cy="18" r="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E11D48" stopOpacity="0.25" />
          <stop offset="1" stopColor="#070407" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Frosted Chamber Frame */}
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="9"
        fill="#0E050B"
        stroke="rgba(225, 29, 72, 0.35)"
        strokeWidth="1.2"
      />
      <rect x="2" y="2" width="32" height="32" rx="9" fill="url(#wine-core-glow)" />

      {/* Inquiry Input Beam */}
      <path
        d="M5 18 H13"
        stroke="#F9F9FB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
        opacity="0.85"
      />

      {/* The Central Faceted Prism */}
      <polygon
        points="18,6 28,24 8,24"
        fill="url(#wine-prism-facet-a)"
        stroke="#E11D48"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <polygon
        points="18,6 28,24 18,29"
        fill="url(#wine-prism-facet-b)"
        stroke="#10B981"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Central Focal Node & Optical Axis */}
      <line x1="18" y1="6" x2="18" y2="29" stroke="#F9F9FB" strokeWidth="1.4" opacity="0.95" />
      <circle cx="18" cy="18" r="2.2" fill="#F9F9FB" className="shadow-[0_0_10px_#e11d48]" />

      {/* Discrete Spectral Refraction Beams */}
      <path d="M27 13 L31 10" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 18 L32 18" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M27 23 L31 26" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
