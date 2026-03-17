import db from './db';
import { createTables } from './db-schema';
import type {
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
import type { IStorage } from './storage';

// Initialize tables on import
createTables();

// Helper: convert snake_case row to camelCase entity
function rowToAgent(r: any): Agent {
  return { id: r.id, name: r.name, role: r.role, department: r.department, avatar: r.avatar, instructions: r.instructions, skills: r.skills ? JSON.parse(r.skills) : null, parentId: r.parent_id, status: r.status, color: r.color, model: r.model, autonomyLevel: r.autonomy_level };
}

function rowToMeeting(r: any): Meeting {
  return { id: r.id, title: r.title, topic: r.topic, status: r.status, agentIds: JSON.parse(r.agent_ids), createdAt: r.created_at };
}

function rowToMeetingMessage(r: any): MeetingMessage {
  return { id: r.id, meetingId: r.meeting_id, agentId: r.agent_id, senderName: r.sender_name, senderRole: r.sender_role, content: r.content, timestamp: r.timestamp };
}

function rowToProject(r: any): Project {
  return { id: r.id, title: r.title, description: r.description, status: r.status, assignedAgentId: r.assigned_agent_id, meetingId: r.meeting_id, goalId: r.goal_id, priority: r.priority, progress: r.progress, totalTasks: r.total_tasks, completedTasks: r.completed_tasks, createdAt: r.created_at };
}

function rowToTransaction(r: any): Transaction {
  return { id: r.id, type: r.type, category: r.category, description: r.description, amount: r.amount, date: r.date, agentId: r.agent_id };
}

function rowToAgentTask(r: any): AgentTask {
  return { id: r.id, title: r.title, description: r.description, assignedAgentId: r.assigned_agent_id, status: r.status, type: r.type, proposal: r.proposal, proposedActions: r.proposed_actions, executionLog: r.execution_log, projectId: r.project_id, meetingId: r.meeting_id, parentTaskId: r.parent_task_id, dependsOn: r.depends_on, deliverables: r.deliverables, collaborators: r.collaborators, discussionThread: r.discussion_thread, workflowStage: r.workflow_stage, priority: r.priority, createdAt: r.created_at, completedAt: r.completed_at };
}

function rowToGoal(r: any): Goal {
  return { id: r.id, title: r.title, description: r.description, type: r.type, parentGoalId: r.parent_goal_id, ownerId: r.owner_id, progress: r.progress, status: r.status, quarter: r.quarter, createdAt: r.created_at };
}

function rowToAgentMemory(r: any): AgentMemory {
  return { id: r.id, agentId: r.agent_id, type: r.type, content: r.content, source: r.source, createdAt: r.created_at, importance: r.importance };
}

function rowToAgentMessage(r: any): AgentMessage {
  return { id: r.id, fromAgentId: r.from_agent_id, toAgentId: r.to_agent_id, content: r.content, type: r.type, relatedTaskId: r.related_task_id, read: !!r.read, createdAt: r.created_at };
}

function rowToWorkflow(r: any): Workflow {
  return { id: r.id, name: r.name, description: r.description, steps: JSON.parse(r.steps), createdAt: r.created_at };
}

function rowToNotification(r: any): Notification {
  return { id: r.id, type: r.type, title: r.title, message: r.message, link: r.link, read: !!r.read, createdAt: r.created_at, priority: r.priority };
}

function rowToDecisionLogEntry(r: any): DecisionLogEntry {
  return { id: r.id, type: r.type, description: r.description, madeBy: r.made_by, relatedId: r.related_id, timestamp: r.timestamp, impact: r.impact };
}

function rowToSnapshot(r: any): CompanySnapshot {
  return { id: r.id, name: r.name, timestamp: r.timestamp, data: JSON.parse(r.data) };
}

function rowToSOP(r: any): SOP {
  return { id: r.id, title: r.title, category: r.category, steps: JSON.parse(r.steps), department: r.department, createdAt: r.created_at, updatedAt: r.updated_at };
}

function rowToTaskComment(r: any): TaskComment {
  return { id: r.id, taskId: r.task_id, authorType: r.author_type, authorId: r.author_id, authorName: r.author_name, content: r.content, createdAt: r.created_at };
}

function rowToClient(r: any): Client {
  return { id: r.id, name: r.name, type: r.type, contact: r.contact, status: r.status, projects: JSON.parse(r.projects), createdAt: r.created_at };
}

function rowToMeetingTemplate(r: any): MeetingTemplate {
  return { id: r.id, name: r.name, agenda: r.agenda, suggestedSpeakers: JSON.parse(r.suggested_speakers), duration: r.duration, type: r.type };
}

function rowToTimelineEvent(r: any): TimelineEvent {
  return { id: r.id, type: r.type, title: r.title, description: r.description, agentId: r.agent_id, department: r.department, timestamp: r.timestamp };
}

function rowToChecklist(r: any): Checklist {
  return { id: r.id, name: r.name, items: JSON.parse(r.items), parentType: r.parent_type, parentId: r.parent_id, createdAt: r.created_at };
}

function rowToEscalationRule(r: any): EscalationRule {
  return { id: r.id, name: r.name, triggerHours: r.trigger_hours, action: r.action, enabled: !!r.enabled, createdAt: r.created_at };
}

function rowToApiLogEntry(r: any): ApiLogEntry {
  return { id: r.id, method: r.method, path: r.path, body: r.body, timestamp: r.timestamp, statusCode: r.status_code };
}

function rowToRisk(r: any): Risk {
  return { id: r.id, title: r.title, description: r.description, probability: r.probability, impact: r.impact, mitigations: r.mitigations, ownerId: r.owner_id, status: r.status, projectId: r.project_id, createdAt: r.created_at };
}

export class SQLiteStorage implements IStorage {

  // --- Agents ---
  async getAgents(): Promise<Agent[]> {
    return db.prepare('SELECT * FROM agents').all().map(rowToAgent);
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const r = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    return r ? rowToAgent(r) : undefined;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const stmt = db.prepare('INSERT INTO agents (name, role, department, avatar, instructions, skills, parent_id, status, color, model, autonomy_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(agent.name, agent.role, agent.department, agent.avatar ?? null, agent.instructions ?? '', agent.skills ? JSON.stringify(agent.skills) : null, agent.parentId ?? null, agent.status ?? 'active', agent.color ?? '#4F98A3', agent.model ?? null, (agent as any).autonomyLevel ?? 'manual');
    return (await this.getAgent(Number(info.lastInsertRowid)))!;
  }

  async updateAgent(id: number, update: Partial<InsertAgent>): Promise<Agent | undefined> {
    const existing = await this.getAgent(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE agents SET name=?, role=?, department=?, avatar=?, instructions=?, skills=?, parent_id=?, status=?, color=?, model=?, autonomy_level=? WHERE id=?').run(
      merged.name, merged.role, merged.department, merged.avatar, merged.instructions, merged.skills ? JSON.stringify(merged.skills) : null, merged.parentId, merged.status, merged.color, merged.model, merged.autonomyLevel, id
    );
    return this.getAgent(id);
  }

  async deleteAgent(id: number): Promise<boolean> {
    const info = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return info.changes > 0;
  }

  // --- Meetings ---
  async getMeetings(): Promise<Meeting[]> {
    return db.prepare('SELECT * FROM meetings').all().map(rowToMeeting);
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const r = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    return r ? rowToMeeting(r) : undefined;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const info = db.prepare('INSERT INTO meetings (title, topic, status, agent_ids, created_at) VALUES (?, ?, ?, ?, ?)').run(
      meeting.title, meeting.topic, meeting.status ?? 'active', JSON.stringify(meeting.agentIds), meeting.createdAt
    );
    return (await this.getMeeting(Number(info.lastInsertRowid)))!;
  }

  async updateMeeting(id: number, update: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const existing = await this.getMeeting(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE meetings SET title=?, topic=?, status=?, agent_ids=?, created_at=? WHERE id=?').run(
      merged.title, merged.topic, merged.status, JSON.stringify(merged.agentIds), merged.createdAt, id
    );
    return this.getMeeting(id);
  }

  // --- Meeting Messages ---
  async getMeetingMessages(meetingId: number): Promise<MeetingMessage[]> {
    return db.prepare('SELECT * FROM meeting_messages WHERE meeting_id = ?').all(meetingId).map(rowToMeetingMessage);
  }

  async createMeetingMessage(message: InsertMeetingMessage): Promise<MeetingMessage> {
    const info = db.prepare('INSERT INTO meeting_messages (meeting_id, agent_id, sender_name, sender_role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(
      message.meetingId, message.agentId ?? null, message.senderName, message.senderRole, message.content, message.timestamp
    );
    const r = db.prepare('SELECT * FROM meeting_messages WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToMeetingMessage(r);
  }

  // --- Projects ---
  async getProjects(): Promise<Project[]> {
    return db.prepare('SELECT * FROM projects').all().map(rowToProject);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return r ? rowToProject(r) : undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    // Deduplication guard: reject projects with identical title created within the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const duplicate = db.prepare(
      `SELECT id FROM projects WHERE title = ? AND created_at > ? AND status NOT IN ('cancelled') LIMIT 1`
    ).get(project.title, fiveMinAgo) as any;
    if (duplicate) {
      console.log(`[dedup] Blocked duplicate project: "${project.title}" — matches existing project #${duplicate.id}`);
      return (await this.getProject(duplicate.id))!;
    }

    const info = db.prepare('INSERT INTO projects (title, description, status, assigned_agent_id, meeting_id, goal_id, priority, progress, total_tasks, completed_tasks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      project.title, project.description ?? '', project.status ?? 'backlog', project.assignedAgentId ?? null, project.meetingId ?? null, project.goalId ?? null, project.priority ?? 'medium', project.progress ?? 0, project.totalTasks ?? 0, project.completedTasks ?? 0, project.createdAt
    );
    return (await this.getProject(Number(info.lastInsertRowid)))!;
  }

  async updateProject(id: number, update: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = await this.getProject(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE projects SET title=?, description=?, status=?, assigned_agent_id=?, meeting_id=?, goal_id=?, priority=?, progress=?, total_tasks=?, completed_tasks=?, created_at=? WHERE id=?').run(
      merged.title, merged.description, merged.status, merged.assignedAgentId, merged.meetingId, merged.goalId, merged.priority, merged.progress, merged.totalTasks, merged.completedTasks, merged.createdAt, id
    );
    return this.getProject(id);
  }

  async deleteProject(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
  }

  // --- Transactions ---
  async getTransactions(): Promise<Transaction[]> {
    return db.prepare('SELECT * FROM transactions').all().map(rowToTransaction);
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const info = db.prepare('INSERT INTO transactions (type, category, description, amount, date, agent_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      tx.type, tx.category, tx.description, tx.amount, tx.date, tx.agentId ?? null
    );
    const r = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToTransaction(r);
  }

  async deleteTransaction(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM transactions WHERE id = ?').run(id).changes > 0;
  }

  // --- Agent Tasks ---
  async getAgentTasks(): Promise<AgentTask[]> {
    return db.prepare('SELECT * FROM agent_tasks').all().map(rowToAgentTask);
  }

  async getAgentTask(id: number): Promise<AgentTask | undefined> {
    const r = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id);
    return r ? rowToAgentTask(r) : undefined;
  }

  async getTask(id: number): Promise<AgentTask | undefined> {
    return this.getAgentTask(id);
  }

  async getAgentTasksByParent(parentTaskId: number): Promise<AgentTask[]> {
    return db.prepare('SELECT * FROM agent_tasks WHERE parent_task_id = ?').all(parentTaskId).map(rowToAgentTask);
  }

  async getAgentTasksByAgent(agentId: number): Promise<AgentTask[]> {
    return db.prepare('SELECT * FROM agent_tasks WHERE assigned_agent_id = ?').all(agentId).map(rowToAgentTask);
  }

  async getAgentTasksByProject(projectId: number): Promise<AgentTask[]> {
    return db.prepare('SELECT * FROM agent_tasks WHERE project_id = ?').all(projectId).map(rowToAgentTask);
  }

  async createAgentTask(task: InsertAgentTask): Promise<AgentTask> {
    // Deduplication guard: reject tasks with identical title + agent created within the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const duplicate = db.prepare(
      `SELECT id FROM agent_tasks WHERE title = ? AND assigned_agent_id = ? AND created_at > ? AND status NOT IN ('rejected', 'cancelled') LIMIT 1`
    ).get(task.title, task.assignedAgentId, fiveMinAgo) as any;
    if (duplicate) {
      console.log(`[dedup] Blocked duplicate task: "${task.title}" (agent ${task.assignedAgentId}) — matches existing task #${duplicate.id}`);
      return (await this.getAgentTask(duplicate.id))!;
    }

    const info = db.prepare('INSERT INTO agent_tasks (title, description, assigned_agent_id, status, type, proposal, proposed_actions, execution_log, project_id, meeting_id, parent_task_id, depends_on, deliverables, collaborators, discussion_thread, workflow_stage, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      task.title, task.description, task.assignedAgentId, task.status ?? 'pending', task.type ?? 'general',
      task.proposal ?? null, task.proposedActions ?? null, task.executionLog ?? null,
      task.projectId ?? null, task.meetingId ?? null, task.parentTaskId ?? null,
      task.dependsOn ?? null, task.deliverables ?? null, task.collaborators ?? null,
      task.discussionThread ?? null, task.workflowStage ?? null, task.priority ?? 'medium',
      task.createdAt, task.completedAt ?? null
    );
    return (await this.getAgentTask(Number(info.lastInsertRowid)))!;
  }

  async updateAgentTask(id: number, update: Partial<InsertAgentTask>): Promise<AgentTask | undefined> {
    const existing = await this.getAgentTask(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE agent_tasks SET title=?, description=?, assigned_agent_id=?, status=?, type=?, proposal=?, proposed_actions=?, execution_log=?, project_id=?, meeting_id=?, parent_task_id=?, depends_on=?, deliverables=?, collaborators=?, discussion_thread=?, workflow_stage=?, priority=?, created_at=?, completed_at=? WHERE id=?').run(
      merged.title, merged.description, merged.assignedAgentId, merged.status, merged.type,
      merged.proposal, merged.proposedActions, merged.executionLog,
      merged.projectId, merged.meetingId, merged.parentTaskId,
      merged.dependsOn, merged.deliverables, merged.collaborators,
      merged.discussionThread, merged.workflowStage, merged.priority,
      merged.createdAt, merged.completedAt, id
    );
    return this.getAgentTask(id);
  }

  async deleteAgentTask(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM agent_tasks WHERE id = ?').run(id).changes > 0;
  }

  // --- Goals / OKRs ---
  async getGoals(): Promise<Goal[]> {
    return db.prepare('SELECT * FROM goals').all().map(rowToGoal);
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const r = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    return r ? rowToGoal(r) : undefined;
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const info = db.prepare('INSERT INTO goals (title, description, type, parent_goal_id, owner_id, progress, status, quarter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      goal.title, goal.description ?? '', goal.type ?? 'objective', goal.parentGoalId ?? null, goal.ownerId ?? null, goal.progress ?? 0, goal.status ?? 'active', goal.quarter ?? null, goal.createdAt
    );
    return (await this.getGoal(Number(info.lastInsertRowid)))!;
  }

  async updateGoal(id: number, update: Partial<InsertGoal>): Promise<Goal | undefined> {
    const existing = await this.getGoal(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE goals SET title=?, description=?, type=?, parent_goal_id=?, owner_id=?, progress=?, status=?, quarter=?, created_at=? WHERE id=?').run(
      merged.title, merged.description, merged.type, merged.parentGoalId, merged.ownerId, merged.progress, merged.status, merged.quarter, merged.createdAt, id
    );
    return this.getGoal(id);
  }

  async deleteGoal(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0;
  }

  // --- Agent Memories ---
  async getAgentMemories(agentId: number): Promise<AgentMemory[]> {
    return db.prepare('SELECT * FROM agent_memories WHERE agent_id = ?').all(agentId).map(rowToAgentMemory);
  }

  async createAgentMemory(memory: Omit<AgentMemory, "id">): Promise<AgentMemory> {
    const info = db.prepare('INSERT INTO agent_memories (agent_id, type, content, source, created_at, importance) VALUES (?, ?, ?, ?, ?, ?)').run(
      memory.agentId, memory.type, memory.content, memory.source ?? null, memory.createdAt, memory.importance
    );
    const r = db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToAgentMemory(r);
  }

  // --- Agent Messages ---
  async getAgentMessages(agentId: number): Promise<AgentMessage[]> {
    return db.prepare('SELECT * FROM agent_messages WHERE from_agent_id = ? OR to_agent_id = ?').all(agentId, agentId).map(rowToAgentMessage);
  }

  async createAgentMessage(message: Omit<AgentMessage, "id">): Promise<AgentMessage> {
    const info = db.prepare('INSERT INTO agent_messages (from_agent_id, to_agent_id, content, type, related_task_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      message.fromAgentId, message.toAgentId, message.content, message.type, message.relatedTaskId ?? null, message.read ? 1 : 0, message.createdAt
    );
    const r = db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToAgentMessage(r);
  }

  async updateAgentMessage(id: number, update: Partial<AgentMessage>): Promise<AgentMessage | undefined> {
    const existing = db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(id);
    if (!existing) return undefined;
    const current = rowToAgentMessage(existing);
    const merged = { ...current, ...update };
    db.prepare('UPDATE agent_messages SET from_agent_id=?, to_agent_id=?, content=?, type=?, related_task_id=?, read=?, created_at=? WHERE id=?').run(
      merged.fromAgentId, merged.toAgentId, merged.content, merged.type, merged.relatedTaskId, merged.read ? 1 : 0, merged.createdAt, id
    );
    const r = db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(id);
    return r ? rowToAgentMessage(r) : undefined;
  }

  // --- Workflows ---
  async getWorkflows(): Promise<Workflow[]> {
    return db.prepare('SELECT * FROM workflows').all().map(rowToWorkflow);
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const r = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    return r ? rowToWorkflow(r) : undefined;
  }

  async createWorkflow(workflow: Omit<Workflow, "id">): Promise<Workflow> {
    const info = db.prepare('INSERT INTO workflows (name, description, steps, created_at) VALUES (?, ?, ?, ?)').run(
      workflow.name, workflow.description, JSON.stringify(workflow.steps), workflow.createdAt
    );
    return (await this.getWorkflow(Number(info.lastInsertRowid)))!;
  }

  async updateWorkflow(id: number, update: Partial<Omit<Workflow, "id">>): Promise<Workflow | undefined> {
    const existing = await this.getWorkflow(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE workflows SET name=?, description=?, steps=?, created_at=? WHERE id=?').run(
      merged.name, merged.description, JSON.stringify(merged.steps), merged.createdAt, id
    );
    return this.getWorkflow(id);
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM workflows WHERE id = ?').run(id).changes > 0;
  }

  // --- Notifications ---
  async getNotifications(): Promise<Notification[]> {
    return db.prepare('SELECT * FROM notifications ORDER BY id DESC').all().map(rowToNotification);
  }

  async createNotification(notification: Omit<Notification, "id">): Promise<Notification> {
    const info = db.prepare('INSERT INTO notifications (type, title, message, link, read, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      notification.type, notification.title, notification.message, notification.link, notification.read ? 1 : 0, notification.createdAt, notification.priority
    );
    const r = db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToNotification(r);
  }

  async updateNotification(id: number, update: Partial<Notification>): Promise<Notification | undefined> {
    const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    if (!existing) return undefined;
    const current = rowToNotification(existing);
    const merged = { ...current, ...update };
    db.prepare('UPDATE notifications SET type=?, title=?, message=?, link=?, read=?, created_at=?, priority=? WHERE id=?').run(
      merged.type, merged.title, merged.message, merged.link, merged.read ? 1 : 0, merged.createdAt, merged.priority, id
    );
    const r = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    return r ? rowToNotification(r) : undefined;
  }

  async clearNotifications(): Promise<void> {
    db.prepare('DELETE FROM notifications').run();
  }

  // --- Decision Log ---
  async getDecisionLog(): Promise<DecisionLogEntry[]> {
    return db.prepare('SELECT * FROM decision_log ORDER BY id DESC').all().map(rowToDecisionLogEntry);
  }

  async createDecisionLogEntry(entry: Omit<DecisionLogEntry, "id">): Promise<DecisionLogEntry> {
    const info = db.prepare('INSERT INTO decision_log (type, description, made_by, related_id, timestamp, impact) VALUES (?, ?, ?, ?, ?, ?)').run(
      entry.type, entry.description, entry.madeBy, entry.relatedId ?? null, entry.timestamp, entry.impact
    );
    const r = db.prepare('SELECT * FROM decision_log WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToDecisionLogEntry(r);
  }

  // --- Snapshots ---
  async getSnapshots(): Promise<CompanySnapshot[]> {
    return db.prepare('SELECT * FROM snapshots ORDER BY id DESC').all().map(rowToSnapshot);
  }

  async createSnapshot(snapshot: Omit<CompanySnapshot, "id">): Promise<CompanySnapshot> {
    const info = db.prepare('INSERT INTO snapshots (name, timestamp, data) VALUES (?, ?, ?)').run(
      snapshot.name, snapshot.timestamp, JSON.stringify(snapshot.data)
    );
    const r = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToSnapshot(r);
  }

  // --- SOPs ---
  async getSOPs(): Promise<SOP[]> {
    return db.prepare('SELECT * FROM sops').all().map(rowToSOP);
  }

  async getSOP(id: number): Promise<SOP | undefined> {
    const r = db.prepare('SELECT * FROM sops WHERE id = ?').get(id);
    return r ? rowToSOP(r) : undefined;
  }

  async createSOP(sop: Omit<SOP, "id">): Promise<SOP> {
    const info = db.prepare('INSERT INTO sops (title, category, steps, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      sop.title, sop.category, JSON.stringify(sop.steps), sop.department, sop.createdAt, sop.updatedAt
    );
    return (await this.getSOP(Number(info.lastInsertRowid)))!;
  }

  async updateSOP(id: number, update: Partial<Omit<SOP, "id">>): Promise<SOP | undefined> {
    const existing = await this.getSOP(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE sops SET title=?, category=?, steps=?, department=?, created_at=?, updated_at=? WHERE id=?').run(
      merged.title, merged.category, JSON.stringify(merged.steps), merged.department, merged.createdAt, merged.updatedAt, id
    );
    return this.getSOP(id);
  }

  async deleteSOP(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM sops WHERE id = ?').run(id).changes > 0;
  }

  // --- Task Comments ---
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return db.prepare('SELECT * FROM task_comments WHERE task_id = ?').all(taskId).map(rowToTaskComment);
  }

  async createTaskComment(comment: Omit<TaskComment, "id">): Promise<TaskComment> {
    const info = db.prepare('INSERT INTO task_comments (task_id, author_type, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      comment.taskId, comment.authorType, comment.authorId ?? null, comment.authorName, comment.content, comment.createdAt
    );
    const r = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToTaskComment(r);
  }

  // --- Clients ---
  async getClients(): Promise<Client[]> {
    return db.prepare('SELECT * FROM clients').all().map(rowToClient);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const r = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    return r ? rowToClient(r) : undefined;
  }

  async createClient(client: Omit<Client, "id">): Promise<Client> {
    const info = db.prepare('INSERT INTO clients (name, type, contact, status, projects, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      client.name, client.type, client.contact, client.status, JSON.stringify(client.projects), client.createdAt
    );
    return (await this.getClient(Number(info.lastInsertRowid)))!;
  }

  async updateClient(id: number, update: Partial<Omit<Client, "id">>): Promise<Client | undefined> {
    const existing = await this.getClient(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE clients SET name=?, type=?, contact=?, status=?, projects=?, created_at=? WHERE id=?').run(
      merged.name, merged.type, merged.contact, merged.status, JSON.stringify(merged.projects), merged.createdAt, id
    );
    return this.getClient(id);
  }

  async deleteClient(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM clients WHERE id = ?').run(id).changes > 0;
  }

  // --- Meeting Templates ---
  async getMeetingTemplates(): Promise<MeetingTemplate[]> {
    return db.prepare('SELECT * FROM meeting_templates').all().map(rowToMeetingTemplate);
  }

  async createMeetingTemplate(template: Omit<MeetingTemplate, "id">): Promise<MeetingTemplate> {
    const info = db.prepare('INSERT INTO meeting_templates (name, agenda, suggested_speakers, duration, type) VALUES (?, ?, ?, ?, ?)').run(
      template.name, template.agenda, JSON.stringify(template.suggestedSpeakers), template.duration, template.type
    );
    const r = db.prepare('SELECT * FROM meeting_templates WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToMeetingTemplate(r);
  }

  // --- Timeline Events ---
  async getTimelineEvents(): Promise<TimelineEvent[]> {
    return db.prepare('SELECT * FROM timeline_events ORDER BY id DESC').all().map(rowToTimelineEvent);
  }

  async createTimelineEvent(event: Omit<TimelineEvent, "id">): Promise<TimelineEvent> {
    const info = db.prepare('INSERT INTO timeline_events (type, title, description, agent_id, department, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(
      event.type, event.title, event.description, event.agentId ?? null, event.department ?? null, event.timestamp
    );
    const r = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToTimelineEvent(r);
  }

  // --- Checklists ---
  async getChecklists(): Promise<Checklist[]> {
    return db.prepare('SELECT * FROM checklists').all().map(rowToChecklist);
  }

  async getChecklistsByParent(parentType: string, parentId: number): Promise<Checklist[]> {
    return db.prepare('SELECT * FROM checklists WHERE parent_type = ? AND parent_id = ?').all(parentType, parentId).map(rowToChecklist);
  }

  async createChecklist(checklist: Omit<Checklist, "id">): Promise<Checklist> {
    const info = db.prepare('INSERT INTO checklists (name, items, parent_type, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
      checklist.name, JSON.stringify(checklist.items), checklist.parentType, checklist.parentId, checklist.createdAt
    );
    const r = db.prepare('SELECT * FROM checklists WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToChecklist(r);
  }

  async updateChecklist(id: number, update: Partial<Omit<Checklist, "id">>): Promise<Checklist | undefined> {
    const existing = db.prepare('SELECT * FROM checklists WHERE id = ?').get(id);
    if (!existing) return undefined;
    const current = rowToChecklist(existing);
    const merged = { ...current, ...update };
    db.prepare('UPDATE checklists SET name=?, items=?, parent_type=?, parent_id=?, created_at=? WHERE id=?').run(
      merged.name, JSON.stringify(merged.items), merged.parentType, merged.parentId, merged.createdAt, id
    );
    const r = db.prepare('SELECT * FROM checklists WHERE id = ?').get(id);
    return r ? rowToChecklist(r) : undefined;
  }

  async deleteChecklist(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM checklists WHERE id = ?').run(id).changes > 0;
  }

  // --- Escalation Rules ---
  async getEscalationRules(): Promise<EscalationRule[]> {
    return db.prepare('SELECT * FROM escalation_rules').all().map(rowToEscalationRule);
  }

  async createEscalationRule(rule: Omit<EscalationRule, "id">): Promise<EscalationRule> {
    const info = db.prepare('INSERT INTO escalation_rules (name, trigger_hours, action, enabled, created_at) VALUES (?, ?, ?, ?, ?)').run(
      rule.name, rule.triggerHours, rule.action, rule.enabled ? 1 : 0, rule.createdAt
    );
    const r = db.prepare('SELECT * FROM escalation_rules WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToEscalationRule(r);
  }

  async updateEscalationRule(id: number, update: Partial<Omit<EscalationRule, "id">>): Promise<EscalationRule | undefined> {
    const existing = db.prepare('SELECT * FROM escalation_rules WHERE id = ?').get(id);
    if (!existing) return undefined;
    const current = rowToEscalationRule(existing);
    const merged = { ...current, ...update };
    db.prepare('UPDATE escalation_rules SET name=?, trigger_hours=?, action=?, enabled=?, created_at=? WHERE id=?').run(
      merged.name, merged.triggerHours, merged.action, merged.enabled ? 1 : 0, merged.createdAt, id
    );
    const r = db.prepare('SELECT * FROM escalation_rules WHERE id = ?').get(id);
    return r ? rowToEscalationRule(r) : undefined;
  }

  async deleteEscalationRule(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM escalation_rules WHERE id = ?').run(id).changes > 0;
  }

  // --- API Activity Log ---
  async getApiLog(): Promise<ApiLogEntry[]> {
    return db.prepare('SELECT * FROM api_log ORDER BY id DESC LIMIT 1000').all().map(rowToApiLogEntry);
  }

  async createApiLogEntry(entry: Omit<ApiLogEntry, "id">): Promise<ApiLogEntry> {
    const info = db.prepare('INSERT INTO api_log (method, path, body, timestamp, status_code) VALUES (?, ?, ?, ?, ?)').run(
      entry.method, entry.path, entry.body ?? null, entry.timestamp, entry.statusCode
    );
    const r = db.prepare('SELECT * FROM api_log WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToApiLogEntry(r);
  }

  // --- Risks ---
  async getRisks(): Promise<Risk[]> {
    return db.prepare('SELECT * FROM risks').all().map(rowToRisk);
  }

  async getRisk(id: number): Promise<Risk | undefined> {
    const r = db.prepare('SELECT * FROM risks WHERE id = ?').get(id);
    return r ? rowToRisk(r) : undefined;
  }

  async createRisk(risk: Omit<Risk, "id">): Promise<Risk> {
    const info = db.prepare('INSERT INTO risks (title, description, probability, impact, mitigations, owner_id, status, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      risk.title, risk.description, risk.probability, risk.impact, risk.mitigations, risk.ownerId ?? null, risk.status, risk.projectId ?? null, risk.createdAt
    );
    return (await this.getRisk(Number(info.lastInsertRowid)))!;
  }

  async updateRisk(id: number, update: Partial<Omit<Risk, "id">>): Promise<Risk | undefined> {
    const existing = await this.getRisk(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE risks SET title=?, description=?, probability=?, impact=?, mitigations=?, owner_id=?, status=?, project_id=?, created_at=? WHERE id=?').run(
      merged.title, merged.description, merged.probability, merged.impact, merged.mitigations, merged.ownerId, merged.status, merged.projectId, merged.createdAt, id
    );
    return this.getRisk(id);
  }

  async deleteRisk(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM risks WHERE id = ?').run(id).changes > 0;
  }

  // --- Token Stats ---
  async getTokenStats() {
    const r = db.prepare('SELECT * FROM token_stats WHERE id = 1').get() as any;
    return {
      totalInputTokens: r?.total_input_tokens ?? 0,
      totalOutputTokens: r?.total_output_tokens ?? 0,
      totalCostCents: r?.total_cost_cents ?? 0,
      callCount: r?.call_count ?? 0,
    };
  }

  recordTokenUsage(inputTokens: number, outputTokens: number, costCents: number) {
    db.prepare('UPDATE token_stats SET total_input_tokens = total_input_tokens + ?, total_output_tokens = total_output_tokens + ?, total_cost_cents = total_cost_cents + ?, call_count = call_count + 1 WHERE id = 1').run(inputTokens, outputTokens, costCents);
  }

  // --- Settings ---
  async getSettings(): Promise<Record<string, any>> {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
    }
    return result;
  }

  async updateSettings(update: Record<string, any>): Promise<Record<string, any>> {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(update)) {
        upsert.run(key, JSON.stringify(value));
      }
    });
    transaction();
    return this.getSettings();
  }

  // --- Data export/import (compatibility with FileStorage) ---
  exportData(): string {
    const data: any = {
      agents: (db.prepare('SELECT * FROM agents').all()).map(r => [rowToAgent(r).id, rowToAgent(r)]),
      meetings: (db.prepare('SELECT * FROM meetings').all()).map(r => [rowToMeeting(r).id, rowToMeeting(r)]),
      meetingMessages: (db.prepare('SELECT * FROM meeting_messages').all()).map(r => [rowToMeetingMessage(r).id, rowToMeetingMessage(r)]),
      projects: (db.prepare('SELECT * FROM projects').all()).map(r => [rowToProject(r).id, rowToProject(r)]),
      transactions: (db.prepare('SELECT * FROM transactions').all()).map(r => [rowToTransaction(r).id, rowToTransaction(r)]),
      agentTasks: (db.prepare('SELECT * FROM agent_tasks').all()).map(r => [rowToAgentTask(r).id, rowToAgentTask(r)]),
      goals: (db.prepare('SELECT * FROM goals').all()).map(r => [rowToGoal(r).id, rowToGoal(r)]),
      agentMemories: (db.prepare('SELECT * FROM agent_memories').all()).map(r => [rowToAgentMemory(r).id, rowToAgentMemory(r)]),
      agentMessages: (db.prepare('SELECT * FROM agent_messages').all()).map(r => [rowToAgentMessage(r).id, rowToAgentMessage(r)]),
      workflows: (db.prepare('SELECT * FROM workflows').all()).map(r => [rowToWorkflow(r).id, rowToWorkflow(r)]),
      notifications: (db.prepare('SELECT * FROM notifications').all()).map(r => [rowToNotification(r).id, rowToNotification(r)]),
      decisionLog: (db.prepare('SELECT * FROM decision_log').all()).map(r => [rowToDecisionLogEntry(r).id, rowToDecisionLogEntry(r)]),
      snapshots: (db.prepare('SELECT * FROM snapshots').all()).map(r => [rowToSnapshot(r).id, rowToSnapshot(r)]),
      sops: (db.prepare('SELECT * FROM sops').all()).map(r => [rowToSOP(r).id, rowToSOP(r)]),
      taskComments: (db.prepare('SELECT * FROM task_comments').all()).map(r => [rowToTaskComment(r).id, rowToTaskComment(r)]),
      clients: (db.prepare('SELECT * FROM clients').all()).map(r => [rowToClient(r).id, rowToClient(r)]),
      meetingTemplates: (db.prepare('SELECT * FROM meeting_templates').all()).map(r => [rowToMeetingTemplate(r).id, rowToMeetingTemplate(r)]),
      timelineEvents: (db.prepare('SELECT * FROM timeline_events').all()).map(r => [rowToTimelineEvent(r).id, rowToTimelineEvent(r)]),
      checklists: (db.prepare('SELECT * FROM checklists').all()).map(r => [rowToChecklist(r).id, rowToChecklist(r)]),
      escalationRules: (db.prepare('SELECT * FROM escalation_rules').all()).map(r => [rowToEscalationRule(r).id, rowToEscalationRule(r)]),
      apiLog: (db.prepare('SELECT * FROM api_log').all()).map(r => [rowToApiLogEntry(r).id, rowToApiLogEntry(r)]),
      risks: (db.prepare('SELECT * FROM risks').all()).map(r => [rowToRisk(r).id, rowToRisk(r)]),
      nextId: { agent: 1, meeting: 1, message: 1, project: 1, transaction: 1, task: 1, goal: 1 },
      tokenStats: (() => {
        const r = db.prepare('SELECT * FROM token_stats WHERE id = 1').get() as any;
        return { totalInputTokens: r?.total_input_tokens ?? 0, totalOutputTokens: r?.total_output_tokens ?? 0, totalCostCents: r?.total_cost_cents ?? 0, callCount: r?.call_count ?? 0 };
      })(),
      settings: (() => {
        const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
        const result: Record<string, any> = {};
        for (const row of rows) { try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; } }
        return result;
      })(),
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      const transaction = db.transaction(() => {
        // Clear all tables
        const tables = ['agents','meetings','meeting_messages','projects','transactions','agent_tasks','goals','agent_memories','agent_messages','workflows','notifications','decision_log','snapshots','sops','task_comments','clients','meeting_templates','timeline_events','checklists','escalation_rules','api_log','risks'];
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
        // Import using the migration logic
        importTuples(data.agents, insertAgent);
        importTuples(data.meetings, insertMeeting);
        importTuples(data.meetingMessages, insertMeetingMessage);
        importTuples(data.projects, insertProject);
        importTuples(data.transactions, insertTransaction);
        importTuples(data.agentTasks, insertAgentTask);
        importTuples(data.goals, insertGoal);
        importTuples(data.agentMemories, insertAgentMemory);
        importTuples(data.agentMessages, insertAgentMessageRow);
        importTuples(data.workflows, insertWorkflow);
        importTuples(data.notifications, insertNotification);
        importTuples(data.decisionLog, insertDecisionLogEntry);
        importTuples(data.snapshots, insertSnapshot);
        importTuples(data.sops, insertSOP);
        importTuples(data.taskComments, insertTaskComment);
        importTuples(data.clients, insertClient);
        importTuples(data.meetingTemplates, insertMeetingTemplate);
        importTuples(data.timelineEvents, insertTimelineEvent);
        importTuples(data.checklists, insertChecklistRow);
        importTuples(data.escalationRules, insertEscalationRule);
        importTuples(data.apiLog, insertApiLogEntry);
        importTuples(data.risks, insertRisk);
        // Token stats
        if (data.tokenStats) {
          db.prepare('UPDATE token_stats SET total_input_tokens=?, total_output_tokens=?, total_cost_cents=?, call_count=? WHERE id=1').run(
            data.tokenStats.totalInputTokens ?? 0, data.tokenStats.totalOutputTokens ?? 0, data.tokenStats.totalCostCents ?? 0, data.tokenStats.callCount ?? 0
          );
        }
        // Settings
        if (data.settings) {
          const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
          for (const [key, value] of Object.entries(data.settings)) {
            upsert.run(key, JSON.stringify(value));
          }
        }
      });
      transaction();
      return true;
    } catch (e) {
      console.error('[sqlite] importData failed:', e);
      return false;
    }
  }

  resetData(): void {
    const tables = ['agents','meetings','meeting_messages','projects','transactions','agent_tasks','goals','agent_memories','agent_messages','workflows','notifications','decision_log','snapshots','sops','task_comments','clients','meeting_templates','timeline_events','checklists','escalation_rules','api_log','risks','settings','artifacts','tool_executions','agent_communications','verification_results'];
    const transaction = db.transaction(() => {
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      db.prepare('UPDATE token_stats SET total_input_tokens=0, total_output_tokens=0, total_cost_cents=0, call_count=0 WHERE id=1').run();
    });
    transaction();
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

  // === NEW GAP METHODS ===

  // --- Artifacts (Gap 2) ---
  async getArtifacts(filter?: { taskId?: number; agentId?: number; projectId?: number; type?: string }): Promise<any[]> {
    let sql = 'SELECT * FROM artifacts WHERE 1=1';
    const params: any[] = [];
    if (filter?.taskId) { sql += ' AND task_id = ?'; params.push(filter.taskId); }
    if (filter?.agentId) { sql += ' AND agent_id = ?'; params.push(filter.agentId); }
    if (filter?.projectId) { sql += ' AND project_id = ?'; params.push(filter.projectId); }
    if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type); }
    sql += ' ORDER BY id DESC';
    return db.prepare(sql).all(...params).map(rowToArtifact);
  }

  async getArtifact(id: number): Promise<any | undefined> {
    const r = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    return r ? rowToArtifact(r) : undefined;
  }

  async createArtifact(artifact: any): Promise<any> {
    const info = db.prepare('INSERT INTO artifacts (task_id, agent_id, project_id, title, type, content, file_path, version, parent_artifact_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      artifact.taskId ?? null, artifact.agentId ?? null, artifact.projectId ?? null, artifact.title, artifact.type, artifact.content ?? null, artifact.filePath ?? null, artifact.version ?? 1, artifact.parentArtifactId ?? null, artifact.metadata ? JSON.stringify(artifact.metadata) : null
    );
    return this.getArtifact(Number(info.lastInsertRowid));
  }

  async updateArtifact(id: number, update: any): Promise<any | undefined> {
    const existing = await this.getArtifact(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update };
    db.prepare('UPDATE artifacts SET task_id=?, agent_id=?, project_id=?, title=?, type=?, content=?, file_path=?, version=?, parent_artifact_id=?, metadata=?, updated_at=datetime(\'now\') WHERE id=?').run(
      merged.taskId, merged.agentId, merged.projectId, merged.title, merged.type, merged.content, merged.filePath, merged.version, merged.parentArtifactId, merged.metadata ? JSON.stringify(merged.metadata) : null, id
    );
    return this.getArtifact(id);
  }

  async deleteArtifact(id: number): Promise<boolean> {
    return db.prepare('DELETE FROM artifacts WHERE id = ?').run(id).changes > 0;
  }

  async getArtifactVersions(id: number): Promise<any[]> {
    const artifact = await this.getArtifact(id);
    if (!artifact) return [];
    // Get all versions sharing the same parent lineage
    const rootId = artifact.parentArtifactId || id;
    return db.prepare('SELECT * FROM artifacts WHERE id = ? OR parent_artifact_id = ? ORDER BY version ASC').all(rootId, rootId).map(rowToArtifact);
  }

  // --- Tool Executions (Gap 3) ---
  async getToolExecutions(filter?: { taskId?: number; agentId?: number }): Promise<any[]> {
    let sql = 'SELECT * FROM tool_executions WHERE 1=1';
    const params: any[] = [];
    if (filter?.taskId) { sql += ' AND task_id = ?'; params.push(filter.taskId); }
    if (filter?.agentId) { sql += ' AND agent_id = ?'; params.push(filter.agentId); }
    sql += ' ORDER BY id DESC';
    return db.prepare(sql).all(...params).map(rowToToolExecution);
  }

  async createToolExecution(exec: any): Promise<any> {
    const info = db.prepare('INSERT INTO tool_executions (task_id, agent_id, tool_name, parameters, result, success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      exec.taskId ?? null, exec.agentId ?? null, exec.toolName, exec.parameters ? JSON.stringify(exec.parameters) : null, exec.result ? JSON.stringify(exec.result) : null, exec.success ? 1 : 0, exec.durationMs ?? null
    );
    const r = db.prepare('SELECT * FROM tool_executions WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToToolExecution(r);
  }

  // --- Agent Communications (Gap 5) ---
  async getAgentCommunications(filter?: { agentId?: number; taskId?: number }): Promise<any[]> {
    let sql = 'SELECT * FROM agent_communications WHERE 1=1';
    const params: any[] = [];
    if (filter?.agentId) { sql += ' AND (from_agent_id = ? OR to_agent_id = ?)'; params.push(filter.agentId, filter.agentId); }
    if (filter?.taskId) { sql += ' AND task_id = ?'; params.push(filter.taskId); }
    sql += ' ORDER BY id DESC';
    return db.prepare(sql).all(...params).map(rowToAgentCommunication);
  }

  async createAgentCommunication(comm: any): Promise<any> {
    const info = db.prepare('INSERT INTO agent_communications (from_agent_id, to_agent_id, task_id, type, content, metadata, read) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      comm.fromAgentId, comm.toAgentId, comm.taskId ?? null, comm.type, comm.content, comm.metadata ? JSON.stringify(comm.metadata) : null, 0
    );
    const r = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToAgentCommunication(r);
  }

  async updateAgentCommunication(id: number, update: any): Promise<any | undefined> {
    const existing = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(id);
    if (!existing) return undefined;
    if (update.read !== undefined) {
      db.prepare('UPDATE agent_communications SET read = ? WHERE id = ?').run(update.read ? 1 : 0, id);
    }
    const r = db.prepare('SELECT * FROM agent_communications WHERE id = ?').get(id);
    return r ? rowToAgentCommunication(r) : undefined;
  }

  // --- Verification Results (Gap 7) ---
  async getVerificationResults(filter?: { taskId?: number; agentId?: number }): Promise<any[]> {
    let sql = 'SELECT * FROM verification_results WHERE 1=1';
    const params: any[] = [];
    if (filter?.taskId) { sql += ' AND task_id = ?'; params.push(filter.taskId); }
    if (filter?.agentId) { sql += ' AND agent_id = ?'; params.push(filter.agentId); }
    sql += ' ORDER BY id DESC';
    return db.prepare(sql).all(...params).map(rowToVerificationResult);
  }

  async createVerificationResult(result: any): Promise<any> {
    const info = db.prepare('INSERT INTO verification_results (task_id, agent_id, type, reviewer_agent_id, score, passed, feedback, criteria) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      result.taskId, result.agentId, result.type, result.reviewerAgentId ?? null, result.score ?? null, result.passed ? 1 : 0, result.feedback ?? null, result.criteria ? JSON.stringify(result.criteria) : null
    );
    const r = db.prepare('SELECT * FROM verification_results WHERE id = ?').get(Number(info.lastInsertRowid));
    return rowToVerificationResult(r);
  }

  async getVerificationStats(): Promise<{ totalChecks: number; passRate: number; avgScore: number }> {
    const r = db.prepare('SELECT COUNT(*) as total, AVG(CASE WHEN passed = 1 THEN 1.0 ELSE 0.0 END) as pass_rate, AVG(score) as avg_score FROM verification_results').get() as any;
    return { totalChecks: r.total ?? 0, passRate: r.pass_rate ?? 0, avgScore: r.avg_score ?? 0 };
  }
}

