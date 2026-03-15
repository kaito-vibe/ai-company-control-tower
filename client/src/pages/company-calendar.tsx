import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Meeting, Project, Agent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarClock,
  FolderKanban,
  Clock,
  Circle,
  ArrowRight,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  type: "meeting" | "schedule" | "project";
  date: Date;
  endDate?: Date;
  status: string;
  meta?: string;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function isInRange(date: Date, start: Date, end: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLORS = {
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  schedule: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  project: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const DOT_COLORS = {
  meeting: "bg-blue-400",
  schedule: "bg-emerald-400",
  project: "bg-purple-400",
};

// ─── Event badge component ────────────────────────────────────
function EventPill({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const colorClass = EVENT_COLORS[event.type];
  const icon =
    event.type === "meeting" ? (
      <Users className="h-3 w-3 shrink-0" />
    ) : event.type === "schedule" ? (
      <CalendarClock className="h-3 w-3 shrink-0" />
    ) : (
      <FolderKanban className="h-3 w-3 shrink-0" />
    );

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${colorClass}`}
        title={event.title}
      >
        {icon}
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}
      data-testid={`calendar-event-${event.id}`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{event.title}</div>
        {event.meta && (
          <div className="text-[10px] opacity-70 truncate">{event.meta}</div>
        )}
      </div>
      <div className="text-[10px] opacity-60 shrink-0">
        {formatTime(event.date)}
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────
function MonthView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: CalendarEvent[];
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const today = new Date();

  // Build 6 weeks of days
  const weeks: Date[][] = [];
  let day = calStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
    // Stop if we've passed end of month and completed a week
    if (day > monthEnd && w >= 3) break;
  }

  function getEventsForDay(d: Date) {
    return events.filter((e) => {
      if (e.endDate) {
        return isInRange(d, e.date, e.endDate);
      }
      return isSameDay(e.date, d);
    });
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((d, di) => {
            const isToday = isSameDay(d, today);
            const isCurrentMonth = d.getMonth() === currentDate.getMonth();
            const dayEvents = getEventsForDay(d);

            return (
              <div
                key={di}
                className={`min-h-[100px] p-1.5 border-r last:border-r-0 transition-colors ${
                  isCurrentMonth ? "bg-background" : "bg-muted/10"
                } ${isToday ? "ring-1 ring-primary/40 ring-inset" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from(new Set(dayEvents.map((e) => e.type))).map(
                        (type) => (
                          <Circle
                            key={type}
                            className={`h-1.5 w-1.5 fill-current ${
                              DOT_COLORS[type as keyof typeof DOT_COLORS]
                            }`}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <EventPill key={ev.id} event={ev} compact />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────
function WeekView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: CalendarEvent[];
}) {
  const weekStart = startOfWeek(currentDate);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function getEventsForDay(d: Date) {
    return events.filter((e) => {
      if (e.endDate) return isInRange(d, e.date, e.endDate);
      return isSameDay(e.date, d);
    });
  }

  return (
    <div className="grid grid-cols-7 gap-3">
      {days.map((d, i) => {
        const isToday = isSameDay(d, today);
        const dayEvents = getEventsForDay(d);

        return (
          <div
            key={i}
            className={`rounded-xl border p-3 min-h-[400px] ${
              isToday ? "ring-1 ring-primary/40 border-primary/30" : ""
            }`}
          >
            <div className="text-center mb-3">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                {WEEKDAYS[d.getDay()]}
              </div>
              <div
                className={`text-lg font-bold mt-0.5 ${
                  isToday ? "text-primary" : ""
                }`}
              >
                {d.getDate()}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {d.toLocaleDateString("en-US", { month: "short" })}
              </div>
            </div>
            <div className="space-y-1.5">
              {dayEvents.map((ev) => (
                <EventPill key={ev.id} event={ev} compact />
              ))}
              {dayEvents.length === 0 && (
                <div className="text-[10px] text-muted-foreground/40 text-center pt-4">
                  No events
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day view ─────────────────────────────────────────────────
function DayView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: CalendarEvent[];
}) {
  const dayEvents = events.filter((e) => {
    if (e.endDate) return isInRange(currentDate, e.date, e.endDate);
    return isSameDay(e.date, currentDate);
  });
  const isToday = isSameDay(currentDate, new Date());

  // Group by type
  const grouped = {
    meeting: dayEvents.filter((e) => e.type === "meeting"),
    schedule: dayEvents.filter((e) => e.type === "schedule"),
    project: dayEvents.filter((e) => e.type === "project"),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-4">
        <div className="text-sm text-muted-foreground uppercase font-semibold">
          {WEEKDAYS[currentDate.getDay()]}
        </div>
        <div
          className={`text-4xl font-bold mt-1 ${isToday ? "text-primary" : ""}`}
        >
          {currentDate.getDate()}
        </div>
        <div className="text-sm text-muted-foreground">
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </div>
        {isToday && (
          <Badge variant="outline" className="mt-2 text-primary border-primary/30">
            Today
          </Badge>
        )}
      </div>

      {dayEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/60">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No events scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.meeting.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-400">
                  Meetings ({grouped.meeting.length})
                </h3>
              </div>
              <div className="space-y-2">
                {grouped.meeting.map((e) => (
                  <EventPill key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
          {grouped.schedule.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-400">
                  Scheduled Tasks ({grouped.schedule.length})
                </h3>
              </div>
              <div className="space-y-2">
                {grouped.schedule.map((e) => (
                  <EventPill key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
          {grouped.project.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-400">
                  Projects ({grouped.project.length})
                </h3>
              </div>
              <div className="space-y-2">
                {grouped.project.map((e) => (
                  <EventPill key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agenda view ──────────────────────────────────────────────
function AgendaView({ events }: { events: CalendarEvent[] }) {
  // Group events by date, show next 14 days from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { date: Date; events: CalendarEvent[] }[] = [];

  for (let i = 0; i < 30; i++) {
    const d = addDays(today, i);
    const dayEvents = events.filter((e) => {
      if (e.endDate) return isInRange(d, e.date, e.endDate);
      return isSameDay(e.date, d);
    });
    if (dayEvents.length > 0) {
      days.push({ date: d, events: dayEvents });
    }
  }

  if (days.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/60">
        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No upcoming events in the next 30 days</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-1">
      {days.map(({ date, events: dayEvts }) => {
        const isToday = isSameDay(date, new Date());
        return (
          <div key={date.toISOString()} className="flex gap-4">
            <div className="w-20 shrink-0 pt-3 text-right">
              <div
                className={`text-sm font-bold ${
                  isToday ? "text-primary" : "text-foreground"
                }`}
              >
                {formatDate(date)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {WEEKDAYS[date.getDay()]}
              </div>
            </div>
            <div className="flex-1 space-y-1.5 pb-4 border-l border-border/50 pl-4">
              {dayEvts.map((ev) => (
                <EventPill key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function CompanyCalendar() {
  const [view, setView] = useState<"month" | "week" | "day" | "agenda">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<"all" | "meeting" | "schedule" | "project">("all");

  // Fetch data
  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    refetchInterval: 10000,
  });
  const { data: scheduledTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/scheduled-tasks"],
    refetchInterval: 10000,
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 10000,
  });
  const { data: roadmap = {} } = useQuery<any>({
    queryKey: ["/api/roadmap"],
    refetchInterval: 10000,
  });
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents]
  );

  // Build unified events
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    // Meetings → use createdAt as date
    for (const m of meetings) {
      const dt = new Date(m.createdAt);
      if (isNaN(dt.getTime())) continue;
      const agentNames = m.agentIds
        .slice(0, 3)
        .map((id) => agentMap.get(id)?.name || `Agent #${id}`)
        .join(", ");
      result.push({
        id: `meeting-${m.id}`,
        title: m.title,
        type: "meeting",
        date: dt,
        status: m.status,
        meta: agentNames + (m.agentIds.length > 3 ? ` +${m.agentIds.length - 3}` : ""),
        color: "blue",
      });
    }

    // Scheduled tasks → use nextRun as date
    for (const s of scheduledTasks) {
      if (!s.nextRun) continue;
      const dt = new Date(s.nextRun);
      if (isNaN(dt.getTime())) continue;
      const schedTitle = s.title || s.name || s.taskType || "Scheduled Task";
      result.push({
        id: `schedule-${s.id}`,
        title: schedTitle,
        type: "schedule",
        date: dt,
        status: s.status,
        meta: `${s.frequency || "custom"} · ${s.status}`,
        color: "emerald",
      });

      // Also generate recurring instances for the next 30 days
      if (s.frequency && s.status === "active") {
        const freq = s.frequency.toLowerCase();
        let intervalDays = 0;
        if (freq.includes("hour")) intervalDays = 0; // skip hourly for calendar
        else if (freq.includes("daily") || freq === "every day") intervalDays = 1;
        else if (freq.includes("week")) intervalDays = 7;
        else if (freq.includes("2 day") || freq.includes("other day")) intervalDays = 2;
        else if (freq.includes("3 day")) intervalDays = 3;
        else if (freq.includes("biweek") || freq.includes("bi-week")) intervalDays = 14;

        if (intervalDays > 0) {
          let nextDate = addDays(dt, intervalDays);
          const limit = addDays(new Date(), 30);
          let count = 0;
          while (nextDate <= limit && count < 30) {
            result.push({
              id: `schedule-${s.id}-r${count}`,
              title: schedTitle,
              type: "schedule",
              date: new Date(nextDate),
              status: s.status,
              meta: `${s.frequency || "custom"} · recurring`,
              color: "emerald",
            });
            nextDate = addDays(nextDate, intervalDays);
            count++;
          }
        }
      }
    }

    // Projects with roadmap dates → use plannedStart/plannedEnd as date range
    const roadmapProjects = roadmap?.projects || {};
    for (const p of projects) {
      const rp = roadmapProjects[String(p.id)];
      if (rp?.plannedStart) {
        const start = new Date(rp.plannedStart);
        const end = rp.plannedEnd ? new Date(rp.plannedEnd) : start;
        if (isNaN(start.getTime())) continue;
        result.push({
          id: `project-${p.id}`,
          title: p.title,
          type: "project",
          date: start,
          endDate: end,
          status: p.status,
          meta: `${p.status} · ${p.progress}% complete`,
          color: "purple",
        });
      } else if (p.createdAt) {
        // Fallback: use createdAt for projects without roadmap dates
        const dt = new Date(p.createdAt);
        if (isNaN(dt.getTime())) continue;
        result.push({
          id: `project-${p.id}`,
          title: p.title,
          type: "project",
          date: dt,
          status: p.status,
          meta: `${p.status} · ${p.progress}% complete`,
          color: "purple",
        });
      }
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [meetings, scheduledTasks, projects, roadmap, agentMap]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return events;
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  // Navigation
  function navigate(dir: -1 | 1) {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else if (view === "day") d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }
  function goToday() {
    setCurrentDate(new Date());
  }

  // Header label
  const headerLabel =
    view === "month"
      ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
      ? `${formatDate(startOfWeek(currentDate))} – ${formatDate(
          addDays(startOfWeek(currentDate), 6)
        )}`
      : view === "day"
      ? currentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "Upcoming Agenda";

  // Stats
  const totalMeetings = events.filter((e) => e.type === "meeting").length;
  const totalSchedules = events.filter((e) => e.type === "schedule").length;
  const totalProjects = events.filter((e) => e.type === "project").length;

  return (
    <div className="p-6 space-y-6" data-testid="company-calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Company Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified view of meetings, schedules, and projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium">
              <Users className="h-3 w-3" />
              {totalMeetings} meetings
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium">
              <CalendarClock className="h-3 w-3" />
              {totalSchedules} scheduled
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[11px] font-medium">
              <FolderKanban className="h-3 w-3" />
              {totalProjects} projects
            </div>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(-1)}
                data-testid="calendar-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                data-testid="calendar-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(1)}
                data-testid="calendar-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold ml-2">{headerLabel}</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Type filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {(["all", "meeting", "schedule", "project"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      typeFilter === f
                        ? f === "meeting"
                          ? "bg-blue-500/20 text-blue-400"
                          : f === "schedule"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : f === "project"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`filter-${f}`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
                  </button>
                ))}
              </div>

              {/* View switcher */}
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="month" className="text-xs px-2.5" data-testid="view-month">
                    Month
                  </TabsTrigger>
                  <TabsTrigger value="week" className="text-xs px-2.5" data-testid="view-week">
                    Week
                  </TabsTrigger>
                  <TabsTrigger value="day" className="text-xs px-2.5" data-testid="view-day">
                    Day
                  </TabsTrigger>
                  <TabsTrigger value="agenda" className="text-xs px-2.5" data-testid="view-agenda">
                    Agenda
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar content */}
      <div>
        {view === "month" && (
          <MonthView currentDate={currentDate} events={filteredEvents} />
        )}
        {view === "week" && (
          <WeekView currentDate={currentDate} events={filteredEvents} />
        )}
        {view === "day" && (
          <DayView currentDate={currentDate} events={filteredEvents} />
        )}
        {view === "agenda" && <AgendaView events={filteredEvents} />}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/40" />
          Meetings
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" />
          Scheduled Tasks
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500/40" />
          Projects
        </div>
      </div>
    </div>
  );
}
