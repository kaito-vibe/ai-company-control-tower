import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Goal } from "@shared/schema";
import {
  Gavel, CheckCircle2, XCircle, Clock, Loader2, Sparkles,
  ArrowRight, Target, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Send, Filter, Inbox, ThumbsUp, ThumbsDown, Pause, MessageSquare,
  TrendingUp, Lightbulb, HeartPulse, Users, FolderKanban, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { HelpButton } from "@/components/help-button";

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  health_remediation: { label: "Health Fix", color: "text-red-400 border-red-500/30", icon: HeartPulse },
  meeting: { label: "Meeting", color: "text-blue-400 border-blue-500/30", icon: Users },
  strategy: { label: "Strategy", color: "text-violet-400 border-violet-500/30", icon: Target },
  ai_proposal: { label: "AI Proposal", color: "text-cyan-400 border-cyan-500/30", icon: Sparkles },
  manual: { label: "Manual", color: "text-gray-400 border-gray-500/30", icon: FolderKanban },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle },
  deferred: { label: "Deferred", color: "text-blue-400", icon: Pause },
};

interface ApprovalItem {
  id: number;
  title: string;
  description: string;
  priority: string;
  assignedAgentId: number | null;
  assignedAgentName: string | null;
  assignedAgentAvatar: string | null;
  source: string;
  meetingId: number | null;
  goalId: number | null;
  goalTitle: string | null;
  estimatedEffort: string | null;
  targetMetric: string | null;
  expectedImpact: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  notes: string | null;
  projectId: number | null;
}

interface BriefRec {
  itemId: number;
  itemTitle: string;
  recommendation: string;
  reasoning: string;
  urgency: string;
}

