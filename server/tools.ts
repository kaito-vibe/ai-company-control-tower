import type { Agent } from '../shared/schema';
import { executeSandboxedCode } from './sandbox';

// ===== Tool interfaces =====

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
}

export interface ToolContext {
  agentId: number;
  taskId: number;
  agent: Agent;
  storage: any; // IStorage — avoid circular import
  trackedAI?: (params: { instructions: string; input: string; model?: string }, context: { label: string; agentId?: number | null }) => Promise<{ output_text: string; usage: any }>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  artifacts?: { title: string; content: string; type: string }[];
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  category: 'communication' | 'code' | 'data' | 'file' | 'web' | 'integration';
  parameters: Record<string, ToolParameter>;
  requiredRole?: string[];
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
}

// ===== Tool Registry =====

const toolRegistry: Map<string, Tool> = new Map();

export function registerTool(tool: Tool) {
  toolRegistry.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return toolRegistry.get(name);
}

export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

export function getToolsForAgent(agent: Agent): Tool[] {
  return getAllTools().filter(tool => {
    if (!tool.requiredRole || tool.requiredRole.length === 0) return true;
    const agentRole = (agent.role || '').toLowerCase();
    return tool.requiredRole.some(r => agentRole.includes(r.toLowerCase()));
  });
}

// ===== Tool descriptions for system prompt =====

export function getToolDescriptionsForPrompt(tools: Tool[]): string {
  const lines = ['AVAILABLE TOOLS:', 'You can call tools by responding with JSON blocks in this format:', '```tool', '{"tool": "tool_name", "params": {"param1": "value1"}}', '```', ''];
  for (const tool of tools) {
    const params = Object.entries(tool.parameters).map(([k, v]) =>
      `    - ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description}`
    ).join('\n');
    lines.push(`**${tool.name}** — ${tool.description}`);
    if (params) lines.push(`  Parameters:\n${params}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ===== Parse tool calls from AI response =====

export function parseToolCalls(text: string): { tool: string; params: Record<string, any> }[] {
  const calls: { tool: string; params: Record<string, any> }[] = [];
  // Match ```tool ... ``` blocks
  const regex = /```tool\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, params: parsed.params || {} });
      }
    } catch {
      // Skip unparseable blocks
    }
  }
  return calls;
}

// ===== Execute tool calls =====

export async function executeToolCalls(
  calls: { tool: string; params: Record<string, any> }[],
  context: ToolContext
): Promise<{ tool: string; result: ToolResult }[]> {
  const results: { tool: string; result: ToolResult }[] = [];
  for (const call of calls) {
    const tool = getTool(call.tool);
    if (!tool) {
      results.push({ tool: call.tool, result: { success: false, output: '', error: `Unknown tool: ${call.tool}` } });
      continue;
    }
    const start = Date.now();
    try {
      const result = await tool.execute(call.params, context);
      const durationMs = Date.now() - start;
      // Log execution
      try {
        await context.storage.createToolExecution({
          taskId: context.taskId,
          agentId: context.agentId,
          toolName: call.tool,
          parameters: JSON.stringify(call.params),
          result: JSON.stringify(result),
          success: result.success,
          durationMs,
        });
      } catch { /* log error silently */ }
      results.push({ tool: call.tool, result });
    } catch (err: any) {
      results.push({ tool: call.tool, result: { success: false, output: '', error: err.message } });
    }
  }
  return results;
}

// ===== Built-in Tools =====

// 1. write_document
registerTool({
  name: 'write_document',
  description: 'Create or update a text document artifact',
  category: 'file',
  parameters: {
    title: { type: 'string', description: 'Document title', required: true },
    content: { type: 'string', description: 'Document content (markdown)', required: true },
    type: { type: 'string', description: 'Artifact type: document, code, spec, plan, design, data', required: false },
  },
  async execute(params, context) {
    const artifact = await context.storage.createArtifact({
      taskId: context.taskId,
      agentId: context.agentId,
      title: params.title,
      type: params.type || 'document',
      content: params.content,
    });
    return { success: true, output: `Created artifact "${params.title}" (id: ${artifact.id})`, artifacts: [{ title: params.title, content: params.content, type: params.type || 'document' }] };
  },
});

// 2. read_artifact
registerTool({
  name: 'read_artifact',
  description: 'Read an existing artifact by ID',
  category: 'file',
  parameters: {
    id: { type: 'number', description: 'Artifact ID', required: true },
  },
  async execute(params, context) {
    const artifacts = await context.storage.getArtifacts({ id: params.id });
    const artifact = artifacts[0];
    if (!artifact) return { success: false, output: '', error: `Artifact ${params.id} not found` };
    return { success: true, output: `## ${artifact.title}\n\n${artifact.content || '(no content)'}` };
  },
});

