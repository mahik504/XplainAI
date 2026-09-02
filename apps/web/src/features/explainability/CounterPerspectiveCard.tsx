import { ArrowLeftRight } from "lucide-react";

interface CounterPerspectiveCardProps {
  text: string | null | undefined;
}

export function CounterPerspectiveCard({ text }: CounterPerspectiveCardProps) {
  if (!text?.trim()) return null;

  return (
    <section className="rounded-xl border border-neon-violet/30 bg-neon-violet/5 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <ArrowLeftRight className="size-3.5 text-neon-violet" aria-hidden />
        <h3 className="text-[11px] tracking-[0.14em] text-neon-violet uppercase">
          Alternative perspective
        </h3>
      </div>
      <p className="text-xs leading-relaxed text-foreground/90">{text}</p>
    </section>
  );
}
