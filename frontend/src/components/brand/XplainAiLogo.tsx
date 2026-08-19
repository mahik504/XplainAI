import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/**
 * XplainAI Brand Mark:
 * Precision vector monogram symbolizing transparent reasoning paths and grounded intelligence.
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
        <radialGradient id="cyanCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="1" />
          <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#083344" stopOpacity="0.2" />
        </radialGradient>
        <filter id="cyanNeonPulse" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="32" height="32" rx="8" fill="#070B16" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1" />

      {/* Outer Holographic Circuit Lines */}
      <circle cx="16" cy="16" r="11" stroke="rgba(6, 182, 212, 0.25)" strokeDasharray="3 3" strokeWidth="0.8" />

      {/* Evidence Vectors */}
      <line x1="8" y1="8" x2="16" y2="16" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="24" y1="8" x2="16" y2="16" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="8" y1="24" x2="16" y2="16" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="24" y1="24" x2="16" y2="16" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Peripheral Quantum Nodes */}
      <circle cx="8" cy="8" r="2.2" fill="#00F0FF" filter="url(#cyanNeonPulse)" />
      <circle cx="24" cy="8" r="2.2" fill="#6366F1" filter="url(#cyanNeonPulse)" />
      <circle cx="8" cy="24" r="2.2" fill="#10B981" filter="url(#cyanNeonPulse)" />
      <circle cx="24" cy="24" r="2.2" fill="#38BDF8" filter="url(#cyanNeonPulse)" />

      {/* Central Luminous Core */}
      <circle cx="16" cy="16" r="3.5" fill="url(#cyanCoreGlow)" filter="url(#cyanNeonPulse)" />
      <circle cx="16" cy="16" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}
