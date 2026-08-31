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
      className={cn("shrink-0 transition-transform duration-200 hover:scale-105 select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="xplainPrismGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <radialGradient id="apertureGlow" cx="16" cy="16" r="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#0284C7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Rounded Container */}
      <rect width="32" height="32" rx="8" fill="#070C18" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />

      {/* Ambient Focal Glow */}
      <circle cx="16" cy="16" r="6" fill="url(#apertureGlow)" />

      {/* Precision Refractive Geometric Prism 'X' */}
      {/* Left-to-Right Beam */}
      <path
        d="M8.5 8.5L13.5 16L8.5 23.5"
        stroke="url(#xplainPrismGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right-to-Left Beam */}
      <path
        d="M23.5 8.5L18.5 16L23.5 23.5"
        stroke="url(#xplainPrismGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Observable Node */}
      <circle cx="16" cy="16" r="2.2" fill="#00F0FF" />
      <circle cx="16" cy="16" r="1" fill="#FFFFFF" />
    </svg>
  );
}
