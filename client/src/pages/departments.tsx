import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import {
  Users, ListTodo, CheckCircle2, DollarSign, ChevronDown, ChevronRight,
  TrendingUp, FolderKanban, Clock, Building2, Receipt, Cpu, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DeptAgent {
  id: number;
  name: string;
  role: string;
  avatar: string | null;
  color: string | null;
  status: string;
  activeTasks: number;
  completedTasks: number;
  totalTasks: number;
}

interface Department {
  name: string;
  agentCount: number;
  agents: DeptAgent[];
  activeTasks: number;
  completedTasks: number;
  totalTasks: number;
  activeProjects: number;
  budget: number;
  budgetAllocated: number;
  budgetSpent: number;
  budgetRemaining: number;
  budgetUtilization: number;
  recentTransactions: { id: number; description: string; amount: number; date: string; type: string }[];
  avgResponseTime: number;
  performance: number;
}

interface AllocationData {
  agent: {
    id: number;
    name: string;
    role: string;
    department: string;
    avatar: string | null;
    color: string | null;
  };
  activeTasks: {
    id: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
  }[];
  stats: {
    active: number;
    completed: number;
    total: number;
    utilization: number;
  };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "N/A";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export default function Departments() {
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    refetchInterval: 10000,
  });

  const { data: allocations = [] } = useQuery<AllocationData[]>({
    queryKey: ["/api/resource-allocation"],
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpand(name: string) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  }

  const totalAgents = departments.reduce((s, d) => s + d.agentCount, 0);
  const totalTasks = departments.reduce((s, d) => s + d.totalTasks, 0);
  const totalBudget = departments.reduce((s, d) => s + d.budget, 0);

  const overloaded = allocations.filter(a => a.stats.utilization >= 80);
  const idle = allocations.filter(a => a.stats.active === 0);
  const avgUtilization = allocations.length ? Math.round(allocations.reduce((s, a) => s + a.stats.utilization, 0) / allocations.length) : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div>
          <h1 className="text-xl font-bold">Departments & Resources</h1>
          <p className="text-sm text-muted-foreground">
            {departments.length} departments · {totalAgents} agents
          </p>
        </div>
      </div>

      <Tabs defaultValue="departments" className="flex-1 flex flex-col overflow-hidden px-4">
        <TabsList className="w-fit mb-3">
          <TabsTrigger value="departments" data-testid="tab-departments">
            <Building2 className="h-3.5 w-3.5 mr-1.5" /> Departments
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Cpu className="h-3.5 w-3.5 mr-1.5" /> Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="flex-1 overflow-auto mt-0">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 py-2">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Building2 className="h-3.5 w-3.5" />
                Departments
              </div>
              <p className="text-2xl font-bold">{departments.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" />
                Total Agents
              </div>
              <p className="text-2xl font-bold">{totalAgents}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <ListTodo className="h-3.5 w-3.5" />
                Total Tasks
              </div>
              <p className="text-2xl font-bold">{totalTasks}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Total Budget
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </Card>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">Loading departments...</div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-40" />
              <p>No departments yet. Add agents with departments to see them here.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {departments.map(dept => {
                const isExpanded = expanded[dept.name] ?? false;
                return (
                  <Card key={dept.name} className="overflow-hidden" data-testid={`dept-card-${dept.name}`}>
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(dept.name)}
                      data-testid={`dept-toggle-${dept.name}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{dept.name}</h3>
                            <Badge variant="secondary" className="text-xs">{dept.agentCount} agent{dept.agentCount !== 1 ? "s" : ""}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ListTodo className="h-3 w-3" />
                              {dept.activeTasks} active tasks
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              {dept.completedTasks} completed
                            </span>
                            <span className="flex items-center gap-1">
                              <FolderKanban className="h-3 w-3" />
                              {dept.activeProjects} projects
                            </span>
                            <Link href="/finances" className="flex items-center gap-1 hover:text-primary transition-colors">
                              <DollarSign className="h-3 w-3" />
                              Allocated: {formatCurrency(dept.budgetAllocated)} | Spent: {formatCurrency(dept.budgetSpent)} | Remaining: {formatCurrency(dept.budgetRemaining)}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground shrink-0">Budget Utilization</span>
                            <Progress
                              value={dept.budgetUtilization}
                              className={`h-2 flex-1 ${
                                dept.budgetUtilization > 90
                                  ? "[&>div]:bg-red-500"
                                  : dept.budgetUtilization >= 70
                                    ? "[&>div]:bg-yellow-500"
                                    : "[&>div]:bg-green-500"
                              }`}
                            />
                            <span className={`text-xs font-medium ${
                              dept.budgetUtilization > 90
                                ? "text-red-500"
                                : dept.budgetUtilization >= 70
                                  ? "text-yellow-500"
                                  : "text-green-500"
                            }`}>
                              {dept.budgetUtilization}%
                            </span>
                          </div>
                        </div>

                        {/* KPI badges */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              Performance
                            </div>
                            <p className="text-lg font-bold">{dept.performance}%</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Avg Time
                            </div>
                            <p className="text-sm font-medium">{formatDuration(dept.avgResponseTime)}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded agent list */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-2 bg-muted/10">
                        {dept.agents.map(agent => {
                          const workload = agent.totalTasks > 0
                            ? Math.round((agent.activeTasks / Math.max(agent.totalTasks, 1)) * 100)
                            : 0;
                          return (
                            <div key={agent.id} className="flex items-center gap-3 bg-background rounded-lg p-2.5" data-testid={`dept-agent-${agent.id}`}>
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                                style={{ backgroundColor: `${agent.color || "#4F98A3"}20`, border: `1px solid ${agent.color || "#4F98A3"}40` }}
                              >
                                {agent.avatar || "🧠"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{agent.name}</span>
                                  <span className="text-xs text-muted-foreground">{agent.role}</span>
                                  <Badge
                                    variant={agent.status === "active" ? "default" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {agent.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {agent.activeTasks} active · {agent.completedTasks} done
                                  </span>
                                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                                    <Progress value={workload} className="h-1.5" />
                                    <span className="text-[10px] text-muted-foreground w-8">{workload}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {dept.agents.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">No agents in this department.</p>
                        )}

                        {/* Recent Transactions */}
                        {dept.recentTransactions && dept.recentTransactions.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2 mb-2">
                              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                              <h4 className="text-sm font-medium">Recent Transactions</h4>
                            </div>
                            <div className="space-y-1.5">
                              {dept.recentTransactions.slice(0, 5).map(tx => (
                                <div key={tx.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Badge variant={tx.type === "expense" ? "destructive" : "default"} className="text-[10px] shrink-0">
                                      {tx.type}
                                    </Badge>
                                    <span className="truncate">{tx.description}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="text-xs text-muted-foreground">{tx.date}</span>
                                    <Link href="/finances" className="font-medium hover:text-primary transition-colors">
                                      {formatCurrency(tx.amount)}
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Resources Tab — merged from Resources page */}
        <TabsContent value="resources" className="flex-1 overflow-auto mt-0">
          {/* Summary KPIs */}
          <div className="grid grid-cols-4 gap-3 py-2">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" />
                Total Agents
              </div>
              <p className="text-2xl font-bold">{allocations.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Avg Utilization
              </div>
              <p className="text-2xl font-bold">{avgUtilization}%</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="h-3 w-3 text-orange-400" />
                Overloaded
              </div>
              <p className="text-2xl font-bold text-orange-400">{overloaded.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Cpu className="h-3.5 w-3.5" />
                Idle
              </div>
              <p className="text-2xl font-bold text-muted-foreground">{idle.length}</p>
            </Card>
          </div>

          {/* Agent Workload Grid */}
          <Card className="p-4 mb-4">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Agent Workload
            </h2>
            <div className="space-y-3">
              {allocations.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Cpu className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No agents found.</p>
                </div>
              )}
              {allocations.map(a => {
                const utilColor = a.stats.utilization >= 80 ? "text-orange-400" : a.stats.utilization >= 50 ? "text-blue-400" : "text-green-400";
                return (
                  <div key={a.agent.id} className="border rounded-lg p-3" data-testid={`resource-agent-${a.agent.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                          style={{ backgroundColor: (a.agent.color || "#4F98A3") + "20", color: a.agent.color || "#4F98A3" }}
                        >
                          {a.agent.avatar || a.agent.name[0]}
                        </div>
                        <div>
                          <Link href="/org-chart"><span className="text-sm font-medium hover:underline">{a.agent.name}</span></Link>
                          <span className="text-xs text-muted-foreground ml-2">{a.agent.role}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{a.agent.department}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={utilColor}>{a.stats.utilization}% utilized</span>
                        <span className="text-muted-foreground">{a.stats.active} active / {a.stats.completed} done</span>
                      </div>
                    </div>
                    <Progress value={a.stats.utilization} className="h-2 mb-2" />
                    {/* Task bars */}
                    {a.activeTasks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.activeTasks.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted"
                            title={t.title}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[t.priority] || "bg-muted"}`} />
                            <span className="truncate max-w-[120px]">{t.title}</span>
                            <Badge variant="outline" className="text-[8px] px-1">{t.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {a.activeTasks.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic">No active tasks</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
