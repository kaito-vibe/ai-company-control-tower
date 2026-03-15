import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Users, ListTodo, FolderKanban, MessageSquare, GitBranch, BookOpen, Search } from "lucide-react";

interface SearchResults {
  agents: any[];
  tasks: any[];
  projects: any[];
  meetings: any[];
  workflows: any[];
  knowledge: any[];
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ agents: [], tasks: [], projects: [], meetings: [], workflows: [], knowledge: [] });
  const [, navigate] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ agents: [], tasks: [], projects: [], meetings: [], workflows: [], knowledge: [] });
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  const hasResults = results.agents.length + results.tasks.length + results.projects.length + results.meetings.length + results.workflows.length + results.knowledge.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:bg-muted transition-colors"
        data-testid="button-command-search"
      >
        <Search className="h-3 w-3" />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search agents, tasks, projects, meetings..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-command-search"
        />
        <CommandList>
          {!hasResults && query.trim() && <CommandEmpty>No results found.</CommandEmpty>}
          {!query.trim() && (
            <CommandGroup heading="Quick Navigation">
              <CommandItem onSelect={() => go("/")} data-testid="cmd-nav-dashboard">Dashboard</CommandItem>
              <CommandItem onSelect={() => go("/tasks")} data-testid="cmd-nav-tasks">Agent Tasks</CommandItem>
              <CommandItem onSelect={() => go("/meetings")} data-testid="cmd-nav-meetings">Meetings</CommandItem>
              <CommandItem onSelect={() => go("/projects")} data-testid="cmd-nav-projects">Projects</CommandItem>
              <CommandItem onSelect={() => go("/org-chart")} data-testid="cmd-nav-orgchart">Org Chart</CommandItem>
              <CommandItem onSelect={() => go("/products")} data-testid="cmd-nav-products">Products</CommandItem>
            </CommandGroup>
          )}
          {results.agents.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Agents">
                {results.agents.map((a: any) => (
                  <CommandItem key={`agent-${a.id}`} onSelect={() => go("/org-chart")} data-testid={`cmd-agent-${a.id}`}>
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{a.name}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{a.department}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {results.tasks.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tasks">
                {results.tasks.map((t: any) => (
                  <CommandItem key={`task-${t.id}`} onSelect={() => go("/tasks")} data-testid={`cmd-task-${t.id}`}>
                    <ListTodo className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{t.title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{t.status}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {results.projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Projects">
                {results.projects.map((p: any) => (
                  <CommandItem key={`proj-${p.id}`} onSelect={() => go("/projects")} data-testid={`cmd-project-${p.id}`}>
                    <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{p.title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{p.status}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {results.meetings.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Meetings">
                {results.meetings.map((m: any) => (
                  <CommandItem key={`meet-${m.id}`} onSelect={() => go("/meetings")} data-testid={`cmd-meeting-${m.id}`}>
                    <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{m.title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{m.status}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {results.workflows.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Workflows">
                {results.workflows.map((w: any) => (
                  <CommandItem key={`wf-${w.id}`} onSelect={() => go("/workflows")} data-testid={`cmd-workflow-${w.id}`}>
                    <GitBranch className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{w.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {results.knowledge.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Knowledge Base">
                {results.knowledge.map((k: any) => (
                  <CommandItem key={`kb-${k.id}`} onSelect={() => go("/knowledge")} data-testid={`cmd-knowledge-${k.id}`}>
                    <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{k.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
