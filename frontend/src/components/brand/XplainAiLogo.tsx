import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/**
 * XplainAI Brand Mark:
 * A clean, precision-crafted geometric monogram symbolizing transparent reasoning paths and grounded intelligence.
 */
export function XplainAiLogo({ className, size = 28 }: XplainAiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-transform duration-200 hover:scale-105", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF2E63" stopOpacity="1" />
          <stop offset="60%" stopColor="#E11D48" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#881337" stopOpacity="0.2" />
        </radialGradient>
        <filter id="neonPulse" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="32" height="32" rx="8" fill="#12040F" stroke="rgba(225, 29, 72, 0.4)" strokeWidth="1" />
      
      {/* Outer Holographic Circuit Lines */}
      <circle cx="16" cy="16" r="11" stroke="rgba(225, 29, 72, 0.2)" strokeDasharray="3 3" strokeWidth="0.8" />
      
      {/* Evidence Vectors */}
      <line x1="8" y1="8" x2="16" y2="16" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="24" y1="8" x2="16" y2="16" stroke="#FF2E63" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="8" y1="24" x2="16" y2="16" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="24" y1="24" x2="16" y2="16" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Peripheral Quantum Nodes */}
      <circle cx="8" cy="8" r="2.2" fill="#06B6D4" filter="url(#neonPulse)" />
      <circle cx="24" cy="8" r="2.2" fill="#FF2E63" filter="url(#neonPulse)" />
      <circle cx="8" cy="24" r="2.2" fill="#10B981" filter="url(#neonPulse)" />
      <circle cx="24" cy="24" r="2.2" fill="#8B5CF6" filter="url(#neonPulse)" />

      {/* Central Luminous Core */}
      <circle cx="16" cy="16" r="3.5" fill="url(#coreGlow)" filter="url(#neonPulse)" />
      <circle cx="16" cy="16" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

