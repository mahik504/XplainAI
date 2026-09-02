import type { Transition, Variants } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Standard Spring physics configurations
 */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
};

export const SPRING_SMOOTH: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 25,
};

export const SPRING_BOUNCY: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 18,
};

export const SPRING_DRAWER: Transition = {
  type: "spring",
  damping: 32,
  stiffness: 320,
};

/**
 * Standard CSS-like cubic bezier transitions
 */
export const TRANSITION_FAST: Transition = {
  duration: 0.15,
  ease: [0.23, 1, 0.32, 1],
};

export const TRANSITION_NORMAL: Transition = {
  duration: 0.25,
  ease: [0.23, 1, 0.32, 1],
};

export const TRANSITION_SLOW: Transition = {
  duration: 0.35,
  ease: [0.16, 1, 0.3, 1],
};

/**
 * Reusable Motion Variants following Emil Kowalski principles:
 * - Never scale from 0 (scale from 0.95)
 * - Transitions under 300ms
 * - Exit faster than entry
 */
export const FADE_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: TRANSITION_NORMAL },
  exit: { opacity: 0, transition: TRANSITION_FAST },
};

export const SCALE_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: SPRING_SNAPPY },
  exit: { opacity: 0, scale: 0.95, transition: TRANSITION_FAST },
};

export const SLIDE_UP_VARIANTS: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: SPRING_SNAPPY },
  exit: { opacity: 0, y: 8, transition: TRANSITION_FAST },
};

export const SLIDE_DOWN_VARIANTS: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0, transition: SPRING_SNAPPY },
  exit: { opacity: 0, y: -8, transition: TRANSITION_FAST },
};

export const SLIDE_LEFT_VARIANTS: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: SPRING_SMOOTH },
  exit: { opacity: 0, x: 20, transition: TRANSITION_FAST },
};

export const SLIDE_RIGHT_VARIANTS: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: SPRING_SMOOTH },
  exit: { opacity: 0, x: -20, transition: TRANSITION_FAST },
};

export const DRAWER_BOTTOM_VARIANTS: Variants = {
  initial: { y: "100%", opacity: 0 },
  animate: { y: 0, opacity: 1, transition: SPRING_DRAWER },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};

export const STAGGER_CONTAINER_VARIANTS: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Hook to detect prefers-reduced-motion OS setting
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else {
      mediaQuery.addListener(listener);
      return () => mediaQuery.removeListener(listener);
    }
  }, []);

  return prefersReduced;
}

/**
 * Helper to strip transforms and keep only opacity transitions when reduced motion is preferred
 */
export function getReducedMotionVariants(variants: Variants, prefersReduced: boolean): Variants {
  if (!prefersReduced) return variants;

  const reduced: Variants = {};
  for (const [key, val] of Object.entries(variants)) {
    if (typeof val === "object" && val !== null) {
      const { x, y, scale, rotate, ...rest } = val as Record<string, unknown>;
      reduced[key] = {
        ...rest,
        opacity: val.opacity !== undefined ? val.opacity : 1,
      };
    } else {
      reduced[key] = val;
    }
  }
  return reduced;
}
