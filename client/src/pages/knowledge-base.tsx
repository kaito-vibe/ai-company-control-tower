import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Project } from "@shared/schema";
import {
  Search, FileText, Code2, FileSpreadsheet, ClipboardList, Users,
  ChevronDown, ChevronUp, Filter, BookOpen, Briefcase, Eye, CalendarCheck, ListTodo,
} from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormattedText } from "@/components/formatted-text";

const TYPE_ICONS: Record<string, any> = {
  document: FileText,
  spec: FileSpreadsheet,
  code: Code2,
  report: ClipboardList,
  design: Eye,
  other: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  document: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  spec: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  code: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  report: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  design: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any }> = {
  deliverable: { label: "Deliverable", icon: Briefcase },
  execution_log: { label: "Execution Report", icon: ClipboardList },
  meeting: { label: "Meeting Record", icon: Users },
  meeting_minutes: { label: "Meeting Minutes", icon: CalendarCheck },
};

export default function KnowledgeBase() {
  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/knowledge-base"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [viewItem, setViewItem] = useState<any | null>(null);

  // Unique types and categories from data
  const types = [...new Set(items.map(i => i.type))];
  const categories = [...new Set(items.map(i => i.category))];
  const authorAgents = [...new Set(items.filter(i => i.agentId).map(i => i.agentId))];

  // Filter
  const filtered = items.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) &&
          !(item.taskTitle || "").toLowerCase().includes(q) &&
          !(item.content || "").toLowerCase().includes(q) &&
          !(item.agentName || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (agentFilter !== "all" && String(item.agentId) !== agentFilter) return false;
    return true;
  });

  // Stats
  const totalDocs = items.filter(i => i.category === "deliverable").length;
  const totalReports = items.filter(i => i.category === "execution_log").length;
  const totalMeetings = items.filter(i => i.category === "meeting" || i.category === "meeting_minutes").length;

  return (
    <div>
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">
            Company documents, deliverables, and institutional knowledge
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Items</p>
            <p className="text-lg font-bold mt-0.5">{items.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Deliverables</p>
            <p className="text-lg font-bold mt-0.5">{totalDocs}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Reports</p>
            <p className="text-lg font-bold mt-0.5">{totalReports}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Meetings</p>
            <p className="text-lg font-bold mt-0.5">{totalMeetings}</p>
          </Card>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents, deliverables, reports..."
              className="pl-9"
              data-testid="input-kb-search"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-kb-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-kb-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]?.label || c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-kb-agent">
              <SelectValue placeholder="Author" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Authors</SelectItem>
              {authorAgents.map(id => {
                const a = agents.find(ag => ag.id === id);
                return a ? (
                  <SelectItem key={id} value={String(id)}>{a.avatar} {a.name}</SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
          {(search || typeFilter !== "all" || categoryFilter !== "all" || agentFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); setCategoryFilter("all"); setAgentFilter("all"); }} className="text-xs">
              Clear filters
            </Button>
          )}
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {items.length} items
        </p>

        {/* Document list */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading knowledge base...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "No documents yet. Complete tasks to generate deliverables." : "No items match your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item: any) => {
              const TypeIcon = TYPE_ICONS[item.type] || FileText;
              const typeColor = TYPE_COLORS[item.type] || TYPE_COLORS.other;
              const catMeta = CATEGORY_LABELS[item.category] || { label: item.category, icon: FileText };
              const CatIcon = catMeta.icon;
              const project = item.projectId ? projects.find(p => p.id === item.projectId) : null;
              const dateStr = item.createdAt
                ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "";
              const contentPreview = (item.content || "").replace(/\n/g, " ").slice(0, 150);

              return (
                <Card
                  key={item.id}
                  className="p-3 cursor-pointer hover:border-primary/30 transition-all group"
                  onClick={() => setViewItem(item)}
                  data-testid={`kb-item-${item.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${typeColor}`}>
                          {item.type}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                          <CatIcon className="h-2.5 w-2.5 mr-0.5" />
                          {catMeta.label}
                        </Badge>
                      </div>
                      {contentPreview && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{contentPreview}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span>{item.agentAvatar} {item.agentName}</span>
                        {item.taskTitle && <span className="truncate max-w-[200px]">Task: {item.taskTitle}</span>}
                        {project && <span>Project: {project.title}</span>}
                        {item.participants && item.participants.length > 0 && (
                          <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{item.participants.length} participants</span>
                        )}
                        {item.actionItemCount > 0 && (
                          <span className="flex items-center gap-0.5"><ListTodo className="h-2.5 w-2.5" />{item.actionItemCount} actions</span>
                        )}
                        {item.meetingId && (
                          <Link href="/meetings" onClick={(e: any) => e.stopPropagation()}>
                            <span className="text-primary hover:underline">View Meeting</span>
                          </Link>
                        )}
                        <span className="ml-auto shrink-0">{dateStr}</span>
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const I = TYPE_ICONS[viewItem.type] || FileText; return <I className="h-4 w-4" />; })()}
                  {viewItem.title}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[viewItem.type] || ""}`}>
                  {viewItem.type}
                </Badge>
                <span>{viewItem.agentAvatar} {viewItem.agentName}</span>
                {viewItem.taskTitle && <span>Task: {viewItem.taskTitle}</span>}
                {viewItem.createdAt && (
                  <span>{new Date(viewItem.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                )}
                {viewItem.version > 1 && <Badge variant="outline" className="text-[10px]">v{viewItem.version}</Badge>}
              </div>
              <ScrollArea className="max-h-[60vh]">
                <div className="p-2">
                  <FormattedText text={viewItem.content || "No content available."} />
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
