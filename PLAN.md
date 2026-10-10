# Implementation Plan: Autonomous AI Native Hub (Windows & Linux)

A native desktop application built with **Tauri 2.0 (Rust) + React 19 (TypeScript) + Framer Motion** that acts as a unified hub for personal AI workflows. It seamlessly supports three primary modes: **Chatbot Mode**, **Agent Mode**, and **Build Mode** (parallel multi-agent collaboration with recursive subagent spawning), powered by user-provided API keys (Google Gemini, OpenAI, Anthropic Claude, DeepSeek, Groq, Ollama, and Custom Endpoints).

---

## Architecture & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Operator
    participant UI as React Frontend (Tauri Webview)
    participant IPC as Tauri IPC Command Bridge
    participant Orchestrator as Rust Tokio Agent Orchestrator
    participant DB as SQLite Local Store
    participant AgentA as Lead Architect Agent
    participant SubAgent1 as Coder Subagent
    participant SubAgent2 as Reviewer Subagent
    participant LLM as AI Provider API (Gemini / Claude / etc.)
    participant Sandbox as Local Tool Runner (Files / Terminal)

    User->>UI: Submit Project Goal in Build Mode
    UI->>IPC: invoke("start_build_session", { goal, providers })
    IPC->>DB: Create Session & Task Entities
    IPC->>Orchestrator: Spawn Lead Architect Agent
    Orchestrator->>AgentA: Initialize with Goal & System Prompt
    
    AgentA->>LLM: Decompose Goal into DAG Tasks
    LLM-->>AgentA: Task List [Task 1 (Code), Task 2 (Review)]
    AgentA->>Orchestrator: spawn_subagent(Role="Coder", Task="Task 1")
    AgentA->>Orchestrator: spawn_subagent(Role="Reviewer", Task="Task 2")
    
    par Parallel Subagent Execution
        Orchestrator->>SubAgent1: Execute Task 1 (async Tokio thread)
        SubAgent1->>LLM: Generate Implementation Code
        LLM-->>SubAgent1: Call Tool `write_to_file("src/main.rs")`
        SubAgent1->>IPC: Emit ToolCallRequested Event
        IPC->>UI: Show HITL Permission Dialog (or auto-approve if configured)
        User->>UI: Click "Approve"
        UI->>IPC: invoke("resolve_tool_call", { id, approved: true })
        IPC->>Sandbox: Execute File Write
        Sandbox-->>SubAgent1: Success
        SubAgent1->>DB: Log Action & File Diff
        SubAgent1-->>Orchestrator: Task 1 Completed
    and
        Orchestrator->>SubAgent2: Execute Task 2 (awaits Task 1 artifact)
        SubAgent2->>Sandbox: Read File `src/main.rs`
        SubAgent2->>LLM: Perform Code Review & Verification
        LLM-->>SubAgent2: Review Clean & Ready
        SubAgent2->>DB: Log Review Report
        SubAgent2-->>Orchestrator: Task 2 Completed
    end

    Orchestrator->>AgentA: Report All Subagents Done
    AgentA->>DB: Mark Session Completed
    AgentA->>IPC: Emit BuildCompleted Event
    IPC->>UI: Update Agent DAG, Kanban & Show Success Toast
```

---

## 4 Mandatory Boundary States (AetherCraft Protocol)

Setiap dynamic view wajib memiliki:
1. **Loading Skeleton**: Shimmering layout placeholders matching exact element proportions.
2. **Empty State**: Zero-state guides with actionable CTA.
3. **Error Boundary + Retry**: Runtime error catch with one-click diagnostic and retry.
4. **Success Toast / Feedback**: Tactile toast notification upon completion.
