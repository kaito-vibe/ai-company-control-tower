import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { AgentTask, Meeting } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Network, ListTodo, Users, FolderKanban, DollarSign, Target, Database, Settings2, BookOpen, GitBranch, Building2, Activity, Sparkles, Package, Gavel, CalendarClock, GanttChart, CalendarDays } from "lucide-react";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Approvals", url: "/approvals", icon: Gavel },
  { title: "Org Chart", url: "/org-chart", icon: Network },
  { title: "Agent Tasks", url: "/tasks", icon: ListTodo },
  { title: "Meetings", url: "/meetings", icon: Users },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Departments", url: "/departments", icon: Building2 },
];

const operationsNav = [
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Products", url: "/products", icon: Package },
  { title: "Finances", url: "/finances", icon: DollarSign },
  { title: "Strategy", url: "/strategy", icon: Target },
  { title: "Roadmap", url: "/roadmap", icon: GanttChart },
  { title: "Knowledge", url: "/knowledge", icon: BookOpen },
  { title: "Schedules", url: "/schedules", icon: CalendarClock },
  { title: "Analytics", url: "/analytics", icon: Activity },
];

const systemNav = [
  { title: "Data", url: "/data", icon: Database },
  { title: "Settings", url: "/settings", icon: Settings2 },
  { title: "Changelog", url: "/changelog", icon: Sparkles },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: tasks = [] } = useQuery<AgentTask[]>({ queryKey: ["/api/tasks"], refetchInterval: 5000 });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"], refetchInterval: 5000 });

  const { data: approvalQueue = [] } = useQuery<any[]>({ queryKey: ["/api/approval-queue"], refetchInterval: 5000 });
  const { data: scheduledTasks = [] } = useQuery<any[]>({ queryKey: ["/api/scheduled-tasks"], refetchInterval: 10000 });
  const proposalReadyCount = tasks.filter(t => t.status === "proposal_ready").length;
  const hasActiveMeeting = meetings.some(m => m.status === "active");
  const pendingApprovals = approvalQueue.filter((q: any) => q.status === "pending").length;
  const activeSchedules = scheduledTasks.filter((s: any) => s.status === "active").length;

  function renderNav(items: typeof mainNav) {
    return (
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.title === "Agent Tasks" && proposalReadyCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                      {proposalReadyCount}
                    </span>
                  )}
                  {item.title === "Approvals" && pendingApprovals > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-yellow-500 text-black text-[10px] font-bold">
                      {pendingApprovals}
                    </span>
                  )}
                  {item.title === "Meetings" && hasActiveMeeting && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />
                  )}
                  {item.title === "Schedules" && activeSchedules > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      {activeSchedules}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-2">
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="AI Control Tower Logo">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
                <circle cx="12" cy="12" r="3" fill="currentColor" className="text-primary" />
                <path d="M12 2v7M12 15v7M2 7l7 5M15 12l7 5M22 7l-7 5M9 12l-7 5" stroke="currentColor" strokeWidth="1" className="text-primary" opacity="0.4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Control Tower</h2>
              <p className="text-[10px] text-muted-foreground">AI Company OS</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Command</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNav(mainNav)}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNav(operationsNav)}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">System</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNav(systemNav)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <PerplexityAttribution />
      </SidebarFooter>
    </Sidebar>
  );
}
