import { Search } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Command({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0f1d] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for actions or navigate the workspace",
  children,
  open,
  onOpenChange,
  ...props
}: ComponentProps<typeof Dialog> & {
  title?: string | undefined;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Dialog
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
      {...props}
    >
      <DialogContent className="overflow-hidden p-0 max-w-xl border-white/[0.1] bg-[#0a0f1d]/98 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="[&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input-wrapper]_svg]:size-5 [&_[data-slot=command-input]]:text-sm">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center border-b border-white/[0.08] px-3.5"
    >
      <Search className="mr-2 size-4 shrink-0 text-cyan-400 opacity-70" />
      <input
        data-slot="command-input"
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden p-1.5 scrollbar-slim", className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: ComponentProps<"div"> & { heading?: ReactNode }) {
  return (
    <div
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1.5 [&_[data-slot=command-group-heading]]:text-[10px] [&_[data-slot=command-group-heading]]:font-semibold [&_[data-slot=command-group-heading]]:uppercase [&_[data-slot=command-group-heading]]:tracking-wider [&_[data-slot=command-group-heading]]:text-muted-foreground", className)}
      {...props}
    >
      {heading && (
        <div data-slot="command-group-heading">{heading}</div>
      )}
      {children}
    </div>
  );
}

function CommandSeparator({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("-mx-1 my-1 h-px bg-white/[0.08]", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  selected = false,
  onSelect,
  onClick,
  ...props
}: ComponentProps<"div"> & {
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      data-slot="command-item"
      data-selected={selected}
      role="option"
      tabIndex={0}
      onClick={(e) => {
        onClick?.(e);
        onSelect?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground outline-none transition-colors hover:bg-white/[0.08] hover:text-white aria-selected:bg-white/[0.08] aria-selected:text-white data-[selected=true]:bg-cyan-500/15 data-[selected=true]:text-cyan-200 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}


function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto font-mono text-[10px] tracking-widest text-muted-foreground/80",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
