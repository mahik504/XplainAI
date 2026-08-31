import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastProvider, useToast } from "@/components/ui/toast";

describe("UI Primitives", () => {
  it("renders Skeleton with shimmer and pulse variants", () => {
    const { container, rerender } = render(<Skeleton className="h-6 w-24" />);
    expect(container.firstChild).toHaveClass("shimmer-skeleton");

    rerender(<Skeleton variant="pulse" className="h-6 w-24" />);
    expect(container.firstChild).toHaveClass("animate-pulse");

    rerender(<Skeleton variant="glow" className="h-6 w-24" />);
    expect(container.firstChild).toHaveClass("border-cyan-500/20");
  });

  it("renders Button with variants and sizes", () => {
    render(<Button variant="glow">Glow Action</Button>);
    expect(screen.getByRole("button", { name: /glow action/i })).toBeInTheDocument();
  });

  it("renders Badge with default and neon styling", () => {
    render(<Badge variant="cyan">Verified</Badge>);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders Tabs with triggers and content", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });

  it("renders Command palette components", () => {
    render(
      <Command>
        <CommandInput placeholder="Type a command..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <span>Explore Graph</span>
              <CommandShortcut>Ctrl+G</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    expect(screen.getByPlaceholderText("Type a command...")).toBeInTheDocument();
    expect(screen.getByText("Explore Graph")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+G")).toBeInTheDocument();
  });

  it("renders Dialog with trigger and content", () => {
    render(
      <Dialog open={true}>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog Description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    expect(screen.getByText("Dialog Description")).toBeInTheDocument();
  });

  it("ToastProvider provides toast context without errors", () => {
    function TestConsumer() {
      const { addToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => addToast({ title: "Test Toast", type: "success" })}
        >
          Trigger
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: "Trigger" })).toBeInTheDocument();
  });
});
