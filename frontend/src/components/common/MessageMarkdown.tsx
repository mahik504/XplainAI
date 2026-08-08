import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const blockComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-neon-cyan underline decoration-neon-cyan/40 underline-offset-2 hover:decoration-neon-cyan"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code
          className={cn(
            "my-2 block overflow-x-auto rounded-md border border-border/60 bg-black/35 px-2.5 py-2 font-mono text-[12px] leading-relaxed",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[12px] text-neon-cyan/95"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  h1: ({ children }) => <p className="mb-2 font-semibold text-foreground">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold text-foreground">{children}</p>,
  h3: ({ children }) => <p className="mb-1.5 font-semibold text-foreground">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-neon-violet/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/60" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border/60">{children}</thead>,
  th: ({ children }) => <th className="px-2 py-1.5 font-semibold text-foreground">{children}</th>,
  td: ({ children }) => (
    <td className="border-t border-border/40 px-2 py-1.5 text-foreground/90">{children}</td>
  ),
};

/** Inline-only markdown for annotated sentence chips (keeps chip layout intact). */
const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <>{children}</>,
  ul: ({ children }) => <span className="block">{children}</span>,
  ol: ({ children }) => <span className="block">{children}</span>,
  li: ({ children }) => (
    <span className="before:mr-1.5 before:content-['•'] block">{children}</span>
  ),
  pre: ({ children }) => (
    <span className="my-1 block whitespace-pre-wrap font-mono text-[12px]">{children}</span>
  ),
  h1: ({ children }) => <span className="font-semibold">{children}</span>,
  h2: ({ children }) => <span className="font-semibold">{children}</span>,
  h3: ({ children }) => <span className="font-semibold">{children}</span>,
  hr: () => <span className="my-1 block h-px w-full bg-border/60" />,
  blockquote: ({ children }) => (
    <span className="block border-l-2 border-neon-violet/40 pl-2 text-muted-foreground">
      {children}
    </span>
  ),
};

interface MessageMarkdownProps {
  content: string;
  className?: string;
  /** Prefer for annotated sentence chips — avoids block wrappers fighting the chip layout. */
  inline?: boolean;
}

export function MessageMarkdown({ content, className, inline = false }: MessageMarkdownProps) {
  if (!content) return null;

  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={cn(inline ? "inline" : "nn-md", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={inline ? inlineComponents : blockComponents}>
        {content}
      </ReactMarkdown>
    </Wrapper>
  );
}
