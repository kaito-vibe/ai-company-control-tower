import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent } from "@shared/schema";
import {
  Rocket, Building2, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, X, Users, GitBranch, BookOpen, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface CompanyTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  agents: { name: string; role: string; department: string; avatar: string }[];
  workflows: { name: string }[];
  sops: { title: string }[];
}

interface ApplyResult {
  agents: number;
  workflows: number;
  sops: number;
}

const STEPS = ["Welcome", "Choose Template", "Applying", "Complete"] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<CompanyTemplate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CompanyTemplate[]>({
    queryKey: ["/api/company-templates"],
    enabled: step === 1,
  });

  const applyMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiRequest("POST", "/api/company-templates/apply", { templateId }).then(r => r.json()),
    onSuccess: (data: ApplyResult) => {
      setApplyResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      setStep(3);
    },
  });

  const { data: settings } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest("PATCH", "/api/settings", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); },
  });

  const needsOnboarding = settings?.onboardingComplete !== true && agents.length <= 1 && !dismissed;

  if (!needsOnboarding) {
    return null;
  }

  const progressValue = ((step + 1) / STEPS.length) * 100;

  function handleSelectTemplate(template: CompanyTemplate) {
    setSelectedTemplate(template);
  }

  function handleApplyTemplate() {
    if (!selectedTemplate) return;
    setStep(2);
    applyMutation.mutate(selectedTemplate.id);
  }

  function handleSkip() {
    setDismissed(true);
    updateSettingsMutation.mutate({ onboardingComplete: true });
  }

  function handleGetStarted() {
    setDismissed(true);
    updateSettingsMutation.mutate({ onboardingComplete: true });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      data-testid="onboarding-wizard-overlay"
    >
      <Card className="w-full max-w-2xl mx-4 shadow-2xl border-border">
        <CardHeader className="relative pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      i < step
                        ? "bg-primary text-primary-foreground"
                        : i === step
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${i}`}
                  >
                    {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-0.5 transition-colors ${
                        i < step ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            {step < 2 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                data-testid="onboarding-skip"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Progress value={progressValue} className="h-1" />
        </CardHeader>

        <CardContent className="pt-6 pb-8">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6" data-testid="onboarding-step-welcome">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl">Welcome to Control Tower!</CardTitle>
                <CardDescription className="text-base">
                  Let's set up your AI company. We'll help you choose a template
                  to get started with pre-configured agents and workflows.
                </CardDescription>
              </div>
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  data-testid="onboarding-skip-welcome"
                >
                  Skip Setup
                </Button>
                <Button
                  onClick={() => setStep(1)}
                  data-testid="onboarding-next-welcome"
                >
                  Get Started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Choose Template */}
          {step === 1 && (
            <div className="space-y-4" data-testid="onboarding-step-templates">
              <div className="text-center space-y-1 mb-6">
                <CardTitle className="text-xl">Choose a Company Template</CardTitle>
                <CardDescription>
                  Pick a template that fits your needs. You can customize everything later.
                </CardDescription>
              </div>

              {templatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No templates available.
                </div>
              ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        selectedTemplate?.id === template.id
                          ? "border-primary ring-2 ring-primary/20"
                          : ""
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                      data-testid={`template-card-${template.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{template.name}</span>
                              <Badge variant="secondary">{template.industry}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {template.agents.length} agents
                              </span>
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {template.workflows.length} workflows
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {template.sops.length} SOPs
                              </span>
                            </div>
                          </div>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-1" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(0)}
                  data-testid="onboarding-back-templates"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    data-testid="onboarding-skip-templates"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleApplyTemplate}
                    disabled={!selectedTemplate}
                    data-testid="onboarding-apply-template"
                  >
                    Apply Template <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Applying Template */}
          {step === 2 && (
            <div className="text-center space-y-6 py-8" data-testid="onboarding-step-applying">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl">Setting Up Your Company</CardTitle>
                <CardDescription className="text-base">
                  Applying the <strong>{selectedTemplate?.name}</strong> template...
                  <br />
                  Creating agents and workflows.
                </CardDescription>
              </div>
              {applyMutation.isError && (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">
                    Something went wrong: {applyMutation.error?.message || "Unknown error"}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                    }}
                    data-testid="onboarding-retry"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6" data-testid="onboarding-step-success">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl">You're All Set!</CardTitle>
                <CardDescription className="text-base">
                  Your AI company has been configured with the{" "}
                  <strong>{selectedTemplate?.name}</strong> template.
                </CardDescription>
              </div>

              {applyResult && (
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{applyResult.agents}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                      <Users className="h-3 w-3" /> Agents
                    </div>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{applyResult.workflows}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                      <GitBranch className="h-3 w-3" /> Workflows
                    </div>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{applyResult.sops}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                      <BookOpen className="h-3 w-3" /> SOPs
                    </div>
                  </div>
                </div>
              )}

              <Button
                size="lg"
                onClick={handleGetStarted}
                data-testid="onboarding-get-started"
              >
                Get Started <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
