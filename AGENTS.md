# Autonomous AI Native Hub — Multi-Agent Squad

Dokumentasi tim subagent spesialis yang telah dikonfigurasi untuk membangun proyek **Autonomous AI Native Hub (Tauri 2.0 + React 19 + Rust Tokio Engine)**.

---

## 👥 Roster Subagent Spesialis

| Subagent | Role & Fokus | Kemampuan & Tools |
| :--- | :--- | :--- |
| **`rust-core-engineer`** | **Rust Backend & Tauri Native** | Tauri 2.0 IPC, Tokio async runtime, SQLite persistence, Sandboxed tools runner, MCP client, Provider APIs (Gemini, Claude, OpenAI, Ollama). |
| **`frontend-ui-specialist`** | **Frontend UI & Motion (React 19)** | React 19, TypeScript, Tailwind CSS, Framer Motion, Agent DAG Tree visualizer, Task Kanban, Log Stream Terminal, Diff Viewer, 4 Boundary States. |
| **`agentic-engine-architect`** | **Multi-Agent Orchestrator & AI Logic** | DAG task decomposition, parallel subagent spawner, inter-agent message buses, system prompt engineering, Human-in-the-Loop (HITL) safety policy. |
| **`qa-security-auditor`** | **QA, Security & Sandbox Auditor** | Sandbox path confinement check, API key encryption review, test suites (`cargo test` & frontend), AetherCraft protocol audit, zero-overflow assurance. |

---

## 🚀 Cara Memanggil Subagent

Anda atau Agent Utama dapat mendelegasikan tugas kapan saja menggunakan `invoke_subagent`. Contoh:

- Ingin membuat engine sandbox di Rust: delegasikan ke `rust-core-engineer`
- Ingin membuat komponen Visual DAG Tree di React: delegasikan ke `frontend-ui-specialist`
- Ingin mendesain protokol dekomposisi task dan inter-agent communication: delegasikan ke `agentic-engine-architect`
- Ingin menguji keamanan sandbox dan menjalankan audit: delegasikan ke `qa-security-auditor`

---

## 🎨 Aturan Baku Desain (Flat Design ChatGPT Standard)
Setiap subagent (khususnya `frontend-ui-specialist`) WAJIB mematuhi spesifikasi di [`DESIGN_MASTER.md`](./DESIGN_MASTER.md) dan [`GEMINI.md`](./GEMINI.md):
- **Warna Solid**: Background kanvas `#212121`, Sidebar `#171717`, Card/Dock `#2f2f2f`, Hover `#262626`/`#383838`.
- **Anti-Slop**: Zero rainbow/blue-purple gradient, zero full-screen blur, zero heavy shadows.
- **Dock Input Bawah**: Kolom chat fixed bottom dock `rounded-3xl` dengan tinggi tombol seragam `h-8` (`32px`).
- **Collapsible Squad**: Bagian squad room wajib dapat di-hide ke atas untuk kenyamanan ruang kerja.

## 📋 Struktur Folder Target

```
Agentic/
├── AGENTS.md                      # Panduan tim agent
├── src-tauri/                     # Rust Native Backend (Tauri 2.0)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/                    # SQLite schemas & queries
│       ├── providers/             # Gemini, OpenAI, Claude, Ollama clients
│       ├── engine/                # Agent runtime, tools sandbox, MCP
│       └── ipc/                   # Tauri IPC command bridge
└── src/                           # React 19 + Vite Frontend
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chatbot/           # Mode 1: Clean Chat
        │   ├── agent/             # Mode 2: Single Agent with HITL
        │   ├── build/             # Mode 3: Multi-Agent Parallel Studio
        │   └── common/            # 4 Boundary States (Skeleton, Empty, Error, Toast)
        └── store/                 # Zustand state stores
```