// --- Row converters for new tables ---
function rowToArtifact(r: any) {
  return { id: r.id, taskId: r.task_id, agentId: r.agent_id, projectId: r.project_id, title: r.title, type: r.type, content: r.content, filePath: r.file_path, version: r.version, parentArtifactId: r.parent_artifact_id, metadata: r.metadata ? JSON.parse(r.metadata) : null, createdAt: r.created_at, updatedAt: r.updated_at };
}

function rowToToolExecution(r: any) {
  return { id: r.id, taskId: r.task_id, agentId: r.agent_id, toolName: r.tool_name, parameters: r.parameters ? JSON.parse(r.parameters) : null, result: r.result ? JSON.parse(r.result) : null, success: !!r.success, durationMs: r.duration_ms, createdAt: r.created_at };
}

function rowToAgentCommunication(r: any) {
  return { id: r.id, fromAgentId: r.from_agent_id, toAgentId: r.to_agent_id, taskId: r.task_id, type: r.type, content: r.content, metadata: r.metadata ? JSON.parse(r.metadata) : null, read: !!r.read, createdAt: r.created_at };
}

function rowToVerificationResult(r: any) {
  return { id: r.id, taskId: r.task_id, agentId: r.agent_id, type: r.type, reviewerAgentId: r.reviewer_agent_id, score: r.score, passed: !!r.passed, feedback: r.feedback, criteria: r.criteria ? JSON.parse(r.criteria) : null, createdAt: r.created_at };
}

