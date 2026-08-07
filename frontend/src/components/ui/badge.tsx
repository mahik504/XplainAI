import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-white/[0.04] text-muted-foreground",
        cyan: "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan",
        violet: "border-neon-violet/30 bg-neon-violet/10 text-neon-violet",
        emerald: "border-neon-emerald/30 bg-neon-emerald/10 text-neon-emerald",
        amber: "border-neon-amber/30 bg-neon-amber/10 text-neon-amber",
        destructive: "border-destructive/35 bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
