# AI Company Control Tower

**A fully autonomous AI company simulator where AI agents run an entire organization — managed by a single human owner.**

This is a proof-of-concept platform where 17+ AI agents operate as employees across departments (Engineering, Product, Growth, Finance, Design, Games Studio, Operations), executing tasks, holding meetings, making decisions, and delivering work — all orchestrated through a real-time control tower dashboard.

## What This Is

Imagine a company where every role — CEO advisor, CTO, Head of Product, Growth Lead, CFO, designers, engineers — is an AI agent. They:

- **Think through tasks** autonomously using OpenAI models
- **Delegate work** down reporting lines (CEO → managers → individual contributors)
- **Hold meetings** where agents discuss, debate, and reach consensus
- **Create deliverables** — documents, code, specs, plans stored in a shared artifact system
- **Communicate with each other** via async messages and peer reviews
- **Make strategic decisions** that get logged and tracked
- **Manage finances** with budget tracking and cost controls

The human owner acts as CEO — setting direction, approving proposals, and overseeing the operation through a comprehensive dashboard.

## Key Capabilities

### Organization & Agents
- **Org Chart** with reporting lines, skills, autonomy levels, and performance metrics
- **Agent Hiring** — AI generates complete agent profiles with roles, skills, and instructions
- **4 Autonomy Tiers** — Manual, Supervised, Semi-Autonomous, Fully Autonomous
- **Per-Agent Model Overrides** — different AI models for different roles
- **Agent Memory** — persistent knowledge that carries across tasks

### Task Execution
- **Kanban Board** — Queue → Working → Accepted → Rejected workflow
- **AI Auto-Think** — agents analyze tasks, propose solutions, delegate sub-tasks
- **Manager Review Loop** — managers review direct reports' work before CEO approval
- **Task Dependencies** — blocked-by / blocks relationships
- **Bulk Operations** — multi-select approve, reject, reassign, delete
- **Priority Sorting** — urgent → high → medium → low automatic ordering

### Meetings & Communication
- **Autonomous Meetings** — agents discuss topics, build on each other's points, reach conclusions
- **Meeting → Project Pipeline** — meetings auto-generate projects and tasks
- **Agent-to-Agent Communication** — async messages, synchronous queries, peer reviews
- **Meeting Templates** — reusable formats for standups, strategy sessions, retrospectives

### Strategy & Planning
- **OKR Management** — objectives with measurable key results
- **AI Strategy Proposals** — AI analyzes full company context to propose new objectives and KRs
- **Auto-Calculated Progress** — objective progress derived from linked project tasks + KR completion
- **Strategy → Project Derivation** — AI proposes projects to advance strategic objectives
- **Roadmap** with timeline visualization and budget tracking

### Infrastructure & Tools
- **13 Agent Tools** — code execution, web search, URL fetch, file operations, data queries, artifact management, inter-agent communication
- **Self-Verification Loop** — agents score their own work (0-1), auto-revise if below threshold
- **Shared Artifact Store** — versioned documents, code, specs accessible across agents
- **Code Execution Sandbox** — isolated JS/Python/Bash execution per task

### Operations
- **Financial Tracking** — revenue, expenses, budgets, cost per task
- **Company Health Monitor** — automated health scoring with self-healing remediation
- **Scheduling System** — recurring tasks linked to strategy with automated execution
- **Knowledge Base** — categorized articles, SOPs with versioning
- **Analytics Dashboard** — task throughput, agent utilization, cost trends, department performance
- **Decision Log** — every significant decision tracked with impact assessment

### System Controls
- **Global Pause/Resume** — freeze all processing instantly, resume where you left off
- **Credit Pause System** — automatic rate-limit detection with exponential backoff
- **Deduplication Guards** — 4-layer protection against duplicate tasks and projects
- **Queue Processor** — automatic task pickup with concurrency limits
- **Watchdog** — stuck task recovery and zombie parent resolution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Express.js, Node.js |
| **Database** | SQLite (better-sqlite3) — 28 tables, WAL mode |
| **ORM** | Drizzle ORM |
| **AI** | OpenAI API (GPT-4o, GPT-4o-mini, configurable per agent) |
| **Routing** | Wouter (hash-based) |
| **State** | TanStack React Query |
| **Build** | Vite + esbuild |

## Architecture

```
├── client/src/
│   ├── pages/          # 20 page components (dashboard, tasks, meetings, strategy...)
│   ├── components/     # Shared UI components (sidebar, notifications, search...)
│   └── lib/            # Utilities, query client
├── server/
│   ├── routes.ts       # 204 API endpoints (~7,600 lines)
│   ├── storage-sqlite.ts # Database layer (~1,100 lines)
│   └── ai.ts           # AI integration (OpenAI)
├── shared/
│   └── schema.ts       # Drizzle schema (28 tables)
└── data/
    └── control-tower.db # SQLite database
```

## Getting Started

### Prerequisites
- Node.js 20+
- An OpenAI API key

### Setup

```bash
# Clone the repo
git clone https://github.com/kaito-vibe/ai-company-control-tower.git
cd ai-company-control-tower

# Install dependencies
npm install

# Set your OpenAI API key
export OPENAI_API_KEY=your-key-here

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Production Build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

### PIN Gate
The app is protected by a PIN entry screen. Default PIN: `7128`

## Pages Overview

| Page | Purpose |
|------|---------|
| **Dashboard** | Company overview — health score, active tasks, strategy progress, activity feed |
| **Approvals** | CEO approval queue for agent proposals |
| **Org Chart** | Visual hierarchy with reporting lines and performance metrics |
| **Agent Tasks** | Kanban board with drag-and-drop, bulk operations |
| **Meetings** | Create and run autonomous agent meetings |
| **Calendar** | Company-wide calendar view |
| **Departments** | Department management with budgets and headcount |
| **Projects** | Project portfolio with task breakdowns |
| **Products** | Product catalog and management |
| **Finances** | Revenue, expenses, budgets, cost analysis |
| **Strategy** | OKR management with AI proposals and auto-progress |
| **Roadmap** | Timeline visualization with budget tracking |
| **Knowledge** | Knowledge base articles and SOPs |
| **Schedules** | Recurring task management |
| **Analytics** | Performance metrics, trends, department analysis |
| **Data** | Database management and data operations |
| **Settings** | System configuration, AI models, integrations |
| **Changelog** | Complete feature list and release history |

## Live Stats (from POC run)

- **17 AI agents** across 7 departments
- **900+ tasks** processed (460+ completed)
- **46 projects** tracked
- **8 meetings** held autonomously
- **259 agent memories** accumulated
- **324+ deliverables** produced
- **423 decisions** logged
- **2,400+ API calls** made
- **$120 total AI cost**

## Use Cases

This platform demonstrates several real-world scenarios:

- **Replace individual roles** — assign specific functions to AI agents
- **Automate entire departments** — let a team of agents handle a business unit
- **Run a full AI company** — every employee is an AI, one human steers
- **Digital twin** — mirror a real company's structure to simulate decisions and strategy

## License

MIT