// --- Helpers for importData ---
function importTuples(tuples: [number, any][] | undefined, insertFn: (id: number, data: any) => void) {
  if (!tuples) return;
  for (const [id, data] of tuples) {
    insertFn(id, data);
  }
}

function insertAgent(id: number, a: any) {
  db.prepare('INSERT INTO agents (id, name, role, department, avatar, instructions, skills, parent_id, status, color, model, autonomy_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, a.name, a.role, a.department, a.avatar, a.instructions ?? '', a.skills ? JSON.stringify(a.skills) : null, a.parentId ?? null, a.status ?? 'active', a.color ?? '#4F98A3', a.model ?? null, a.autonomyLevel ?? 'manual'
  );
}

function insertMeeting(id: number, m: any) {
  db.prepare('INSERT INTO meetings (id, title, topic, status, agent_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, m.title, m.topic, m.status, JSON.stringify(m.agentIds), m.createdAt
  );
}

function insertMeetingMessage(id: number, m: any) {
  db.prepare('INSERT INTO meeting_messages (id, meeting_id, agent_id, sender_name, sender_role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, m.meetingId, m.agentId ?? null, m.senderName, m.senderRole, m.content, m.timestamp
  );
}

function insertProject(id: number, p: any) {
  db.prepare('INSERT INTO projects (id, title, description, status, assigned_agent_id, meeting_id, goal_id, priority, progress, total_tasks, completed_tasks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, p.title, p.description ?? '', p.status ?? 'backlog', p.assignedAgentId ?? null, p.meetingId ?? null, p.goalId ?? null, p.priority ?? 'medium', p.progress ?? 0, p.totalTasks ?? 0, p.completedTasks ?? 0, p.createdAt
  );
}

