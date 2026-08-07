import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_var(--neon-cyan)] hover:brightness-110",
        glow: "border border-neon-cyan/35 bg-gradient-to-br from-neon-cyan/22 to-neon-violet/22 text-foreground shadow-[0_10px_36px_-18px_var(--neon-cyan)] hover:from-neon-cyan/32 hover:to-neon-violet/32",
        outline:
          "border border-border bg-white/[0.02] text-foreground hover:border-neon-cyan/40 hover:bg-white/[0.06]",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-115",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        icon: "size-9",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
