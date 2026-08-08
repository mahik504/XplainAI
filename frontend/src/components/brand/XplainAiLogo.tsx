import { cn } from "@/lib/utils";

interface XplainAiLogoProps {
  className?: string;
  size?: number;
}

/** Minimal geometric X + neural node mark — cyan → violet, no external asset. */
export function XplainAiLogo({ className, size = 28 }: XplainAiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("nn-brand-mark shrink-0 transition-[filter] duration-300", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="nn-mark-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="url(#nn-mark-grad)" strokeOpacity="0.45" />
      <path
        d="M9 9 L15.2 15.2 M23 9 L16.8 15.2 M9 23 L15.2 16.8 M23 23 L16.8 16.8"
        stroke="url(#nn-mark-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.4" fill="url(#nn-mark-grad)" />
      <circle cx="9" cy="9" r="1.35" fill="#06B6D4" opacity="0.9" />
      <circle cx="23" cy="9" r="1.35" fill="#7C3AED" opacity="0.9" />
      <circle cx="9" cy="23" r="1.35" fill="#7C3AED" opacity="0.85" />
      <circle cx="23" cy="23" r="1.35" fill="#06B6D4" opacity="0.85" />
    </svg>
  );
}
