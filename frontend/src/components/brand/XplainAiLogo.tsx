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
      <rect width="32" height="32" rx="8" fill="#18181B" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
      
      {/* Precision Node Network */}
      <circle cx="10" cy="10" r="2.5" fill="#3B82F6" />
      <circle cx="22" cy="10" r="2" fill="#71717A" />
      <circle cx="16" cy="16" r="3" fill="#FAFAFA" />
      <circle cx="10" cy="22" r="2" fill="#71717A" />
      <circle cx="22" cy="22" r="2.5" fill="#34D399" />
      
      {/* Evidence Vectors */}
      <line x1="10" y1="10" x2="16" y2="16" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="22" y1="10" x2="16" y2="16" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="22" x2="16" y2="16" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="22" y1="22" x2="16" y2="16" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  );
}

