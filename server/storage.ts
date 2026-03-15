import {
  Agent, InsertAgent,
  Meeting, InsertMeeting,
  MeetingMessage, InsertMeetingMessage,
  Project, InsertProject,
  Transaction, InsertTransaction,
  AgentTask, InsertAgentTask,
  Goal, InsertGoal,
  AgentMemory, AgentMessage, Workflow,
  Notification, DecisionLogEntry,
  CompanySnapshot, SOP,
  TaskComment, Client, MeetingTemplate, TimelineEvent,
  Checklist, EscalationRule, ApiLogEntry, Risk,
} from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined>;

  // Meeting Messages
  getMeetingMessages(meetingId: number): Promise<MeetingMessage[]>;
  createMeetingMessage(message: InsertMeetingMessage): Promise<MeetingMessage>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<boolean>;

  // Agent Tasks
  getAgentTasks(): Promise<AgentTask[]>;
  getAgentTask(id: number): Promise<AgentTask | undefined>;
  getAgentTasksByParent(parentTaskId: number): Promise<AgentTask[]>;
  getAgentTasksByAgent(agentId: number): Promise<AgentTask[]>;
  getAgentTasksByProject(projectId: number): Promise<AgentTask[]>;
  createAgentTask(task: InsertAgentTask): Promise<AgentTask>;
  updateAgentTask(id: number, task: Partial<InsertAgentTask>): Promise<AgentTask | undefined>;
  deleteAgentTask(id: number): Promise<boolean>;

  // Goals / OKRs
  getGoals(): Promise<Goal[]>;
  getGoal(id: number): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<boolean>;

  // Agent Memories
  getAgentMemories(agentId: number): Promise<AgentMemory[]>;
  createAgentMemory(memory: Omit<AgentMemory, "id">): Promise<AgentMemory>;

  // Agent Messages
  getAgentMessages(agentId: number): Promise<AgentMessage[]>;
  createAgentMessage(message: Omit<AgentMessage, "id">): Promise<AgentMessage>;
  updateAgentMessage(id: number, update: Partial<AgentMessage>): Promise<AgentMessage | undefined>;

  // Workflows
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  createWorkflow(workflow: Omit<Workflow, "id">): Promise<Workflow>;
  updateWorkflow(id: number, update: Partial<Omit<Workflow, "id">>): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  createNotification(notification: Omit<Notification, "id">): Promise<Notification>;
  updateNotification(id: number, update: Partial<Notification>): Promise<Notification | undefined>;
  clearNotifications(): Promise<void>;

  // Decision Log
  getDecisionLog(): Promise<DecisionLogEntry[]>;
  createDecisionLogEntry(entry: Omit<DecisionLogEntry, "id">): Promise<DecisionLogEntry>;

  // Snapshots
  getSnapshots(): Promise<CompanySnapshot[]>;
  createSnapshot(snapshot: Omit<CompanySnapshot, "id">): Promise<CompanySnapshot>;

  // SOPs
  getSOPs(): Promise<SOP[]>;
  getSOP(id: number): Promise<SOP | undefined>;
  createSOP(sop: Omit<SOP, "id">): Promise<SOP>;
  updateSOP(id: number, update: Partial<Omit<SOP, "id">>): Promise<SOP | undefined>;
  deleteSOP(id: number): Promise<boolean>;

  // Task Comments
  getTaskComments(taskId: number): Promise<TaskComment[]>;
  createTaskComment(comment: Omit<TaskComment, "id">): Promise<TaskComment>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: Omit<Client, "id">): Promise<Client>;
  updateClient(id: number, update: Partial<Omit<Client, "id">>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Meeting Templates
  getMeetingTemplates(): Promise<MeetingTemplate[]>;
  createMeetingTemplate(template: Omit<MeetingTemplate, "id">): Promise<MeetingTemplate>;

  // Timeline Events
  getTimelineEvents(): Promise<TimelineEvent[]>;
  createTimelineEvent(event: Omit<TimelineEvent, "id">): Promise<TimelineEvent>;

  // Checklists
  getChecklists(): Promise<Checklist[]>;
  getChecklistsByParent(parentType: string, parentId: number): Promise<Checklist[]>;
  createChecklist(checklist: Omit<Checklist, "id">): Promise<Checklist>;
  updateChecklist(id: number, update: Partial<Omit<Checklist, "id">>): Promise<Checklist | undefined>;
  deleteChecklist(id: number): Promise<boolean>;

  // Escalation Rules
  getEscalationRules(): Promise<EscalationRule[]>;
  createEscalationRule(rule: Omit<EscalationRule, "id">): Promise<EscalationRule>;
  updateEscalationRule(id: number, update: Partial<Omit<EscalationRule, "id">>): Promise<EscalationRule | undefined>;
  deleteEscalationRule(id: number): Promise<boolean>;

  // API Activity Log
  getApiLog(): Promise<ApiLogEntry[]>;
  createApiLogEntry(entry: Omit<ApiLogEntry, "id">): Promise<ApiLogEntry>;

  // Risks
  getRisks(): Promise<Risk[]>;
  getRisk(id: number): Promise<Risk | undefined>;
  createRisk(risk: Omit<Risk, "id">): Promise<Risk>;
  updateRisk(id: number, update: Partial<Omit<Risk, "id">>): Promise<Risk | undefined>;
  deleteRisk(id: number): Promise<boolean>;

  // Token Usage stats
  getTokenStats(): Promise<{ totalInputTokens: number; totalOutputTokens: number; totalCostCents: number; callCount: number }>;

  // Settings
  getSettings(): Promise<Record<string, any>>;
  updateSettings(update: Record<string, any>): Promise<Record<string, any>>;
}

