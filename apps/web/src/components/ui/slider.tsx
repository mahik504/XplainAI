import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/[0.08]">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-neon-cyan to-neon-violet" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full border border-neon-cyan/60 bg-background shadow-[0_0_14px_-2px_var(--neon-cyan)] transition focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none" />
    </SliderPrimitive.Root>
  );
}

export { Slider };
