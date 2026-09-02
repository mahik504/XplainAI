import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/**
 * XplainAI Brand Mark:
 * Minimalist geometric aperture & refraction prism symbolizing transparent AI reasoning.
 */
export function XplainAiLogo({ className, size = 26 }: XplainAiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(0,240,255,0.6)] select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cyberGradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Hexagon Shell */}
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke="rgba(0, 240, 255, 0.15)"
        strokeWidth="1.5"
        fill="#04060C"
      />

      {/* Cyber 'X' Core */}
      <path
        d="M9 10L23 22M23 10L9 22"
        stroke="url(#cyberGradient)"
        strokeWidth="2.5"
        strokeLinecap="square"
        filter="url(#neonGlow)"
      />

      {/* Glowing Data Nodes at the Tips */}
      <circle cx="9" cy="10" r="1.5" fill="#00F0FF" />
      <circle cx="23" cy="22" r="1.5" fill="#8B5CF6" />
      <circle cx="23" cy="10" r="1.5" fill="#00F0FF" />
      <circle cx="9" cy="22" r="1.5" fill="#8B5CF6" />
      
      {/* Central Neural Hub */}
      <circle cx="16" cy="16" r="2.5" fill="#030712" stroke="#6366F1" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1" fill="#00F0FF" filter="url(#neonGlow)" />
    </svg>
  );
}