// 3. search_artifacts
registerTool({
  name: 'search_artifacts',
  description: 'Search across all artifacts by title or type',
  category: 'file',
  parameters: {
    query: { type: 'string', description: 'Search term for title', required: false },
    type: { type: 'string', description: 'Filter by type', required: false },
    projectId: { type: 'number', description: 'Filter by project', required: false },
  },
  async execute(params, context) {
    const artifacts = await context.storage.getArtifacts({
      type: params.type,
      projectId: params.projectId,
    });
    const filtered = params.query
      ? artifacts.filter((a: any) => a.title.toLowerCase().includes(params.query.toLowerCase()))
      : artifacts;
    const list = filtered.slice(0, 20).map((a: any) => `- [${a.id}] ${a.title} (${a.type})`).join('\n');
    return { success: true, output: `Found ${filtered.length} artifacts:\n${list}` };
  },
});

// 4. send_message_to_agent
registerTool({
  name: 'send_message_to_agent',
  description: 'Send an async message to another agent',
  category: 'communication',
  parameters: {
    agentId: { type: 'number', description: 'Target agent ID', required: true },
    message: { type: 'string', description: 'Message content', required: true },
  },
  async execute(params, context) {
    await context.storage.createAgentCommunication({
      fromAgentId: context.agentId,
      toAgentId: params.agentId,
      taskId: context.taskId,
      type: 'message',
      content: params.message,
    });
    return { success: true, output: `Message sent to agent ${params.agentId}` };
  },
});

// 5. query_agent
registerTool({
  name: 'query_agent',
  description: 'Ask another agent a question and get a synchronous response',
  category: 'communication',
  parameters: {
    agentId: { type: 'number', description: 'Target agent ID', required: true },
    question: { type: 'string', description: 'Question to ask', required: true },
  },
  async execute(params, context) {
    if (!context.trackedAI) return { success: false, output: '', error: 'AI not available' };
    const targetAgent = await context.storage.getAgent(params.agentId);
    if (!targetAgent) return { success: false, output: '', error: `Agent ${params.agentId} not found` };

    // Record the query
    await context.storage.createAgentCommunication({
      fromAgentId: context.agentId,
      toAgentId: params.agentId,
      taskId: context.taskId,
      type: 'query',
      content: params.question,
    });

    const response = await context.trackedAI(
      {
        instructions: `You are ${targetAgent.name}, ${targetAgent.role} in the ${targetAgent.department} department. ${targetAgent.instructions || ''}\n\nAnswer the following question from a colleague concisely.`,
        input: params.question,
      },
      { label: `query_agent(${params.agentId})`, agentId: params.agentId }
    );

    // Record the response
    await context.storage.createAgentCommunication({
      fromAgentId: params.agentId,
      toAgentId: context.agentId,
      taskId: context.taskId,
      type: 'response',
      content: response.output_text,
    });

    return { success: true, output: `${targetAgent.name} says: ${response.output_text}` };
  },
});

// 6. web_search (simulated via AI knowledge)
registerTool({
  name: 'web_search',
  description: 'Search the web for information (uses AI knowledge synthesis)',
  category: 'web',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  async execute(params, context) {
    if (!context.trackedAI) return { success: false, output: '', error: 'AI not available' };
    const response = await context.trackedAI(
      {
        instructions: 'You are a research assistant. Provide a concise, factual summary based on general knowledge. Format as bullet points with key findings.',
        input: `Research query: ${params.query}`,
      },
      { label: `web_search`, agentId: context.agentId }
    );
    return { success: true, output: response.output_text };
  },
});

