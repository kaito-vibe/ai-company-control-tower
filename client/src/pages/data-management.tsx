import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, apiUrl } from "@/lib/utils";
import type { CompanyTemplate, ApiLogEntry } from "@shared/schema";
import { Download, Upload, RotateCcw, Database, AlertTriangle, CheckCircle2, Building2, Loader2, Activity, Clock, FileText, Users, ListTodo, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DataManagement() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [exportSummary, setExportSummary] = useState<any>(null);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);

  const { data: templates = [] } = useQuery<CompanyTemplate[]>({ queryKey: ["/api/company-templates"] });
  const { data: activityLog = [] } = useQuery<ApiLogEntry[]>({ queryKey: ["/api/activity-log"], refetchInterval: 10000 });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => apiRequest("POST", "/api/company-templates/apply", { templateId }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setApplyingTemplate(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/data/reset"),
    onSuccess: () => {
      // Invalidate everything
      queryClient.invalidateQueries();
      setShowResetDialog(false);
    },
  });

  async function handleExport() {
    try {
      const res = await fetch(apiUrl("/api/data/export"));
      const data = await res.json();
      setExportSummary(data.summary);
      setLastExportTime(new Date().toISOString());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `control-tower-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await apiRequest("POST", "/api/data/import", data);
        queryClient.invalidateQueries();
        setImportStatus("success");
        setTimeout(() => setImportStatus("idle"), 3000);
      } catch {
        setImportStatus("error");
        setTimeout(() => setImportStatus("idle"), 3000);
      }
    };
    input.click();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-bold">Data Management</h1>
        <p className="text-sm text-muted-foreground">Export, import, templates, and activity log</p>
      </div>

      <Tabs defaultValue="data" className="flex-1 flex flex-col overflow-hidden px-4">
        <TabsList className="w-fit">
          <TabsTrigger value="data" data-testid="tab-data"><Database className="h-3.5 w-3.5 mr-1.5" />Data</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates"><Building2 className="h-3.5 w-3.5 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity"><Activity className="h-3.5 w-3.5 mr-1.5" />Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="flex-1 overflow-auto mt-4">
          <div className="space-y-4 max-w-2xl">
            {/* Persistence Info */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-cyan-500/10">
                  <Database className="h-4.5 w-4.5 text-cyan-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Persistent Storage</h3>
                  <p className="text-xs text-muted-foreground">Data is automatically saved to disk and survives server restarts</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All agents, tasks, projects, meetings, finances, and token usage data are persisted in a local JSON file.
                When the server restarts or is redeployed, your data is automatically restored.
              </p>
            </Card>

            {/* Export */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Download className="h-4 w-4 text-green-500" />
                    Export Data
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Download a complete backup of all data as JSON</p>
                </div>
                <Button onClick={handleExport} variant="outline" size="sm" className="gap-2" data-testid="button-export">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
              {exportSummary && (
                <div className="mt-3 pt-3 border-t">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {exportSummary.agents !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        <span><span className="font-medium text-foreground">{exportSummary.agents}</span> agents</span>
                      </div>
                    )}
                    {exportSummary.tasks !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ListTodo className="h-3.5 w-3.5 text-amber-500" />
                        <span><span className="font-medium text-foreground">{exportSummary.tasks}</span> tasks</span>
                      </div>
                    )}
                    {exportSummary.projects !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FolderKanban className="h-3.5 w-3.5 text-purple-500" />
                        <span><span className="font-medium text-foreground">{exportSummary.projects}</span> projects</span>
                      </div>
                    )}
                    {exportSummary.meetings !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 text-green-500" />
                        <span><span className="font-medium text-foreground">{exportSummary.meetings}</span> meetings</span>
                      </div>
                    )}
                  </div>
                  {lastExportTime && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Last exported: {new Date(lastExportTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Import */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4 text-blue-500" />
                    Import Data
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Restore from a previously exported JSON backup file</p>
                </div>
                <div className="flex items-center gap-2">
                  {importStatus === "success" && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Imported
                    </span>
                  )}
                  {importStatus === "error" && (
                    <span className="text-xs text-red-500">Failed</span>
                  )}
                  <Button onClick={handleImport} variant="outline" size="sm" className="gap-2" data-testid="button-import">
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Button>
                </div>
              </div>
            </Card>

            {/* Reset */}
            <Card className="p-4 border-red-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-red-400">
                    <RotateCcw className="h-4 w-4" />
                    Reset All Data
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Wipe everything and start fresh with only the CEO agent</p>
                </div>
                <Button onClick={() => setShowResetDialog(true)} variant="destructive" size="sm" className="gap-2" data-testid="button-reset">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="flex-1 overflow-auto mt-4">
          <div className="max-w-4xl">
            <p className="text-sm text-muted-foreground mb-4">Apply a pre-built company template to quickly set up agents, workflows, and SOPs.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => (
                <Card key={t.id} className="p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{t.industry}</Badge>
                    <span className="text-sm font-semibold">{t.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex-1 mb-3">{t.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                    <span>{t.agents.length} agents</span>
                    <span>{t.workflows.length} workflows</span>
                    <span>{t.sops.length} SOPs</span>
                  </div>
                  <div className="flex gap-1 flex-wrap mb-3">
                    {t.agents.map((a, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{a.avatar || "🤖"} {a.name}</span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => { setApplyingTemplate(t.id); applyTemplateMutation.mutate(t.id); }}
                    disabled={applyTemplateMutation.isPending}
                    data-testid={`button-apply-template-${t.id}`}
                  >
                    {applyTemplateMutation.isPending && applyingTemplate === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5" />
                    )}
                    Apply Template
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="flex-1 overflow-hidden mt-4">
          <div className="h-full flex flex-col max-w-4xl">
            <p className="text-sm text-muted-foreground mb-3">Audit log of all POST, PATCH, PUT, and DELETE API calls.</p>
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="divide-y">
                {activityLog.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No API activity logged yet</div>
                ) : activityLog.map(entry => {
                  const methodColors: Record<string, string> = { POST: "text-green-400", PATCH: "text-yellow-400", PUT: "text-blue-400", DELETE: "text-red-400" };
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/30">
                      <Badge variant="outline" className={`font-mono text-[10px] ${methodColors[entry.method] || ""}`}>{entry.method}</Badge>
                      <span className="font-mono flex-1 truncate">{entry.path}</span>
                      <Badge variant={entry.statusCode < 400 ? "outline" : "destructive"} className="text-[10px]">{entry.statusCode}</Badge>
                      <span className="text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reset All Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all agents, tasks, projects, meetings, financial data, and token usage stats.
              Only the CEO agent (Atlas) will remain. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
