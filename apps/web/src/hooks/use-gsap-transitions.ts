import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * GSAP magnetic hover attraction hook.
 * Elements with ref or selector slightly follow cursor within a magnetic boundary.
 */
export function useGsapMagnetic<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);

      gsap.to(el, {
        x: x * 0.25,
        y: y * 0.25,
        duration: 0.35,
        ease: "power2.out",
      });
    };

    const onMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: "elastic.out(1, 0.4)",
      });
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);

    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return ref;
}

/**
 * GSAP staggered cards entrance animation hook.
 */
export function useGsapStaggerEntrance(selector: string, deps: any[] = []) {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (!elements || elements.length === 0) return;

    gsap.fromTo(
      elements,
      {
        opacity: 0,
        y: 18,
        scale: 0.98,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.45,
        stagger: 0.08,
        ease: "power2.out",
        overwrite: "auto",
      }
    );

    return () => {
      gsap.killTweensOf(elements);
    };
  }, deps);
}
