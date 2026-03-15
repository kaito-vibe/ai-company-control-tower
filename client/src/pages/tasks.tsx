import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, AgentTask, Project, TaskComment, ApprovalStep, Meeting, ToolExecution, VerificationResult, Artifact } from "@shared/schema";
import { useLocation, Link } from "wouter";
import {
  Plus, Loader2, CheckCircle2, XCircle, Clock, Brain, ChevronDown, ChevronRight,
  RotateCcw, Send, Sparkles, UserPlus, Network, ListTodo, MessageSquare,
  FileText, Code, Palette, FileCheck, GitBranch, Users, ArrowRight, Zap,
  AlertTriangle, Target, FolderKanban, Forward, StopCircle, Trash2, Lock, Shield, UserCheck, RefreshCw,
  OctagonX, LayoutGrid, Columns3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedText } from "@/components/formatted-text";
import { useToast } from "@/hooks/use-toast";
import { HelpButton } from "@/components/help-button";

const TASK_TYPES = [
  { value: "hire_agent", label: "Hire Agent", icon: UserPlus, description: "Recruit a new team member" },
  { value: "propose_orgchart", label: "Org Chart", icon: Network, description: "Propose org structure" },
  { value: "delegate", label: "Delegate", icon: GitBranch, description: "Break into sub-tasks" },
  { value: "general", label: "General", icon: ListTodo, description: "Any task" },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-muted-foreground" },
  medium: { label: "Medium", color: "text-blue-400" },
  high: { label: "High", color: "text-orange-400" },
  urgent: { label: "Urgent", color: "text-red-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground", icon: Clock, bg: "bg-muted/30" },
  blocked: { label: "Blocked", color: "text-orange-400", icon: AlertTriangle, bg: "bg-orange-500/10" },
  thinking: { label: "Thinking...", color: "text-yellow-500", icon: Brain, bg: "bg-yellow-500/10" },
  proposal_ready: { label: "Proposal Ready", color: "text-blue-400", icon: Sparkles, bg: "bg-blue-500/10" },
  under_review: { label: "Under Review", color: "text-purple-400", icon: UserCheck, bg: "bg-purple-500/10" },
  approved: { label: "Approved", color: "text-green-400", icon: CheckCircle2, bg: "bg-green-500/10" },
  executing: { label: "Executing...", color: "text-yellow-500", icon: Loader2, bg: "bg-yellow-500/10" },
  completed: { label: "Completed", color: "text-green-400", icon: CheckCircle2, bg: "bg-green-500/10" },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" },
};

const DELIVERABLE_TYPES = [
  { value: "spec", label: "Spec", icon: FileCheck },
  { value: "document", label: "Document", icon: FileText },
  { value: "code", label: "Code", icon: Code },
  { value: "design", label: "Design", icon: Palette },
  { value: "report", label: "Report", icon: FileText },
];

const WORKFLOW_STAGES = ["design", "development", "testing", "review", "deploy"];

