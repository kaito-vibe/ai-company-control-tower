import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, formatCurrency, formatDate } from "@/lib/utils";
import type { Agent, Transaction, Task } from "@shared/schema";
import { Link } from "wouter";

interface DeptBudget {
  department: string;
  budget: number;
  spent: number;
  remaining: number;
  utilization: number;
  agentCount: number;
  taskCount: number;
}
import {
  Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  ArrowUpRight, ArrowDownRight, Cpu, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Filter, Building2, FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpButton } from "@/components/help-button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell,
} from "recharts";

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = {
  earning: ["Product Revenue", "Service Revenue", "Consulting", "Licensing", "Investment Returns", "Other Income"],
  expenditure: ["AI Compute", "Salaries", "Infrastructure", "Marketing", "Operations", "R&D", "Legal", "Other Expense"],
};

const DESC_REGEX = /\[([^\]]+)\]\s*(.+?)\s*\((\d+)\s*in\s*\/\s*(\d+)\s*out\)/;

type ViewMode = "day" | "week" | "month";

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon=start
  const r = new Date(d);
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const r = new Date(s);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getPeriodRange(view: ViewMode, anchor: Date): [Date, Date] {
  if (view === "day") {
    const s = new Date(anchor); s.setHours(0, 0, 0, 0);
    const e = new Date(anchor); e.setHours(23, 59, 59, 999);
    return [s, e];
  }
  if (view === "week") {
    return [startOfWeek(anchor), endOfWeek(anchor)];
  }
  // month
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return [s, e];
}

function formatPeriodLabel(view: ViewMode, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
  }
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function navigateDate(view: ViewMode, anchor: Date, dir: -1 | 1): Date {
  const r = new Date(anchor);
  if (view === "day") r.setDate(r.getDate() + dir);
  else if (view === "week") r.setDate(r.getDate() + dir * 7);
  else r.setMonth(r.getMonth() + dir);
  return r;
}

function periodColumnHeader(view: ViewMode): string {
  if (view === "day") return "Today";
  if (view === "week") return "This Week";
  return "This Month";
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function inPeriod(txDate: string, start: Date, end: Date): boolean {
  const d = new Date(txDate);
  return d >= start && d <= end;
}

// Default agent colors when agent has none
const FALLBACK_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#14b8a6",
];

// ── TransactionForm (kept as-is) ──────────────────────────────────────────