function insertTransaction(id: number, t: any) {
  db.prepare('INSERT INTO transactions (id, type, category, description, amount, date, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, t.type, t.category, t.description, t.amount, t.date, t.agentId ?? null
  );
}

function insertAgentTask(id: number, t: any) {
  db.prepare('INSERT INTO agent_tasks (id, title, description, assigned_agent_id, status, type, proposal, proposed_actions, execution_log, project_id, meeting_id, parent_task_id, depends_on, deliverables, collaborators, discussion_thread, workflow_stage, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, t.title, t.description, t.assignedAgentId, t.status ?? 'pending', t.type ?? 'general',
    t.proposal ?? null, t.proposedActions ?? null, t.executionLog ?? null,
    t.projectId ?? null, t.meetingId ?? null, t.parentTaskId ?? null,
    t.dependsOn ?? null, t.deliverables ?? null, t.collaborators ?? null,
    t.discussionThread ?? null, t.workflowStage ?? null, t.priority ?? 'medium',
    t.createdAt, t.completedAt ?? null
  );
}

function insertGoal(id: number, g: any) {
  db.prepare('INSERT INTO goals (id, title, description, type, parent_goal_id, owner_id, progress, status, quarter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, g.title, g.description ?? '', g.type ?? 'objective', g.parentGoalId ?? null, g.ownerId ?? null, g.progress ?? 0, g.status ?? 'active', g.quarter ?? null, g.createdAt
  );
}

