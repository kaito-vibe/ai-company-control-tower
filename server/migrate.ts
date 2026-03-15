/**
 * Migration script: JSON state.json → SQLite control-tower.db
 * Run with: npx tsx server/migrate.ts
 */
import fs from 'fs';
import path from 'path';
import db from './db';
import { createTables } from './db-schema';

const DATA_FILE = path.join(process.cwd(), 'data', 'state.json');

function migrate() {
  console.log('[migrate] Reading state.json...');
  if (!fs.existsSync(DATA_FILE)) {
    console.error('[migrate] data/state.json not found');
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  console.log('[migrate] Creating tables...');
  createTables();

  console.log('[migrate] Inserting data...');

  const insertAll = db.transaction(() => {
    // Agents
    const stmtAgent = db.prepare('INSERT OR REPLACE INTO agents (id, name, role, department, avatar, instructions, skills, parent_id, status, color, model, autonomy_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, a] of data.agents || []) {
      stmtAgent.run(id, a.name, a.role, a.department, a.avatar, a.instructions ?? '', a.skills ? JSON.stringify(a.skills) : null, a.parentId ?? null, a.status ?? 'active', a.color ?? '#4F98A3', a.model ?? null, a.autonomyLevel ?? 'manual');
    }
    console.log(`  agents: ${(data.agents || []).length}`);

    // Meetings
    const stmtMeeting = db.prepare('INSERT OR REPLACE INTO meetings (id, title, topic, status, agent_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, m] of data.meetings || []) {
      stmtMeeting.run(id, m.title, m.topic, m.status, JSON.stringify(m.agentIds), m.createdAt);
    }
    console.log(`  meetings: ${(data.meetings || []).length}`);

    // Meeting Messages
    const stmtMeetingMsg = db.prepare('INSERT OR REPLACE INTO meeting_messages (id, meeting_id, agent_id, sender_name, sender_role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, m] of data.meetingMessages || []) {
      stmtMeetingMsg.run(id, m.meetingId, m.agentId ?? null, m.senderName, m.senderRole, m.content, m.timestamp);
    }
    console.log(`  meetingMessages: ${(data.meetingMessages || []).length}`);

    // Projects
    const stmtProject = db.prepare('INSERT OR REPLACE INTO projects (id, title, description, status, assigned_agent_id, meeting_id, goal_id, priority, progress, total_tasks, completed_tasks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, p] of data.projects || []) {
      stmtProject.run(id, p.title, p.description ?? '', p.status ?? 'backlog', p.assignedAgentId ?? null, p.meetingId ?? null, p.goalId ?? null, p.priority ?? 'medium', p.progress ?? 0, p.totalTasks ?? 0, p.completedTasks ?? 0, p.createdAt);
    }
    console.log(`  projects: ${(data.projects || []).length}`);

    // Transactions
    const stmtTx = db.prepare('INSERT OR REPLACE INTO transactions (id, type, category, description, amount, date, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, t] of data.transactions || []) {
      stmtTx.run(id, t.type, t.category, t.description, t.amount, t.date, t.agentId ?? null);
    }
    console.log(`  transactions: ${(data.transactions || []).length}`);

    // Agent Tasks
    const stmtTask = db.prepare('INSERT OR REPLACE INTO agent_tasks (id, title, description, assigned_agent_id, status, type, proposal, proposed_actions, execution_log, project_id, meeting_id, parent_task_id, depends_on, deliverables, collaborators, discussion_thread, workflow_stage, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, t] of data.agentTasks || []) {
      stmtTask.run(id, t.title, t.description, t.assignedAgentId, t.status ?? 'pending', t.type ?? 'general', t.proposal ?? null, t.proposedActions ?? null, t.executionLog ?? null, t.projectId ?? null, t.meetingId ?? null, t.parentTaskId ?? null, t.dependsOn ?? null, t.deliverables ?? null, t.collaborators ?? null, t.discussionThread ?? null, t.workflowStage ?? null, t.priority ?? 'medium', t.createdAt, t.completedAt ?? null);
    }
    console.log(`  agentTasks: ${(data.agentTasks || []).length}`);

    // Goals
    const stmtGoal = db.prepare('INSERT OR REPLACE INTO goals (id, title, description, type, parent_goal_id, owner_id, progress, status, quarter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, g] of data.goals || []) {
      stmtGoal.run(id, g.title, g.description ?? '', g.type ?? 'objective', g.parentGoalId ?? null, g.ownerId ?? null, g.progress ?? 0, g.status ?? 'active', g.quarter ?? null, g.createdAt);
    }
    console.log(`  goals: ${(data.goals || []).length}`);

    // Agent Memories
    const stmtMem = db.prepare('INSERT OR REPLACE INTO agent_memories (id, agent_id, type, content, source, created_at, importance) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, m] of data.agentMemories || []) {
      stmtMem.run(id, m.agentId, m.type, m.content, m.source ?? null, m.createdAt, m.importance ?? 3);
    }
    console.log(`  agentMemories: ${(data.agentMemories || []).length}`);

    // Agent Messages
    const stmtAgentMsg = db.prepare('INSERT OR REPLACE INTO agent_messages (id, from_agent_id, to_agent_id, content, type, related_task_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, m] of data.agentMessages || []) {
      stmtAgentMsg.run(id, m.fromAgentId, m.toAgentId, m.content, m.type, m.relatedTaskId ?? null, m.read ? 1 : 0, m.createdAt);
    }
    console.log(`  agentMessages: ${(data.agentMessages || []).length}`);

    // Workflows
    const stmtWf = db.prepare('INSERT OR REPLACE INTO workflows (id, name, description, steps, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const [id, w] of data.workflows || []) {
      stmtWf.run(id, w.name, w.description ?? '', JSON.stringify(w.steps), w.createdAt);
    }
    console.log(`  workflows: ${(data.workflows || []).length}`);

    // Notifications
    const stmtNotif = db.prepare('INSERT OR REPLACE INTO notifications (id, type, title, message, link, read, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, n] of data.notifications || []) {
      stmtNotif.run(id, n.type, n.title, n.message, n.link ?? '', n.read ? 1 : 0, n.createdAt, n.priority ?? 'medium');
    }
    console.log(`  notifications: ${(data.notifications || []).length}`);

    // Decision Log
    const stmtDecision = db.prepare('INSERT OR REPLACE INTO decision_log (id, type, description, made_by, related_id, timestamp, impact) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, d] of data.decisionLog || []) {
      stmtDecision.run(id, d.type, d.description, d.madeBy, d.relatedId ?? null, d.timestamp, d.impact ?? 'medium');
    }
    console.log(`  decisionLog: ${(data.decisionLog || []).length}`);

    // Snapshots
    const stmtSnap = db.prepare('INSERT OR REPLACE INTO snapshots (id, name, timestamp, data) VALUES (?, ?, ?, ?)');
    for (const [id, s] of data.snapshots || []) {
      stmtSnap.run(id, s.name, s.timestamp, JSON.stringify(s.data));
    }
    console.log(`  snapshots: ${(data.snapshots || []).length}`);

    // SOPs
    const stmtSop = db.prepare('INSERT OR REPLACE INTO sops (id, title, category, steps, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, s] of data.sops || []) {
      stmtSop.run(id, s.title, s.category ?? '', JSON.stringify(s.steps), s.department ?? '', s.createdAt, s.updatedAt ?? s.createdAt);
    }
    console.log(`  sops: ${(data.sops || []).length}`);

    // Task Comments
    const stmtComment = db.prepare('INSERT OR REPLACE INTO task_comments (id, task_id, author_type, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, c] of data.taskComments || []) {
      stmtComment.run(id, c.taskId, c.authorType, c.authorId ?? null, c.authorName, c.content, c.createdAt);
    }
    console.log(`  taskComments: ${(data.taskComments || []).length}`);

    // Clients
    const stmtClient = db.prepare('INSERT OR REPLACE INTO clients (id, name, type, contact, status, projects, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, c] of data.clients || []) {
      stmtClient.run(id, c.name, c.type, c.contact ?? '', c.status ?? 'active', JSON.stringify(c.projects ?? []), c.createdAt);
    }
    console.log(`  clients: ${(data.clients || []).length}`);

    // Meeting Templates
    const stmtTmpl = db.prepare('INSERT OR REPLACE INTO meeting_templates (id, name, agenda, suggested_speakers, duration, type) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, t] of data.meetingTemplates || []) {
      stmtTmpl.run(id, t.name, t.agenda ?? '', JSON.stringify(t.suggestedSpeakers ?? []), t.duration ?? 60, t.type ?? 'general');
    }
    console.log(`  meetingTemplates: ${(data.meetingTemplates || []).length}`);

    // Timeline Events
    const stmtTimeline = db.prepare('INSERT OR REPLACE INTO timeline_events (id, type, title, description, agent_id, department, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [id, e] of data.timelineEvents || []) {
      stmtTimeline.run(id, e.type, e.title, e.description ?? '', e.agentId ?? null, e.department ?? null, e.timestamp);
    }
    console.log(`  timelineEvents: ${(data.timelineEvents || []).length}`);

    // Checklists
    const stmtChecklist = db.prepare('INSERT OR REPLACE INTO checklists (id, name, items, parent_type, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, c] of data.checklists || []) {
      stmtChecklist.run(id, c.name, JSON.stringify(c.items ?? []), c.parentType, c.parentId, c.createdAt);
    }
    console.log(`  checklists: ${(data.checklists || []).length}`);

    // Escalation Rules
    const stmtEsc = db.prepare('INSERT OR REPLACE INTO escalation_rules (id, name, trigger_hours, action, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, r] of data.escalationRules || []) {
      stmtEsc.run(id, r.name, r.triggerHours, r.action, r.enabled ? 1 : 0, r.createdAt);
    }
    console.log(`  escalationRules: ${(data.escalationRules || []).length}`);

    // API Log
    const stmtApiLog = db.prepare('INSERT OR REPLACE INTO api_log (id, method, path, body, timestamp, status_code) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, e] of data.apiLog || []) {
      stmtApiLog.run(id, e.method, e.path, e.body ?? null, e.timestamp, e.statusCode ?? 200);
    }
    console.log(`  apiLog: ${(data.apiLog || []).length}`);

    // Risks
    const stmtRisk = db.prepare('INSERT OR REPLACE INTO risks (id, title, description, probability, impact, mitigations, owner_id, status, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [id, r] of data.risks || []) {
      stmtRisk.run(id, r.title, r.description ?? '', r.probability ?? 3, r.impact ?? 3, r.mitigations ?? '', r.ownerId ?? null, r.status ?? 'open', r.projectId ?? null, r.createdAt);
    }
    console.log(`  risks: ${(data.risks || []).length}`);

    // Token Stats
    if (data.tokenStats) {
      db.prepare('UPDATE token_stats SET total_input_tokens=?, total_output_tokens=?, total_cost_cents=?, call_count=? WHERE id=1').run(
        data.tokenStats.totalInputTokens ?? 0,
        data.tokenStats.totalOutputTokens ?? 0,
        data.tokenStats.totalCostCents ?? 0,
        data.tokenStats.callCount ?? 0
      );
      console.log('  tokenStats: migrated');
    }

    // Settings
    if (data.settings) {
      const stmtSettings = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(data.settings)) {
        stmtSettings.run(key, JSON.stringify(value));
      }
      console.log(`  settings: ${Object.keys(data.settings).length} keys`);
    }
  });

  insertAll();

  // Verify counts
  const counts = {
    agents: (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c,
    tasks: (db.prepare('SELECT COUNT(*) as c FROM agent_tasks').get() as any).c,
    projects: (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c,
    meetings: (db.prepare('SELECT COUNT(*) as c FROM meetings').get() as any).c,
  };
  console.log('\n[migrate] Verification:');
  console.log(`  agents: ${counts.agents}`);
  console.log(`  tasks: ${counts.tasks}`);
  console.log(`  projects: ${counts.projects}`);
  console.log(`  meetings: ${counts.meetings}`);

  const dbSize = fs.statSync(path.join(process.cwd(), 'data', 'control-tower.db')).size;
  console.log(`\n[migrate] Database size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('[migrate] Migration complete!');
}

migrate();