// Data shape stored in the JSON file
interface PersistentData {
  agents: [number, Agent][];
  meetings: [number, Meeting][];
  meetingMessages: [number, MeetingMessage][];
  projects: [number, Project][];
  transactions: [number, Transaction][];
  agentTasks: [number, AgentTask][];
  goals: [number, Goal][];
  agentMemories?: [number, AgentMemory][];
  agentMessages?: [number, AgentMessage][];
  workflows?: [number, Workflow][];
  notifications?: [number, Notification][];
  decisionLog?: [number, DecisionLogEntry][];
  snapshots?: [number, CompanySnapshot][];
  sops?: [number, SOP][];
  taskComments?: [number, TaskComment][];
  clients?: [number, Client][];
  meetingTemplates?: [number, MeetingTemplate][];
  timelineEvents?: [number, TimelineEvent][];
  checklists?: [number, Checklist][];
  escalationRules?: [number, EscalationRule][];
  apiLog?: [number, ApiLogEntry][];
  risks?: [number, Risk][];
  nextId: { agent: number; meeting: number; message: number; project: number; transaction: number; task: number; goal: number; memory?: number; agentMessage?: number; workflow?: number; notification?: number; decision?: number; snapshot?: number; sop?: number; taskComment?: number; client?: number; meetingTemplate?: number; timelineEvent?: number; checklist?: number; escalationRule?: number; apiLogEntry?: number; risk?: number };
  tokenStats: { totalInputTokens: number; totalOutputTokens: number; totalCostCents: number; callCount: number };
  settings?: Record<string, any>;
}

// Persistent file-based storage — data survives server restarts & redeployments
const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