function insertAgentMemory(id: number, m: any) {
  db.prepare('INSERT INTO agent_memories (id, agent_id, type, content, source, created_at, importance) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, m.agentId, m.type, m.content, m.source ?? null, m.createdAt, m.importance ?? 3
  );
}

function insertAgentMessageRow(id: number, m: any) {
  db.prepare('INSERT INTO agent_messages (id, from_agent_id, to_agent_id, content, type, related_task_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, m.fromAgentId, m.toAgentId, m.content, m.type, m.relatedTaskId ?? null, m.read ? 1 : 0, m.createdAt
  );
}

function insertWorkflow(id: number, w: any) {
  db.prepare('INSERT INTO workflows (id, name, description, steps, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id, w.name, w.description ?? '', JSON.stringify(w.steps), w.createdAt
  );
}

function insertNotification(id: number, n: any) {
  db.prepare('INSERT INTO notifications (id, type, title, message, link, read, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, n.type, n.title, n.message, n.link ?? '', n.read ? 1 : 0, n.createdAt, n.priority ?? 'medium'
  );
}

function insertDecisionLogEntry(id: number, d: any) {
  db.prepare('INSERT INTO decision_log (id, type, description, made_by, related_id, timestamp, impact) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, d.type, d.description, d.madeBy, d.relatedId ?? null, d.timestamp, d.impact ?? 'medium'
  );
}

