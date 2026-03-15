import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Goal, Project } from "@shared/schema";
import {
  Plus, Target, ChevronDown, ChevronRight, Edit2, Trash2,
  Loader2, TrendingUp, CheckCircle2, AlertTriangle, Sparkles,
  FolderKanban, ArrowRight, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormattedText } from "@/components/formatted-text";
import { Link } from "wouter";
import { HelpButton } from "@/components/help-button";

const STATUS_COLORS: Record<string, { color: string; icon: any; label: string }> = {
  active: { color: "text-blue-400", icon: TrendingUp, label: "Active" },
  completed: { color: "text-green-400", icon: CheckCircle2, label: "Completed" },
  at_risk: { color: "text-orange-400", icon: AlertTriangle, label: "At Risk" },
};

function GoalForm({ goal, goals, agents, onSave, onClose }: {
  goal?: Goal;
  goals: Goal[];
  agents: Agent[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(goal?.title || "");
  const [description, setDescription] = useState(goal?.description || "");
  const [type, setType] = useState(goal?.type || "objective");
  const [parentGoalId, setParentGoalId] = useState<string>(goal?.parentGoalId?.toString() || "none");
  const [ownerId, setOwnerId] = useState<string>(goal?.ownerId?.toString() || "none");
  const [quarter, setQuarter] = useState(goal?.quarter || "Q1 2026");
  const [progress, setProgress] = useState(goal?.progress || 0);
  const [generating, setGenerating] = useState(false);

  const objectives = goals.filter(g => g.type === "objective");

  async function generateKRs() {
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-text", {
        prompt: `Given this objective: "${title}" (${description}), suggest 3 specific, measurable key results. Format each as a single line starting with "KR:" followed by the key result.`,
        context: "This is for a company OKR planning session.",
      });
      const data = await res.json();
      setDescription(prev => prev + (prev ? "\n\n" : "") + "Suggested Key Results:\n" + data.text);
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={() => setType("objective")} className={`p-2.5 rounded-lg border text-sm transition-all ${type === "objective" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
            <Target className="h-4 w-4 mx-auto mb-1" />
            Objective
          </button>
          <button onClick={() => setType("key_result")} className={`p-2.5 rounded-lg border text-sm transition-all ${type === "key_result" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
            <TrendingUp className="h-4 w-4 mx-auto mb-1" />
            Key Result
          </button>
        </div>
      </div>
      {type === "key_result" && (
        <div>
          <Label>Parent Objective <span className="text-destructive">*</span></Label>
          <Select value={parentGoalId} onValueChange={setParentGoalId}>
            <SelectTrigger>
              <SelectValue placeholder="Select objective..." />
            </SelectTrigger>
            <SelectContent>
              {objectives.length === 0 ? (
                <SelectItem value="none" disabled>Create an objective first</SelectItem>
              ) : (
                objectives.map(o => (
                  <SelectItem key={o.id} value={o.id.toString()}>{o.title}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {parentGoalId === "none" && objectives.length > 0 && (
            <p className="text-xs text-orange-400 mt-1">A key result should belong to an objective for proper tracking.</p>
          )}
        </div>
      )}
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "objective" ? "Launch digital products division" : "Hire 5 engineers by end of Q1"} data-testid="input-goal-title" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Description</Label>
          {type === "objective" && (
            <Button variant="ghost" size="sm" onClick={generateKRs} disabled={generating || !title} className="gap-1 text-xs h-7">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Suggest KRs
            </Button>
          )}
        </div>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this goal..." className="min-h-[80px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Owner</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Assign owner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quarter</Label>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Q1 2026">Q1 2026</SelectItem>
              <SelectItem value="Q2 2026">Q2 2026</SelectItem>
              <SelectItem value="Q3 2026">Q3 2026</SelectItem>
              <SelectItem value="Q4 2026">Q4 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {goal && (
        <div>
          <Label>Progress ({(progress / 100).toFixed(2)} / 1.0)</Label>
          <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} max={100} step={5} className="mt-2" />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({
          title, description, type, quarter, progress,
          parentGoalId: parentGoalId === "none" ? null : Number(parentGoalId),
          ownerId: ownerId === "none" ? null : Number(ownerId),
          status: progress >= 100 ? "completed" : "active",
          createdAt: goal?.createdAt || new Date().toISOString(),
        })} disabled={!title || (type === "key_result" && parentGoalId === "none" && objectives.length > 0)} data-testid="button-save-goal">
          {goal ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Dialog for showing proposed projects from strategy
function DeriveProjectsDialog({ goalId, open, onOpenChange }: {
  goalId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [rawText, setRawText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const deriveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/goals/${goalId}/derive-projects`).then(r => r.json()),
    onSuccess: (data: any) => {
      setProposals(data.proposals || []);
      setRawText(data.rawText || "");
      // Select all by default
      setSelected(new Set(data.proposals?.map((_: any, i: number) => i) || []));
    },
  });

  const createProjectsMutation = useMutation({
    mutationFn: async () => {
      const toCreate = proposals.filter((_, i) => selected.has(i));
      const results = [];
      for (const p of toCreate) {
        const res = await apiRequest("POST", "/api/approval-queue", {
          title: p.title,
          description: p.description,
          priority: p.priority || "medium",
          assignedAgentId: p.assignedAgentId || null,
          source: "strategy",
          goalId: goalId,
        });
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onOpenChange(false);
    },
  });

  // Auto-derive when dialog opens
  const handleOpen = () => {
    if (!deriveMutation.isPending && proposals.length === 0) {
      deriveMutation.mutate();
    }
  };

  // Trigger on open
  if (open && proposals.length === 0 && !deriveMutation.isPending && !deriveMutation.isError) {
    handleOpen();
  }

  function toggleProject(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Derive Projects from Strategy
          </DialogTitle>
        </DialogHeader>

        {deriveMutation.isPending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-sm text-muted-foreground">AI is analyzing the objective and proposing projects...</span>
          </div>
        ) : deriveMutation.isError ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to derive projects. Try again.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => deriveMutation.mutate()}>
              Retry
            </Button>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No projects proposed.</p>
            {rawText && (
              <div className="mt-3 bg-muted/30 rounded-lg p-3 text-left max-h-40 overflow-y-auto">
                <FormattedText text={rawText} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Select projects to create. Uncheck any you don't want.</p>
            {proposals.map((p, i) => {
              const assignee = agents.find(a => a.id === p.assignedAgentId);
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selected.has(i) ? "border-primary/40 bg-primary/5" : "border-border/50 opacity-60"}`}
                  onClick={() => toggleProject(i)}>
                  <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleProject(i)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{p.title}</h4>
                      {p.priority && (
                        <Badge variant="outline" className={`text-[10px] ${p.priority === "high" ? "text-orange-400" : p.priority === "low" ? "text-muted-foreground" : "text-blue-400"}`}>
                          {p.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                    {assignee && (
                      <p className="text-[10px] text-muted-foreground mt-1">{assignee.avatar} {assignee.name}</p>
                    )}
                  </div>
                </div>
              );
            })}

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={() => createProjectsMutation.mutate()}
                disabled={selected.size === 0 || createProjectsMutation.isPending}
                className="gap-1.5"
              >
                {createProjectsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderKanban className="h-3.5 w-3.5" />}
                Submit {selected.size} for CEO Approval
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveCard({ objective, keyResults, agents, projects, onEdit, onDelete, onLinkProject }: {
  objective: Goal;
  keyResults: Goal[];
  agents: Agent[];
  projects: Project[];
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  onLinkProject: (goalId: number, projectId: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showDeriveProjects, setShowDeriveProjects] = useState(false);
  const [showLinkProject, setShowLinkProject] = useState(false);

  const owner = agents.find(a => a.id === objective.ownerId);
  const avgProgress = keyResults.length > 0
    ? Math.round(keyResults.reduce((s, kr) => s + kr.progress, 0) / keyResults.length)
    : objective.progress;
  const statusCfg = avgProgress >= 100
    ? STATUS_COLORS.completed
    : avgProgress < 25 && keyResults.length > 0
    ? STATUS_COLORS.at_risk
    : STATUS_COLORS.active;

  // Explicit linked project IDs
  const explicitIds: number[] = (objective as any).linkedProjectIds || [];
  // Find linked projects: explicitly linked OR text-matched
  const linkedProjects = projects.filter(p =>
    explicitIds.includes(p.id) ||
    p.description?.toLowerCase().includes(objective.title.toLowerCase().slice(0, 30))
  );
  const unlinkableProjects = projects.filter(p => !linkedProjects.some(lp => lp.id === p.id));

  return (
    <>
      <Card className="overflow-hidden" data-testid={`goal-${objective.id}`}>
        <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-start gap-3">
            <Target className={`h-5 w-5 mt-0.5 ${statusCfg.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{objective.title}</h3>
                <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                  {statusCfg.label}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{objective.quarter}</Badge>
              </div>
              {objective.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{objective.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Progress value={avgProgress} className="flex-1 h-2" />
                <span className="text-xs font-medium w-10 text-right">{(avgProgress / 100).toFixed(2)}</span>
                {owner && <span className="text-xs text-muted-foreground">{owner.avatar} {owner.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Derive Projects" onClick={(e) => { e.stopPropagation(); setShowDeriveProjects(true); }}>
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onEdit(objective); }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(objective); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 pl-12 space-y-2">
            {keyResults.length > 0 && keyResults.map(kr => {
              const krOwner = agents.find(a => a.id === kr.ownerId);
              return (
                <div key={kr.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => onEdit(kr)}>
                  <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${kr.progress >= 100 ? "text-green-400" : kr.progress < 25 ? "text-orange-400" : "text-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{kr.title}</p>
                  </div>
                  <Progress value={kr.progress} className="w-20 h-1.5" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{(kr.progress / 100).toFixed(2)}</span>
                  {krOwner && <span className="text-[10px] text-muted-foreground">{krOwner.avatar}</span>}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onDelete(kr); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              );
            })}
            {keyResults.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-1">No key results yet. Add one to track measurable progress.</p>
            )}

            {/* Linked projects */}
            {linkedProjects.length > 0 && (
              <div className="pt-1.5 border-t border-border/30">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Linked Projects
                </p>
                {linkedProjects.map(p => (
                  <Link key={p.id} href="/projects">
                    <div className="flex items-center gap-2 p-1.5 rounded text-xs hover:bg-muted/30 transition-colors cursor-pointer">
                      <FolderKanban className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate flex-1">{p.title}</span>
                      <Progress value={p.progress || 0} className="w-16 h-1.5" />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{p.progress || 0}%</span>
                      <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Link Project + Derive Projects actions */}
            <div className="flex items-center gap-2">
              {showLinkProject ? (
                <Select onValueChange={(val) => { onLinkProject(objective.id, Number(val)); setShowLinkProject(false); }}>
                  <SelectTrigger className="h-7 text-xs w-48" data-testid={`select-link-project-${objective.id}`}>
                    <SelectValue placeholder="Select project to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkableProjects.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLinkProject(true)}
                  className="gap-1.5 text-xs h-7 text-primary hover:text-primary"
                  data-testid={`button-link-project-${objective.id}`}
                >
                  <Link2 className="h-3 w-3" />
                  Link Project
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeriveProjects(true)}
                className="gap-1.5 text-xs h-7 text-primary hover:text-primary"
              >
                <FolderKanban className="h-3 w-3" />
                Derive Projects
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {showDeriveProjects && (
        <DeriveProjectsDialog
          goalId={objective.id}
          open={showDeriveProjects}
          onOpenChange={setShowDeriveProjects}
        />
      )}
    </>
  );
}

export default function Strategy() {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | undefined>();
  const [deleteGoal, setDeleteGoal] = useState<Goal | undefined>();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const objectives = goals.filter(g => g.type === "objective");
  const keyResults = goals.filter(g => g.type === "key_result");
  const orphanKRs = keyResults.filter(kr => !kr.parentGoalId || !objectives.find(o => o.id === kr.parentGoalId));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/goals", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/goals"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/goals/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/goals"] }); setEditGoal(undefined); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/goals/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/goals"] }); setDeleteGoal(undefined); },
  });

  function handleSave(data: any) {
    if (editGoal) {
      updateMutation.mutate({ id: editGoal.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleLinkProject(goalId: number, projectId: number) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const existing: number[] = (goal as any).linkedProjectIds || [];
    if (existing.includes(projectId)) return;
    updateMutation.mutate({ id: goalId, data: { linkedProjectIds: [...existing, projectId] } });
  }

  const overallProgress = objectives.length > 0
    ? Math.round(objectives.reduce((s, o) => {
        const krs = keyResults.filter(kr => kr.parentGoalId === o.id);
        const oProgress = krs.length > 0
          ? Math.round(krs.reduce((ks, kr) => ks + kr.progress, 0) / krs.length)
          : o.progress;
        return s + oProgress;
      }, 0) / objectives.length)
    : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Strategic Planning</h1>
            <p className="text-sm text-muted-foreground">
              {objectives.length} objective{objectives.length !== 1 ? "s" : ""} · {keyResults.length} key result{keyResults.length !== 1 ? "s" : ""} · {(overallProgress / 100).toFixed(2)} overall
            </p>
          </div>
          <HelpButton page="strategy" />
        </div>
        <Button onClick={() => { setEditGoal(undefined); setShowForm(true); }} className="gap-2" data-testid="button-add-goal">
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {/* Overall progress */}
      {objectives.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3">
            <Progress value={overallProgress} className="flex-1 h-2.5" />
            <span className="text-sm font-semibold">{(overallProgress / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading goals...</div>
        ) : objectives.length === 0 && orphanKRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Target className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No objectives yet. Set your company's strategic goals.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {objectives.map(obj => (
              <ObjectiveCard
                key={obj.id}
                objective={obj}
                keyResults={keyResults.filter(kr => kr.parentGoalId === obj.id)}
                agents={agents}
                projects={projects}
                onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
                onDelete={setDeleteGoal}
                onLinkProject={handleLinkProject}
              />
            ))}

            {/* Orphan key results — always visible */}
            {orphanKRs.length > 0 && (
              <Card className="overflow-hidden border-orange-500/20">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    <h3 className="text-sm font-semibold text-orange-400">Unlinked Key Results</h3>
                    <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-400/30">{orphanKRs.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">These key results don't belong to any objective. Edit them to assign a parent.</p>
                  <div className="space-y-1.5">
                    {orphanKRs.map(kr => {
                      const krOwner = agents.find(a => a.id === kr.ownerId);
                      return (
                        <div key={kr.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 cursor-pointer group" onClick={() => { setEditGoal(kr); setShowForm(true); }}>
                          <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                          <span className="text-sm flex-1 truncate">{kr.title}</span>
                          <Progress value={kr.progress} className="w-20 h-1.5" />
                          <span className="text-xs">{(kr.progress / 100).toFixed(2)}</span>
                          {krOwner && <span className="text-xs">{krOwner.avatar}</span>}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDeleteGoal(kr); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditGoal(undefined); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGoal ? `Edit ${editGoal.title}` : "Add Goal"}</DialogTitle>
          </DialogHeader>
          <GoalForm goal={editGoal} goals={goals} agents={agents} onSave={handleSave} onClose={() => { setShowForm(false); setEditGoal(undefined); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGoal} onOpenChange={(o) => { if (!o) setDeleteGoal(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteGoal?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this goal and its progress data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteGoal && deleteMutation.mutate(deleteGoal.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
