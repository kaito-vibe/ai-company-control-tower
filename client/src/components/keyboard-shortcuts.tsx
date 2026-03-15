import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open search" },
  { keys: ["N"], description: "New task" },
  { keys: ["M"], description: "Go to Meetings" },
  { keys: ["D"], description: "Go to Dashboard" },
  { keys: ["T"], description: "Go to Tasks" },
  { keys: ["P"], description: "Go to Projects" },
  { keys: ["O"], description: "Go to Org Chart" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in input/textarea/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      // Don't trigger with meta/ctrl modifiers (except cmd+k handled elsewhere)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setOpen((o) => !o);
          break;
        case "n":
        case "N":
          e.preventDefault();
          navigate("/tasks");
          break;
        case "m":
          e.preventDefault();
          navigate("/meetings");
          break;
        case "d":
          e.preventDefault();
          navigate("/");
          break;
        case "t":
          e.preventDefault();
          navigate("/tasks");
          break;
        case "p":
          e.preventDefault();
          navigate("/projects");
          break;
        case "o":
          e.preventDefault();
          navigate("/org-chart");
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" data-testid="dialog-keyboard-shortcuts">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUTS.map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">{s.description}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, j) => (
                    <kbd
                      key={j}
                      className="px-2 py-1 rounded bg-muted text-xs font-mono border"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
              {i < SHORTCUTS.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
