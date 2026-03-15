import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HelpEntry {
  title: string;
  tips: string[];
}

const helpContent: Record<string, HelpEntry> = {
  dashboard: {
    title: "Dashboard",
    tips: [
      "Overview of your AI company at a glance",
      "View agent counts, task stats, and financial summary",
      "Click any card to navigate to the detailed page",
    ],
  },
  "org-chart": {
    title: "Organization Chart",
    tips: [
      "Visualize your AI agent hierarchy",
      "Click an agent to edit their details or add sub-agents",
      "Drag agents to reorganize the structure",
      "Set autonomy levels to control auto-approval",
    ],
  },
  tasks: {
    title: "Agent Tasks",
    tips: [
      "View and manage all agent tasks",
      "Tasks go through: pending \u2192 thinking \u2192 proposal_ready \u2192 approved \u2192 executing \u2192 completed",
      "Use bulk actions to manage multiple tasks at once",
    ],
  },
  meetings: {
    title: "Board Meetings",
    tips: [
      "Host AI-powered discussions between agents",
      "Select agents to participate and set a topic",
      "Agents will autonomously discuss and propose actions",
    ],
  },
  projects: {
    title: "Projects",
    tips: [
      "Track project progress and milestones",
      "Projects can be derived from meetings",
      "View tasks linked to each project",
    ],
  },
  finances: {
    title: "Finances",
    tips: [
      "Track earnings and expenditures",
      "View cost breakdowns by department and agent",
      "Monitor your AI company's financial health",
    ],
  },
  strategy: {
    title: "Strategy & OKRs",
    tips: [
      "Set objectives and key results",
      "Link key results to tasks for auto-progress tracking",
      "Use 0-1.0 scoring for precise measurement",
    ],
  },
  risks: {
    title: "Risk Register",
    tips: [
      "Track and mitigate project risks",
      "Use the risk matrix to visualize probability vs impact",
      "Assign risk owners for accountability",
    ],
  },
  analytics: {
    title: "Analytics",
    tips: [
      "View detailed charts and metrics",
      "Track task completion trends over time",
      "Analyze agent workload distribution",
    ],
  },
  settings: {
    title: "Settings",
    tips: [
      "Configure company profile and preferences",
      "Set default AI model and notification preferences",
      "Manage data retention policies",
    ],
  },
};

const defaultHelp: HelpEntry = {
  title: "Help",
  tips: [
    "Navigate using the sidebar",
    "Use Ctrl+K to search commands",
    "Check the dashboard for an overview",
  ],
};

export function HelpButton({ page }: { page: string }) {
  const { title, tips } = helpContent[page] ?? defaultHelp;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          data-testid="button-help"
        >
          <HelpCircle size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
