import db from './db';

export function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      avatar TEXT,
      instructions TEXT NOT NULL DEFAULT '',
      skills TEXT, -- JSON array
      parent_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      color TEXT DEFAULT '#4F98A3',
      model TEXT,
      autonomy_level TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      agent_ids TEXT NOT NULL, -- JSON array of integers
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      agent_id INTEGER,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      assigned_agent_id INTEGER,
      meeting_id INTEGER,
      goal_id INTEGER,
      priority TEXT NOT NULL DEFAULT 'medium',
      progress INTEGER NOT NULL DEFAULT 0,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      agent_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_agent_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      type TEXT NOT NULL DEFAULT 'general',
      proposal TEXT,
      proposed_actions TEXT,
      execution_log TEXT,
      project_id INTEGER,
      meeting_id INTEGER,
      parent_task_id INTEGER,
      depends_on TEXT,
      deliverables TEXT,
      collaborators TEXT,
      discussion_thread TEXT,
      workflow_stage TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'objective',
      parent_goal_id INTEGER,
      owner_id INTEGER,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      quarter TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_agent_id INTEGER NOT NULL,
      to_agent_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      related_task_id INTEGER,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL, -- JSON array
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium'
    );

    CREATE TABLE IF NOT EXISTS decision_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      made_by TEXT NOT NULL,
      related_id INTEGER,
      timestamp TEXT NOT NULL,
      impact TEXT NOT NULL DEFAULT 'medium'
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      data TEXT NOT NULL -- JSON
    );

    CREATE TABLE IF NOT EXISTS sops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL, -- JSON array
      department TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'client',
      contact TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      projects TEXT NOT NULL DEFAULT '[]', -- JSON array of project IDs
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      agenda TEXT NOT NULL DEFAULT '',
      suggested_speakers TEXT NOT NULL DEFAULT '[]', -- JSON array
      duration INTEGER NOT NULL DEFAULT 60,
      type TEXT NOT NULL DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      agent_id INTEGER,
      department TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]', -- JSON array
      parent_type TEXT NOT NULL,
      parent_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS escalation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_hours INTEGER NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      body TEXT,
      timestamp TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200
    );

    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      probability INTEGER NOT NULL DEFAULT 3,
      impact INTEGER NOT NULL DEFAULT 3,
      mitigations TEXT NOT NULL DEFAULT '',
      owner_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      project_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_cents REAL NOT NULL DEFAULT 0,
      call_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- GAP 2: Artifacts
    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      agent_id INTEGER,
      project_id INTEGER,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT,
      file_path TEXT,
      version INTEGER DEFAULT 1,
      parent_artifact_id INTEGER,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- GAP 3: Tool executions
    CREATE TABLE IF NOT EXISTS tool_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      agent_id INTEGER,
      tool_name TEXT NOT NULL,
      parameters TEXT,
      result TEXT,
      success INTEGER,
      duration_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- GAP 5: Agent communications
    CREATE TABLE IF NOT EXISTS agent_communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_agent_id INTEGER NOT NULL,
      to_agent_id INTEGER NOT NULL,
      task_id INTEGER,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- GAP 7: Verification results
    CREATE TABLE IF NOT EXISTS verification_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      reviewer_agent_id INTEGER,
      score REAL,
      passed INTEGER,
      feedback TEXT,
      criteria TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Initialize token_stats row if not exists
    INSERT OR IGNORE INTO token_stats (id, total_input_tokens, total_output_tokens, total_cost_cents, call_count) VALUES (1, 0, 0, 0, 0);
  `);
}