function insertSnapshot(id: number, s: any) {
  db.prepare('INSERT INTO snapshots (id, name, timestamp, data) VALUES (?, ?, ?, ?)').run(
    id, s.name, s.timestamp, JSON.stringify(s.data)
  );
}

function insertSOP(id: number, s: any) {
  db.prepare('INSERT INTO sops (id, title, category, steps, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, s.title, s.category ?? '', JSON.stringify(s.steps), s.department ?? '', s.createdAt, s.updatedAt ?? s.createdAt
  );
}

function insertTaskComment(id: number, c: any) {
  db.prepare('INSERT INTO task_comments (id, task_id, author_type, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, c.taskId, c.authorType, c.authorId ?? null, c.authorName, c.content, c.createdAt
  );
}

function insertClient(id: number, c: any) {
  db.prepare('INSERT INTO clients (id, name, type, contact, status, projects, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, c.name, c.type, c.contact ?? '', c.status ?? 'active', JSON.stringify(c.projects ?? []), c.createdAt
  );
}

function insertMeetingTemplate(id: number, t: any) {
  db.prepare('INSERT INTO meeting_templates (id, name, agenda, suggested_speakers, duration, type) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, t.name, t.agenda ?? '', JSON.stringify(t.suggestedSpeakers ?? []), t.duration ?? 60, t.type ?? 'general'
  );
}

