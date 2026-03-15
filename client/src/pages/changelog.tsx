import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Brain, MessageSquare, GitBranch, Cog, Building2, Bell, Scale,
  BarChart3, DollarSign, Camera, FlaskConical, BookTemplate, Search,
  Keyboard, GripVertical, Cpu, Users, ClipboardCheck, Plug, HelpCircle,
  Shield, Rocket, Target, FolderKanban, AlertTriangle, Network, ListTodo,
  CalendarClock, BookOpen, Clock, UserSquare, Database, Settings2, Activity,
  Zap, Layers, FileText, Lock, Globe, Palette, Smartphone, CheckCircle2
} from "lucide-react";

const features = [
  {
    category: "Core AI Engine",
    icon: Brain,
    items: [
      { name: "Real AI Integration", desc: "OpenAI-powered agents (Claude, GPT, Gemini models)" },
      { name: "Agent Memory", desc: "Persistent conversation history across sessions" },
      { name: "Agent Autonomy Levels", desc: "4 tiers: Manual, Supervised, Semi-Autonomous, Fully Autonomous" },
      { name: "Auto-Start Tasks", desc: "Configurable auto-think when tasks are assigned" },
      { name: "Max Parallel Tasks", desc: "Per-agent concurrency limits" },
      { name: "Response Length Picker", desc: "Mini / Short / Medium / Long output control" },
      { name: "Per-Agent Model Overrides", desc: "Different AI models for different roles" },
      { name: "Auto-Approve Tasks", desc: "Global toggle to auto-approve all agent proposals" },
      { name: "Manager Review Loop", desc: "Managers auto-review direct reports' work before CEO approval" },
    ],
  },
  {
    category: "Organization",
    icon: Network,
    items: [
      { name: "Org Chart", desc: "Visual hierarchy with reporting lines, skills, autonomy badges" },
      { name: "CEO Delegation", desc: "Smart delegation to managers with direct reports" },
      { name: "Department Management", desc: "Create/manage departments with budgets and headcount" },
      { name: "Agent Hiring", desc: "AI-generated agent profiles with skills and instructions" },
      { name: "Drag-to-Reorder Speakers", desc: "Meeting participant ordering" },
      { name: "Agent Performance Inline", desc: "Task stats and quality scores on org chart cards" },
    ],
  },
  {
    category: "Task Management",
    icon: ListTodo,
    items: [
      { name: "Kanban Board", desc: "Queue → Working → Accepted → Rejected columns" },
      { name: "Task Dependencies", desc: "Blocked-by / blocks relationships" },
      { name: "Approval Workflow", desc: "Proposal review with approve/reject actions" },
      { name: "Bulk Operations", desc: "Multi-select approve, reject, reassign, delete" },
      { name: "Task Comments", desc: "Threaded discussion on any task" },
      { name: "Priority Sorting", desc: "Urgent → High → Medium → Low automatic ordering" },
      { name: "Drag & Drop", desc: "Move tasks between columns" },
      { name: "Sub-Tasks", desc: "Hierarchical task breakdown with progress tracking" },
      { name: "SOP → Tasks", desc: "Create task sets directly from SOPs" },
      { name: "Checklist from SOP", desc: "Generate checklists from SOP procedures" },
    ],
  },
  {
    category: "Meetings & Communication",
    icon: Users,
    items: [
      { name: "Board Meetings", desc: "Multi-agent roundtable discussions with AI minutes" },
      { name: "Inter-Agent Messaging", desc: "Direct messages between agents" },
      { name: "Meeting Templates", desc: "Reusable meeting formats (standup, planning, retro)" },
      { name: "Agent Chat", desc: "Real-time conversation with any agent" },
      { name: "Meeting Impact Tracking", desc: "Show projects and tasks created from each meeting" },
      { name: "Meeting Minutes Auto-Capture", desc: "Knowledge base entries from closed meetings" },
    ],
  },
  {
    category: "Projects & Workflows",
    icon: FolderKanban,
    items: [
      { name: "Project Management", desc: "Backlog → In Progress → Completed pipeline" },
      { name: "Project Milestones", desc: "Milestone tracking with due dates" },
      { name: "Workflow Engine", desc: "Multi-step automated workflows with conditions" },
      { name: "Approval Chains", desc: "Sequential multi-level approval flows" },
      { name: "Escalation Rules", desc: "Automatic escalation on timeouts" },
      { name: "OKR → Project Linking", desc: "Link projects to OKRs with visual progress" },
      { name: "Workflow → Scheduled Tasks", desc: "Trigger scheduled tasks from workflow events" },
      { name: "Project → Checklist Linking", desc: "Attach checklists to projects" },
    ],
  },
  {
    category: "Finance & Analytics",
    icon: BarChart3,
    items: [
      { name: "Financial Dashboard", desc: "Revenue, expenses, P&L, department budgets" },
      { name: "AI Cost Tracking", desc: "Per-agent token usage and cost breakdowns" },
      { name: "ROI & Savings", desc: "AI vs. human cost comparison with projected savings" },
      { name: "Performance Analytics", desc: "Completion rates, velocity charts, quality scores" },
      { name: "Company Reports", desc: "Auto-generated executive summaries" },
      { name: "Cost per Agent/Project", desc: "Detailed cost breakdowns by agent and project" },
      { name: "Department Budget Tracking", desc: "Allocated vs spent vs remaining with utilization bars" },
      { name: "Analytics Drill-downs", desc: "Click-through from charts to source data" },
      { name: "Quick Links Panel", desc: "Analytics page quick navigation to related pages" },
    ],
  },
  {
    category: "Strategy & Planning",
    icon: Target,
    items: [
      { name: "Strategy Board", desc: "OKRs with key results and progress tracking" },
      { name: "Scenario Planning", desc: "What-if analysis with agent impact modeling" },
      { name: "Company Snapshots", desc: "Point-in-time company state captures" },
      { name: "Risk Register", desc: "Risk identification, scoring, mitigation tracking" },
      { name: "Company Timeline", desc: "Historical event log of all company activities" },
      { name: "Budget Cut Scenario", desc: "What-if analysis for budget reductions" },
      { name: "Enhanced Scenarios", desc: "Cross-linked agent names and project references" },
    ],
  },
  {
    category: "Knowledge & Operations",
    icon: BookOpen,
    items: [
      { name: "Knowledge Base", desc: "Categorized articles and documents" },
      { name: "SOP Library", desc: "Standard operating procedures with versioning" },
      { name: "Compliance Checklists", desc: "Regulatory and operational compliance tracking" },
      { name: "Client Management", desc: "Client profiles, contracts, interaction history" },
      { name: "Resource Allocation", desc: "Agent capacity and workload optimization" },
      { name: "Client Health Scoring", desc: "Auto-computed health from projects and risks" },
      { name: "Client Revenue Tracking", desc: "Total revenue per client from linked projects" },
      { name: "Create Project from Client", desc: "Quick project creation with client pre-linked" },
    ],
  },
  {
    category: "System & UX",
    icon: Cog,
    items: [
      { name: "Global Search (⌘K)", desc: "Search agents, tasks, meetings, projects instantly" },
      { name: "Keyboard Shortcuts", desc: "Power-user navigation (?, G+D, G+T, etc.)" },
      { name: "Notification System", desc: "Bell icon with unread count and real-time alerts" },
      { name: "Dark Theme", desc: "Sleek dark-first design throughout" },
      { name: "Help System", desc: "Contextual help tooltips on every page" },
      { name: "Data Management", desc: "Import/export company state, reset data" },
      { name: "Integrations Dashboard", desc: "External service connections overview" },
      { name: "Mobile Responsive", desc: "Optimized for all screen sizes" },
      { name: "Enhanced Data Export", desc: "Structured export with summary counts for all modules" },
      { name: "Cross-Module Activity Feed", desc: "Dashboard feed from tasks, meetings, decisions, risks, and more" },
      { name: "Universal Cross-Links", desc: "Every page links to related pages across the app" },
      { name: "Timeline Auto-Events", desc: "Task completions, hires, and meetings auto-logged" },
    ],
  },
];

