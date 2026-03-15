import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// AI Agents in the org chart
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  avatar: text("avatar"), // emoji or icon key
  instructions: text("instructions").notNull().default(""),
  skills: text("skills").array(),
  parentId: integer("parent_id"), // for org chart hierarchy
  status: text("status").notNull().default("active"), // active, inactive
  color: text("color").default("#4F98A3"), // accent color for the agent
  model: text("model"), // AI model override (null = use global default)
  autonomyLevel: text("autonomy_level").default("manual"), // manual, low_auto, medium_auto, full_auto
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Board Meetings
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("active"), // active, completed
  agentIds: integer("agent_ids").array().notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Meeting Messages (conversation thread)
export const meetingMessages = pgTable("meeting_messages", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  agentId: integer("agent_id"), // null for owner messages
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertMeetingMessageSchema = createInsertSchema(meetingMessages).omit({ id: true });
export type InsertMeetingMessage = z.infer<typeof insertMeetingMessageSchema>;
export type MeetingMessage = typeof meetingMessages.$inferSelect;

// Projects (derived from meetings)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("backlog"), // backlog, in_progress, completed
  assignedAgentId: integer("assigned_agent_id"),
  meetingId: integer("meeting_id"), // source meeting
  goalId: integer("goal_id"), // linked strategic objective/key result
  priority: text("priority").notNull().default("medium"), // low, medium, high
  progress: integer("progress").notNull().default(0), // 0-100
  totalTasks: integer("total_tasks").notNull().default(0),
  completedTasks: integer("completed_tasks").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Financial Transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // earning, expenditure
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // in cents
  date: text("date").notNull(),
  agentId: integer("agent_id"), // associated agent
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Agent Tasks (agentic workflow) - enhanced with delegation, dependencies, deliverables
export const agentTasks = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  assignedAgentId: integer("assigned_agent_id").notNull(),
  status: text("status").notNull().default("pending"),
  // pending -> thinking -> proposal_ready -> approved -> executing -> completed / rejected
  type: text("type").notNull().default("general"),
  // hire_agent, modify_orgchart, propose_orgchart, general, delegate, workflow
  proposal: text("proposal"), // AI-generated proposal (markdown)
  proposedActions: text("proposed_actions"), // JSON string of structured actions
  executionLog: text("execution_log"), // what happened during execution
  projectId: integer("project_id"), // link task to a project
  meetingId: integer("meeting_id"), // source meeting if derived from one
  parentTaskId: integer("parent_task_id"), // for sub-tasks / delegation chains
  dependsOn: text("depends_on"), // JSON array of task IDs this depends on
  deliverables: text("deliverables"), // JSON array of deliverable objects
  collaborators: text("collaborators"), // JSON array of agent IDs collaborating
  discussionThread: text("discussion_thread"), // JSON array of inter-agent messages
  workflowStage: text("workflow_stage"), // design, development, testing, review, deploy
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({ id: true });
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;

// OKRs / Strategic Goals
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("objective"), // objective, key_result
  parentGoalId: integer("parent_goal_id"), // key results belong to objectives
  ownerId: integer("owner_id"), // agent responsible
  progress: integer("progress").notNull().default(0), // 0-100
  status: text("status").notNull().default("active"), // active, completed, at_risk
  quarter: text("quarter"), // e.g. "Q1 2026"
  createdAt: text("created_at").notNull(),
});

