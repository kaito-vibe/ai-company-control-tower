import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import {
  CheckCircle2, ListTodo, DollarSign, Users, TrendingUp,
  BarChart3, Activity, XCircle, Clock, Percent, FolderKanban,
  ArrowRight, FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { HelpButton } from "@/components/help-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";

interface AgentPerformance {
  agentId: number;
  name: string;
  avatar: string;
  department: string;
  totalTasks: number;
  completedTasks: number;
  rejectedTasks: number;
  avgCompletionTimeMs: number;
  rejectionRate: number;
  qualityScore: number;
}

interface AnalyticsData {
  kpis: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCostPerTask: number;
    activeAgents: number;
  };
  agentPerformance: AgentPerformance[];
  velocityData: { date: string; completed: number; created: number }[];
  costByDepartment: { department: string; cost: number }[];
  costTrend: { date: string; cost: number }[];
}

interface ROIData {
  costPerTask: number;
  humanEquivalentCost: number;
  savingsEstimate: number;
  savingsPercent: number;
  totalExpenses: number;
  totalEarnings: number;
  agentCosts: { agentId: number; name: string; avatar: string; totalCost: number; taskCount: number; costPerDay: number }[];
  departmentBudgets: { department: string; spent: number; agentCount: number }[];
  projections: { monthlyBurn: number; quarterlyBurn: number; dailyBurn: number };
}

const DEPT_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"];

function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms <= 0) return "N/A";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function KPICard({ icon: Icon, label, value, subtext, color }: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color || "bg-primary/10"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </Card>
  );
}

interface ProjectInfo {
  id: number;
  title: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
}

