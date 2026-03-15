import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, apiUrl } from "@/lib/utils";
import type { Agent, Project, AgentTask, Meeting, Goal } from "@shared/schema";
import { Link } from "wouter";
import {
  Plus, Trash2, Edit2, FolderKanban, ArrowRight, ArrowLeft,
  Loader2, Sparkles, CheckCircle2, Clock, Brain, XCircle,
  ChevronDown, ChevronRight, ListTodo, Lock, Milestone, CalendarDays, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpButton } from "@/components/help-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ProjectMilestone } from "@shared/schema";

interface MilestoneData {
  milestones: ProjectMilestone[];
}

function MilestoneTracker({ projectId }: { projectId: number }) {
  const { data } = useQuery<MilestoneData>({
    queryKey: ["/api/projects", projectId, "milestones"],
    queryFn: () => fetch(apiUrl(`/api/projects/${projectId}/milestones`)).then(r => r.json()),
  });

  const milestones = data?.milestones;
  if (!milestones || milestones.length === 0) return null;

  const completed = milestones.filter(m => m.status === "completed").length;

  return (
    <div className="mt-2 space-y-1" data-testid={`milestones-${projectId}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Milestone className="h-3 w-3" />
        <span>{completed}/{milestones.length} milestones</span>
      </div>
      <div className="flex gap-1">
        {milestones.map((m, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              m.status === "completed" ? "bg-green-500" :
              m.status === "overdue" ? "bg-red-500" : "bg-muted"
            }`}
            title={`${m.name} — ${m.status}${m.targetDate ? ` (${new Date(m.targetDate).toLocaleDateString()})` : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "hsl(var(--muted-foreground))" },
  { key: "in_progress", label: "In Progress", color: "hsl(var(--chart-4))" },
  { key: "completed", label: "Completed", color: "hsl(var(--chart-2))" },
];

// Sort: highest priority first, then oldest (first proposed) first within same priority
const PROJECT_PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
function sortProjectsByPriority(a: Project, b: Project) {
  const pa = PROJECT_PRIORITY_RANK[a.priority] ?? 2;
  const pb = PROJECT_PRIORITY_RANK[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  return a.id - b.id;
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "hsl(var(--chart-2))" },
  medium: { label: "Medium", color: "hsl(var(--chart-4))" },
  high: { label: "High", color: "hsl(var(--destructive))" },
};

const TASK_STATUS_ICON: Record<string, { icon: any; color: string }> = {
  pending: { icon: Clock, color: "text-muted-foreground" },
  thinking: { icon: Brain, color: "text-yellow-500" },
  proposal_ready: { icon: Sparkles, color: "text-blue-400" },
  executing: { icon: Loader2, color: "text-yellow-500" },
  completed: { icon: CheckCircle2, color: "text-green-400" },
  rejected: { icon: XCircle, color: "text-red-400" },
  blocked: { icon: Lock, color: "text-orange-400" },
};

function ProjectForm({ project, agents, onSave, onClose }: {
  project?: Project;
  agents: Agent[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [priority, setPriority] = useState(project?.priority || "medium");
  const [assignedAgentId, setAssignedAgentId] = useState<string>(project?.assignedAgentId?.toString() || "none");
  const [status, setStatus] = useState(project?.status || "backlog");

  return (
    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" data-testid="input-project-title" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done..." className="min-h-[80px]" data-testid="input-project-desc" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger data-testid="select-project-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-project-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Assigned To</Label>
          <Select value={assignedAgentId} onValueChange={setAssignedAgentId}>
            <SelectTrigger data-testid="select-project-agent"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSave({
            title, description, priority, status,
            assignedAgentId: assignedAgentId === "none" ? null : Number(assignedAgentId),
            createdAt: project?.createdAt || new Date().toISOString(),
          })}
          disabled={!title}
          data-testid="button-save-project"
        >
          {project ? "Update" : "Create"} Project
        </Button>
      </DialogFooter>
    </div>
  );
}

function ProjectTaskList({ projectId, agents }: { projectId: number; agents: Agent[] }) {
  const { data: tasks = [], isLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: () => fetch(apiUrl(`/api/projects/${projectId}/tasks`)).then(r => r.json()),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2">Loading tasks...</div>;
  }

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-1 mt-2">
      {tasks.map(task => {
        const statusCfg = TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.pending;
        const StatusIcon = statusCfg.icon;
        const agent = agents.find(a => a.id === task.assignedAgentId);
        const isSpinning = task.status === "thinking" || task.status === "executing";

        return (
          <div key={task.id} className="flex items-center gap-1.5 text-[11px] px-1.5 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors" data-testid={`project-task-${task.id}`}>
            <StatusIcon className={`h-3 w-3 shrink-0 ${statusCfg.color} ${isSpinning ? "animate-spin" : ""}`} />
            <span className="flex-1 truncate">{task.title}</span>
            {task.status === "blocked" && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 border-orange-400/30 text-orange-400">blocked</Badge>
            )}
            {agent && (
              <span className="text-muted-foreground shrink-0">{agent.avatar}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, agents, meetings, goals, onEdit, onDelete, onMove, onBreakdown, isBreakingDown }: {
  project: Project;
  agents: Agent[];
  meetings: Meeting[];
  goals: Goal[];
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: "left" | "right") => void;
  onBreakdown: () => void;
  isBreakingDown: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const agent = agents.find(a => a.id === project.assignedAgentId);
  const colIdx = COLUMNS.findIndex(c => c.key === project.status);
  const priority = PRIORITIES[project.priority] || PRIORITIES.medium;
  const hasTasks = (project.totalTasks ?? 0) > 0;
  const linkedGoal = goals.find(g => g.id === (project as any).goalId);

  return (
    <Card className="p-3 group hover:border-primary/30 transition-all" data-testid={`project-card-${project.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium truncate">{project.title}</h4>
            <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: priority.color, color: priority.color }}>
              {priority.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{project.description}</p>
          )}

          {/* Strategy linkage + Meeting source + View Tasks links */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {linkedGoal && (
              <Link href="/strategy">
                <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted gap-0.5 border-violet-500/40 text-violet-400">
                  <Target className="h-2.5 w-2.5" />
                  {linkedGoal.title.length > 30 ? linkedGoal.title.slice(0, 30) + "..." : linkedGoal.title}
                </Badge>
              </Link>
            )}
            {project.meetingId && (() => {
              const mtg = meetings.find(m => m.id === project.meetingId);
              return mtg ? (
                <Link href="/meetings">
                  <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted gap-0.5">
                    <CalendarDays className="h-2.5 w-2.5" />
                    From: {mtg.title}
                  </Badge>
                </Link>
              ) : null;
            })()}
            {hasTasks && (
              <Link href="/tasks">
                <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted gap-0.5">
                  <ListTodo className="h-2.5 w-2.5" />
                  View Tasks
                </Badge>
              </Link>
            )}
          </div>

          {/* Progress bar */}
          {hasTasks && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {project.completedTasks}/{project.totalTasks} tasks
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{project.progress}%</span>
              </div>
              <Progress value={project.progress ?? 0} className="h-1.5" />
            </div>
          )}

          {/* Milestone Tracker */}
          <MilestoneTracker projectId={project.id} />

          <div className="flex items-center gap-2 flex-wrap">
            {agent && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{agent.avatar}</span>
                <span className="text-xs text-muted-foreground">{agent.name}</span>
              </div>
            )}

            {/* AI Breakdown button */}
            {!hasTasks && project.status !== "completed" && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2"
                onClick={(e) => { e.stopPropagation(); onBreakdown(); }}
                disabled={isBreakingDown}
                data-testid={`button-breakdown-${project.id}`}
              >
                {isBreakingDown ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Break Down
              </Button>
            )}

            {/* Expand tasks toggle */}
            {hasTasks && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                data-testid={`toggle-tasks-${project.id}`}
              >
                <ListTodo className="h-3 w-3" />
                {expanded ? "Hide" : "Show"} tasks
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Expanded task list */}
          {expanded && hasTasks && (
            <ProjectTaskList projectId={project.id} agents={agents} />
          )}
        </div>

        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <div className="flex gap-0.5">
            {colIdx > 0 && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onMove("left")} title="Move left">
                <ArrowLeft className="h-3 w-3" />
              </Button>
            )}
            {colIdx < COLUMNS.length - 1 && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onMove("right")} title="Move right">
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [breakingDownId, setBreakingDownId] = useState<number | null>(null);
  // Mobile column collapse state: all expanded by default except completed
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({ completed: true });
  function toggleCol(key: string) {
    setCollapsedCols(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/projects", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/projects/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); setEditProject(undefined); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); },
  });

  const breakdownMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/projects/${id}/breakdown`).then(r => r.json()),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setBreakingDownId(null);
    },
    onError: () => {
      setBreakingDownId(null);
    },
  });

  function handleMove(project: Project, dir: "left" | "right") {
    const colIdx = COLUMNS.findIndex(c => c.key === project.status);
    const newIdx = dir === "left" ? colIdx - 1 : colIdx + 1;
    if (newIdx >= 0 && newIdx < COLUMNS.length) {
      updateMutation.mutate({ id: project.id, data: { status: COLUMNS[newIdx].key } });
    }
  }

  function handleSave(data: any) {
    if (editProject) {
      updateMutation.mutate({ id: editProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleBreakdown(id: number) {
    setBreakingDownId(id);
    breakdownMutation.mutate(id);
  }

  // Stats
  const inProgress = projects.filter(p => p.status === "in_progress").length;
  const completed = projects.filter(p => p.status === "completed").length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
              {inProgress > 0 ? ` · ${inProgress} in progress` : ""}
              {completed > 0 ? ` · ${completed} completed` : ""}
            </p>
          </div>
          <HelpButton page="projects" />
        </div>
        <Button onClick={() => { setEditProject(undefined); setShowForm(true); }} className="gap-2" data-testid="button-add-project">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <FolderKanban className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No projects yet. Create one or derive from a board meeting.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full md:min-h-[400px]">
            {COLUMNS.map(col => {
              const colProjects = projects.filter(p => p.status === col.key).sort(sortProjectsByPriority);
              const isCollapsed = !!collapsedCols[col.key];
              return (
                <div key={col.key} className="flex flex-col" data-testid={`kanban-column-${col.key}`}>
                  {/* Column header — tappable on mobile to collapse/expand */}
                  <button
                    onClick={() => toggleCol(col.key)}
                    className="flex items-center gap-2 mb-2 md:mb-3 px-2 py-1.5 md:py-0 rounded-lg md:rounded-none hover:bg-muted/30 md:hover:bg-transparent transition-colors w-full text-left"
                    data-testid={`toggle-column-${col.key}`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-medium">{col.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colProjects.length}</span>
                    {/* Chevron visible on mobile only */}
                    <span className="md:hidden">
                      {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </span>
                  </button>

                  {/* On mobile: collapsible. On desktop: always visible */}
                  <div className={`md:flex md:flex-col md:flex-1 ${
                    isCollapsed ? "hidden md:flex" : "flex flex-col"
                  }`}>
                    <div className="flex-1 space-y-2 bg-muted/30 rounded-lg p-2 min-h-0 md:min-h-[200px]">
                      {colProjects.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                          No projects
                        </div>
                      ) : colProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          agents={agents}
                          meetings={meetings}
                          goals={goals}
                          onEdit={() => { setEditProject(project); setShowForm(true); }}
                          onDelete={() => deleteMutation.mutate(project.id)}
                          onMove={(dir) => handleMove(project, dir)}
                          onBreakdown={() => handleBreakdown(project.id)}
                          isBreakingDown={breakingDownId === project.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditProject(undefined); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editProject ? "Edit Project" : "Add New Project"}</DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={editProject}
            agents={agents}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditProject(undefined); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
