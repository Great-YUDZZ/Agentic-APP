# Agentic Native Hub

> Autonomous AI Native Hub built with Tauri 2.0, React 19, and Rust Tokio Engine.

---

## Overview

Agentic Native Hub is a high-performance desktop application designed for multi-agent workflows, local intelligence, and direct LLM collaboration. It provides three operational modes:

1. **Clean Chatbot**: Fast streaming inference with dynamic model discovery and context attachments.
2. **Autonomous Single Agent**: Goal execution with step-by-step reasoning chains and Human-in-the-Loop (HITL) approval gates.
3. **Build Studio (Multi-Agent Squad)**: Collaborative multi-agent group discussion with turn-taking logic, visual DAG hierarchy, Kanban task board, interactive terminal logs, and code diff viewer.

---

## Design Philosophy

- **Flat Design Standard**: Built on pure solid surfaces (`#212121`, `#171717`, `#2f2f2f`) without neon slop or heavy blur.
- **Harmonized Action Controls**: Consistent 32px height buttons (`h-8`), round pills, and floating bottom input dock.
- **Collapsible Squad Room**: Workspace decluttering with quick collapsible squad panels.
- **4 Boundary States**: Loading Skeleton, Empty State, Error Boundary with retry, and Toast Feedback.

---

## Architecture

```
Agentic/
├── src-tauri/                     # Rust Native Backend (Tauri 2.0)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/                    # SQLite thread-safe persistence
│       ├── providers/             # Gemini, OpenAI, Claude, Ollama client bridge
│       ├── engine/                # Tokio multi-agent runtime & path-confined tools sandbox
│       └── ipc/                   # Tauri IPC commands
└── src/                           # React 19 + Vite Frontend
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chatbot/           # Clean Chat with Model Pill Bar
        │   ├── agent/             # Single Agent with HITL Clearance
        │   ├── build/             # Multi-Agent Discussion & Studio
        │   ├── layout/            # TitleBar & Sidebar
        │   ├── terminal/          # Embedded Bash Terminal Drawer
        │   ├── skills/            # Skills Hub Modal
        │   └── common/            # 4 Boundary States & Attachment Chips
        └── store/                 # Zustand reactive state stores
```

---

## Getting Started

### Prerequisites
- Node.js >= 18 and npm
- Rust toolchain (cargo, rustc >= 1.78)
- Linux build dependencies (libwebkit2gtk-4.1-dev, libappindicator3-dev, librsvg2-dev)

### Installation
```bash
# Install frontend dependencies
npm install

# Run frontend preview
npm run dev

# Run full native Tauri desktop app
npm run tauri dev
```

### Production Build
```bash
# Build desktop native bundle
npm run tauri build
```

---

## License

MIT License. Hak Cipta (c) Great-YUDZZ.