function ApprovalCard({ item, recommendation, onAction }: {
  item: ApprovalItem;
  recommendation?: BriefRec;
  onAction: (id: number, action: string, notes?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const isPending = item.status === "pending";
  const source = SOURCE_LABELS[item.source] || SOURCE_LABELS.manual;
  const SourceIcon = source.icon;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  const recColor = recommendation?.recommendation === "approve"
    ? "border-green-500/30 bg-green-500/5"
    : recommendation?.recommendation === "reject"
      ? "border-red-500/30 bg-red-500/5"
      : recommendation?.recommendation === "defer"
        ? "border-blue-500/30 bg-blue-500/5"
        : "";

  return (
    <Card
      className={`p-4 transition-all hover:border-primary/20 ${isPending ? "" : "opacity-70"} ${recColor}`}
      data-testid={`approval-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="mt-1 shrink-0">
          {isPending ? (
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Gavel className="h-4 w-4 text-yellow-400" />
            </div>
          ) : (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.status === "approved" ? "bg-green-500/10 border border-green-500/30" : item.status === "rejected" ? "bg-red-500/10 border border-red-500/30" : "bg-blue-500/10 border border-blue-500/30"}`}>
              <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{item.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-1 ${source.color}`}>
                  <SourceIcon className="h-2.5 w-2.5" />
                  {source.label}
                </Badge>
                <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${PRIORITY_COLORS[item.priority] || ""}`}>
                  {item.priority}
                </Badge>
                {item.goalTitle && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 text-violet-400 border-violet-500/30">
                    <Target className="h-2.5 w-2.5" />
                    {item.goalTitle}
                  </Badge>
                )}
                {item.assignedAgentName && (
                  <span className="text-[10px] text-muted-foreground">
                    {item.assignedAgentAvatar} {item.assignedAgentName}
                  </span>
                )}
              </div>
            </div>
            {!isPending && (
              <Badge variant="outline" className={`text-[10px] ${statusCfg.color} shrink-0`}>
                {statusCfg.label}
              </Badge>
            )}
          </div>

          {/* Description preview or expanded */}
          <p className={`text-xs text-muted-foreground mt-2 ${expanded ? "" : "line-clamp-2"}`}>
            {item.description}
          </p>
          {item.description.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-primary hover:underline mt-0.5"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {item.expectedImpact && (
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" />
                {item.expectedImpact}
              </span>
            )}
            {item.estimatedEffort && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {item.estimatedEffort}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* AI Recommendation */}
          {recommendation && isPending && (
            <div className={`mt-2.5 p-2 rounded-lg border ${recColor}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold">
                  AI Recommends: <span className={recommendation.recommendation === "approve" ? "text-green-400" : recommendation.recommendation === "reject" ? "text-red-400" : "text-blue-400"}>{recommendation.recommendation.toUpperCase()}</span>
                </span>
                <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-auto">{recommendation.urgency}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{recommendation.reasoning}</p>
            </div>
          )}

          {/* Decision notes (for already decided items) */}
          {item.notes && (
            <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-muted/50">
              <p className="text-[10px] text-muted-foreground"><span className="font-semibold">CEO Note:</span> {item.notes}</p>
            </div>
          )}

          {/* Action buttons (only for pending) */}
          {isPending && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onAction(item.id, "approve", notes || undefined)}
                className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                data-testid={`button-approve-${item.id}`}
              >
                <ThumbsUp className="h-3 w-3" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(item.id, "reject", notes || undefined)}
                className="h-7 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                data-testid={`button-reject-${item.id}`}
              >
                <ThumbsDown className="h-3 w-3" /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(item.id, "defer", notes || undefined)}
                className="h-7 text-xs gap-1.5 text-muted-foreground"
                data-testid={`button-defer-${item.id}`}
              >
                <Pause className="h-3 w-3" /> Defer
              </Button>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <MessageSquare className="h-3 w-3" /> {showNotes ? "Hide notes" : "Add notes"}
              </button>
            </div>
          )}

          {/* Notes textarea */}
          {showNotes && isPending && (
            <Textarea
              placeholder="Optional CEO notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-2 text-xs h-16 resize-none"
              data-testid={`textarea-notes-${item.id}`}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Approvals() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("pending");
  const [briefData, setBriefData] = useState<{ brief: string; recommendations: BriefRec[] } | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { data: queue = [], isLoading } = useQuery<ApprovalItem[]>({
    queryKey: ["/api/approval-queue"],
    refetchInterval: 5000,
  });

  const filtered = queue.filter(q => {
    if (filter === "all") return true;
    return q.status === filter;
  });

  const pendingCount = queue.filter(q => q.status === "pending").length;
  const approvedCount = queue.filter(q => q.status === "approved").length;
  const rejectedCount = queue.filter(q => q.status === "rejected").length;
  const deferredCount = queue.filter(q => q.status === "deferred").length;

  // Sort: pending first (newest first), then decided (newest first)
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  async function handleAction(id: number, action: string, notes?: string) {
    setActionLoading(id);
    try {
      await apiRequest("POST", `/api/approval-queue/${id}/${action}`, { notes });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: action === "approve" ? "Project approved" : action === "reject" ? "Proposal rejected" : "Proposal deferred",
        description: action === "approve" ? "Project created and added to backlog" : undefined,
      });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function loadBrief() {
    setLoadingBrief(true);
    try {
      const resp = await apiRequest("POST", "/api/approval-queue/brief");
      const data = await resp.json();
      setBriefData(data);
    } catch (err: any) {
      toast({ title: "Failed to generate brief", description: err.message, variant: "destructive" });
    } finally {
      setLoadingBrief(false);
    }
  }

  async function batchApproveAll() {
    const pending = queue.filter(q => q.status === "pending");
    if (pending.length === 0) return;
    const actions = pending.map(p => ({ id: p.id, action: "approve" }));
    try {
      await apiRequest("POST", "/api/approval-queue/batch", { actions });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: `${pending.length} projects approved`, description: "All pending proposals approved" });
    } catch (err: any) {
      toast({ title: "Batch action failed", description: err.message, variant: "destructive" });
    }
  }

  function getRecommendation(itemId: number): BriefRec | undefined {
    return briefData?.recommendations?.find(r => r.itemId === itemId);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" data-testid="approvals-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Gavel className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">CEO Approval Queue</h1>
              <p className="text-xs text-muted-foreground">Review and decide on proposed projects before they enter the pipeline</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton title="Approval Queue" content="All AI-proposed projects land here for your review. Approve to create them, reject to dismiss, or defer for later. Use the AI Brief to get strategic recommendations." />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => setFilter("pending")}
          className={`p-3 rounded-lg border text-left transition-all ${filter === "pending" ? "border-yellow-500/40 bg-yellow-500/5" : "border-border hover:border-yellow-500/20"}`}
          data-testid="filter-pending"
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-xl font-bold text-yellow-400">{pendingCount}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Pending Review</span>
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={`p-3 rounded-lg border text-left transition-all ${filter === "approved" ? "border-green-500/40 bg-green-500/5" : "border-border hover:border-green-500/20"}`}
          data-testid="filter-approved"
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xl font-bold text-green-400">{approvedCount}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Approved</span>
        </button>
        <button
          onClick={() => setFilter("rejected")}
          className={`p-3 rounded-lg border text-left transition-all ${filter === "rejected" ? "border-red-500/40 bg-red-500/5" : "border-border hover:border-red-500/20"}`}
          data-testid="filter-rejected"
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xl font-bold text-red-400">{rejectedCount}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Rejected</span>
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`p-3 rounded-lg border text-left transition-all ${filter === "all" ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"}`}
          data-testid="filter-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <Inbox className="h-3.5 w-3.5 text-primary" />
            <span className="text-xl font-bold">{queue.length}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </button>
      </div>

      {/* Action bar */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="text-xs text-yellow-400 font-medium">{pendingCount} proposal{pendingCount !== 1 ? "s" : ""} awaiting your decision</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadBrief}
              disabled={loadingBrief}
              className="h-7 text-xs gap-1.5"
              data-testid="button-ai-brief"
            >
              {loadingBrief ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI Brief
            </Button>
            <Button
              size="sm"
              onClick={batchApproveAll}
              className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-approve-all"
            >
              <CheckCircle2 className="h-3 w-3" /> Approve All
            </Button>
          </div>
        </div>
      )}

      {/* AI Brief panel */}
      {briefData && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Strategic Brief</h3>
            <button onClick={() => setBriefData(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{briefData.brief}</p>
          {briefData.recommendations.length > 0 && (
            <div className="space-y-1.5">
              {briefData.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-1 px-2 rounded bg-muted/30">
                  <span className={`font-semibold ${rec.recommendation === "approve" ? "text-green-400" : rec.recommendation === "reject" ? "text-red-400" : "text-blue-400"}`}>
                    {rec.recommendation.toUpperCase()}
                  </span>
                  <span className="text-foreground font-medium truncate flex-1">"{rec.itemTitle}"</span>
                  <span className="text-muted-foreground shrink-0">{rec.reasoning}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Queue items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {filter === "pending" ? "No pending proposals" : `No ${filter} items`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "pending" ? "Proposals from meetings, health checks, and strategy will appear here" : "Try changing the filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(item => (
            <ApprovalCard
              key={item.id}
              item={item}
              recommendation={getRecommendation(item.id)}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
