import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, apiUrl } from "@/lib/utils";
import type { Agent, Meeting, MeetingMessage, MeetingTemplate, Project, Task } from "@shared/schema";
import { Link } from "wouter";
import {
  Plus, Send, Users, MessageSquare, FileText, FolderKanban, ListTodo,
  Loader2, Bot, Crown, ChevronLeft, Play, Sparkles, XCircle, CheckSquare,
  Square, ArrowRight, GripVertical, Type, Zap, CheckCircle2, Brain,
  CalendarCheck2, Target, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormattedText } from "@/components/formatted-text";
import { HelpButton } from "@/components/help-button";

const RESPONSE_LENGTHS = [
  { value: "mini", label: "Mini", desc: "~200 chars" },
  { value: "short", label: "Short", desc: "~80 words" },
  { value: "medium", label: "Medium", desc: "~200 words" },
  { value: "long", label: "Long", desc: "~400 words" },
];

function NewMeetingDialog({ agents, open, onOpenChange }: {
  agents: Agent[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);

  const { data: templates = [] } = useQuery<MeetingTemplate[]>({ queryKey: ["/api/meeting-templates"] });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/meeting-templates/seed").then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/meeting-templates"] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/meetings", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      onOpenChange(false);
      setTitle(""); setTopic(""); setSelectedAgents([]);
    },
  });

  function applyTemplate(t: MeetingTemplate) {
    setTitle(t.title);
    setTopic(t.defaultTopic);
    if (t.suggestedRoles && t.suggestedRoles.length > 0) {
      const matched = agents.filter(a => t.suggestedRoles.some(r => a.role.toLowerCase().includes(r.toLowerCase())));
      if (matched.length > 0) setSelectedAgents(matched.map(a => a.id));
    }
  }

  function toggleAgent(id: number) {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call Board Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Template selector */}
          <div>
            <Label>Template</Label>
            {templates.length === 0 ? (
              <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-templates">
                {seedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Load Meeting Templates
              </Button>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {templates.map(t => (
                  <Button key={t.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyTemplate(t)} data-testid={`template-${t.id}`}>
                    {t.title}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Meeting Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q1 Strategy Review" data-testid="input-meeting-title" />
          </div>
          <div>
            <Label>Topic / Agenda</Label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Discuss the company's direction for next quarter..." className="min-h-[80px]" data-testid="input-meeting-topic" />
          </div>
          <div>
            <Label>Invite Agents</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-[200px] overflow-y-auto">
              {agents.map(agent => (
                <label key={agent.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedAgents.includes(agent.id)}
                    onCheckedChange={() => toggleAgent(agent.id)}
                    data-testid={`checkbox-agent-${agent.id}`}
                  />
                  <span className="text-sm">{agent.avatar} {agent.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{agent.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({
              title, topic, agentIds: selectedAgents,
              createdAt: new Date().toISOString(),
            })}
            disabled={!title || !topic || selectedAgents.length === 0 || createMutation.isPending}
            data-testid="button-create-meeting"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Start Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Close Meeting Dialog - cascading: Meeting → Projects → Tasks nested under projects
function CloseMeetingDialog({
  meeting, agents, open, onOpenChange, onClosed
}: {
  meeting: Meeting; agents: Agent[]; open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: () => void;
}) {
  const meetingAgents = agents.filter(a => meeting.agentIds.includes(a.id));
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [closing, setClosing] = useState(false);
  // Each project has: { ...projectFields, tasks: [...], _selected: bool, _tasksLoaded: bool, _tasksLoading: bool }
  const [projects, setProjects] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [meetingMessages, setMeetingMessages] = useState<any[]>([]);

  // Step 1: Derive projects when dialog opens
  useEffect(() => {
    if (open && !loaded) {
      deriveProjects();
    }
  }, [open]);

  async function deriveProjects() {
    setLoadingProjects(true);
    try {
      const msgs = await fetch(apiUrl(`/api/meetings/${meeting.id}/messages`)).then(r => r.json());
      setMeetingMessages(msgs);

      const projRes = await apiRequest("POST", "/api/ai/derive-projects", {
        meetingTitle: meeting.title, topic: meeting.topic,
        messages: msgs, agents: meetingAgents,
      }).then(r => r.json());

      const rawProjects = projRes.projects || [];
      // Initialize each project with selection state and empty tasks
      const enriched = rawProjects.map((p: any) => ({
        ...p,
        _selected: true,
        tasks: [],
        _tasksLoaded: false,
        _tasksLoading: false,
      }));
      setProjects(enriched);
      setLoaded(true);

      // Step 2: Auto-derive tasks for all projects in parallel
      deriveTasksForAll(enriched, msgs);
    } catch (e) {
      console.error("Failed to derive projects", e);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function deriveTasksForAll(projs: any[], msgs: any[]) {
    // Mark all as loading
    setProjects(prev => prev.map(p => ({ ...p, _tasksLoading: true })));

    // Derive in parallel
    const results = await Promise.allSettled(
      projs.map(proj =>
        apiRequest("POST", "/api/ai/derive-project-tasks", {
          project: { title: proj.title, description: proj.description, priority: proj.priority },
          meetingTitle: meeting.title, topic: meeting.topic,
          messages: msgs, agents: meetingAgents,
        }).then(r => r.json())
      )
    );

    setProjects(prev => prev.map((p, i) => {
      const result = results[i];
      const tasks = result.status === 'fulfilled' ? (result.value.tasks || []) : [];
      return {
        ...p,
        tasks: tasks.map((t: any) => ({ ...t, _selected: true })),
        _tasksLoaded: true,
        _tasksLoading: false,
      };
    }));
  }

  function toggleProject(idx: number) {
    setProjects(prev => prev.map((p, i) =>
      i === idx ? { ...p, _selected: !p._selected } : p
    ));
  }

  function toggleTask(projIdx: number, taskIdx: number) {
    setProjects(prev => prev.map((p, i) => {
      if (i !== projIdx) return p;
      const newTasks = [...p.tasks];
      newTasks[taskIdx] = { ...newTasks[taskIdx], _selected: !newTasks[taskIdx]._selected };
      return { ...p, tasks: newTasks };
    }));
  }

  function toggleAllTasks(projIdx: number) {
    setProjects(prev => prev.map((p, i) => {
      if (i !== projIdx) return p;
      const allSelected = p.tasks.every((t: any) => t._selected);
      return { ...p, tasks: p.tasks.map((t: any) => ({ ...t, _selected: !allSelected })) };
    }));
  }

  async function handleClose() {
    setClosing(true);
    try {
      const selectedProjects = projects
        .filter(p => p._selected)
        .map(p => ({
          title: p.title,
          description: p.description,
          priority: p.priority,
          assignedAgentId: p.assignedAgentId,
          tasks: (p.tasks || []).map((t: any) => ({ ...t })),
        }));

      await apiRequest("POST", `/api/meetings/${meeting.id}/close`, {
        selectedProjects,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
      onClosed();
    } catch (e) {
      console.error("Failed to close meeting", e);
    } finally {
      setClosing(false);
    }
  }

  const getAgentName = (id: number) => agents.find(a => a.id === id)?.name || `Agent ${id}`;
  const getAgentAvatar = (id: number) => agents.find(a => a.id === id)?.avatar || "🤖";

  // Count totals for the button label
  const selectedProjectCount = projects.filter(p => p._selected).length;
  const selectedTaskCount = projects
    .filter(p => p._selected)
    .reduce((sum, p) => sum + (p.tasks || []).filter((t: any) => t._selected).length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-400" />
            Close Meeting: {meeting.title}
          </DialogTitle>
        </DialogHeader>

        {loadingProjects ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing meeting to derive projects...</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 p-1">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No actionable projects found in this meeting</p>
              ) : (
                projects.map((proj: any, pIdx: number) => (
                  <div
                    key={pIdx}
                    className={`rounded-lg border transition-colors ${
                      proj._selected
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border/40 opacity-50"
                    }`}
                  >
                    {/* Project header */}
                    <div
                      className="flex items-start gap-3 p-3 cursor-pointer"
                      onClick={() => toggleProject(pIdx)}
                    >
                      {proj._selected
                        ? <CheckSquare className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                        : <Square className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-3.5 w-3.5 text-emerald-400" />
                          <p className="text-sm font-semibold">{proj.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{proj.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {proj.assignedAgentId && (
                            <span className="text-xs text-muted-foreground">
                              {getAgentAvatar(proj.assignedAgentId)} {getAgentName(proj.assignedAgentId)}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">{proj.priority || "medium"}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Nested tasks under project (only if project is selected) */}
                    {proj._selected && (
                      <div className="border-t border-border/30 px-3 pb-3 pt-2">
                        {proj._tasksLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Deriving tasks for this project...
                          </div>
                        ) : proj.tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">No tasks derived</p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                <ListTodo className="h-3 w-3" />
                                Tasks ({proj.tasks.filter((t: any) => t._selected).length}/{proj.tasks.length})
                              </span>
                              <button
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => { e.stopPropagation(); toggleAllTasks(pIdx); }}
                              >
                                {proj.tasks.every((t: any) => t._selected) ? "Deselect All" : "Select All"}
                              </button>
                            </div>
                            <div className="space-y-1">
                              {proj.tasks.map((task: any, tIdx: number) => (
                                <div
                                  key={tIdx}
                                  className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                                    task._selected
                                      ? "bg-blue-500/10 border border-blue-500/20"
                                      : "bg-muted/20 border border-transparent opacity-50"
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); toggleTask(pIdx, tIdx); }}
                                >
                                  {task._selected
                                    ? <CheckSquare className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                                    : <Square className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{task.title}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{task.description}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {task.assignedAgentId && (
                                        <span className="text-[11px] text-muted-foreground">
                                          {getAgentAvatar(task.assignedAgentId)} {getAgentName(task.assignedAgentId)}
                                        </span>
                                      )}
                                      <Badge variant="outline" className="text-[9px] h-4">{task.type || "general"}</Badge>
                                      <Badge variant="outline" className="text-[9px] h-4">{task.priority || "medium"}</Badge>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={closing || loadingProjects || projects.some(p => p._tasksLoading)}
            className="gap-1.5"
            data-testid="button-confirm-close-meeting"
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Close Meeting & Transfer ({selectedProjectCount} project{selectedProjectCount !== 1 ? 's' : ''}, {selectedTaskCount} task{selectedTaskCount !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== #8 Meeting Outcomes Panel ====================
function MeetingOutcomesPanel({ meetingId, agents }: { meetingId: number; agents: Agent[] }) {
  const { data: outcomes } = useQuery<any>({
    queryKey: ["/api/meetings", meetingId, "outcomes"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/meetings/${meetingId}/outcomes`));
      return res.json();
    },
  });

  if (!outcomes || (outcomes.projects.length === 0 && outcomes.tasks.length === 0 && (!outcomes.scheduledTasks || outcomes.scheduledTasks.length === 0))) return null;

  const STATUS_COLOR: Record<string, string> = {
    completed: "text-green-400",
    thinking: "text-yellow-400",
    executing: "text-blue-400",
    pending: "text-muted-foreground",
    rejected: "text-red-400",
    blocked: "text-orange-400",
  };

  return (
    <div className="px-4 py-3 border-t border-green-500/10 bg-green-500/5">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        <span className="text-xs font-semibold">Meeting Outcomes</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {outcomes.completionRate}% tasks complete
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {outcomes.projects.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Projects ({outcomes.projects.length})</span>
            <div className="mt-1 space-y-1">
              {outcomes.projects.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <FolderKanban className="h-3 w-3 text-muted-foreground" />
                  <Link href="/projects" className="hover:underline truncate">{p.title}</Link>
                  <Progress value={p.progress || 0} className="h-1 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}
        {outcomes.tasks.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tasks ({outcomes.tasks.length})</span>
            <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
              {outcomes.tasks.slice(0, 8).map((t: any) => {
                const agent = agents.find(a => a.id === t.assignedAgentId);
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLOR[t.status] ? STATUS_COLOR[t.status].replace("text-", "bg-") : "bg-muted-foreground"}`} />
                    <span className="truncate">{t.title}</span>
                    {agent && <span className="text-[10px] ml-auto shrink-0">{agent.avatar}</span>}
                  </div>
                );
              })}
              {outcomes.tasks.length > 8 && (
                <Link href="/tasks" className="text-[10px] text-primary hover:underline">+{outcomes.tasks.length - 8} more</Link>
              )}
            </div>
          </div>
        )}
        {outcomes.scheduledTasks?.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <CalendarCheck2 className="h-2.5 w-2.5" />
              Recurring Tasks Created ({outcomes.scheduledTasks.length})
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {outcomes.scheduledTasks.map((s: any) => {
                const agent = agents.find(a => a.id === s.assignedAgentId);
                return (
                  <Badge key={s.id} variant="outline" className="text-[10px] gap-1 border-violet-500/20 text-violet-400">
                    <RefreshCw className="h-2.5 w-2.5" />
                    {s.title} ({s.frequency})
                    {agent && <span>{agent.avatar}</span>}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingChat({ meeting, agents, onMeetingClosed }: { meeting: Meeting; agents: Agent[]; onMeetingClosed: () => void }) {
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState<number | null>(null);
  const [roundRunning, setRoundRunning] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [minutesLoading, setMinutesLoading] = useState(false);
  const [closeMeetingOpen, setCloseMeetingOpen] = useState(false);
  const [responseLength, setResponseLength] = useState("medium");
  const [speakerOrder, setSpeakerOrder] = useState<number[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [autonomousRunning, setAutonomousRunning] = useState(false);
  const [autonomousLog, setAutonomousLog] = useState<string[]>([]);
  const [autonomousProgress, setAutonomousProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const allMeetingAgents = agents.filter(a => meeting.agentIds.includes(a.id));

  // Maintain speaker order — initialize from meeting agent IDs, allow reorder
  useEffect(() => {
    if (allMeetingAgents.length > 0 && speakerOrder.length === 0) {
      setSpeakerOrder(allMeetingAgents.map(a => a.id));
    }
  }, [allMeetingAgents.length]);

  // Ordered agents based on speakerOrder
  const meetingAgents = speakerOrder.length > 0
    ? speakerOrder.map(id => allMeetingAgents.find(a => a.id === id)).filter(Boolean) as Agent[]
    : allMeetingAgents;

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setSpeakerOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  const { data: messages = [], isLoading } = useQuery<MeetingMessage[]>({
    queryKey: ["/api/meetings", meeting.id, "messages"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/meetings/${meeting.id}/messages`));
      return res.json();
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/meetings/${meeting.id}/messages`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", meeting.id, "messages"] });
    },
  });

  async function sendOwnerMessage() {
    if (!message.trim()) return;
    await sendMessageMutation.mutateAsync({
      senderName: "Owner",
      senderRole: "Owner",
      content: message.trim(),
      agentId: null,
      timestamp: new Date().toISOString(),
    });
    setMessage("");
  }

  async function askAgent(agent: Agent, lengthOverride?: string) {
    setGenerating(agent.id);
    try {
      const currentMessages = await fetch(apiUrl(`/api/meetings/${meeting.id}/messages`)).then(r => r.json());
      const res = await apiRequest("POST", "/api/ai/agent-response", {
        agentName: agent.name,
        agentRole: agent.role,
        agentInstructions: agent.instructions,
        topic: meeting.topic,
        conversationHistory: currentMessages,
        responseLength: lengthOverride || responseLength,
      });
      const data = await res.json();
      await sendMessageMutation.mutateAsync({
        senderName: agent.name,
        senderRole: agent.role,
        content: data.content,
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  }

  async function runRound() {
    setRoundRunning(true);
    for (const agent of meetingAgents) {
      await askAgent(agent);
    }
    setRoundRunning(false);
  }

  async function generateMinutes() {
    setMinutesLoading(true);
    try {
      const currentMessages = await fetch(apiUrl(`/api/meetings/${meeting.id}/messages`)).then(r => r.json());
      const res = await apiRequest("POST", "/api/ai/meeting-minutes", {
        meetingTitle: meeting.title,
        topic: meeting.topic,
        messages: currentMessages,
      });
      const data = await res.json();
      setMinutes(data.minutes);
      setMinutesOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setMinutesLoading(false);
    }
  }

  const getAgentName = (id: number) => agents.find(a => a.id === id)?.name || `Agent ${id}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{meeting.title}</h2>
              {meeting.status === "completed" && (
                <Badge variant="secondary" className="text-xs">Closed</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{meeting.topic}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateMinutes} disabled={minutesLoading || messages.length === 0} className="gap-1.5" data-testid="button-minutes">
              {minutesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Minutes
            </Button>
            {meeting.status === "active" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCloseMeetingOpen(true)}
                disabled={messages.length === 0}
                className="gap-1.5"
                data-testid="button-close-meeting"
              >
                <XCircle className="h-3.5 w-3.5" />
                Close Meeting
              </Button>
            )}
          </div>
        </div>
        {/* Speaker panel + response length */}
        {meeting.status === "active" && (
          <div className="mt-3 space-y-2.5">
            {/* Response length + Run Round row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0" data-testid="response-length-picker">
                <Type className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-lg border border-border/60 overflow-hidden">
                  {RESPONSE_LENGTHS.map(len => (
                    <button
                      key={len.value}
                      onClick={() => setResponseLength(len.value)}
                      className={`px-3 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-border/40 ${
                        responseLength === len.value
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                      title={len.desc}
                      data-testid={`length-${len.value}`}
                    >
                      {len.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={runRound}
                disabled={!!generating || roundRunning || autonomousRunning}
                className="gap-2 h-9 px-5 text-sm font-semibold"
                data-testid="button-run-round"
              >
                {roundRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Round
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setAutonomousRunning(true);
                  setAutonomousLog([]);
                  setAutonomousProgress(0);
                  try {
                    const resp = await fetch(apiUrl(`/api/meetings/${meeting.id}/run-autonomous`), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ minRounds: 3, maxRounds: 6, responseLength }),
                    });
                    const reader = resp.body?.getReader();
                    const decoder = new TextDecoder();
                    if (reader) {
                      let buffer = "";
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";
                        for (const line of lines) {
                          if (!line.startsWith("data: ")) continue;
                          try {
                            const event = JSON.parse(line.slice(6));
                            if (event.type === "round_start") {
                              setAutonomousLog(prev => [...prev, `Round ${event.round}/${event.total}`]);
                              setAutonomousProgress(Math.round((event.round / event.total) * 60));
                            } else if (event.type === "agent_message") {
                              setAutonomousLog(prev => [...prev, `${event.agentName}: "${event.content.slice(0, 60)}..."`]);
                              queryClient.invalidateQueries({ queryKey: ["/api/meetings", meeting.id, "messages"] });
                            } else if (event.type === "proposal_submitted") {
                              setAutonomousLog(prev => [...prev, `Proposal: ${event.proposal.title} → CEO approval`]);
                              setAutonomousProgress(prev => Math.min(90, prev + 5));
                            } else if (event.type === "project_created") {
                              setAutonomousLog(prev => [...prev, `Project: ${event.project.title}`]);
                              setAutonomousProgress(prev => Math.min(90, prev + 5));
                            } else if (event.type === "task_created") {
                              setAutonomousLog(prev => [...prev, `Task: ${event.task.title}`]);
                            } else if (event.type === "consensus") {
                              setAutonomousLog(prev => [...prev, `Consensus reached at round ${event.round}`]);
                              setAutonomousProgress(70);
                            } else if (event.type === "complete") {
                              const ps = event.summary.proposalsSubmitted || event.summary.projectsCreated || 0;
                              setAutonomousLog(prev => [...prev, `Done: ${ps} proposals submitted for CEO approval`]);
                              setAutonomousProgress(100);
                              toast({ title: "Autonomous meeting complete", description: `${ps} proposals submitted for CEO approval` });
                              queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                            } else if (event.type === "status") {
                              setAutonomousLog(prev => [...prev, event.message]);
                            }
                          } catch {}
                        }
                      }
                    }
                  } catch (err: any) {
                    toast({ title: "Autonomous meeting failed", description: err.message, variant: "destructive" });
                  } finally {
                    setAutonomousRunning(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/meetings", meeting.id, "messages"] });
                  }
                }}
                disabled={!!generating || roundRunning || autonomousRunning}
                className="gap-2 h-9 px-4 text-sm border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                data-testid="button-run-autonomous"
              >
                {autonomousRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Run Autonomous
              </Button>
            </div>

            {/* Draggable speaker list */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mr-1">Speakers</span>
              {meetingAgents.map((agent, idx) => (
                <div
                  key={agent.id}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  className={`flex items-center transition-all ${
                    dragOverIdx === idx && dragIdx !== idx ? "scale-105 ring-2 ring-primary/40 rounded-lg" : ""
                  } ${dragIdx === idx ? "opacity-40" : ""}`}
                >
                  <div
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center justify-center px-1 cursor-grab active:cursor-grabbing self-stretch rounded-l-md hover:bg-muted/50"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => askAgent(agent)}
                    disabled={!!generating || roundRunning}
                    className="gap-2 h-9 px-4 text-sm rounded-l-none border-l-0 hover:border-primary/40 transition-all"
                    data-testid={`button-ask-${agent.id}`}
                  >
                    {generating === agent.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span className="text-base">{agent.avatar}</span>
                    }
                    Ask {agent.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Autonomous Meeting Progress */}
        {autonomousRunning && (
          <div className="mt-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-yellow-400 animate-spin" />
              <span className="text-xs font-semibold text-yellow-400">Autonomous Meeting in Progress</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{autonomousProgress}%</span>
            </div>
            <Progress value={autonomousProgress} className="h-1.5 mb-2" />
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {autonomousLog.slice(-6).map((log, i) => (
                <p key={i} className="text-[10px] text-muted-foreground truncate">{log}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meeting Outcomes Panel (#8) — shown for closed meetings */}
      {meeting.status === "completed" && <MeetingOutcomesPanel meetingId={meeting.id} agents={agents} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading conversation...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No messages yet. Start by sending a question or asking an agent to speak.</p>
          </div>
        ) : messages.map((msg) => {
          const isOwner = msg.senderRole === "Owner";
          const agent = agents.find(a => a.id === msg.agentId);
          return (
            <div key={msg.id} className={`animate-fade-in-up flex gap-3 ${isOwner ? "flex-row-reverse" : ""}`} data-testid={`message-${msg.id}`}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{
                  backgroundColor: isOwner ? "hsl(var(--primary) / 0.2)" : `${agent?.color || "#666"}20`,
                  border: `1px solid ${isOwner ? "hsl(var(--primary) / 0.4)" : `${agent?.color || "#666"}40`}`,
                }}
              >
                {isOwner ? <Crown className="h-3.5 w-3.5" /> : agent?.avatar || <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={`max-w-[75%] ${isOwner ? "text-right" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{msg.senderName}</span>
                  <span className="text-xs text-muted-foreground">{msg.senderRole}</span>
                </div>
                <div className={`p-3 rounded-lg ${isOwner ? "bg-primary/10 border border-primary/20" : "bg-muted/50 border border-border"}`}>
                  <FormattedText text={msg.content} />
                </div>
              </div>
            </div>
          );
        })}
        {generating && (
          <div className="flex gap-3 animate-fade-in-up">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {meeting.status === "active" ? (
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message to the board..."
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendOwnerMessage(); } }}
              data-testid="input-meeting-message"
            />
            <Button onClick={sendOwnerMessage} disabled={!message.trim() || sendMessageMutation.isPending} data-testid="button-send-message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t text-center">
          <p className="text-sm text-muted-foreground">This meeting has been closed.</p>
        </div>
      )}

      {/* Minutes Dialog */}
      <Dialog open={minutesOpen} onOpenChange={setMinutesOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Meeting Minutes
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-4">
              <FormattedText text={minutes} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Close Meeting Dialog */}
      <CloseMeetingDialog
        meeting={meeting}
        agents={agents}
        open={closeMeetingOpen}
        onOpenChange={setCloseMeetingOpen}
        onClosed={onMeetingClosed}
      />


    </div>
  );
}

export default function Meetings() {
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });

  if (selectedMeeting) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMeeting(null)} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            Back to Meetings
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MeetingChat meeting={selectedMeeting} agents={agents} onMeetingClosed={() => setSelectedMeeting(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Board Meetings</h1>
            <p className="text-sm text-muted-foreground">{meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}</p>
          </div>
          <HelpButton page="meetings" />
        </div>
        <Button onClick={() => setShowNewMeeting(true)} className="gap-2" data-testid="button-new-meeting">
          <Plus className="h-4 w-4" />
          Call Meeting
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading meetings...</div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p>No meetings yet. Call your first board meeting.</p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-3xl">
            {meetings.map(meeting => {
              const meetingAgents = agents.filter(a => meeting.agentIds.includes(a.id));
              const meetingProjects = projects.filter(p => (p as any).meetingId === meeting.id);
              const meetingTasks = tasks.filter(t => (t as any).meetingId === meeting.id);
              return (
                <Card
                  key={meeting.id}
                  className="p-4 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => setSelectedMeeting(meeting)}
                  data-testid={`meeting-card-${meeting.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{meeting.title}</h3>
                        <Badge variant={meeting.status === "active" ? "default" : "secondary"} className="text-xs">
                          {meeting.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{meeting.topic}</p>
                    </div>
                    <div className="flex -space-x-2">
                      {meetingAgents.slice(0, 5).map(a => (
                        <div key={a.id} className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-muted border-2 border-background" title={a.name}>
                          {a.avatar}
                        </div>
                      ))}
                      {meetingAgents.length > 5 && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-muted border-2 border-background">
                          +{meetingAgents.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(meeting.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {meeting.status === "completed" && (meetingProjects.length > 0 || meetingTasks.length > 0) && (
                      <div className="flex items-center gap-1.5">
                        {meetingProjects.length > 0 && (
                          <Link href="/projects" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className="text-[10px] gap-1 hover:bg-muted/50">
                              <FolderKanban className="h-2.5 w-2.5" />
                              {meetingProjects.length} {meetingProjects.length === 1 ? "project" : "projects"}
                            </Badge>
                          </Link>
                        )}
                        {meetingTasks.length > 0 && (
                          <Link href="/tasks" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className="text-[10px] gap-1 hover:bg-muted/50">
                              <ListTodo className="h-2.5 w-2.5" />
                              {meetingTasks.length} {meetingTasks.length === 1 ? "task" : "tasks"}
                            </Badge>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NewMeetingDialog agents={agents} open={showNewMeeting} onOpenChange={setShowNewMeeting} />
    </div>
  );
}
