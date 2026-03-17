import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationCenter } from "@/components/notification-center";
import { CommandSearch } from "@/components/command-search";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/utils";
import { Loader2, Lock, ShieldCheck, Pause, Play } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const OrgChart = lazy(() => import("@/pages/org-chart"));
const Tasks = lazy(() => import("@/pages/tasks"));
const Meetings = lazy(() => import("@/pages/meetings"));
const Projects = lazy(() => import("@/pages/projects"));
const Finances = lazy(() => import("@/pages/finances"));
const Strategy = lazy(() => import("@/pages/strategy"));
const DataManagement = lazy(() => import("@/pages/data-management"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));
const Workflows = lazy(() => import("@/pages/workflows"));
const Settings = lazy(() => import("@/pages/settings"));
const Departments = lazy(() => import("@/pages/departments"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Products = lazy(() => import("@/pages/products"));
const Changelog = lazy(() => import("@/pages/changelog"));
const Approvals = lazy(() => import("@/pages/approvals"));
const Schedules = lazy(() => import("@/pages/schedules"));
const Roadmap = lazy(() => import("@/pages/roadmap"));
const CompanyCalendar = lazy(() => import("@/pages/company-calendar"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  const { data: settings } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
  });

  const themeMutation = useMutation({
    mutationFn: (theme: string) => apiRequest("PATCH", "/api/settings", { theme }),
  });

  useEffect(() => {
    if (settings?.theme === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, [settings?.theme]);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    themeMutation.mutate(next ? "dark" : "light");
  }

  return (
    <button onClick={toggle} className="p-2 rounded-md hover:bg-muted transition-colors" aria-label="Toggle theme" data-testid="button-theme-toggle">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function SystemPauseButton() {
  const { data: status, isLoading } = useQuery<{
    paused: boolean;
    pausedAt: string | null;
    creditPaused: boolean;
    activeAICalls: number;
    maxConcurrent: number;
  }>({
    queryKey: ["/api/system/status"],
    refetchInterval: 5000,
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/pause"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/system/status"] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/resume"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/system/status"] }),
  });

  if (isLoading || !status) return null;

  const isPaused = status.paused;
  const pausedSince = status.pausedAt ? new Date(status.pausedAt) : null;
  const elapsed = pausedSince ? Math.round((Date.now() - pausedSince.getTime()) / 60000) : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => isPaused ? resumeMutation.mutate() : pauseMutation.mutate()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            isPaused
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 animate-pulse"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30"
          }`}
          disabled={pauseMutation.isPending || resumeMutation.isPending}
        >
          {isPaused ? (
            <><Play className="h-3 w-3" /> Paused{elapsed > 0 ? ` (${elapsed}m)` : ""}</>
          ) : (
            <><Pause className="h-3 w-3" /> Running</>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isPaused
          ? "System paused — all task processing frozen. Click to resume."
          : `System running — ${status.activeAICalls}/${status.maxConcurrent} AI calls active. Click to pause all.`
        }
      </TooltipContent>
    </Tooltip>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/org-chart" component={OrgChart} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/projects" component={Projects} />
        <Route path="/finances" component={Finances} />
        <Route path="/strategy" component={Strategy} />
        <Route path="/knowledge" component={KnowledgeBase} />
        <Route path="/departments" component={Departments} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/products" component={Products} />
        <Route path="/changelog" component={Changelog} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/calendar" component={CompanyCalendar} />
        <Route path="/data" component={DataManagement} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

const PIN = "7128";

function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(false);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 filled
    if (value && index === 3) {
      const pin = next.join("");
      if (pin === PIN) {
        setSuccess(true);
        setTimeout(() => setUnlocked(true), 400);
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 500);
      }
    }
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (text.length === 4) {
      const next = text.split("");
      setDigits(next);
      if (text === PIN) {
        setSuccess(true);
        setTimeout(() => setUnlocked(true), 400);
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-6 animate-in fade-in duration-300">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-300 ${
            success ? "bg-green-500/10 border-green-500/40" : error ? "bg-red-500/10 border-red-500/40" : "bg-primary/10 border-primary/30"
          }`}>
            {success ? (
              <ShieldCheck className="h-8 w-8 text-green-400 animate-in zoom-in duration-200" />
            ) : (
              <Lock className={`h-8 w-8 transition-colors ${error ? "text-red-400" : "text-primary"}`} />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold">Control Tower</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Enter PIN to access</p>
          </div>
        </div>

        {/* PIN inputs */}
        <div className="flex gap-3" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 bg-muted/30 outline-none transition-all duration-200
                ${success ? "border-green-500/60 text-green-400" : error ? "border-red-500/60 text-red-400 animate-shake" : d ? "border-primary/60 text-foreground" : "border-border focus:border-primary/60"}
              `}
              data-testid={`pin-input-${i}`}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-400 animate-in fade-in duration-200">Incorrect PIN. Try again.</p>
        )}

        <p className="text-[10px] text-muted-foreground/50">AI Company OS</p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <PinGate>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router hook={useHashLocation}>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <header className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-2">
                      <SystemPauseButton />
                      <CommandSearch />
                      <NotificationCenter />
                      <ThemeToggle />
                    </div>
                  </header>
                  <KeyboardShortcuts />

                  <main className="flex-1 overflow-auto">
                    <AppRoutes />
                  </main>
                </div>
              </div>
              <OnboardingWizard />
            </SidebarProvider>
          </Router>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </PinGate>
  );
}
