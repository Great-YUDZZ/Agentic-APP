import { ChatSession, ChatMessage, BuildDiscussionSession, CustomAgent, KanbanTask, CodeReviewItem } from '../types';

/**
 * Membersihkan string untuk nama berkas yang aman di Linux dan Windows
 */
export const sanitizeFileName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'sesi';
};

/**
 * Format tanggal ramah manusia YYYY-MM-DD HH:mm
 */
const formatDateTime = (dateStr?: string): string => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().replace('T', ' ').slice(0, 16);
  return d.toISOString().replace('T', ' ').slice(0, 16);
};

/**
 * Unduh string konten sebagai berkas Markdown (.md) secara native di browser / Tauri
 */
export const downloadMarkdownFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Ekspor percakapan bersih untuk Mode Chatbot atau Mode Agent (Hemat token & ramah AI)
 */
export const exportConversationSession = (
  session: ChatSession,
  messages: ChatMessage[]
): void => {
  const sessionMessages = messages.filter((m) => m.session_id === session.id);
  const dateStr = formatDateTime(session.created_at);

  const lines: string[] = [];
  lines.push(`# Percakapan: ${session.title || 'Sesi Chat'}`);
  lines.push('');
  lines.push(`- **Mode**: ${session.mode ? session.mode.toUpperCase() : 'CHATBOT'}`);
  lines.push(`- **Model Aktif**: ${session.model || 'Unknown'} (${session.provider || 'Custom'})`);
  lines.push(`- **Waktu**: ${dateStr}`);
  lines.push(`- **Total Pesan**: ${sessionMessages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of sessionMessages) {
    if (msg.role === 'user') {
      lines.push('### User');
      lines.push(msg.content.trim());
      lines.push('');
    } else if (msg.role === 'assistant') {
      lines.push(`### Assistant (${session.model || 'AI'})`);
      lines.push(msg.content.trim());
      lines.push('');
    } else if (msg.role === 'system') {
      lines.push('### System Instruction');
      lines.push(msg.content.trim());
      lines.push('');
    }
  }

  const cleanName = sanitizeFileName(session.title || 'chat');
  const fileDate = new Date().toISOString().slice(0, 10);
  const filename = `${session.mode || 'chat'}-${cleanName}-${fileDate}.md`;

  downloadMarkdownFile(filename, lines.join('\n'));
};

/**
 * Ekspor Ringkasan Eksekutif Laporan Projek (Mode Build Studio)
 * Dirancang padat konteks, tanpa repetisi chat mentah, sangat hemat token untuk AI
 */
export const exportProjectReport = (
  discussion: BuildDiscussionSession,
  agents: CustomAgent[],
  tasks: KanbanTask[],
  codeItems: CodeReviewItem[]
): void => {
  const dateStr = formatDateTime();
  const fileDate = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`# Laporan Projek: ${discussion.project_goal || 'Tujuan Projek Multi-Agent'}`);
  lines.push('');
  lines.push(`- **Status Projek**: ${discussion.status ? discussion.status.toUpperCase() : 'IDLE'}`);
  lines.push(`- **Tanggal Ekspor**: ${dateStr}`);
  lines.push(`- **Total Interaksi Diskusi**: ${discussion.messages.length} giliran`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Roster Tim Agen
  lines.push('## 1. Roster Tim Agen');
  lines.push('');
  lines.push('- **Lead Orchestrator**: Perencana arsitektur dan koordinator tugas tim');
  const participatingAgents = agents.filter((a) =>
    discussion.selected_agent_ids.includes(a.id)
  );
  if (participatingAgents.length > 0) {
    for (const ag of participatingAgents) {
      lines.push(`- **${ag.name}** (${ag.role}): ${ag.task_description}`);
      if (ag.skills && ag.skills.length > 0) {
        lines.push(`  - Keahlian: ${ag.skills.join(', ')}`);
      }
    }
  } else {
    lines.push('- Skuad agen belum dipilih atau menggunakan pengaturan dinamis.');
  }
  lines.push('');

  // 2. Hasil Perencanaan & Keputusan Utama
  lines.push('## 2. Hasil Perencanaan & Keputusan Utama');
  lines.push('');
  if (discussion.draftPlanTasks && discussion.draftPlanTasks.length > 0) {
    lines.push('### Rencana Tugas Terstruktur:');
    for (const planTask of discussion.draftPlanTasks) {
      lines.push(`- [${planTask.priority.toUpperCase()}] **${planTask.title}** (Diperlukan: ${planTask.role_needed})`);
    }
    lines.push('');
  }

  // Ambil intisari pesan operator_directive atau summary jika ada
  const directives = discussion.messages.filter(
    (m) => m.step_type === 'operator_directive' || m.step_type === 'summary'
  );
  if (directives.length > 0) {
    lines.push('### Catatan & Arahan Operator:');
    for (const dir of directives) {
      lines.push(`- **${dir.agent_name}**: ${dir.content.trim()}`);
    }
    lines.push('');
  } else if (!discussion.draftPlanTasks || discussion.draftPlanTasks.length === 0) {
    lines.push('Tidak ada arahan kustom tambahan. Tim bergerak berdasarkan tujuan utama di atas.');
    lines.push('');
  }

  // 3. Status Tugas Projek (Kanban)
  lines.push('## 3. Status Tugas Projek (Kanban)');
  lines.push('');
  if (tasks.length > 0) {
    const doneTasks = tasks.filter((t) => t.status === 'done');
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in_review');
    const backlogTasks = tasks.filter((t) => t.status === 'backlog');

    lines.push(`- Total Tugas: ${tasks.length} (Selesai: ${doneTasks.length}, Dalam Proses: ${inProgressTasks.length}, Backlog: ${backlogTasks.length})`);
    lines.push('');

    for (const t of tasks) {
      const check = t.status === 'done' ? '[x]' : '[ ]';
      const assignee = t.assigned_agent ? ` (Assigned: ${t.assigned_agent})` : '';
      lines.push(`- ${check} **${t.title}** - Status: \`${t.status}\`${assignee}`);
    }
  } else {
    lines.push('Belum ada tugas Kanban yang didaftarkan.');
  }
  lines.push('');

  // 4. Berkas & Kode yang Dihasilkan
  lines.push('## 4. Berkas & Kode yang Dihasilkan');
  lines.push('');
  if (codeItems.length > 0) {
    lines.push(`Ditemukan ${codeItems.length} artefak kode yang dihasilkan selama diskusi proyek:`);
    lines.push('');
    for (const item of codeItems) {
      lines.push(`### \`${item.filename}\` (${item.language})`);
      lines.push(`- Dihasilkan oleh: **${item.agentName}** (${item.agentRole})`);
      lines.push('```' + (item.language || 'text'));
      lines.push(item.content.trim());
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('Tidak ada potongan kode terpisah yang terdeteksi dalam sesi ini.');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Laporan ini dibuat otomatis oleh Agentic Native Hub untuk konsumsi AI & dokumentasi tim.*');

  const cleanGoal = sanitizeFileName(discussion.project_goal || 'projek');
  const filename = `laporan-projek-${cleanGoal}-${fileDate}.md`;

  downloadMarkdownFile(filename, lines.join('\n'));
};
