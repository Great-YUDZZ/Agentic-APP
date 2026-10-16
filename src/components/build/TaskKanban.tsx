import React, { useState } from 'react';
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  User,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { KanbanTask } from '../../types';

const COLUMNS: { id: KanbanTask['status']; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'in_review', title: 'In Review' },
  { id: 'done', title: 'Done' },
];

export const TaskKanban: React.FC = () => {
  const { kanbanTasks, setKanbanTasks, updateTaskStatus, addToast } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAgent, setNewAgent] = useState('Coder Agent #1');
  const [newPriority, setNewPriority] = useState<KanbanTask['priority']>('medium');

  const moveTask = (taskId: string, direction: 'prev' | 'next') => {
    const task = kanbanTasks.find((t) => t.id === taskId);
    if (!task) return;

    const statusOrder: KanbanTask['status'][] = ['backlog', 'in_progress', 'in_review', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      const nextStatus = statusOrder[nextIndex];
      updateTaskStatus(taskId, nextStatus);
      addToast('info', `Pindah ke ${nextStatus.replace('_', ' ')}`);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: KanbanTask = {
      id: `T-${Math.floor(100 + Math.random() * 900)}`,
      title: newTitle.trim(),
      status: 'backlog',
      assigned_agent: newAgent,
      priority: newPriority,
      progress: 0,
    };

    setKanbanTasks([...kanbanTasks, newTask]);
    setNewTitle('');
    setShowAddModal(false);
    addToast('success', `Tugas dibuat: ${newTask.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#212121] p-6 overflow-x-auto select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#262626] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#b4b4b4]">
            Tugas Proyek Aktif
          </span>
          <span className="text-xs text-[#707070] font-mono">({kanbanTasks.length})</span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Tugas</span>
        </button>
      </div>

      {/* 4 Columns Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-y-auto">
        {COLUMNS.map((col) => {
          const colTasks = kanbanTasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl bg-[#171717] border border-[#303030] p-3 h-full overflow-hidden"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-2.5">
                <span className="text-xs font-semibold text-[#ececec]">{col.title}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#212121] text-[#b4b4b4] border border-[#303030]">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-[#707070] italic rounded-xl border border-dashed border-[#303030]">
                    Kosong
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-xl bg-[#2f2f2f] border border-[#383838] hover:border-[#4a4a4a] transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#b4b4b4]">{task.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#212121] text-[#ececec] border border-[#303030] uppercase font-mono">
                          {task.priority}
                        </span>
                      </div>

                      <p className="text-xs text-[#ececec] leading-snug">{task.title}</p>

                      <div className="flex items-center gap-1.5 text-[10px] text-[#b4b4b4]">
                        <User className="w-3 h-3 text-[#707070]" />
                        <span className="truncate">{task.assigned_agent}</span>
                      </div>

                      {/* Clean progress bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-[#212121] rounded-full h-1 overflow-hidden">
                          <div
                            className="h-1 rounded-full bg-[#ececec]"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Card Move Controls */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#383838]">
                        <button
                          onClick={() => moveTask(task.id, 'prev')}
                          disabled={task.status === 'backlog'}
                          className="p-1 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838] disabled:opacity-20 transition-colors"
                          title="Tahap sebelumnya"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveTask(task.id, 'next')}
                          disabled={task.status === 'done'}
                          className="p-1 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838] disabled:opacity-20 transition-colors"
                          title="Tahap berikutnya"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#171717] border border-[#303030] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-sm font-semibold text-[#ececec]">Buat Tugas Baru</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#b4b4b4] hover:text-[#ececec]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[#b4b4b4]">Judul Tugas</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Deskripsi tugas yang harus diselesaikan..."
                  className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#b4b4b4]">Ditugaskan Kepada</label>
                  <select
                    value={newAgent}
                    onChange={(e) => setNewAgent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec] focus:outline-none focus:border-[#404040] appearance-none"
                  >
                    <option value="Lead Architect" className="bg-[#212121] text-[#ececec]">Lead Architect</option>
                    <option value="Coder Agent #1" className="bg-[#212121] text-[#ececec]">Coder Agent #1</option>
                    <option value="Reviewer Agent" className="bg-[#212121] text-[#ececec]">Reviewer Agent</option>
                    <option value="Security Auditor" className="bg-[#212121] text-[#ececec]">Security Auditor</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#b4b4b4]">Prioritas</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as KanbanTask['priority'])}
                    className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec] focus:outline-none focus:border-[#404040] appearance-none"
                  >
                    <option value="low" className="bg-[#212121] text-[#ececec]">Low</option>
                    <option value="medium" className="bg-[#212121] text-[#ececec]">Medium</option>
                    <option value="high" className="bg-[#212121] text-[#ececec]">High</option>
                    <option value="critical" className="bg-[#212121] text-[#ececec]">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#303030] hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black font-medium"
                >
                  Simpan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskKanban;