const releaseLog = [
  {
    version: "1.0.0",
    date: "Mar 12, 2026",
    title: "Initial Release",
    changes: [
      "CEO agent with AI-powered task delegation",
      "Agent hiring via AI proposals",
      "Board meetings with multi-agent discussions",
      "Task approval workflow (propose → approve/reject)",
      "Financial tracking with AI cost monitoring",
      "Strategy board with OKR management",
      "Org chart with reporting lines hierarchy",
      "Settings with per-agent model overrides",
      "Dark theme, hash routing, response length picker",
    ],
  },
  {
    version: "1.1.0",
    date: "Mar 12, 2026",
    title: "Bug Fixes & UX Improvements",
    changes: [
      "Fixed CEO over-delegating — managers now delegate to their reports",
      "Added auto-start toggle in settings",
      "Added max parallel tasks per agent setting",
      "Made dashboard full-width (removed max-width constraint)",
      "Fixed approve/reject button visibility on task cards",
      "Added scrollable agent workload panel",
      "Removed company health widget from header",
      "Enhanced activity feed with timestamps and more event types",
    ],
  },
  {
    version: "2.0.0",
    date: "Mar 12, 2026",
    title: "Enterprise Features (Iterations 1-15)",
    changes: [
      "Agent memory — persistent conversation history",
      "Inter-agent messaging system",
      "Task dependencies (blocked-by / blocks)",
      "Workflow engine with multi-step automation",
      "Agent skills and expertise tracking",
      "Departments page with budgets",
      "Notification system with bell icon",
      "Decision log / audit trail",
      "Agent chat (direct conversation)",
      "Company reports (auto-generated)",
      "Performance analytics dashboard",
      "ROI tracking (AI vs. human costs)",
      "Company snapshots (point-in-time state)",
      "Scenario planning (what-if analysis)",
      "SOP library with versioning",
    ],
  },
  {
    version: "3.0.0",
    date: "Mar 12, 2026",
    title: "Power Features (Iterations 16-35)",
    changes: [
      "Global search (⌘K) across all entities",
      "Keyboard shortcuts for power users",
      "Notification bell with unread count",
      "Drag-and-drop task management",
      "Resource allocation dashboard",
      "Multi-department budget management",
      "Client management (CRM)",
      "Meeting templates (standup, retro, planning)",
      "Task comments and threaded discussions",
      "Company timeline",
      "Approval chains (multi-level)",
      "Escalation rules with timeouts",
      "Compliance checklists",
      "API activity log",
      "Bulk operations (multi-select tasks)",
      "Company templates library",
      "Onboarding wizard for new users",
      "Dark/light theme toggle",
      "Performance optimization (code splitting)",
      "Mobile responsive design",
    ],
  },
  {
    version: "4.0.0",
    date: "Mar 12, 2026",
    title: "Autonomy & Intelligence (Iterations 36-44)",
    changes: [
      "Agent autonomy levels (4 tiers: Manual → Fully Autonomous)",
      "Project milestones with due dates",
      "Risk register with scoring and mitigation",
      "OKR enhancement with key results tracking",
      "Integrations dashboard",
      "Advanced data visualization",
      "Help system (contextual tooltips on every page)",
      "Enhanced settings (company context, display prefs)",
      "Onboarding wizard with step-by-step setup",
    ],
  },
  {
    version: "4.1.0",
    date: "Mar 12, 2026",
    title: "QC & Stability",
    changes: [
      "Fixed activity feed 500 error (invalid timestamp handling)",
      "Fixed NaN display in analytics response time",
      "Added Features & Release Log page",
      "API endpoint hardening across all 20 routes",
    ],
  },
  {
    version: "5.0.0",
    date: "Mar 13, 2026",
    title: "Full Interconnection",
    changes: [
      "14 interconnection items linking all pages together",
      "Dashboard cross-links to all sections",
      "Task → Project → Meeting bidirectional references",
      "Decision log linked from meetings and workflows",
      "Auto-approve tasks toggle in settings",
      "Notification bell shows cross-module alerts",
    ],
  },
  {
    version: "5.1.0",
    date: "Mar 13, 2026",
    title: "Deep Integration (20 Iterations)",
    changes: [
      "Task completion auto-creates timeline events",
      "Timeline page with cross-links, icons, and type filters",
      "Reports page with live KPI summary cards",
      "Snapshots capture richer data (meetings, decisions, risks)",
      "SOPs: actionable 'Create Tasks from SOP' button",
      "Resources page with real agent workload/utilization",
      "Meetings page shows impact: projects & tasks created",
      "Org Chart shows agent performance inline",
      "Finances: cost by agent and by project breakdowns",
      "Strategy: link OKRs to projects with visual progress",
      "Notifications enhanced with cross-module alerts (risks, budgets)",
      "Knowledge base auto-captures meeting minutes",
      "Scenarios: new Budget Cut scenario + enhanced projections",
      "Scheduled tasks linkable to workflows",
      "Departments: budget tracking (allocated/spent/remaining)",
      "Analytics: drill-down links to source data",
      "Clients: health scoring, revenue tracking, quick project creation",
      "Data export v2: structured format with summary counts",
      "Dashboard activity feed from all modules with links",
      "Checklists linkable to projects and generatable from SOPs",
    ],
  },
  {
    version: "5.2.0",
    date: "Mar 13, 2026",
    title: "Manager Review Feedback Loop",
    changes: [
      "Manager AI auto-reviews direct reports' proposals before CEO approval",
      "Iterative revision loop — managers send work back with feedback until satisfied",
      "New 'Under Review' task status with purple theme and animations",
      "'Manager Reviewed' badge on approved proposals",
      "Manager review toggle in settings (enabled by default)",
      "Max 3 revision rounds to prevent infinite loops",
      "Manager feedback injected into agent's revision context",
      "Under review tasks counted in resource utilization and parallel limits",
    ],
  },
];

export default function Changelog() {
  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          Features & Release Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete capability list and version history
        </p>
      </div>

      {/* Features Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          All Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((cat) => (
            <Card key={cat.category} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <cat.icon className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-semibold text-sm">{cat.category}</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                    {cat.items.length}
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {cat.items.map((item) => (
                    <li key={item.name} className="text-xs">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="text-muted-foreground"> — {item.desc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {features.reduce((sum, c) => sum + c.items.length, 0)} features across {features.length} categories
          {" · "} 25 pages {" · "} 9 AI agents {" · "} Real OpenAI integration
        </p>
      </div>

      <Separator />

      {/* Release Log Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-400" />
          Release Log
        </h2>
        <div className="space-y-4">
          {releaseLog.map((release) => (
            <Card key={release.version} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 font-mono text-xs">
                    v{release.version}
                  </Badge>
                  <span className="text-sm font-semibold">{release.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{release.date}</span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                  {release.changes.map((change, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-cyan-400" />
          <span>8 releases</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span>70+ iterations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          <span>25 pages</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-purple-400" />
          <span>Production-ready</span>
        </div>
      </div>
    </div>
  );
}
