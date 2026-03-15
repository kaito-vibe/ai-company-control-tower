import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/utils";

interface AIButtonProps {
  onGenerated: (text: string) => void;
  context?: string;
  placeholder?: string;
}

export function AIButton({ onGenerated, context, placeholder }: AIButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-text", { prompt, context });
      const data = await res.json();
      onGenerated(data.text);
      setOpen(false);
      setPrompt("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
        data-testid="button-ai-generate"
      >
        <Sparkles className="h-3 w-3" />
        AI Generate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Text Generator
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder || "Describe what you want to generate..."}
            className="min-h-[100px]"
            data-testid="input-ai-prompt"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} data-testid="button-ai-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