function insertTimelineEvent(id: number, e: any) {
  db.prepare('INSERT INTO timeline_events (id, type, title, description, agent_id, department, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, e.type, e.title, e.description ?? '', e.agentId ?? null, e.department ?? null, e.timestamp
  );
}

function insertChecklistRow(id: number, c: any) {
  db.prepare('INSERT INTO checklists (id, name, items, parent_type, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, c.name, JSON.stringify(c.items ?? []), c.parentType, c.parentId, c.createdAt
  );
}

function insertEscalationRule(id: number, r: any) {
  db.prepare('INSERT INTO escalation_rules (id, name, trigger_hours, action, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, r.name, r.triggerHours, r.action, r.enabled ? 1 : 0, r.createdAt
  );
}

function insertApiLogEntry(id: number, e: any) {
  db.prepare('INSERT INTO api_log (id, method, path, body, timestamp, status_code) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, e.method, e.path, e.body ?? null, e.timestamp, e.statusCode ?? 200
  );
}

function insertRisk(id: number, r: any) {
  db.prepare('INSERT INTO risks (id, title, description, probability, impact, mitigations, owner_id, status, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, r.title, r.description ?? '', r.probability ?? 3, r.impact ?? 3, r.mitigations ?? '', r.ownerId ?? null, r.status ?? 'open', r.projectId ?? null, r.createdAt
  );
}