function ProjectProgressList() {
  const { data: projects = [] } = useQuery<ProjectInfo[]>({
    queryKey: ["/api/projects"],
  });

  const active = projects.filter(p => p.status !== "completed").slice(0, 8);
  if (active.length === 0) return <p className="text-xs text-muted-foreground">No active projects.</p>;

  return (
    <div className="space-y-3 max-h-[220px] overflow-y-auto">
      {active.map(p => (
        <div key={p.id} className="space-y-1" data-testid={`project-progress-${p.id}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate flex-1 font-medium">{p.title}</span>
            <span className="text-muted-foreground ml-2 shrink-0">{p.progress ?? 0}%</span>
          </div>
          <Progress value={p.progress ?? 0} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 15000,
  });

  const { data: roi } = useQuery<ROIData>({
    queryKey: ["/api/analytics/roi"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
        <p>No analytics data available.</p>
      </div>
    );
  }

  const { kpis, agentPerformance, velocityData, costByDepartment, costTrend } = analytics;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Performance Analytics</h1>
            <p className="text-sm text-muted-foreground">Company-wide performance metrics and trends</p>
          </div>
          <HelpButton page="analytics" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        <Tabs defaultValue="performance" data-testid="analytics-tabs">
          <TabsList>
            <TabsTrigger value="performance" data-testid="tab-performance">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="cost" data-testid="tab-cost">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              Cost Analytics
            </TabsTrigger>
            <TabsTrigger value="roi" data-testid="tab-roi">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              ROI & Savings
            </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 mt-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <KPICard icon={ListTodo} label="Total Tasks" value={kpis.totalTasks} color="bg-blue-500/10" />
              <KPICard icon={CheckCircle2} label="Completion Rate" value={`${kpis.completionRate}%`} color="bg-green-500/10" />
              <KPICard icon={DollarSign} label="Avg Cost/Task" value={formatCurrency(kpis.avgCostPerTask)} color="bg-amber-500/10" />
              <KPICard icon={Users} label="Active Agents" value={kpis.activeAgents} color="bg-purple-500/10" />
            </div>

            {/* Velocity Chart */}
            {velocityData.length > 0 && (
              <>
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Company Velocity (30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" dot={false} />
                    <Line type="monotone" dataKey="created" stroke="#6366f1" strokeWidth={2} name="Created" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Link href="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1 mt-2">View All Tasks <ArrowRight className="h-3 w-3" /></Link>
              </>
            )}

            {/* Agent Performance Table */}
            {agentPerformance.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Agent Performance
                </h3>
                <div className="space-y-2">
                  {agentPerformance.map((agent) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center gap-3 bg-muted/30 rounded-lg p-3"
                      data-testid={`agent-perf-${agent.agentId}`}
                    >
                      <span className="text-lg">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href="/org-chart"><span className="text-sm font-medium hover:underline cursor-pointer">{agent.name}</span></Link>
                          <Badge variant="secondary" className="text-[10px]">{agent.department}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {agent.completedTasks}/{agent.totalTasks}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <XCircle className="h-3 w-3 text-red-400" />
                            {agent.rejectionRate}% rejected
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(agent.avgCompletionTimeMs)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Percent className="h-3 w-3" /> Quality
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={agent.qualityScore} className="w-20 h-1.5" />
                          <span className="text-sm font-medium w-8 text-right">{agent.qualityScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Agent Workload Distribution */}
            {agentPerformance.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Agent Workload Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={agentPerformance.map(a => ({ name: a.name, value: a.totalTasks }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={11}
                      >
                        {agentPerformance.map((_, i) => (
                          <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => `${value} tasks`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                {/* Project Progress Bars */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    Project Progress
                  </h3>
                  <ProjectProgressList />
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Cost Analytics Tab */}
          <TabsContent value="cost" className="space-y-4 mt-4">
            {/* Cost by Department */}
            {costByDepartment.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Cost by Department
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={costByDepartment}
                        dataKey="cost"
                        nameKey="department"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ department, percent }) => `${department}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={11}
                      >
                        {costByDepartment.map((_, i) => (
                          <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Department Breakdown</h3>
                  <div className="space-y-3">
                    {costByDepartment.map((dept, i) => (
                      <div key={dept.department} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                        <Link href="/departments"><span className="text-sm flex-1 hover:underline cursor-pointer">{dept.department}</span></Link>
                        <span className="text-sm font-mono font-medium">{formatCurrency(dept.cost)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Cost Trend */}
            {costTrend.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Cost Trend (30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={costTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    />
                    <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} name="Daily Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </TabsContent>

          {/* ROI & Savings Tab */}
          <TabsContent value="roi" className="space-y-4 mt-4">
            {roi ? (
              <>
                {/* ROI KPI Cards */}
                <div className="grid grid-cols-4 gap-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Cost Per Task
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(roi.costPerTask)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">vs {formatCurrency(roi.humanEquivalentCost)} human</p>
                  </Card>
                  <Card className="p-4 border-green-500/30 bg-green-500/5">
                    <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Savings Estimate
                    </div>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(roi.savingsEstimate)}</p>
                    <p className="text-xs text-green-400/70 mt-0.5">{roi.savingsPercent}% cheaper than human</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Activity className="h-3.5 w-3.5" />
                      Daily Burn Rate
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(roi.projections.dailyBurn)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">per day</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Quarterly Projection
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(roi.projections.quarterlyBurn)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">projected spend</p>
                  </Card>
                </div>
                <Link href="/finances" className="text-xs text-primary hover:underline flex items-center gap-1">View Detailed Transactions <ArrowRight className="h-3 w-3" /></Link>

                {/* Agent Costs */}
                {roi.agentCosts.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Agent Cost Breakdown
                    </h3>
                    <div className="space-y-2">
                      {roi.agentCosts.map((agent) => (
                        <div key={agent.agentId} className="flex items-center gap-3 bg-muted/30 rounded-md p-2.5">
                          <span className="text-base">{agent.avatar}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{agent.name}</span>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>{agent.taskCount} tasks</span>
                              <span>{formatCurrency(agent.costPerDay)}/day</span>
                            </div>
                          </div>
                          <span className="text-sm font-mono font-medium text-red-400">
                            {formatCurrency(agent.totalCost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Department Budgets */}
                {roi.departmentBudgets.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Department Budgets
                    </h3>
                    <div className="space-y-3">
                      {roi.departmentBudgets.map((dept) => (
                        <div key={dept.department} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{dept.department}</span>
                            <span className="text-xs text-muted-foreground">
                              {dept.agentCount} agents · {formatCurrency(dept.spent)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(100, (dept.spent / Math.max(roi.totalExpenses, 1)) * 100)}
                            className="h-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Loading ROI data...
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Quick Links */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Quick Links</h3>
          <div className="grid grid-cols-4 gap-3">
            <Link href="/reports">
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Reports</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
              </Card>
            </Link>
            <Link href="/finances">
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Finances</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
              </Card>
            </Link>
            <Link href="/projects">
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Projects</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
              </Card>
            </Link>
            <Link href="/org-chart">
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Org Chart</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
