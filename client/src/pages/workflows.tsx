import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Workflow, WorkflowStep } from "@shared/schema";
import {
  Plus, Trash2, Edit2, Play, GripVertical, ArrowRight, GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const STAGE_COLORS: Record<string, string> = {
  design: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  development: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  testing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  review: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  deploy: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function Workflows() {
  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const [showCreate, setShowCreate] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [showExecute, setShowExecute] = useState<Workflow | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  // Seed templates on first load if empty
  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/workflows/seed-templates"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workflows"] }),
  });

  useEffect(() => {
    if (workflows.length === 0 && !seedMutation.isPending) {
      seedMutation.mutate();
    }
  }, [workflows.length]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; steps: WorkflowStep[] }) =>
      apiRequest("POST", "/api/workflows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; steps: WorkflowStep[] }) =>
      apiRequest("PATCH", `/api/workflows/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workflows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workflows"] }),
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, defaultAgentId }: { id: number; defaultAgentId: number }) =>
      apiRequest("POST", `/api/workflows/${id}/execute`, { defaultAgentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowExecute(null);
    },
  });

  function resetForm() {
    setName("");
    setDescription("");
    setSteps([]);
    setShowCreate(false);
    setEditingWorkflow(null);
  }

  function openEdit(w: Workflow) {
    setEditingWorkflow(w);
    setName(w.name);
    setDescription(w.description);
    setSteps([...w.steps]);
    setShowCreate(true);
  }

  function addStep() {
    setSteps([...steps, {
      order: steps.length + 1,
      title: "",
      assignedAgentId: null,
      type: "development",
      autoApprove: false,
      estimatedHours: 2,
    }]);
  }

  function updateStep(idx: number, field: string, value: any) {
    const updated = [...steps];
    (updated[idx] as any)[field] = value;
    setSteps(updated);
  }

  function removeStep(idx: number) {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(updated);
  }

  function handleSave() {
    if (!name.trim()) return;
    if (editingWorkflow) {
      updateMutation.mutate({ id: editingWorkflow.id, name, description, steps });
    } else {
      createMutation.mutate({ name, description, steps });
    }
  }

  const [executeAgentId, setExecuteAgentId] = useState<number>(0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            Workflows
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable workflow templates for task pipelines</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map(w => (
          <Card key={w.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{w.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(w.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {w.steps.sort((a, b) => a.order - b.order).map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[step.type] || ""}`}>
                    {step.title}
                  </Badge>
                  {i < w.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{w.steps.length} steps · ~{w.steps.reduce((s, st) => s + st.estimatedHours, 0)}h total</span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowExecute(w); setExecuteAgentId(agents[0]?.id || 0); }}>
                <Play className="h-3 w-3 mr-1" /> Execute
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {workflows.length === 0 && !seedMutation.isPending && (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No workflows yet. Click "New Workflow" to create one.</p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Feature Development" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this workflow accomplish?" rows={2} />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Add Step</Button>
              </div>
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center pt-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs font-mono w-5">{idx + 1}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Input value={step.title} onChange={e => updateStep(idx, "title", e.target.value)} placeholder="Step title" className="h-8 text-sm" />
                    </div>
                    <Select value={step.type} onValueChange={v => updateStep(idx, "type", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="testing">Testing</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="deploy">Deploy</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={String(step.assignedAgentId || "none")} onValueChange={v => updateStep(idx, "assignedAgentId", v === "none" ? null : Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Agent (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Auto-assign</SelectItem>
                        {agents.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.avatar} {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={step.estimatedHours} onChange={e => updateStep(idx, "estimatedHours", Number(e.target.value))} className="h-8 text-xs" min={0.5} step={0.5} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive mt-1" onClick={() => removeStep(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {steps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No steps yet. Add steps to define the workflow.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || steps.length === 0}>
              {editingWorkflow ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={!!showExecute} onOpenChange={(o) => { if (!o) setShowExecute(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute: {showExecute?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will create {showExecute?.steps.length} linked tasks with dependencies. Each step will start after the previous completes.
          </p>
          <div className="space-y-2">
            <Label>Default Agent (for unassigned steps)</Label>
            <Select value={String(executeAgentId)} onValueChange={v => setExecuteAgentId(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.avatar} {a.name} — {a.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExecute(null)}>Cancel</Button>
            <Button onClick={() => showExecute && executeMutation.mutate({ id: showExecute.id, defaultAgentId: executeAgentId })} disabled={!executeAgentId || executeMutation.isPending}>
              <Play className="h-4 w-4 mr-1" /> {executeMutation.isPending ? "Executing..." : "Execute Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
