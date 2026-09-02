import { describe, expect, it } from "vitest";
import {
  DRAWER_BOTTOM_VARIANTS,
  FADE_VARIANTS,
  SCALE_VARIANTS,
  SLIDE_UP_VARIANTS,
  SPRING_BOUNCY,
  SPRING_DRAWER,
  SPRING_SMOOTH,
  SPRING_SNAPPY,
  TRANSITION_FAST,
  TRANSITION_NORMAL,
  getReducedMotionVariants,
} from "./animation";

describe("Motion & Animation System", () => {
  it("defines standard spring physics configs", () => {
    expect(SPRING_SNAPPY.type).toBe("spring");
    expect(SPRING_SNAPPY.stiffness).toBe(380);
    expect(SPRING_SNAPPY.damping).toBe(30);

    expect(SPRING_SMOOTH.type).toBe("spring");
    expect(SPRING_SMOOTH.stiffness).toBe(220);

    expect(SPRING_BOUNCY.type).toBe("spring");
    expect(SPRING_BOUNCY.damping).toBe(18);

    expect(SPRING_DRAWER.type).toBe("spring");
    expect(SPRING_DRAWER.damping).toBe(32);
  });

  it("defines standard transitions under 300ms", () => {
    expect(TRANSITION_FAST.duration).toBeLessThanOrEqual(0.3);
    expect(TRANSITION_NORMAL.duration).toBeLessThanOrEqual(0.3);
  });

  it("defines FADE_VARIANTS", () => {
    expect(FADE_VARIANTS.initial).toEqual({ opacity: 0 });
    expect(FADE_VARIANTS.animate).toEqual({ opacity: 1, transition: TRANSITION_NORMAL });
    expect(FADE_VARIANTS.exit).toEqual({ opacity: 0, transition: TRANSITION_FAST });
  });

  it("defines SCALE_VARIANTS starting from scale 0.95 (never 0)", () => {
    expect(SCALE_VARIANTS.initial).toEqual({ opacity: 0, scale: 0.95 });
    expect(SCALE_VARIANTS.animate).toHaveProperty("scale", 1);
    expect(SCALE_VARIANTS.exit).toHaveProperty("scale", 0.95);
  });

  it("defines DRAWER_BOTTOM_VARIANTS with 100% y offset", () => {
    expect(DRAWER_BOTTOM_VARIANTS.initial).toEqual({ y: "100%", opacity: 0 });
    expect(DRAWER_BOTTOM_VARIANTS.animate).toHaveProperty("y", 0);
    expect(DRAWER_BOTTOM_VARIANTS.exit).toHaveProperty("y", "100%");
  });

  it("getReducedMotionVariants preserves variants when prefersReduced is false", () => {
    const result = getReducedMotionVariants(SLIDE_UP_VARIANTS, false);
    expect(result).toEqual(SLIDE_UP_VARIANTS);
  });

  it("getReducedMotionVariants strips x, y, and scale transforms when prefersReduced is true", () => {
    const result = getReducedMotionVariants(SLIDE_UP_VARIANTS, true);
    expect((result.initial as any).y).toBeUndefined();
    expect((result.initial as any).opacity).toBe(0);
    expect((result.animate as any).y).toBeUndefined();
    expect((result.animate as any).opacity).toBe(1);
  });
});