function TransactionForm({ agents, onSave, onClose }: {
  agents: Agent[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<"earning" | "expenditure">("earning");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [agentId, setAgentId] = useState("none");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => { setType(v as any); setCategory(""); }}>
            <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="earning">Earning</SelectItem>
              <SelectItem value="expenditure">Expenditure</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-tx-category"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {CATEGORIES[type].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this for?" data-testid="input-tx-desc" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Amount ($)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" data-testid="input-tx-amount" />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-tx-date" />
        </div>
        <div>
          <Label>Associated Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger data-testid="select-tx-agent"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSave({
            type, category, description,
            amount: Math.round(parseFloat(amount) * 100),
            date,
            agentId: agentId === "none" ? null : Number(agentId),
          })}
          disabled={!category || !description || !amount || parseFloat(amount) <= 0}
          data-testid="button-save-tx"
        >
          Add Transaction
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Finances() {
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [txLogOpen, setTxLogOpen] = useState(true);
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"], refetchInterval: 5000 });
  const { data: tokenStats } = useQuery<{ totalInputTokens: number; totalOutputTokens: number; totalCostCents: number; callCount: number }>({
    queryKey: ["/api/token-stats"], refetchInterval: 5000,
  });
  const { data: deptBudgets = [] } = useQuery<DeptBudget[]>({ queryKey: ["/api/department-budgets"] });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: projectsList = [] } = useQuery<any[]>({ queryKey: ["/api/projects"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/transactions", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/transactions"] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/transactions"] }); },
  });

  // ── Derived data ───────────────────────────────────────────────────────

  const [periodStart, periodEnd] = useMemo(() => getPeriodRange(viewMode, anchor), [viewMode, anchor]);

  const periodTx = useMemo(() => transactions.filter(t => inPeriod(t.date, periodStart, periodEnd)), [transactions, periodStart, periodEnd]);

  const periodSummary = useMemo(() => {
    const earnings = periodTx.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
    const expenditures = periodTx.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
    return { earnings, expenditures, profit: earnings - expenditures };
  }, [periodTx]);

  const lifetimeSummary = useMemo(() => {
    const earnings = transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
    const expenditures = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
    return { earnings, expenditures, profit: earnings - expenditures };
  }, [transactions]);

  const periodAiCost = useMemo(() => {
    return periodTx.filter(t => t.category === "AI Compute").reduce((s, t) => s + t.amount, 0);
  }, [periodTx]);
  const periodAiCalls = useMemo(() => {
    return periodTx.filter(t => t.category === "AI Compute").length;
  }, [periodTx]);

  // ── P&L rows ───────────────────────────────────────────────────────────

  const pnlRows = useMemo(() => {
    const buildCatRow = (cat: string, txList: Transaction[], allTx: Transaction[]) => {
      const period = txList.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
      const lifetime = allTx.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
      return { category: cat, period, lifetime };
    };

    const revenueRows = CATEGORIES.earning.map(c => buildCatRow(c, periodTx.filter(t => t.type === "earning"), transactions.filter(t => t.type === "earning")));
    const expenseRows = CATEGORIES.expenditure.map(c => buildCatRow(c, periodTx.filter(t => t.type === "expenditure"), transactions.filter(t => t.type === "expenditure")));

    return { revenueRows: revenueRows.filter(r => r.period || r.lifetime), expenseRows: expenseRows.filter(r => r.period || r.lifetime) };
  }, [periodTx, transactions]);

  // ── Agent cost breakdown ───────────────────────────────────────────────

  const agentBreakdown = useMemo(() => {
    const aiTx = periodTx.filter(t => t.category === "AI Compute");
    const map: Record<string, { agentId: number | null; calls: number; inputTokens: number; outputTokens: number; cost: number }> = {};

    aiTx.forEach(tx => {
      const key = tx.agentId != null ? String(tx.agentId) : "system";
      if (!map[key]) map[key] = { agentId: tx.agentId ?? null, calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      map[key].calls++;
      map[key].cost += tx.amount;
      const match = DESC_REGEX.exec(tx.description);
      if (match) {
        map[key].inputTokens += parseInt(match[3], 10);
        map[key].outputTokens += parseInt(match[4], 10);
      }
    });

    const totalCost = Object.values(map).reduce((s, v) => s + v.cost, 0);
    return Object.values(map)
      .map(v => ({ ...v, pct: totalCost > 0 ? (v.cost / totalCost) * 100 : 0 }))
      .sort((a, b) => b.cost - a.cost);
  }, [periodTx]);

  // ── Activity chart data ────────────────────────────────────────────────

  const agentColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    let ci = 0;
    agents.forEach(a => { m[String(a.id)] = (a as any).color || FALLBACK_COLORS[ci++ % FALLBACK_COLORS.length]; });
    m["system"] = "#64748b";
    return m;
  }, [agents]);

  const agentNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    agents.forEach(a => { m[String(a.id)] = `${a.avatar} ${a.name}`; });
    m["system"] = "System";
    return m;
  }, [agents]);

  const activityChartData = useMemo(() => {
    const aiTx = periodTx.filter(t => t.category === "AI Compute");

    // Build bucket labels
    const buckets: { label: string; key: string }[] = [];
    if (viewMode === "day") {
      for (let h = 0; h < 24; h++) buckets.push({ label: `${h}:00`, key: String(h) });
    } else if (viewMode === "week") {
      const s = startOfWeek(anchor);
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const d = new Date(s); d.setDate(d.getDate() + i);
        buckets.push({ label: dayNames[i], key: dateKey(d) });
      }
    } else {
      const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        buckets.push({ label: String(d), key: dk });
      }
    }

    // Unique agent keys present
    const agentKeys = new Set<string>();
    aiTx.forEach(tx => agentKeys.add(tx.agentId != null ? String(tx.agentId) : "system"));

    // Fill buckets
    const data = buckets.map(b => {
      const row: Record<string, any> = { label: b.label };
      agentKeys.forEach(k => { row[k] = 0; });
      return row;
    });

    aiTx.forEach(tx => {
      const ak = tx.agentId != null ? String(tx.agentId) : "system";
      let bIdx: number;
      if (viewMode === "day") {
        const h = new Date(tx.date).getHours();
        bIdx = h;
      } else {
        const dk = tx.date.split("T")[0];
        bIdx = buckets.findIndex(b => b.key === dk);
      }
      if (bIdx >= 0 && bIdx < data.length) {
        data[bIdx][ak] = (data[bIdx][ak] || 0) + tx.amount / 100;
      }
    });

    return { data, agentKeys: Array.from(agentKeys) };
  }, [periodTx, viewMode, anchor]);

  // ── Filtered transaction log ───────────────────────────────────────────

  const filteredTx = useMemo(() => {
    let list = periodTx;
    if (filterAgent !== "all") {
      if (filterAgent === "none") list = list.filter(t => t.agentId == null);
      else list = list.filter(t => String(t.agentId) === filterAgent);
    }
    if (filterCategory !== "all") list = list.filter(t => t.category === filterCategory);
    return list;
  }, [periodTx, filterAgent, filterCategory]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    periodTx.forEach(t => cats.add(t.category));
    return Array.from(cats).sort();
  }, [periodTx]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Company Finances</h1>
            <p className="text-sm text-muted-foreground">{transactions.length} transactions recorded</p>
          </div>
          <HelpButton page="finances" />
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2" data-testid="button-add-transaction">
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2 space-y-4">
        {/* Time Period Selector & Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList data-testid="view-mode-tabs">
              <TabsTrigger value="day" data-testid="tab-day">Day</TabsTrigger>
              <TabsTrigger value="week" data-testid="tab-week">Week</TabsTrigger>
              <TabsTrigger value="month" data-testid="tab-month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAnchor(navigateDate(viewMode, anchor, -1))} data-testid="nav-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">{formatPeriodLabel(viewMode, anchor)}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAnchor(navigateDate(viewMode, anchor, 1))} data-testid="nav-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/10">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <div className="text-xl font-bold text-green-500" data-testid="text-total-earnings">
              {formatCurrency(periodSummary.earnings)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Expenditures</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <div className="text-xl font-bold text-red-500" data-testid="text-total-expenditures">
              {formatCurrency(periodSummary.expenditures)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Net P&L</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${periodSummary.profit >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <DollarSign className={`h-4 w-4 ${periodSummary.profit >= 0 ? "text-green-500" : "text-red-500"}`} />
              </div>
            </div>
            <div className={`text-xl font-bold ${periodSummary.profit >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-net-profit">
              {formatCurrency(periodSummary.profit)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">AI Compute</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10">
                <Cpu className="h-4 w-4 text-cyan-500" />
              </div>
            </div>
            <div className="text-xl font-bold text-cyan-400" data-testid="text-ai-cost">
              {formatCurrency(periodAiCost)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{periodAiCalls} calls</div>
          </Card>
        </div>

        {/* P&L Statement Table */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Profit & Loss Statement</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">{periodColumnHeader(viewMode)}</TableHead>
                <TableHead className="text-right">Lifetime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenue section */}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={3} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                  Operating Revenue
                </TableCell>
              </TableRow>
              {pnlRows.revenueRows.map(r => (
                <TableRow key={r.category}>
                  <TableCell className="pl-6 text-sm">{r.category}</TableCell>
                  <TableCell className="text-right text-sm text-green-500">{formatCurrency(r.period)}</TableCell>
                  <TableCell className="text-right text-sm text-green-500/70">{formatCurrency(r.lifetime)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-sm">Total Revenue</TableCell>
                <TableCell className="text-right font-bold text-sm text-green-500">{formatCurrency(periodSummary.earnings)}</TableCell>
                <TableCell className="text-right font-bold text-sm text-green-500/70">{formatCurrency(lifetimeSummary.earnings)}</TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow><TableCell colSpan={3} className="h-2 p-0" /></TableRow>

              {/* Expenses section */}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={3} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                  Operating Expenses
                </TableCell>
              </TableRow>
              {pnlRows.expenseRows.map(r => (
                <TableRow key={r.category}>
                  <TableCell className="pl-6 text-sm">{r.category}</TableCell>
                  <TableCell className="text-right text-sm text-red-500">{formatCurrency(r.period)}</TableCell>
                  <TableCell className="text-right text-sm text-red-500/70">{formatCurrency(r.lifetime)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-sm">Total Expenses</TableCell>
                <TableCell className="text-right font-bold text-sm text-red-500">{formatCurrency(periodSummary.expenditures)}</TableCell>
                <TableCell className="text-right font-bold text-sm text-red-500/70">{formatCurrency(lifetimeSummary.expenditures)}</TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow><TableCell colSpan={3} className="h-2 p-0" /></TableRow>

              {/* Profit */}
              <TableRow className="bg-muted/50 border-t-2 border-b-2">
                <TableCell className="font-bold text-sm">Operating Profit</TableCell>
                <TableCell className={`text-right font-bold text-sm ${periodSummary.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(periodSummary.profit)}
                </TableCell>
                <TableCell className={`text-right font-bold text-sm ${lifetimeSummary.profit >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                  {formatCurrency(lifetimeSummary.profit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        {/* Agent Cost Breakdown */}
        {agentBreakdown.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Agent Cost Breakdown</h3>

            {/* Stacked horizontal bar */}
            <div className="h-6 rounded-full overflow-hidden flex mb-4 bg-muted">
              {agentBreakdown.map((row) => {
                const ak = row.agentId != null ? String(row.agentId) : "system";
                return (
                  <div
                    key={ak}
                    className="h-full transition-all"
                    style={{
                      width: `${row.pct}%`,
                      backgroundColor: agentColorMap[ak] || "#64748b",
                      minWidth: row.pct > 0 ? "2px" : "0",
                    }}
                    title={`${agentNameMap[ak] || "System"}: ${row.pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentBreakdown.map((row) => {
                  const ak = row.agentId != null ? String(row.agentId) : "system";
                  const agent = row.agentId != null ? agents.find(a => a.id === row.agentId) : null;
                  return (
                    <TableRow key={ak}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agentColorMap[ak] || "#64748b" }} />
                          {agent ? (
                            <Link href="/org-chart"><span className="text-sm hover:underline">{agent.avatar} {agent.name}</span></Link>
                          ) : (
                            <span className="text-sm">System (no agent)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">{row.calls}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{fmtTokens(row.inputTokens)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{fmtTokens(row.outputTokens)}</TableCell>
                      <TableCell className="text-right text-sm font-mono text-red-400">{formatCurrency(row.cost)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{row.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Cost by Project */}
        {(() => {
          const projectCostMap: Record<number, { projectId: number; title: string; cost: number }> = {};
          // Map agent costs to projects via tasks
          const agentCostMap: Record<number, number> = {};
          periodTx.filter(t => t.category === "AI Compute" && t.agentId != null).forEach(tx => {
            agentCostMap[tx.agentId!] = (agentCostMap[tx.agentId!] || 0) + tx.amount;
          });
          // For each agent, distribute cost across their active project tasks
          tasks.forEach((task: Task) => {
            const pId = (task as any).projectId;
            if (!pId || !task.assignedAgentId) return;
            const agentCost = agentCostMap[task.assignedAgentId];
            if (!agentCost) return;
            const agentTasks = tasks.filter((t: Task) => t.assignedAgentId === task.assignedAgentId);
            const share = agentCost / (agentTasks.length || 1);
            if (!projectCostMap[pId]) {
              const proj = projectsList.find((p: any) => p.id === pId);
              projectCostMap[pId] = { projectId: pId, title: proj?.title || `Project #${pId}`, cost: 0 };
            }
            projectCostMap[pId].cost += share;
          });
          const projectCosts = Object.values(projectCostMap).sort((a, b) => b.cost - a.cost);
          if (projectCosts.length === 0) return null;
          return (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FolderKanban className="h-4 w-4" /> Estimated Cost by Project
              </h3>
              <div className="space-y-2">
                {projectCosts.map(pc => (
                  <div key={pc.projectId} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <Link href="/projects">
                      <span className="text-sm hover:underline">{pc.title}</span>
                    </Link>
                    <span className="text-sm font-mono text-red-400">{formatCurrency(pc.cost)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Activity Chart */}
        {activityChartData.agentKeys.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4">
              {viewMode === "day" ? "Hourly" : viewMode === "week" ? "Daily" : "Daily"} Activity
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activityChartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, agentNameMap[name] || name]}
                />
                <Legend formatter={(value: string) => agentNameMap[value] || value} />
                {activityChartData.agentKeys.map((ak) => (
                  <Bar key={ak} dataKey={ak} stackId="a" fill={agentColorMap[ak] || "#64748b"} radius={0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Department Budgets */}
        {deptBudgets.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Department Budgets
            </h3>
            <div className="grid gap-3">
              {deptBudgets.map(db => {
                const pct = db.utilization;
                const color = pct >= 90 ? "text-red-400" : pct >= 70 ? "text-orange-400" : "text-green-400";
                return (
                  <div key={db.department} className="border rounded-lg p-3" data-testid={`dept-budget-${db.department}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{db.department}</span>
                        <Badge variant="outline" className="text-[10px]">{db.agentCount} agents</Badge>
                        <Badge variant="outline" className="text-[10px]">{db.taskCount} tasks</Badge>
                      </div>
                      <span className={`text-xs font-medium ${color}`}>{pct.toFixed(0)}% used</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Spent: {formatCurrency(db.spent)}</span>
                      <span>Budget: {formatCurrency(db.budget)}</span>
                      <span>Remaining: {formatCurrency(db.remaining)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Transaction Log (collapsible) */}
        <Card className="p-4">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setTxLogOpen(!txLogOpen)}
            data-testid="toggle-tx-log"
          >
            <h3 className="text-sm font-medium">Transaction Log ({filteredTx.length})</h3>
            {txLogOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {txLogOpen && (
            <div className="mt-3">
              {/* Filters */}
              <div className="flex items-center gap-3 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterAgent} onValueChange={setFilterAgent}>
                  <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="filter-agent">
                    <SelectValue placeholder="All agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    <SelectItem value="none">No Agent</SelectItem>
                    {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.avatar} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="filter-category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {filteredTx.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No transactions for this period.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTx.map(tx => {
                        const agent = agents.find(a => a.id === tx.agentId);
                        return (
                          <TableRow key={tx.id} data-testid={`tx-row-${tx.id}`}>
                            <TableCell>
                              <Badge variant={tx.type === "earning" ? "default" : "destructive"} className="text-xs">
                                {tx.type === "earning" ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{tx.category}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{tx.description}</TableCell>
                            <TableCell className="text-sm">{agent ? `${agent.avatar} ${agent.name}` : "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(tx.date)}</TableCell>
                            <TableCell className={`text-right text-sm font-medium ${tx.type === "earning" ? "text-green-500" : "text-red-500"}`}>
                              {tx.type === "earning" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(tx.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <TransactionForm
            agents={agents}
            onSave={(data) => createMutation.mutate(data)}
            onClose={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
