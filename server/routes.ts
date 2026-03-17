import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import type { SQLiteStorage } from "./storage-sqlite";
import OpenAI from "openai";
import { getAllTools, getToolsForAgent, getToolDescriptionsForPrompt, parseToolCalls, executeToolCalls, type ToolContext } from "./tools";
import { executeSandboxedCode } from "./sandbox";

const openai = new OpenAI();
const DEFAULT_MODEL = "gpt5_nano";

// Available models grouped by tier
const AI_MODELS = [
  { id: "claude_opus_4_6", name: "Claude Opus 4.6", tier: "premium", costPer1MInput: 1500, costPer1MOutput: 7500 },
  { id: "claude_sonnet_4_6", name: "Claude Sonnet 4.6", tier: "standard", costPer1MInput: 300, costPer1MOutput: 1500 },
  { id: "claude_haiku_4_5", name: "Claude Haiku 4.5", tier: "economy", costPer1MInput: 80, costPer1MOutput: 400 },
  { id: "gpt5_nano", name: "GPT-5 Nano", tier: "economy", costPer1MInput: 10, costPer1MOutput: 40 },
  { id: "gpt_5_1", name: "GPT-5.1", tier: "standard", costPer1MInput: 300, costPer1MOutput: 1200 },
  { id: "gpt_5_4", name: "GPT-5.4", tier: "premium", costPer1MInput: 1000, costPer1MOutput: 5000 },
  { id: "gemini_3_flash", name: "Gemini 3 Flash", tier: "economy", costPer1MInput: 10, costPer1MOutput: 40 },
  { id: "gemini_3_pro", name: "Gemini 3 Pro", tier: "standard", costPer1MInput: 125, costPer1MOutput: 500 },
  { id: "gemini_3_1_pro", name: "Gemini 3.1 Pro", tier: "standard", costPer1MInput: 125, costPer1MOutput: 500 },
];

// Resolve which model to use for a given agent
async function resolveModel(agentId?: number | null): Promise<string> {
  if (agentId) {
    const agent = await storage.getAgent(agentId);
    if (agent?.model) return agent.model;
  }
  const settings = await storage.getSettings();
  return settings.defaultModel || DEFAULT_MODEL;
}

function getModelCosts(modelId: string): { costPer1MInput: number; costPer1MOutput: number } {
  const model = AI_MODELS.find(m => m.id === modelId);
  return model || { costPer1MInput: 10, costPer1MOutput: 40 };
}

const WORKFLOW_STAGES = ["design", "development", "testing", "review", "deploy"];

// Build a full company context snapshot so every agent knows the complete picture
async function getCompanyContext(): Promise<string> {
  const agents = await storage.getAgents();
  const tasks = await storage.getAgentTasks();
  const projects = await storage.getProjects();
  const meetings = await storage.getMeetings();
  const goals = await storage.getGoals();

  const sections: string[] = [];

  // Org chart
  sections.push("=== ORGANIZATION ===");
  for (const a of agents) {
    const manager = a.parentId ? agents.find(p => p.id === a.parentId) : null;
    sections.push(`- ${a.avatar} ${a.name} | ${a.role} | ${a.department} | Reports to: ${manager ? manager.name : '(top-level)'} [ID:${a.id}]`);
  }

  // Projects summary
  sections.push("\n=== PROJECTS ===");
  for (const p of projects) {
    const assignee = p.assignedAgentId ? agents.find(a => a.id === p.assignedAgentId)?.name : 'unassigned';
    sections.push(`- [${p.status.toUpperCase()}] "${p.title}" (${p.priority}) — ${assignee} — ${p.completedTasks ?? 0}/${p.totalTasks ?? 0} tasks done`);
  }

  // Tasks grouped by status
  sections.push("\n=== TASKS ===");
  const statusGroups: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!statusGroups[t.status]) statusGroups[t.status] = [];
    statusGroups[t.status].push(t);
  }
  for (const [status, group] of Object.entries(statusGroups)) {
    sections.push(`[${status.toUpperCase()}] (${group.length})`);
    for (const t of group.slice(0, 15)) { // cap per status to keep context manageable
      const assignee = agents.find(a => a.id === t.assignedAgentId)?.name || 'unassigned';
      const proj = t.projectId ? projects.find(p => p.id === t.projectId)?.title : null;
      const safeTitle = t.title.replace(/\\/g, '/').replace(/[\x00-\x1f]/g, '');
      let line = `  - "${safeTitle}" → ${assignee}`;
      if (proj) line += ` [Project: ${proj}]`;
      if (t.status === 'completed' && t.executionLog) {
        // Include a summary of completed work (first 120 chars)
        // Sanitize backslashes to prevent malformed escape sequences in JSON/API payloads
        const summary = t.executionLog.replace(/\n/g, ' ').replace(/\\/g, '/').replace(/[\x00-\x1f]/g, '').slice(0, 120);
        line += ` | Outcome: ${summary}`;
      }
      sections.push(line);
    }
    if (group.length > 15) sections.push(`  ... and ${group.length - 15} more`);
  }

  // Strategic Goals (OKRs)
  if (goals.length > 0) {
    sections.push("\n=== STRATEGIC GOALS (OKRs) ===");
    const objectives = goals.filter(g => g.type === "objective");
    const keyResults = goals.filter(g => g.type === "key_result");
    for (const obj of objectives) {
      const owner = obj.ownerId ? agents.find(a => a.id === obj.ownerId) : null;
      sections.push(`OBJECTIVE: "${obj.title}" [${obj.status}] — ${obj.progress}% — ${obj.quarter || 'N/A'}${owner ? ` — Owner: ${owner.name}` : ''}`);
      const krs = keyResults.filter(kr => kr.parentGoalId === obj.id);
      for (const kr of krs) {
        sections.push(`  KR: "${kr.title}" — ${kr.progress}%`);
      }
    }
    const orphanKRs = keyResults.filter(kr => !kr.parentGoalId || !objectives.find(o => o.id === kr.parentGoalId));
    if (orphanKRs.length > 0) {
      sections.push(`(${orphanKRs.length} unlinked key results)`);
    }
  }

  // Recent meetings
  const recentMeetings = meetings.slice(-5);
  if (recentMeetings.length > 0) {
    sections.push("\n=== RECENT MEETINGS ===");
    for (const m of recentMeetings) {
      sections.push(`- "${m.title}" (${m.status}) — Topic: ${m.topic || 'N/A'}`);
    }
  }

  return sections.join("\n");
}

// Tracked AI call — wraps openai.responses.create and auto-logs token costs
// Model is auto-resolved from agent -> settings -> default
async function trackedAI(
  params: { instructions: string; input: string; model?: string },
  context: { label: string; agentId?: number | null }
): Promise<{ output_text: string; usage: { input_tokens: number; output_tokens: number; total_tokens: number } }> {
  const model = params.model || await resolveModel(context.agentId);
  // Sanitize inputs to prevent malformed escape sequences that cause 422 errors
  // Replace backslashes that could form invalid JSON escape sequences (\x, \u, \g, etc.)
  const sanitize = (s: string) => s
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/\\/g, '/');
  const sanitizedParams = {
    ...params,
    instructions: sanitize(params.instructions),
    input: sanitize(params.input),
    model,
  };
  let response;
  try {
    response = await openai.responses.create(sanitizedParams);
  } catch (apiError: any) {
    // Detect credit/rate errors at the lowest level and trigger global pause
    if (isCreditOrRateError(apiError)) {
      enterCreditPause(apiError?.message || "API rate limit / credit exhaustion");
    }
    throw apiError; // Re-throw so caller's catch handles it
  }
  const usage = response.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  // Calculate cost based on model-specific pricing
  const costs = getModelCosts(model);
  const costCents = Math.round(
    (usage.input_tokens / 1_000_000) * costs.costPer1MInput +
    (usage.output_tokens / 1_000_000) * costs.costPer1MOutput
  * 100) / 100;

  // Record in cumulative token stats
  (storage as SQLiteStorage).recordTokenUsage(usage.input_tokens, usage.output_tokens, Math.ceil(costCents));

  // Auto-create an expenditure transaction (amount in cents, minimum 1 cent)
  const amountCents = Math.max(1, Math.ceil(costCents));
  try {
    await storage.createTransaction({
      type: "expenditure",
      category: "AI Compute",
      description: `[${model}] ${context.label} (${usage.input_tokens} in / ${usage.output_tokens} out)`,
      amount: amountCents,
      date: new Date().toISOString(),
      agentId: context.agentId ?? null,
    });
  } catch (e) {
    console.error("[token-track] Failed to create transaction:", (e as Error).message);
  }

  // Log to roadmap execution log for budget tracking
  try {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: {}, executionLog: [] };
    if (!roadmap.executionLog) roadmap.executionLog = [];
    roadmap.executionLog.push({
      date: new Date().toISOString(),
      label: context.label,
      agentId: context.agentId || null,
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      costCents: amountCents,
    });
    // Keep last 500 entries
    if (roadmap.executionLog.length > 500) roadmap.executionLog = roadmap.executionLog.slice(-500);
    await storage.updateSettings({ roadmapPlanning: roadmap });
  } catch (e) {
    // non-critical
  }

  return { output_text: response.output_text, usage };
}

// Helper: cascade after task status change — unblock dependents + update project + auto-complete parent
async function cascadeTaskCompletion(completedTaskId: number, projectId: number | null) {
  const allTasks = await storage.getAgentTasks();
  const completedTask = await storage.getAgentTask(completedTaskId);

  // 1. Unblock tasks that depend on this one
  for (const t of allTasks) {
    if (t.status !== "blocked" || !t.dependsOn) continue;
    try {
      const deps: number[] = JSON.parse(t.dependsOn);
      if (!deps.includes(completedTaskId)) continue;

      // Check if ALL dependencies are now completed or rejected (both unblock)
      let allDepsFinished = true;
      for (const depId of deps) {
        const depTask = await storage.getAgentTask(depId);
        if (!depTask || (depTask.status !== "completed" && depTask.status !== "rejected")) {
          allDepsFinished = false;
          break;
        }
      }
      if (allDepsFinished) {
        await storage.updateAgentTask(t.id, { status: "pending" });
        autoThinkTask(t.id);
      }
    } catch {}
  }

  // 2. Auto-complete parent task when ALL sub-tasks are done (completed OR rejected)
  if (completedTask?.parentTaskId) {
    const parentTask = await storage.getAgentTask(completedTask.parentTaskId);
    if (parentTask && (parentTask.status === "executing" || parentTask.status === "thinking")) {
      const siblingTasks = allTasks.filter(t => t.parentTaskId === parentTask.id);
      const allChildrenDone = siblingTasks.length > 0 && siblingTasks.every(
        t => t.status === "completed" || t.status === "rejected"
      );
      if (allChildrenDone) {
        const completedCount = siblingTasks.filter(t => t.status === "completed").length;
        const rejectedCount = siblingTasks.filter(t => t.status === "rejected").length;
        // Collect deliverables from all completed sub-tasks for context propagation
        const childDeliverables: string[] = [];
        for (const child of siblingTasks.filter(t => t.status === "completed")) {
          if (child.executionLog) childDeliverables.push(`[${child.title}]: ${child.executionLog.replace(/\\/g, '/').replace(/[\x00-\x1f]/g, '').slice(0, 300)}`);
        }
        await storage.updateAgentTask(parentTask.id, {
          status: "completed",
          executionLog: (parentTask.executionLog || "") + `\nAll ${siblingTasks.length} sub-tasks finished (${completedCount} completed, ${rejectedCount} rejected).` + (childDeliverables.length > 0 ? `\n\nSub-task outcomes:\n${childDeliverables.join("\n")}` : ""),
          completedAt: new Date().toISOString(),
        });
        console.log(`[cascade] Parent task ${parentTask.id} auto-completed — all ${siblingTasks.length} sub-tasks done`);
        await cascadeTaskCompletion(parentTask.id, parentTask.projectId);
      }
    }
  }

  // 3. Update project progress if this task belongs to one (count only top-level project tasks)
  if (projectId) {
    const projectTasks = await storage.getAgentTasksByProject(projectId);
    const topLevelTasks = projectTasks.filter(t => !t.parentTaskId);
    const total = topLevelTasks.length;
    const completed = topLevelTasks.filter(t => t.status === "completed").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const projectStatus = completed === total && total > 0 ? "completed" : total > 0 ? "in_progress" : "backlog";

    await storage.updateProject(projectId, {
      totalTasks: total,
      completedTasks: completed,
      progress,
      status: projectStatus,
    });

    // Auto-sync goal progress if project is linked to an objective
    const project = await storage.getProject(projectId);
    if (project && (project as any).goalId) {
      syncGoalProgress((project as any).goalId);
    } else {
      // Check if any objective references this project
      syncGoalProgress();
    }

    // Auto-timeline: project completed milestone
    if (projectStatus === "completed") {
      const completedProject = await storage.getProject(projectId);
      if (completedProject) {
        try {
          await storage.createTimelineEvent({
            type: "milestone",
            title: `Project completed: ${completedProject.title}`,
            description: `All ${total} tasks finished. Project "${completedProject.title}" is now complete.`,
            agentId: completedProject.assignedAgentId,
            department: null,
            timestamp: new Date().toISOString(),
          });
        } catch {}
      }
    }
  }

  // Auto-timeline: task completed
  if (completedTask) {
    const agent = completedTask.assignedAgentId ? await storage.getAgent(completedTask.assignedAgentId) : null;
    try {
      await storage.createTimelineEvent({
        type: "task_completed",
        title: `Task completed: ${completedTask.title}`,
        description: `${agent?.name || "Unknown agent"} completed "${completedTask.title}"`,
        agentId: completedTask.assignedAgentId,
        department: agent?.department || null,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }

  // 4. Auto-progress workflow: if completed task has workflowStage, start next stage task in same project
  if (completedTask?.workflowStage && projectId) {
    const stages = ["design", "development", "testing", "review", "deploy"];
    const currentIdx = stages.indexOf(completedTask.workflowStage);
    if (currentIdx >= 0 && currentIdx < stages.length - 1) {
      const nextStage = stages[currentIdx + 1];
      const projectTasks2 = await storage.getAgentTasksByProject(projectId);
      const nextTask = projectTasks2.find(t => t.workflowStage === nextStage && t.status === "pending");
      if (nextTask) {
        autoThinkTask(nextTask.id);
      }
    }
  }
}

// Auto-sync goal/objective progress from linked projects and tasks
async function syncGoalProgress(goalId?: number) {
  try {
    const goals = await storage.getGoals();
    const projects = await storage.getProjects();
    const allTasks = await storage.getAgentTasks();

    const objectivesToUpdate = goalId
      ? goals.filter(g => g.id === goalId && g.type === "objective")
      : goals.filter(g => g.type === "objective");

    for (const obj of objectivesToUpdate) {
      // Find all projects linked to this objective (via goalId)
      const linkedProjects = projects.filter(p => (p as any).goalId === obj.id);
      // Also include projects linked via linkedProjectIds on the goal
      const explicitIds: number[] = (obj as any).linkedProjectIds || [];
      const allLinkedProjectIds = new Set([
        ...linkedProjects.map(p => p.id),
        ...explicitIds,
      ]);
      const allLinkedProjects = projects.filter(p => allLinkedProjectIds.has(p.id));

      // Find key results for this objective
      const keyResults = goals.filter(g => g.type === "key_result" && g.parentGoalId === obj.id);

      let newProgress = 0;

      if (allLinkedProjects.length > 0 || keyResults.length > 0) {
        // Weighted calculation:
        // - If there are linked projects, use project-level task completion as the primary signal
        // - If there are KRs, average those in too
        const signals: number[] = [];

        if (allLinkedProjects.length > 0) {
          // Calculate progress from project tasks
          const projectIds = new Set(allLinkedProjects.map(p => p.id));
          const linkedTasks = allTasks.filter(t => t.projectId && projectIds.has(t.projectId) && !t.parentTaskId);
          if (linkedTasks.length > 0) {
            const completed = linkedTasks.filter(t => t.status === "completed").length;
            signals.push(Math.round((completed / linkedTasks.length) * 100));
          } else {
            // Fall back to average project progress
            const avgProjectProgress = Math.round(allLinkedProjects.reduce((s, p) => s + (p.progress || 0), 0) / allLinkedProjects.length);
            signals.push(avgProjectProgress);
          }
        }

        // Average in KR progress if any exist
        for (const kr of keyResults) {
          signals.push(kr.progress);
        }

        newProgress = signals.length > 0 ? Math.round(signals.reduce((s, v) => s + v, 0) / signals.length) : 0;
      }

      // Only update if progress actually changed
      if (newProgress !== obj.progress) {
        const newStatus = newProgress >= 100 ? "completed" : obj.status === "completed" && newProgress < 100 ? "active" : obj.status;
        await storage.updateGoal(obj.id, { progress: newProgress, status: newStatus });
        console.log(`[goal-sync] Objective #${obj.id} "${obj.title}" progress: ${obj.progress}% → ${newProgress}%`);
      }
    }
  } catch (err) {
    console.error("[goal-sync] Error:", err);
  }
}

// Execute a task through its workflow stages (design → development → testing → review → deploy)
async function executeWorkflowPipeline(taskId: number) {
  try {
    const task = await storage.getAgentTask(taskId);
    if (!task || task.status !== "executing") return;

    const agent = await storage.getAgent(task.assignedAgentId);
    if (!agent) return;

    const companyContext = await getCompanyContext();

    const startIdx = task.workflowStage
      ? WORKFLOW_STAGES.indexOf(task.workflowStage)
      : 0;
    const stages = WORKFLOW_STAGES.slice(startIdx >= 0 ? startIdx : 0);

    const stagePrompts: Record<string, string> = {
      design: "You are in the DESIGN phase. Produce a design specification: requirements, architecture decisions, data models, UI/UX considerations, and component breakdown. Be specific and actionable.",
      development: "You are in the DEVELOPMENT phase. Produce implementation details: code structure, key algorithms, API contracts, integration points, and technical decisions. Reference the design from the previous phase.",
      testing: "You are in the TESTING phase. Produce a test plan: test cases, edge cases, acceptance criteria, performance benchmarks, and quality gates. Reference the implementation from previous phases.",
      review: "You are in the REVIEW phase. Produce a review summary: evaluate the work done across all previous phases, identify risks, suggest improvements, and confirm readiness for deployment.",
      deploy: "You are in the DEPLOY phase. Produce a deployment plan: rollout steps, configuration changes, monitoring setup, rollback plan, and success criteria.",
    };

    // Collect stage outputs as deliverables
    const existingDeliverables: any[] = task.deliverables ? JSON.parse(task.deliverables) : [];
    const executionLogParts: string[] = task.executionLog ? [task.executionLog] : [];

    for (const stage of stages) {
      // Check if task was cancelled mid-pipeline
      const currentTask = await storage.getAgentTask(taskId);
      if (!currentTask || currentTask.status !== "executing") {
        console.log(`[workflow] Task ${taskId} status changed to ${currentTask?.status} — aborting pipeline`);
        return;
      }
      // Update the stage so frontend shows progress
      await storage.updateAgentTask(taskId, { workflowStage: stage });

      const response = await trackedAI({
        
        instructions: `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You are executing a task through a structured workflow pipeline.\n\nCOMPANY CONTEXT:\n${companyContext}\n\n${stagePrompts[stage] || "Produce work for this phase."}\n\nKeep your output focused, professional, and under 300 words.`,
        input: `Task: ${task.title}\nDescription: ${task.description}\n\nPrevious work:\n${executionLogParts.join("\n---\n") || "(first phase)"}\n\nProduce your ${stage} phase output.`,
      }, { label: `Workflow:${stage} — ${task.title}`, agentId: agent.id });

      const output = response.output_text;
      executionLogParts.push(`[${stage.toUpperCase()}] ${output}`);

      // Add as deliverable
      existingDeliverables.push({
        id: `del_${stage}_${Date.now()}`,
        title: `${stage.charAt(0).toUpperCase() + stage.slice(1)} Phase`,
        type: stage === "development" ? "code" : stage === "design" ? "spec" : "document",
        content: output,
        producedBy: agent.id,
        version: 1,
        createdAt: new Date().toISOString(),
      });

      // Save progress after each stage
      await storage.updateAgentTask(taskId, {
        deliverables: JSON.stringify(existingDeliverables),
        executionLog: executionLogParts.join("\n---\n"),
      });
    }

    // All stages complete — mark task as completed
    await storage.updateAgentTask(taskId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    // Cascade: unblock dependents + update project progress
    const updatedTask = await storage.getAgentTask(taskId);
    if (updatedTask) {
      await cascadeTaskCompletion(taskId, updatedTask.projectId);
    }
  } catch (error: any) {
    console.error(`Workflow pipeline error for task ${taskId}:`, error);
    // Leave in executing state so user can see something went wrong
    try {
      await storage.updateAgentTask(taskId, {
        executionLog: `Pipeline error: ${error.message}`,
      });
    } catch {}
  }
}

// Manager Review: when an agent's proposal is ready, their manager (if any) reviews it before human approval
async function managerReviewTask(taskId: number): Promise<boolean> {
  // Returns true if manager review was triggered (caller should skip auto-approve), false otherwise
  if (_systemPaused) return false; // Skip review while system is paused
  if (_creditPaused) return false; // Skip review while credit-paused
  try {
    const task = await storage.getAgentTask(taskId);
    if (!task || task.status !== "proposal_ready") return false;

    const settings = await storage.getSettings();
    if (settings.managerReviewEnabled === false) return false;

    const agent = await storage.getAgent(task.assignedAgentId);
    if (!agent || !agent.parentId) return false;

    const manager = await storage.getAgent(agent.parentId);
    if (!manager) return false;

    // Skip if manager is the CEO (id=1) — CEO reviews happen via the human UI
    if (manager.id === 1) return false;

    // Parse current review round from executionLog
    let reviewRound = 0;
    if (task.executionLog) {
      const roundMatch = task.executionLog.match(/\[REVIEW:round=(\d+)\]/);
      if (roundMatch) reviewRound = parseInt(roundMatch[1], 10);
    }

    // Max 3 revision rounds to prevent infinite loops
    if (reviewRound >= 3) {
      const autoApproveLog = task.executionLog
        ? task.executionLog + `\n✓ Auto-approved after ${reviewRound} review rounds (max reached)`
        : `✓ Auto-approved after ${reviewRound} review rounds (max reached)`;
      await storage.updateAgentTask(task.id, { executionLog: autoApproveLog });
      console.log(`[managerReview] Auto-approved task ${taskId} after ${reviewRound} rounds`);
      return false; // Let normal flow proceed (proposal_ready for human)
    }

    // Set status to under_review
    await storage.updateAgentTask(task.id, { status: "under_review" });

    const companyContext = await getCompanyContext();
    const reviewPrompt = `You are ${manager.name}, ${manager.role}.

${manager.instructions || ""}

COMPANY CONTEXT:
${companyContext}

You are reviewing work from your direct report ${agent.name} (${agent.role}).

TASK: ${task.title}
DESCRIPTION: ${task.description}

AGENT'S PROPOSAL:
${task.proposal || "(no proposal text)"}

Review this proposal carefully. Consider:
- Is the analysis thorough and accurate?
- Is the proposed approach sound?
- Are there any risks or gaps not addressed?
- Does it align with company goals and your department's objectives?

If the proposal is good enough for the CEO's final review, respond with exactly: APPROVED
If it needs improvements, respond with exactly: REVISION_NEEDED followed by specific, actionable feedback on a new line.`;

    console.log(`[managerReview] Manager ${manager.name} reviewing task ${taskId} (round ${reviewRound + 1})`);

    const response = await trackedAI({
      instructions: reviewPrompt,
      input: `Review proposal for: ${task.title}`,
    }, { label: `Manager Review: ${task.title}`, agentId: manager.id });

    const reviewText = response.output_text.trim();

    if (reviewText.includes("APPROVED")) {
      // Manager approves — set back to proposal_ready for human review
      const approveLog = task.executionLog
        ? task.executionLog.replace(/\[REVIEW:round=\d+\]/, "").trim() + `\n✓ Reviewed by ${manager.name}: Approved`
        : `✓ Reviewed by ${manager.name}: Approved`;
      await storage.updateAgentTask(task.id, {
        status: "proposal_ready",
        executionLog: approveLog,
      });
      console.log(`[managerReview] Manager ${manager.name} approved task ${taskId}`);
      return true; // Review happened, but proposal is now ready for human
    } else {
      // Manager requests revision
      const feedback = reviewText.replace(/^REVISION_NEEDED\s*/i, "").trim();
      const newRound = reviewRound + 1;
      const revisionLog = task.executionLog
        ? task.executionLog.replace(/\[REVIEW:round=\d+\]/, "").trim() + `\n[REVIEW:round=${newRound}]\nManager feedback (round ${newRound}) from ${manager.name}: ${feedback}`
        : `[REVIEW:round=${newRound}]\nManager feedback (round ${newRound}) from ${manager.name}: ${feedback}`;

      await storage.updateAgentTask(task.id, {
        status: "thinking",
        executionLog: revisionLog,
      });
      console.log(`[managerReview] Manager ${manager.name} requested revision on task ${taskId} (round ${newRound})`);

      // Re-trigger autoThinkTask so the agent revises with manager feedback
      setTimeout(() => autoThinkTask(taskId), 500);
      return true; // Review is handling the flow
    }
  } catch (error: any) {
    console.error(`[managerReview] Error reviewing task ${taskId}:`, error);
    // On error, revert to proposal_ready so human can still review
    try {
      await storage.updateAgentTask(taskId, { status: "proposal_ready" });
    } catch {}
    return false;
  }
}

// Auto-think: run the thinking process for a task in the background
// Global concurrency limiter for AI calls
let _activeAICalls = 0;
const MAX_GLOBAL_CONCURRENT = 3;

// ==================== SYSTEM PAUSE (USER-TRIGGERED) ====================
// Global pause — freezes all task processing, watchdog, queue processor.
// Tasks resume exactly where they left off when unpaused.
let _systemPaused = false;
let _systemPausedAt: Date | null = null;

// ==================== CREDIT PAUSE SYSTEM ====================
// When the AI provider returns rate-limit (429) or quota/billing errors,
// the system pauses ALL task processing and retries with exponential backoff.
let _creditPaused = false;
let _creditPauseReason = "";
let _creditPausedAt: Date | null = null;
let _creditResumeAt: Date | null = null;
let _creditBackoffMinutes = 5; // starts at 5, doubles each failure, max 120
let _creditRetryTimer: ReturnType<typeof setTimeout> | null = null;
const CREDIT_BACKOFF_MAX = 120; // 2 hours max wait

function isCreditOrRateError(error: any): boolean {
  const msg = (error?.message || "").toLowerCase();
  const status = error?.status || error?.statusCode || 0;
  return (
    status === 429 ||
    status === 402 ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("credit") ||
    msg.includes("exceeded") ||
    msg.includes("too many requests")
  );
}

function enterCreditPause(reason: string) {
  if (_creditPaused) return; // already paused
  _creditPaused = true;
  _creditPauseReason = reason;
  _creditPausedAt = new Date();
  const resumeTime = new Date(Date.now() + _creditBackoffMinutes * 60 * 1000);
  _creditResumeAt = resumeTime;
  console.log(`[credit-pause] \u23f8 PAUSING all task processing: ${reason}`);
  console.log(`[credit-pause] Will retry in ${_creditBackoffMinutes} minutes at ${resumeTime.toISOString()}`);

  // Schedule a retry probe
  if (_creditRetryTimer) clearTimeout(_creditRetryTimer);
  scheduleCreditProbe();
}

function scheduleCreditProbe() {
  if (_creditRetryTimer) clearTimeout(_creditRetryTimer);
  _creditRetryTimer = setTimeout(async () => {
    console.log(`[credit-pause] Probing if credits/rate-limit reset...`);
    try {
      // Try a minimal API call to test if we're unblocked
      const testResponse = await openai.responses.create({
        model: "gpt-4o-mini",
        instructions: "Reply with just 'ok'",
        input: "ping",
      });
      if (testResponse.output_text) {
        // Success — resume!
        console.log(`[credit-pause] \u2705 Credits restored! Resuming task processing.`);
        _creditPaused = false;
        _creditPauseReason = "";
        _creditPausedAt = null;
        _creditResumeAt = null;
        _creditBackoffMinutes = 5; // reset backoff
        // Kick pending tasks
        kickNextPending();
      }
    } catch (retryError: any) {
      if (isCreditOrRateError(retryError)) {
        // Still limited — double the backoff
        _creditBackoffMinutes = Math.min(_creditBackoffMinutes * 2, CREDIT_BACKOFF_MAX);
        const nextRetry = new Date(Date.now() + _creditBackoffMinutes * 60 * 1000);
        _creditResumeAt = nextRetry;
        console.log(`[credit-pause] Still rate-limited. Next retry in ${_creditBackoffMinutes}m at ${nextRetry.toISOString()}`);
        scheduleCreditProbe(); // recursive schedule with new backoff
      } else {
        // Different error — might be resolved, cautiously resume
        console.log(`[credit-pause] Probe returned non-rate error: ${(retryError as Error).message}. Cautiously resuming.`);
        _creditPaused = false;
        _creditPauseReason = "";
        _creditPausedAt = null;
        _creditResumeAt = null;
        _creditBackoffMinutes = 5;
        kickNextPending();
      }
    }
  }, _creditBackoffMinutes * 60 * 1000);
}

// Kick the next pending task from the queue when a slot frees up
async function kickNextPending() {
  try {
    if (_systemPaused) return; // Don't kick tasks while system is paused
    if (_creditPaused) return; // Don't kick tasks while credit-paused
    if (_activeAICalls >= MAX_GLOBAL_CONCURRENT) return;
    const settings = await storage.getSettings();
    if (settings.autoStartTasks === false) return;
    const allTasks = await storage.getAgentTasks();
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const nextTask = allTasks
      .filter(t => t.status === "pending")
      .sort((a, b) => {
        const pa = priorityOrder[(a as any).priority || "medium"] ?? 2;
        const pb = priorityOrder[(b as any).priority || "medium"] ?? 2;
        if (pa !== pb) return pa - pb;
        return a.id - b.id;
      })[0];
    if (nextTask) {
      setTimeout(() => autoThinkTask(nextTask.id), 1000);
    }
  } catch (err) {
    console.error(`[kickNextPending] Error:`, err);
  }
}

// Check if a parent task has become a zombie (all subs terminal) and resolve it
async function resolveZombieParent(parentTaskId: number | null | undefined) {
  if (!parentTaskId) return;
  try {
    const parent = await storage.getAgentTask(parentTaskId);
    if (!parent || !["executing", "thinking", "under_review"].includes(parent.status)) return;
    const allTasks = await storage.getAgentTasks();
    const subs = allTasks.filter(t => t.parentTaskId === parentTaskId);
    if (subs.length === 0) return;
    const terminal = new Set(["completed", "rejected"]);
    if (!subs.every(s => terminal.has(s.status))) return; // Still has active subs
    const completed = subs.filter(s => s.status === "completed");
    const rejected = subs.filter(s => s.status === "rejected");
    if (completed.length > 0) {
      console.log(`[zombie-resolve] Completing parent #${parentTaskId} (${completed.length} completed, ${rejected.length} rejected subs)`);
      await storage.updateAgentTask(parentTaskId, {
        status: "completed",
        result: `Completed via ${completed.length} sub-tasks (${rejected.length} rejected).\n` +
          completed.slice(0, 5).map(s => `\u2022 ${s.title}`).join("\n"),
        completedAt: new Date().toISOString(),
      });
    } else {
      console.log(`[zombie-resolve] Resetting parent #${parentTaskId} to pending (all ${rejected.length} subs rejected)`);
      await storage.updateAgentTask(parentTaskId, {
        status: "pending",
        executionLog: `All sub-tasks rejected. Re-queued for fresh approach at ${new Date().toISOString()}.`,
      });
    }
    kickNextPending();
    // Recursively check grandparent
    await resolveZombieParent(parent.parentTaskId);
  } catch (err) {
    console.error(`[zombie-resolve] Error for parent #${parentTaskId}:`, err);
  }
}

const thinkInFlight = new Set<number>();

async function autoThinkTask(taskId: number) {
  // Concurrency lock: prevent duplicate think calls for the same task
  if (thinkInFlight.has(taskId)) {
    console.log(`[autoThink] Task ${taskId} already in flight, skipping`);
    return;
  }
  thinkInFlight.add(taskId);

  try {
    // System pause gate — user clicked Pause All
    if (_systemPaused) {
      console.log(`[autoThink] Skipping task ${taskId} — system paused by user`);
      return;
    }
    // Credit pause gate — skip all processing while paused
    if (_creditPaused) {
      console.log(`[autoThink] Skipping task ${taskId} — credit pause active (resumes ${_creditResumeAt?.toISOString()})`);
      return;
    }

    const task = await storage.getAgentTask(taskId);
    if (!task || task.status !== "pending") return;

    // Check auto-start setting
    const settings = await storage.getSettings();
    if (settings.autoStartTasks === false) return; // default is true (on)

    // Global concurrency limit
    if (_activeAICalls >= MAX_GLOBAL_CONCURRENT) {
      console.log(`[autoThink] Skipping task ${taskId} — at global limit (${_activeAICalls}/${MAX_GLOBAL_CONCURRENT})`);
      return;
    }

    // Budget-aware execution: check if daily/weekly token budget is exceeded
    const roadmap = (settings as any).roadmapPlanning || {};
    const globalBudget = roadmap.globalBudget || {};
    if (globalBudget.daily > 0 || globalBudget.weekly > 0) {
      const execLog = roadmap.executionLog || [];
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      if (globalBudget.daily > 0) {
        const todaySpent = execLog.filter((e: any) => e.date?.startsWith(todayStr)).reduce((s: number, e: any) => s + (e.costCents || 0), 0);
        if (todaySpent >= globalBudget.daily) {
          console.log(`[autoThink] Skipping task ${taskId} — daily budget exceeded (${todaySpent}/${globalBudget.daily} cents)`);
          return;
        }
      }
      if (globalBudget.weekly > 0) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const weekSpent = execLog.filter((e: any) => e.date >= weekStartStr).reduce((s: number, e: any) => s + (e.costCents || 0), 0);
        if (weekSpent >= globalBudget.weekly) {
          console.log(`[autoThink] Skipping task ${taskId} — weekly budget exceeded (${weekSpent}/${globalBudget.weekly} cents)`);
          return;
        }
      }
    }

    // Check max parallel tasks per agent
    const maxParallel = settings.maxParallelTasksPerAgent || 0; // 0 = unlimited
    if (maxParallel > 0) {
      const allTasks = await storage.getAgentTasks();
      // Only count truly active tasks — exclude parents waiting for sub-tasks
      const agentActiveTasks = allTasks.filter(t =>
        t.assignedAgentId === task.assignedAgentId &&
        ["thinking", "executing", "under_review"].includes(t.status) &&
        !allTasks.some(s => s.parentTaskId === t.id) // skip parents waiting for subs
      );
      if (agentActiveTasks.length >= maxParallel) {
        console.log(`[autoThink] Agent ${task.assignedAgentId} at capacity (${agentActiveTasks.length}/${maxParallel})`);
        return; // skip, agent at capacity
      }
    }

    // PREVENT RE-DELEGATION: If this task already has sub-tasks, don't re-think it
    const allTasksForDupCheck = await storage.getAgentTasks();
    const existingSubTasks = allTasksForDupCheck.filter(t => t.parentTaskId === taskId);
    if (existingSubTasks.length > 0) {
      console.log(`[autoThink] Task ${taskId} already has ${existingSubTasks.length} sub-tasks — marking as executing (waiting), not re-thinking`);
      await storage.updateAgentTask(taskId, { status: "executing" });
      return;
    }

    // Double-check: don't think if parent task has been cancelled
    if (task.parentTaskId) {
      const parent = await storage.getAgentTask(task.parentTaskId);
      if (parent && (parent.status === "rejected" || parent.status === "pending")) return;
    }

    const agent = await storage.getAgent(task.assignedAgentId);
    if (!agent) return;

    const companyContext = await getCompanyContext();

    await storage.updateAgentTask(task.id, { status: "thinking" });
    _activeAICalls++;
    console.log(`[autoThink] Task ${taskId} started thinking (${_activeAICalls}/${MAX_GLOBAL_CONCURRENT} active)`);

    const isHireTask = task.type === "hire_agent";
    const isOrgChartTask = task.type === "propose_orgchart";
    const isDelegateTask = task.type === "delegate";

    // Inject top 10 most important memories
    const memories = await storage.getAgentMemories(agent.id);
    const topMemories = memories.slice(0, 10);
    let memoryBlock = "";
    if (topMemories.length > 0) {
      memoryBlock = "\n\nYOUR MEMORIES (things you've learned from past work):\n" +
        topMemories.map(m => `- [${m.type}] ${m.content}`).join("\n") + "\n";
    }

    // === CONTEXT INTELLIGENCE: Inject related work context ===
    let relatedContext = "";
    const currentSettings = await storage.getSettings();
    if (currentSettings.contextIntelligence !== false) {
      try {
        relatedContext = await getRelatedWorkContext(task);
      } catch (err) {
        console.error(`[intelligence] Failed to get related context for task ${taskId}:`, err);
      }
    }

    let systemPrompt = `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You have been given a task by the company owner.\n\nCOMPANY CONTEXT (use this to inform your decisions — you know everything happening in the company):\n${companyContext}${memoryBlock}${relatedContext}\n\n`;

    if (isHireTask) {
      const allAgents = await storage.getAgents();
      const agentListForHiring = allAgents.map(a => `  - ID ${a.id}: ${a.name} (${a.role}, ${a.department})`).join('\n');

      systemPrompt += `You are tasked with HIRING a new team member. You must produce a detailed proposal with:
1. A brief rationale for why this hire is needed
2. A complete agent profile in JSON format

IMPORTANT: You MUST return the JSON inside a code block with triple backticks. The JSON must follow this exact structure:
[
  {
    "name": "CreativeName",
    "role": "ExactRoleTitle",
    "department": "Department",
    "avatar": "single_emoji",
    "instructions": "Detailed persona instructions (2-3 paragraphs describing personality, expertise, decision-making style, and how they interact in meetings)",
    "skills": ["Skill1", "Skill2", "Skill3"],
    "parentId": <ID of direct manager>,
    "color": "#HexColor",
    "rationale": "Why this person is the right hire"
  }
]

CURRENT ORG CHART:
${agentListForHiring}

REPORTING LINE RULES (CRITICAL - follow these exactly):
- Every agent MUST report to someone. No orphan agents allowed.
- The "parentId" field is the NUMERIC ID of the new hire's DIRECT MANAGER.
- C-suite executives and department heads (CTO, VP, Head of X) MUST report to the CEO (ID 1).
- Team-level members report to their relevant department head (e.g. a frontend engineer reports to the CTO/VP Eng).
- Support roles (HR assistants, recruiters) report to the Head of HR.
- DO NOT default parentId to the agent running this task. Set it based on the ROLE HIERARCHY.
- Look at the org chart above and find the right manager for the new hire's role.
- NEVER set parentId to null.

Pick a unique, memorable name. Write rich persona instructions. Do NOT include "Talent Acquisition" in the role name - use the actual role title. If the task mentions multiple hires, include all of them in the array.`;
    } else if (isOrgChartTask) {
      const allAgents = await storage.getAgents();
      const agentListForOrg = allAgents.map(a => `  - ID ${a.id}: ${a.name} (${a.role}, ${a.department})`).join('\n');

      systemPrompt += `You are tasked with PROPOSING AN ORG CHART STRUCTURE. Analyze the request and propose a set of new hires needed. For each proposed agent, produce a complete profile.

IMPORTANT: You MUST return ALL proposed agents inside a code block with triple backticks. The array format:
[
  {
    "name": "CreativeName",
    "role": "ExactRoleTitle",
    "department": "Department",
    "avatar": "single_emoji",
    "instructions": "Detailed persona (2-3 paragraphs)",
    "skills": ["Skill1", "Skill2", "Skill3"],
    "parentId": <ID of their direct manager>,
    "color": "#HexColor",
    "rationale": "Why this role is needed"
  }
]

CURRENT ORG CHART:
${agentListForOrg}

REPORTING LINE RULES (CRITICAL - follow these exactly):
- Every agent MUST report to someone. No orphan agents allowed.
- The "parentId" field is the NUMERIC ID of the new hire's DIRECT MANAGER.
- C-suite executives and department heads (CTO, VP, Head of X) MUST report to the CEO (ID 1).
- Team-level members report to their relevant department head (e.g. a frontend engineer reports to the CTO/VP Eng).
- Support roles (HR assistants, recruiters) report to the Head of HR.
- DO NOT default parentId to the agent running this task. Set it based on the ROLE HIERARCHY.
- Look at the org chart above and find the right manager for the new hire's role.
- NEVER set parentId to null.
- If proposing multiple agents with internal reporting (e.g. a VP and their reports), use the name of the manager as parentId and the system will resolve it.

Think strategically about which roles are needed, proper reporting lines, and how they complement the existing team.`;
    } else if (isDelegateTask) {
      systemPrompt += `You are being asked to handle this task. Analyze it and propose sub-tasks that should be delegated to specific team members. IMPORTANT: You MUST return your plan as a proposal with delegated sub-tasks inside a code block with triple backticks. Format:
[
  {
    "title": "Sub-task title",
    "description": "What needs to be done",
    "assignToAgentId": 1,
    "assignToAgentName": "Agent Name",
    "priority": "low|medium|high|urgent",
    "workflowStage": "design|development|testing|review|deploy"
  }
]`;
    } else {
      // Check if this agent is a manager with direct reports — encourage delegation
      const allAgents = await storage.getAgents();
      const directReports = allAgents.filter(a => a.parentId === agent.id);
      
      if (directReports.length > 0) {
        const reportsList = directReports.map(a => `  - ID ${a.id}: ${a.name} (${a.role}, ${a.department})`).join('\n');
        systemPrompt += `You are a senior leader with direct reports. As a manager, you should DELEGATE work to your team rather than doing everything yourself.

YOUR DIRECT REPORTS:
${reportsList}

IMPORTANT DELEGATION RULES:
- If this task can be handled by one of your direct reports, propose delegating sub-tasks to them.
- Only handle tasks yourself if they are truly strategic/executive-level decisions that cannot be delegated.
- Break the task down into sub-tasks and assign each to the most appropriate team member.
- You MUST return delegated sub-tasks inside a code block with triple backticks. Format:
\`\`\`
[
  {
    "title": "Sub-task title",
    "description": "What needs to be done",
    "assignToAgentId": <ID>,
    "assignToAgentName": "Agent Name",
    "priority": "low|medium|high|urgent",
    "workflowStage": "design|development|testing|review|deploy"
  }
]
\`\`\`

If you delegate, start your response with a brief strategic overview, then the delegation plan in the code block.
If this is truly something only YOU can handle (e.g. vision/strategy decisions), provide a direct proposal without delegation.`;
      } else {
        systemPrompt += `Analyze this task and provide a clear, actionable proposal. Include:
1. Your analysis of the task
2. Your recommended approach
3. Expected deliverables
4. Any risks or considerations

If this task would benefit from producing a deliverable (document, spec, code outline, design brief), include it in your proposal.`;
      }
    }

    if (task.executionLog && task.executionLog.startsWith("Owner feedback:")) {
      systemPrompt += `\n\nPrevious owner feedback: ${task.executionLog.replace("Owner feedback: ", "")}`;
    }

    // Inject manager feedback if this is a revision from manager review
    if (task.executionLog) {
      const mgrFeedbackMatch = task.executionLog.match(/Manager feedback \(round \d+\) from .+?: ([\s\S]+?)$/);
      if (mgrFeedbackMatch) {
        systemPrompt += `\n\nYour manager has reviewed your previous proposal and requested revisions. Address their feedback:\n${mgrFeedbackMatch[1].trim()}`;
      }
    }

    // === GAP 3: Inject available tools into system prompt ===
    const agentTools = getToolsForAgent(agent);
    if (agentTools.length > 0 && !isHireTask && !isOrgChartTask) {
      systemPrompt += `\n\n${getToolDescriptionsForPrompt(agentTools)}`;
    }

    // Wrap AI call with a 3-minute timeout to prevent hanging
    const aiPromise = trackedAI({
      instructions: systemPrompt,
      input: `Task: ${task.title}\n\nDetails: ${task.description}`,
    }, { label: `Think: ${task.title}`, agentId: agent.id });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timed out after 3 minutes for task ${taskId}`)), 180000)
    );
    let response = await Promise.race([aiPromise, timeoutPromise]);
    _activeAICalls = Math.max(0, _activeAICalls - 1);
    console.log(`[autoThink] Task ${taskId} finished thinking (${_activeAICalls}/${MAX_GLOBAL_CONCURRENT} active)`);

    // Kick next pending task from queue if slots available
    kickNextPending();

    let proposalText = response.output_text;

    // === GAP 3: Parse and execute tool calls from AI response ===
    const toolCalls = parseToolCalls(proposalText);
    if (toolCalls.length > 0) {
      console.log(`[autoThink] Task ${taskId}: executing ${toolCalls.length} tool call(s)`);
      const toolContext: ToolContext = {
        agentId: agent.id,
        taskId: task.id,
        agent,
        storage,
        trackedAI,
      };
      const toolResults = await executeToolCalls(toolCalls, toolContext);
      const toolResultsText = toolResults.map(r =>
        `**Tool: ${r.tool}** → ${r.result.success ? r.result.output : `ERROR: ${r.result.error}`}`
      ).join('\n\n');

      // Second AI call with tool results to produce final proposal
      _activeAICalls++;
      const followUpPromise = trackedAI({
        instructions: systemPrompt,
        input: `Task: ${task.title}\n\nDetails: ${task.description}\n\n--- TOOL RESULTS ---\n${toolResultsText}\n\nBased on the tool results above, provide your final proposal.`,
      }, { label: `Think+Tools: ${task.title}`, agentId: agent.id });
      const followUpTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Follow-up AI call timed out for task ${taskId}`)), 180000)
      );
      response = await Promise.race([followUpPromise, followUpTimeout]);
      _activeAICalls = Math.max(0, _activeAICalls - 1);
      proposalText = response.output_text;
      console.log(`[autoThink] Task ${taskId}: follow-up complete after tool execution`);
    }

    // Try code-block-wrapped JSON first, then bare JSON arrays in the text
    const jsonMatch = proposalText.match(/```json\s*([\s\S]*?)```/) || proposalText.match(/```\s*([\s\S]*?)```/);
    let proposedActions = jsonMatch ? jsonMatch[1].trim() : null;

    // Fallback: if no code block found, try to extract a bare JSON array from the text
    if (!proposedActions) {
      const bareArrayMatch = proposalText.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
      if (bareArrayMatch) {
        try {
          JSON.parse(bareArrayMatch[1]); // validate it's real JSON
          proposedActions = bareArrayMatch[1].trim();
          console.log(`[autoThink] Extracted bare JSON array for task ${taskId} (no code block backticks)`);
        } catch {
          // Not valid JSON, leave proposedActions as null
        }
      }
    }

    // === GAP 7: Self-verification loop (max 2 revision iterations) ===
    const verifySettings = await storage.getSettings();
    const verificationEnabled = (verifySettings as any).verificationEnabled !== false;
    if (verificationEnabled && !isHireTask && !isOrgChartTask) {
      let currentProposal = proposalText;
      const MAX_VERIFY_ROUNDS = 2;
      for (let round = 0; round < MAX_VERIFY_ROUNDS; round++) {
        try {
          _activeAICalls++;
          const verifyPromise = trackedAI({
            instructions: `You are a quality reviewer. Evaluate the following proposal for completeness, accuracy, and actionability. Score it from 0.0 to 1.0 where 1.0 is perfect.\n\nRespond ONLY with a JSON object (no code blocks):\n{"score": <number>, "passed": <boolean>, "feedback": "<brief feedback>"}\n\nA score >= 0.6 passes. Be fair but rigorous.`,
            input: `Task: ${task.title}\nDescription: ${task.description}\n\nProposal to review:\n${currentProposal}`,
          }, { label: `Verify(round ${round + 1}): ${task.title}`, agentId: agent.id });
          const verifyTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Verification timed out for task ${taskId}`)), 120000)
          );
          const verifyResponse = await Promise.race([verifyPromise, verifyTimeout]);
          _activeAICalls = Math.max(0, _activeAICalls - 1);

          let verifyResult: { score: number; passed: boolean; feedback: string } | null = null;
          try {
            const cleanText = verifyResponse.output_text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
            verifyResult = JSON.parse(cleanText);
          } catch {
            console.log(`[verify] Could not parse verification response for task ${taskId}, skipping`);
            break;
          }

          // Record verification result
          try {
            await (storage as any).createVerificationResult({
              taskId: task.id,
              agentId: agent.id,
              type: 'self_check',
              score: verifyResult!.score,
              passed: verifyResult!.score >= 0.6,
              feedback: verifyResult!.feedback,
              criteria: JSON.stringify({ round: round + 1, threshold: 0.6 }),
            });
          } catch { /* silent */ }

          if (verifyResult!.score >= 0.6) {
            console.log(`[verify] Task ${taskId} passed self-check (score: ${verifyResult!.score}, round ${round + 1})`);
            break;
          }

          // Score too low — revise
          console.log(`[verify] Task ${taskId} failed self-check (score: ${verifyResult!.score}, round ${round + 1}), revising...`);
          _activeAICalls++;
          const revisePromise = trackedAI({
            instructions: systemPrompt,
            input: `Task: ${task.title}\n\nDetails: ${task.description}\n\nYour previous proposal received a quality score of ${verifyResult!.score}/1.0. Reviewer feedback: ${verifyResult!.feedback}\n\nPlease revise and improve your proposal to address the feedback.`,
          }, { label: `Revise(round ${round + 1}): ${task.title}`, agentId: agent.id });
          const reviseTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Revision timed out for task ${taskId}`)), 180000)
          );
          const reviseResponse = await Promise.race([revisePromise, reviseTimeout]);
          _activeAICalls = Math.max(0, _activeAICalls - 1);
          currentProposal = reviseResponse.output_text;
          proposalText = currentProposal;

          // Re-extract proposed actions from revised proposal
          const revisedJsonMatch = proposalText.match(/```json\s*([\s\S]*?)```/) || proposalText.match(/```\s*([\s\S]*?)```/);
          proposedActions = revisedJsonMatch ? revisedJsonMatch[1].trim() : null;
          if (!proposedActions) {
            const revisedBareMatch = proposalText.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
            if (revisedBareMatch) {
              try { JSON.parse(revisedBareMatch[1]); proposedActions = revisedBareMatch[1].trim(); } catch {}
            }
          }
        } catch (verifyErr) {
          _activeAICalls = Math.max(0, _activeAICalls - 1);
          console.error(`[verify] Error in verification loop for task ${taskId}:`, verifyErr);
          break;
        }
      }
    }

    await storage.updateAgentTask(task.id, {
      status: "proposal_ready",
      proposal: proposalText,
      proposedActions: proposedActions,
    });

    // --- Manager review: if applicable, manager AI reviews before human ---
    const managerHandled = await managerReviewTask(task.id);
    if (managerHandled) {
      // Manager sent it back for revision (status=thinking) — autoThinkTask will re-run
      const updatedTask = await storage.getAgentTask(task.id);
      if (!updatedTask || updatedTask.status !== "proposal_ready") {
        return; // Revision in progress, not ready for approval yet
      }
      // Manager approved — task is proposal_ready, fall through to auto-approve check
    }

    // --- Auto-approve: check global setting first, then agent autonomy ---
    const approveSettings = await storage.getSettings();
    const autonomy = agent.autonomyLevel || "manual";
    const taskPriority = task.priority || "medium";
    let shouldAutoApprove = false;

    // Global auto-approve overrides everything
    if (approveSettings.autoApproveTasks === true) {
      shouldAutoApprove = true;
    } else if (autonomy === "full_auto") {
      shouldAutoApprove = true;
    } else if (autonomy === "medium_auto" && (taskPriority === "low" || taskPriority === "medium")) {
      shouldAutoApprove = true;
    } else if (autonomy === "low_auto" && taskPriority === "low") {
      shouldAutoApprove = true;
    }

    if (shouldAutoApprove) {
      const reason = approveSettings.autoApproveTasks === true ? "global auto-approve setting" : `agent autonomy policy (${autonomy})`;
      console.log(`[autoThink] Auto-approving task ${taskId} per ${reason}, priority: ${taskPriority}`);
      await storage.updateAgentTask(task.id, {
        executionLog: JSON.stringify([`Auto-approved per ${reason}`]),
      });
      // Call the approve endpoint internally
      try {
        const port = process.env.PORT || 5000;
        await fetch(`http://localhost:${port}/api/tasks/${task.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } });
      } catch (approveErr) {
        console.error(`[autoThink] Auto-approve request failed for task ${taskId}:`, approveErr);
      }
    }
  } catch (error: any) {
    _activeAICalls = Math.max(0, _activeAICalls - 1);
    console.error(`Auto-think error for task ${taskId}:`, error?.message || error, `(${_activeAICalls}/${MAX_GLOBAL_CONCURRENT} active)`);

    // ---- CREDIT PAUSE: detect rate-limit / quota / billing errors ----
    if (isCreditOrRateError(error)) {
      enterCreditPause(error?.message || "Rate limit or credit exhaustion detected");
      // Revert task to pending (don't count as failure) so it retries after pause lifts
      try {
        await storage.updateAgentTask(taskId, {
          status: "pending",
          executionLog: `[credit-pause] Task paused due to rate limit / credit exhaustion. Will auto-resume when credits are available.`,
        });
      } catch {}
      return; // Don't kick next — everything is paused
    }

    // Revert to appropriate status on failure
    try {
      const failedTask = await storage.getAgentTask(taskId);
      // If this task has unresolved dependencies, revert to blocked, not pending
      let revertStatus = "pending";
      if (failedTask?.dependsOn) {
        try {
          const deps: number[] = JSON.parse(failedTask.dependsOn);
          const allTasks = await storage.getAgentTasks();
          const allDepsResolved = deps.every(depId => {
            const dep = allTasks.find(t => t.id === depId);
            return dep && (dep.status === "completed" || dep.status === "rejected");
          });
          if (!allDepsResolved) revertStatus = "blocked";
        } catch {}
      }
      // Track consecutive failures to avoid infinite retry loops
      const errorMsg = error?.message || "Unknown error";
      const prevLog = failedTask?.executionLog || "";
      const failureMatch = prevLog.match(/\[FAILURES:(\d+)\]/);
      const failureCount = failureMatch ? parseInt(failureMatch[1]) + 1 : 1;
      // After 3 consecutive failures, mark as rejected to stop the loop
      if (failureCount >= 3) {
        revertStatus = "rejected";
        console.error(`[autoThink] Task ${taskId} failed ${failureCount} times — auto-rejecting to stop retry loop`);
      }
      await storage.updateAgentTask(taskId, {
        status: revertStatus,
        executionLog: `Error: ${errorMsg}. [FAILURES:${failureCount}]${revertStatus === "rejected" ? " Auto-rejected after repeated failures." : " Task will be retried."}`,
      });
    } catch {}
    // Kick next pending task from queue even on error
    kickNextPending();
  } finally {
    thinkInFlight.delete(taskId);
  }
}

// Extract key learnings from a completed task and store as agent memories
async function extractTaskLearnings(task: { id: number; title: string; description: string; assignedAgentId: number; proposal?: string | null; executionLog?: string | null }) {
  try {
    const agent = await storage.getAgent(task.assignedAgentId);
    if (!agent) return;

    const taskSummary = [
      `Task: ${task.title}`,
      `Description: ${task.description}`,
      task.proposal ? `Proposal: ${task.proposal.slice(0, 500)}` : "",
      task.executionLog ? `Result: ${task.executionLog.slice(0, 500)}` : "",
    ].filter(Boolean).join("\n");

    const response = await trackedAI({
      instructions: `Extract 1-3 key facts or learnings from this completed task that would be useful for the agent to remember for future work. Return a JSON array of objects: [{"content": "the learning", "type": "fact"|"learning"|"relationship", "importance": 1-5}]. Only include genuinely useful insights, not trivial observations. Return an empty array [] if nothing noteworthy.`,
      input: taskSummary,
    }, { label: `Extract learnings: ${task.title}`, agentId: agent.id });

    const jsonMatch = response.output_text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const learnings = JSON.parse(jsonMatch[0]);
      for (const l of learnings) {
        if (l.content) {
          await storage.createAgentMemory({
            agentId: agent.id,
            type: l.type || "learning",
            content: l.content,
            source: `task:${task.id}`,
            createdAt: new Date().toISOString(),
            importance: Math.min(5, Math.max(1, l.importance || 3)),
          });
        }
      }
    }
  } catch (err) {
    console.error(`[memory] Failed to extract learnings for task ${task.id}:`, err);
  }
}

// ==================== AI INTELLIGENCE LAYER ====================
// Cross-context analysis: when a task completes, AI reasons about connections, consequences, and contradictions
async function analyzeTaskConnections(task: { id: number; title: string; description: string; assignedAgentId: number; proposal?: string | null; executionLog?: string | null; projectId?: number | null; type?: string | null }) {
  try {
    const settings = await storage.getSettings();
    if (settings.contextIntelligence === false) return;

    // Skip hire/orgchart tasks — they're structural, not analytical
    if (task.type === "hire_agent" || task.type === "propose_orgchart") return;

    const allTasks = await storage.getAgentTasks();
    const agents = await storage.getAgents();
    const agent = agents.find(a => a.id === task.assignedAgentId);

    // Gather recently completed tasks from OTHER agents for cross-referencing
    const recentCompleted = allTasks
      .filter(t => t.status === "completed" && t.id !== task.id && t.assignedAgentId !== task.assignedAgentId)
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
      .slice(0, 20);

    if (recentCompleted.length < 2) return; // Not enough cross-context to analyze

    // Gather active tasks that might be impacted
    const activeTasks = allTasks
      .filter(t => ["pending", "thinking", "executing", "proposal_ready", "under_review"].includes(t.status))
      .slice(0, 20);

    const completedSummaries = recentCompleted.map(t => {
      const a = agents.find(ag => ag.id === t.assignedAgentId);
      return `- [${a?.name || "?"}/${a?.role || "?"}] "${t.title}": ${(t.executionLog || t.proposal || "").replace(/\n/g, " ").slice(0, 200)}`;
    }).join("\n");

    const activeSummaries = activeTasks.map(t => {
      const a = agents.find(ag => ag.id === t.assignedAgentId);
      return `- [${a?.name || "?"}/${a?.role || "?"}] "${t.title}" (${t.status}): ${t.description.slice(0, 150)}`;
    }).join("\n");

    const response = await trackedAI({
      instructions: `You are a strategic intelligence analyst for this company. A task has just been completed. Your job is to identify CONNECTIONS, CONSEQUENCES, and potential CONTRADICTIONS between this completed task and other work happening across the company.

Analyze and return a JSON object with:
{
  "connections": ["List of meaningful connections to other tasks/work — how does this task's output affect or relate to other work?"],
  "consequences": ["What downstream effects or implications does this completion have? What should other teams know?"],
  "contradictions": ["Any conflicting assumptions, duplicate efforts, or misalignments between this task and other work?"],
  "recommendations": ["Specific actionable recommendations — tasks that should be created, agents that should be notified, or priorities that should change"]
}

Only include genuinely insightful observations. If there's nothing meaningful, return empty arrays. Be specific — reference actual task titles and agent names.`,
      input: `JUST COMPLETED TASK:
Title: ${task.title}
By: ${agent?.name || "unknown"} (${agent?.role || "unknown"})
Description: ${task.description}
Outcome: ${(task.executionLog || task.proposal || "").slice(0, 500)}

RECENTLY COMPLETED WORK BY OTHER TEAMS:
${completedSummaries}

CURRENTLY ACTIVE WORK:
${activeSummaries}`,
    }, { label: `Intelligence: ${task.title}`, agentId: null });

    const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      const hasInsights = (analysis.connections?.length || 0) + (analysis.consequences?.length || 0) + (analysis.contradictions?.length || 0) + (analysis.recommendations?.length || 0) > 0;

      if (hasInsights) {
        // Store as a discussion thread entry on the task
        const thread = task.id ? (await storage.getAgentTask(task.id))?.discussionThread : null;
        const existingThread: any[] = thread ? JSON.parse(thread) : [];
        existingThread.push({
          id: `intel_${Date.now()}`,
          agentId: 0,
          agentName: "AI Intelligence",
          content: formatIntelligenceReport(analysis),
          type: "intelligence",
          timestamp: new Date().toISOString(),
        });
        await storage.updateAgentTask(task.id, { discussionThread: JSON.stringify(existingThread) });

        // Also create an activity log entry for visibility
        try {
          await storage.createTimelineEvent({
            type: "intelligence",
            title: `Cross-context analysis: ${task.title}`,
            description: formatIntelligenceReport(analysis).slice(0, 300),
            agentId: task.assignedAgentId,
            department: agent?.department || null,
            timestamp: new Date().toISOString(),
          });
        } catch {}

        console.log(`[intelligence] Analysis for task ${task.id}: ${analysis.connections?.length || 0} connections, ${analysis.consequences?.length || 0} consequences, ${analysis.contradictions?.length || 0} contradictions`);
      }
    }
  } catch (err) {
    console.error(`[intelligence] Analysis failed for task ${task.id}:`, err);
  }
}