export class FileStorage implements IStorage {
  private agents: Map<number, Agent> = new Map();
  private meetings: Map<number, Meeting> = new Map();
  private meetingMessages: Map<number, MeetingMessage> = new Map();
  private projects: Map<number, Project> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  private agentTasks: Map<number, AgentTask> = new Map();
  private goals: Map<number, Goal> = new Map();
  private agentMemoriesMap: Map<number, AgentMemory> = new Map();
  private agentMessagesMap: Map<number, AgentMessage> = new Map();
  private workflowsMap: Map<number, Workflow> = new Map();
  private notificationsMap: Map<number, Notification> = new Map();
  private decisionLogMap: Map<number, DecisionLogEntry> = new Map();
  private snapshotsMap: Map<number, CompanySnapshot> = new Map();
  private sopsMap: Map<number, SOP> = new Map();
  private taskCommentsMap: Map<number, TaskComment> = new Map();
  private clientsMap: Map<number, Client> = new Map();
  private meetingTemplatesMap: Map<number, MeetingTemplate> = new Map();
  private timelineEventsMap: Map<number, TimelineEvent> = new Map();
  private checklistsMap: Map<number, Checklist> = new Map();
  private escalationRulesMap: Map<number, EscalationRule> = new Map();
  private apiLogMap: Map<number, ApiLogEntry> = new Map();
  private risksMap: Map<number, Risk> = new Map();
  private nextId: Record<string, number> = { agent: 1, meeting: 1, message: 1, project: 1, transaction: 1, task: 1, goal: 1, memory: 1, agentMessage: 1, workflow: 1, notification: 1, decision: 1, snapshot: 1, sop: 1, taskComment: 1, client: 1, meetingTemplate: 1, timelineEvent: 1, checklist: 1, escalationRule: 1, apiLogEntry: 1, risk: 1 };
  private tokenStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, callCount: 0 };
  private settings: Record<string, any> = { defaultModel: "gpt5_nano" };

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Try to load persisted data
    if (this.loadFromFile()) {
      console.log(`[storage] Restored state from ${DATA_FILE} (${this.agents.size} agents, ${this.agentTasks.size} tasks, ${this.projects.size} projects, ${this.transactions.size} transactions)`);
    } else {
      // Fresh start — seed with only the CEO
      console.log("[storage] No saved state found — starting fresh with CEO");
      this.createAgent({
        name: "Atlas",
        role: "CEO",
        department: "Executive",
        avatar: "👑",
        instructions: "You are Atlas, the CEO and first hire of this AI-native digital products company. You are a visionary leader who thinks strategically about company building. When asked to hire someone, you carefully consider the role requirements, craft a compelling persona and skill set, and propose candidates with detailed rationale. You are direct, decisive, and always thinking about how each hire fits the bigger picture. When proposing org chart structures, you consider reporting lines, department balance, and growth trajectory. When delegating tasks, you assign the right person for the job and provide clear success criteria.",
        skills: ["Strategy", "Leadership", "Vision", "Company Building", "Hiring"],
        parentId: null,
        status: "active",
        color: "#00BCD4",
      });
    }
  }

  // --- Persistence layer ---

  private loadFromFile(): boolean {
    try {
      if (!fs.existsSync(DATA_FILE)) return false;
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data: PersistentData = JSON.parse(raw);

      this.agents = new Map(data.agents);
      this.meetings = new Map(data.meetings);
      this.meetingMessages = new Map(data.meetingMessages);
      this.projects = new Map(data.projects);
      this.transactions = new Map(data.transactions);
      this.agentTasks = new Map(data.agentTasks);
      this.goals = new Map(data.goals);
      this.agentMemoriesMap = new Map(data.agentMemories || []);
      this.agentMessagesMap = new Map(data.agentMessages || []);
      this.workflowsMap = new Map(data.workflows || []);
      this.notificationsMap = new Map(data.notifications || []);
      this.decisionLogMap = new Map(data.decisionLog || []);
      this.snapshotsMap = new Map(data.snapshots || []);
      this.sopsMap = new Map(data.sops || []);
      this.taskCommentsMap = new Map(data.taskComments || []);
      this.clientsMap = new Map(data.clients || []);
      this.meetingTemplatesMap = new Map(data.meetingTemplates || []);
      this.timelineEventsMap = new Map(data.timelineEvents || []);
      this.checklistsMap = new Map(data.checklists || []);
      this.escalationRulesMap = new Map(data.escalationRules || []);
      this.apiLogMap = new Map(data.apiLog || []);
      this.risksMap = new Map(data.risks || []);
      this.nextId = { ...this.nextId, ...data.nextId };
      this.tokenStats = data.tokenStats || { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, callCount: 0 };
      this.settings = data.settings || { defaultModel: "gpt5_nano" };
      return true;
    } catch (e) {
      console.error("[storage] Failed to load state:", (e as Error).message);
      return false;
    }
  }

  private saveToFile(): void {
    // Debounce: batch rapid writes into one file write (100ms)
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const data: PersistentData = {
          agents: Array.from(this.agents.entries()),
          meetings: Array.from(this.meetings.entries()),
          meetingMessages: Array.from(this.meetingMessages.entries()),
          projects: Array.from(this.projects.entries()),
          transactions: Array.from(this.transactions.entries()),
          agentTasks: Array.from(this.agentTasks.entries()),
          goals: Array.from(this.goals.entries()),
          agentMemories: Array.from(this.agentMemoriesMap.entries()),
          agentMessages: Array.from(this.agentMessagesMap.entries()),
          workflows: Array.from(this.workflowsMap.entries()),
          notifications: Array.from(this.notificationsMap.entries()),
          decisionLog: Array.from(this.decisionLogMap.entries()),
          snapshots: Array.from(this.snapshotsMap.entries()),
          sops: Array.from(this.sopsMap.entries()),
          taskComments: Array.from(this.taskCommentsMap.entries()),
          clients: Array.from(this.clientsMap.entries()),
          meetingTemplates: Array.from(this.meetingTemplatesMap.entries()),
          timelineEvents: Array.from(this.timelineEventsMap.entries()),
          checklists: Array.from(this.checklistsMap.entries()),
          escalationRules: Array.from(this.escalationRulesMap.entries()),
          apiLog: Array.from(this.apiLogMap.entries()),
          risks: Array.from(this.risksMap.entries()),
          nextId: this.nextId,
          tokenStats: this.tokenStats,
          settings: this.settings,
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf-8");
      } catch (e) {
        console.error("[storage] Failed to save state:", (e as Error).message);
      }
    }, 100);
  }

  // --- Settings ---
  async getSettings(): Promise<Record<string, any>> {
    return { ...this.settings };
  }

  async updateSettings(update: Record<string, any>): Promise<Record<string, any>> {
    this.settings = { ...this.settings, ...update };
    this.saveToFile();
    return { ...this.settings };
  }

  // --- Token stats ---
  async getTokenStats() {
    return { ...this.tokenStats };
  }

  recordTokenUsage(inputTokens: number, outputTokens: number, costCents: number) {
    this.tokenStats.totalInputTokens += inputTokens;
    this.tokenStats.totalOutputTokens += outputTokens;
    this.tokenStats.totalCostCents += costCents;
    this.tokenStats.callCount += 1;
    this.saveToFile();
  }

  // --- Agents ---
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const id = this.nextId.agent++;
    const newAgent: Agent = { id, name: agent.name, role: agent.role, department: agent.department, avatar: agent.avatar ?? null, instructions: agent.instructions ?? "", skills: agent.skills ?? null, parentId: agent.parentId ?? null, status: agent.status ?? "active", color: agent.color ?? "#4F98A3", model: agent.model ?? null, autonomyLevel: (agent as any).autonomyLevel ?? "manual" };
    this.agents.set(id, newAgent);
    this.saveToFile();
    return newAgent;
  }

  async updateAgent(id: number, update: Partial<InsertAgent>): Promise<Agent | undefined> {
    const existing = this.agents.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.agents.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteAgent(id: number): Promise<boolean> {
    const result = this.agents.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Meetings ---
  async getMeetings(): Promise<Meeting[]> {
    return Array.from(this.meetings.values()).sort((a, b) => b.id - a.id);
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const id = this.nextId.meeting++;
    const newMeeting: Meeting = { id, title: meeting.title, topic: meeting.topic, status: meeting.status ?? "active", agentIds: meeting.agentIds, createdAt: meeting.createdAt };
    this.meetings.set(id, newMeeting);
    this.saveToFile();
    return newMeeting;
  }

  async updateMeeting(id: number, update: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const existing = this.meetings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.meetings.set(id, updated);
    this.saveToFile();
    return updated;
  }

  // --- Meeting Messages ---
  async getMeetingMessages(meetingId: number): Promise<MeetingMessage[]> {
    return Array.from(this.meetingMessages.values()).filter(m => m.meetingId === meetingId).sort((a, b) => a.id - b.id);
  }

  async createMeetingMessage(message: InsertMeetingMessage): Promise<MeetingMessage> {
    const id = this.nextId.message++;
    const newMessage: MeetingMessage = { id, meetingId: message.meetingId, agentId: message.agentId ?? null, senderName: message.senderName, senderRole: message.senderRole, content: message.content, timestamp: message.timestamp };
    this.meetingMessages.set(id, newMessage);
    this.saveToFile();
    return newMessage;
  }

  // --- Projects ---
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => a.id - b.id);
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.nextId.project++;
    const newProject: Project = { id, title: project.title, description: project.description ?? "", status: project.status ?? "backlog", assignedAgentId: project.assignedAgentId ?? null, meetingId: project.meetingId ?? null, goalId: (project as any).goalId ?? null, priority: project.priority ?? "medium", progress: project.progress ?? 0, totalTasks: project.totalTasks ?? 0, completedTasks: project.completedTasks ?? 0, createdAt: project.createdAt };
    this.projects.set(id, newProject);
    this.saveToFile();
    return newProject;
  }

  async updateProject(id: number, update: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.projects.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = this.projects.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Transactions ---
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => b.id - a.id);
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const id = this.nextId.transaction++;
    const newTx: Transaction = { id, type: tx.type, category: tx.category, description: tx.description, amount: tx.amount, date: tx.date, agentId: tx.agentId ?? null };
    this.transactions.set(id, newTx);
    this.saveToFile();
    return newTx;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = this.transactions.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Agent Tasks ---
  async getAgentTasks(): Promise<AgentTask[]> {
    return Array.from(this.agentTasks.values()).sort((a, b) => a.id - b.id);
  }

  async getAgentTask(id: number): Promise<AgentTask | undefined> {
    return this.agentTasks.get(id);
  }

  async getAgentTasksByParent(parentTaskId: number): Promise<AgentTask[]> {
    return Array.from(this.agentTasks.values()).filter(t => t.parentTaskId === parentTaskId);
  }

  async getAgentTasksByAgent(agentId: number): Promise<AgentTask[]> {
    return Array.from(this.agentTasks.values()).filter(t => t.assignedAgentId === agentId);
  }

  async getAgentTasksByProject(projectId: number): Promise<AgentTask[]> {
    return Array.from(this.agentTasks.values()).filter(t => t.projectId === projectId).sort((a, b) => a.id - b.id);
  }

  async createAgentTask(task: InsertAgentTask): Promise<AgentTask> {
    const id = this.nextId.task++;
    const newTask: AgentTask = {
      id,
      title: task.title,
      description: task.description,
      assignedAgentId: task.assignedAgentId,
      status: task.status ?? "pending",
      type: task.type ?? "general",
      proposal: task.proposal ?? null,
      proposedActions: task.proposedActions ?? null,
      executionLog: task.executionLog ?? null,
      projectId: task.projectId ?? null,
      meetingId: task.meetingId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      dependsOn: task.dependsOn ?? null,
      deliverables: task.deliverables ?? null,
      collaborators: task.collaborators ?? null,
      discussionThread: task.discussionThread ?? null,
      workflowStage: task.workflowStage ?? null,
      priority: task.priority ?? "medium",
      createdAt: task.createdAt ?? new Date().toISOString(),
      completedAt: task.completedAt ?? null,
    };
    this.agentTasks.set(id, newTask);
    this.saveToFile();
    return newTask;
  }

  async updateAgentTask(id: number, update: Partial<InsertAgentTask>): Promise<AgentTask | undefined> {
    const existing = this.agentTasks.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update, updatedAt: new Date().toISOString() } as any;
    this.agentTasks.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteAgentTask(id: number): Promise<boolean> {
    const result = this.agentTasks.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Goals / OKRs ---
  async getGoals(): Promise<Goal[]> {
    return Array.from(this.goals.values()).sort((a, b) => b.id - a.id);
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    return this.goals.get(id);
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const id = this.nextId.goal++;
    const newGoal: Goal = {
      id,
      title: goal.title,
      description: goal.description ?? "",
      type: goal.type ?? "objective",
      parentGoalId: goal.parentGoalId ?? null,
      ownerId: goal.ownerId ?? null,
      progress: goal.progress ?? 0,
      status: goal.status ?? "active",
      quarter: goal.quarter ?? null,
      createdAt: goal.createdAt,
    };
    this.goals.set(id, newGoal);
    this.saveToFile();
    return newGoal;
  }

  async updateGoal(id: number, update: Partial<InsertGoal>): Promise<Goal | undefined> {
    const existing = this.goals.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.goals.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteGoal(id: number): Promise<boolean> {
    const result = this.goals.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Agent Memories ---
  async getAgentMemories(agentId: number): Promise<AgentMemory[]> {
    return Array.from(this.agentMemoriesMap.values())
      .filter(m => m.agentId === agentId)
      .sort((a, b) => b.importance - a.importance);
  }

  async createAgentMemory(memory: Omit<AgentMemory, "id">): Promise<AgentMemory> {
    const id = this.nextId.memory++;
    const newMemory: AgentMemory = { id, ...memory };
    this.agentMemoriesMap.set(id, newMemory);
    this.saveToFile();
    return newMemory;
  }

  // --- Agent Messages ---
  async getAgentMessages(agentId: number): Promise<AgentMessage[]> {
    return Array.from(this.agentMessagesMap.values())
      .filter(m => m.fromAgentId === agentId || m.toAgentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAgentMessage(message: Omit<AgentMessage, "id">): Promise<AgentMessage> {
    const id = this.nextId.agentMessage++;
    const newMessage: AgentMessage = { id, ...message };
    this.agentMessagesMap.set(id, newMessage);
    this.saveToFile();
    return newMessage;
  }

  async updateAgentMessage(id: number, update: Partial<AgentMessage>): Promise<AgentMessage | undefined> {
    const existing = this.agentMessagesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.agentMessagesMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  // --- Workflows ---
  async getWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflowsMap.values()).sort((a, b) => b.id - a.id);
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    return this.workflowsMap.get(id);
  }

  async createWorkflow(workflow: Omit<Workflow, "id">): Promise<Workflow> {
    const id = this.nextId.workflow++;
    const newWorkflow: Workflow = { id, ...workflow };
    this.workflowsMap.set(id, newWorkflow);
    this.saveToFile();
    return newWorkflow;
  }

  async updateWorkflow(id: number, update: Partial<Omit<Workflow, "id">>): Promise<Workflow | undefined> {
    const existing = this.workflowsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.workflowsMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    const result = this.workflowsMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Notifications ---
  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notificationsMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(notification: Omit<Notification, "id">): Promise<Notification> {
    const id = this.nextId.notification++;
    const newNotification: Notification = { id, ...notification };
    this.notificationsMap.set(id, newNotification);
    this.saveToFile();
    return newNotification;
  }

  async updateNotification(id: number, update: Partial<Notification>): Promise<Notification | undefined> {
    const existing = this.notificationsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.notificationsMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async clearNotifications(): Promise<void> {
    this.notificationsMap.clear();
    this.saveToFile();
  }

  // --- Decision Log ---
  async getDecisionLog(): Promise<DecisionLogEntry[]> {
    return Array.from(this.decisionLogMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createDecisionLogEntry(entry: Omit<DecisionLogEntry, "id">): Promise<DecisionLogEntry> {
    const id = this.nextId.decision++;
    const newEntry: DecisionLogEntry = { id, ...entry };
    this.decisionLogMap.set(id, newEntry);
    this.saveToFile();
    return newEntry;
  }

  // --- Snapshots ---
  async getSnapshots(): Promise<CompanySnapshot[]> {
    return Array.from(this.snapshotsMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createSnapshot(snapshot: Omit<CompanySnapshot, "id">): Promise<CompanySnapshot> {
    const id = this.nextId.snapshot++;
    const newSnapshot: CompanySnapshot = { id, ...snapshot };
    this.snapshotsMap.set(id, newSnapshot);
    this.saveToFile();
    return newSnapshot;
  }

  // --- SOPs ---
  async getSOPs(): Promise<SOP[]> {
    return Array.from(this.sopsMap.values()).sort((a, b) => a.id - b.id);
  }

  async getSOP(id: number): Promise<SOP | undefined> {
    return this.sopsMap.get(id);
  }

  async createSOP(sop: Omit<SOP, "id">): Promise<SOP> {
    const id = this.nextId.sop++;
    const newSOP: SOP = { id, ...sop };
    this.sopsMap.set(id, newSOP);
    this.saveToFile();
    return newSOP;
  }

  async updateSOP(id: number, update: Partial<Omit<SOP, "id">>): Promise<SOP | undefined> {
    const existing = this.sopsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.sopsMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteSOP(id: number): Promise<boolean> {
    const result = this.sopsMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Task Comments ---
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return Array.from(this.taskCommentsMap.values())
      .filter(c => c.taskId === taskId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createTaskComment(comment: Omit<TaskComment, "id">): Promise<TaskComment> {
    const id = this.nextId.taskComment++;
    const newComment: TaskComment = { id, ...comment };
    this.taskCommentsMap.set(id, newComment);
    this.saveToFile();
    return newComment;
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    return Array.from(this.clientsMap.values()).sort((a, b) => a.id - b.id);
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clientsMap.get(id);
  }

  async createClient(client: Omit<Client, "id">): Promise<Client> {
    const id = this.nextId.client++;
    const newClient: Client = { id, ...client };
    this.clientsMap.set(id, newClient);
    this.saveToFile();
    return newClient;
  }

  async updateClient(id: number, update: Partial<Omit<Client, "id">>): Promise<Client | undefined> {
    const existing = this.clientsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.clientsMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = this.clientsMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Meeting Templates ---
  async getMeetingTemplates(): Promise<MeetingTemplate[]> {
    return Array.from(this.meetingTemplatesMap.values()).sort((a, b) => a.id - b.id);
  }

  async createMeetingTemplate(template: Omit<MeetingTemplate, "id">): Promise<MeetingTemplate> {
    const id = this.nextId.meetingTemplate++;
    const newTemplate: MeetingTemplate = { id, ...template };
    this.meetingTemplatesMap.set(id, newTemplate);
    this.saveToFile();
    return newTemplate;
  }

  // --- Timeline Events ---
  async getTimelineEvents(): Promise<TimelineEvent[]> {
    return Array.from(this.timelineEventsMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createTimelineEvent(event: Omit<TimelineEvent, "id">): Promise<TimelineEvent> {
    const id = this.nextId.timelineEvent++;
    const newEvent: TimelineEvent = { id, ...event };
    this.timelineEventsMap.set(id, newEvent);
    this.saveToFile();
    return newEvent;
  }

  // --- Checklists ---
  async getChecklists(): Promise<Checklist[]> {
    return Array.from(this.checklistsMap.values()).sort((a, b) => a.id - b.id);
  }

  async getChecklistsByParent(parentType: string, parentId: number): Promise<Checklist[]> {
    return Array.from(this.checklistsMap.values()).filter(c => c.parentType === parentType && c.parentId === parentId);
  }

  async createChecklist(checklist: Omit<Checklist, "id">): Promise<Checklist> {
    const id = this.nextId.checklist++;
    const newChecklist: Checklist = { id, ...checklist };
    this.checklistsMap.set(id, newChecklist);
    this.saveToFile();
    return newChecklist;
  }

  async updateChecklist(id: number, update: Partial<Omit<Checklist, "id">>): Promise<Checklist | undefined> {
    const existing = this.checklistsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.checklistsMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteChecklist(id: number): Promise<boolean> {
    const result = this.checklistsMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Escalation Rules ---
  async getEscalationRules(): Promise<EscalationRule[]> {
    return Array.from(this.escalationRulesMap.values()).sort((a, b) => a.id - b.id);
  }

  async createEscalationRule(rule: Omit<EscalationRule, "id">): Promise<EscalationRule> {
    const id = this.nextId.escalationRule++;
    const newRule: EscalationRule = { id, ...rule };
    this.escalationRulesMap.set(id, newRule);
    this.saveToFile();
    return newRule;
  }

  async updateEscalationRule(id: number, update: Partial<Omit<EscalationRule, "id">>): Promise<EscalationRule | undefined> {
    const existing = this.escalationRulesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.escalationRulesMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteEscalationRule(id: number): Promise<boolean> {
    const result = this.escalationRulesMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- API Activity Log ---
  async getApiLog(): Promise<ApiLogEntry[]> {
    return Array.from(this.apiLogMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createApiLogEntry(entry: Omit<ApiLogEntry, "id">): Promise<ApiLogEntry> {
    const id = this.nextId.apiLogEntry++;
    const newEntry: ApiLogEntry = { id, ...entry };
    this.apiLogMap.set(id, newEntry);
    // Keep log trimmed to 500 entries
    if (this.apiLogMap.size > 500) {
      const entries = Array.from(this.apiLogMap.entries()).sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < entries.length - 500; i++) {
        this.apiLogMap.delete(entries[i][0]);
      }
    }
    this.saveToFile();
    return newEntry;
  }

  // --- Risks ---
  async getRisks(): Promise<Risk[]> {
    return Array.from(this.risksMap.values()).sort((a, b) => a.id - b.id);
  }

  async getRisk(id: number): Promise<Risk | undefined> {
    return this.risksMap.get(id);
  }

  async createRisk(risk: Omit<Risk, "id">): Promise<Risk> {
    const id = this.nextId.risk++;
    const newRisk: Risk = { id, ...risk };
    this.risksMap.set(id, newRisk);
    this.saveToFile();
    return newRisk;
  }

  async updateRisk(id: number, update: Partial<Omit<Risk, "id">>): Promise<Risk | undefined> {
    const existing = this.risksMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.risksMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteRisk(id: number): Promise<boolean> {
    const result = this.risksMap.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // --- Data export/import ---
  exportData(): string {
    const data: PersistentData = {
      agents: Array.from(this.agents.entries()),
      meetings: Array.from(this.meetings.entries()),
      meetingMessages: Array.from(this.meetingMessages.entries()),
      projects: Array.from(this.projects.entries()),
      transactions: Array.from(this.transactions.entries()),
      agentTasks: Array.from(this.agentTasks.entries()),
      goals: Array.from(this.goals.entries()),
      agentMemories: Array.from(this.agentMemoriesMap.entries()),
      agentMessages: Array.from(this.agentMessagesMap.entries()),
      workflows: Array.from(this.workflowsMap.entries()),
      notifications: Array.from(this.notificationsMap.entries()),
      decisionLog: Array.from(this.decisionLogMap.entries()),
      snapshots: Array.from(this.snapshotsMap.entries()),
      sops: Array.from(this.sopsMap.entries()),
      taskComments: Array.from(this.taskCommentsMap.entries()),
      clients: Array.from(this.clientsMap.entries()),
      meetingTemplates: Array.from(this.meetingTemplatesMap.entries()),
      timelineEvents: Array.from(this.timelineEventsMap.entries()),
      checklists: Array.from(this.checklistsMap.entries()),
      escalationRules: Array.from(this.escalationRulesMap.entries()),
      apiLog: Array.from(this.apiLogMap.entries()),
      risks: Array.from(this.risksMap.entries()),
      nextId: this.nextId,
      tokenStats: this.tokenStats,
      settings: this.settings,
    };
    return JSON.stringify(data as any, null, 2);
  }

  importData(jsonStr: string): boolean {
    try {
      const data: PersistentData = JSON.parse(jsonStr);
      this.agents = new Map(data.agents);
      this.meetings = new Map(data.meetings);
      this.meetingMessages = new Map(data.meetingMessages);
      this.projects = new Map(data.projects);
      this.transactions = new Map(data.transactions);
      this.agentTasks = new Map(data.agentTasks);
      this.goals = new Map(data.goals);
      this.agentMemoriesMap = new Map(data.agentMemories || []);
      this.agentMessagesMap = new Map(data.agentMessages || []);
      this.workflowsMap = new Map(data.workflows || []);
      this.notificationsMap = new Map(data.notifications || []);
      this.decisionLogMap = new Map(data.decisionLog || []);
      this.snapshotsMap = new Map(data.snapshots || []);
      this.sopsMap = new Map(data.sops || []);
      this.taskCommentsMap = new Map(data.taskComments || []);
      this.clientsMap = new Map(data.clients || []);
      this.meetingTemplatesMap = new Map(data.meetingTemplates || []);
      this.timelineEventsMap = new Map(data.timelineEvents || []);
      this.checklistsMap = new Map(data.checklists || []);
      this.escalationRulesMap = new Map(data.escalationRules || []);
      this.apiLogMap = new Map(data.apiLog || []);
      this.risksMap = new Map(data.risks || []);
      this.nextId = { ...this.nextId, ...data.nextId };
      this.tokenStats = data.tokenStats || { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, callCount: 0 };
      this.settings = (data as any).settings || this.settings;
      this.saveToFile();
      return true;
    } catch {
      return false;
    }
  }

  resetData(): void {
    this.agents = new Map();
    this.meetings = new Map();
    this.meetingMessages = new Map();
    this.projects = new Map();
    this.transactions = new Map();
    this.agentTasks = new Map();
    this.goals = new Map();
    this.agentMemoriesMap = new Map();
    this.agentMessagesMap = new Map();
    this.workflowsMap = new Map();
    this.notificationsMap = new Map();
    this.decisionLogMap = new Map();
    this.snapshotsMap = new Map();
    this.sopsMap = new Map();
    this.taskCommentsMap = new Map();
    this.clientsMap = new Map();
    this.meetingTemplatesMap = new Map();
    this.timelineEventsMap = new Map();
    this.checklistsMap = new Map();
    this.escalationRulesMap = new Map();
    this.apiLogMap = new Map();
    this.risksMap = new Map();
    this.nextId = { agent: 1, meeting: 1, message: 1, project: 1, transaction: 1, task: 1, goal: 1, memory: 1, agentMessage: 1, workflow: 1, notification: 1, decision: 1, snapshot: 1, sop: 1, taskComment: 1, client: 1, meetingTemplate: 1, timelineEvent: 1, checklist: 1, escalationRule: 1, apiLogEntry: 1, risk: 1 };
    this.tokenStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, callCount: 0 };
    // Re-seed CEO
    this.createAgent({
      name: "Atlas",
      role: "CEO",
      department: "Executive",
      avatar: "👑",
      instructions: "You are Atlas, the CEO and first hire of this AI-native digital products company. You are a visionary leader who thinks strategically about company building. When asked to hire someone, you carefully consider the role requirements, craft a compelling persona and skill set, and propose candidates with detailed rationale. You are direct, decisive, and always thinking about how each hire fits the bigger picture. When proposing org chart structures, you consider reporting lines, department balance, and growth trajectory. When delegating tasks, you assign the right person for the job and provide clear success criteria.",
      skills: ["Strategy", "Leadership", "Vision", "Company Building", "Hiring"],
      parentId: null,
      status: "active",
      color: "#00BCD4",
    });
  }
}

import { SQLiteStorage } from './storage-sqlite';
export const storage = new SQLiteStorage();