function NewTaskDialog({ agents, projects, open, onOpenChange }: {
  agents: Agent[];
  projects: Project[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [agentId, setAgentId] = useState<string>("");
  const [priority, setPriority] = useState("medium");
  const [projectId, setProjectId] = useState<string>("none");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
      setTitle(""); setDescription(""); setType("general"); setAgentId(""); setPriority("medium"); setProjectId("none");
    },
  });

  const defaultAgent = agents[0]?.id.toString() || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Task Type</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {TASK_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-all ${type === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                  data-testid={`tasktype-${t.value}`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assign To</Label>
              <Select value={agentId || defaultAgent} onValueChange={setAgentId}>
                <SelectTrigger data-testid="select-task-agent">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name} — {a.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-task-project">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "hire_agent" ? "Hire Head of HR" : type === "propose_orgchart" ? "Design org chart for digital products company" : type === "delegate" ? "Build online games portal" : "Task title..."}
              data-testid="input-task-title"
            />
          </div>
          <div>
            <Label>Instructions / Context</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "hire_agent" ? "We need a Head of HR to manage recruitment and company culture..." : type === "delegate" ? "Break this into sub-tasks and assign to the right team members..." : "Describe what you need done..."}
              className="min-h-[100px]"
              data-testid="input-task-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({
              title,
              description,
              assignedAgentId: Number(agentId || defaultAgent),
              type,
              priority,
              projectId: projectId !== "none" ? Number(projectId) : null,
              status: "pending",
              createdAt: new Date().toISOString(),
            })}
            disabled={!title || !description || createMutation.isPending}
            data-testid="button-create-task"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Assign Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposedAgentCard({ agent }: { agent: any }) {
  return (
    <Card className="p-3 border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${agent.color || "#4F98A3"}20` }}>
          {agent.avatar || "🧠"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{agent.name}</span>
            <Badge variant="outline" className="text-xs">{agent.role}</Badge>
            <span className="text-xs text-muted-foreground">{agent.department}</span>
          </div>
          {agent.skills && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {agent.skills.map((s: string, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
              ))}
            </div>
          )}
          {agent.rationale && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{agent.rationale}</p>
          )}
          {agent.instructions && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View persona</summary>
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/30 rounded p-2">{agent.instructions}</p>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

function DeliverableCard({ deliverable, agents }: { deliverable: any; agents: Agent[] }) {
  const [expanded, setExpanded] = useState(false);
  const agent = agents.find(a => a.id === deliverable.producedBy);
  const typeIcons: Record<string, any> = { spec: FileCheck, document: FileText, code: Code, design: Palette, report: FileText };
  const Icon = typeIcons[deliverable.type] || FileText;

  return (
    <Card className="p-2.5 border-border/50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium flex-1 truncate">{deliverable.title}</span>
        <Badge variant="outline" className="text-[10px]">{deliverable.type}</Badge>
        {agent && <span className="text-[10px] text-muted-foreground">{agent.avatar} {agent.name}</span>}
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </div>
      {expanded && (
        <div className="mt-2 bg-muted/30 rounded p-2.5 text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto font-mono leading-relaxed">
          {deliverable.content}
        </div>
      )}
    </Card>
  );
}

function DiscussionThread({ task, agents }: { task: AgentTask; agents: Agent[] }) {
  const thread: any[] = task.discussionThread ? JSON.parse(task.discussionThread) : [];
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const discussMutation = useMutation({
    mutationFn: (data: { agentId: number; messageType: string }) =>
      apiRequest("POST", `/api/tasks/${task.id}/discuss`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" />
          Agent Discussion ({thread.length})
        </p>
        <div className="flex gap-1.5">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-7 text-xs w-[140px]">
              <SelectValue placeholder="Add agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => selectedAgent && discussMutation.mutate({ agentId: Number(selectedAgent), messageType: "comment" })}
            disabled={!selectedAgent || discussMutation.isPending}
            data-testid="button-add-discussion"
          >
            {discussMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
            Ask
          </Button>
        </div>
      </div>
      {thread.length > 0 && (
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {thread.map((msg: any, i: number) => {
            const a = agents.find(ag => ag.id === msg.agentId);
            return (
              <div key={i} className="flex gap-2 text-xs">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                  style={{ backgroundColor: `${a?.color || "#666"}20` }}>
                  {a?.avatar || "🧠"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{msg.agentName}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{msg.type}</Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowUpDialog({ task, agents, allTasks, open, onOpenChange }: {
  task: AgentTask;
  agents: Agent[];
  allTasks: AgentTask[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [, navigate] = useLocation();

  // Build rich context from completed task + sub-tasks + deliverables
  const subTasks = allTasks.filter(t => t.parentTaskId === task.id);
  const completedSubs = subTasks.filter(s => s.status === 'completed');

  // Extract structured role info from each sub-task's deliverables
  const roleDetails: { title: string; designSpec: string; reviewSummary: string }[] = [];
  for (const sub of completedSubs) {
    let designSpec = "";
    let reviewSummary = "";
    if (sub.deliverables) {
      try {
        const delivs = JSON.parse(sub.deliverables);
        // Design phase = first deliverable (the spec/JD), Review phase = 4th
        const design = delivs.find((d: any) => d.type === 'spec' || d.title?.toLowerCase().includes('design'));
        const review = delivs.find((d: any) => d.title?.toLowerCase().includes('review'));
        if (design?.content) designSpec = design.content.slice(0, 600);
        if (review?.content) reviewSummary = review.content.slice(0, 300);
      } catch {}
    }
    // Fallback: use execution log if no deliverables
    if (!designSpec && sub.executionLog) {
      const designMatch = sub.executionLog.match(/\[DESIGN\]\s*([\s\S]*?)(?=---\s*\[|$)/);
      if (designMatch) designSpec = designMatch[1].trim().slice(0, 600);
    }
    roleDetails.push({ title: sub.title, designSpec, reviewSummary });
  }

  // Detect if this is a role/JD follow-up
  const allText = task.title + " " + task.description + " " + subTasks.map(s => s.title).join(" ");
  const isHireRelated = /role description|hiring bar|recruit|hire|JD/i.test(allText);

  // Build the context description
  let contextSummary: string;
  if (isHireRelated && roleDetails.length > 0) {
    // Smart hiring context: list each role with its spec summary
    const parts: string[] = [
      `Based on the completed task "${task.title}", the following ${roleDetails.length} role descriptions and hiring bars have been finalized. Proceed to hire agents for each role.`,
      ``,
    ];
    for (let i = 0; i < roleDetails.length; i++) {
      const r = roleDetails[i];
      parts.push(`=== ROLE ${i + 1}: ${r.title.replace(/^Draft\s+/i, '').replace(/\s+role description.*$/i, '')} ===`);
      if (r.designSpec) parts.push(r.designSpec);
      if (r.reviewSummary) parts.push(`Review notes: ${r.reviewSummary}`);
      parts.push(``);
    }
    parts.push(`Instructions: For each role above, hire an agent with the right persona, skills, and instructions matching the role description and hiring bar. Ensure reporting lines are set correctly.`);
    contextSummary = parts.join("\n");
  } else {
    // Generic follow-up: include sub-task outcomes
    const parts: string[] = [
      `Previous task: "${task.title}"`,
      task.description ? `Context: ${task.description}` : "",
    ];
    if (task.executionLog) {
      parts.push(`Outcome: ${task.executionLog.slice(0, 300)}`);
    }
    if (completedSubs.length > 0) {
      parts.push(`\n--- Sub-task Results (${completedSubs.length}/${subTasks.length}) ---`);
      for (const sub of completedSubs) {
        const assignee = agents.find(a => a.id === sub.assignedAgentId);
        parts.push(`\n[${assignee?.name || 'Agent'}] "${sub.title}"`);
        if (sub.executionLog) parts.push(`Result: ${sub.executionLog.slice(0, 200)}`);
        if (sub.deliverables) {
          try {
            const delivs = JSON.parse(sub.deliverables);
            for (const d of delivs) {
              parts.push(`Deliverable (${d.type || 'doc'}): ${d.title || 'Untitled'} — ${(d.content || '').slice(0, 200)}`);
            }
          } catch {}
        }
      }
    }
    if (task.deliverables) {
      try {
        const delivs = JSON.parse(task.deliverables);
        if (delivs.length > 0) {
          parts.push(`\n--- Parent Deliverables ---`);
          for (const d of delivs) {
            parts.push(`[${d.type || 'doc'}] ${d.title}: ${(d.content || '').slice(0, 200)}`);
          }
        }
      } catch {}
    }
    contextSummary = parts.filter(Boolean).join("\n");
  }

  // Infer defaults
  const defaultTaskTitle = isHireRelated && roleDetails.length > 0
    ? `Hire ${roleDetails.length} roles: ${roleDetails.slice(0, 3).map(r => r.title.replace(/^Draft\s+/i, '').replace(/\s+role description.*$/i, '').replace(/\s+&.*$/, '')).join(', ')}${roleDetails.length > 3 ? '...' : ''}`
    : `Follow-up on "${task.title}"`;
  // Use delegate for hiring multiple roles so the agent can create sub-tasks per role
  const defaultTaskType = isHireRelated && roleDetails.length > 1 ? "delegate" : isHireRelated ? "hire_agent" : "delegate";
  const defaultMeetingTopic = `Follow-up: Discuss outcomes and next steps from "${task.title}"${subTasks.length > 0 ? ` (${subTasks.length} sub-tasks completed)` : ''}`;

  // Follow-up task state
  const [taskTitle, setTaskTitle] = useState(defaultTaskTitle);
  const [taskDesc, setTaskDesc] = useState(contextSummary);
  const [taskType, setTaskType] = useState(defaultTaskType);
  const [taskAgentId, setTaskAgentId] = useState(task.assignedAgentId.toString());
  const [taskPriority, setTaskPriority] = useState(task.priority || "high");

  // Follow-up meeting state
  const [meetingTitle, setMeetingTitle] = useState(`Follow-up: ${task.title}`);
  const [meetingTopic, setMeetingTopic] = useState(defaultMeetingTopic);
  const [selectedAgents, setSelectedAgents] = useState<number[]>(agents.map(a => a.id));

  function toggleAgent(id: number) {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/meetings", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      onOpenChange(false);
      navigate("/meetings");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4 text-primary" />
            Follow-up Action
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Create a follow-up task or meeting based on the completed work.</p>
        </DialogHeader>

        <Tabs defaultValue="task" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="task" className="flex-1 gap-1.5" data-testid="followup-tab-task">
              <ListTodo className="h-3.5 w-3.5" />
              New Task
            </TabsTrigger>
            <TabsTrigger value="meeting" className="flex-1 gap-1.5" data-testid="followup-tab-meeting">
              <MessageSquare className="h-3.5 w-3.5" />
              New Meeting
            </TabsTrigger>
          </TabsList>

          {/* --- Follow-up Task --- */}
          <TabsContent value="task" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Task Type</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {TASK_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTaskType(t.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] transition-all ${taskType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Assign To</Label>
                <Select value={taskAgentId} onValueChange={setTaskAgentId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="h-8 text-xs"
                data-testid="followup-task-title"
              />
            </div>
            <div>
              <Label className="text-xs">Context (from completed task)</Label>
              <Textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="min-h-[80px] text-xs"
                data-testid="followup-task-desc"
              />
            </div>
            <Button
              className="w-full gap-1.5"
              onClick={() => createTaskMutation.mutate({
                title: taskTitle,
                description: taskDesc,
                assignedAgentId: Number(taskAgentId),
                type: taskType,
                priority: taskPriority,
                status: "pending",
                createdAt: new Date().toISOString(),
              })}
              disabled={!taskTitle || createTaskMutation.isPending}
              data-testid="followup-create-task"
            >
              {createTaskMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Create Follow-up Task
            </Button>
          </TabsContent>

          {/* --- Follow-up Meeting --- */}
          <TabsContent value="meeting" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Meeting Title</Label>
              <Input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="h-8 text-xs"
                data-testid="followup-meeting-title"
              />
            </div>
            <div>
              <Label className="text-xs">Topic / Agenda</Label>
              <Textarea
                value={meetingTopic}
                onChange={(e) => setMeetingTopic(e.target.value)}
                className="min-h-[80px] text-xs"
                data-testid="followup-meeting-topic"
              />
            </div>
            <div>
              <Label className="text-xs">Invite Agents</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-[150px] overflow-y-auto">
                {agents.map(agent => (
                  <label key={agent.id} className="flex items-center gap-2 p-1.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={selectedAgents.includes(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <span className="text-xs">{agent.avatar} {agent.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{agent.role}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              className="w-full gap-1.5"
              onClick={() => createMeetingMutation.mutate({
                title: meetingTitle,
                topic: meetingTopic,
                status: "active",
                agentIds: selectedAgents,
                createdAt: new Date().toISOString(),
              })}
              disabled={!meetingTitle || selectedAgents.length === 0 || createMeetingMutation.isPending}
              data-testid="followup-create-meeting"
            >
              {createMeetingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              Call Follow-up Meeting
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CompletedTaskView({ task }: { task: AgentTask }) {
  const [showLog, setShowLog] = useState(false);

  // Parse execution log into stages
  const logSections: { stage: string; content: string }[] = [];
  if (task.executionLog) {
    const parts = task.executionLog.split(/---/);
    for (const part of parts) {
      const match = part.trim().match(/^\[(DESIGN|DEVELOPMENT|TESTING|REVIEW|DEPLOY)\]\s*/i);
      if (match) {
        logSections.push({
          stage: match[1].toLowerCase(),
          content: part.trim().replace(/^\[\w+\]\s*/, ""),
        });
      }
    }
  }

  const stageIcons: Record<string, any> = {
    design: Palette,
    development: Code,
    testing: Target,
    review: FileCheck,
    deploy: Zap,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">Pipeline complete</span>
        {task.completedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Stage summary pills */}
      {logSections.length > 0 && (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowLog(!showLog); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showLog ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span>{logSections.length} pipeline stages completed</span>
          </button>
          {showLog && (
            <div className="mt-2 space-y-2">
              {logSections.map((section, i) => {
                const Icon = stageIcons[section.stage] || FileText;
                return (
                  <div key={i} className="bg-muted/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold capitalize text-primary">{section.stage}</span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                      {section.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Simple log for non-pipeline tasks */}
      {logSections.length === 0 && task.executionLog && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm whitespace-pre-wrap">
          {task.executionLog}
        </div>
      )}
    </div>
  );
}

function SubTaskCard({ task, agents, allTasks, projects }: { task: AgentTask; agents: Agent[]; allTasks: AgentTask[]; projects: Project[] }) {
  const [expanded, setExpanded] = useState(task.status === "proposal_ready");
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const agent = agents.find(a => a.id === task.assignedAgentId);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/approve`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); queryClient.invalidateQueries({ queryKey: ["/api/agents"] }); },
  });
  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/reject`, {}).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); },
  });
  const reviseMutation = useMutation({
    mutationFn: (fb: string) => apiRequest("POST", `/api/tasks/${task.id}/reject`, { feedback: fb }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); setShowFeedback(false); setFeedback(""); },
  });

  const isLoading = approveMutation.isPending || rejectMutation.isPending || reviseMutation.isPending || task.status === "thinking";

  return (
    <div
      className={`rounded-lg border transition-all ${
        task.status === 'proposal_ready' ? 'border-blue-500/30 bg-blue-500/5' :
        task.status === 'completed' ? 'border-green-500/20 bg-green-500/5 opacity-70' :
        task.status === 'rejected' ? 'border-red-500/20 opacity-50' :
        'border-border/40 bg-muted/10'
      }`}
      data-testid={`subtask-card-${task.id}`}
    >
      {/* Compact header */}
      <div className="flex items-center gap-2 p-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusCfg.color} ${task.status === 'thinking' || task.status === 'executing' || task.status === 'under_review' ? 'animate-spin' : ''}`} />
        <span className="text-xs font-medium flex-1 truncate">{task.title}</span>
        {agent && <span className="text-[10px] text-muted-foreground shrink-0">{agent.avatar} {agent.name}</span>}
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusCfg.color}`}>{statusCfg.label}</Badge>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30">
          {/* Proposal */}
          {task.status === "proposal_ready" && task.proposal && (
            <div className="mt-2">
              <div className="bg-muted/30 rounded p-2 max-h-[180px] overflow-y-auto">
                <FormattedText text={task.proposal} />
              </div>
              {/* Approve / Revise / Reject */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); approveMutation.mutate(); }}
                  disabled={isLoading}
                  className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                  data-testid={`button-subtask-approve-${task.id}`}
                >
                  {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowFeedback(!showFeedback); }}
                  disabled={isLoading}
                  className="gap-1 h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Revise
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(); }}
                  disabled={isLoading}
                  className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
                >
                  <XCircle className="h-3 w-3" />
                  Reject
                </Button>
              </div>
              {showFeedback && (
                <div className="flex gap-1.5 mt-1.5">
                  <Input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell the agent what to change..."
                    className="flex-1 h-7 text-xs"
                    onKeyDown={(e) => { if (e.key === "Enter" && feedback.trim()) reviseMutation.mutate(feedback); }}
                  />
                  <Button
                    size="sm"
                    onClick={() => reviseMutation.mutate(feedback)}
                    disabled={!feedback.trim() || reviseMutation.isPending}
                    className="h-7"
                  >
                    {reviseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Thinking state */}
          {task.status === "thinking" && (
            <div className="flex items-center gap-2 text-xs text-yellow-500 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {agent?.name} is thinking...
            </div>
          )}

          {/* Under review by manager */}
          {task.status === "under_review" && (
            <div className="flex items-center gap-2 text-xs text-purple-400 mt-2">
              <UserCheck className="h-3 w-3 animate-spin" />
              Manager reviewing...
            </div>
          )}

          {/* Completed */}
          {task.status === "completed" && task.executionLog && (
            <div className="mt-2">
              <FormattedText text={task.executionLog} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, agents, allTasks, projects, meetings }: { task: AgentTask; agents: Agent[]; allTasks: AgentTask[]; projects: Project[]; meetings: Meeting[] }) {
  const [expanded, setExpanded] = useState(task.status === "proposal_ready");
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [deliverableType, setDeliverableType] = useState("spec");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const { toast } = useToast();

  const agent = agents.find(a => a.id === task.assignedAgentId);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = statusCfg.icon;
  const taskType = TASK_TYPES.find(t => t.value === task.type);

  // Parse nested data
  let proposedAgents: any[] = [];
  let approvalChain: ApprovalStep[] = [];
  if (task.proposedActions) {
    try {
      const parsed = JSON.parse(task.proposedActions);
      if (Array.isArray(parsed)) {
        proposedAgents = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (parsed.approvalChain) approvalChain = parsed.approvalChain;
        if (parsed.actions) proposedAgents = parsed.actions;
      }
    } catch {}
  }
  let deliverables: any[] = [];
  if (task.deliverables) {
    try { deliverables = JSON.parse(task.deliverables); } catch {}
  }

  const subTasks = allTasks.filter(t => t.parentTaskId === task.id);

  // Fetch verification results for this task
  const { data: verificationResults = [] } = useQuery<VerificationResult[]>({
    queryKey: [`/api/tasks/${task.id}/verification`],
    enabled: expanded,
  });

  // Fetch tool executions for this task
  const { data: toolExecutions = [] } = useQuery<ToolExecution[]>({
    queryKey: [`/api/tasks/${task.id}/tool-executions`],
    enabled: expanded,
  });

  // Fetch artifacts for this task
  const { data: taskArtifacts = [] } = useQuery<Artifact[]>({
    queryKey: [`/api/artifacts/by-task/${task.id}`],
    enabled: expanded,
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/approve`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Task approved", description: `"${task.title}" has been approved and is now executing.` });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/reject`, { feedback: "" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task rejected", description: `"${task.title}" has been rejected.` });
    },
  });

  const reviseMutation = useMutation({
    mutationFn: (fb: string) => apiRequest("POST", `/api/tasks/${task.id}/revise`, { feedback: fb }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setFeedback("");
      setShowFeedback(false);
    },
  });

  const deliverableMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tasks/${task.id}/generate-deliverable`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowDeliverableForm(false);
      setDeliverableTitle("");
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/approve-all`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/cancel`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task cancelled", description: `"${task.title}" has been cancelled.` });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/retry`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task retrying", description: `"${task.title}" has been reset and is thinking again.` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted", description: `"${task.title}" has been permanently deleted.` });
    },
  });

  const isLoading = approveMutation.isPending || rejectMutation.isPending || reviseMutation.isPending || approveAllMutation.isPending || cancelMutation.isPending || retryMutation.isPending || deleteMutation.isPending || task.status === "thinking" || task.status === "executing" || task.status === "under_review";

  return (
    <Card className={`overflow-hidden transition-all ${task.status === "proposal_ready" ? "border-blue-500/30 shadow-[0_0_12px_-4px_rgba(59,130,246,0.2)]" : task.status === "under_review" ? "border-purple-500/30 shadow-[0_0_12px_-4px_rgba(147,51,234,0.2)]" : task.status === "completed" ? "border-green-500/20 opacity-80" : task.status === "rejected" ? "border-red-500/20 opacity-60" : ""}`} data-testid={`task-card-${task.id}`}>
      {/* Header */}
      <div className="p-3.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 relative">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
            ) : task.status === "blocked" ? (
              <Lock className="h-4 w-4 text-orange-400" />
            ) : (
              <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm">{task.title}</h3>
              {taskType && (
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  {taskType.icon && <taskType.icon className="h-2.5 w-2.5" />}
                  {taskType.label}
                </Badge>
              )}
              <Badge variant="secondary" className={`text-[10px] ${statusCfg.color}`}>
                {isLoading && task.status === "thinking" ? "Thinking..." : statusCfg.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${priorityCfg.color}`}>
                {priorityCfg.label}
              </Badge>
              {task.workflowStage && (
                <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-400/30">
                  {task.workflowStage}
                </Badge>
              )}
              {task.parentTaskId && (
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-400/30 gap-0.5">
                  <GitBranch className="h-2.5 w-2.5" />
                  Sub-task
                </Badge>
              )}
              {approvalChain.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30 gap-0.5">
                  <Shield className="h-2.5 w-2.5" />
                  {approvalChain.filter(s => s.status === "approved").length}/{approvalChain.length} approved
                </Badge>
              )}
              {verificationResults.length > 0 && (() => {
                const latest = verificationResults[verificationResults.length - 1];
                const passed = latest.passed;
                return (
                  <Badge variant="outline" className={`text-[10px] gap-0.5 ${passed ? "text-green-400 border-green-500/30" : "text-orange-400 border-orange-500/30"}`}>
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {passed ? "Verified" : `Score: ${((latest.score || 0) * 100).toFixed(0)}%`}
                  </Badge>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {agent && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {agent.avatar} {agent.name}
                </span>
              )}
              {subTasks.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {subTasks.length} sub-task{subTasks.length > 1 ? "s" : ""}
                </span>
              )}
              {deliverables.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {deliverables.length} deliverable{deliverables.length > 1 ? "s" : ""}
                </span>
              )}
              {task.projectId && (() => {
                const proj = projects.find(p => p.id === task.projectId);
                return proj ? (
                  <Link href="/projects">
                    <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted gap-0.5">
                      <FolderKanban className="h-2.5 w-2.5" />
                      {proj.title}
                    </Badge>
                  </Link>
                ) : null;
              })()}
              {task.meetingId && (() => {
                const mtg = meetings.find(m => m.id === task.meetingId);
                return mtg ? (
                  <Link href="/meetings">
                    <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted gap-0.5">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {mtg.title}
                    </Badge>
                  </Link>
                ) : null;
              })()}
              {task.parentTaskId && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Sub-task
                </span>
              )}
              {task.dependsOn && (() => {
                try {
                  const deps: number[] = JSON.parse(task.dependsOn);
                  const depNames = deps.map(d => allTasks.find(t => t.id === d)?.title || `#${d}`).join(", ");
                  const allDone = deps.every(d => { const dt = allTasks.find(t => t.id === d); return dt?.status === "completed"; });
                  return (
                    <span className={`text-xs flex items-center gap-1 ${allDone ? "text-green-400/70" : "text-orange-400/70"}`} title={`Dependencies: ${depNames}`}>
                      {allDone ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {allDone ? "Deps complete" : `Blocked by: ${depNames}`}
                    </span>
                  );
                } catch { return null; }
              })()}
              <span className="text-xs text-muted-foreground">
                {task.createdAt ? new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3">
          <Separator />

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Instructions</p>
            {task.description && task.description.length > 280 ? (
              <div>
                <p className="text-sm whitespace-pre-wrap">
                  {descExpanded ? task.description : task.description.slice(0, 280).trimEnd() + "..."}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setDescExpanded(!descExpanded); }}
                  className="text-xs text-primary hover:text-primary/80 mt-1 font-medium transition-colors"
                  data-testid="button-read-more"
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            )}
          </div>

          {/* Workflow stage bar */}
          {task.workflowStage && (
            <div className="space-y-1.5">
              <div className="flex gap-0.5">
                {WORKFLOW_STAGES.map(stage => {
                  const allDone = task.status === "completed";
                  const currentIdx = WORKFLOW_STAGES.indexOf(task.workflowStage!);
                  const stageIdx = WORKFLOW_STAGES.indexOf(stage);
                  const isActive = !allDone && stage === task.workflowStage;
                  const isDone = allDone || stageIdx < currentIdx;
                  return (
                    <div key={stage} className={`flex-1 h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : isActive && task.status === "executing" ? "bg-primary animate-pulse" : isActive ? "bg-primary" : isDone ? "bg-primary/40" : "bg-muted"}`} title={stage} />
                  );
                })}
              </div>
              <div className="flex justify-between">
                {WORKFLOW_STAGES.map(stage => {
                  const allDone = task.status === "completed";
                  const isActive = !allDone && stage === task.workflowStage;
                  return (
                    <span key={stage} className={`text-[9px] capitalize ${allDone ? "text-green-400" : isActive ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>
                      {stage}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Blocked state info */}
          {task.status === "blocked" && task.dependsOn && (
            <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">Blocked</span>
                <span className="text-orange-400/70 ml-1">
                  — waiting for {(() => {
                    try {
                      const deps: number[] = JSON.parse(task.dependsOn!);
                      return deps.map(d => {
                        const dt = allTasks.find(t => t.id === d);
                        return dt ? `"${dt.title}"` : `task #${d}`;
                      }).join(" and ");
                    } catch { return "dependencies"; }
                  })()} to complete
                </span>
              </div>
            </div>
          )}

          {/* Pending state — auto-thinking will start soon */}
          {task.status === "pending" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Queued — will start thinking shortly...
            </div>
          )}

          {/* Executing state — pipeline running through stages OR waiting on sub-tasks */}
          {task.status === "executing" && (
            <div className="space-y-2">
              {subTasks.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <GitBranch className="h-4 w-4" />
                    Waiting on {subTasks.filter(s => !['completed','rejected'].includes(s.status)).length} of {subTasks.length} sub-tasks
                  </div>
                  <div className="flex gap-1">
                    {subTasks.map(s => (
                      <div
                        key={s.id}
                        className={`flex-1 h-1.5 rounded-full transition-all ${
                          s.status === 'completed' ? 'bg-green-500' :
                          s.status === 'rejected' ? 'bg-red-500' :
                          ['thinking','proposal_ready','executing','under_review'].includes(s.status) ? 'bg-yellow-500 animate-pulse' :
                          'bg-muted'
                        }`}
                        title={`${s.title} (${s.status})`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-yellow-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {agent?.name} is executing{task.workflowStage ? ` — ${task.workflowStage} phase` : ""}…
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                data-testid="button-task-cancel"
              >
                {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                Cancel Execution
              </Button>
            </div>
          )}

          {/* Thinking state — also allow cancel */}
          {task.status === "thinking" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {agent?.name} is thinking...
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(); }}
                disabled={cancelMutation.isPending}
                className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                data-testid="button-task-cancel-thinking"
              >
                {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                Cancel
              </Button>
            </div>
          )}

          {/* Under review by manager */}
          {task.status === "under_review" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <UserCheck className="h-4 w-4 animate-spin" />
                Manager is reviewing {agent?.name}'s proposal...
              </div>
              {task.proposal && (
                <div className="bg-muted/30 rounded-lg p-3 max-h-[200px] overflow-y-auto opacity-70">
                  <FormattedText text={task.proposal} />
                </div>
              )}
            </div>
          )}

          {/* Proposal display */}
          {task.status === "proposal_ready" && task.proposal && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{agent?.name}'s Proposal</p>
                  {task.executionLog?.includes("Reviewed by") && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-purple-400 border-purple-500/30">
                      <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                      Manager Reviewed
                    </Badge>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 max-h-[250px] overflow-y-auto">
                  <FormattedText text={task.proposal} />
                </div>
              </div>

              {/* Proposed agents preview */}
              {proposedAgents.length > 0 && proposedAgents[0]?.name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Proposed {proposedAgents.length === 1 ? "Hire" : `Hires (${proposedAgents.length})`}
                  </p>
                  <div className="space-y-2">
                    {proposedAgents.filter(pa => pa.name).map((pa: any, i: number) => (
                      <ProposedAgentCard key={i} agent={pa} />
                    ))}
                  </div>
                </div>
              )}

              {/* Delegation preview */}
              {proposedAgents.length > 0 && proposedAgents[0]?.assignToAgentId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Delegated Sub-tasks ({proposedAgents.length})
                  </p>
                  <div className="space-y-1.5">
                    {proposedAgents.map((sub: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded-lg">
                        <GitBranch className="h-3 w-3 text-primary shrink-0" />
                        <span className="font-medium flex-1">{sub.title}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{sub.assignToAgentName || `Agent ${sub.assignToAgentId}`}</span>
                        {sub.priority && <Badge variant="outline" className={`text-[9px] ${PRIORITY_CONFIG[sub.priority]?.color}`}>{sub.priority}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval buttons */}
              <div className="flex gap-2 pt-1 flex-wrap">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); approveMutation.mutate(); }}
                  disabled={isLoading}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                  data-testid="button-task-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve{proposedAgents.length > 0 && proposedAgents[0]?.name ? ` & Hire` : proposedAgents[0]?.assignToAgentId ? " & Delegate" : ""}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowFeedback(!showFeedback); }}
                  disabled={isLoading}
                  className="gap-1.5"
                  data-testid="button-task-revise-toggle"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revise
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(); }}
                  disabled={isLoading}
                  className="gap-1.5 text-destructive hover:text-destructive"
                  data-testid="button-task-reject"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>

              {/* Feedback input for revision */}
              {showFeedback && (
                <div className="flex gap-2">
                  <Input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell the agent what to change..."
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && feedback.trim()) reviseMutation.mutate(feedback); }}
                    data-testid="input-task-feedback"
                  />
                  <Button
                    size="sm"
                    onClick={() => reviseMutation.mutate(feedback)}
                    disabled={!feedback.trim() || reviseMutation.isPending}
                    data-testid="button-task-revise-submit"
                  >
                    {reviseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Completed state */}
          {task.status === "completed" && (
            <div className="space-y-3">
              <CompletedTaskView task={task} />
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowFollowUp(true); }}
                className="gap-1.5 text-xs"
                data-testid="button-follow-up"
              >
                <Forward className="h-3.5 w-3.5" />
                Follow-up
              </Button>
            </div>
          )}

          {/* Rejected state */}
          {task.status === "rejected" && (
            <div className="space-y-2">
              {task.executionLog && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {task.executionLog}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); retryMutation.mutate(); }}
                disabled={retryMutation.isPending}
                className="gap-1.5 text-xs"
                data-testid="button-task-retry"
              >
                {retryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Retry
              </Button>
            </div>
          )}

          {/* Sub-tasks — nested with expand/collapse and inline actions */}
          {subTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" />
                  Sub-tasks ({subTasks.filter(s => s.status === 'completed').length}/{subTasks.length} done)
                </p>
                {subTasks.filter(s => s.status === 'proposal_ready').length > 0 && (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); approveAllMutation.mutate(); }}
                    disabled={approveAllMutation.isPending}
                    className="gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700"
                    data-testid="button-approve-all-subtasks"
                  >
                    {approveAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Approve All ({subTasks.filter(s => s.status === 'proposal_ready').length})
                  </Button>
                )}
              </div>
              <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                {subTasks.sort(sortByPriorityThenOldest).map(sub => (
                  <SubTaskCard key={sub.id} task={sub} agents={agents} allTasks={allTasks} projects={projects} />
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Deliverables ({deliverables.length})
              </p>
              <div className="space-y-1.5">
                {deliverables.map((d: any, i: number) => (
                  <DeliverableCard key={i} deliverable={d} agents={agents} />
                ))}
              </div>
            </div>
          )}

          {/* Tool Executions */}
          {toolExecutions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Tool Executions ({toolExecutions.length})
              </p>
              <div className="space-y-1.5">
                {toolExecutions.map((te: ToolExecution) => (
                  <div key={te.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                    <Badge variant="outline" className={`text-[9px] ${te.success ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                      {te.success ? "OK" : "FAIL"}
                    </Badge>
                    <span className="font-mono text-[11px]">{te.toolName}</span>
                    {te.durationMs && <span className="text-muted-foreground">{te.durationMs}ms</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts */}
          {taskArtifacts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Artifacts ({taskArtifacts.length})
              </p>
              <div className="space-y-1.5">
                {taskArtifacts.map((a: Artifact) => (
                  <Card key={a.id} className="p-2 border-primary/10">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">{a.type}</Badge>
                      <span className="text-xs font-medium">{a.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">v{a.version}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Verification Results */}
          {verificationResults.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Quality Checks ({verificationResults.length})
              </p>
              <div className="space-y-1.5">
                {verificationResults.map((v: VerificationResult) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      v.passed ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                    }`}>
                      {v.passed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    </div>
                    <span className="capitalize">{v.type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">Score: {((v.score || 0) * 100).toFixed(0)}%</span>
                    {v.feedback && <span className="text-muted-foreground truncate max-w-[200px]">{v.feedback}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Chain */}
          {approvalChain.length > 0 && (
            <div data-testid={`approval-chain-${task.id}`}>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Approval Chain ({approvalChain.filter(s => s.status === "approved").length}/{approvalChain.length})
              </p>
              <div className="flex items-center gap-1 mb-2">
                {approvalChain.map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                        step.status === "approved"
                          ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                          : step.status === "rejected"
                            ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                            : "bg-muted text-muted-foreground"
                      }`}
                      title={`${step.approverName}: ${step.status}`}
                      data-testid={`approval-step-${task.id}-${i}`}
                    >
                      {step.status === "approved" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : step.status === "rejected" ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < approvalChain.length - 1 && (
                      <div className={`w-4 h-0.5 ${step.status === "approved" ? "bg-green-500/40" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {approvalChain.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${
                      step.status === "approved" ? "text-green-400" : step.status === "rejected" ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {step.approverName}
                    </span>
                    <Badge variant="outline" className={`text-[9px] ${
                      step.status === "approved" ? "text-green-400 border-green-500/30" : step.status === "rejected" ? "text-red-400 border-red-500/30" : ""
                    }`}>
                      {step.status}
                    </Badge>
                    {step.timestamp && (
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(step.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate deliverable button */}
          {!["rejected", "pending"].includes(task.status) && (
            <div>
              {!showDeliverableForm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowDeliverableForm(true); }}
                  className="gap-1.5 text-xs"
                >
                  <Zap className="h-3 w-3" />
                  Generate Deliverable
                </Button>
              ) : (
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[120px]">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={deliverableTitle}
                      onChange={(e) => setDeliverableTitle(e.target.value)}
                      placeholder="e.g. Technical Spec"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-[120px]">
                    <Label className="text-xs">Type</Label>
                    <Select value={deliverableType} onValueChange={setDeliverableType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERABLE_TYPES.map(dt => (
                          <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => deliverableMutation.mutate({
                      agentId: task.assignedAgentId,
                      deliverableType,
                      title: deliverableTitle,
                    })}
                    disabled={deliverableMutation.isPending}
                  >
                    {deliverableMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowDeliverableForm(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Agent Discussion */}
          {!["pending", "rejected"].includes(task.status) && agents.length > 1 && (
            <DiscussionThread task={task} agents={agents} />
          )}

          {/* Delete task */}
          <Separator />
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                  disabled={deleteMutation.isPending}
                  data-testid={`button-task-delete-${task.id}`}
                >
                  {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{task.title}"{subTasks.length > 0 ? ` and its ${subTasks.length} sub-task${subTasks.length > 1 ? 's' : ''}` : ''}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Comments section */}
      {expanded && <TaskComments taskId={task.id} agents={agents} />}

      {/* Follow-up dialog */}
      {showFollowUp && (
        <FollowUpDialog
          task={task}
          agents={agents}
          allTasks={allTasks}
          open={showFollowUp}
          onOpenChange={setShowFollowUp}
        />
      )}
    </Card>
  );
}

function TaskComments({ taskId, agents }: { taskId: number; agents: Agent[] }) {
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
    enabled: showComments,
  });

  const addCommentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tasks/${taskId}/comments`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      setNewComment("");
    },
  });

  return (
    <div className="mt-2 pt-2 border-t" onClick={e => e.stopPropagation()}>
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setShowComments(!showComments)}
        data-testid={`button-toggle-comments-${taskId}`}
      >
        <MessageSquare className="h-3 w-3" />
        {showComments ? "Hide" : "Show"} Comments
        {comments.length > 0 && <Badge variant="secondary" className="text-[9px] px-1 ml-1">{comments.length}</Badge>}
      </button>
      {showComments && (
        <div className="mt-2 space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 text-xs" data-testid={`comment-${c.id}`}>
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                {c.authorType === "owner" ? "👤" : (agents.find(a => a.id === c.authorId)?.avatar || "🤖")}
              </div>
              <div>
                <span className="font-medium">{c.authorName}</span>
                <span className="text-muted-foreground ml-1">{new Date(c.createdAt).toLocaleString()}</span>
                <p className="mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-1">
            <Input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="text-xs h-7"
              onKeyDown={e => {
                if (e.key === "Enter" && newComment.trim()) {
                  addCommentMutation.mutate({ content: newComment, authorType: "owner", authorName: "Owner" });
                }
              }}
              data-testid={`input-comment-${taskId}`}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={!newComment.trim() || addCommentMutation.isPending}
              onClick={() => addCommentMutation.mutate({ content: newComment, authorType: "owner", authorName: "Owner" })}
              data-testid={`button-add-comment-${taskId}`}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const KANBAN_COLUMNS: { key: string; label: string; color: string; statuses: string[] }[] = [
  { key: "queue", label: "Queue", color: "hsl(var(--muted-foreground))", statuses: ["pending", "blocked"] },
  { key: "working", label: "Working", color: "hsl(var(--chart-4))", statuses: ["thinking", "proposal_ready", "executing", "under_review"] },
  { key: "accepted", label: "Accepted", color: "hsl(var(--chart-2))", statuses: ["completed"] },
  { key: "rejected", label: "Rejected", color: "hsl(var(--destructive))", statuses: ["rejected"] },
];

// Sort: highest priority first, then oldest (first proposed) first within same priority
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
function sortByPriorityThenOldest(a: AgentTask, b: AgentTask) {
  const pa = PRIORITY_RANK[a.priority] ?? 2;
  const pb = PRIORITY_RANK[b.priority] ?? 2;
  if (pa !== pb) return pa - pb; // higher priority (lower rank) first
  return a.id - b.id; // oldest (lower id) first
}
// For completed/rejected columns: latest (newest) first
function sortByNewestFirst(a: AgentTask, b: AgentTask) {
  return b.id - a.id;
}

function BulkReassignDialog({ open, onOpenChange, selectedIds, agents, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedIds: Set<number>;
  agents: Agent[];
  onDone: () => void;
}) {
  const [agentId, setAgentId] = useState<string>("");
  const { toast } = useToast();

  const reassignMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/tasks/bulk-reassign", {
      taskIds: Array.from(selectedIds),
      assignedAgentId: Number(agentId),
    }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Reassigned", description: `${data.updated} task(s) reassigned` });
      onOpenChange(false);
      onDone();
    },
    onError: (err: any) => {
      toast({ title: "Reassign failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign {selectedIds.size} Task(s)</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Assign to</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name} — {a.role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            onClick={() => reassignMutation.mutate()}
            disabled={!agentId || reassignMutation.isPending}
            className="gap-1.5"
          >
            {reassignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Forward className="h-3.5 w-3.5" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Tasks() {
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showReassign, setShowReassign] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"status" | "agent">("status");
  const { toast } = useToast();

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: tasks = [], isLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/tasks"],
    refetchInterval: 3000,
  });

  // Only show top-level tasks in the Kanban. Sub-tasks are displayed nested inside their parent card.
  const kanbanTasks = tasks.filter(t => !t.parentTaskId);

  const activeTasks = tasks.filter(t => !["completed", "rejected"].includes(t.status)).length;
  const proposalReady = tasks.filter(t => t.status === "proposal_ready").length;

  function toggleSelection(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const results = [];
      for (const id of ids) {
        const task = tasks.find(t => t.id === id);
        if (task?.status === "proposal_ready") {
          results.push(await apiRequest("POST", `/api/tasks/${id}/approve`).then(r => r.json()));
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Bulk approved", description: `${results.length} task(s) approved` });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const results = [];
      for (const id of ids) {
        const task = tasks.find(t => t.id === id);
        if (task?.status === "proposal_ready") {
          results.push(await apiRequest("POST", `/api/tasks/${id}/reject`, {}).then(r => r.json()));
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Bulk rejected", description: `${results.length} task(s) rejected` });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Bulk reject failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tasks/bulk-action", { taskIds: Array.from(selectedIds), action: "delete" }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Bulk deleted", description: `${data.updated} task(s) deleted` });
      setSelectedIds(new Set());
      setSelectionMode(false);
    },
  });

  const bulkPriorityMutation = useMutation({
    mutationFn: (priority: string) => apiRequest("POST", "/api/tasks/bulk-action", { taskIds: Array.from(selectedIds), action: "priority", value: priority }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Priority updated", description: `${data.updated} task(s) updated` });
    },
  });

  const resetStuckMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tasks/reset-stuck").then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Stuck tasks reset", description: `${data.reset} task(s) reset to pending and re-queued` });
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tasks/cancel-all").then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "All tasks cancelled", description: `${data.cancelled} task(s) cancelled` });
    },
    onError: (err: any) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });

  // Only count tasks as "stuck" if they are in processing states AND are not parent tasks waiting for sub-tasks
  const stuckCount = tasks.filter(t => {
    if (!["executing", "thinking", "under_review"].includes(t.status)) return false;
    // Parent tasks waiting for sub-tasks are not stuck
    const hasSubs = tasks.some(s => s.parentTaskId === t.id);
    if (hasSubs) return false;
    // Tasks actively thinking (< 5 min old) are not stuck — they're just processing
    // Only flag if no result and been in this state a while
    return true;
  }).length;

  const isBulkLoading = bulkApproveMutation.isPending || bulkRejectMutation.isPending || bulkDeleteMutation.isPending || bulkPriorityMutation.isPending;

  const dragReassignMutation = useMutation({
    mutationFn: ({ taskId, agentId }: { taskId: number; agentId: number }) =>
      apiRequest("PATCH", `/api/tasks/${taskId}`, { assignedAgentId: agentId }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task reassigned" });
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("text/plain", taskId.toString());
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, _colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    // For now, drag-drop within kanban just triggers a visual cue.
    // The main utility is dragging a task card onto an agent picker that appears.
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Agent Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {activeTasks > 0 ? `${activeTasks} active` : "No active tasks"}
              {proposalReady > 0 ? ` · ${proposalReady} awaiting approval` : ""}
              {" · "}{tasks.length} total
            </p>
          </div>
          <HelpButton page="tasks" />
        </div>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <div className="flex bg-muted/50 rounded-md p-0.5 gap-0.5">
            <Button
              variant={viewMode === "status" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("status")}
              className="gap-1.5 h-7 px-2.5 text-xs"
              data-testid="view-status-kanban"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Status
            </Button>
            <Button
              variant={viewMode === "agent" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("agent")}
              className="gap-1.5 h-7 px-2.5 text-xs"
              data-testid="view-agent-kanban"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              By Agent
            </Button>
          </div>
          <div className="h-5 w-px bg-border" />
          {stuckCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetStuckMutation.mutate()}
              disabled={resetStuckMutation.isPending}
              className="gap-1.5 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
              data-testid="button-reset-stuck"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resetStuckMutation.isPending ? 'animate-spin' : ''}`} />
              Reset {stuckCount} Stuck
            </Button>
          )}
          {/* Panic / Emergency Stop button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                data-testid="button-cancel-all"
              >
                <OctagonX className="h-3.5 w-3.5" />
                Stop All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emergency Stop — Cancel All Tasks</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately cancel all {activeTasks} active task(s) (pending, thinking, executing, under review). Completed tasks will not be affected. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Running</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => cancelAllMutation.mutate()}
                >
                  {cancelAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <OctagonX className="h-4 w-4 mr-2" />}
                  Cancel All Tasks
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
            className="gap-1.5"
          >
            <Checkbox className="h-3.5 w-3.5 pointer-events-none" checked={selectionMode} />
            Select
          </Button>
          <Button onClick={() => setShowNewTask(true)} className="gap-2" data-testid="button-new-task">
            <Plus className="h-4 w-4" />
            Assign Task
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading tasks...</div>
        ) : kanbanTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ListTodo className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No tasks yet. Assign a task to get your agents working.</p>
            <p className="text-xs mt-1">Try: "Hire Head of HR" or "Propose org chart for our company"</p>
          </div>
        ) : viewMode === "status" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 h-full min-h-[400px]">
            {KANBAN_COLUMNS.map(col => {
              const sortFn = (col.key === "accepted" || col.key === "rejected") ? sortByNewestFirst : sortByPriorityThenOldest;
              const colTasks = kanbanTasks.filter(t => col.statuses.includes(t.status)).sort(sortFn);
              return (
                <div
                  key={col.key}
                  className={`flex flex-col ${
                    col.key === "working" ? "order-first sm:order-none" :
                    col.key === "queue" ? "order-1 sm:order-none" :
                    col.key === "accepted" ? "order-2 sm:order-none" :
                    "order-3 sm:order-none"
                  }`}
                  data-testid={`task-kanban-column-${col.key}`}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-medium">{col.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
                  </div>
                  <div className={`flex-1 space-y-2.5 rounded-lg p-2 min-h-[200px] overflow-y-auto transition-colors ${dragOverCol === col.key ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"}`}>
                    {colTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                        No tasks
                      </div>
                    ) : colTasks.map(task => (
                      <div
                        key={task.id}
                        className="relative"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                      >
                        {selectionMode && (
                          <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                              checked={selectedIds.has(task.id)}
                              onCheckedChange={() => toggleSelection(task.id)}
                            />
                          </div>
                        )}
                        <div className={selectionMode ? "pl-7" : ""}>
                          <TaskCard task={task} agents={agents} allTasks={tasks} projects={projects} meetings={meetings} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Agent Kanban View: columns = agents, rows = working on top, then queued, then completed */
          <div className="flex gap-3 h-full min-h-[400px] overflow-x-auto pb-2">
            {agents.filter(a => a.status !== "terminated").sort((a, b) => {
              // Sort agents by active task count descending
              const aActive = tasks.filter(t => t.assignedAgentId === a.id && !["completed", "rejected"].includes(t.status)).length;
              const bActive = tasks.filter(t => t.assignedAgentId === b.id && !["completed", "rejected"].includes(t.status)).length;
              return bActive - aActive;
            }).map(agent => {
              const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id && !t.parentTaskId);
              const working = agentTasks.filter(t => ["thinking", "executing", "under_review", "proposal_ready"].includes(t.status));
              const queued = agentTasks.filter(t => ["pending", "blocked"].includes(t.status));
              const completed = agentTasks.filter(t => t.status === "completed").sort((a, b) => b.id - a.id).slice(0, 5);
              const rejected = agentTasks.filter(t => t.status === "rejected").length;
              const totalDone = agentTasks.filter(t => t.status === "completed").length;
              return (
                <div key={agent.id} className="flex flex-col min-w-[260px] w-[260px] shrink-0" data-testid={`agent-kanban-${agent.id}`}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-lg">{agent.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">{agent.role}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {working.length > 0 && <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{working.length} active</Badge>}
                      {queued.length > 0 && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{queued.length} queued</Badge>}
                    </div>
                  </div>
                  <div className="flex-1 rounded-lg bg-muted/30 p-2 space-y-1 overflow-y-auto">
                    {/* Working section */}
                    {working.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-yellow-400 uppercase tracking-wider px-1 mb-1">Working</div>
                        {working.map(task => (
                          <div key={task.id} className="mb-1.5">
                            <TaskCard task={task} agents={agents} allTasks={tasks} projects={projects} meetings={meetings} />
                          </div>
                        ))}
                      </>
                    )}
                    {/* Queued section */}
                    {queued.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1 mt-2">Queued</div>
                        {queued.slice(0, 10).map(task => (
                          <div key={task.id} className="mb-1.5">
                            <TaskCard task={task} agents={agents} allTasks={tasks} projects={projects} meetings={meetings} />
                          </div>
                        ))}
                        {queued.length > 10 && (
                          <div className="text-[10px] text-muted-foreground text-center py-1">+{queued.length - 10} more queued</div>
                        )}
                      </>
                    )}
                    {/* Completed section */}
                    {totalDone > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-green-400 uppercase tracking-wider px-1 mb-1 mt-2">Completed ({totalDone}{rejected > 0 ? ` · ${rejected} rejected` : ""})</div>
                        {completed.map(task => (
                          <div key={task.id} className="mb-1.5 opacity-60">
                            <TaskCard task={task} agents={agents} allTasks={tasks} projects={projects} meetings={meetings} />
                          </div>
                        ))}
                        {totalDone > 5 && (
                          <div className="text-[10px] text-muted-foreground text-center py-1">+{totalDone - 5} more completed</div>
                        )}
                      </>
                    )}
                    {/* Empty state */}
                    {agentTasks.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">No tasks</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-2 sm:gap-3 flex-wrap max-w-[95vw]">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            onClick={() => bulkApproveMutation.mutate()}
            disabled={isBulkLoading}
            className="gap-1.5 bg-green-600 hover:bg-green-700"
          >
            {bulkApproveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve All ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => bulkRejectMutation.mutate()}
            disabled={isBulkLoading}
            className="gap-1.5"
          >
            {bulkRejectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject All ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReassign(true)}
            disabled={isBulkLoading}
            className="gap-1.5"
          >
            <Forward className="h-3.5 w-3.5" />
            Reassign
          </Button>
          <Select onValueChange={(v) => bulkPriorityMutation.mutate(v)}>
            <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="bulk-priority">
              <Target className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkDeleteMutation.mutate()}
            disabled={isBulkLoading}
            className="gap-1.5 text-red-400 hover:text-red-300"
            data-testid="bulk-delete"
          >
            {bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>
        </div>
      )}

      <NewTaskDialog agents={agents} projects={projects} open={showNewTask} onOpenChange={setShowNewTask} />
      <BulkReassignDialog
        open={showReassign}
        onOpenChange={setShowReassign}
        selectedIds={selectedIds}
        agents={agents}
        onDone={() => { setSelectedIds(new Set()); setSelectionMode(false); }}
      />
    </div>
  );
}