// 7. fetch_url
registerTool({
  name: 'fetch_url',
  description: 'Fetch content from a URL',
  category: 'web',
  parameters: {
    url: { type: 'string', description: 'URL to fetch', required: true },
  },
  async execute(params) {
    try {
      const response = await fetch(params.url, {
        headers: { 'User-Agent': 'AIControlTower/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      // Strip HTML tags for a rough text extraction
      const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
      return { success: true, output: clean };
    } catch (err: any) {
      return { success: false, output: '', error: `Fetch failed: ${err.message}` };
    }
  },
});

// 8. execute_code
registerTool({
  name: 'execute_code',
  description: 'Execute code in a sandboxed environment (JavaScript, Python, or Bash)',
  category: 'code',
  parameters: {
    code: { type: 'string', description: 'Code to execute', required: true },
    language: { type: 'string', description: 'javascript, python, or bash', required: true },
  },
  requiredRole: ['engineer', 'architect', 'developer', 'devops', 'tech'],
  async execute(params, context) {
    const lang = params.language as 'javascript' | 'python' | 'bash';
    if (!['javascript', 'python', 'bash'].includes(lang)) {
      return { success: false, output: '', error: `Unsupported language: ${params.language}` };
    }
    const result = await executeSandboxedCode(params.code, lang, context.taskId);
    return {
      success: result.exitCode === 0,
      output: result.stdout || result.stderr,
      error: result.exitCode !== 0 ? result.stderr : undefined,
    };
  },
});

// 9. create_task
registerTool({
  name: 'create_task',
  description: 'Create a sub-task for self or another agent',
  category: 'integration',
  parameters: {
    title: { type: 'string', description: 'Task title', required: true },
    description: { type: 'string', description: 'Task description', required: true },
    assignedAgentId: { type: 'number', description: 'Agent to assign to (default: self)', required: false },
    priority: { type: 'string', description: 'low, medium, high, urgent', required: false },
  },
  async execute(params, context) {
    const task = await context.storage.createAgentTask({
      title: params.title,
      description: params.description,
      assignedAgentId: params.assignedAgentId || context.agentId,
      status: 'pending',
      type: 'general',
      priority: params.priority || 'medium',
      parentTaskId: context.taskId,
      createdAt: new Date().toISOString(),
    });
    return { success: true, output: `Created sub-task "${params.title}" (id: ${task.id})` };
  },
});

// 10. update_project
registerTool({
  name: 'update_project',
  description: 'Update a project status or progress',
  category: 'integration',
  parameters: {
    projectId: { type: 'number', description: 'Project ID', required: true },
    status: { type: 'string', description: 'New status', required: false },
    progress: { type: 'number', description: 'Progress 0-100', required: false },
  },
  async execute(params, context) {
    const updates: any = {};
    if (params.status) updates.status = params.status;
    if (params.progress !== undefined) updates.progress = params.progress;
    await context.storage.updateProject(params.projectId, updates);
    return { success: true, output: `Updated project ${params.projectId}` };
  },
});

// 11. log_decision
registerTool({
  name: 'log_decision',
  description: 'Add an entry to the decision log',
  category: 'integration',
  parameters: {
    type: { type: 'string', description: 'Decision type', required: true },
    description: { type: 'string', description: 'What was decided', required: true },
    impact: { type: 'string', description: 'low, medium, high', required: false },
  },
  async execute(params, context) {
    const agent = context.agent;
    await context.storage.createDecisionLogEntry({
      type: params.type as any,
      description: params.description,
      madeBy: agent.name,
      relatedId: context.taskId,
      timestamp: new Date().toISOString(),
      impact: params.impact || 'medium',
    });
    return { success: true, output: `Decision logged: ${params.description}` };
  },
});

// 12. store_memory
registerTool({
  name: 'store_memory',
  description: 'Store something in your agent memory for future reference',
  category: 'integration',
  parameters: {
    type: { type: 'string', description: 'fact, preference, learning, relationship', required: true },
    content: { type: 'string', description: 'What to remember', required: true },
    importance: { type: 'number', description: 'Importance 1-5', required: false },
  },
  async execute(params, context) {
    await context.storage.createAgentMemory({
      agentId: context.agentId,
      type: params.type,
      content: params.content,
      source: `task-${context.taskId}`,
      createdAt: new Date().toISOString(),
      importance: params.importance || 3,
    });
    return { success: true, output: `Memory stored: ${params.content.slice(0, 50)}...` };
  },
});

// 13. read_company_data (Gap 4)
registerTool({
  name: 'read_company_data',
  description: 'Query internal company data: project stats, agent workload, financial summary',
  category: 'data',
  parameters: {
    query: { type: 'string', description: 'What data to look up: projects, agents, finances, tasks', required: true },
  },
  async execute(params, context) {
    const q = (params.query || '').toLowerCase();
    const storage = context.storage;
    let output = '';

    if (q.includes('project')) {
      const projects = await storage.getProjects();
      const byStatus: Record<string, number> = {};
      for (const p of projects) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      output = `Projects (${projects.length} total): ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
    } else if (q.includes('agent') || q.includes('workload')) {
      const agents = await storage.getAgents();
      const tasks = await storage.getAgentTasks();
      const lines = agents.map((a: any) => {
        const count = tasks.filter((t: any) => t.assignedAgentId === a.id && !['completed', 'rejected'].includes(t.status)).length;
        return `- ${a.name} (${a.role}): ${count} active tasks`;
      });
      output = `Agent workload:\n${lines.join('\n')}`;
    } else if (q.includes('financ') || q.includes('revenue') || q.includes('budget')) {
      const txns = await storage.getTransactions();
      const earnings = txns.filter((t: any) => t.type === 'earning').reduce((s: number, t: any) => s + t.amount, 0);
      const expenses = txns.filter((t: any) => t.type === 'expenditure').reduce((s: number, t: any) => s + t.amount, 0);
      output = `Financials: Earnings: ${earnings} cents, Expenses: ${expenses} cents, Net: ${earnings - expenses} cents`;
    } else if (q.includes('task')) {
      const tasks = await storage.getAgentTasks();
      const byStatus: Record<string, number> = {};
      for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      output = `Tasks (${tasks.length} total): ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
    } else {
      output = 'Available queries: projects, agents/workload, finances/revenue/budget, tasks';
    }

    return { success: true, output };
  },
});