function formatIntelligenceReport(analysis: { connections?: string[]; consequences?: string[]; contradictions?: string[]; recommendations?: string[] }): string {
  const parts: string[] = ["🔗 Cross-Context Intelligence Report"];
  if (analysis.connections?.length) {
    parts.push("\n**Connections:**\n" + analysis.connections.map(c => `• ${c}`).join("\n"));
  }
  if (analysis.consequences?.length) {
    parts.push("\n**Downstream Consequences:**\n" + analysis.consequences.map(c => `• ${c}`).join("\n"));
  }
  if (analysis.contradictions?.length) {
    parts.push("\n⚠️ **Contradictions/Conflicts:**\n" + analysis.contradictions.map(c => `• ${c}`).join("\n"));
  }
  if (analysis.recommendations?.length) {
    parts.push("\n**Recommendations:**\n" + analysis.recommendations.map(r => `• ${r}`).join("\n"));
  }
  return parts.join("\n");
}

// Build related-work context for an agent about to think on a task
async function getRelatedWorkContext(task: { id: number; title: string; description: string; assignedAgentId: number; projectId?: number | null }): Promise<string> {
  try {
    const allTasks = await storage.getAgentTasks();
    const agents = await storage.getAgents();

    // Find recently completed tasks that might be related
    const completedTasks = allTasks
      .filter(t => t.status === "completed" && t.id !== task.id)
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
      .slice(0, 30);

    if (completedTasks.length === 0) return "";

    // Use keyword matching to find related work
    const taskWords = new Set((task.title + " " + task.description).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const scored = completedTasks.map(t => {
      const words = (t.title + " " + t.description).toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const overlap = words.filter(w => taskWords.has(w)).length;
      // Boost same-project tasks
      const projectBoost = (task.projectId && t.projectId === task.projectId) ? 5 : 0;
      return { task: t, score: overlap + projectBoost };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    if (scored.length === 0) return "";

    const lines = scored.map(s => {
      const a = agents.find(ag => ag.id === s.task.assignedAgentId);
      const outcome = (s.task.executionLog || s.task.proposal || "").replace(/\n/g, " ").replace(/\\/g, '/').replace(/[\x00-\x1f]/g, '').slice(0, 250);
      return `- "${s.task.title}" by ${a?.name || "?"} (${a?.role || "?"}): ${outcome}`;
    });

    return `\n\nRELATED COMPLETED WORK (use these outputs to inform your thinking — avoid contradictions and build on existing decisions):\n${lines.join("\n")}\n`;
  } catch {
    return "";
  }
}

// Auto-generate deliverable for a completed task
async function autoGenerateDeliverable(task: { id: number; title: string; description: string; assignedAgentId: number; proposal?: string | null; type?: string | null }) {
  try {
    const settings = await storage.getSettings();
    if (settings.autoGenerateDeliverables === false) return;

    // Skip hire/orgchart tasks — they don't produce deliverables
    if (task.type === "hire_agent" || task.type === "propose_orgchart") return;

    const agent = await storage.getAgent(task.assignedAgentId);
    if (!agent) return;

    // Determine the best deliverable type based on task content
    const titleLower = (task.title + " " + task.description).toLowerCase();
    let deliverableType = "document";
    if (titleLower.match(/\b(code|implement|build|develop|engineer|api|sdk|pipeline)\b/)) deliverableType = "code";
    else if (titleLower.match(/\b(design|ux|ui|wireframe|mockup|layout|visual)\b/)) deliverableType = "design";
    else if (titleLower.match(/\b(spec|specification|architecture|technical|schema|data model)\b/)) deliverableType = "spec";
    else if (titleLower.match(/\b(report|analysis|audit|review|assessment|findings|evaluation)\b/)) deliverableType = "report";

    const typePrompts: Record<string, string> = {
      document: "Write a professional document. Use clear headings, bullet points, and structured format.",
      code: "Write clean, production-ready code with comments. Include imports and error handling.",
      design: "Create a detailed design specification with layout descriptions, component hierarchy, and style notes.",
      spec: "Write a technical specification with requirements, architecture, data models, and API contracts.",
      report: "Write a comprehensive report with executive summary, findings, analysis, and recommendations.",
    };

    console.log(`[auto-deliverable] Generating ${deliverableType} for task ${task.id}: ${task.title}`);

    const response = await trackedAI({
      instructions: `${agent.instructions || ""}\n\nYou are ${agent.name}, ${agent.role}. ${typePrompts[deliverableType]} Be thorough and professional. This deliverable will be reviewed.`,
      input: `Task: ${task.title}\nDescription: ${task.description}\n${task.proposal ? `\nApproved Proposal:\n${task.proposal}` : ""}\n\nProduce the deliverable for this completed task.`,
    }, { label: `Auto-deliverable: ${task.title}`, agentId: agent.id });

    const currentTask = await storage.getAgentTask(task.id);
    const currentDeliverables: any[] = currentTask?.deliverables ? JSON.parse(currentTask.deliverables) : [];
    const newDeliverable = {
      id: `del_${Date.now()}`,
      title: `${task.title}`,
      type: deliverableType,
      content: response.output_text,
      producedBy: agent.id,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    currentDeliverables.push(newDeliverable);
    await storage.updateAgentTask(task.id, { deliverables: JSON.stringify(currentDeliverables) });
    console.log(`[auto-deliverable] Generated ${deliverableType} for task ${task.id}`);
  } catch (err) {
    console.error(`[auto-deliverable] Failed for task ${task.id}:`, err);
  }
}

export function registerRoutes(server: Server, app: Express): void {
  // ==================== API ACTIVITY LOGGING MIDDLEWARE (Iteration 29) ====================
  app.use("/api", (req, res, next) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && !req.path.startsWith("/activity-log")) {
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        storage.createApiLogEntry({
          method: req.method,
          path: "/api" + req.path,
          body: req.body ? JSON.stringify(req.body).slice(0, 500) : null,
          timestamp: new Date().toISOString(),
          statusCode: res.statusCode,
        }).catch(() => {}); // fire and forget
        return originalJson(body);
      };
    }
    next();
  });

  // ==================== AUTO-PLAN HELPER (internal) ====================
  // Reusable function: plan unplanned projects onto the calendar using AI
  async function runAutoPlan(): Promise<{ planned: number; plans: any[] }> {
    const projects = await storage.getProjects();
    const agents = await storage.getAgents();
    const tasks = await storage.getAgentTasks();
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: {}, executionLog: [] };

    const unplanned = projects.filter(p => {
      const plan = roadmap.projects?.[String(p.id)];
      return !plan?.plannedStart && p.status !== "completed";
    });

    if (unplanned.length === 0) {
      return { planned: 0, plans: [] };
    }

    // Build context about current planned projects to avoid conflicts
    const plannedSummary = projects
      .filter(p => roadmap.projects?.[String(p.id)]?.plannedStart)
      .map(p => {
        const rp = roadmap.projects[String(p.id)];
        return `  "${p.title}" (${rp.plannedStart} → ${rp.plannedEnd}) [${p.status}]`;
      }).join("\n");

    // Count tasks per project for better sizing
    const projectTaskCounts: Record<number, { total: number; completed: number }> = {};
    for (const t of tasks) {
      if (t.projectId) {
        if (!projectTaskCounts[t.projectId]) projectTaskCounts[t.projectId] = { total: 0, completed: 0 };
        projectTaskCounts[t.projectId].total++;
        if (t.status === "completed") projectTaskCounts[t.projectId].completed++;
      }
    }

    const response = await trackedAI({
      instructions: `You are a realistic AI project scheduler for an AI-operated company. Plan unplanned projects onto a calendar.

CRITICAL RULES:
- Today is ${new Date().toISOString().slice(0, 10)}
- We have ${agents.length} AI agents working in parallel
- AI agents execute FAST — a small project (1-5 tasks) takes 1-2 days, medium (6-15 tasks) takes 2-4 days, large (16+ tasks) takes 3-7 days
- Projects CAN overlap — agents work in parallel on different projects
- Stagger start dates realistically: don't start everything on the same day
- Urgent/high priority: start today or tomorrow
- Medium priority: start within 2-5 days from today
- Low priority: start within 5-10 days from today
- Leave small gaps between phases for review/integration
- If a project depends on another (same topic area), schedule sequentially
${plannedSummary ? `\nAlready planned projects (avoid major conflicts):\n${plannedSummary}` : ""}

Return ONLY a JSON array:
[{"projectId": number, "plannedStart": "YYYY-MM-DD", "plannedEnd": "YYYY-MM-DD", "tokenBudget": number_in_cents, "executionMode": "auto"|"scheduled"|"manual"}]

Token budget: small project ~500, medium ~1500, large ~3000 cents.
Execution mode: "auto" for urgent (starts immediately), "scheduled" for planned work, "manual" for low priority needing review.`,
      input: `Unplanned projects to schedule:\n${unplanned.map(p => {
        const tc = projectTaskCounts[p.id];
        const taskInfo = tc ? `actualTasks:${tc.total}(${tc.completed} done)` : `estimatedTasks:${p.totalTasks}`;
        return `ID:${p.id} "${p.title}" priority:${p.priority} ${taskInfo} status:${p.status} progress:${p.progress}%`;
      }).join("\n")}`,
    }, { label: "roadmap-auto-plan" });

    const text = typeof response === "string" ? response : (response as any)?.output_text || (response as any)?.text || JSON.stringify(response);
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) throw new Error("AI did not return valid JSON for auto-plan");

    const plans = JSON.parse(match[0]);
    if (!roadmap.projects) roadmap.projects = {};
    for (const plan of plans) {
      const pid = String(plan.projectId);
      const existing = roadmap.projects[pid] || {};
      roadmap.projects[pid] = {
        ...existing,
        plannedStart: plan.plannedStart,
        plannedEnd: plan.plannedEnd,
        tokenBudget: plan.tokenBudget || 1000,
        executionMode: plan.executionMode || "scheduled",
        updatedAt: new Date().toISOString(),
      };
    }
    await storage.updateSettings({ roadmapPlanning: roadmap });
    return { planned: plans.length, plans };
  }

  // Fire-and-forget auto-plan trigger (checks setting first)
  async function triggerAutoPlanIfEnabled() {
    try {
      const stgs = await storage.getSettings();
      if ((stgs as any).autoPlanEnabled) {
        console.log("[auto-plan] Triggered — running auto-plan...");
        const result = await runAutoPlan();
        if (result.planned > 0) {
          console.log(`[auto-plan] Planned ${result.planned} projects`);
        }
      }
    } catch (e) {
      console.error("[auto-plan] Error:", (e as Error).message);
    }
  }

  // ==================== AUTO-BREAKDOWN HELPER ====================
  // Automatically break down a project into tasks using AI, then auto-start them
  const breakdownInFlight = new Set<number>();

  async function autoBreakdownProject(projectId: number): Promise<void> {
    // Concurrency lock: prevent overlapping breakdowns for the same project
    if (breakdownInFlight.has(projectId)) {
      console.log(`[auto-breakdown] Project ${projectId} breakdown already in flight, skipping`);
      return;
    }
    breakdownInFlight.add(projectId);

    try {
      const project = await storage.getProject(projectId);
      if (!project) { breakdownInFlight.delete(projectId); return; }

      // Check if project already has live (non-rejected/non-cancelled) tasks
      const existingTasks = await storage.getAgentTasks();
      const liveTasks = existingTasks.filter(
        t => t.projectId === projectId && !['rejected', 'cancelled'].includes(t.status)
      );
      if (liveTasks.length > 0) {
        console.log(`[auto-breakdown] Project ${projectId} already has ${liveTasks.length} live tasks, skipping`);
        return;
      }

      console.log(`[auto-breakdown] Breaking down project ${projectId}: "${project.title}"`);

      const allAgents = await storage.getAgents();
      const agent = project.assignedAgentId
        ? await storage.getAgent(project.assignedAgentId)
        : allAgents[0];
      if (!agent) return;

      const agentList = allAgents.map(a => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        instructions: `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You need to break down a project into specific, actionable tasks that agents can execute sequentially.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nAvailable team members:\n${agentList}\n\nReturn a JSON array of tasks. Each task can optionally depend on a previous task (by index in the array, 0-based). Tasks with no dependencies can run immediately. Tasks with dependencies wait until the dependency is completed.\n\nJSON format (triple-backtick json code block):\n[\n  {\n    "title": "Task title",\n    "description": "Detailed description",\n    "assignedAgentId": <agent ID>,\n    "type": "general",\n    "priority": "low|medium|high|urgent",\n    "workflowStage": "design|development|testing|review|deploy",\n    "dependsOnIndex": null or <index of task this depends on>\n  }\n]\n\nCreate 3-8 tasks that cover the full lifecycle of the project. Assign the right specialist for each task. Set dependencies so tasks flow logically (e.g., design before development, development before testing).`,
        input: `Project: ${project.title}\nDescription: ${project.description}\nPriority: ${project.priority}`,
      }, { label: `Auto-breakdown: ${project.title}`, agentId: agent.id });

      const text = response.output_text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/) || text.match(/\[[\s\S]*\]/);
      let tasks: any[] = [];
      if (jsonMatch) {
        const raw = jsonMatch[1] || jsonMatch[0];
        tasks = JSON.parse(raw.trim());
      }

      if (tasks.length === 0) {
        console.log(`[auto-breakdown] No tasks generated for project ${projectId}`);
        return;
      }

      // Create all tasks, wire up dependencies
      const createdTasks: any[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const depIdx = t.dependsOnIndex;
        const dependsOn = (depIdx !== null && depIdx !== undefined && createdTasks[depIdx])
          ? JSON.stringify([createdTasks[depIdx].id])
          : null;
        const status = dependsOn ? "blocked" : "pending";

        const newTask = await storage.createAgentTask({
          title: t.title,
          description: t.description || "",
          assignedAgentId: t.assignedAgentId || agent.id,
          type: t.type || "general",
          status,
          priority: t.priority || project.priority,
          projectId: project.id,
          workflowStage: t.workflowStage || null,
          dependsOn,
          createdAt: new Date().toISOString(),
        });
        createdTasks.push(newTask);
      }

      // Update project with task counts and move to in_progress
      await storage.updateProject(project.id, {
        status: "in_progress",
        totalTasks: createdTasks.length,
        completedTasks: 0,
        progress: 0,
      });

      // Auto-start thinking for non-blocked tasks
      for (const ct of createdTasks) {
        if (ct.status === "pending") {
          autoThinkTask(ct.id);
        }
      }

      console.log(`[auto-breakdown] Created ${createdTasks.length} tasks for project ${projectId}`);
    } catch (e) {
      console.error(`[auto-breakdown] Error for project ${projectId}:`, (e as Error).message);
    } finally {
      breakdownInFlight.delete(projectId);
    }
  }

  // ==================== AGENTS ====================
  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get("/api/agents/workload", async (_req, res) => {
    try {
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();

      const workload = agents.map(agent => {
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
        const active = agentTasks.filter(t => ["pending", "thinking", "executing", "proposal_ready", "under_review"].includes(t.status));
        const completed = agentTasks.filter(t => t.status === "completed");
        const blocked = agentTasks.filter(t => t.status === "blocked");

        const loadScore = active.length * 2 + blocked.length;
        let status: "idle" | "normal" | "busy" | "overloaded" = "idle";
        if (loadScore > 8) status = "overloaded";
        else if (loadScore > 4) status = "busy";
        else if (loadScore > 0) status = "normal";

        return {
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          avatar: agent.avatar,
          color: agent.color,
          activeTasks: active.length,
          completedTasks: completed.length,
          blockedTasks: blocked.length,
          totalTasks: agentTasks.length,
          loadScore,
          status,
        };
      });

      res.json(workload);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load workload" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  });

  app.post("/api/agents", async (req, res) => {
    const agent = await storage.createAgent(req.body);

    // Auto-record decision
    await storage.createDecisionLogEntry({
      type: "hire",
      description: `Hired agent: "${agent.name}" as ${agent.role}`,
      madeBy: "owner",
      relatedId: agent.id,
      timestamp: new Date().toISOString(),
      impact: "high",
    });

    // Auto-timeline: hire event
    try {
      await storage.createTimelineEvent({
        type: "hire",
        title: `New hire: ${agent.name}`,
        description: `${agent.name} joined as ${agent.role} in ${agent.department}`,
        agentId: agent.id,
        department: agent.department,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    res.status(201).json(agent);
  });

  app.patch("/api/agents/:id", async (req, res) => {
    const agent = await storage.updateAgent(Number(req.params.id), req.body);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  });

  app.delete("/api/agents/:id", async (req, res) => {
    const agentId = Number(req.params.id);
    const agent = await storage.getAgent(agentId);
    const success = await storage.deleteAgent(agentId);
    if (!success) return res.status(404).json({ error: "Agent not found" });

    // Auto-record decision
    await storage.createDecisionLogEntry({
      type: "fire",
      description: `Removed agent: "${agent?.name || `#${agentId}`}"`,
      madeBy: "owner",
      relatedId: agentId,
      timestamp: new Date().toISOString(),
      impact: "high",
    });

    res.json({ success: true });
  });

  // ==================== MEETINGS ====================
  app.get("/api/meetings", async (_req, res) => {
    const meetings = await storage.getMeetings();
    res.json(meetings);
  });

  app.get("/api/meetings/:id", async (req, res) => {
    const meeting = await storage.getMeeting(Number(req.params.id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  });

  app.post("/api/meetings", async (req, res) => {
    const meeting = await storage.createMeeting(req.body);
    res.status(201).json(meeting);
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    const meeting = await storage.updateMeeting(Number(req.params.id), req.body);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  });

  // ==================== CLOSE MEETING (with selective transfer) ====================
  app.post("/api/meetings/:id/close", async (req, res) => {
    try {
      const meetingId = Number(req.params.id);
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });

      // New cascaded format: projects with nested tasks
      // selectedProjects: [{ title, description, priority, assignedAgentId, tasks: [{ title, description, ... }] }]
      // Legacy flat format still supported for backward compat
      const { selectedProjects = [], selectedTasks = [] } = req.body;

      const meetingContext = `[From meeting: "${meeting.title}" — ${meeting.topic}]\n\n`;

      const createdProjects: any[] = [];
      const createdTasks: any[] = [];

      // Create projects and their nested tasks
      for (const proj of selectedProjects) {
        const project = await storage.createProject({
          title: proj.title,
          description: meetingContext + (proj.description || ""),
          status: "backlog",
          assignedAgentId: proj.assignedAgentId || null,
          meetingId,
          priority: proj.priority || "medium",
          progress: 0,
          totalTasks: (proj.tasks || []).length,
          completedTasks: 0,
          createdAt: new Date().toISOString(),
        });
        createdProjects.push(project);

        // Create tasks nested under this project
        if (proj.tasks && Array.isArray(proj.tasks)) {
          for (const task of proj.tasks) {
            if (!task._selected) continue; // skip deselected tasks
            const newTask = await storage.createAgentTask({
              title: task.title,
              description: meetingContext + (task.description || ""),
              assignedAgentId: task.assignedAgentId,
              type: task.type || "general",
              status: "pending",
              priority: task.priority || proj.priority || "medium",
              projectId: project.id,
              meetingId,
              createdAt: new Date().toISOString(),
            });
            createdTasks.push(newTask);
            autoThinkTask(newTask.id);
          }
        }
      }

      // Legacy: standalone tasks (backward compat)
      for (const task of selectedTasks) {
        const newTask = await storage.createAgentTask({
          title: task.title,
          description: meetingContext + (task.description || ""),
          assignedAgentId: task.assignedAgentId,
          type: task.type || "general",
          status: "pending",
          priority: task.priority || "medium",
          meetingId,
          createdAt: new Date().toISOString(),
        });
        createdTasks.push(newTask);
        autoThinkTask(newTask.id);
      }

      // Derive scheduled tasks from meeting content using AI
      let createdScheduledCount = 0;
      try {
        const messages = await storage.getMeetingMessages(meetingId);
        if (messages.length > 3) {
          const agents = await storage.getAgents();
          const participantNames = meeting.agentIds
            .map((id: number) => agents.find(a => a.id === id)?.name || `Agent #${id}`)
            .filter(Boolean);
          const agentListStr = meeting.agentIds.map((id: number) => {
            const a = agents.find(ag => ag.id === id);
            return a ? `${a.name} (${a.role}, ID: ${a.id})` : `Agent #${id} (ID: ${id})`;
          }).join(", ");
          const msgText = messages.slice(-15).map(m => `${m.senderName}: ${m.content}`).join("\n");
          const companyCtx = await getCompanyContext();
          const goals = await storage.getGoals();
          const objectives = goals.filter(g => g.type === "objective");
          const keyResults = goals.filter(g => g.type === "key_result");
          const strategyCtx = objectives.length > 0
            ? `\nSTRATEGIC OBJECTIVES:\n${objectives.map(o => {
                const krs = keyResults.filter(kr => kr.parentGoalId === o.id);
                return `- [ID:${o.id}] ${o.title} (${o.progress}% done)\n  Key Results: ${krs.map(kr => `${kr.title} (${kr.progress}%)`).join(", ") || "none"}`;
              }).join("\n")}`
            : "";

          const schedResp = await trackedAI({
            instructions: `Based on a meeting transcript, identify recurring/scheduled tasks that should be set up. These include: weekly progress reviews, regular check-ins, periodic market scans, milestone reviews, pipeline checks, etc.\n\nCOMPANY CONTEXT:\n${companyCtx}${strategyCtx}\n\nAvailable agents:\n${agentListStr}\n\nReturn a JSON array of scheduled task objects with: title (string), description (string), assignedAgentId (number), frequency ("daily" | "weekly" | "biweekly" | "monthly"), priority ("low" | "medium" | "high"). Suggest 2-4 recurring tasks. Return ONLY the JSON array.`,
            input: `Meeting: ${meeting.title}\nTopic: ${meeting.topic}\n\nRecent transcript:\n${msgText}`,
          }, { label: `Derive scheduled tasks: ${meeting.title}` });
          const schedMatch = schedResp.output_text.match(/\[[\s\S]*\]/);
          const derivedSched = schedMatch ? JSON.parse(schedMatch[0]) : [];

          if (derivedSched.length > 0) {
            const stgs = await storage.getSettings();
            const scheduledTasks = (stgs as any).scheduledTasks || [];
            for (const st of derivedSched) {
              const schedId = Date.now() + Math.floor(Math.random() * 10000);
              scheduledTasks.push({
                id: schedId,
                title: st.title,
                description: st.description || st.title,
                assignedAgentId: st.assignedAgentId || null,
                frequency: st.frequency || "weekly",
                priority: st.priority || "medium",
                status: "active",
                source: "meeting",
                sourceMeetingId: meetingId,
                sourceMeetingTitle: meeting.title,
                lastRun: null,
                runCount: 0,
                nextRun: computeNextRun(st.frequency || "weekly"),
                createdAt: new Date().toISOString(),
              });
              createdScheduledCount++;
            }
            await storage.updateSettings({ scheduledTasks });
          }

          // Also save meeting minutes as knowledge base entry
          await storage.createDecisionLogEntry({
            type: "meeting_decision",
            description: `Meeting minutes — "${meeting.title}" (${new Date().toLocaleDateString()})\nParticipants: ${participantNames.join(", ")}\n\n${msgText.slice(0, 500)}`,
            madeBy: "system",
            relatedId: meetingId,
            timestamp: new Date().toISOString(),
            impact: "low",
          });
        }
      } catch (err: any) {
        console.error("Failed to derive scheduled tasks from meeting:", err.message);
      }

      // Also add goalId to created projects if matching objectives exist
      try {
        const goals = await storage.getGoals();
        const objectives = goals.filter(g => g.type === "objective");
        if (objectives.length > 0 && createdProjects.length > 0) {
          for (const proj of createdProjects) {
            if (!proj.goalId) {
              // Simple keyword matching to link projects to objectives
              const titleLower = (proj.title + " " + (proj.description || "")).toLowerCase();
              for (const obj of objectives) {
                const objWords = obj.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
                const matches = objWords.filter((w: string) => titleLower.includes(w)).length;
                if (matches >= 2) {
                  await storage.updateProject(proj.id, { goalId: obj.id } as any);
                  break;
                }
              }
            }
          }
        }
      } catch {}

      // Close the meeting
      const updated = await storage.updateMeeting(meetingId, { status: "completed" });

      // Auto-record decision
      await storage.createDecisionLogEntry({
        type: "meeting_decision",
        description: `Meeting closed: "${meeting.title}" — ${createdProjects.length} projects, ${createdTasks.length} tasks, ${createdScheduledCount} recurring tasks created`,
        madeBy: "owner",
        relatedId: meetingId,
        timestamp: new Date().toISOString(),
        impact: createdProjects.length > 0 ? "high" : "medium",
      });

      // Auto-timeline: meeting closed
      try {
        await storage.createTimelineEvent({
          type: "meeting",
          title: `Meeting closed: ${meeting.title}`,
          description: `"${meeting.title}" concluded — ${createdProjects.length} projects, ${createdTasks.length} tasks, ${createdScheduledCount} recurring tasks created`,
          agentId: null,
          department: null,
          timestamp: new Date().toISOString(),
        });
      } catch {}

      res.json({
        meeting: updated,
        createdProjects,
        createdTasks,
        createdScheduledCount,
      });

      // Auto-plan newly created projects if enabled (fire-and-forget)
      if (createdProjects.length > 0) {
        triggerAutoPlanIfEnabled();
      }
    } catch (error: any) {
      console.error("Close meeting error:", error);
      res.status(500).json({ error: "Failed to close meeting", details: error.message });
    }
  });

  // ==================== MEETING MESSAGES ====================
  app.get("/api/meetings/:id/messages", async (req, res) => {
    const messages = await storage.getMeetingMessages(Number(req.params.id));
    res.json(messages);
  });

  app.post("/api/meetings/:id/messages", async (req, res) => {
    const message = await storage.createMeetingMessage({
      ...req.body,
      meetingId: Number(req.params.id),
    });
    res.status(201).json(message);
  });

  // ==================== AI CHAT (Agent Response) ====================
  app.post("/api/ai/agent-response", async (req, res) => {
    try {
      const { agentName, agentRole, agentInstructions, topic, conversationHistory, responseLength } = req.body;

      const lengthGuide: Record<string, string> = {
        mini: "Keep your response extremely brief — maximum 200 characters (about 1-2 sentences). Be punchy and direct.",
        short: "Keep your response short — maximum 80 words (about 3-4 sentences). Be concise and focused.",
        medium: "Keep your response focused and under 200 words. Be specific and actionable.",
        long: "Provide a thorough, detailed response of 300-500 words. Cover multiple angles, provide examples, and be comprehensive.",
      };
      const lengthInstruction = lengthGuide[responseLength || "medium"] || lengthGuide.medium;

      const companyContext = await getCompanyContext();
      const systemPrompt = `${agentInstructions}\n\nYou are participating in a board meeting. Your name is ${agentName} and your role is ${agentRole}. The meeting topic is: "${topic}".\n\nCOMPANY CONTEXT (use this to give informed, specific answers):\n${companyContext}\n\nRespond in-character. ${lengthInstruction}`;

      const historyText = conversationHistory.map((msg: any) =>
        `[${msg.senderName} - ${msg.senderRole}]: ${msg.content}`
      ).join("\n\n");

      const userInput = historyText
        ? `Meeting discussion so far:\n${historyText}\n\nProvide your response as ${agentName} (${agentRole}).`
        : `The meeting topic is: "${topic}". Provide your opening thoughts as ${agentName} (${agentRole}).`;

      const response = await trackedAI({
        
        instructions: systemPrompt,
        input: userInput,
      }, { label: `Meeting: ${agentName} response`, agentId: req.body.agentId || null });

      const text = response.output_text;
      res.json({ content: text });
    } catch (error: any) {
      console.error("AI response error:", error);
      res.status(500).json({ error: "Failed to generate AI response", details: error.message });
    }
  });

  // ==================== AI TEXT GENERATION ====================
  app.post("/api/ai/generate-text", async (req, res) => {
    try {
      const { prompt, context } = req.body;

      const response = await trackedAI({
        
        instructions: "You are a helpful assistant that generates professional text content. Be concise and specific. Output only the requested text, no preamble.",
        input: context ? `Context: ${context}\n\n${prompt}` : prompt,
      }, { label: "Text generation" });

      const text = response.output_text;
      res.json({ text });
    } catch (error: any) {
      console.error("AI text gen error:", error);
      res.status(500).json({ error: "Failed to generate text", details: error.message });
    }
  });

  // ==================== AI MEETING MINUTES ====================
  app.post("/api/ai/meeting-minutes", async (req, res) => {
    try {
      const { meetingTitle, topic, messages } = req.body;

      const transcript = messages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.content}`).join("\n\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `You generate professional meeting minutes. Use company context for accuracy.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nInclude: Meeting Title, Date, Attendees, Summary, Key Discussion Points, Action Items (with assignee), Decisions Made, and Next Steps. Format in clean markdown.`,
        input: `Generate meeting minutes for:\nTitle: ${meetingTitle}\nTopic: ${topic}\n\nTranscript:\n${transcript}`,
      }, { label: `Meeting minutes: ${meetingTitle}` });

      const text = response.output_text;
      res.json({ minutes: text });
    } catch (error: any) {
      console.error("Minutes gen error:", error);
      res.status(500).json({ error: "Failed to generate minutes", details: error.message });
    }
  });

  // ==================== AI DERIVE PROJECTS ====================
  app.post("/api/ai/derive-projects", async (req, res) => {
    try {
      const { meetingTitle, topic, messages, agents } = req.body;

      const transcript = messages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.content}`).join("\n\n");
      const agentList = agents.map((a: any) => `${a.name} (${a.role}, ID: ${a.id})`).join(", ");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `You extract actionable projects from meeting transcripts. Consider existing company context to avoid duplicates and align with ongoing work.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nReturn a JSON array of project objects. Each project should have: title (string), description (string), priority ("low" | "medium" | "high"), assignedAgentId (number - pick the most relevant agent). Available agents: ${agentList}. Return ONLY the JSON array, no other text.`,
        input: `Extract projects from:\nMeeting: ${meetingTitle}\nTopic: ${topic}\n\nTranscript:\n${transcript}`,
      }, { label: `Derive projects: ${meetingTitle}` });

      const text = response.output_text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const projects = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ projects });
    } catch (error: any) {
      console.error("Derive projects error:", error);
      res.status(500).json({ error: "Failed to derive projects", details: error.message });
    }
  });

  // ==================== AI DERIVE TASKS FROM MEETING ====================
  app.post("/api/ai/derive-tasks", async (req, res) => {
    try {
      const { meetingTitle, topic, messages, agents } = req.body;
      const transcript = messages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.content}`).join("\n\n");
      const agentList = agents.map((a: any) => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `You extract actionable tasks from meeting transcripts. Consider existing company context to avoid duplicates.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nEach task should be specific and assignable. Return a JSON array of task objects with: title (string), description (string), assignedAgentId (number), type ("general" | "hire_agent" | "delegate"), priority ("low" | "medium" | "high" | "urgent"). Available agents:\n${agentList}\nReturn ONLY the JSON array.`,
        input: `Extract tasks from:\nMeeting: ${meetingTitle}\nTopic: ${topic}\n\nTranscript:\n${transcript}`,
      }, { label: `Derive tasks: ${meetingTitle}` });

      const text = response.output_text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ tasks });
    } catch (error: any) {
      console.error("Derive tasks error:", error);
      res.status(500).json({ error: "Failed to derive tasks", details: error.message });
    }
  });

  // ==================== AI DERIVE TASKS FOR A SPECIFIC PROJECT ====================
  app.post("/api/ai/derive-project-tasks", async (req, res) => {
    try {
      const { project, meetingTitle, topic, messages, agents } = req.body;
      const transcript = messages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.content}`).join("\n\n");
      const agentList = agents.map((a: any) => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `You derive specific, actionable tasks for a PROJECT based on meeting context. The tasks should be concrete steps needed to execute the project.

COMPANY CONTEXT:
${companyContext}

PROJECT TO BREAK DOWN:
Title: ${project.title}
Description: ${project.description}
Priority: ${project.priority}

Rules:
- Each task must directly contribute to this project's success
- Tasks should be specific and assignable to a single agent
- Order tasks by logical execution sequence (dependencies first)
- Include 3-8 tasks per project (enough to cover scope, not so many they're trivial)
- Assign each task to the most relevant agent based on their role

Available agents:
${agentList}

Return a JSON array of task objects with: title (string), description (string), assignedAgentId (number), type ("general" | "hire_agent" | "delegate"), priority ("low" | "medium" | "high" | "urgent").
Return ONLY the JSON array.`,
        input: `Derive tasks for project "${project.title}" based on this meeting:\nMeeting: ${meetingTitle}\nTopic: ${topic}\n\nTranscript:\n${transcript}`,
      }, { label: `Derive tasks for project: ${project.title}` });

      const text = response.output_text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ tasks });
    } catch (error: any) {
      console.error("Derive project tasks error:", error);
      res.status(500).json({ error: "Failed to derive project tasks", details: error.message });
    }
  });

  // ==================== PROJECTS ====================
  app.get("/api/projects", async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.post("/api/projects", async (req, res) => {
    const project = await storage.createProject(req.body);
    res.status(201).json(project);
    // Trigger auto-plan if enabled (fire-and-forget)
    triggerAutoPlanIfEnabled();
  });

  app.patch("/api/projects/:id", async (req, res) => {
    const oldProject = await storage.getProject(Number(req.params.id));
    const project = await storage.updateProject(Number(req.params.id), req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);

    // If status just changed to in_progress, auto-breakdown if no live tasks exist
    if (req.body.status === "in_progress" && oldProject?.status !== "in_progress") {
      autoBreakdownProject(project.id); // fire-and-forget
    }

    // Sync goal progress if project is linked to an objective
    if ((project as any).goalId) {
      syncGoalProgress((project as any).goalId);
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const success = await storage.deleteProject(Number(req.params.id));
    if (!success) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  });

  // Get tasks for a specific project
  app.get("/api/projects/:id/tasks", async (req, res) => {
    const tasks = await storage.getAgentTasksByProject(Number(req.params.id));
    res.json(tasks);
  });

  // ==================== PROJECT BREAKDOWN: AI derives tasks from project ====================
  app.post("/api/projects/:id/breakdown", async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ error: "Project not found" });

      const allAgents = await storage.getAgents();
      const agent = project.assignedAgentId
        ? await storage.getAgent(project.assignedAgentId)
        : allAgents[0]; // fallback to CEO
      if (!agent) return res.status(404).json({ error: "No agent available" });

      const agentList = allAgents.map(a => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You need to break down a project into specific, actionable tasks that agents can execute sequentially.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nAvailable team members:\n${agentList}\n\nReturn a JSON array of tasks. Each task can optionally depend on a previous task (by index in the array, 0-based). Tasks with no dependencies can run immediately. Tasks with dependencies wait until the dependency is completed.\n\nJSON format (triple-backtick json code block):\n[\n  {\n    "title": "Task title",\n    "description": "Detailed description",\n    "assignedAgentId": <agent ID>,\n    "type": "general",\n    "priority": "low|medium|high|urgent",\n    "workflowStage": "design|development|testing|review|deploy",\n    "dependsOnIndex": null or <index of task this depends on>\n  }\n]\n\nCreate 3-8 tasks that cover the full lifecycle of the project. Assign the right specialist for each task. Set dependencies so tasks flow logically (e.g., design before development, development before testing).`,
        input: `Project: ${project.title}\nDescription: ${project.description}\nPriority: ${project.priority}`,
      }, { label: `Break down project: ${project.title}`, agentId: agent.id });

      const text = response.output_text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/) || text.match(/\[[\s\S]*\]/);
      let tasks: any[] = [];
      if (jsonMatch) {
        const raw = jsonMatch[1] || jsonMatch[0];
        tasks = JSON.parse(raw.trim());
      }

      // Create all tasks, then wire up dependsOn with real IDs
      const createdTasks: any[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const depIdx = t.dependsOnIndex;
        const dependsOn = (depIdx !== null && depIdx !== undefined && createdTasks[depIdx])
          ? JSON.stringify([createdTasks[depIdx].id])
          : null;

        // Tasks with dependencies start as "blocked", others as "pending"
        const status = dependsOn ? "blocked" : "pending";

        const newTask = await storage.createAgentTask({
          title: t.title,
          description: t.description || "",
          assignedAgentId: t.assignedAgentId || agent.id,
          type: t.type || "general",
          status,
          priority: t.priority || project.priority,
          projectId: project.id,
          workflowStage: t.workflowStage || null,
          dependsOn,
          createdAt: new Date().toISOString(),
        });
        createdTasks.push(newTask);
      }

      // Auto-start thinking for non-blocked tasks from breakdown
      for (const ct of createdTasks) {
        if (ct.status === "pending") {
          autoThinkTask(ct.id);
        }
      }

      // Update project with task counts and move to in_progress
      await storage.updateProject(project.id, {
        status: "in_progress",
        totalTasks: createdTasks.length,
        completedTasks: 0,
        progress: 0,
      });

      const updated = await storage.getProject(project.id);
      res.json({ project: updated, tasks: createdTasks });
    } catch (error: any) {
      console.error("Project breakdown error:", error);
      res.status(500).json({ error: "Failed to break down project", details: error.message });
    }
  });

  // ==================== TRANSACTIONS ====================
  app.get("/api/transactions", async (_req, res) => {
    const txs = await storage.getTransactions();
    res.json(txs);
  });

  app.post("/api/transactions", async (req, res) => {
    const tx = await storage.createTransaction(req.body);
    res.status(201).json(tx);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    const success = await storage.deleteTransaction(Number(req.params.id));
    if (!success) return res.status(404).json({ error: "Transaction not found" });
    res.json({ success: true });
  });

  // ==================== AGENT TASKS ====================
  app.get("/api/tasks", async (_req, res) => {
    const tasks = await storage.getAgentTasks();
    res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const task = await storage.getAgentTask(Number(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.get("/api/tasks/:id/subtasks", async (req, res) => {
    const subtasks = await storage.getAgentTasksByParent(Number(req.params.id));
    res.json(subtasks);
  });

  app.get("/api/agents/:id/tasks", async (req, res) => {
    const tasks = await storage.getAgentTasksByAgent(Number(req.params.id));
    res.json(tasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const task = await storage.createAgentTask(req.body);
    res.status(201).json(task);

    // Update project task counts if linked to a project
    if (task.projectId) {
      const projectTasks = await storage.getAgentTasksByProject(task.projectId);
      const topLevelTasks = projectTasks.filter(t => !t.parentTaskId);
      const total = topLevelTasks.length;
      const completed = topLevelTasks.filter(t => t.status === "completed").length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      await storage.updateProject(task.projectId, { totalTasks: total, completedTasks: completed, progress });
    }

    // Auto-start thinking for non-blocked tasks
    if (task.status === "pending") {
      autoThinkTask(task.id);
    }
  });

  // ==================== BULK REASSIGN (must be before :id wildcard) ====================
  app.patch("/api/tasks/bulk-reassign", async (req, res) => {
    try {
      const { taskIds, assignedAgentId } = req.body;
      if (!Array.isArray(taskIds) || !assignedAgentId) {
        return res.status(400).json({ error: "taskIds (array) and assignedAgentId (number) required" });
      }
      const results = [];
      for (const id of taskIds) {
        const task = await storage.updateAgentTask(Number(id), { assignedAgentId: Number(assignedAgentId) });
        if (task) results.push(task);
      }
      res.json({ updated: results.length, tasks: results });
    } catch (error: any) {
      console.error("Bulk reassign error:", error);
      res.status(500).json({ error: "Failed to bulk reassign", details: error.message });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const task = await storage.updateAgentTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getAgentTask(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    // Also delete sub-tasks recursively
    const allTasks = await storage.getAgentTasks();
    const toDelete = [taskId];
    const findChildren = (parentId: number) => {
      for (const t of allTasks) {
        if (t.parentTaskId === parentId) {
          toDelete.push(t.id);
          findChildren(t.id);
        }
      }
    };
    findChildren(taskId);

    for (const id of toDelete) {
      await storage.deleteAgentTask(id);
    }
    res.json({ success: true, deleted: toDelete.length });
  });

  // ==================== TASK EXECUTION: THINK (manual trigger, kept as fallback) ====================
  app.post("/api/tasks/:id/think", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });
      // Fire auto-think and return immediately
      autoThinkTask(task.id);
      res.json({ ...task, status: "thinking" });
    } catch (error: any) {
      console.error("Task think error:", error);
      res.status(500).json({ error: "Failed to start thinking", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: APPROVE & EXECUTE ====================
  app.post("/api/tasks/:id/approve", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.status !== "proposal_ready") return res.status(400).json({ error: "Task is not ready for approval" });

      await storage.updateAgentTask(task.id, { status: "executing" });

      const executionLog: string[] = [];

      // If proposedActions is null but the proposal text contains JSON, try to extract it
      // This is a safety net for cases where autoThinkTask's regex missed the JSON
      let effectiveActions = task.proposedActions;
      if (!effectiveActions && task.proposal && (task.type === 'hire_agent' || task.type === 'propose_orgchart' || task.type === 'delegate')) {
        const codeBlockMatch = task.proposal.match(/```json\s*([\s\S]*?)```/) || task.proposal.match(/```\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          effectiveActions = codeBlockMatch[1].trim();
        } else {
          const bareMatch = task.proposal.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
          if (bareMatch) {
            try {
              JSON.parse(bareMatch[1]);
              effectiveActions = bareMatch[1].trim();
            } catch { /* not valid JSON */ }
          }
        }
        if (effectiveActions) {
          console.log(`[approve] Recovered actions from proposal text for task ${task.id}`);
          // Also persist the fix so it doesn't happen again for this task
          await storage.updateAgentTask(task.id, { proposedActions: effectiveActions });
        }
      }

      // If there are structured actions (hire proposals / delegations), execute them
      if (effectiveActions) {
        try {
          const actions = JSON.parse(effectiveActions);
          if (Array.isArray(actions)) {
            // Track newly created agents so delegations can reference them
            const newAgentMap = new Map<string, number>(); // name → id

            // PASS 1: Create all agents first (hire actions)
            for (const action of actions) {
              if (action.name && action.role) {
                // Check if agent with this name already exists
                const existingAgents = await storage.getAgents();
                const exists = existingAgents.find(a => a.name.toLowerCase() === action.name.toLowerCase());
                if (exists) {
                  newAgentMap.set(action.name.toLowerCase(), exists.id);
                  executionLog.push(`Agent ${exists.name} already exists (ID: ${exists.id})`);
                } else {
                  // Resolve parentId: if it's a name reference, look up the real ID
                  let resolvedParentId = action.parentId || null;
                  if (typeof resolvedParentId === 'string') {
                    // Could be a name reference (e.g. "Atlas") or a numeric string (e.g. "1")
                    const numericId = Number(resolvedParentId);
                    if (!isNaN(numericId) && existingAgents.find(a => a.id === numericId)) {
                      resolvedParentId = numericId;
                    } else {
                      const parent = existingAgents.find(a => a.name.toLowerCase() === (resolvedParentId as string).toLowerCase());
                      resolvedParentId = parent ? parent.id : task.assignedAgentId;
                    }
                  }
                  // ENFORCE: Every agent must have a reporting line. Use role-based inference.
                  if (!resolvedParentId) {
                    const role = (action.role || "").toLowerCase();
                    if (role.includes("head of") || role.includes("vp") || role.includes("cto") || role.includes("chief") || role.includes("director")) {
                      resolvedParentId = 1; // C-suite reports to CEO
                    } else {
                      resolvedParentId = task.assignedAgentId;
                    }
                    console.log(`[approve] Agent "${action.name}" had no parentId — inferred ${resolvedParentId} from role "${action.role}"`);
                  }
                  const newAgent = await storage.createAgent({
                    name: action.name,
                    role: action.role,
                    department: action.department || "General",
                    avatar: action.avatar || "🧠",
                    instructions: action.instructions || "",
                    skills: action.skills || [],
                    parentId: resolvedParentId,
                    color: action.color || "#4F98A3",
                    status: "active",
                  });
                  newAgentMap.set(action.name.toLowerCase(), newAgent.id);
                  executionLog.push(`Hired ${newAgent.name} as ${newAgent.role} (ID: ${newAgent.id})`);
                }
              }
            }

            // PASS 2: Create delegated sub-tasks (now agents exist)
            for (const action of actions) {
              if (action.title && (action.assignToAgentId || action.assignToAgentName)) {
                // Resolve agent ID: try by name first (in case it was just created), then by ID
                let resolvedAgentId = action.assignToAgentId;
                if (action.assignToAgentName) {
                  const mappedId = newAgentMap.get(action.assignToAgentName.toLowerCase());
                  if (mappedId) resolvedAgentId = mappedId;
                  else {
                    // Look up by name in existing agents
                    const existingAgents = await storage.getAgents();
                    const found = existingAgents.find(a => a.name.toLowerCase() === action.assignToAgentName.toLowerCase());
                    if (found) resolvedAgentId = found.id;
                  }
                }
                // Verify the agent actually exists; fall back to task's assigned agent
                const targetAgent = await storage.getAgent(resolvedAgentId);
                if (!targetAgent) {
                  resolvedAgentId = task.assignedAgentId; // fall back to the agent who proposed this
                }
                // Detect sub-task type: if title mentions "Hire", set type to hire_agent
                const inferredType = /\bhire\b/i.test(action.title) ? "hire_agent" : (action.type || "general");
                const subTask = await storage.createAgentTask({
                  title: action.title,
                  description: action.description || "",
                  assignedAgentId: resolvedAgentId,
                  type: inferredType,
                  status: "pending",
                  parentTaskId: task.id,
                  priority: action.priority || "medium",
                  workflowStage: inferredType === "hire_agent" ? null : (action.workflowStage || null),
                  createdAt: new Date().toISOString(),
                });
                const agentName = targetAgent?.name || action.assignToAgentName || `agent ${resolvedAgentId}`;
                executionLog.push(`Delegated "${subTask.title}" to agent ${agentName}`);
                // Auto-start thinking for delegated sub-tasks
                autoThinkTask(subTask.id);
              }
            }
          }
        } catch (e) {
          executionLog.push(`Could not parse proposed actions: ${(e as Error).message}`);
        }
      }

      // For tasks with workflow stages and no structured actions (hires/delegates),
      // run the full pipeline instead of instantly completing
      if (task.workflowStage && executionLog.length === 0) {
        await storage.updateAgentTask(task.id, {
          status: "executing",
          executionLog: "Starting workflow pipeline...",
        });
        const updated = await storage.getAgentTask(task.id);
        res.json(updated);
        // Fire pipeline in background
        executeWorkflowPipeline(task.id);
        return;
      }

      // Check if sub-tasks were created (delegations)
      const hasDelegatedSubTasks = executionLog.some(l => l.startsWith('Delegated '));

      if (hasDelegatedSubTasks) {
        // Parent stays "executing" while sub-tasks are in progress
        await storage.updateAgentTask(task.id, {
          status: "executing",
          executionLog: executionLog.join("\n"),
        });
      } else {
        if (executionLog.length === 0) {
          executionLog.push("Task approved and marked as completed.");
        }

        await storage.updateAgentTask(task.id, {
          status: "completed",
          executionLog: executionLog.join("\n"),
          completedAt: new Date().toISOString(),
        });

        // === CASCADE: Unblock dependent tasks and update project progress ===
        await cascadeTaskCompletion(task.id, task.projectId);

        // === EXTRACT LEARNINGS: Auto-extract key facts into agent memory via LLM ===
        extractTaskLearnings(task).catch(err => console.error("[memory] Learning extraction failed:", err));

        // === AUTO-GENERATE DELIVERABLE: Produce the actual work output ===
        autoGenerateDeliverable(task).catch(err => console.error("[auto-deliverable] Generation failed:", err));

        // === CONTEXT INTELLIGENCE: Analyze cross-task connections ===
        const latestSettings = await storage.getSettings();
        if (latestSettings.contextIntelligence !== false) {
          analyzeTaskConnections(task).catch(err => console.error("[intelligence] Connection analysis failed:", err));
        }
      }

      // === SEND DELEGATION MESSAGE: When delegating, send a message to the target agent ===
      if (effectiveActions) {
        try {
          const actions = JSON.parse(effectiveActions);
          if (Array.isArray(actions)) {
            for (const action of actions) {
              if (action.title && (action.assignToAgentId || action.assignToAgentName)) {
                let targetId = action.assignToAgentId;
                if (action.assignToAgentName && !targetId) {
                  const allAgents = await storage.getAgents();
                  const found = allAgents.find(a => a.name.toLowerCase() === action.assignToAgentName.toLowerCase());
                  if (found) targetId = found.id;
                }
                if (targetId && targetId !== task.assignedAgentId) {
                  await storage.createAgentMessage({
                    fromAgentId: task.assignedAgentId,
                    toAgentId: targetId,
                    content: `I've delegated a task to you: "${action.title}". ${action.description || ""}`,
                    type: "handoff",
                    relatedTaskId: task.id,
                    read: false,
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            }
          }
        } catch {}
      }

      const updated = await storage.getAgentTask(task.id);

      // Auto-record decision
      const assignedAgent = await storage.getAgent(task.assignedAgentId);
      await storage.createDecisionLogEntry({
        type: "approval",
        description: `Approved task: "${task.title}"`,
        madeBy: "owner",
        relatedId: task.id,
        timestamp: new Date().toISOString(),
        impact: task.priority === "critical" ? "high" : task.priority === "high" ? "high" : "medium",
      });

      // Auto-timeline: decision event
      try {
        await storage.createTimelineEvent({
          type: "decision",
          title: `Task approved: ${task.title}`,
          description: `Owner approved "${task.title}" assigned to ${assignedAgent?.name || "unknown"}`,
          agentId: task.assignedAgentId,
          department: assignedAgent?.department || null,
          timestamp: new Date().toISOString(),
        });
      } catch {}

      // Check if completing this sub-task resolves a zombie parent
      if (task.parentTaskId) {
        setTimeout(() => resolveZombieParent(task.parentTaskId), 500);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Task approve error:", error);
      res.status(500).json({ error: "Failed to execute task", details: error.message });
    }
  });

  // cascadeTaskCompletion is now at module scope (above)

  // ==================== TASK EXECUTION: APPROVE ALL SUB-TASKS ====================
  app.post("/api/tasks/:id/approve-all", async (req, res) => {
    try {
      const parentId = Number(req.params.id);
      const parentTask = await storage.getAgentTask(parentId);
      if (!parentTask) return res.status(404).json({ error: "Task not found" });

      const subTasks = await storage.getAgentTasksByParent(parentId);
      const readySubs = subTasks.filter(t => t.status === "proposal_ready");

      if (readySubs.length === 0) {
        return res.status(400).json({ error: "No sub-tasks ready for approval" });
      }

      const results: any[] = [];
      for (const sub of readySubs) {
        // Simulate the approve logic inline for each sub-task
        await storage.updateAgentTask(sub.id, { status: "executing" });
        const execLog: string[] = [];

        // Check for structured actions
        let effectiveActions = sub.proposedActions;
        if (!effectiveActions && sub.proposal && (sub.type === 'hire_agent' || sub.type === 'propose_orgchart' || sub.type === 'delegate')) {
          const codeBlockMatch = sub.proposal.match(/```json\s*([\s\S]*?)```/) || sub.proposal.match(/```\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            effectiveActions = codeBlockMatch[1].trim();
          } else {
            const bareMatch = sub.proposal.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
            if (bareMatch) { try { JSON.parse(bareMatch[1]); effectiveActions = bareMatch[1].trim(); } catch {} }
          }
        }

        if (effectiveActions) {
          try {
            const actions = JSON.parse(effectiveActions);
            if (Array.isArray(actions)) {
              for (const action of actions) {
                if (action.name && action.role) {
                  const existingAgents = await storage.getAgents();
                  const exists = existingAgents.find(a => a.name.toLowerCase() === action.name.toLowerCase());
                  if (!exists) {
                    let resolvedParentId = action.parentId || null;
                    if (typeof resolvedParentId === 'string') {
                      const numId = Number(resolvedParentId);
                      if (!isNaN(numId) && existingAgents.find(a => a.id === numId)) resolvedParentId = numId;
                      else { const p = existingAgents.find(a => a.name.toLowerCase() === (resolvedParentId as string).toLowerCase()); resolvedParentId = p ? p.id : null; }
                    }
                    if (!resolvedParentId) {
                      const role = (action.role || "").toLowerCase();
                      if (role.includes("head of") || role.includes("vp") || role.includes("cto") || role.includes("chief") || role.includes("director")) {
                        resolvedParentId = 1;
                      } else {
                        resolvedParentId = sub.assignedAgentId;
                      }
                    }
                    const newAgent = await storage.createAgent({
                      name: action.name, role: action.role, department: action.department || "General",
                      avatar: action.avatar || "\uD83E\uDDE0", instructions: action.instructions || "",
                      skills: action.skills || [], parentId: resolvedParentId, color: action.color || "#4F98A3", status: "active",
                    });
                    execLog.push(`Hired ${newAgent.name} as ${newAgent.role}`);
                  }
                }
              }
            }
          } catch (e) { execLog.push(`Parse error: ${(e as Error).message}`); }
        }

        // If has workflow stage and no structured actions, run pipeline
        if (sub.workflowStage && execLog.length === 0) {
          await storage.updateAgentTask(sub.id, { status: "executing", executionLog: "Starting workflow pipeline..." });
          executeWorkflowPipeline(sub.id);
          results.push({ id: sub.id, status: "executing" });
          continue;
        }

        if (execLog.length === 0) execLog.push("Task approved and marked as completed.");

        await storage.updateAgentTask(sub.id, {
          status: "completed",
          executionLog: execLog.join("\n"),
          completedAt: new Date().toISOString(),
        });
        await cascadeTaskCompletion(sub.id, sub.projectId);
        results.push({ id: sub.id, status: "completed" });
      }

      res.json({ approved: results.length, results });
    } catch (error: any) {
      console.error("Approve-all error:", error);
      res.status(500).json({ error: "Failed to approve all", details: error.message });
    }
  });

  // ==================== TASK FOLLOW-UP: Create follow-up task with full context ====================
  app.post("/api/tasks/:id/follow-up", async (req, res) => {
    try {
      const parentTask = await storage.getAgentTask(Number(req.params.id));
      if (!parentTask) return res.status(404).json({ error: "Task not found" });

      const { title, description, assignedAgentId, type, priority } = req.body;

      // Gather all context from parent task and its subtasks
      const subtasks = await storage.getAgentTasksByParent(parentTask.id);
      const contextParts: string[] = [];
      contextParts.push(`=== ORIGINAL TASK ===\nTitle: ${parentTask.title}\nDescription: ${parentTask.description}`);
      if (parentTask.executionLog) contextParts.push(`Outcome: ${parentTask.executionLog}`);
      if (parentTask.proposal) contextParts.push(`Proposal: ${parentTask.proposal.slice(0, 500)}`);

      // Include subtask deliverables
      for (const sub of subtasks) {
        if (sub.status === "completed") {
          let subContext = `\n[Sub-task: ${sub.title}]`;
          if (sub.executionLog) subContext += `\nOutcome: ${sub.executionLog.slice(0, 400)}`;
          if (sub.deliverables) {
            try {
              const dels = JSON.parse(sub.deliverables);
              for (const d of dels) {
                subContext += `\nDeliverable "${d.title}": ${(d.content || "").slice(0, 300)}`;
              }
            } catch {}
          }
          contextParts.push(subContext);
        }
      }

      const fullContext = contextParts.join("\n\n");

      const newTask = await storage.createAgentTask({
        title: title || `Follow-up: ${parentTask.title}`,
        description: (description || "") + `\n\n--- Context from previous task ---\n${fullContext}`,
        assignedAgentId: assignedAgentId || parentTask.assignedAgentId,
        type: type || "general",
        status: "pending",
        priority: priority || parentTask.priority,
        projectId: parentTask.projectId,
        createdAt: new Date().toISOString(),
      });

      autoThinkTask(newTask.id);
      res.status(201).json(newTask);
    } catch (error: any) {
      console.error("Follow-up task error:", error);
      res.status(500).json({ error: "Failed to create follow-up", details: error.message });
    }
  });

  // ==================== ACTIVITY FEED: Recent events across the system ====================
  app.get("/api/activity-feed", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const meetings = await storage.getMeetings();
      const projects = await storage.getProjects();

      type ActivityEvent = { type: string; title: string; detail: string; agentId?: number | null; timestamp: string; icon: string; link?: string };
      const events: ActivityEvent[] = [];

      // Completed tasks
      for (const t of tasks.filter(t => t.completedAt)) {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        events.push({
          type: "task_completed",
          title: t.title,
          detail: `${agent?.name || "Agent"} completed this task`,
          agentId: t.assignedAgentId,
          timestamp: t.completedAt!,
          icon: "check",
          link: "/tasks",
        });
      }

      // Proposals ready
      for (const t of tasks.filter(t => t.status === "proposal_ready")) {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        events.push({
          type: "proposal_ready",
          title: t.title,
          detail: `${agent?.name || "Agent"} submitted a proposal`,
          agentId: t.assignedAgentId,
          timestamp: t.createdAt || new Date().toISOString(),
          icon: "sparkles",
          link: "/tasks",
        });
      }

      // Rejected tasks
      for (const t of tasks.filter(t => t.status === "rejected")) {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        events.push({
          type: "task_rejected",
          title: t.title,
          detail: `${agent?.name || "Agent"}'s proposal was rejected`,
          agentId: t.assignedAgentId,
          timestamp: t.createdAt || new Date().toISOString(),
          icon: "x_circle",
          link: "/tasks",
        });
      }

      // Thinking tasks (currently being worked on)
      for (const t of tasks.filter(t => t.status === "thinking")) {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        events.push({
          type: "task_thinking",
          title: t.title,
          detail: `${agent?.name || "Agent"} is analyzing this task`,
          agentId: t.assignedAgentId,
          timestamp: t.createdAt || new Date().toISOString(),
          icon: "brain",
          link: "/tasks",
        });
      }

      // Agent hires — find earliest task timestamp for each agent as their "hire date"
      for (const a of agents) {
        if (a.role !== "CEO") {
          // Find the hire_agent task that created this agent
          const hireTask = tasks.find(t =>
            t.type === "hire_agent" &&
            t.status === "completed" &&
            t.proposal && t.proposal.includes(a.name)
          );
          let hireTimestamp = hireTask?.completedAt || hireTask?.createdAt || null;
          
          // Fallback: use the agent's earliest assigned task
          if (!hireTimestamp) {
            const agentTasks = tasks.filter(t => t.assignedAgentId === a.id && t.createdAt);
            if (agentTasks.length > 0) {
              const sorted = agentTasks.sort((x, y) => 
                new Date(x.createdAt!).getTime() - new Date(y.createdAt!).getTime()
              );
              hireTimestamp = sorted[0].createdAt!;
            }
          }
          
          // Last fallback: 24h ago
          if (!hireTimestamp) {
            hireTimestamp = new Date(Date.now() - 86400000).toISOString();
          }

          events.push({
            type: "agent_hired",
            title: `${a.name} joined as ${a.role}`,
            detail: `${a.department} department`,
            agentId: a.id,
            timestamp: hireTimestamp,
            icon: "user_plus",
            link: "/org-chart",
          });
        }
      }

      // Meeting events
      for (const m of meetings) {
        if (m.status === "completed" || m.status === "active") {
          events.push({
            type: "meeting",
            title: `Meeting: ${m.title}`,
            detail: m.status === "completed" ? "Meeting concluded" : "Meeting in progress",
            agentId: null,
            timestamp: m.createdAt || new Date().toISOString(),
            icon: "meeting",
            link: "/meetings",
          });
        }
      }

      // Decisions
      try {
        const decisions = await storage.getDecisionLog();
        for (const d of decisions) {
          events.push({
            type: "decision",
            title: d.description?.slice(0, 80) || "Decision made",
            detail: `${d.madeBy || "System"} — ${d.impact || "medium"} impact`,
            agentId: null,
            timestamp: d.timestamp || new Date().toISOString(),
            icon: "gavel",
            link: "/decisions",
          });
        }
      } catch {}

      // Risk changes
      try {
        const risks = await storage.getRisks();
        for (const r of risks) {
          if ((r as any).status === "open" && ((r as any).severity === "critical" || (r as any).severity === "high")) {
            events.push({
              type: "risk_alert",
              title: (r as any).title || "Risk identified",
              detail: `${(r as any).severity} severity — ${(r as any).category || "general"}`,
              agentId: null,
              timestamp: (r as any).createdAt || new Date().toISOString(),
              icon: "alert_triangle",
              link: "/risks",
            });
          }
        }
      } catch {}

      // Client additions
      try {
        const clients = await storage.getClients();
        for (const c of clients) {
          events.push({
            type: "client_added",
            title: `Client: ${(c as any).name}`,
            detail: `${(c as any).type || "client"} — ${(c as any).status || "active"}`,
            agentId: null,
            timestamp: (c as any).createdAt || new Date().toISOString(),
            icon: "users",
            link: "/clients",
          });
        }
      } catch {}

      // Workflow completions
      try {
        const workflows = await storage.getWorkflows();
        for (const w of workflows) {
          if ((w as any).status === "completed") {
            events.push({
              type: "workflow_completed",
              title: `Workflow: ${(w as any).name || (w as any).title}`,
              detail: "Workflow completed",
              agentId: null,
              timestamp: (w as any).updatedAt || (w as any).createdAt || new Date().toISOString(),
              icon: "workflow",
              link: "/workflows",
            });
          }
        }
      } catch {}

      // Goal milestones (crossed 25/50/75/100%)
      try {
        const goals = await storage.getGoals();
        for (const g of goals) {
          if (g.progress >= 100) {
            events.push({
              type: "goal_milestone",
              title: `Goal achieved: ${g.title}`,
              detail: "100% progress reached",
              agentId: null,
              timestamp: (g as any).updatedAt || g.createdAt || new Date().toISOString(),
              icon: "target",
              link: "/strategy",
            });
          } else if (g.progress >= 75) {
            events.push({
              type: "goal_milestone",
              title: `Goal 75%: ${g.title}`,
              detail: `${g.progress}% progress`,
              agentId: null,
              timestamp: (g as any).updatedAt || g.createdAt || new Date().toISOString(),
              icon: "target",
              link: "/strategy",
            });
          }
        }
      } catch {}

      // Snapshot creations
      try {
        const snapshots = await storage.getSnapshots();
        for (const s of snapshots) {
          // Only include snapshots that have a real createdAt (not "now")
          const ts = s.createdAt || (s as any).date || null;
          if (!ts) continue; // Skip snapshots without timestamps to avoid always-on-top
          events.push({
            type: "snapshot",
            title: `Snapshot: ${(s as any).title || (s as any).name || "Company Snapshot"}`,
            detail: "Point-in-time data captured",
            agentId: null,
            timestamp: ts,
            icon: "camera",
            link: "/data",
          });
        }
      } catch {}

      // Project completions
      for (const p of projects) {
        if (p.progress === 100 || p.status === "completed") {
          events.push({
            type: "project_completed",
            title: `Project completed: ${p.title}`,
            detail: `${p.completedTasks || 0}/${p.totalTasks || 0} tasks done`,
            agentId: p.assignedAgentId || null,
            timestamp: (p as any).updatedAt || p.createdAt || new Date().toISOString(),
            icon: "folder",
            link: "/projects",
          });
        }
      }

      // Sort by time, most recent first, limit to 30
      // Guard against invalid timestamps
      const safeTime = (ts: string) => {
        const t = new Date(ts).getTime();
        return isNaN(t) ? 0 : t;
      };
      events.sort((a, b) => safeTime(b.timestamp) - safeTime(a.timestamp));
      res.json(events.slice(0, 50));
    } catch (error: any) {
      console.error("Activity feed error:", error?.message, error?.stack);
      res.status(500).json({ error: "Failed to load activity feed", detail: error?.message });
    }
  });

  // ==================== WORKLOAD BALANCING: agent capacity analysis ====================
  // ==================== AGENT STATS ====================
  app.get("/api/agents/:id/stats", async (req, res) => {
    try {
      const agentId = Number(req.params.id);
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const tasks = await storage.getAgentTasks();
      const agentTasks = tasks.filter(t => t.assignedAgentId === agentId);
      const completedTasks = agentTasks.filter(t => t.status === "completed").length;
      const pendingTasks = agentTasks.filter(t => ["pending", "thinking", "proposal_ready", "under_review"].includes(t.status)).length;
      const rejectedTasks = agentTasks.filter(t => t.status === "rejected").length;

      // Recent completed tasks (last 5)
      const recentTasks = agentTasks
        .filter(t => t.status === "completed" && t.completedAt)
        .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
        .slice(0, 5)
        .map(t => ({ id: t.id, title: t.title, completedAt: t.completedAt }));

      // Total AI cost from transactions
      const transactions = await storage.getTransactions();
      const totalCost = transactions
        .filter(t => t.category === "AI Compute" && t.agentId === agentId)
        .reduce((sum, t) => sum + t.amount, 0);

      res.json({
        totalTasks: agentTasks.length,
        completedTasks,
        pendingTasks,
        rejectedTasks,
        recentTasks,
        totalCost,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load agent stats", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: CANCEL (stop stuck tasks) ====================
  app.post("/api/tasks/:id/cancel", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const task = await storage.getAgentTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      if (task.status !== "executing" && task.status !== "thinking") {
        return res.status(400).json({ error: "Task is not executing or thinking" });
      }

      // Cancel sub-tasks that are still running
      const allTasks = await storage.getAgentTasks();
      const subTasks = allTasks.filter(t => t.parentTaskId === taskId);
      for (const sub of subTasks) {
        if (["thinking", "executing", "pending"].includes(sub.status)) {
          await storage.updateAgentTask(sub.id, {
            status: "rejected",
            executionLog: (sub.executionLog || "") + "\nCancelled by owner.",
          });
        }
      }

      // Reset main task to pending so it can be re-triggered or modified
      await storage.updateAgentTask(taskId, {
        status: "pending",
        executionLog: (task.executionLog || "") + "\nExecution cancelled by owner. Task reset to pending.",
        workflowStage: null,
      });

      const updated = await storage.getAgentTask(taskId);
      res.json(updated);
    } catch (error: any) {
      console.error("Task cancel error:", error);
      res.status(500).json({ error: "Failed to cancel task", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: RESET STUCK (bulk unstick executing/thinking tasks) ====================
  app.post("/api/tasks/reset-stuck", async (req, res) => {
    try {
      const allTasks = await storage.getAgentTasks();
      const stuckStatuses = ["executing", "thinking", "under_review"];
      const stuckTasks = allTasks.filter(t => stuckStatuses.includes(t.status));
      const resetIds: number[] = [];
      for (const t of stuckTasks) {
        await storage.updateAgentTask(t.id, { status: "pending" });
        resetIds.push(t.id);
      }
      // Re-trigger autoThinkTask for each reset task with staggered delays
      resetIds.forEach((id, i) => {
        setTimeout(() => autoThinkTask(id), (i + 1) * 2000);
      });
      res.json({ reset: resetIds.length, taskIds: resetIds });
    } catch (error: any) {
      console.error("Reset stuck error:", error);
      res.status(500).json({ error: "Failed to reset stuck tasks", details: error.message });
    }
  });

  // ==================== PANIC: Cancel all non-completed tasks ====================
  app.post("/api/tasks/cancel-all", async (req, res) => {
    try {
      const allTasks = await storage.getAgentTasks();
      const cancelStatuses = ["pending", "thinking", "executing", "under_review", "proposal_ready", "blocked"];
      const toCancelTasks = allTasks.filter(t => cancelStatuses.includes(t.status));
      let cancelled = 0;
      for (const t of toCancelTasks) {
        await storage.updateAgentTask(t.id, {
          status: "rejected",
          result: "Cancelled via emergency stop.",
          executionLog: `Emergency cancel at ${new Date().toISOString()}.`,
        });
        cancelled++;
      }
      console.log(`[cancel-all] Cancelled ${cancelled} tasks`);
      res.json({ cancelled });
    } catch (error: any) {
      console.error("Cancel all error:", error);
      res.status(500).json({ error: "Failed to cancel tasks", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: RETRY (reset rejected task) ====================
  app.post("/api/tasks/:id/retry", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const task = await storage.getAgentTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      if (task.status !== "rejected") {
        return res.status(400).json({ error: "Only rejected tasks can be retried" });
      }

      await storage.updateAgentTask(taskId, {
        status: "pending",
        proposal: null,
        proposedActions: null,
        executionLog: null,
        workflowStage: null,
      });

      // Re-trigger thinking
      autoThinkTask(taskId);

      const updated = await storage.getAgentTask(taskId);
      res.json(updated);
    } catch (error: any) {
      console.error("Task retry error:", error);
      res.status(500).json({ error: "Failed to retry task", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: REJECT ====================
  app.post("/api/tasks/:id/reject", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });

      const { feedback } = req.body;

      await storage.updateAgentTask(task.id, {
        status: "rejected",
        executionLog: feedback ? `Owner feedback: ${feedback}` : "Rejected by owner.",
      });

      // Auto-record decision
      await storage.createDecisionLogEntry({
        type: "rejection",
        description: `Rejected task: "${task.title}"${feedback ? ` — ${feedback}` : ""}`,
        madeBy: "owner",
        relatedId: task.id,
        timestamp: new Date().toISOString(),
        impact: "medium",
      });

      // Check if this rejection completes a parent task's sub-task set
      if (task.parentTaskId) {
        setTimeout(() => resolveZombieParent(task.parentTaskId), 500);
      }

      const updated = await storage.getAgentTask(task.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Task reject error:", error);
      res.status(500).json({ error: "Failed to reject task", details: error.message });
    }
  });

  // ==================== TASK EXECUTION: REVISE WITH FEEDBACK ====================
  app.post("/api/tasks/:id/revise", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });

      const agent = await storage.getAgent(task.assignedAgentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const { feedback } = req.body;
      const companyContext = await getCompanyContext();

      await storage.updateAgentTask(task.id, { status: "thinking" });

      const isHireTask = task.type === "hire_agent" || task.type === "propose_orgchart";

      let systemPrompt = `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You previously proposed a plan for a task, but the owner has requested revisions.\n\nCOMPANY CONTEXT:\n${companyContext}\n\n`;

      if (isHireTask) {
        const allAgents = await storage.getAgents();
        const agentListForRevision = allAgents.map(a => `  - ID ${a.id}: ${a.name} (${a.role}, ${a.department})`).join('\n');
        systemPrompt += `Revise your hiring proposal based on the owner's feedback. Return the revised agent profiles in a json code block (triple backticks) as before:
[{ "name": "...", "role": "...", "department": "...", "avatar": "emoji", "instructions": "...", "skills": [...], "parentId": <ID of direct manager>, "color": "#hex", "rationale": "..." }]

CURRENT ORG CHART:
${agentListForRevision}

REPORTING LINE RULES (CRITICAL):
- parentId must be the NUMERIC ID of the new hire's direct manager from the org chart above.
- C-suite / department heads report to CEO (ID 1). Team members report to their department head.
- DO NOT set parentId to null. Always pick the correct manager based on role hierarchy.`;
      } else {
        systemPrompt += `Revise your proposal based on the owner's feedback. Be specific about what you've changed and why.`;
      }

      const response = await trackedAI({
        
        instructions: systemPrompt,
        input: `Original task: ${task.title}\nDetails: ${task.description}\n\nYour previous proposal:\n${task.proposal}\n\nOwner's feedback for revision:\n${feedback}`,
      }, { label: `Revise: ${task.title}`, agentId: task.assignedAgentId });

      const proposalText = response.output_text;
      const jsonMatch = proposalText.match(/```json\s*([\s\S]*?)```/) || proposalText.match(/```\s*([\s\S]*?)```/);
      const proposedActions = jsonMatch ? jsonMatch[1].trim() : null;

      await storage.updateAgentTask(task.id, {
        status: "proposal_ready",
        proposal: proposalText,
        proposedActions: proposedActions,
      });

      const updated = await storage.getAgentTask(task.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Task revise error:", error);
      res.status(500).json({ error: "Failed to revise", details: error.message });
    }
  });

  // ==================== AGENT DISCUSSION ON TASK ====================
  app.post("/api/tasks/:id/discuss", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });

      const { agentId, messageType } = req.body;
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const currentThread: any[] = task.discussionThread ? JSON.parse(task.discussionThread) : [];
      const threadContext = currentThread.map(m => `[${m.agentName}]: ${m.content}`).join("\n");
      const companyContext = await getCompanyContext();

      const response = await trackedAI({
        
        instructions: `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. You are participating in a discussion about a task.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nRead the task details and existing discussion, then contribute a ${messageType || "comment"} that adds value. Be concise (under 150 words). Think about how your expertise relates to this task.`,
        input: `Task: ${task.title}\nDescription: ${task.description}\n\n${threadContext ? `Discussion so far:\n${threadContext}\n\n` : ""}Provide your perspective as ${agent.role}.`,
      }, { label: `Discussion: ${agent.name} on ${task.title}`, agentId: agent.id });

      const newMessage = {
        id: `msg_${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        content: response.output_text,
        type: messageType || "comment",
        timestamp: new Date().toISOString(),
      };

      currentThread.push(newMessage);
      await storage.updateAgentTask(task.id, { discussionThread: JSON.stringify(currentThread) });

      const updated = await storage.getAgentTask(task.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Discussion error:", error);
      res.status(500).json({ error: "Failed to add discussion", details: error.message });
    }
  });

  // ==================== GENERATE DELIVERABLE ====================
  app.post("/api/tasks/:id/generate-deliverable", async (req, res) => {
    try {
      const task = await storage.getAgentTask(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });

      const { agentId, deliverableType, title: delivTitle } = req.body;
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const typePrompts: Record<string, string> = {
        document: "Write a professional document. Use clear headings, bullet points, and structured format.",
        code: "Write clean, production-ready code with comments. Include imports and error handling.",
        design: "Create a detailed design specification with layout descriptions, component hierarchy, and style notes.",
        spec: "Write a technical specification with requirements, architecture, data models, and API contracts.",
        report: "Write a comprehensive report with executive summary, findings, analysis, and recommendations.",
      };

      const response = await trackedAI({
        
        instructions: `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role}. ${typePrompts[deliverableType] || "Produce the requested deliverable."} Be thorough and professional. This deliverable will be reviewed.`,
        input: `Task: ${task.title}\nDescription: ${task.description}\n\nProduce: ${delivTitle || deliverableType}`,
      }, { label: `Deliverable: ${delivTitle || deliverableType}`, agentId: agent.id });

      const currentDeliverables: any[] = task.deliverables ? JSON.parse(task.deliverables) : [];
      const newDeliverable = {
        id: `del_${Date.now()}`,
        title: delivTitle || `${deliverableType} - ${task.title}`,
        type: deliverableType,
        content: response.output_text,
        producedBy: agent.id,
        version: 1,
        createdAt: new Date().toISOString(),
      };

      currentDeliverables.push(newDeliverable);
      await storage.updateAgentTask(task.id, { deliverables: JSON.stringify(currentDeliverables) });

      const updated = await storage.getAgentTask(task.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Deliverable error:", error);
      res.status(500).json({ error: "Failed to generate deliverable", details: error.message });
    }
  });

  // ==================== GOALS / OKRs ====================
  app.get("/api/goals", async (_req, res) => {
    const goals = await storage.getGoals();
    res.json(goals);
  });

  app.get("/api/goals/:id", async (req, res) => {
    const goal = await storage.getGoal(Number(req.params.id));
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);
  });

  app.post("/api/goals", async (req, res) => {
    const goal = await storage.createGoal(req.body);
    res.status(201).json(goal);
  });

  app.patch("/api/goals/:id", async (req, res) => {
    const goal = await storage.updateGoal(Number(req.params.id), req.body);
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);

    // If a key result was updated, re-sync its parent objective's progress
    if (goal.type === "key_result" && goal.parentGoalId) {
      syncGoalProgress(goal.parentGoalId);
    }
    // If an objective was updated with new linkedProjectIds, re-sync
    if (goal.type === "objective") {
      syncGoalProgress(goal.id);
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    const success = await storage.deleteGoal(Number(req.params.id));
    if (!success) return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true });
  });

  // ==================== AI PROPOSE OBJECTIVES & KRs ====================
  app.post("/api/strategy/propose", async (_req, res) => {
    try {
      const companyContext = await getCompanyContext();
      const goals = await storage.getGoals();
      const projects = await storage.getProjects();
      const agents = await storage.getAgents();
      const decisions = await storage.getDecisionLog();
      const allTasks = await storage.getAgentTasks();

      // Gather agent memories for deeper company knowledge
      const allMemories: string[] = [];
      for (const agent of agents) {
        const memories = await storage.getAgentMemories(agent.id);
        for (const m of memories.slice(0, 10)) {
          allMemories.push(`[${agent.name}] ${m.content}`);
        }
      }

      // Gather deliverables/outcomes from completed tasks
      const completedTasks = allTasks.filter(t => t.status === "completed" && t.executionLog);
      const outcomes = completedTasks.slice(-30).map(t => {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        return `- ${t.title} (${agent?.name || "??"}): ${t.executionLog!.replace(/\n/g, " ").slice(0, 150)}`;
      }).join("\n");

      // Gather recent decisions for strategic direction
      const recentDecisions = decisions.slice(-20).map((d: any) => `[${d.type}] ${d.description}`).join("\n");

      // Financial context
      const transactions = await storage.getTransactions();
      const totalRevenue = transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
      const totalSpend = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);

      // Existing objectives to avoid duplication
      const existingObjectives = goals.filter(g => g.type === "objective").map(g => g.title);

      const agentList = agents.map(a => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");

      const resp = await trackedAI({
        instructions: `You are a world-class strategic advisor. Based on the full company context — including the org chart, completed work, agent memories, financial data, recent decisions, project portfolio, and existing objectives — propose NEW strategic objectives with measurable key results.

RULES:
- Propose 3-5 objectives that the company should pursue
- Each objective should have 2-4 specific, measurable key results
- DO NOT duplicate existing objectives: ${existingObjectives.join(", ") || "(none yet)"}
- Ground proposals in actual company data — reference real projects, agents, financials, or decisions
- Each objective needs an ownerId (agent ID of the best person to own it)
- Key results must be quantifiable with clear targets
- Consider gaps, risks, and opportunities visible in the data
- Quarter should be realistic based on current progress

AVAILABLE AGENTS:
${agentList}

COMPANY CONTEXT:
${companyContext}

AGENT KNOWLEDGE (memories):
${allMemories.slice(0, 40).join("\n")}

RECENT OUTCOMES:
${outcomes}

KEY DECISIONS:
${recentDecisions}

FINANCIALS: Revenue: $${(totalRevenue / 100).toFixed(2)}, Spend: $${(totalSpend / 100).toFixed(2)}, Net: $${((totalRevenue - totalSpend) / 100).toFixed(2)}

Return a JSON array of objectives. Each objective:
{
  "title": "...",
  "description": "...",
  "quarter": "Q1 2026" | "Q2 2026" | ...,
  "ownerId": <agent ID>,
  "reasoning": "Why this objective matters now, referencing specific company data",
  "keyResults": [
    { "title": "...", "ownerId": <agent ID> }
  ]
}

Return ONLY the JSON array.`,
        input: `Propose strategic objectives for the company. Current date: ${new Date().toISOString()}. We have ${agents.length} agents, ${projects.length} projects (${projects.filter(p => p.status === "completed").length} completed), ${allTasks.length} tasks (${completedTasks.length} completed), and ${goals.filter(g => g.type === "objective").length} existing objectives.`,
      }, { label: "Strategy: AI propose objectives & KRs" });

      const match = resp.output_text.match(/\[[\s\S]*\]/);
      const proposals = match ? JSON.parse(match[0]) : [];

      res.json({ proposals, rawText: resp.output_text });
    } catch (error: any) {
      console.error("[strategy-propose] Error:", error.message);
      res.status(500).json({ error: "Failed to propose strategy", details: error.message });
    }
  });

  // ==================== DERIVE PROJECTS FROM STRATEGY ====================
  app.post("/api/goals/:id/derive-projects", async (req, res) => {
    try {
      const goalId = Number(req.params.id);
      const goal = await storage.getGoal(goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      // Gather related key results
      const allGoals = await storage.getGoals();
      const relatedKRs = allGoals.filter(g => g.parentGoalId === goalId && g.type === "key_result");

      const companyContext = await getCompanyContext();
      const agents = await storage.getAgents();

      const agentList = agents.map(a => `${a.id}: ${a.name} — ${a.role} (${a.department})`).join("\n");

      const response = await trackedAI({
        
        instructions: `You are a strategic project planner. Given a company objective and its key results, propose concrete projects that will advance them.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nAVAILABLE AGENTS (use their IDs for assignment):\n${agentList}\n\nReturn a JSON array inside triple backtick code blocks. Each project object:\n[\n  {\n    "title": "Project Title",\n    "description": "What this project delivers and why",\n    "priority": "high|medium|low",\n    "assignedAgentId": <agent_id or null>\n  }\n]\n\nPropose 2-5 actionable projects. Each project should directly advance the objective or one of its key results. Be specific, not generic.`,
        input: `Objective: ${goal.title}\nDescription: ${goal.description}\n\nKey Results:\n${relatedKRs.map((kr, i) => `${i + 1}. ${kr.title} (${kr.progress}% done)`).join("\n") || "(none yet)"}\n\nPropose projects to advance this objective.`,
      }, { label: `Derive projects from: ${goal.title}`, agentId: null });

      // Parse the response
      const text = response.output_text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
      let projectsData: any[] = [];
      if (jsonMatch) {
        try { projectsData = JSON.parse(jsonMatch[1].trim()); } catch {}
      }
      if (projectsData.length === 0) {
        const bareMatch = text.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
        if (bareMatch) {
          try { projectsData = JSON.parse(bareMatch[1]); } catch {}
        }
      }

      // Return proposed projects for review (not created yet)
      res.json({ proposals: projectsData, rawText: text, goalId: goal.id, goalTitle: goal.title });
    } catch (error: any) {
      console.error("Derive projects from strategy error:", error);
      res.status(500).json({ error: "Failed to derive projects", details: error.message });
    }
  });

  // ==================== DASHBOARD STATS ====================
  app.get("/api/dashboard/stats", async (_req, res) => {
    const agents = await storage.getAgents();
    const tasks = await storage.getAgentTasks();
    const projects = await storage.getProjects();
    const transactions = await storage.getTransactions();
    const meetings = await storage.getMeetings();
    const goals = await storage.getGoals();

    const activeTasks = tasks.filter(t => !["completed", "rejected"].includes(t.status)).length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const totalEarnings = transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);

    // Agent utilization
    const agentUtilization = agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
      const active = agentTasks.filter(t => !["completed", "rejected"].includes(t.status)).length;
      const completed = agentTasks.filter(t => t.status === "completed").length;
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        avatar: agent.avatar,
        color: agent.color,
        activeTasks: active,
        completedTasks: completed,
        totalTasks: agentTasks.length,
      };
    });

    // Department breakdown
    const departments: Record<string, number> = {};
    agents.forEach(a => {
      departments[a.department] = (departments[a.department] || 0) + 1;
    });

    const tokenStats = await storage.getTokenStats();

    res.json({
      agents: { total: agents.length, active: agents.filter(a => a.status === "active").length },
      tasks: { total: tasks.length, active: activeTasks, completed: completedTasks, pending: tasks.filter(t => t.status === "pending").length },
      projects: { total: projects.length, backlog: projects.filter(p => p.status === "backlog").length, inProgress: projects.filter(p => p.status === "in_progress").length, completed: projects.filter(p => p.status === "completed").length },
      finances: { totalEarnings, totalExpenses, profit: totalEarnings - totalExpenses },
      meetings: { total: meetings.length, active: meetings.filter(m => m.status === "active").length },
      goals: { total: goals.length, active: goals.filter(g => g.status === "active").length, avgProgress: goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0 },
      agentUtilization,
      departments,
      tokenStats,
    });
  });

  // ==================== DATA MANAGEMENT ====================
  app.get("/api/data/export", async (_req, res) => {
    try {
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();
      const projects = await storage.getProjects();
      const meetings = await storage.getMeetings();
      const decisions = await storage.getDecisionLog();
      const risks = await storage.getRisks();
      const workflows = await storage.getWorkflows();
      const clients = await storage.getClients();
      const goals = await storage.getGoals();
      const checklists = await storage.getChecklists();
      const sops = await storage.getSOPs();
      const transactions = await storage.getTransactions();
      const timeline = await storage.getTimelineEvents();
      const snapshots = await storage.getSnapshots();
      let scheduledTasks: any[] = [];
      try {
        const stgs = await storage.getSettings();
        scheduledTasks = (stgs as any).scheduledTasks || [];
      } catch {}

      const exportData = {
        exportDate: new Date().toISOString(),
        version: "2.0",
        summary: {
          agents: agents.length,
          tasks: tasks.length,
          projects: projects.length,
          meetings: meetings.length,
          decisions: decisions.length,
          risks: risks.length,
          workflows: workflows.length,
          clients: clients.length,
          goals: goals.length,
          checklists: checklists.length,
          sops: sops.length,
          transactions: transactions.length,
          timelineEvents: timeline.length,
          snapshots: snapshots.length,
          scheduledTasks: scheduledTasks.length,
        },
        data: {
          agents,
          tasks,
          projects,
          meetings,
          decisions,
          risks,
          workflows,
          clients,
          goals,
          checklists,
          sops,
          transactions,
          timelineEvents: timeline,
          snapshots,
          scheduledTasks,
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="control-tower-backup-${new Date().toISOString().slice(0,10)}.json"`);
      res.send(json);
    } catch (error: any) {
      // Fallback to raw export
      const json = (storage as SQLiteStorage).exportData();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="control-tower-backup-${new Date().toISOString().slice(0,10)}.json"`);
      res.send(json);
    }
  });

  app.post("/api/data/import", async (req, res) => {
    try {
      const success = (storage as SQLiteStorage).importData(JSON.stringify(req.body));
      if (success) res.json({ success: true, message: "Data imported successfully" });
      else res.status(400).json({ error: "Invalid data format" });
    } catch (e) {
      res.status(400).json({ error: "Failed to import data" });
    }
  });

  app.post("/api/data/reset", (_req, res) => {
    (storage as SQLiteStorage).resetData();
    res.json({ success: true, message: "Data reset to initial state" });
  });

  // ==================== NOTIFICATIONS ====================
  app.get("/api/notifications", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const notifications: { type: string; message: string; link: string; priority: number }[] = [];

      // Proposals awaiting approval
      const proposalReady = tasks.filter(t => t.status === "proposal_ready").length;
      if (proposalReady > 0) {
        notifications.push({
          type: "proposals",
          message: `${proposalReady} proposal${proposalReady > 1 ? "s" : ""} awaiting approval`,
          link: "/tasks",
          priority: 2,
        });
      }

      // Blocked tasks
      const blockedCount = tasks.filter(t => t.status === "blocked").length;
      if (blockedCount > 0) {
        notifications.push({
          type: "blocked",
          message: `${blockedCount} task${blockedCount > 1 ? "s" : ""} blocked`,
          link: "/tasks",
          priority: 3,
        });
      }

      // Overloaded agents (loadScore > 8)
      for (const agent of agents) {
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
        const active = agentTasks.filter(t => ["pending", "thinking", "executing", "proposal_ready"].includes(t.status)).length;
        const blocked = agentTasks.filter(t => t.status === "blocked").length;
        const loadScore = active * 2 + blocked;
        if (loadScore > 8) {
          notifications.push({
            type: "overloaded",
            message: `Agent ${agent.name} is overloaded`,
            link: "/org-chart",
            priority: 4,
          });
        }
      }

      // Critical/high severity open risks
      try {
        const risks = await storage.getRisks();
        const criticalRisks = risks.filter((r: any) => r.status === "open" && (r.severity === "critical" || r.severity === "high"));
        if (criticalRisks.length > 0) {
          notifications.push({
            type: "risks",
            message: `${criticalRisks.length} high/critical risk${criticalRisks.length > 1 ? "s" : ""} open`,
            link: "/risks",
            priority: 5,
          });
        }
      } catch {}

      // Completed projects (progress === 100)
      try {
        const projects = await storage.getProjects();
        const completedProjects = projects.filter((p: any) => p.progress === 100 && p.status !== "archived");
        if (completedProjects.length > 0) {
          notifications.push({
            type: "project_complete",
            message: `${completedProjects.length} project${completedProjects.length > 1 ? "s" : ""} completed`,
            link: "/projects",
            priority: 1,
          });
        }
      } catch {}

      // Stalled workflows (active but no recent task completions)
      try {
        const workflows = await storage.getWorkflows();
        const activeWorkflows = workflows.filter((w: any) => w.status === "active");
        const now = Date.now();
        const stalledCount = activeWorkflows.filter((w: any) => {
          const wfTasks = tasks.filter(t => (t as any).workflowId === w.id || (t as any).workflowStage);
          const recentCompletion = wfTasks.some(t => t.completedAt && (now - new Date(t.completedAt).getTime()) < 86400000);
          return !recentCompletion;
        }).length;
        if (stalledCount > 0) {
          notifications.push({
            type: "stalled_workflow",
            message: `${stalledCount} workflow${stalledCount > 1 ? "s" : ""} with no activity in 24h`,
            link: "/workflows",
            priority: 2,
          });
        }
      } catch {}

      // Upcoming scheduled tasks (due in next 2 hours)
      try {
        const stgs = await storage.getSettings();
        const scheduled = (stgs as any).scheduledTasks || [];
        const twoHoursFromNow = Date.now() + 7200000;
        const upcoming = scheduled.filter((s: any) => s.status === "active" && s.nextRun && new Date(s.nextRun).getTime() <= twoHoursFromNow && new Date(s.nextRun).getTime() > Date.now());
        if (upcoming.length > 0) {
          notifications.push({
            type: "scheduled_upcoming",
            message: `${upcoming.length} scheduled task${upcoming.length > 1 ? "s" : ""} due within 2 hours`,
            link: "/schedules",
            priority: 2,
          });
        }
      } catch {}

      // Budget alerts (expenses exceed 80% of department budget)
      try {
        const transactions = await storage.getTransactions();
        const totalExpenses = transactions.filter((t: any) => t.type === "expenditure").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const totalEarnings = transactions.filter((t: any) => t.type === "earning").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        if (totalEarnings > 0 && totalExpenses > totalEarnings * 0.8) {
          notifications.push({
            type: "budget_alert",
            message: `Expenses at ${Math.round((totalExpenses / totalEarnings) * 100)}% of total revenue`,
            link: "/finances",
            priority: 5,
          });
        }
      } catch {}

      // Sort by priority (highest first)
      notifications.sort((a, b) => b.priority - a.priority);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load notifications" });
    }
  });

  // Token stats endpoint
  app.get("/api/token-stats", async (_req, res) => {
    const stats = await storage.getTokenStats();
    res.json(stats);
  });

  // ==================== INTELLIGENCE ====================
  app.get("/api/intelligence/digest", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const projects = await storage.getProjects();
      const recentCompleted = tasks
        .filter(t => t.status === "completed" && t.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 20);
      const inProgress = tasks.filter(t => ["thinking", "executing", "under_review", "proposal_ready"].includes(t.status));
      const blocked = tasks.filter(t => t.status === "blocked");
      const projectSummaries = projects.map(p => `${p.name}: ${p.progress || 0}% complete (${p.status})`).join("\n");

      const companyContext = `Company: ${(await storage.getSettings()).companyName || "AI Company"}\nAgents: ${agents.length}\nProjects: ${projects.length}\nActive tasks: ${inProgress.length}\nBlocked tasks: ${blocked.length}\nRecently completed: ${recentCompleted.length}\n\nProject status:\n${projectSummaries}\n\nRecently completed work:\n${recentCompleted.map(t => {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        return `- "${t.title}" by ${agent?.name || "Unknown"} (${t.completedAt?.slice(0, 10)})`;
      }).join("\n")}\n\nCurrently in progress:\n${inProgress.map(t => {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        return `- "${t.title}" by ${agent?.name || "Unknown"} [${t.status}]`;
      }).join("\n")}\n\nBlocked work:\n${blocked.map(t => {
        const agent = agents.find(a => a.id === t.assignedAgentId);
        return `- "${t.title}" by ${agent?.name || "Unknown"} — blocked by task IDs: ${t.dependencies || "unknown"}`;
      }).join("\n")}`;

      const response = await trackedAI({
        instructions: `You are a strategic AI advisor for the company. Produce a concise executive digest covering:\n\n1. **Key Achievements** (what was accomplished recently)\n2. **Current Focus** (what's actively being worked on)\n3. **Bottlenecks & Risks** (blocked tasks, overloaded agents, missed connections)\n4. **Cross-Team Connections** (work in one area that affects another)\n5. **Strategic Recommendations** (what should be prioritized next)\n\nBe specific. Reference actual task names, agent names, and project names. Keep it concise and actionable.`,
        input: companyContext,
      }, { label: "Company Intelligence Digest" });

      res.json({ digest: response.output_text, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PRODUCTS ====================
  app.get("/api/products", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      const products = (settings as any).products || [];
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { name, description, url, type, status, icon } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const settings = await storage.getSettings();
      const products = (settings as any).products || [];
      const newProduct = {
        id: Date.now(),
        name,
        description: description || "",
        url: url || "",
        type: type || "website",
        status: status || "development",
        icon: icon || "\uD83D\uDCE6",
        createdAt: new Date().toISOString(),
      };
      products.push(newProduct);
      await storage.updateSettings({ products });
      res.json(newProduct);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const settings = await storage.getSettings();
      const products = (settings as any).products || [];
      const idx = products.findIndex((p: any) => p.id === productId);
      if (idx === -1) return res.status(404).json({ error: "Product not found" });
      products[idx] = { ...products[idx], ...req.body };
      await storage.updateSettings({ products });
      res.json(products[idx]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const settings = await storage.getSettings();
      const products = (settings as any).products || [];
      const filtered = products.filter((p: any) => p.id !== productId);
      await storage.updateSettings({ products: filtered });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CREDIT PAUSE STATUS ====================
  app.get("/api/credit-pause", async (_req, res) => {
    res.json({
      paused: _creditPaused,
      reason: _creditPauseReason,
      pausedAt: _creditPausedAt?.toISOString() || null,
      resumeAt: _creditResumeAt?.toISOString() || null,
      backoffMinutes: _creditBackoffMinutes,
    });
  });

  // Manual resume (CEO override)
  app.post("/api/credit-pause/resume", async (_req, res) => {
    if (_creditRetryTimer) clearTimeout(_creditRetryTimer);
    _creditPaused = false;
    _creditPauseReason = "";
    _creditPausedAt = null;
    _creditResumeAt = null;
    _creditBackoffMinutes = 5;
    console.log(`[credit-pause] \u25b6 Manually resumed by CEO`);
    kickNextPending();
    res.json({ ok: true, message: "Credit pause lifted. Task processing resumed." });
  });

  // Manual pause
  app.post("/api/credit-pause/pause", async (req, res) => {
    const reason = req.body?.reason || "Manually paused by CEO";
    enterCreditPause(reason);
    res.json({ ok: true, message: "Task processing paused.", resumeAt: _creditResumeAt?.toISOString() });
  });

  // ==================== SYSTEM PAUSE/RESUME ====================
  app.get("/api/system/status", async (_req, res) => {
    res.json({
      paused: _systemPaused,
      pausedAt: _systemPausedAt?.toISOString() || null,
      creditPaused: _creditPaused,
      creditPauseReason: _creditPauseReason,
      creditResumeAt: _creditResumeAt?.toISOString() || null,
      activeAICalls: _activeAICalls,
      maxConcurrent: MAX_GLOBAL_CONCURRENT,
    });
  });

  app.post("/api/system/pause", async (_req, res) => {
    _systemPaused = true;
    _systemPausedAt = new Date();
    console.log(`[system] ⏸ System PAUSED by user at ${_systemPausedAt.toISOString()}`);
    await storage.createDecisionLogEntry({
      type: "config_change",
      description: "System paused — all task processing, watchdog, and queue processor frozen",
      madeBy: "owner",
      relatedId: null,
      timestamp: new Date().toISOString(),
      impact: "high",
    });
    res.json({ paused: true, pausedAt: _systemPausedAt.toISOString() });
  });

  app.post("/api/system/resume", async (_req, res) => {
    const wasPausedAt = _systemPausedAt;
    _systemPaused = false;
    _systemPausedAt = null;
    console.log(`[system] ▶ System RESUMED by user`);
    await storage.createDecisionLogEntry({
      type: "config_change",
      description: `System resumed — task processing reactivated (was paused since ${wasPausedAt?.toISOString() || "unknown"})`,
      madeBy: "owner",
      relatedId: null,
      timestamp: new Date().toISOString(),
      impact: "high",
    });
    // Kick the queue to immediately start processing again
    kickNextPending();
    res.json({ paused: false });
  });

  // ==================== SETTINGS ====================
  app.get("/api/settings", async (_req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch("/api/settings", async (req, res) => {
    const settings = await storage.updateSettings(req.body);

    // Auto-record decision
    const changedKeys = Object.keys(req.body).join(", ");
    await storage.createDecisionLogEntry({
      type: "config_change",
      description: `Settings updated: ${changedKeys}`,
      madeBy: "owner",
      relatedId: null,
      timestamp: new Date().toISOString(),
      impact: "low",
    });

    res.json(settings);
  });

  // Available AI models list (for frontend pickers)
  app.get("/api/models", (_req, res) => {
    res.json(AI_MODELS);
  });

  // ==================== KNOWLEDGE BASE ====================
  app.get("/api/knowledge-base", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const meetings = await storage.getMeetings();
      const items: any[] = [];

      // Extract deliverables from completed tasks
      for (const task of tasks) {
        if (task.deliverables) {
          try {
            const deliverables = JSON.parse(task.deliverables);
            if (Array.isArray(deliverables)) {
              for (const d of deliverables) {
                const agent = agents.find(a => a.id === (d.producedBy || task.assignedAgentId));
                items.push({
                  id: d.id || `del-${task.id}-${items.length}`,
                  title: d.title,
                  type: d.type || "document",
                  category: "deliverable",
                  content: d.content || "",
                  taskId: task.id,
                  taskTitle: task.title,
                  projectId: task.projectId,
                  agentId: d.producedBy || task.assignedAgentId,
                  agentName: agent?.name || "Unknown",
                  agentAvatar: agent?.avatar || "🤖",
                  createdAt: d.createdAt || task.completedAt || task.createdAt,
                  version: d.version || 1,
                });
              }
            }
          } catch {}
        }

        // Execution logs from completed tasks as "reports"
        if (task.status === "completed" && task.executionLog && task.executionLog.length > 100) {
          const agent = agents.find(a => a.id === task.assignedAgentId);
          items.push({
            id: `log-${task.id}`,
            title: `${task.title} — Execution Report`,
            type: "report",
            category: "execution_log",
            content: task.executionLog,
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            agentId: task.assignedAgentId,
            agentName: agent?.name || "Unknown",
            agentAvatar: agent?.avatar || "🤖",
            createdAt: task.completedAt || task.createdAt,
            version: 1,
          });
        }
      }

      // Meeting minutes from closed meetings with full details
      for (const m of meetings.filter(mt => mt.status === "completed")) {
        const participantNames = m.agentIds
          .map((id: number) => agents.find(a => a.id === id)?.name || `Agent #${id}`)
          .filter(Boolean);
        let minutesContent = `# Meeting Minutes: ${m.title}\n\n`;
        minutesContent += `**Date:** ${new Date(m.createdAt).toLocaleDateString()}\n`;
        minutesContent += `**Topic:** ${m.topic}\n`;
        minutesContent += `**Participants:** ${participantNames.join(", ")}\n\n`;

        // Include meeting messages/rounds
        try {
          const messages = await storage.getMeetingMessages(m.id);
          if (messages.length > 0) {
            minutesContent += `## Discussion\n\n`;
            for (const msg of messages.slice(0, 30)) {
              minutesContent += `**${msg.senderName}:** ${msg.content}\n\n`;
            }
          }
        } catch {}

        // Include action items (tasks created from this meeting)
        const meetingTasks = tasks.filter(t => (t as any).meetingId === m.id);
        if (meetingTasks.length > 0) {
          minutesContent += `## Action Items\n\n`;
          for (const t of meetingTasks) {
            const assignee = agents.find(a => a.id === t.assignedAgentId);
            minutesContent += `- **${t.title}** → ${assignee?.name || "Unassigned"} (${t.status})\n`;
          }
        }

        items.push({
          id: `meeting-${m.id}`,
          title: `${m.title} — Meeting Minutes`,
          type: "document",
          category: "meeting_minutes",
          content: minutesContent,
          meetingId: m.id,
          taskId: null,
          taskTitle: null,
          projectId: null,
          agentId: null,
          agentName: "Board",
          agentAvatar: "📋",
          participants: participantNames,
          actionItemCount: meetingTasks.length,
          createdAt: m.createdAt,
          version: 1,
        });
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== SCHEDULED TASKS ====================
  app.get("/api/scheduled-tasks", async (_req, res) => {
    const stgs = await storage.getSettings();
    const scheduled = (stgs as any).scheduledTasks || [];
    res.json(scheduled);
  });

  app.post("/api/scheduled-tasks", async (req, res) => {
    const stgs = await storage.getSettings();
    const scheduledTasks = (stgs as any).scheduledTasks || [];
    const id = Date.now();
    const item = {
      id,
      ...req.body,
      status: "active",
      lastRun: null,
      nextRun: computeNextRun(req.body.frequency, req.body.startDate),
      createdAt: new Date().toISOString(),
    };
    scheduledTasks.push(item);
    await storage.updateSettings({ scheduledTasks });
    res.json(item);
  });

  app.patch("/api/scheduled-tasks/:id", async (req, res) => {
    const stgs = await storage.getSettings();
    const scheduledTasks = (stgs as any).scheduledTasks || [];
    const idx = scheduledTasks.findIndex((s: any) => s.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    Object.assign(scheduledTasks[idx], req.body);
    if (req.body.frequency || req.body.startDate) {
      scheduledTasks[idx].nextRun = computeNextRun(
        req.body.frequency || scheduledTasks[idx].frequency,
        req.body.startDate || scheduledTasks[idx].startDate
      );
    }
    await storage.updateSettings({ scheduledTasks });
    res.json(scheduledTasks[idx]);
  });

  app.delete("/api/scheduled-tasks/:id", async (req, res) => {
    const stgs = await storage.getSettings();
    const scheduledTasks = ((stgs as any).scheduledTasks || []).filter((s: any) => s.id !== Number(req.params.id));
    await storage.updateSettings({ scheduledTasks });
    res.json({ ok: true });
  });

  app.post("/api/scheduled-tasks/:id/run", async (req, res) => {
    const stgs = await storage.getSettings();
    const scheduledTasks = (stgs as any).scheduledTasks || [];
    const task = scheduledTasks.find((s: any) => s.id === Number(req.params.id));
    if (!task) return res.status(404).json({ error: "Not found" });

    // Create the actual agent task from the template
    const newTask = await storage.createAgentTask({
      title: task.title,
      description: task.description || task.title,
      assignedAgentId: task.assignedAgentId,
      type: task.taskType || "general",
      priority: task.priority || "medium",
      projectId: task.projectId || null,
      createdAt: new Date().toISOString(),
      status: "pending",
      proposal: null,
      proposedActions: null,
      executionLog: null,
      meetingId: null,
      parentTaskId: null,
      dependsOn: null,
      deliverables: null,
      collaborators: null,
      discussionThread: null,
      workflowStage: null,
      completedAt: null,
    });

    // Update last run and next run
    task.lastRun = new Date().toISOString();
    task.runCount = (task.runCount || 0) + 1;
    task.nextRun = computeNextRun(task.frequency, task.startDate);
    await storage.updateSettings({ scheduledTasks });

    res.json({ scheduledTask: task, createdTask: newTask });
  });

  // ==================== AGENT MEMORIES (Iteration 1) ====================
  app.get("/api/agents/:id/memories", async (req, res) => {
    const memories = await storage.getAgentMemories(Number(req.params.id));
    res.json(memories);
  });

  app.post("/api/agents/:id/memories", async (req, res) => {
    const agentId = Number(req.params.id);
    const agent = await storage.getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const memory = await storage.createAgentMemory({
      agentId,
      type: req.body.type || "fact",
      content: req.body.content,
      source: req.body.source || null,
      createdAt: new Date().toISOString(),
      importance: req.body.importance || 3,
    });
    res.status(201).json(memory);
  });

  // ==================== AGENT MESSAGES (Iteration 2) ====================
  app.get("/api/messages", async (req, res) => {
    const agentId = Number(req.query.agentId);
    if (!agentId) return res.status(400).json({ error: "agentId query param required" });
    const messages = await storage.getAgentMessages(agentId);
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const message = await storage.createAgentMessage({
      fromAgentId: req.body.fromAgentId,
      toAgentId: req.body.toAgentId,
      content: req.body.content,
      type: req.body.type || "update",
      relatedTaskId: req.body.relatedTaskId || null,
      read: false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(message);
  });

  app.patch("/api/messages/:id", async (req, res) => {
    const updated = await storage.updateAgentMessage(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Message not found" });
    res.json(updated);
  });

  // ==================== WORKFLOWS (Iteration 4) ====================
  app.get("/api/workflows", async (_req, res) => {
    const workflows = await storage.getWorkflows();
    res.json(workflows);
  });

  app.get("/api/workflows/:id", async (req, res) => {
    const workflow = await storage.getWorkflow(Number(req.params.id));
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    res.json(workflow);
  });

  app.post("/api/workflows", async (req, res) => {
    const workflow = await storage.createWorkflow({
      name: req.body.name,
      description: req.body.description || "",
      steps: req.body.steps || [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(workflow);
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    const updated = await storage.updateWorkflow(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Workflow not found" });
    res.json(updated);
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    const success = await storage.deleteWorkflow(Number(req.params.id));
    if (!success) return res.status(404).json({ error: "Workflow not found" });
    res.json({ success: true });
  });

  // Execute a workflow: creates linked tasks from steps
  app.post("/api/workflows/:id/execute", async (req, res) => {
    try {
      const workflow = await storage.getWorkflow(Number(req.params.id));
      if (!workflow) return res.status(404).json({ error: "Workflow not found" });

      const projectId = req.body.projectId || null;
      const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);
      const createdTaskIds: number[] = [];

      for (const step of sortedSteps) {
        // Determine assigned agent: use step's agent, or fall back to request body default
        let assignedAgentId = step.assignedAgentId || req.body.defaultAgentId;
        if (!assignedAgentId) {
          const agents = await storage.getAgents();
          assignedAgentId = agents[0]?.id || 1;
        }

        // Dependencies: each step depends on the previous step's task
        const dependsOn = createdTaskIds.length > 0
          ? JSON.stringify([createdTaskIds[createdTaskIds.length - 1]])
          : null;

        const task = await storage.createAgentTask({
          title: step.title,
          description: `Workflow "${workflow.name}" — Step ${step.order}: ${step.title}`,
          assignedAgentId,
          type: "general",
          status: createdTaskIds.length === 0 ? "pending" : "blocked",
          projectId,
          parentTaskId: null,
          dependsOn,
          priority: "medium",
          workflowStage: step.type || null,
          createdAt: new Date().toISOString(),
          proposal: null,
          proposedActions: null,
          executionLog: null,
          meetingId: null,
          deliverables: null,
          collaborators: null,
          discussionThread: null,
          completedAt: null,
        });
        createdTaskIds.push(task.id);
      }

      // Auto-start thinking for the first task
      if (createdTaskIds.length > 0) {
        autoThinkTask(createdTaskIds[0]);
      }

      res.json({ workflowId: workflow.id, taskIds: createdTaskIds });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to execute workflow", details: error.message });
    }
  });

  // Seed default workflow templates
  app.post("/api/workflows/seed-templates", async (_req, res) => {
    const existing = await storage.getWorkflows();
    if (existing.length > 0) return res.json({ message: "Templates already exist", count: existing.length });

    const templates = [
      {
        name: "New Feature Development",
        description: "End-to-end feature development from design to deployment",
        steps: [
          { order: 1, title: "Requirements & Design", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 4 },
          { order: 2, title: "Implementation", assignedAgentId: null, type: "development", autoApprove: false, estimatedHours: 8 },
          { order: 3, title: "Testing & QA", assignedAgentId: null, type: "testing", autoApprove: false, estimatedHours: 4 },
          { order: 4, title: "Code Review", assignedAgentId: null, type: "review", autoApprove: false, estimatedHours: 2 },
          { order: 5, title: "Deploy to Production", assignedAgentId: null, type: "deploy", autoApprove: false, estimatedHours: 1 },
        ],
      },
      {
        name: "Content Creation",
        description: "Create and publish content pieces",
        steps: [
          { order: 1, title: "Research & Outline", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 2 },
          { order: 2, title: "Draft Content", assignedAgentId: null, type: "development", autoApprove: false, estimatedHours: 4 },
          { order: 3, title: "Review & Edit", assignedAgentId: null, type: "review", autoApprove: false, estimatedHours: 2 },
          { order: 4, title: "Publish", assignedAgentId: null, type: "deploy", autoApprove: false, estimatedHours: 1 },
        ],
      },
      {
        name: "Hiring Pipeline",
        description: "End-to-end hiring process for new team members",
        steps: [
          { order: 1, title: "Define Role Requirements", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 2 },
          { order: 2, title: "Source Candidates", assignedAgentId: null, type: "development", autoApprove: false, estimatedHours: 6 },
          { order: 3, title: "Interview & Assess", assignedAgentId: null, type: "testing", autoApprove: false, estimatedHours: 4 },
          { order: 4, title: "Make Offer", assignedAgentId: null, type: "review", autoApprove: false, estimatedHours: 1 },
          { order: 5, title: "Onboarding", assignedAgentId: null, type: "deploy", autoApprove: false, estimatedHours: 8 },
        ],
      },
      {
        name: "Bug Fix",
        description: "Investigate and fix a reported bug",
        steps: [
          { order: 1, title: "Investigate & Reproduce", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 2 },
          { order: 2, title: "Implement Fix", assignedAgentId: null, type: "development", autoApprove: false, estimatedHours: 4 },
          { order: 3, title: "Test Fix", assignedAgentId: null, type: "testing", autoApprove: false, estimatedHours: 2 },
          { order: 4, title: "Deploy Fix", assignedAgentId: null, type: "deploy", autoApprove: false, estimatedHours: 1 },
        ],
      },
      {
        name: "Client Onboarding",
        description: "Onboard a new client from kickoff to delivery",
        steps: [
          { order: 1, title: "Kickoff Meeting", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 1 },
          { order: 2, title: "Requirements Gathering", assignedAgentId: null, type: "design", autoApprove: false, estimatedHours: 4 },
          { order: 3, title: "Setup & Configuration", assignedAgentId: null, type: "development", autoApprove: false, estimatedHours: 6 },
          { order: 4, title: "Training & Handoff", assignedAgentId: null, type: "deploy", autoApprove: false, estimatedHours: 3 },
        ],
      },
    ];

    const created = [];
    for (const t of templates) {
      const w = await storage.createWorkflow({ ...t, createdAt: new Date().toISOString() });
      created.push(w);
    }
    res.json({ message: "Templates seeded", count: created.length, workflows: created });
  });

  // ==================== AGENT SKILL SUGGESTION (Iteration 5) ====================
  app.get("/api/agents/suggest", async (req, res) => {
    try {
      const taskDescription = req.query.taskDescription as string;
      if (!taskDescription) return res.status(400).json({ error: "taskDescription query param required" });

      const agents = await storage.getAgents();
      const ranked = agents.map(agent => {
        let score = 0;
        const descLower = taskDescription.toLowerCase();

        // Score based on skills match
        const skills = agent.skills || [];
        for (const skill of skills) {
          if (descLower.includes(skill.toLowerCase())) score += 3;
        }

        // Score based on capabilities (stored as JSON in agent)
        const capabilities: Array<{ name: string; level: string; category: string }> = (agent as any).capabilities || [];
        for (const cap of capabilities) {
          if (descLower.includes(cap.name.toLowerCase())) {
            score += cap.level === "expert" ? 5 : cap.level === "intermediate" ? 3 : 1;
          }
        }

        // Score based on role match
        const roleWords = agent.role.toLowerCase().split(/\s+/);
        for (const w of roleWords) {
          if (w.length > 3 && descLower.includes(w)) score += 2;
        }

        // Score based on department match
        if (descLower.includes(agent.department.toLowerCase())) score += 2;

        return { agentId: agent.id, name: agent.name, role: agent.role, avatar: agent.avatar, score };
      }).filter(a => a.score > 0).sort((a, b) => b.score - a.score);

      res.json(ranked.slice(0, 5));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to suggest agents", details: error.message });
    }
  });

  // ==================== DEPARTMENTS (Iteration 6) ====================
  app.get("/api/departments", async (_req, res) => {
    try {
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();
      const projects = await storage.getProjects();
      const transactions = await storage.getTransactions();

      const deptMap: Record<string, typeof agents> = {};
      for (const agent of agents) {
        if (!deptMap[agent.department]) deptMap[agent.department] = [];
        deptMap[agent.department].push(agent);
      }

      const departments = Object.entries(deptMap).map(([name, deptAgents]) => {
        const agentIds = deptAgents.map(a => a.id);
        const deptTasks = tasks.filter(t => agentIds.includes(t.assignedAgentId));
        const completedTasks = deptTasks.filter(t => t.status === "completed");
        const activeTasks = deptTasks.filter(t => ["pending", "thinking", "executing", "proposal_ready", "under_review"].includes(t.status));
        const deptProjects = projects.filter(p => p.assignedAgentId && agentIds.includes(p.assignedAgentId));
        const deptCost = transactions.filter(t => t.agentId && agentIds.includes(t.agentId)).reduce((sum, t) => sum + t.amount, 0);

        // Avg response time: time from creation to completion for completed tasks
        let avgResponseMs = 0;
        if (completedTasks.length > 0) {
          const totalMs = completedTasks.reduce((sum, t) => {
            if (t.completedAt) {
              return sum + (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime());
            }
            return sum;
          }, 0);
          avgResponseMs = totalMs / completedTasks.length;
        }

        const budgetAllocated = Math.round(deptCost * 1.2); // Allocated = 120% of actual spend as estimate
        const budgetRemaining = budgetAllocated - deptCost;
        const budgetUtilization = budgetAllocated > 0 ? Math.round((deptCost / budgetAllocated) * 100) : 0;
        const recentTransactions = transactions
          .filter(t => t.agentId && agentIds.includes(t.agentId))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
          .map(t => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, type: t.type }));

        return {
          name,
          agentCount: deptAgents.length,
          agents: deptAgents.map(a => ({
            id: a.id, name: a.name, role: a.role, avatar: a.avatar, color: a.color, status: a.status,
            activeTasks: deptTasks.filter(t => t.assignedAgentId === a.id && ["pending", "thinking", "executing", "proposal_ready", "under_review"].includes(t.status)).length,
            completedTasks: deptTasks.filter(t => t.assignedAgentId === a.id && t.status === "completed").length,
            totalTasks: deptTasks.filter(t => t.assignedAgentId === a.id).length,
          })),
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          totalTasks: deptTasks.length,
          activeProjects: deptProjects.filter(p => p.status === "in_progress").length,
          budget: deptCost,
          budgetAllocated,
          budgetSpent: deptCost,
          budgetRemaining,
          budgetUtilization,
          recentTransactions,
          avgResponseTime: avgResponseMs,
          performance: deptTasks.length > 0 ? Math.round((completedTasks.length / deptTasks.length) * 100) : 0,
        };
      });

      departments.sort((a, b) => b.agentCount - a.agentCount);
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load departments", details: error.message });
    }
  });

  // ==================== NOTIFICATIONS (Iteration 7) ====================
  app.get("/api/notifications/stored", async (_req, res) => {
    const notifications = await storage.getNotifications();
    res.json(notifications);
  });

  app.post("/api/notifications/stored", async (req, res) => {
    const notification = await storage.createNotification({
      type: req.body.type || "general",
      title: req.body.title,
      message: req.body.message,
      link: req.body.link || "",
      read: false,
      createdAt: new Date().toISOString(),
      priority: req.body.priority || "medium",
    });
    res.status(201).json(notification);
  });

  app.patch("/api/notifications/stored/:id", async (req, res) => {
    const updated = await storage.updateNotification(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json(updated);
  });

  app.post("/api/notifications/stored/mark-all-read", async (_req, res) => {
    const notifications = await storage.getNotifications();
    for (const n of notifications) {
      if (!n.read) await storage.updateNotification(n.id, { read: true });
    }
    res.json({ ok: true });
  });

  app.post("/api/notifications/stored/clear", async (_req, res) => {
    await storage.clearNotifications();
    res.json({ ok: true });
  });

  // ==================== DECISION LOG (Iteration 8) ====================
  app.get("/api/decisions", async (_req, res) => {
    const log = await storage.getDecisionLog();
    res.json(log);
  });

  app.post("/api/decisions", async (req, res) => {
    const entry = await storage.createDecisionLogEntry({
      type: req.body.type,
      description: req.body.description,
      madeBy: req.body.madeBy || "owner",
      relatedId: req.body.relatedId || null,
      timestamp: new Date().toISOString(),
      impact: req.body.impact || "medium",
    });
    res.status(201).json(entry);
  });

  // ==================== AGENT CHAT (Iteration 9) ====================
  app.get("/api/agents/:id/chat", async (req, res) => {
    const agentId = Number(req.params.id);
    const allMessages = await storage.getAgentMessages(agentId);
    const chatMessages = allMessages.filter(m => (m as any).type === "owner_chat");
    res.json(chatMessages);
  });

  app.post("/api/agents/:id/chat", async (req, res) => {
    try {
      const agentId = Number(req.params.id);
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const userMessage = req.body.message;
      if (!userMessage) return res.status(400).json({ error: "message required" });

      // Store user message (fromAgentId=0 means owner)
      await storage.createAgentMessage({
        fromAgentId: 0,
        toAgentId: agentId,
        content: userMessage,
        type: "owner_chat" as any,
        relatedTaskId: null,
        read: true,
        createdAt: new Date().toISOString(),
      });

      // Get chat history for context
      const allMessages = await storage.getAgentMessages(agentId);
      const chatHistory = allMessages
        .filter(m => (m as any).type === "owner_chat")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-20);

      // Get agent memories
      const memories = await storage.getAgentMemories(agentId);
      const memoryContext = memories.length > 0
        ? `\n\nYour memories:\n${memories.slice(0, 10).map(m => `- [${m.type}] ${m.content}`).join("\n")}`
        : "";

      // Get agent's tasks
      const agentTasks = await storage.getAgentTasksByAgent(agentId);
      const activeTasks = agentTasks.filter(t => ["pending", "thinking", "executing", "proposal_ready", "under_review"].includes(t.status));
      const taskContext = activeTasks.length > 0
        ? `\n\nYour current tasks:\n${activeTasks.slice(0, 5).map(t => `- ${t.title} (${t.status})`).join("\n")}`
        : "";

      const companyContext = await getCompanyContext();

      // Build conversation context from history
      const historyContext = chatHistory.slice(0, -1).map(msg => {
        if (msg.fromAgentId === 0) return `Owner: ${msg.content}`;
        return `${agent.name}: ${msg.content}`;
      }).join("\n");

      const systemPrompt = `You are ${agent.name}, the ${agent.role} in the ${agent.department} department.\n\n${agent.instructions || "You are a helpful AI agent."}${memoryContext}${taskContext}\n\nCompany context:\n${companyContext}\n\nYou are now chatting directly with the company owner. Stay in character, be helpful, and reference your knowledge of the company.${historyContext ? `\n\nConversation so far:\n${historyContext}` : ""}`;

      const result = await trackedAI({
        instructions: systemPrompt,
        input: userMessage,
      }, { label: `Chat with ${agent.name}`, agentId });

      const responseText = result.output_text;

      // Store agent response
      const agentResponse = await storage.createAgentMessage({
        fromAgentId: agentId,
        toAgentId: 0,
        content: responseText,
        type: "owner_chat" as any,
        relatedTaskId: null,
        read: false,
        createdAt: new Date().toISOString(),
      });

      res.json({ message: agentResponse, response: responseText });
    } catch (error: any) {
      res.status(500).json({ error: "Chat failed", details: error.message });
    }
  });

  // ==================== REPORTS (Iteration 10) ====================
  app.get("/api/reports/daily", async (_req, res) => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayStr = dayAgo.toISOString();

      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const meetings = await storage.getMeetings();
      const transactions = await storage.getTransactions();
      const projects = await storage.getProjects();
      const decisions = await storage.getDecisionLog();

      const completedToday = tasks.filter(t => t.completedAt && t.completedAt >= dayStr);
      const createdToday = tasks.filter(t => t.createdAt >= dayStr);
      const proposalsToday = tasks.filter(t => t.status === "proposal_ready" && t.createdAt >= dayStr);
      const meetingsToday = meetings.filter(m => m.createdAt >= dayStr);
      const transactionsToday = transactions.filter(t => t.date >= dayStr);
      const costsToday = transactionsToday.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
      const earningsToday = transactionsToday.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
      const decisionsToday = decisions.filter(d => d.timestamp >= dayStr);
      const activeProjects = projects.filter(p => p.status === "in_progress");

      res.json({
        period: "daily",
        from: dayStr,
        to: now.toISOString(),
        metrics: {
          tasksCompleted: completedToday.length,
          tasksCreated: createdToday.length,
          proposalsMade: proposalsToday.length,
          meetingsHeld: meetingsToday.length,
          costIncurred: costsToday,
          earningsGenerated: earningsToday,
          decisionsLogged: decisionsToday.length,
          activeProjects: activeProjects.length,
          totalAgents: agents.length,
        },
        recentCompletions: completedToday.slice(0, 10).map(t => ({
          id: t.id, title: t.title, assignedAgentId: t.assignedAgentId,
          agentName: agents.find(a => a.id === t.assignedAgentId)?.name || "Unknown",
          completedAt: t.completedAt,
        })),
        projectProgress: activeProjects.map(p => ({
          id: p.id, title: p.title, progress: p.progress,
          completedTasks: p.completedTasks, totalTasks: p.totalTasks,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate daily report", details: error.message });
    }
  });

  app.get("/api/reports/weekly", async (_req, res) => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekStr = weekAgo.toISOString();

      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const meetings = await storage.getMeetings();
      const transactions = await storage.getTransactions();
      const projects = await storage.getProjects();
      const decisions = await storage.getDecisionLog();

      const completedThisWeek = tasks.filter(t => t.completedAt && t.completedAt >= weekStr);
      const createdThisWeek = tasks.filter(t => t.createdAt >= weekStr);
      const meetingsThisWeek = meetings.filter(m => m.createdAt >= weekStr);
      const transactionsThisWeek = transactions.filter(t => t.date >= weekStr);
      const costsThisWeek = transactionsThisWeek.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
      const earningsThisWeek = transactionsThisWeek.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
      const decisionsThisWeek = decisions.filter(d => d.timestamp >= weekStr);

      // Per-agent breakdown
      const agentBreakdown = agents.map(a => {
        const agentTasks = tasks.filter(t => t.assignedAgentId === a.id);
        const completed = agentTasks.filter(t => t.completedAt && t.completedAt >= weekStr);
        const cost = transactionsThisWeek.filter(t => t.agentId === a.id).reduce((s, t) => s + t.amount, 0);
        return {
          id: a.id, name: a.name, avatar: a.avatar, role: a.role, department: a.department,
          tasksCompleted: completed.length,
          totalActive: agentTasks.filter(t => ["pending", "thinking", "executing", "proposal_ready"].includes(t.status)).length,
          cost,
        };
      }).sort((a, b) => b.tasksCompleted - a.tasksCompleted);

      // New hires this week
      const newHires = agents.filter(a => {
        const hireTasks = tasks.filter(t => t.type === "hire_agent" && t.status === "completed" && t.completedAt && t.completedAt >= weekStr);
        return hireTasks.some(t => {
          try {
            const actions = JSON.parse(t.proposedActions || "[]");
            return actions.some((act: any) => act.agentName === a.name);
          } catch { return false; }
        });
      });

      res.json({
        period: "weekly",
        from: weekStr,
        to: now.toISOString(),
        metrics: {
          tasksCompleted: completedThisWeek.length,
          tasksCreated: createdThisWeek.length,
          meetingsHeld: meetingsThisWeek.length,
          costIncurred: costsThisWeek,
          earningsGenerated: earningsThisWeek,
          decisionsLogged: decisionsThisWeek.length,
          newHires: newHires.length,
        },
        agentBreakdown,
        projectProgress: projects.filter(p => p.status === "in_progress").map(p => ({
          id: p.id, title: p.title, progress: p.progress,
          completedTasks: p.completedTasks, totalTasks: p.totalTasks,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate weekly report", details: error.message });
    }
  });

  // ==================== ANALYTICS (Iteration 11) ====================
  app.get("/api/analytics", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const transactions = await storage.getTransactions();
      const now = new Date();

      // KPIs
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const totalSpent = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
      const avgCostPerTask = completedTasks > 0 ? Math.round(totalSpent / completedTasks) : 0;
      const activeAgents = agents.filter(a => a.status === "active").length;

      // Agent performance
      const agentPerformance = agents.map(agent => {
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
        const completed = agentTasks.filter(t => t.status === "completed");
        const rejected = agentTasks.filter(t => t.status === "rejected");
        const completionTimes = completed
          .filter(t => t.completedAt && t.createdAt)
          .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
        const avgTime = completionTimes.length > 0 ? Math.round(completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length * 10) / 10 : 0;
        const agentSpend = transactions.filter(t => t.agentId === agent.id && t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
        return {
          agentId: agent.id, name: agent.name, avatar: agent.avatar, department: agent.department,
          totalTasks: agentTasks.length, completedTasks: completed.length, rejectedTasks: rejected.length,
          rejectionRate: agentTasks.length > 0 ? Math.round((rejected.length / agentTasks.length) * 100) : 0,
          avgCompletionTimeMs: avgTime * 3600000,
          qualityScore: agentTasks.length > 0 ? Math.round(((completed.length) / Math.max(agentTasks.length - rejected.length, 1)) * 100) : 100,
          totalSpend: agentSpend,
        };
      });

      // Daily velocity (last 30 days)
      const velocityData: { date: string; completed: number; created: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        velocityData.push({
          date: dateStr,
          completed: tasks.filter(t => t.completedAt && t.completedAt.startsWith(dateStr)).length,
          created: tasks.filter(t => t.createdAt.startsWith(dateStr)).length,
        });
      }

      // Cost by department
      const deptCosts: Record<string, number> = {};
      for (const agent of agents) {
        const spend = transactions.filter(t => t.agentId === agent.id && t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
        deptCosts[agent.department] = (deptCosts[agent.department] || 0) + spend;
      }
      const costByDepartment = Object.entries(deptCosts).map(([dept, amount]) => ({ department: dept, cost: amount }));

      // Cost trend (last 30 days)
      const costTrend: { date: string; cost: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        costTrend.push({
          date: dateStr,
          cost: transactions.filter(t => t.type === "expenditure" && t.date.startsWith(dateStr)).reduce((s, t) => s + t.amount, 0),
        });
      }

      res.json({
        kpis: { totalTasks, completedTasks, completionRate, avgCostPerTask, activeAgents },
        agentPerformance,
        velocityData,
        costByDepartment,
        costTrend,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to compute analytics", details: error.message });
    }
  });

  // ==================== ROI & COST OPTIMIZATION (Iteration 12) ====================
  app.get("/api/analytics/roi", async (_req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const transactions = await storage.getTransactions();

      const totalExpenses = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
      const totalEarnings = transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0);
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const costPerTask = completedTasks > 0 ? Math.round(totalExpenses / completedTasks) : 0;

      // Estimated human equivalent: assume $50/hr avg, 2hrs per task
      const humanCostPerTask = 50 * 100 * 2; // $100 in cents
      const humanEquivalentCost = completedTasks * humanCostPerTask;
      const savingsEstimate = humanEquivalentCost - totalExpenses;
      const savingsPercent = humanEquivalentCost > 0 ? Math.round((savingsEstimate / humanEquivalentCost) * 100) : 0;

      // Per-agent cost per day
      const now = new Date();
      const agentCosts = agents.map(agent => {
        const agentTxs = transactions.filter(t => t.agentId === agent.id && t.type === "expenditure");
        const totalAgentSpend = agentTxs.reduce((s, t) => s + t.amount, 0);
        const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
        const completed = agentTasks.filter(t => t.status === "completed").length;
        const firstTx = agentTxs.sort((a, b) => a.date.localeCompare(b.date))[0];
        const daysActive = firstTx ? Math.max(1, Math.ceil((now.getTime() - new Date(firstTx.date).getTime()) / (1000 * 60 * 60 * 24))) : 1;
        return {
          id: agent.id, name: agent.name, avatar: agent.avatar, department: agent.department,
          totalSpend: totalAgentSpend, costPerDay: Math.round(totalAgentSpend / daysActive),
          tasksCompleted: completed, costPerTask: completed > 0 ? Math.round(totalAgentSpend / completed) : 0,
        };
      });

      // Department budgets
      const deptBudgets: Record<string, { spent: number; agentCount: number }> = {};
      for (const agent of agents) {
        if (!deptBudgets[agent.department]) deptBudgets[agent.department] = { spent: 0, agentCount: 0 };
        deptBudgets[agent.department].agentCount++;
        deptBudgets[agent.department].spent += transactions.filter(t => t.agentId === agent.id && t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
      }
      const departmentBudgets = Object.entries(deptBudgets).map(([dept, data]) => ({ department: dept, ...data }));

      // Projections: monthly/quarterly at current burn rate
      const last30Days = transactions.filter(t => t.type === "expenditure" && new Date(t.date).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last30Spend = last30Days.reduce((s, t) => s + t.amount, 0);
      const monthlyProjection = last30Spend;
      const quarterlyProjection = last30Spend * 3;

      res.json({
        costPerTask,
        humanEquivalentCost,
        savingsEstimate,
        savingsPercent,
        totalExpenses,
        totalEarnings,
        agentCosts,
        departmentBudgets,
        projections: { monthly: monthlyProjection, quarterly: quarterlyProjection, dailyBurn: Math.round(last30Spend / 30) },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to compute ROI", details: error.message });
    }
  });

  // ==================== SNAPSHOTS (Iteration 13) ====================
  app.get("/api/snapshots", async (_req, res) => {
    const snapshots = await storage.getSnapshots();
    res.json(snapshots);
  });

  app.post("/api/snapshots", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();
      const projects = await storage.getProjects();
      const transactions = await storage.getTransactions();
      const meetings = await storage.getMeetings();
      const decisions = await storage.getDecisionLog();
      const risks = await storage.getRisks();
      const workflows = await storage.getWorkflows();
      const goals = await storage.getGoals();

      const deptMap: Record<string, number> = {};
      for (const a of agents) {
        deptMap[a.department] = (deptMap[a.department] || 0) + 1;
      }

      // OKR progress: average progress of active objectives
      const activeObjectives = goals.filter((g: any) => g.type === "objective" && g.status === "active");
      const avgOkrProgress = activeObjectives.length > 0
        ? Math.round(activeObjectives.reduce((s: number, g: any) => s + (g.progress || 0), 0) / activeObjectives.length)
        : 0;

      const snapshot = await storage.createSnapshot({
        name: req.body.name || `Snapshot ${new Date().toLocaleDateString()}`,
        timestamp: new Date().toISOString(),
        data: {
          agentCount: agents.length,
          taskStats: {
            total: tasks.length,
            completed: tasks.filter(t => t.status === "completed").length,
            pending: tasks.filter(t => ["pending", "thinking", "proposal_ready", "executing"].includes(t.status)).length,
            rejected: tasks.filter(t => t.status === "rejected").length,
          },
          projectStats: {
            total: projects.length,
            completed: projects.filter(p => p.status === "completed").length,
            inProgress: projects.filter(p => p.status === "in_progress").length,
            backlog: projects.filter(p => p.status === "backlog").length,
          },
          financials: {
            totalEarnings: transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0),
            totalExpenses: transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0),
            netRevenue: transactions.filter(t => t.type === "earning").reduce((s, t) => s + t.amount, 0) - transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0),
          },
          orgStructure: {
            departments: [...new Set(agents.map(a => a.department))],
            agentsByDept: deptMap,
          },
          meetingsCount: meetings.length,
          decisionsCount: decisions.length,
          risksCount: risks.length,
          workflowsCount: workflows.length,
          knowledgeArticlesCount: decisions.filter((d: any) => d.type === "meeting_decision" && d.madeBy === "system").length,
          okrProgress: { activeObjectives: activeObjectives.length, avgProgress: avgOkrProgress },
        } as any,
      });

      res.status(201).json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create snapshot", details: error.message });
    }
  });

  // ==================== SCENARIO PLANNING (Iteration 14) ====================
  app.post("/api/scenarios/analyze", async (req, res) => {
    try {
      const { type, params } = req.body;
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();
      const transactions = await storage.getTransactions();

      if (type === "hire") {
        const count = params?.count || 1;
        const avgCostPerAgent = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0) / Math.max(agents.length, 1);
        const currentCapacity = agents.length;
        const activeTasks = tasks.filter(t => !["completed", "rejected"].includes(t.status)).length;
        const avgTasksPerAgent = activeTasks / Math.max(currentCapacity, 1);
        res.json({
          scenario: "hire",
          currentAgents: currentCapacity,
          newAgents: currentCapacity + count,
          additionalMonthlyCost: Math.round(avgCostPerAgent * count),
          currentCapacityUtil: Math.round(avgTasksPerAgent * 100) / 100,
          projectedCapacityUtil: Math.round((activeTasks / (currentCapacity + count)) * 100) / 100,
          additionalCapacity: count * Math.ceil(avgTasksPerAgent || 3),
        });
      } else if (type === "lose_agent") {
        const agentId = params?.agentId;
        const agent = agents.find(a => a.id === agentId);
        const agentTasks = tasks.filter(t => t.assignedAgentId === agentId && !["completed", "rejected"].includes(t.status));
        const dependentTasks = tasks.filter(t => {
          if (!t.dependsOn) return false;
          try {
            const deps = JSON.parse(t.dependsOn);
            return deps.some((d: number) => agentTasks.some(at => at.id === d));
          } catch { return false; }
        });
        const subordinates = agents.filter(a => a.parentId === agentId);
        res.json({
          scenario: "lose_agent",
          agent: agent ? { id: agent.id, name: agent.name, role: agent.role, department: agent.department } : null,
          activeTasks: agentTasks.length,
          impactedTasks: agentTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
          dependentTasks: dependentTasks.length,
          subordinates: subordinates.map(s => ({ id: s.id, name: s.name, role: s.role })),
          riskLevel: agentTasks.length > 5 ? "high" : agentTasks.length > 2 ? "medium" : "low",
        });
      } else if (type === "double_workload") {
        const activeTasks = tasks.filter(t => !["completed", "rejected"].includes(t.status)).length;
        const activeAgentCount = agents.filter(a => a.status === "active").length;
        const currentLoad = activeTasks / Math.max(activeAgentCount, 1);
        const projectedLoad = (activeTasks * 2) / Math.max(activeAgentCount, 1);
        const additionalAgentsNeeded = Math.ceil((activeTasks * 2) / Math.max(currentLoad, 3)) - activeAgentCount;
        const avgCostPerAgent = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0) / Math.max(agents.length, 1);
        res.json({
          scenario: "double_workload",
          currentTasks: activeTasks,
          projectedTasks: activeTasks * 2,
          currentAgents: activeAgentCount,
          currentLoadPerAgent: Math.round(currentLoad * 100) / 100,
          projectedLoadPerAgent: Math.round(projectedLoad * 100) / 100,
          additionalAgentsNeeded: Math.max(0, additionalAgentsNeeded),
          additionalCost: Math.round(Math.max(0, additionalAgentsNeeded) * avgCostPerAgent),
          feasible: projectedLoad <= 8,
        });
      } else if (type === "budget_cut") {
        const cutPercent = params?.cutPercent || 20;
        const totalExpenditure = transactions.filter(t => t.type === "expenditure").reduce((s, t) => s + t.amount, 0);
        const cutAmount = Math.round(totalExpenditure * (cutPercent / 100));
        const projects = await storage.getProjects();

        // Find agents by utilization (ascending — least utilized first)
        const activeTasks = tasks.filter(t => !["completed", "rejected"].includes(t.status));
        const agentUtil = agents.map(a => {
          const agentTasks = activeTasks.filter(t => t.assignedAgentId === a.id);
          return { id: a.id, name: a.name, role: a.role, department: a.department, activeTasks: agentTasks.length };
        }).sort((a, b) => a.activeTasks - b.activeTasks);

        // Non-critical tasks that could be paused
        const pausableTasks = activeTasks
          .filter(t => t.priority !== "urgent" && t.priority !== "high")
          .map(t => ({ id: t.id, title: t.title, priority: t.priority, assignedAgentId: t.assignedAgentId }));

        // Affected projects
        const activeProjects = projects.filter(p => p.status === "in_progress");
        const avgCostPerAgent = totalExpenditure / Math.max(agents.length, 1);
        const agentsToReduce = Math.ceil(cutAmount / Math.max(avgCostPerAgent, 1));

        res.json({
          scenario: "budget_cut",
          cutPercent,
          currentBudget: totalExpenditure,
          cutAmount,
          lowestUtilAgents: agentUtil.slice(0, Math.min(5, agentUtil.length)),
          pausableTasks: pausableTasks.slice(0, 10),
          pausableTaskCount: pausableTasks.length,
          affectedProjects: activeProjects.length,
          estimatedAgentReduction: agentsToReduce,
          riskLevel: cutPercent > 30 ? "high" : cutPercent > 15 ? "medium" : "low",
        });
      } else {
        res.status(400).json({ error: "Unknown scenario type. Use: hire, lose_agent, double_workload, budget_cut" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to analyze scenario", details: error.message });
    }
  });

  // ==================== SOPs (Iteration 15) ====================
  app.get("/api/sops", async (_req, res) => {
    const sops = await storage.getSOPs();
    res.json(sops);
  });

  app.get("/api/sops/:id", async (req, res) => {
    const sop = await storage.getSOP(Number(req.params.id));
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json(sop);
  });

  app.post("/api/sops", async (req, res) => {
    const sop = await storage.createSOP({
      title: req.body.title,
      category: req.body.category || "General",
      steps: req.body.steps || [],
      department: req.body.department || "All",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json(sop);
  });

  app.patch("/api/sops/:id", async (req, res) => {
    const sop = await storage.updateSOP(Number(req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json(sop);
  });

  app.delete("/api/sops/:id", async (req, res) => {
    const success = await storage.deleteSOP(Number(req.params.id));
    if (!success) return res.status(404).json({ error: "SOP not found" });
    res.json({ success: true });
  });

  app.post("/api/sops/:id/to-workflow", async (req, res) => {
    try {
      const sop = await storage.getSOP(Number(req.params.id));
      if (!sop) return res.status(404).json({ error: "SOP not found" });

      const workflow = await storage.createWorkflow({
        name: sop.title,
        description: `Auto-generated from SOP: ${sop.title}`,
        steps: sop.steps.map((step, i) => ({
          order: i + 1,
          title: step,
          assignedAgentId: null,
          type: "task",
          autoApprove: false,
          estimatedHours: 1,
        })),
        createdAt: new Date().toISOString(),
      });

      res.status(201).json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to convert SOP to workflow", details: error.message });
    }
  });

  app.post("/api/sops/seed", async (_req, res) => {
    try {
      const existing = await storage.getSOPs();
      if (existing.length > 0) return res.json({ message: "SOPs already seeded", count: existing.length });

      const seeds = [
        { title: "Onboarding New Agent", category: "HR", department: "Executive", steps: ["Define role requirements and department", "Create agent with appropriate skills and instructions", "Assign reporting manager (parentId)", "Set autonomy level", "Create initial onboarding tasks", "Monitor first task completion", "Adjust instructions based on performance"] },
        { title: "Feature Development Lifecycle", category: "Engineering", department: "Engineering", steps: ["Create feature specification task", "Assign to lead engineer agent", "Review and approve proposal", "Break down into sub-tasks", "Execute development tasks", "Run quality review", "Deploy and verify"] },
        { title: "Bug Triage", category: "Engineering", department: "Engineering", steps: ["Log bug report with reproduction steps", "Assign severity level (low/medium/high/critical)", "Assign to appropriate agent", "Root cause analysis", "Propose fix", "Review and approve fix", "Verify resolution"] },
        { title: "Client Deliverable Review", category: "Operations", department: "Operations", steps: ["Collect all deliverable artifacts", "Assign review to senior agent", "Check against project requirements", "Quality assessment scoring", "Request revisions if needed", "Final approval", "Package and deliver to client"] },
        { title: "Monthly Reporting", category: "Operations", department: "Executive", steps: ["Gather financial data from transactions", "Compile task completion metrics", "Review project progress", "Generate performance analytics", "Create executive summary", "Review with leadership agents", "Distribute to stakeholders"] },
        { title: "Incident Response", category: "Engineering", department: "Engineering", steps: ["Detect and log incident", "Assess severity and impact", "Assemble response team", "Investigate root cause", "Implement fix or workaround", "Verify resolution", "Post-incident review and documentation"] },
      ];

      const created = [];
      for (const seed of seeds) {
        const sop = await storage.createSOP({ ...seed, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        created.push(sop);
      }

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to seed SOPs", details: error.message });
    }
  });

  app.post("/api/reports/narrative", async (req, res) => {
    try {
      const period = req.body.period || "daily";
      const reportUrl = period === "weekly" ? "/api/reports/weekly" : "/api/reports/daily";

      // Fetch the report data internally
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const meetings = await storage.getMeetings();
      const transactions = await storage.getTransactions();
      const projects = await storage.getProjects();

      const now = new Date();
      const cutoff = period === "weekly"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString();

      const completedTasks = tasks.filter(t => t.completedAt && t.completedAt >= cutoffStr);
      const cost = transactions.filter(t => t.date >= cutoffStr && t.type === "expenditure").reduce((s, t) => s + t.amount, 0);

      const summary = `Period: ${period} (${cutoff.toLocaleDateString()} to ${now.toLocaleDateString()})
Agents: ${agents.length}
Tasks completed: ${completedTasks.length}
Active projects: ${projects.filter(p => p.status === "in_progress").length}
Meetings held: ${meetings.filter(m => m.createdAt >= cutoffStr).length}
Cost: $${(cost / 100).toFixed(2)}`;

      const result = await trackedAI(
        [
          { role: "system", content: "You are a concise business report writer. Write a brief narrative summary of the company's performance based on the data provided. Keep it to 3-4 paragraphs. Be specific with numbers." },
          { role: "user", content: `Write a ${period} performance summary for this AI company:\n\n${summary}` },
        ],
        "gpt5_nano",
        null,
        `Generate ${period} report narrative`
      );

      res.json({ narrative: result.text });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate narrative", details: error.message });
    }
  });

  // ==================== Iteration 16: Global Search ====================
  app.get("/api/search", async (req, res) => {
    const q = ((req.query.q as string) || "").toLowerCase().trim();
    if (!q) return res.json({ agents: [], tasks: [], projects: [], meetings: [], workflows: [], knowledge: [] });
    const agents = await storage.getAgents();
    const tasks = await storage.getAgentTasks();
    const projects = await storage.getProjects();
    const meetings = await storage.getMeetings();
    const workflowsList = await storage.getWorkflows();
    // Knowledge base items are derived from tasks (deliverables/outcomes) — skip for search perf
    const matchAgents = agents.filter(a => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.department.toLowerCase().includes(q)).slice(0, 5);
    const matchTasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)).slice(0, 5);
    const matchProjects = projects.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)).slice(0, 5);
    const matchMeetings = meetings.filter(m => m.title.toLowerCase().includes(q) || m.topic.toLowerCase().includes(q)).slice(0, 5);
    const matchWorkflows = workflowsList.filter((w: any) => w.name?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q));
    // Search deliverables from tasks for knowledge results
    const matchKnowledge: any[] = [];
    for (const t of tasks) {
      if (matchKnowledge.length >= 5) break;
      if (t.deliverables) {
        try {
          const dels = JSON.parse(t.deliverables);
          if (Array.isArray(dels)) {
            for (const d of dels) {
              if ((d.title?.toLowerCase().includes(q)) || (d.content?.toLowerCase().includes(q))) {
                matchKnowledge.push({ id: d.id || `del-${t.id}`, title: d.title, type: d.type || 'document', taskId: t.id });
                if (matchKnowledge.length >= 5) break;
              }
            }
          }
        } catch {}
      }
    }
    res.json({
      agents: matchAgents.slice(0, 5),
      tasks: matchTasks.slice(0, 5),
      projects: matchProjects.slice(0, 5),
      meetings: matchMeetings.slice(0, 5),
      workflows: matchWorkflows.slice(0, 5),
      knowledge: matchKnowledge.slice(0, 5),
    });
  });

  // ==================== Iteration 22: Client / Vendor Management ====================
  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    const projects = await storage.getProjects();
    const transactions = await storage.getTransactions();
    const tasks = await storage.getAgentTasks();
    const risks = await storage.getRisks();

    const enriched = clients.map(c => {
      const clientProjects = projects.filter(p => (c as any).projects?.includes(p.id));
      const projectIds = clientProjects.map(p => p.id);
      const revenue = transactions
        .filter(t => t.type === "revenue" && t.projectId && projectIds.includes(t.projectId))
        .reduce((sum, t) => sum + t.amount, 0);
      const recentCompletions = tasks.filter(t =>
        t.status === "completed" && t.projectId && projectIds.includes(t.projectId)
      ).length;
      const openRisks = risks.filter(r =>
        r.status === "open" && r.projectId && projectIds.includes(r.projectId)
      ).length;
      const activeProjectCount = clientProjects.filter(p => p.status === "in_progress").length;

      // Health: good if active projects + recent completions, no risks; warning if risks; critical if no active + risks
      let health: "good" | "warning" | "critical" = "good";
      if (openRisks > 0) health = "warning";
      if (openRisks > 2 || (activeProjectCount === 0 && clientProjects.length > 0)) health = "critical";

      return {
        ...c,
        projectCount: clientProjects.length,
        activeProjectCount,
        totalRevenue: revenue,
        recentCompletions,
        openRisks,
        health,
      };
    });

    res.json(enriched);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(parseInt(req.params.id));
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const client = await storage.createClient(req.body);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const client = await storage.updateClient(parseInt(req.params.id), req.body);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const ok = await storage.deleteClient(parseInt(req.params.id));
    if (!ok) return res.status(404).json({ error: "Client not found" });
    res.json({ success: true });
  });

  // ==================== Iteration 23: Meeting Templates ====================
  app.get("/api/meeting-templates", async (_req, res) => {
    const templates = await storage.getMeetingTemplates();
    res.json(templates);
  });

  app.post("/api/meeting-templates", async (req, res) => {
    const template = await storage.createMeetingTemplate(req.body);
    res.status(201).json(template);
  });

  app.post("/api/meeting-templates/seed", async (_req, res) => {
    const existing = await storage.getMeetingTemplates();
    if (existing.length > 0) return res.json({ message: "Templates already exist", count: existing.length });
    const seeds = [
      { name: "Sprint Planning", agenda: "1. Review backlog\n2. Estimate stories\n3. Assign tasks\n4. Set sprint goal", suggestedSpeakers: ["Project Manager", "Tech Lead", "Product Owner"], duration: 60, type: "planning" },
      { name: "Retrospective", agenda: "1. What went well\n2. What didn't go well\n3. Action items for improvement", suggestedSpeakers: ["Scrum Master", "Team Members"], duration: 45, type: "retro" },
      { name: "Daily Standup", agenda: "1. What I did yesterday\n2. What I'm doing today\n3. Blockers", suggestedSpeakers: ["All Team Members"], duration: 15, type: "standup" },
      { name: "Design Review", agenda: "1. Present design\n2. Feedback round\n3. Decision on approach", suggestedSpeakers: ["Designer", "Product Manager", "Engineering Lead"], duration: 30, type: "review" },
      { name: "All Hands", agenda: "1. Company updates\n2. Department highlights\n3. Q&A", suggestedSpeakers: ["CEO", "Department Heads"], duration: 60, type: "all_hands" },
    ];
    const created = [];
    for (const s of seeds) {
      created.push(await storage.createMeetingTemplate(s));
    }
    res.status(201).json({ message: "Seeded templates", count: created.length, templates: created });
  });

  // ==================== Iteration 24: Task Comments ====================
  app.get("/api/tasks/:id/comments", async (req, res) => {
    const comments = await storage.getTaskComments(parseInt(req.params.id));
    res.json(comments);
  });

  app.post("/api/tasks/:id/comments", async (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = await storage.getTask(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const comment = await storage.createTaskComment({
      taskId,
      authorType: req.body.authorType || "owner",
      authorId: req.body.authorId || null,
      authorName: req.body.authorName || "Owner",
      content: req.body.content,
      createdAt: new Date().toISOString(),
    });

    // Also create a timeline event
    await storage.createTimelineEvent({
      type: "general",
      title: `Comment on task: ${task.title}`,
      description: `${comment.authorName} commented on "${task.title}"`,
      agentId: comment.authorId,
      department: null,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(comment);
  });

  // ==================== Iteration 25: Company Timeline ====================
  app.get("/api/timeline", async (_req, res) => {
    const events = await storage.getTimelineEvents();
    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(events);
  });

  app.post("/api/timeline", async (req, res) => {
    const event = await storage.createTimelineEvent({
      ...req.body,
      timestamp: req.body.timestamp || new Date().toISOString(),
    });
    res.status(201).json(event);
  });

  // ==================== Iteration 20: Resource Allocation ====================
  app.get("/api/resource-allocation", async (_req, res) => {
    const agents = await storage.getAgents();
    const tasks = await storage.getAgentTasks();
    const now = new Date();
    const allocations = agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id && !["completed", "rejected"].includes(t.status));
      const completedTasks = tasks.filter(t => t.assignedAgentId === agent.id && t.status === "completed");
      const totalTasks = tasks.filter(t => t.assignedAgentId === agent.id);
      return {
        agent: { id: agent.id, name: agent.name, role: agent.role, department: agent.department, avatar: agent.avatar, color: agent.color },
        activeTasks: agentTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
        })),
        stats: {
          active: agentTasks.length,
          completed: completedTasks.length,
          total: totalTasks.length,
          utilization: Math.min(100, Math.round((agentTasks.length / 5) * 100)), // 5 tasks = 100%
        },
      };
    });
    res.json(allocations);
  });

  // ==================== Iteration 21: Department Budget Management ====================
  app.get("/api/department-budgets", async (_req, res) => {
    const agents = await storage.getAgents();
    const tasks = await storage.getAgentTasks();
    const transactions = await storage.getTransactions();
    const departments = [...new Set(agents.map(a => a.department))];
    const budgets = departments.map(dept => {
      const deptAgents = agents.filter(a => a.department === dept);
      const deptAgentIds = deptAgents.map(a => a.id);
      const deptTasks = tasks.filter(t => deptAgentIds.includes(t.assignedAgentId));
      const deptTransactions = transactions.filter(t => t.agentId && deptAgentIds.includes(t.agentId));
      const totalSpend = deptTransactions.filter(t => t.type === "expenditure").reduce((sum, t) => sum + t.amount, 0);
      const totalEarnings = deptTransactions.filter(t => t.type === "earning").reduce((sum, t) => sum + t.amount, 0);
      const allocatedBudget = deptAgents.length * 500000; // $5000 per agent per period (in cents)
      return {
        department: dept,
        agentCount: deptAgents.length,
        allocatedBudget,
        totalSpend,
        totalEarnings,
        remaining: allocatedBudget - totalSpend,
        utilization: allocatedBudget > 0 ? Math.round((totalSpend / allocatedBudget) * 100) : 0,
        taskCount: deptTasks.length,
        completedTasks: deptTasks.filter(t => t.status === "completed").length,
      };
    });
    res.json(budgets);
  });

  // ==================== CHECKLISTS (Iteration 28) ====================
  app.get("/api/checklists", async (req, res) => {
    const parentType = req.query.parentType as string;
    const parentId = req.query.parentId ? Number(req.query.parentId) : undefined;
    if (parentType && parentId) {
      const checklists = await storage.getChecklistsByParent(parentType, parentId);
      return res.json(checklists);
    }
    const all = await storage.getChecklists();
    res.json(all);
  });

  app.post("/api/checklists", async (req, res) => {
    const checklist = await storage.createChecklist({
      name: req.body.name,
      items: req.body.items || [],
      parentType: req.body.parentType,
      parentId: req.body.parentId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(checklist);
  });

  app.patch("/api/checklists/:id", async (req, res) => {
    const updated = await storage.updateChecklist(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Checklist not found" });
    res.json(updated);
  });

  app.delete("/api/checklists/:id", async (req, res) => {
    const result = await storage.deleteChecklist(Number(req.params.id));
    if (!result) return res.status(404).json({ error: "Checklist not found" });
    res.json({ ok: true });
  });

  // Checklist templates
  app.get("/api/checklists/templates", async (_req, res) => {
    const templates = [
      { name: "Code Review", items: [{ text: "Code follows style guidelines", checked: false, checkedBy: null, checkedAt: null }, { text: "All tests pass", checked: false, checkedBy: null, checkedAt: null }, { text: "No security vulnerabilities", checked: false, checkedBy: null, checkedAt: null }, { text: "Documentation updated", checked: false, checkedBy: null, checkedAt: null }, { text: "Performance impact reviewed", checked: false, checkedBy: null, checkedAt: null }] },
      { name: "Security Audit", items: [{ text: "Input validation implemented", checked: false, checkedBy: null, checkedAt: null }, { text: "Authentication verified", checked: false, checkedBy: null, checkedAt: null }, { text: "Authorization checks in place", checked: false, checkedBy: null, checkedAt: null }, { text: "Sensitive data encrypted", checked: false, checkedBy: null, checkedAt: null }, { text: "Logging & monitoring configured", checked: false, checkedBy: null, checkedAt: null }] },
      { name: "Launch Readiness", items: [{ text: "Feature complete", checked: false, checkedBy: null, checkedAt: null }, { text: "QA sign-off obtained", checked: false, checkedBy: null, checkedAt: null }, { text: "Performance benchmarks met", checked: false, checkedBy: null, checkedAt: null }, { text: "Rollback plan documented", checked: false, checkedBy: null, checkedAt: null }, { text: "Stakeholders notified", checked: false, checkedBy: null, checkedAt: null }] },
    ];
    res.json(templates);
  });

  // Create checklist from SOP steps
  app.post("/api/checklists/from-sop", async (req, res) => {
    try {
      const { sopId, parentType, parentId } = req.body;
      const sops = await storage.getSOPs();
      const sop = sops.find(s => s.id === sopId);
      if (!sop) return res.status(404).json({ error: "SOP not found" });

      const steps = typeof sop.steps === "string" ? JSON.parse(sop.steps) : sop.steps;
      const items = (steps || []).map((step: any) => ({
        text: typeof step === "string" ? step : step.title || step.name || step.description || String(step),
        checked: false,
        checkedBy: null,
        checkedAt: null,
      }));

      const checklist = await storage.createChecklist({
        name: `${sop.title} Checklist`,
        items,
        parentType: parentType || "project",
        parentId: parentId || 0,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({ ...checklist, sopId: sop.id, sopTitle: sop.title });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create checklist from SOP", details: error.message });
    }
  });

  // ==================== ESCALATION RULES (Iteration 27) ====================
  app.get("/api/escalation-rules", async (_req, res) => {
    const rules = await storage.getEscalationRules();
    res.json(rules);
  });

  app.post("/api/escalation-rules", async (req, res) => {
    const rule = await storage.createEscalationRule({
      name: req.body.name,
      triggerHours: req.body.triggerHours,
      action: req.body.action,
      enabled: req.body.enabled !== false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(rule);
  });

  app.patch("/api/escalation-rules/:id", async (req, res) => {
    const updated = await storage.updateEscalationRule(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Escalation rule not found" });
    res.json(updated);
  });

  app.delete("/api/escalation-rules/:id", async (req, res) => {
    const result = await storage.deleteEscalationRule(Number(req.params.id));
    if (!result) return res.status(404).json({ error: "Escalation rule not found" });
    res.json({ ok: true });
  });

  // ==================== API ACTIVITY LOG (Iteration 29) ====================
  app.get("/api/activity-log", async (_req, res) => {
    const log = await storage.getApiLog();
    res.json(log);
  });

  // ==================== BULK OPERATIONS (Iteration 30) ====================
  app.post("/api/tasks/bulk-action", async (req, res) => {
    const { taskIds, action, value } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) return res.status(400).json({ error: "taskIds required" });
    const results: any[] = [];
    for (const id of taskIds) {
      const task = await storage.getAgentTask(id);
      if (!task) continue;
      let update: Record<string, any> = {};
      switch (action) {
        case "approve": update = { status: "approved" }; break;
        case "reject": update = { status: "rejected" }; break;
        case "delete": await storage.deleteAgentTask(id); results.push({ id, deleted: true }); continue;
        case "reassign": update = { assignedAgentId: Number(value) }; break;
        case "priority": update = { priority: value }; break;
        default: continue;
      }
      const updated = await storage.updateAgentTask(id, update);
      if (updated) results.push(updated);
    }
    res.json({ updated: results.length, results });
  });

  app.post("/api/agents/bulk-action", async (req, res) => {
    const { agentIds, action, value } = req.body;
    if (!Array.isArray(agentIds) || agentIds.length === 0) return res.status(400).json({ error: "agentIds required" });
    const results: any[] = [];
    for (const id of agentIds) {
      const agent = await storage.getAgent(id);
      if (!agent) continue;
      let update: Record<string, any> = {};
      switch (action) {
        case "model": update = { model: value }; break;
        case "department": update = { department: value }; break;
        default: continue;
      }
      const updated = await storage.updateAgent(id, update);
      if (updated) results.push(updated);
    }
    res.json({ updated: results.length, results });
  });

  // ==================== COMPANY TEMPLATES (Iteration 31) ====================
  app.get("/api/company-templates", async (_req, res) => {
    const templates = [
      {
        id: "digital-agency",
        name: "Digital Agency",
        description: "Full-service digital agency with design, development, and marketing teams",
        industry: "Agency",
        agents: [
          { name: "Maya", role: "Creative Director", department: "Design", avatar: "🎨", instructions: "You are Maya, the Creative Director. You lead the design team, ensuring high-quality visual output and brand consistency across all projects.", skills: ["UI/UX Design", "Brand Strategy", "Art Direction", "Prototyping"], color: "#E91E63", parentRole: "CEO" },
          { name: "Dev", role: "Tech Lead", department: "Engineering", avatar: "💻", instructions: "You are Dev, the Tech Lead. You architect solutions, review code, and ensure technical excellence across all projects.", skills: ["Full-Stack Development", "Architecture", "Code Review", "DevOps"], color: "#2196F3", parentRole: "CEO" },
          { name: "Sophie", role: "Marketing Strategist", department: "Marketing", avatar: "📊", instructions: "You are Sophie, the Marketing Strategist. You develop marketing plans, analyze campaign performance, and drive growth for clients.", skills: ["SEO", "Content Strategy", "Analytics", "Social Media"], color: "#4CAF50", parentRole: "CEO" },
          { name: "Alex", role: "Project Manager", department: "Operations", avatar: "📋", instructions: "You are Alex, the Project Manager. You coordinate across teams, manage timelines, and ensure smooth project delivery.", skills: ["Agile", "Client Management", "Resource Planning", "Risk Management"], color: "#FF9800", parentRole: "CEO" },
        ],
        workflows: [{ name: "Client Project Delivery", description: "End-to-end client project workflow", steps: [{ order: 1, title: "Discovery & Brief", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Design & Prototype", type: "design", autoApprove: false, estimatedHours: 8 }, { order: 3, title: "Development", type: "development", autoApprove: false, estimatedHours: 16 }, { order: 4, title: "QA & Testing", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 5, title: "Client Review & Launch", type: "deploy", autoApprove: false, estimatedHours: 2 }] }],
        sops: [{ title: "Client Onboarding Process", category: "Operations", steps: ["Schedule kickoff call", "Gather brand assets and requirements", "Set up project in task board", "Assign team members", "Create initial timeline"], department: "Operations" }],
      },
      {
        id: "saas-startup",
        name: "SaaS Startup",
        description: "Product-focused startup with engineering, product, and growth teams",
        industry: "SaaS",
        agents: [
          { name: "Priya", role: "Head of Product", department: "Product", avatar: "🎯", instructions: "You are Priya, the Head of Product. You define the product roadmap, prioritize features, and ensure product-market fit.", skills: ["Product Strategy", "User Research", "Roadmapping", "A/B Testing"], color: "#9C27B0", parentRole: "CEO" },
          { name: "Kai", role: "Lead Engineer", department: "Engineering", avatar: "⚡", instructions: "You are Kai, the Lead Engineer. You build and maintain the core platform, ensure scalability, and lead the engineering team.", skills: ["Backend Development", "Cloud Infrastructure", "API Design", "Performance"], color: "#3F51B5", parentRole: "CEO" },
          { name: "Luna", role: "Growth Lead", department: "Growth", avatar: "🚀", instructions: "You are Luna, the Growth Lead. You drive user acquisition, optimize conversion funnels, and scale the business.", skills: ["Growth Hacking", "Analytics", "Paid Acquisition", "Retention"], color: "#00BCD4", parentRole: "CEO" },
          { name: "Jordan", role: "Customer Success", department: "Support", avatar: "💬", instructions: "You are Jordan, Customer Success Manager. You onboard customers, reduce churn, and gather feedback for product improvement.", skills: ["Customer Support", "Onboarding", "Churn Prevention", "Documentation"], color: "#8BC34A", parentRole: "CEO" },
        ],
        workflows: [{ name: "Feature Development", description: "Ship features from idea to production", steps: [{ order: 1, title: "PRD & Specs", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Implementation", type: "development", autoApprove: false, estimatedHours: 12 }, { order: 3, title: "QA & Staging", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 4, title: "Production Deploy", type: "deploy", autoApprove: false, estimatedHours: 1 }] }],
        sops: [{ title: "Feature Request Process", category: "Product", steps: ["Log feature request with context", "Score by impact and effort", "Add to product backlog", "Prioritize in sprint planning", "Notify requester of timeline"], department: "Product" }],
      },
      {
        id: "ecommerce",
        name: "E-commerce",
        description: "Online retail operation with merchandising, fulfillment, and marketing",
        industry: "E-commerce",
        agents: [
          { name: "Zara", role: "Merchandising Manager", department: "Merchandising", avatar: "🛍️", instructions: "You are Zara, the Merchandising Manager. You curate product catalogs, manage pricing, and optimize product placement.", skills: ["Merchandising", "Pricing Strategy", "Inventory", "Trend Analysis"], color: "#F44336", parentRole: "CEO" },
          { name: "Marcus", role: "Operations Lead", department: "Operations", avatar: "📦", instructions: "You are Marcus, the Operations Lead. You manage fulfillment, logistics, and supply chain operations.", skills: ["Logistics", "Supply Chain", "Vendor Management", "Process Optimization"], color: "#795548", parentRole: "CEO" },
          { name: "Emma", role: "Digital Marketing Lead", department: "Marketing", avatar: "📱", instructions: "You are Emma, the Digital Marketing Lead. You drive traffic, manage campaigns, and optimize conversion rates.", skills: ["Email Marketing", "PPC", "Social Commerce", "CRO"], color: "#E91E63", parentRole: "CEO" },
        ],
        workflows: [{ name: "Product Launch", description: "Launch a new product to the store", steps: [{ order: 1, title: "Product Research", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Listing Creation", type: "development", autoApprove: false, estimatedHours: 2 }, { order: 3, title: "Marketing Campaign", type: "development", autoApprove: false, estimatedHours: 4 }, { order: 4, title: "Go Live", type: "deploy", autoApprove: false, estimatedHours: 1 }] }],
        sops: [{ title: "Order Fulfillment Process", category: "Operations", steps: ["Process incoming order", "Pick and pack items", "Generate shipping label", "Dispatch and track", "Send confirmation to customer"], department: "Operations" }],
      },
      {
        id: "content-studio",
        name: "Content Studio",
        description: "Content production house with writers, editors, and distribution specialists",
        industry: "Media",
        agents: [
          { name: "Olivia", role: "Editor-in-Chief", department: "Editorial", avatar: "✍️", instructions: "You are Olivia, the Editor-in-Chief. You set editorial direction, review content quality, and manage the content calendar.", skills: ["Content Strategy", "Editing", "SEO Writing", "Publishing"], color: "#673AB7", parentRole: "CEO" },
          { name: "Theo", role: "Visual Content Lead", department: "Creative", avatar: "📸", instructions: "You are Theo, the Visual Content Lead. You produce visual assets, manage brand identity, and create multimedia content.", skills: ["Graphic Design", "Video Production", "Photography", "Animation"], color: "#FF5722", parentRole: "CEO" },
          { name: "Nina", role: "Distribution Manager", department: "Distribution", avatar: "📡", instructions: "You are Nina, the Distribution Manager. You manage content distribution channels, partnerships, and audience growth.", skills: ["Social Media", "Newsletter", "Syndication", "Analytics"], color: "#009688", parentRole: "CEO" },
        ],
        workflows: [{ name: "Content Pipeline", description: "Produce and publish content", steps: [{ order: 1, title: "Ideation & Research", type: "design", autoApprove: false, estimatedHours: 2 }, { order: 2, title: "Writing & Creation", type: "development", autoApprove: false, estimatedHours: 4 }, { order: 3, title: "Review & Edit", type: "review", autoApprove: false, estimatedHours: 2 }, { order: 4, title: "Publish & Distribute", type: "deploy", autoApprove: false, estimatedHours: 1 }] }],
        sops: [{ title: "Content Publishing Checklist", category: "Editorial", steps: ["Proofread final draft", "Optimize for SEO", "Add visual assets", "Schedule publication", "Promote on social channels"], department: "Editorial" }],
      },
      {
        id: "ai-research-lab",
        name: "AI Research Lab",
        description: "Research-focused organization with ML engineers, researchers, and data scientists",
        industry: "AI/ML",
        agents: [
          { name: "Dr. Chen", role: "Research Lead", department: "Research", avatar: "🔬", instructions: "You are Dr. Chen, the Research Lead. You define research directions, review papers, and mentor the team on ML advances.", skills: ["Machine Learning", "NLP", "Computer Vision", "Paper Writing"], color: "#1565C0", parentRole: "CEO" },
          { name: "Anika", role: "ML Engineer", department: "Engineering", avatar: "🤖", instructions: "You are Anika, the ML Engineer. You build and deploy ML models, manage training pipelines, and optimize inference.", skills: ["PyTorch", "Model Training", "MLOps", "GPU Optimization"], color: "#00897B", parentRole: "CEO" },
          { name: "Sam", role: "Data Scientist", department: "Data", avatar: "📊", instructions: "You are Sam, the Data Scientist. You analyze datasets, build experiments, and derive insights from model performance.", skills: ["Data Analysis", "Experiment Design", "Statistics", "Visualization"], color: "#F4511E", parentRole: "CEO" },
          { name: "Riley", role: "Research Engineer", department: "Engineering", avatar: "🛠️", instructions: "You are Riley, the Research Engineer. You build infrastructure for experiments, maintain compute clusters, and create tools.", skills: ["Infrastructure", "Distributed Computing", "Docker", "Monitoring"], color: "#546E7A", parentRole: "CEO" },
        ],
        workflows: [{ name: "Research Experiment", description: "Run an ML experiment end-to-end", steps: [{ order: 1, title: "Literature Review", type: "design", autoApprove: false, estimatedHours: 8 }, { order: 2, title: "Data Preparation", type: "development", autoApprove: false, estimatedHours: 6 }, { order: 3, title: "Model Training", type: "development", autoApprove: false, estimatedHours: 12 }, { order: 4, title: "Evaluation & Analysis", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 5, title: "Paper / Report", type: "review", autoApprove: false, estimatedHours: 6 }] }],
        sops: [{ title: "Experiment Tracking Protocol", category: "Research", steps: ["Define hypothesis and metrics", "Log experiment config and parameters", "Record training metrics", "Document results and analysis", "Archive model artifacts"], department: "Research" }],
      },
    ];
    res.json(templates);
  });

  app.post("/api/company-templates/apply", async (req, res) => {
    try {
      const { templateId } = req.body;
      // We'll match against templateId
      const templateMap: Record<string, any> = {
        "digital-agency": { agents: [{ name: "Maya", role: "Creative Director", department: "Design", avatar: "🎨", instructions: "Creative Director leading design team.", skills: ["UI/UX Design", "Brand Strategy", "Art Direction", "Prototyping"], color: "#E91E63", parentRole: "CEO" }, { name: "Dev", role: "Tech Lead", department: "Engineering", avatar: "💻", instructions: "Tech Lead architecting solutions.", skills: ["Full-Stack Development", "Architecture", "Code Review", "DevOps"], color: "#2196F3", parentRole: "CEO" }, { name: "Sophie", role: "Marketing Strategist", department: "Marketing", avatar: "📊", instructions: "Marketing Strategist driving growth.", skills: ["SEO", "Content Strategy", "Analytics", "Social Media"], color: "#4CAF50", parentRole: "CEO" }, { name: "Alex", role: "Project Manager", department: "Operations", avatar: "📋", instructions: "Project Manager coordinating teams.", skills: ["Agile", "Client Management", "Resource Planning", "Risk Management"], color: "#FF9800", parentRole: "CEO" }], workflows: [{ name: "Client Project Delivery", description: "End-to-end client project workflow", steps: [{ order: 1, title: "Discovery & Brief", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Design & Prototype", type: "design", autoApprove: false, estimatedHours: 8 }, { order: 3, title: "Development", type: "development", autoApprove: false, estimatedHours: 16 }, { order: 4, title: "QA & Testing", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 5, title: "Client Review & Launch", type: "deploy", autoApprove: false, estimatedHours: 2 }] }], sops: [{ title: "Client Onboarding Process", category: "Operations", steps: ["Schedule kickoff call", "Gather brand assets and requirements", "Set up project in task board", "Assign team members", "Create initial timeline"], department: "Operations" }] },
        "saas-startup": { agents: [{ name: "Priya", role: "Head of Product", department: "Product", avatar: "🎯", instructions: "Head of Product defining roadmap.", skills: ["Product Strategy", "User Research", "Roadmapping", "A/B Testing"], color: "#9C27B0", parentRole: "CEO" }, { name: "Kai", role: "Lead Engineer", department: "Engineering", avatar: "⚡", instructions: "Lead Engineer building the platform.", skills: ["Backend Development", "Cloud Infrastructure", "API Design", "Performance"], color: "#3F51B5", parentRole: "CEO" }, { name: "Luna", role: "Growth Lead", department: "Growth", avatar: "🚀", instructions: "Growth Lead driving acquisition.", skills: ["Growth Hacking", "Analytics", "Paid Acquisition", "Retention"], color: "#00BCD4", parentRole: "CEO" }, { name: "Jordan", role: "Customer Success", department: "Support", avatar: "💬", instructions: "Customer Success reducing churn.", skills: ["Customer Support", "Onboarding", "Churn Prevention", "Documentation"], color: "#8BC34A", parentRole: "CEO" }], workflows: [{ name: "Feature Development", description: "Ship features from idea to production", steps: [{ order: 1, title: "PRD & Specs", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Implementation", type: "development", autoApprove: false, estimatedHours: 12 }, { order: 3, title: "QA & Staging", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 4, title: "Production Deploy", type: "deploy", autoApprove: false, estimatedHours: 1 }] }], sops: [{ title: "Feature Request Process", category: "Product", steps: ["Log feature request with context", "Score by impact and effort", "Add to product backlog", "Prioritize in sprint planning", "Notify requester of timeline"], department: "Product" }] },
        "ecommerce": { agents: [{ name: "Zara", role: "Merchandising Manager", department: "Merchandising", avatar: "🛍️", instructions: "Merchandising Manager curating products.", skills: ["Merchandising", "Pricing Strategy", "Inventory", "Trend Analysis"], color: "#F44336", parentRole: "CEO" }, { name: "Marcus", role: "Operations Lead", department: "Operations", avatar: "📦", instructions: "Operations Lead managing fulfillment.", skills: ["Logistics", "Supply Chain", "Vendor Management", "Process Optimization"], color: "#795548", parentRole: "CEO" }, { name: "Emma", role: "Digital Marketing Lead", department: "Marketing", avatar: "📱", instructions: "Digital Marketing Lead driving traffic.", skills: ["Email Marketing", "PPC", "Social Commerce", "CRO"], color: "#E91E63", parentRole: "CEO" }], workflows: [{ name: "Product Launch", description: "Launch a new product", steps: [{ order: 1, title: "Product Research", type: "design", autoApprove: false, estimatedHours: 4 }, { order: 2, title: "Listing Creation", type: "development", autoApprove: false, estimatedHours: 2 }, { order: 3, title: "Marketing Campaign", type: "development", autoApprove: false, estimatedHours: 4 }, { order: 4, title: "Go Live", type: "deploy", autoApprove: false, estimatedHours: 1 }] }], sops: [{ title: "Order Fulfillment Process", category: "Operations", steps: ["Process incoming order", "Pick and pack items", "Generate shipping label", "Dispatch and track", "Send confirmation to customer"], department: "Operations" }] },
        "content-studio": { agents: [{ name: "Olivia", role: "Editor-in-Chief", department: "Editorial", avatar: "✍️", instructions: "Editor-in-Chief setting editorial direction.", skills: ["Content Strategy", "Editing", "SEO Writing", "Publishing"], color: "#673AB7", parentRole: "CEO" }, { name: "Theo", role: "Visual Content Lead", department: "Creative", avatar: "📸", instructions: "Visual Content Lead producing assets.", skills: ["Graphic Design", "Video Production", "Photography", "Animation"], color: "#FF5722", parentRole: "CEO" }, { name: "Nina", role: "Distribution Manager", department: "Distribution", avatar: "📡", instructions: "Distribution Manager growing audience.", skills: ["Social Media", "Newsletter", "Syndication", "Analytics"], color: "#009688", parentRole: "CEO" }], workflows: [{ name: "Content Pipeline", description: "Produce and publish content", steps: [{ order: 1, title: "Ideation & Research", type: "design", autoApprove: false, estimatedHours: 2 }, { order: 2, title: "Writing & Creation", type: "development", autoApprove: false, estimatedHours: 4 }, { order: 3, title: "Review & Edit", type: "review", autoApprove: false, estimatedHours: 2 }, { order: 4, title: "Publish & Distribute", type: "deploy", autoApprove: false, estimatedHours: 1 }] }], sops: [{ title: "Content Publishing Checklist", category: "Editorial", steps: ["Proofread final draft", "Optimize for SEO", "Add visual assets", "Schedule publication", "Promote on social channels"], department: "Editorial" }] },
        "ai-research-lab": { agents: [{ name: "Dr. Chen", role: "Research Lead", department: "Research", avatar: "🔬", instructions: "Research Lead defining ML directions.", skills: ["Machine Learning", "NLP", "Computer Vision", "Paper Writing"], color: "#1565C0", parentRole: "CEO" }, { name: "Anika", role: "ML Engineer", department: "Engineering", avatar: "🤖", instructions: "ML Engineer building models.", skills: ["PyTorch", "Model Training", "MLOps", "GPU Optimization"], color: "#00897B", parentRole: "CEO" }, { name: "Sam", role: "Data Scientist", department: "Data", avatar: "📊", instructions: "Data Scientist analyzing experiments.", skills: ["Data Analysis", "Experiment Design", "Statistics", "Visualization"], color: "#F4511E", parentRole: "CEO" }, { name: "Riley", role: "Research Engineer", department: "Engineering", avatar: "🛠️", instructions: "Research Engineer building infra.", skills: ["Infrastructure", "Distributed Computing", "Docker", "Monitoring"], color: "#546E7A", parentRole: "CEO" }], workflows: [{ name: "Research Experiment", description: "Run ML experiment end-to-end", steps: [{ order: 1, title: "Literature Review", type: "design", autoApprove: false, estimatedHours: 8 }, { order: 2, title: "Data Preparation", type: "development", autoApprove: false, estimatedHours: 6 }, { order: 3, title: "Model Training", type: "development", autoApprove: false, estimatedHours: 12 }, { order: 4, title: "Evaluation & Analysis", type: "testing", autoApprove: false, estimatedHours: 4 }, { order: 5, title: "Paper / Report", type: "review", autoApprove: false, estimatedHours: 6 }] }], sops: [{ title: "Experiment Tracking Protocol", category: "Research", steps: ["Define hypothesis and metrics", "Log experiment config and parameters", "Record training metrics", "Document results and analysis", "Archive model artifacts"], department: "Research" }] },
      };

      const template = templateMap[templateId];
      if (!template) return res.status(404).json({ error: "Template not found" });

      const agents = await storage.getAgents();
      const ceo = agents.find(a => a.role === "CEO");
      const ceoId = ceo?.id || 1;

      const createdAgents: any[] = [];
      for (const agentDef of template.agents) {
        const created = await storage.createAgent({
          name: agentDef.name,
          role: agentDef.role,
          department: agentDef.department,
          avatar: agentDef.avatar,
          instructions: agentDef.instructions,
          skills: agentDef.skills,
          parentId: ceoId,
          status: "active",
          color: agentDef.color,
        });
        createdAgents.push(created);
      }

      const createdWorkflows: any[] = [];
      for (const wf of template.workflows) {
        const created = await storage.createWorkflow({
          name: wf.name,
          description: wf.description,
          steps: wf.steps.map((s: any) => ({ ...s, assignedAgentId: null })),
          createdAt: new Date().toISOString(),
        });
        createdWorkflows.push(created);
      }

      const createdSOPs: any[] = [];
      for (const sop of template.sops) {
        const created = await storage.createSOP({
          title: sop.title,
          category: sop.category,
          steps: sop.steps,
          department: sop.department,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        createdSOPs.push(created);
      }

      res.json({
        message: "Template applied successfully",
        agents: createdAgents.length,
        workflows: createdWorkflows.length,
        sops: createdSOPs.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to apply template", details: error.message });
    }
  });

  // ==================== APPROVAL CHAINS (Iteration 26) ====================
  app.post("/api/tasks/:id/approval-chain", async (req, res) => {
    const task = await storage.getAgentTask(Number(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    const chain = req.body.chain || [];
    // Store approval chain as JSON in proposedActions field with a prefix
    const existing = task.proposedActions ? JSON.parse(task.proposedActions) : {};
    existing.approvalChain = chain;
    await storage.updateAgentTask(task.id, { proposedActions: JSON.stringify(existing) });
    const updated = await storage.getAgentTask(task.id);
    res.json(updated);
  });

  app.post("/api/tasks/:id/approve-step", async (req, res) => {
    const task = await storage.getAgentTask(Number(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    const { approverId } = req.body;
    try {
      const actions = task.proposedActions ? JSON.parse(task.proposedActions) : {};
      const chain = actions.approvalChain || [];
      const step = chain.find((s: any) => s.approverId === approverId && s.status === "pending");
      if (step) {
        step.status = "approved";
        step.timestamp = new Date().toISOString();
        actions.approvalChain = chain;
        await storage.updateAgentTask(task.id, { proposedActions: JSON.stringify(actions) });
      }
      const updated = await storage.getAgentTask(task.id);
      res.json(updated);
    } catch {
      res.status(400).json({ error: "Invalid approval chain data" });
    }
  });

  // ===== Risks (Iteration 39) =====
  app.get("/api/risks", async (_req, res) => {
    const risks = await storage.getRisks();
    res.json(risks);
  });

  app.get("/api/risks/:id", async (req, res) => {
    const risk = await storage.getRisk(Number(req.params.id));
    if (!risk) return res.status(404).json({ error: "Risk not found" });
    res.json(risk);
  });

  app.post("/api/risks", async (req, res) => {
    const risk = await storage.createRisk({
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.json(risk);
  });

  app.patch("/api/risks/:id", async (req, res) => {
    const updated = await storage.updateRisk(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Risk not found" });
    res.json(updated);
  });

  app.delete("/api/risks/:id", async (req, res) => {
    const deleted = await storage.deleteRisk(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Risk not found" });
    res.json({ success: true });
  });

  // ===== Project Milestones (Iteration 37) =====
  app.get("/api/projects/:id/milestones", async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    try {
      const milestones = (project as any).milestones ? JSON.parse((project as any).milestones) : [];
      res.json(milestones);
    } catch {
      res.json([]);
    }
  });

  app.put("/api/projects/:id/milestones", async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    const milestones = req.body.milestones || [];
    await storage.updateProject(Number(req.params.id), { description: project.description } as any);
    // Store milestones in deliverables-style JSON field via a cast
    const raw = await storage.getProject(Number(req.params.id));
    if (raw) {
      (raw as any).milestones = JSON.stringify(milestones);
      await storage.updateProject(Number(req.params.id), raw as any);
    }
    res.json(milestones);
  });

  // ==================== STARTUP RECOVERY: Reset stuck tasks ====================
  // Tasks left in executing/thinking/under_review from a prior server crash get reset to pending
  // CRITICAL: Don't touch parent tasks that have active sub-tasks — they're waiting, not stuck
  setTimeout(async () => {
    try {
      const allTasks = await storage.getAgentTasks();
      const stuckStatuses = ["executing", "thinking", "under_review"];

      // Build set of parent task IDs that have non-completed sub-tasks
      const parentIdsWithActiveSubs = new Set<number>();
      for (const t of allTasks) {
        if (t.parentTaskId && t.status !== "completed" && t.status !== "rejected") {
          parentIdsWithActiveSubs.add(t.parentTaskId);
        }
      }

      const stuckTasks = allTasks.filter(t => {
        if (!stuckStatuses.includes(t.status)) return false;
        // Skip parent tasks waiting for sub-tasks
        if (parentIdsWithActiveSubs.has(t.id)) return false;
        return true;
      });

      const skippedParents = allTasks.filter(t => stuckStatuses.includes(t.status) && parentIdsWithActiveSubs.has(t.id));

      if (stuckTasks.length > 0 || skippedParents.length > 0) {
        console.log(`[startup-recovery] Found ${stuckTasks.length} stuck leaf tasks to reset, ${skippedParents.length} parent tasks left as-is (waiting for sub-tasks)`);
        for (const t of stuckTasks) {
          await storage.updateAgentTask(t.id, { status: "pending" });
        }
        // Re-trigger with staggered delays, max 6 at a time
        const toRequeue = stuckTasks.slice(0, 6);
        toRequeue.forEach((t, i) => {
          setTimeout(() => autoThinkTask(t.id), (i + 1) * 5000);
        });
        console.log(`[startup-recovery] Reset ${stuckTasks.length} tasks, re-queued ${toRequeue.length}`);
      } else {
        console.log(`[startup-recovery] No stuck tasks found`);
      }
    } catch (err) {
      console.error(`[startup-recovery] Error:`, err);
    }
  }, 3000); // Wait 3s after routes are registered

  // ==================== WATCHDOG: Periodic stuck task recovery ====================
  // Every 5 minutes, check for tasks stuck in processing states for >10 minutes
  // CRITICAL: Skip parent tasks that have active sub-tasks — they're waiting, not stuck
  const WATCHDOG_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const STUCK_THRESHOLD = 10 * 60 * 1000;  // 10 minutes
  const MAX_CONCURRENT_TASKS = 3; // Reduced to prevent OOM crashes

  setInterval(async () => {
    if (_systemPaused) return; // Skip watchdog while system is paused
    try {
      const allTasks = await storage.getAgentTasks();
      const now = Date.now();
      const stuckStatuses = ["executing", "thinking", "under_review"];

      // ── PHASE 1: Resolve zombie parents ──
      // Parent tasks in executing/thinking whose ALL sub-tasks are terminal (completed/rejected)
      const terminalStatuses = new Set(["completed", "rejected"]);
      for (const t of allTasks) {
        if (!stuckStatuses.includes(t.status)) continue;
        const subs = allTasks.filter(s => s.parentTaskId === t.id);
        if (subs.length === 0) continue; // Not a parent
        const allSubsTerminal = subs.every(s => terminalStatuses.has(s.status));
        if (!allSubsTerminal) continue; // Still has active subs

        const completedSubs = subs.filter(s => s.status === "completed");
        const rejectedSubs = subs.filter(s => s.status === "rejected");

        // If at least some subs completed, mark parent as completed with summary
        const summary = completedSubs.length > 0
          ? `Completed via ${completedSubs.length} sub-tasks (${rejectedSubs.length} rejected). Key results:\n` +
            completedSubs.slice(0, 5).map(s => `• ${s.title}`).join("\n")
          : `All ${rejectedSubs.length} sub-tasks were rejected. Task needs re-evaluation.`;

        if (completedSubs.length > 0) {
          console.log(`[watchdog] Completing zombie parent #${t.id} (${completedSubs.length} completed, ${rejectedSubs.length} rejected subs)`);
          await storage.updateAgentTask(t.id, {
            status: "completed",
            result: summary,
            completedAt: new Date().toISOString(),
          });
        } else {
          // All subs rejected — reset parent to pending so it gets re-thought
          console.log(`[watchdog] Resetting zombie parent #${t.id} to pending (all ${rejectedSubs.length} subs rejected)`);
          await storage.updateAgentTask(t.id, {
            status: "pending",
            executionLog: `All sub-tasks were rejected. Task reset for re-evaluation at ${new Date().toISOString()}.`,
          });
        }
      }

      // ── PHASE 2: Reset stuck leaf tasks ──
      // Re-read tasks after phase 1 mutations
      const refreshedTasks = await storage.getAgentTasks();
      const parentIdsWithActiveSubs = new Set<number>();
      for (const t of refreshedTasks) {
        if (t.parentTaskId && ["thinking", "executing", "under_review", "pending", "proposal_ready", "blocked"].includes(t.status)) {
          parentIdsWithActiveSubs.add(t.parentTaskId);
        }
      }

      const stuckTasks = refreshedTasks.filter(t => {
        if (!stuckStatuses.includes(t.status)) return false;
        if (parentIdsWithActiveSubs.has(t.id)) return false;
        const updated = (t as any).updatedAt || t.createdAt;
        if (!updated) return true;
        const age = now - new Date(updated).getTime();
        return age > STUCK_THRESHOLD;
      });

      if (stuckTasks.length === 0) return;

      // Exclude parent tasks waiting for sub-tasks from active count
      const currentlyActive = refreshedTasks.filter(t => {
        if (!stuckStatuses.includes(t.status)) return false;
        if (stuckTasks.find(s => s.id === t.id)) return false;
        const hasSubs = refreshedTasks.some(s => s.parentTaskId === t.id);
        return !hasSubs;
      }).length;
      const slotsAvailable = Math.max(0, MAX_CONCURRENT_TASKS - currentlyActive);

      console.log(`[watchdog] Found ${stuckTasks.length} truly stuck tasks. ${slotsAvailable} slots available.`);
      let requeued = 0;
      for (const t of stuckTasks) {
        // If task has unresolved dependencies, reset to blocked instead of pending
        let resetStatus = "pending";
        if ((t as any).dependsOn) {
          try {
            const deps: number[] = JSON.parse((t as any).dependsOn);
            const allDepsResolved = deps.every(depId => {
              const dep = refreshedTasks.find(dt => dt.id === depId);
              return dep && (dep.status === "completed" || dep.status === "rejected");
            });
            if (!allDepsResolved) resetStatus = "blocked";
          } catch {}
        }
        console.log(`[watchdog] Resetting task ${t.id} "${t.title.slice(0, 40)}" to ${resetStatus}`);
        await storage.updateAgentTask(t.id, {
          status: resetStatus,
          executionLog: `Auto-reset by watchdog at ${new Date().toISOString()}.`,
        });
        if (resetStatus === "pending" && requeued < slotsAvailable) {
          setTimeout(() => autoThinkTask(t.id), requeued * 5000 + 2000);
          requeued++;
        }
      }
      console.log(`[watchdog] Reset ${stuckTasks.length} tasks, re-queued ${requeued}`);
    } catch (err) {
      console.error(`[watchdog] Error:`, err);
    }
  }, WATCHDOG_INTERVAL);

  // ==================== QUEUE PROCESSOR: Pick up pending tasks automatically ====================
  // Every 30 seconds, scan for pending tasks and start processing them (up to concurrency limit).
  // This ensures tasks don't sit in the queue forever waiting for a manual trigger.
  const QUEUE_INTERVAL = 30 * 1000; // 30 seconds
  setInterval(async () => {
    try {
      if (_systemPaused) return; // Don't process queue while system is paused
      if (_creditPaused) return; // Don't process queue while credit-paused
      const settings = await storage.getSettings();
      if (settings.autoStartTasks === false) return; // Respect auto-start setting

      const allTasks = await storage.getAgentTasks();
      // Count truly active tasks — exclude parent tasks just waiting for sub-tasks
      const activeCount = allTasks.filter(t => {
        if (!["thinking", "executing", "under_review"].includes(t.status)) return false;
        // If this task has sub-tasks, it's a parent waiting — don't count it
        const hasSubs = allTasks.some(s => s.parentTaskId === t.id);
        return !hasSubs;
      }).length;
      const slotsAvailable = Math.max(0, MAX_CONCURRENT_TASKS - activeCount);
      if (slotsAvailable === 0) {
        console.log(`[queue] No slots available (${activeCount} truly active, ${MAX_CONCURRENT_TASKS} max)`);
        return;
      }

      // Find pending tasks sorted by priority (high > medium > low), then by ID (oldest first)
      // Filter out tasks that still have unresolved dependencies (shouldn't be pending)
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const pendingTasks = allTasks
        .filter(t => {
          if (t.status !== "pending") return false;
          // Safety: if task has unresolved deps, revert to blocked and skip
          if ((t as any).dependsOn) {
            try {
              const deps: number[] = JSON.parse((t as any).dependsOn);
              const allDepsResolved = deps.every(depId => {
                const dep = allTasks.find(dt => dt.id === depId);
                return dep && (dep.status === "completed" || dep.status === "rejected");
              });
              if (!allDepsResolved) {
                // Fix: revert to blocked status
                storage.updateAgentTask(t.id, { status: "blocked" }).catch(() => {});
                return false;
              }
            } catch {}
          }
          return true;
        })
        .sort((a, b) => {
          const pa = priorityOrder[(a as any).priority || "medium"] ?? 2;
          const pb = priorityOrder[(b as any).priority || "medium"] ?? 2;
          if (pa !== pb) return pa - pb;
          return a.id - b.id;
        });

      if (pendingTasks.length === 0) return;

      // Pick up tasks to fill available slots (staggered to avoid burst)
      const toProcess = pendingTasks.slice(0, slotsAvailable);
      console.log(`[queue] ${pendingTasks.length} pending, ${activeCount} active, picking up ${toProcess.length} tasks`);
      toProcess.forEach((t, i) => {
        setTimeout(() => autoThinkTask(t.id), i * 3000); // 3s stagger between kicks
      });
    } catch (err) {
      console.error(`[queue] Error:`, err);
    }
  }, QUEUE_INTERVAL);

  // ==================== HEALTH MONITOR: Automated unstuck & self-healing ====================
  // Runs every 2 minutes. Catches edge cases the watchdog and queue processor miss.
  const HEALTH_INTERVAL = 2 * 60 * 1000; // 2 minutes
  setInterval(async () => {
    try {
      if (_systemPaused) return; // Don't trigger fixes while system is paused
      if (_creditPaused) return; // Don't trigger fixes while credit-paused
      const allTasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      let fixes = 0;

      // ---- FIX 1: Blocked tasks whose dependencies are ALL resolved ----
      const blockedTasks = allTasks.filter(t => t.status === "blocked" && t.dependsOn);
      for (const t of blockedTasks) {
        try {
          const deps: number[] = JSON.parse(t.dependsOn!);
          const allDepsResolved = deps.every(depId => {
            const dep = allTasks.find(x => x.id === depId);
            return dep && (dep.status === "completed" || dep.status === "rejected");
          });
          if (allDepsResolved) {
            console.log(`[health] Unblocking task ${t.id} — all ${deps.length} dependencies resolved`);
            await storage.updateAgentTask(t.id, { status: "pending" });
            setTimeout(() => autoThinkTask(t.id), fixes * 3000);
            fixes++;
          }
        } catch {}
      }

      // ---- FIX 2: Executing parent tasks whose sub-tasks are ALL done ----
      const executingTasks = allTasks.filter(t => t.status === "executing");
      for (const t of executingTasks) {
        const subs = allTasks.filter(s => s.parentTaskId === t.id);
        if (subs.length > 0) {
          const allSubsDone = subs.every(s => s.status === "completed" || s.status === "rejected");
          if (allSubsDone) {
            const completedCount = subs.filter(s => s.status === "completed").length;
            const rejectedCount = subs.filter(s => s.status === "rejected").length;
            // Collect child deliverables
            const childDeliverables: string[] = [];
            for (const child of subs.filter(s => s.status === "completed")) {
              if (child.executionLog) {
                childDeliverables.push(`[${child.title}]: ${child.executionLog.replace(/\\/g, '/').replace(/[\x00-\x1f]/g, '').slice(0, 300)}`);
              }
            }
            console.log(`[health] Auto-completing parent task ${t.id} — all ${subs.length} sub-tasks done (${completedCount} completed, ${rejectedCount} rejected)`);
            await storage.updateAgentTask(t.id, {
              status: "completed",
              executionLog: (t.executionLog || "") + `\n[health] All ${subs.length} sub-tasks finished (${completedCount} completed, ${rejectedCount} rejected).` +
                (childDeliverables.length > 0 ? `\nSub-task outcomes:\n${childDeliverables.join("\n")}` : ""),
              completedAt: new Date().toISOString(),
            });
            // Trigger cascade for dependents
            try { await cascadeTaskCompletion(t.id, t.projectId); } catch {}
            fixes++;
          }
        }
      }

      // ---- FIX 3: Tasks stuck in under_review for >20 minutes — force-approve ----
      const now = Date.now();
      const REVIEW_STUCK_THRESHOLD = 20 * 60 * 1000; // 20 minutes
      const reviewTasks = allTasks.filter(t => t.status === "under_review" || t.status === "proposal_ready");
      for (const t of reviewTasks) {
        const updated = (t as any).updatedAt || t.createdAt;
        if (!updated) continue;
        const age = now - new Date(updated).getTime();
        if (age > REVIEW_STUCK_THRESHOLD) {
          console.log(`[health] Force-approving stuck review task ${t.id} (${Math.round(age / 60000)}m in ${t.status})`);
          try {
            const port = process.env.PORT || 5000;
            await fetch(`http://localhost:${port}/api/tasks/${t.id}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            fixes++;
          } catch (e) {
            console.error(`[health] Failed to force-approve task ${t.id}:`, e);
          }
        }
      }

      // ---- FIX 4: Thinking tasks stuck for >15 minutes with no _activeAICalls slot ----
      const THINKING_STUCK_THRESHOLD = 15 * 60 * 1000;
      const thinkingTasks = allTasks.filter(t => t.status === "thinking");
      for (const t of thinkingTasks) {
        const updated = (t as any).updatedAt || t.createdAt;
        if (!updated) continue;
        const age = now - new Date(updated).getTime();
        if (age > THINKING_STUCK_THRESHOLD) {
          // Check if this task's agent is actually processing (has a recent log update)
          console.log(`[health] Resetting stuck thinking task ${t.id} (${Math.round(age / 60000)}m stuck)`);
          // Check deps before resetting
          let resetStatus = "pending";
          if (t.dependsOn) {
            try {
              const deps: number[] = JSON.parse(t.dependsOn);
              const allDepsResolved = deps.every(depId => {
                const dep = allTasks.find(x => x.id === depId);
                return dep && (dep.status === "completed" || dep.status === "rejected");
              });
              if (!allDepsResolved) resetStatus = "blocked";
            } catch {}
          }
          await storage.updateAgentTask(t.id, {
            status: resetStatus,
            executionLog: `[health] Auto-reset from stuck thinking state at ${new Date().toISOString()}.`,
          });
          if (resetStatus === "pending") {
            _activeAICalls = Math.max(0, _activeAICalls - 1); // Release potential leaked slot
            setTimeout(() => autoThinkTask(t.id), 2000);
          }
          fixes++;
        }
      }

      // ---- FIX 5: Concurrency slot leak detection ----
      // If _activeAICalls > 0 but no tasks are actually thinking, reset the counter
      const actuallyThinking = allTasks.filter(t => t.status === "thinking").length;
      if (_activeAICalls > actuallyThinking) {
        console.log(`[health] Concurrency leak detected: _activeAICalls=${_activeAICalls} but only ${actuallyThinking} tasks thinking. Correcting.`);
        _activeAICalls = actuallyThinking;
        fixes++;
      }

      if (fixes > 0) {
        console.log(`[health] Applied ${fixes} fixes this cycle`);
      }
    } catch (err) {
      console.error(`[health] Error:`, err);
    }
  }, HEALTH_INTERVAL);

  // ==================== #1 AUTONOMOUS MEETINGS ====================
  app.post("/api/meetings/:id/run-autonomous", async (req, res) => {
    const meetingId = Number(req.params.id);
    try {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.status === "completed") return res.status(400).json({ error: "Meeting already closed" });

      const agents = await storage.getAgents();
      const participantAgents = agents.filter(a => meeting.agentIds.includes(a.id));
      if (participantAgents.length === 0) return res.status(400).json({ error: "No participants" });

      const minRounds = Number(req.body.minRounds) || 3;
      const maxRounds = Number(req.body.maxRounds) || 6;
      const responseLength = req.body.responseLength || "medium";

      // Send SSE updates
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const allMessages: any[] = [];
      const existingMessages = await storage.getMeetingMessages(meetingId);
      allMessages.push(...existingMessages);

      sendEvent({ type: "status", message: `Starting autonomous meeting with ${participantAgents.length} agents, ${minRounds}-${maxRounds} rounds` });

      let consensusReached = false;

      for (let round = 1; round <= maxRounds; round++) {
        sendEvent({ type: "round_start", round, total: maxRounds });

        // Each agent speaks
        for (const agent of participantAgents) {
          sendEvent({ type: "agent_speaking", agentId: agent.id, agentName: agent.name, round });

          try {
            const companyContext = await getCompanyContext();
            const lengthGuide: Record<string, string> = {
              mini: "Maximum 200 characters.",
              short: "Maximum 80 words.",
              medium: "Under 200 words.",
              long: "300-500 words.",
            };

            const historyText = allMessages.map((m: any) =>
              `[${m.senderName} - ${m.senderRole}]: ${m.content}`
            ).join("\n\n");

            const systemPrompt = `${agent.instructions || ""}\n\nYou are in a board meeting. Your name is ${agent.name}, role: ${agent.role}. Topic: "${meeting.topic}".\n\nCOMPANY CONTEXT:\n${companyContext}\n\nThis is round ${round} of ${maxRounds}. ${round >= minRounds ? "If you believe the group has reached consensus and enough has been discussed, end your message with [CONSENSUS]." : ""} ${lengthGuide[responseLength] || lengthGuide.medium}`;

            const userInput = historyText
              ? `Discussion so far:\n${historyText}\n\nProvide your response as ${agent.name} (${agent.role}).`
              : `The topic is: "${meeting.topic}". Provide your opening thoughts.`;

            const aiResp = await trackedAI({
              instructions: systemPrompt,
              input: userInput,
            }, { label: `Auto-meeting: ${agent.name} R${round}`, agentId: agent.id });

            const content = aiResp.output_text;
            const msg = await storage.createMeetingMessage({
              meetingId,
              senderId: agent.id,
              senderName: agent.name,
              senderRole: agent.role,
              content,
              timestamp: new Date().toISOString(),
            });
            allMessages.push(msg);

            sendEvent({ type: "agent_message", agentId: agent.id, agentName: agent.name, content, round });

            if (content.includes("[CONSENSUS]")) {
              consensusReached = true;
            }
          } catch (err: any) {
            sendEvent({ type: "agent_error", agentId: agent.id, agentName: agent.name, error: err.message });
          }
        }

        sendEvent({ type: "round_end", round });

        // Check consensus after minimum rounds
        if (round >= minRounds && consensusReached) {
          sendEvent({ type: "consensus", round, message: "Consensus reached" });
          break;
        }
      }

      // Derive projects — strategy-aware
      sendEvent({ type: "status", message: "Deriving strategy-aligned projects..." });
      const agentList = participantAgents.map(a => `${a.name} (${a.role}, ID: ${a.id})`).join(", ");
      const transcript = allMessages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.content}`).join("\n\n");
      const companyCtx = await getCompanyContext();

      // Fetch strategic objectives for context
      const goals = await storage.getGoals();
      const objectives = goals.filter(g => g.type === "objective");
      const keyResults = goals.filter(g => g.type === "key_result");
      const strategyContext = objectives.length > 0
        ? `\n\nSTRATEGIC OBJECTIVES:\n${objectives.map(o => {
            const krs = keyResults.filter(kr => kr.parentGoalId === o.id);
            return `- [ID:${o.id}] ${o.title} (${o.progress}% done)\n  Key Results: ${krs.map(kr => `${kr.title} (${kr.progress}%)`).join(", ") || "none"}`;
          }).join("\n")}`
        : "";

      let derivedProjects: any[] = [];
      try {
        const projResp = await trackedAI({
          instructions: `Extract actionable projects from meeting transcripts. Consider existing company context and strategic objectives. Each project should advance at least one strategic objective when possible.\n\nCOMPANY CONTEXT:\n${companyCtx}${strategyContext}\n\nReturn a JSON array of project objects with: title (string), description (string), priority ("low" | "medium" | "high"), assignedAgentId (number), goalId (number|null — link to the strategic objective ID this project advances, or null if not directly linked). Available agents: ${agentList}. Return ONLY the JSON array.`,
          input: `Extract projects from:\nMeeting: ${meeting.title}\nTopic: ${meeting.topic}\n\nTranscript:\n${transcript}`,
        }, { label: `Auto-derive projects: ${meeting.title}` });
        const jsonMatch = projResp.output_text.match(/\[[\s\S]*\]/);
        derivedProjects = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch (err: any) {
        sendEvent({ type: "error", message: `Failed to derive projects: ${err.message}` });
      }

      // Also derive recommended scheduled/recurring tasks
      let derivedScheduled: any[] = [];
      try {
        sendEvent({ type: "status", message: "Identifying recurring tasks & review cycles..." });
        const schedResp = await trackedAI({
          instructions: `Based on a meeting transcript, identify recurring/scheduled tasks that should be set up. These are things like: weekly progress reviews, regular check-ins, periodic market scans, milestone reviews, pipeline checks, etc.\n\nCOMPANY CONTEXT:\n${companyCtx}${strategyContext}\n\nAvailable agents:\n${agentList}\n\nReturn a JSON array of scheduled task objects with: title (string), description (string), assignedAgentId (number), frequency ("daily" | "weekly" | "biweekly" | "monthly"), priority ("low" | "medium" | "high"). Suggest 2-5 recurring tasks. Return ONLY the JSON array.`,
          input: `Meeting: ${meeting.title}\nTopic: ${meeting.topic}\n\nTranscript (last 2000 chars):\n${transcript.slice(-2000)}`,
        }, { label: `Derive scheduled tasks: ${meeting.title}` });
        const schedMatch = schedResp.output_text.match(/\[[\s\S]*\]/);
        derivedScheduled = schedMatch ? JSON.parse(schedMatch[0]) : [];
      } catch (err: any) {
        sendEvent({ type: "error", message: `Failed to derive scheduled tasks: ${err.message}` });
      }

      // Submit derived projects to CEO Approval Queue instead of creating directly
      const submittedProposals: any[] = [];
      const meetingContext = `[From autonomous meeting: "${meeting.title}" — ${meeting.topic}]\n\n`;

      const stgsForQueue = await storage.getSettings();
      const approvalQueue: any[] = (stgsForQueue as any).approvalQueue || [];

      for (const proj of derivedProjects) {
        const queueItem = {
          id: Date.now() + Math.floor(Math.random() * 10000),
          title: proj.title,
          description: meetingContext + (proj.description || ""),
          priority: proj.priority || "medium",
          assignedAgentId: proj.assignedAgentId || null,
          source: "meeting",
          meetingId,
          goalId: proj.goalId || null,
          estimatedEffort: null,
          targetMetric: null,
          expectedImpact: null,
          status: "pending",
          createdAt: new Date().toISOString(),
          decidedAt: null,
          notes: null,
          projectId: null,
        };
        approvalQueue.push(queueItem);
        submittedProposals.push(queueItem);
        sendEvent({ type: "proposal_submitted", proposal: { id: queueItem.id, title: queueItem.title } });
      }

      if (submittedProposals.length > 0) {
        await storage.updateSettings({ approvalQueue });
        // Notify CEO
        await storage.createNotification({
          type: "general",
          title: `${submittedProposals.length} proposals from meeting`,
          message: `"${meeting.title}" generated ${submittedProposals.length} project proposals awaiting your approval`,
          link: "/approvals",
          read: false,
          createdAt: new Date().toISOString(),
          priority: "high",
        });
      }

      // Save derived scheduled tasks to settings
      let createdScheduledCount = 0;
      if (derivedScheduled.length > 0) {
        try {
          const stgs = await storage.getSettings();
          const scheduledTasks = (stgs as any).scheduledTasks || [];
          for (const st of derivedScheduled) {
            const schedId = Date.now() + Math.floor(Math.random() * 10000);
            scheduledTasks.push({
              id: schedId,
              title: st.title,
              description: st.description || st.title,
              assignedAgentId: st.assignedAgentId || null,
              frequency: st.frequency || "weekly",
              priority: st.priority || "medium",
              status: "active",
              source: "meeting",
              sourceMeetingId: meetingId,
              sourceMeetingTitle: meeting.title,
              lastRun: null,
              runCount: 0,
              nextRun: computeNextRun(st.frequency || "weekly"),
              createdAt: new Date().toISOString(),
            });
            createdScheduledCount++;
          }
          await storage.updateSettings({ scheduledTasks });
          sendEvent({ type: "scheduled_tasks_created", count: createdScheduledCount });
        } catch (err: any) {
          sendEvent({ type: "error", message: `Failed to save scheduled tasks: ${err.message}` });
        }
      }

      // Close the meeting
      await storage.updateMeeting(meetingId, { status: "completed" });

      // Decision log
      await storage.createDecisionLogEntry({
        type: "meeting_decision",
        description: `Autonomous meeting closed: "${meeting.title}" — ${submittedProposals.length} proposals submitted for CEO approval, ${createdScheduledCount} scheduled tasks created`,
        madeBy: "autonomous",
        relatedId: meetingId,
        timestamp: new Date().toISOString(),
        impact: submittedProposals.length > 0 ? "high" : "medium",
      });

      // Timeline
      try {
        await storage.createTimelineEvent({
          type: "meeting",
          title: `Autonomous meeting closed: ${meeting.title}`,
          description: `${allMessages.length} messages, ${submittedProposals.length} proposals submitted for CEO approval, ${createdScheduledCount} recurring tasks`,
          agentId: null,
          department: null,
          timestamp: new Date().toISOString(),
        });
      } catch {}

      // Notification
      try {
        await storage.createNotification({
          type: "meeting",
          title: `Autonomous meeting completed: ${meeting.title}`,
          message: `${submittedProposals.length} project proposals submitted for CEO approval. ${createdScheduledCount} recurring tasks created.`,
          read: false,
          link: `/approvals`,
          createdAt: new Date().toISOString(),
          priority: "high",
        });
      } catch {}

      sendEvent({
        type: "complete",
        summary: {
          rounds: allMessages.length,
          consensusReached,
          proposalsSubmitted: submittedProposals.length,
          scheduledTasksCreated: createdScheduledCount,
          proposals: submittedProposals,
        },
      });

      res.end();
    } catch (error: any) {
      console.error("Autonomous meeting error:", error);
      try {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } catch {
        res.status(500).json({ error: "Autonomous meeting failed", details: error.message });
      }
    }
  });

  // ==================== #7 AGENT PERFORMANCE ====================
  app.get("/api/agents/:id/performance", async (req, res) => {
    try {
      const agentId = Number(req.params.id);
      const tasks = (await storage.getAgentTasks()).filter(t => t.assignedAgentId === agentId);
      const now = Date.now();
      const dayMs = 86400000;

      // 7-day sparkline data
      const sparkline = Array.from({ length: 7 }, (_, i) => {
        const dayStart = now - (6 - i) * dayMs;
        const dayEnd = dayStart + dayMs;
        const completed = tasks.filter(t =>
          t.status === "completed" && t.createdAt &&
          new Date(t.createdAt).getTime() >= dayStart && new Date(t.createdAt).getTime() < dayEnd
        ).length;
        return { day: new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" }), completed };
      });

      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const rejected = tasks.filter(t => t.status === "rejected").length;
      const approvalRate = total > 0 ? Math.round((completed / Math.max(completed + rejected, 1)) * 100) : 0;

      // Estimate cost from transactions
      const transactions = await storage.getTransactions();
      const agentTransactions = transactions.filter(t => t.agentId === agentId);
      const totalCost = agentTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const totalRevenue = agentTransactions.filter(t => t.type === "revenue").reduce((s, t) => s + t.amount, 0);

      res.json({
        sparkline,
        total,
        completed,
        rejected,
        approvalRate,
        totalCost: Math.abs(totalCost),
        totalRevenue,
        active: tasks.filter(t => ["pending", "thinking", "executing", "under_review"].includes(t.status)).length,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get agent performance", details: error.message });
    }
  });

  // ==================== #9 SMART TASK SUGGESTIONS ====================
  app.get("/api/suggestions/tasks", async (req, res) => {
    try {
      const companyContext = await getCompanyContext();
      const agents = await storage.getAgents();
      const agentList = agents.map(a => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");

      const response = await trackedAI({
        instructions: `You are a strategic AI advisor for a company. Based on the company context, suggest 5 high-impact tasks that should be created. Focus on gaps, opportunities, and immediate needs.\n\nCOMPANY CONTEXT:\n${companyContext}\n\nAvailable agents:\n${agentList}\n\nReturn a JSON array of 5 task suggestions. Each should have: title (string), description (string), assignedAgentId (number — pick the best agent), priority ("low" | "medium" | "high" | "urgent"), reasoning (string — why this task matters now). Return ONLY the JSON array.`,
        input: "Analyze the current company state and suggest the 5 most impactful tasks to create right now.",
      }, { label: "Smart task suggestions" });

      const jsonMatch = response.output_text.match(/\[[\s\S]*\]/);
      const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ suggestions });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate suggestions", details: error.message });
    }
  });

  // ==================== #10 COMPANY HEALTH SCORE ====================
  app.get("/api/company/health", async (req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const projects = await storage.getProjects();
      const transactions = await storage.getTransactions();
      const goals = await storage.getGoals();

      // 1. Task Throughput (0-20): ratio of completed to total
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const rejectedTasks = tasks.filter(t => t.status === "rejected").length;
      const taskRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
      const taskScore = Math.min(20, Math.round(taskRate * 30)); // Scale: 66%+ completion = 20

      // 2. Agent Utilization (0-20): agents with active tasks / total agents
      const activeAgentIds = new Set(tasks.filter(t => ["pending", "thinking", "executing", "under_review", "proposal_ready"].includes(t.status)).map(t => t.assignedAgentId));
      const utilRate = agents.length > 0 ? activeAgentIds.size / agents.length : 0;
      const utilScore = Math.min(20, Math.round(utilRate * 25)); // 80%+ utilization = 20

      // 3. Financial Health (0-20): profit margin
      const revenue = transactions.filter(t => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
      const expenses = Math.abs(transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? profit / revenue : (expenses > 0 ? -0.5 : 0.5);
      const finScore = Math.min(20, Math.max(0, Math.round((profitMargin + 0.5) * 20))); // -50% to +50% maps to 0-20

      // 4. Project Progress (0-20): avg project progress
      const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length : 0;
      const projScore = Math.min(20, Math.round(avgProgress / 5)); // 100% avg = 20

      // 5. Goal Alignment (0-20): avg goal progress
      const avgGoalProgress = goals.length > 0 ? goals.reduce((s, g) => s + g.progress, 0) / goals.length : 0;
      const goalScore = Math.min(20, Math.round(avgGoalProgress / 5)); // 100% avg = 20

      const totalScore = taskScore + utilScore + finScore + projScore + goalScore;

      // Blockers count
      const blockedTasks = tasks.filter(t => t.status === "blocked").length;
      const zombieTasks = tasks.filter(t =>
        t.status === "thinking" && t.createdAt &&
        (Date.now() - new Date(t.createdAt).getTime()) > 600000 // 10+ min stuck thinking
      ).length;

      res.json({
        score: totalScore,
        breakdown: {
          taskThroughput: { score: taskScore, max: 20, detail: `${completedTasks}/${totalTasks} completed` },
          agentUtilization: { score: utilScore, max: 20, detail: `${activeAgentIds.size}/${agents.length} active` },
          financialHealth: { score: finScore, max: 20, detail: `${profitMargin >= 0 ? "+" : ""}${(profitMargin * 100).toFixed(0)}% margin` },
          projectProgress: { score: projScore, max: 20, detail: `${avgProgress.toFixed(0)}% avg progress` },
          goalAlignment: { score: goalScore, max: 20, detail: `${avgGoalProgress.toFixed(0)}% avg goal` },
        },
        alerts: {
          blockedTasks,
          zombieTasks,
          rejectedTasks,
          idleAgents: agents.length - activeAgentIds.size,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to compute health score", details: error.message });
    }
  });

  // ==================== HEALTH REMEDIATION ====================
  app.post("/api/company/health/remediation", async (req, res) => {
    try {
      const tasks = await storage.getAgentTasks();
      const agents = await storage.getAgents();
      const projects = await storage.getProjects();
      const transactions = await storage.getTransactions();
      const goals = await storage.getGoals();
      const companyCtx = await getCompanyContext();

      // Compute the same health breakdown inline
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const rejectedTasks = tasks.filter(t => t.status === "rejected").length;
      const blockedTasks = tasks.filter(t => t.status === "blocked").length;
      const activeAgentIds = new Set(tasks.filter(t => ["pending", "thinking", "executing", "under_review", "proposal_ready"].includes(t.status)).map(t => t.assignedAgentId));
      const idleAgents = agents.length - activeAgentIds.size;
      const revenue = transactions.filter(t => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
      const expenses = Math.abs(transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
      const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length : 0;
      const avgGoalProgress = goals.length > 0 ? goals.reduce((s, g) => s + g.progress, 0) / goals.length : 0;

      const agentList = agents.map(a => `${a.name} (${a.role}, ${a.department}, ID: ${a.id})`).join("\n");
      const objectivesList = goals.filter(g => g.type === "objective").map(g => `- ${g.title} (${g.progress}%)`).join("\n") || "None";

      const issuesSummary = [
        `Task throughput: ${completedTasks}/${totalTasks} completed, ${rejectedTasks} rejected`,
        `Agent utilization: ${activeAgentIds.size}/${agents.length} active (${idleAgents} idle)`,
        `Financial: $${revenue.toFixed(0)} revenue, $${expenses.toFixed(0)} expenses, profit: $${(revenue - expenses).toFixed(0)}`,
        `Project progress: ${avgProgress.toFixed(0)}% average across ${projects.length} projects`,
        `Goal alignment: ${avgGoalProgress.toFixed(0)}% average goal progress`,
        `Blocked tasks: ${blockedTasks}`,
        `Current projects (${projects.length}): ${projects.slice(0, 15).map(p => `"${p.title}" (${p.status}, ${p.progress || 0}%)`).join(", ")}`,
      ].join("\n");

      const resp = await trackedAI({
        instructions: `You are a strategic AI advisor analyzing company health issues. Based on the health data below, propose 3-5 new PROJECTS that would directly address the weakest areas and improve the company health score. Each project should be actionable, specific, and assigned to the most suitable agent.\n\nCOMPANY CONTEXT:\n${companyCtx}\n\nHEALTH ISSUES:\n${issuesSummary}\n\nSTRATEGIC OBJECTIVES:\n${objectivesList}\n\nAVAILABLE AGENTS:\n${agentList}\n\nFor each proposed project, return: title (string), description (string — 2-3 sentences on what to do and why it improves health), priority ("high" | "medium"), assignedAgentId (number), targetMetric (string — which health dimension this fixes, e.g. "taskThroughput", "financialHealth", "agentUtilization", "projectProgress", "goalAlignment"), expectedImpact (string — estimated score improvement like "+3 to +5 points"). Return ONLY a JSON array.`,
        input: `Propose projects to remediate the company health issues. Focus on the weakest scoring areas first.`,
      }, { label: "Health remediation proposals" });

      const match = resp.output_text.match(/\[[\s\S]*\]/);
      const proposals = match ? JSON.parse(match[0]) : [];
      res.json({ proposals });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate remediation", details: error.message });
    }
  });

  // ==================== #6 PROJECT PROGRESS (enhanced) ====================
  app.get("/api/projects/:id/progress", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const tasks = await storage.getAgentTasksByProject(projectId);
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const rejected = tasks.filter(t => t.status === "rejected").length;
      const inProgress = tasks.filter(t => ["thinking", "executing", "under_review", "proposal_ready"].includes(t.status)).length;
      const pending = tasks.filter(t => t.status === "pending").length;
      const blocked = tasks.filter(t => t.status === "blocked").length;

      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Update project progress
      await storage.updateProject(projectId, {
        progress,
        totalTasks: total,
        completedTasks: completed,
      });

      // Budget burn (from transactions linked to project tasks)
      const transactions = await storage.getTransactions();
      const projectTransactionIds = new Set(tasks.map(t => t.id));
      const projectExpenses = transactions
        .filter(t => t.type === "expense" && t.taskId && projectTransactionIds.has(t.taskId))
        .reduce((s, t) => s + Math.abs(t.amount), 0);

      res.json({
        progress,
        total,
        completed,
        rejected,
        inProgress,
        pending,
        blocked,
        budgetBurn: projectExpenses,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignedAgentId: t.assignedAgentId })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get project progress", details: error.message });
    }
  });

  // ==================== #8 MEETING OUTCOMES ====================
  app.get("/api/meetings/:id/outcomes", async (req, res) => {
    try {
      const meetingId = Number(req.params.id);
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });

      const projects = (await storage.getProjects()).filter(p => p.meetingId === meetingId);
      const tasks = (await storage.getAgentTasks()).filter(t => t.meetingId === meetingId);
      const messages = await storage.getMeetingMessages(meetingId);

      // Get scheduled tasks linked to this meeting
      const stgs = await storage.getSettings();
      const allScheduled = (stgs as any).scheduledTasks || [];
      const meetingScheduled = allScheduled.filter((s: any) => s.sourceMeetingId === meetingId);

      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const totalTasks = tasks.length;

      res.json({
        meeting: { id: meeting.id, title: meeting.title, topic: meeting.topic, status: meeting.status },
        projects: projects.map(p => ({ id: p.id, title: p.title, status: p.status, progress: p.progress || 0, goalId: (p as any).goalId })),
        tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, assignedAgentId: t.assignedAgentId })),
        scheduledTasks: meetingScheduled.map((s: any) => ({ id: s.id, title: s.title, frequency: s.frequency, status: s.status, assignedAgentId: s.assignedAgentId })),
        messageCount: messages.length,
        completedTasks,
        totalTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get meeting outcomes", details: error.message });
    }
  });

  // ==================== STRATEGY SYNC ====================
  // Creates scheduled tasks derived from strategic objectives
  app.post("/api/strategy/sync", async (_req, res) => {
    try {
      const goals = await storage.getGoals();
      const objectives = goals.filter(g => g.type === "objective");
      const keyResults = goals.filter(g => g.type === "key_result");
      if (objectives.length === 0) {
        return res.json({ message: "No strategic objectives found", created: 0 });
      }

      const agents = await storage.getAgents();
      const projects = await storage.getProjects();
      const companyCtx = await getCompanyContext();
      const agentListStr = agents.map(a => `${a.name} (${a.role}, ID: ${a.id}, Dept: ${a.department})`).join(", ");
      const strategyCtx = objectives.map(o => {
        const krs = keyResults.filter(kr => kr.parentGoalId === o.id);
        const linkedProjects = projects.filter(p => (p as any).goalId === o.id);
        return `- [ID:${o.id}] ${o.title} (${o.progress}% done)\n  Key Results: ${krs.map(kr => `${kr.title} (${kr.progress}%)`).join(", ") || "none"}\n  Linked Projects: ${linkedProjects.map(p => p.title).join(", ") || "none"}`;
      }).join("\n");

      const resp = await trackedAI({
        instructions: `Based on strategic objectives, suggest recurring/scheduled tasks that should be created to ensure the company stays on track. Consider: objective progress reviews, KR tracking, new project pipeline reviews, market scans, stakeholder updates, risk assessments, resource allocation reviews, etc.\n\nCOMPANY CONTEXT:\n${companyCtx}\n\nSTRATEGIC OBJECTIVES:\n${strategyCtx}\n\nAvailable agents:\n${agentListStr}\n\nReturn a JSON array of scheduled task objects with: title (string), description (string), assignedAgentId (number), frequency ("daily" | "weekly" | "biweekly" | "monthly"), priority ("low" | "medium" | "high"), linkedGoalId (number|null). Suggest 3-6 recurring tasks. Return ONLY the JSON array.`,
        input: `Create strategy-aligned scheduled tasks for ${objectives.length} objectives and ${keyResults.length} key results. Current date: ${new Date().toISOString()}.`,
      }, { label: "Strategy sync: derive scheduled tasks" });
      const match = resp.output_text.match(/\[[\s\S]*\]/);
      const derived = match ? JSON.parse(match[0]) : [];

      const stgs = await storage.getSettings();
      const scheduledTasks = (stgs as any).scheduledTasks || [];
      let created = 0;
      for (const st of derived) {
        // Avoid duplicates by checking title similarity
        const existingSimilar = scheduledTasks.find((ex: any) =>
          ex.title.toLowerCase() === st.title.toLowerCase() ||
          (ex.title.toLowerCase().includes(st.title.toLowerCase().split(" ").slice(0, 3).join(" ")))
        );
        if (existingSimilar) continue;

        const schedId = Date.now() + Math.floor(Math.random() * 10000);
        scheduledTasks.push({
          id: schedId,
          title: st.title,
          description: st.description || st.title,
          assignedAgentId: st.assignedAgentId || null,
          frequency: st.frequency || "weekly",
          priority: st.priority || "medium",
          status: "active",
          source: "strategy",
          linkedGoalId: st.linkedGoalId || null,
          lastRun: null,
          runCount: 0,
          nextRun: computeNextRun(st.frequency || "weekly"),
          createdAt: new Date().toISOString(),
        });
        created++;
      }
      await storage.updateSettings({ scheduledTasks });

      // Decision log
      await storage.createDecisionLogEntry({
        type: "strategy",
        description: `Strategy sync: ${created} recurring tasks created from ${objectives.length} objectives`,
        madeBy: "system",
        relatedId: null,
        timestamp: new Date().toISOString(),
        impact: created > 0 ? "high" : "low",
      });

      res.json({ message: `Strategy sync complete`, created, total: scheduledTasks.length });
    } catch (error: any) {
      res.status(500).json({ error: "Strategy sync failed", details: error.message });
    }
  });

  // Strategy dashboard data
  app.get("/api/strategy/dashboard", async (_req, res) => {
    try {
      // Auto-sync goal progress before returning dashboard data
      await syncGoalProgress();

      const goals = await storage.getGoals();
      const objectives = goals.filter(g => g.type === "objective");
      const keyResults = goals.filter(g => g.type === "key_result");
      const projects = await storage.getProjects();
      const stgs = await storage.getSettings();
      const scheduledTasks = (stgs as any).scheduledTasks || [];

      // Projects linked to objectives
      const linkedProjects = projects.filter(p => (p as any).goalId);
      const unlinkedProjects = projects.filter(p => !(p as any).goalId);

      // Scheduled tasks by source
      const meetingTasks = scheduledTasks.filter((s: any) => s.source === "meeting");
      const strategyTasks = scheduledTasks.filter((s: any) => s.source === "strategy");
      const manualTasks = scheduledTasks.filter((s: any) => !s.source || s.source === "manual");

      // Per-objective detail
      const objectiveDetails = objectives.map(o => {
        const krs = keyResults.filter(kr => kr.parentGoalId === o.id);
        const objProjects = projects.filter(p => (p as any).goalId === o.id);
        const objScheduled = scheduledTasks.filter((s: any) => s.linkedGoalId === o.id);
        return {
          id: o.id,
          title: o.title,
          progress: o.progress,
          keyResults: krs.map(kr => ({ id: kr.id, title: kr.title, progress: kr.progress })),
          projectCount: objProjects.length,
          projects: objProjects.map(p => ({ id: p.id, title: p.title, status: p.status, progress: p.progress || 0 })),
          scheduledTasks: objScheduled.length,
        };
      });

      res.json({
        totalObjectives: objectives.length,
        totalKeyResults: keyResults.length,
        totalProjects: projects.length,
        linkedProjects: linkedProjects.length,
        unlinkedProjects: unlinkedProjects.length,
        linkageRate: projects.length > 0 ? Math.round((linkedProjects.length / projects.length) * 100) : 0,
        totalScheduledTasks: scheduledTasks.length,
        scheduledBySource: { meeting: meetingTasks.length, strategy: strategyTasks.length, manual: manualTasks.length },
        objectives: objectiveDetails,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get strategy dashboard", details: error.message });
    }
  });

  // ==================== CEO APPROVAL QUEUE ====================
  // GET all pending approval items
  app.get("/api/approval-queue", async (_req, res) => {
    try {
      const stgs = await storage.getSettings();
      const queue = (stgs as any).approvalQueue || [];
      // Enrich with agent names
      const agents = await storage.getAgents();
      const goals = await storage.getGoals();
      const enriched = queue.map((item: any) => {
        const agent = item.assignedAgentId ? agents.find(a => a.id === item.assignedAgentId) : null;
        const goal = item.goalId ? goals.find(g => g.id === item.goalId) : null;
        return {
          ...item,
          assignedAgentName: agent?.name || null,
          assignedAgentAvatar: agent?.avatar || null,
          goalTitle: goal?.title || null,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get approval queue", details: error.message });
    }
  });

  // Approve an item — creates a real project
  app.post("/api/approval-queue/:id/approve", async (req, res) => {
    try {
      const itemId = Number(req.params.id);
      const { notes } = req.body;
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];
      const idx = queue.findIndex((q: any) => q.id === itemId);
      if (idx === -1) return res.status(404).json({ error: "Item not found in approval queue" });
      const item = queue[idx];

      // Create real project
      const project = await storage.createProject({
        title: item.title,
        description: item.description + (notes ? `\n\n[CEO Note] ${notes}` : ""),
        status: "backlog",
        assignedAgentId: item.assignedAgentId || null,
        meetingId: item.meetingId || null,
        goalId: item.goalId || null,
        priority: item.priority || "medium",
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
        createdAt: new Date().toISOString(),
      });

      // Update queue item status
      queue[idx] = { ...item, status: "approved", decidedAt: new Date().toISOString(), notes, projectId: project.id };
      await storage.updateSettings({ approvalQueue: queue });

      // Decision log
      await storage.createDecisionLogEntry({
        type: "approval",
        description: `CEO approved project: "${item.title}" (source: ${item.source})${notes ? " — " + notes : ""}`,
        madeBy: "owner",
        relatedId: project.id,
        timestamp: new Date().toISOString(),
        impact: item.priority === "high" ? "high" : "medium",
      });

      // Timeline event
      await storage.createTimelineEvent({
        type: "decision",
        title: `Project approved: ${item.title}`,
        description: `CEO approved project from ${item.source}. ${notes || ""}`,
        agentId: item.assignedAgentId || null,
        department: null,
        timestamp: new Date().toISOString(),
      });

      // Notification
      await storage.createNotification({
        type: "general",
        title: "Project approved",
        message: `"${item.title}" has been approved and added to backlog`,
        link: "/projects",
        read: false,
        createdAt: new Date().toISOString(),
        priority: "medium",
      });

      res.json({ project, message: "Project approved and created" });

      // Auto-plan the newly approved project if enabled (fire-and-forget)
      triggerAutoPlanIfEnabled();
      // Auto-breakdown approved project into tasks and start execution
      autoBreakdownProject(project.id);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to approve", details: error.message });
    }
  });

  // Reject an item
  app.post("/api/approval-queue/:id/reject", async (req, res) => {
    try {
      const itemId = Number(req.params.id);
      const { notes } = req.body;
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];
      const idx = queue.findIndex((q: any) => q.id === itemId);
      if (idx === -1) return res.status(404).json({ error: "Item not found in approval queue" });
      const item = queue[idx];

      queue[idx] = { ...item, status: "rejected", decidedAt: new Date().toISOString(), notes };
      await storage.updateSettings({ approvalQueue: queue });

      await storage.createDecisionLogEntry({
        type: "rejection",
        description: `CEO rejected project proposal: "${item.title}" (source: ${item.source})${notes ? " — " + notes : ""}`,
        madeBy: "owner",
        relatedId: null,
        timestamp: new Date().toISOString(),
        impact: "medium",
      });

      res.json({ message: "Proposal rejected" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to reject", details: error.message });
    }
  });

  // Defer an item
  app.post("/api/approval-queue/:id/defer", async (req, res) => {
    try {
      const itemId = Number(req.params.id);
      const { notes } = req.body;
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];
      const idx = queue.findIndex((q: any) => q.id === itemId);
      if (idx === -1) return res.status(404).json({ error: "Item not found in approval queue" });

      queue[idx] = { ...queue[idx], status: "deferred", decidedAt: new Date().toISOString(), notes };
      await storage.updateSettings({ approvalQueue: queue });

      res.json({ message: "Proposal deferred" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to defer", details: error.message });
    }
  });

  // Batch approve/reject
  app.post("/api/approval-queue/batch", async (req, res) => {
    try {
      const { actions } = req.body; // [{ id, action: "approve"|"reject"|"defer", notes? }]
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];
      const agents = await storage.getAgents();
      const results: any[] = [];

      for (const act of actions) {
        const idx = queue.findIndex((q: any) => q.id === act.id);
        if (idx === -1) continue;
        const item = queue[idx];

        if (act.action === "approve") {
          const project = await storage.createProject({
            title: item.title,
            description: item.description + (act.notes ? `\n\n[CEO Note] ${act.notes}` : ""),
            status: "backlog",
            assignedAgentId: item.assignedAgentId || null,
            meetingId: item.meetingId || null,
            goalId: item.goalId || null,
            priority: item.priority || "medium",
            progress: 0,
            totalTasks: 0,
            completedTasks: 0,
            createdAt: new Date().toISOString(),
          });
          queue[idx] = { ...item, status: "approved", decidedAt: new Date().toISOString(), notes: act.notes, projectId: project.id };
          results.push({ id: act.id, action: "approved", projectId: project.id });

          await storage.createDecisionLogEntry({
            type: "approval",
            description: `CEO approved project: "${item.title}" (source: ${item.source})`,
            madeBy: "owner",
            relatedId: project.id,
            timestamp: new Date().toISOString(),
            impact: item.priority === "high" ? "high" : "medium",
          });
        } else if (act.action === "reject") {
          queue[idx] = { ...item, status: "rejected", decidedAt: new Date().toISOString(), notes: act.notes };
          results.push({ id: act.id, action: "rejected" });
          await storage.createDecisionLogEntry({
            type: "rejection",
            description: `CEO rejected: "${item.title}"`,
            madeBy: "owner",
            relatedId: null,
            timestamp: new Date().toISOString(),
            impact: "medium",
          });
        } else {
          queue[idx] = { ...item, status: "deferred", decidedAt: new Date().toISOString(), notes: act.notes };
          results.push({ id: act.id, action: "deferred" });
        }
      }

      await storage.updateSettings({ approvalQueue: queue });
      res.json({ results, processed: results.length });

      // Auto-plan if any projects were approved
      const approvedResults = results.filter((r: any) => r.action === "approved");
      if (approvedResults.length > 0) {
        triggerAutoPlanIfEnabled();
        // Auto-breakdown all approved projects into tasks
        for (const r of approvedResults) {
          autoBreakdownProject(r.projectId);
        }
      }
    } catch (error: any) {
      res.status(500).json({ error: "Batch action failed", details: error.message });
    }
  });

  // AI-curated queue: generate a CEO brief for pending items
  app.post("/api/approval-queue/brief", async (_req, res) => {
    try {
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];
      const pending = queue.filter((q: any) => q.status === "pending");
      if (pending.length === 0) return res.json({ brief: "No pending proposals to review.", recommendations: [] });

      const agents = await storage.getAgents();
      const goals = await storage.getGoals();
      const projects = await storage.getProjects();
      const companyCtx = await getCompanyContext();

      const itemsSummary = pending.map((p: any, i: number) => {
        const agent = p.assignedAgentId ? agents.find(a => a.id === p.assignedAgentId) : null;
        const goal = p.goalId ? goals.find(g => g.id === p.goalId) : null;
        return `${i + 1}. "${p.title}" [Source: ${p.source}] [Priority: ${p.priority}]\n   Description: ${p.description.slice(0, 200)}\n   Assigned: ${agent?.name || 'unassigned'} | Linked Objective: ${goal?.title || 'none'}\n   Estimated effort: ${p.estimatedEffort || 'unknown'}`;
      }).join("\n\n");

      const resp = await trackedAI({
        instructions: `You are a strategic advisor briefing the CEO on pending project proposals. Analyze each proposal in context of the company's current state, strategy, and resources. For each proposal, provide a clear recommendation (approve/reject/defer) with reasoning.\n\nCOMPANY CONTEXT:\n${companyCtx}\n\nConsider:\n- Strategic alignment with current objectives\n- Resource availability (agent workload)\n- Budget implications\n- Urgency vs. current project load\n- Potential overlap with existing projects\n\nReturn a JSON object with:\n- brief: string (2-3 sentence executive summary)\n- recommendations: array of { itemIndex (number, 0-based), recommendation ("approve"|"reject"|"defer"), reasoning (string, 1-2 sentences), urgency ("high"|"medium"|"low") }`,
        input: `Review these ${pending.length} pending proposals:\n\n${itemsSummary}`,
      }, { label: "CEO approval brief" });

      const match = resp.output_text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : { brief: "Analysis unavailable.", recommendations: [] };

      // Attach the queue item IDs to recommendations
      if (parsed.recommendations) {
        parsed.recommendations = parsed.recommendations.map((r: any) => ({
          ...r,
          itemId: pending[r.itemIndex]?.id,
          itemTitle: pending[r.itemIndex]?.title,
        }));
      }

      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate brief", details: error.message });
    }
  });

  // Helper endpoint: submit proposal to approval queue
  app.post("/api/approval-queue", async (req, res) => {
    try {
      const { title, description, priority, assignedAgentId, source, meetingId, goalId, estimatedEffort, targetMetric, expectedImpact } = req.body;
      const stgs = await storage.getSettings();
      const queue: any[] = (stgs as any).approvalQueue || [];

      const item = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        title,
        description: description || "",
        priority: priority || "medium",
        assignedAgentId: assignedAgentId || null,
        source: source || "manual",
        meetingId: meetingId || null,
        goalId: goalId || null,
        estimatedEffort: estimatedEffort || null,
        targetMetric: targetMetric || null,
        expectedImpact: expectedImpact || null,
        status: "pending",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        notes: null,
        projectId: null,
      };

      queue.push(item);
      await storage.updateSettings({ approvalQueue: queue });

      // Notification for CEO
      await storage.createNotification({
        type: "general",
        title: "New proposal awaiting approval",
        message: `"${title}" from ${source} needs your review`,
        link: "/approvals",
        read: false,
        createdAt: new Date().toISOString(),
        priority: priority === "high" ? "high" : "medium",
      });

      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit proposal", details: error.message });
    }
  });

  // ==================== ROADMAP & EXECUTION PLANNING ====================

  // Get roadmap planning data (project dates + budgets + execution modes)
  app.get("/api/roadmap", async (_req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || {};
    // roadmap shape: { projects: { [projectId]: { plannedStart, plannedEnd, tokenBudget, executionMode, tokensSpent } }, globalBudget: { daily, weekly, monthly }, executionLog: [] }
    res.json(roadmap);
  });

  // Update roadmap planning for a project
  app.patch("/api/roadmap/project/:id", async (req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: { daily: 0, weekly: 0, monthly: 0 }, executionLog: [] };
    if (!roadmap.projects) roadmap.projects = {};
    const pid = req.params.id;
    const existing = roadmap.projects[pid] || {};
    roadmap.projects[pid] = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await storage.updateSettings({ roadmapPlanning: roadmap });
    res.json(roadmap.projects[pid]);
  });

  // Batch update roadmap (for drag-and-drop reordering, bulk date assignment)
  app.patch("/api/roadmap/batch", async (req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: { daily: 0, weekly: 0, monthly: 0 }, executionLog: [] };
    if (!roadmap.projects) roadmap.projects = {};
    const { updates } = req.body; // [{ projectId, plannedStart, plannedEnd, ... }]
    if (Array.isArray(updates)) {
      for (const u of updates) {
        const pid = String(u.projectId);
        const existing = roadmap.projects[pid] || {};
        roadmap.projects[pid] = { ...existing, ...u, updatedAt: new Date().toISOString() };
      }
    }
    await storage.updateSettings({ roadmapPlanning: roadmap });
    res.json(roadmap);
  });

  // Update global budget settings
  app.patch("/api/roadmap/budget", async (req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: { daily: 0, weekly: 0, monthly: 0 }, executionLog: [] };
    roadmap.globalBudget = { ...(roadmap.globalBudget || {}), ...req.body };
    await storage.updateSettings({ roadmapPlanning: roadmap });
    res.json(roadmap.globalBudget);
  });

  // Get execution budget status (how much spent today/week/month vs limits)
  app.get("/api/roadmap/budget-status", async (_req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || { projects: {}, globalBudget: { daily: 0, weekly: 0, monthly: 0 }, executionLog: [] };
    const tokenStats = await storage.getTokenStats();
    const log = roadmap.executionLog || [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    const todaySpent = log.filter((e: any) => e.date?.startsWith(todayStr)).reduce((s: number, e: any) => s + (e.costCents || 0), 0);
    const weekSpent = log.filter((e: any) => e.date >= weekStartStr).reduce((s: number, e: any) => s + (e.costCents || 0), 0);
    const monthSpent = log.filter((e: any) => e.date?.startsWith(monthStr)).reduce((s: number, e: any) => s + (e.costCents || 0), 0);

    res.json({
      today: { spent: todaySpent, limit: roadmap.globalBudget?.daily || 0 },
      week: { spent: weekSpent, limit: roadmap.globalBudget?.weekly || 0 },
      month: { spent: monthSpent, limit: roadmap.globalBudget?.monthly || 0 },
      totalAllTime: tokenStats.totalCostCents,
      totalCalls: tokenStats.callCount,
      isOverBudget: (roadmap.globalBudget?.daily > 0 && todaySpent >= roadmap.globalBudget.daily) ||
                    (roadmap.globalBudget?.weekly > 0 && weekSpent >= roadmap.globalBudget.weekly),
    });
  });

  // AI: auto-plan projects onto calendar based on priority, dependencies, and capacity
  app.post("/api/roadmap/auto-plan", async (_req, res) => {
    try {
      const result = await runAutoPlan();
      if (result.planned === 0) {
        return res.json({ message: "All projects are already planned", planned: 0 });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Roadmap execution log entry (called internally when trackedAI runs)
  app.get("/api/roadmap/execution-log", async (_req, res) => {
    const stgs = await storage.getSettings();
    const roadmap = (stgs as any).roadmapPlanning || {};
    const log = (roadmap.executionLog || []).slice(-200); // last 200 entries
    res.json(log);
  });

  // ===== GAP 2: Artifact Endpoints =====

  app.get("/api/artifacts", async (req, res) => {
    const filters: any = {};
    if (req.query.taskId) filters.taskId = Number(req.query.taskId);
    if (req.query.agentId) filters.agentId = Number(req.query.agentId);
    if (req.query.projectId) filters.projectId = Number(req.query.projectId);
    if (req.query.type) filters.type = req.query.type;
    const artifacts = await (storage as SQLiteStorage).getArtifacts(filters);
    res.json(artifacts);
  });

  app.get("/api/artifacts/:id", async (req, res) => {
    const artifacts = await (storage as SQLiteStorage).getArtifacts({ id: Number(req.params.id) });
    if (!artifacts.length) return res.status(404).json({ error: "Artifact not found" });
    res.json(artifacts[0]);
  });

  app.post("/api/artifacts", async (req, res) => {
    const artifact = await (storage as SQLiteStorage).createArtifact(req.body);
    res.status(201).json(artifact);
  });

  app.put("/api/artifacts/:id", async (req, res) => {
    const updated = await (storage as SQLiteStorage).updateArtifact(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Artifact not found" });
    res.json(updated);
  });

  app.delete("/api/artifacts/:id", async (req, res) => {
    await (storage as SQLiteStorage).deleteArtifact(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/artifacts/:id/versions", async (req, res) => {
    const versions = await (storage as SQLiteStorage).getArtifactVersions(Number(req.params.id));
    res.json(versions);
  });

  app.get("/api/tasks/:id/artifacts", async (req, res) => {
    const artifacts = await (storage as SQLiteStorage).getArtifacts({ taskId: Number(req.params.id) });
    res.json(artifacts);
  });

  app.get("/api/agents/:id/artifacts", async (req, res) => {
    const artifacts = await (storage as SQLiteStorage).getArtifacts({ agentId: Number(req.params.id) });
    res.json(artifacts);
  });

  app.get("/api/projects/:id/artifacts", async (req, res) => {
    const artifacts = await (storage as SQLiteStorage).getArtifacts({ projectId: Number(req.params.id) });
    res.json(artifacts);
  });

  // ===== GAP 3: Tool Endpoints =====

  app.get("/api/tools", async (_req, res) => {
    const tools = getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      parameters: t.parameters,
      requiredRole: t.requiredRole,
    }));
    res.json(tools);
  });

  app.get("/api/tools/executions", async (req, res) => {
    const filters: any = {};
    if (req.query.taskId) filters.taskId = Number(req.query.taskId);
    if (req.query.agentId) filters.agentId = Number(req.query.agentId);
    const executions = await (storage as SQLiteStorage).getToolExecutions(filters);
    res.json(executions);
  });

  app.get("/api/tasks/:id/tool-executions", async (req, res) => {
    const executions = await (storage as SQLiteStorage).getToolExecutions({ taskId: Number(req.params.id) });
    res.json(executions);
  });

  // ===== GAP 5: Agent Communication Endpoints =====

  app.get("/api/agents/:id/communications", async (req, res) => {
    const agentId = Number(req.params.id);
    const comms = await (storage as SQLiteStorage).getAgentCommunications({ agentId });
    res.json(comms);
  });

  app.post("/api/agent-communications", async (req, res) => {
    const comm = await (storage as SQLiteStorage).createAgentCommunication(req.body);
    res.status(201).json(comm);
  });

  app.get("/api/agent-communications/feed", async (_req, res) => {
    const comms = await (storage as SQLiteStorage).getAgentCommunications({});
    res.json(comms.slice(0, 100)); // last 100
  });

  // ===== GAP 6: Enhanced Chat Context =====

  app.get("/api/agents/:id/chat/context", async (req, res) => {
    const agentId = Number(req.params.id);
    const agent = await storage.getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const tasks = (await storage.getAgentTasks()).filter(t => t.assignedAgentId === agentId).slice(-10);
    const artifacts = await (storage as SQLiteStorage).getArtifacts({ agentId });
    const toolExecs = await (storage as SQLiteStorage).getToolExecutions({ agentId });
    const memories = await storage.getAgentMemories(agentId);
    res.json({
      agent,
      recentTasks: tasks,
      recentArtifacts: artifacts.slice(-10),
      recentToolExecutions: toolExecs.slice(-10),
      memories: memories.slice(-10),
    });
  });

  // ===== GAP 7: Verification Endpoints =====

  app.get("/api/tasks/:id/verifications", async (req, res) => {
    const results = await (storage as SQLiteStorage).getVerificationResults(Number(req.params.id));
    res.json(results);
  });

  app.get("/api/verification/stats", async (_req, res) => {
    const stats = await (storage as SQLiteStorage).getVerificationStats();
    res.json(stats);
  });

  app.patch("/api/settings/verification", async (req, res) => {
    const settings = await storage.getSettings();
    const updated = { ...settings, ...req.body };
    await storage.updateSettings(updated);
    res.json(updated);
  });

  // ===== GAP 8: Sandbox Endpoints =====

  app.post("/api/sandbox/execute", async (req, res) => {
    const { code, language, taskId } = req.body;
    if (!code || !language) return res.status(400).json({ error: "code and language required" });
    const result = await executeSandboxedCode(code, language, taskId || 0);
    res.json(result);
  });

  app.get("/api/tasks/:id/executions", async (req, res) => {
    const executions = await (storage as SQLiteStorage).getToolExecutions({ taskId: Number(req.params.id) });
    res.json(executions.filter(e => e.toolName === 'execute_code'));
  });

} // end registerRoutes

function computeNextRun(frequency: string, startDate?: string): string {
  const now = new Date();
  const base = startDate ? new Date(startDate) : now;
  if (base > now) return base.toISOString();
  switch (frequency) {
    case "hourly": return new Date(now.getTime() + 3600000).toISOString();
    case "daily": {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      return next.toISOString();
    }
    case "weekly": {
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      return next.toISOString();
    }
    case "biweekly": {
      const next = new Date(now);
      next.setDate(next.getDate() + 14);
      return next.toISOString();
    }
    case "monthly": {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    default: return new Date(now.getTime() + 86400000).toISOString();
  }
}