export const insertGoalSchema = createInsertSchema(goals).omit({ id: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

// Proposed agents (from hire tasks, awaiting approval)
export interface ProposedAgent {
  name: string;
  role: string;
  department: string;
  avatar: string;
  instructions: string;
  skills: string[];
  parentId: number | null;
  color: string;
  rationale: string; // why this hire is needed
}

// Deliverable type for task artifacts
export interface Deliverable {
  id: string;
  title: string;
  type: "document" | "code" | "design" | "spec" | "report" | "other";
  content: string;
  producedBy: number; // agent ID
  version: number;
  createdAt: string;
}

// Discussion message for agent collaboration
export interface DiscussionMessage {
  id: string;
  agentId: number;
  agentName: string;
  content: string;
  type: "comment" | "question" | "handoff" | "status_update" | "review" | "approval";
  timestamp: string;
}

// Agent Memory (Iteration 1)
export interface AgentMemory {
  id: number;
  agentId: number;
  type: "fact" | "preference" | "learning" | "relationship";
  content: string;
  source: string | null; // taskId or meetingId reference
  createdAt: string;
  importance: number; // 1-5
}

// Agent Message (Iteration 2)
export interface AgentMessage {
  id: number;
  fromAgentId: number;
  toAgentId: number;
  content: string;
  type: "request" | "update" | "question" | "handoff";
  relatedTaskId: number | null;
  read: boolean;
  createdAt: string;
}

// Workflow (Iteration 4)
export interface WorkflowStep {
  order: number;
  title: string;
  assignedAgentId: number | null;
  type: string;
  autoApprove: boolean;
  estimatedHours: number;
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: string;
}

// Agent Capability (Iteration 5)
export interface AgentCapability {
  name: string;
  level: "beginner" | "intermediate" | "expert";
  category: "technical" | "creative" | "analytical" | "management";
}

// Notification (Iteration 7)
export interface Notification {
  id: number;
  type: "task_completed" | "proposal_ready" | "agent_overloaded" | "meeting_scheduled" | "workflow_completed" | "general";
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
  priority: "low" | "medium" | "high";
}

// Decision Log Entry (Iteration 8)
export interface DecisionLogEntry {
  id: number;
  type: "approval" | "rejection" | "delegation" | "hire" | "fire" | "config_change" | "meeting_decision";
  description: string;
  madeBy: string; // "owner" or agent name
  relatedId: number | null;
  timestamp: string;
  impact: "low" | "medium" | "high";
}

// Company Snapshot (Iteration 13)
export interface CompanySnapshot {
  id: number;
  name: string;
  timestamp: string;
  data: {
    agentCount: number;
    taskStats: { total: number; completed: number; pending: number; rejected: number };
    projectStats: { total: number; completed: number; inProgress: number; backlog: number };
    financials: { totalEarnings: number; totalExpenses: number; netRevenue: number };
    orgStructure: { departments: string[]; agentsByDept: Record<string, number> };
  };
}

// SOP / Process Template (Iteration 15)
export interface SOP {
  id: number;
  title: string;
  category: string;
  steps: string[];
  department: string;
  createdAt: string;
  updatedAt: string;
}

// Task Comment (Iteration 24)
export interface TaskComment {
  id: number;
  taskId: number;
  authorType: "owner" | "agent";
  authorId: number | null;
  authorName: string;
  content: string;
  createdAt: string;
}

// Client / Vendor (Iteration 22)
export interface Client {
  id: number;
  name: string;
  type: "client" | "vendor" | "partner";
  contact: string;
  status: "active" | "inactive";
  projects: number[];
  createdAt: string;
}

// Meeting Template (Iteration 23)
export interface MeetingTemplate {
  id: number;
  name: string;
  agenda: string;
  suggestedSpeakers: string[];
  duration: number; // minutes
  type: string;
}

// Timeline Event (Iteration 25)
export interface TimelineEvent {
  id: number;
  type: "hire" | "task_completed" | "meeting" | "decision" | "milestone" | "project_created" | "general";
  title: string;
  description: string;
  agentId: number | null;
  department: string | null;
  timestamp: string;
}

// Approval Step (Iteration 26)
export interface ApprovalStep {
  approverId: number;
  approverName: string;
  status: "pending" | "approved" | "rejected";
  timestamp: string | null;
}

// Escalation Rule (Iteration 27)
export interface EscalationRule {
  id: number;
  name: string;
  triggerHours: number;
  action: "reassign_manager" | "reassign_ceo" | "notify";
  enabled: boolean;
  createdAt: string;
}

// Checklist (Iteration 28)
export interface ChecklistItem {
  text: string;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
}

export interface Checklist {
  id: number;
  name: string;
  items: ChecklistItem[];
  parentType: "task" | "project";
  parentId: number;
  createdAt: string;
}

// API Activity Log Entry (Iteration 29)
export interface ApiLogEntry {
  id: number;
  method: string;
  path: string;
  body: string | null;
  timestamp: string;
  statusCode: number;
}

// Risk Register (Iteration 39)
export interface Risk {
  id: number;
  title: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  mitigations: string;
  ownerId: number | null;
  status: "open" | "mitigated" | "closed";
  projectId: number | null;
  createdAt: string;
}

// Project Milestone (Iteration 37)
export interface ProjectMilestone {
  name: string;
  targetDate: string;
  status: "pending" | "completed" | "overdue";
  completedDate: string | null;
}

// Company Template (Iteration 31)
export interface CompanyTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  agents: { name: string; role: string; department: string; avatar: string; instructions: string; skills: string[]; color: string; parentRole: string | null }[];
  workflows: { name: string; description: string; steps: { order: number; title: string; type: string; autoApprove: boolean; estimatedHours: number }[] }[];
  sops: { title: string; category: string; steps: string[]; department: string }[];
}

// ===== GAP 2: Artifact =====
export interface Artifact {
  id: number;
  taskId: number | null;
  agentId: number | null;
  projectId: number | null;
  title: string;
  type: "document" | "code" | "spec" | "plan" | "design" | "data";
  content: string | null;
  filePath: string | null;
  version: number;
  parentArtifactId: number | null;
  metadata: string | null; // JSON
  createdAt: string;
  updatedAt: string;
}

export interface InsertArtifact {
  taskId?: number | null;
  agentId?: number | null;
  projectId?: number | null;
  title: string;
  type: string;
  content?: string | null;
  filePath?: string | null;
  version?: number;
  parentArtifactId?: number | null;
  metadata?: string | null;
}

// ===== GAP 3: Tool Execution =====
export interface ToolExecution {
  id: number;
  taskId: number | null;
  agentId: number | null;
  toolName: string;
  parameters: string | null; // JSON
  result: string | null; // JSON
  success: boolean | null;
  durationMs: number | null;
  createdAt: string;
}

export interface InsertToolExecution {
  taskId?: number | null;
  agentId?: number | null;
  toolName: string;
  parameters?: string | null;
  result?: string | null;
  success?: boolean | null;
  durationMs?: number | null;
}

// ===== GAP 5: Agent Communication =====
export interface AgentCommunication {
  id: number;
  fromAgentId: number;
  toAgentId: number;
  taskId: number | null;
  type: "message" | "query" | "response" | "review_request" | "review_response";
  content: string;
  metadata: string | null; // JSON
  read: boolean;
  createdAt: string;
}

export interface InsertAgentCommunication {
  fromAgentId: number;
  toAgentId: number;
  taskId?: number | null;
  type: string;
  content: string;
  metadata?: string | null;
}

// ===== GAP 7: Verification Result =====
export interface VerificationResult {
  id: number;
  taskId: number;
  agentId: number;
  type: "self_check" | "peer_review" | "quality_gate";
  reviewerAgentId: number | null;
  score: number | null; // 0-1
  passed: boolean | null;
  feedback: string | null;
  criteria: string | null; // JSON
  createdAt: string;
}

export interface InsertVerificationResult {
  taskId: number;
  agentId: number;
  type: string;
  reviewerAgentId?: number | null;
  score?: number | null;
  passed?: boolean | null;
  feedback?: string | null;
  criteria?: string | null;
}
