import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal, CheckCircle2, AlertCircle, Plus, Cpu, Play, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CliAgentMetadata } from '../../types';

export const AgentRosterModal: React.FC = () => {
  const {
    isAgentRosterModalOpen,
    setIsAgentRosterModalOpen,
    installedCliAgents,
    isDetectingCliAgents,
    refreshInstalledCliAgents,
    orchestratorConfig,
    setOrchestratorConfig,
    spawnTerminalWorker,
    selectedModel,
  } = useStore();

  const [selectedAgentForRole, setSelectedAgentForRole] = useState<string | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<string>('Coder');
  const [taskSpecInput, setTaskSpecInput] = useState<string>('');
  const [isSpawning, setIsSpawning] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPath, setCustomPath] = useState<string>('');
  const [isAddingCustom, setIsAddingCustom] = useState<boolean>(false);

  useEffect(() => {
    if (isAgentRosterModalOpen) {
      refreshInstalledCliAgents();
    }
  }, [isAgentRosterModalOpen, refreshInstalledCliAgents]);

  if (!isAgentRosterModalOpen) return null;

  const handleSelectOrchestrator = (type: 'api' | 'terminal', agentId?: string) => {
    if (type === 'api') {
      setOrchestratorConfig({ type: 'api', modelId: selectedModel });
    } else if (agentId) {
      setOrchestratorConfig({ type: 'terminal', agentId });
    }
  };

  const handleLaunchWorker = async (agent: CliAgentMetadata) => {
    setIsSpawning(true);
    try {
      await spawnTerminalWorker(agent.id, roleToAssign, taskSpecInput);
      setTaskSpecInput('');
      setSelectedAgentForRole(null);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#212121] border border-[#383838] shadow-2xl text-[#ececec] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303030] bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#2a2a2a] border border-[#383838]">
              <Terminal className="w-5 h-5 text-[#ececec]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#ececec]">
                Roster Agen & Orkestrasi Terminal
              </h2>
              <p className="text-xs text-[#8e8e8e]">
                Pilih agen orkestrator dan jalankan agen pekerja dari sistem lokal Anda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshInstalledCliAgents()}
              disabled={isDetectingCliAgents}
              title="Pindai ulang biner agen di PATH"
              className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isDetectingCliAgents ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAgentRosterModalOpen(false)}
              className="p-2 rounded-lg hover:bg-[#2a2a2a] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1: Mode Kepemimpinan (Orchestrator Role) */}
          <div className="rounded-xl p-4 bg-[#262626] border border-[#333333]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9e9e9e] mb-3">
              Kepemimpinan Orkestrator Aktif
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option A: API Model as Orchestrator */}
              <button
                onClick={() => handleSelectOrchestrator('api')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  orchestratorConfig.type === 'api'
                    ? 'bg-[#2f2f2f] border-[#ececec] text-[#ececec]'
                    : 'bg-[#212121] border-[#383838] text-[#b4b4b4] hover:border-[#4f4f4f]'
                }`}
              >
                <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#383838] mt-0.5">
                  <Cpu className="w-4 h-4 text-[#ececec]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#ececec]">Model Cloud / Local API</span>
                    {orchestratorConfig.type === 'api' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#3a3a3a] text-[#ececec]">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8e8e8e] mt-1">
                    Dipimpin oleh {selectedModel || 'Gemini 2.5 Flash'} via integrasi API key
                  </p>
                </div>
              </button>

              {/* Option B: Terminal CLI Agent as Orchestrator */}
              <div
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  orchestratorConfig.type === 'terminal'
                    ? 'bg-[#2f2f2f] border-[#ececec] text-[#ececec]'
                    : 'bg-[#212121] border-[#383838] text-[#b4b4b4]'
                }`}
              >
                <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#383838] mt-0.5">
                  <Terminal className="w-4 h-4 text-[#ececec]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#ececec]">Agen CLI Terminal</span>
                    {orchestratorConfig.type === 'terminal' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#3a3a3a] text-[#ececec]">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8e8e8e] mt-1">
                    {orchestratorConfig.type === 'terminal'
                      ? `Dipimpin oleh ${orchestratorConfig.agentId || 'agen terminal'}`
                      : 'Pilih agen di bawah untuk menjadi pimpinan'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Daftar Agen Terdeteksi di Sistem */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9e9e9e]">
                Agen Terdeteksi di Komputer Pengguna ({installedCliAgents.filter((a) => a.is_installed).length} Ditemukan)
              </h3>
              <button
                onClick={() => setIsAddingCustom(!isAddingCustom)}
                className="text-xs text-[#ececec] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Biner Kustom
              </button>
            </div>

            {/* Custom Binary Form */}
            {isAddingCustom && (
              <div className="mb-4 p-4 rounded-xl bg-[#262626] border border-[#383838] space-y-3">
                <div className="text-xs font-medium text-[#ececec]">Daftarkan Perintah Agen Mandiri</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nama Agen (misal: Aider Custom)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#1a1a1a] border border-[#383838] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
                  />
                  <input
                    type="text"
                    placeholder="Jalur Eksekusi atau Perintah (misal: /usr/local/bin/aider)"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#1a1a1a] border border-[#383838] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingCustom(false)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#2a2a2a] text-[#b4b4b4] hover:text-[#ececec]"
                  >
                    Batal
                  </button>
                  <button
                    disabled={!customName.trim() || !customPath.trim()}
                    onClick={() => {
                      setIsAddingCustom(false);
                      setCustomName('');
                      setCustomPath('');
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#ececec] text-[#171717] font-medium disabled:opacity-50"
                  >
                    Simpan Agen
                  </button>
                </div>
              </div>
            )}

            {/* Agent List Cards */}
            <div className="grid grid-cols-1 gap-3">
              {installedCliAgents.map((agent) => {
                const isOrchestrator =
                  orchestratorConfig.type === 'terminal' && orchestratorConfig.agentId === agent.id;
                const isConfiguringWorker = selectedAgentForRole === agent.id;

                return (
                  <div
                    key={agent.id}
                    className="flex flex-col p-4 rounded-xl bg-[#2a2a2a] border border-[#333333] hover:border-[#444444] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#383838]">
                          <Terminal className="w-4 h-4 text-[#ececec]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#ececec]">{agent.name}</span>
                            {agent.is_installed ? (
                              <span className="flex items-center gap-1 text-[11px] text-[#4ade80] bg-[#1a3a22] px-2 py-0.5 rounded-full border border-[#22c55e]/30">
                                <CheckCircle2 className="w-3 h-3" />
                                {agent.version ? `v${agent.version}` : 'Terpasang'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] text-[#8e8e8e] bg-[#1e1e1e] px-2 py-0.5 rounded-full border border-[#383838]">
                                <AlertCircle className="w-3 h-3" />
                                Tidak Ditemukan di PATH
                              </span>
                            )}
                            {agent.supports_mcp && (
                              <span className="text-[10px] text-[#b4b4b4] bg-[#222222] px-2 py-0.5 rounded border border-[#383838]">
                                MCP Ready
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#707070] mt-0.5 font-mono truncate max-w-md">
                            {agent.path || agent.binary_name}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {agent.is_installed && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectOrchestrator('terminal', agent.id)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                              isOrchestrator
                                ? 'bg-[#ececec] text-[#171717] font-medium border-[#ececec]'
                                : 'bg-[#1f1f1f] text-[#b4b4b4] border-[#383838] hover:text-[#ececec] hover:border-[#4f4f4f]'
                            }`}
                          >
                            {isOrchestrator ? 'Pimpinan Aktif' : 'Jadikan Orchestrator'}
                          </button>

                          <button
                            onClick={() =>
                              setSelectedAgentForRole(isConfiguringWorker ? null : agent.id)
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#333333] hover:bg-[#3d3d3d] text-[#ececec] border border-[#444444] transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Jalankan Worker
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Launch Worker Inline Drawer */}
                    {isConfiguringWorker && (
                      <div className="mt-4 pt-4 border-t border-[#383838] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#b4b4b4] font-medium">
                            Konfigurasi Peran & Instruksi Kerja:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {['Lead Architect', 'Coder', 'Reviewer', 'Tester'].map((role) => (
                              <button
                                key={role}
                                onClick={() => setRoleToAssign(role)}
                                className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                                  roleToAssign === role
                                    ? 'bg-[#ececec] text-[#171717] font-medium border-[#ececec]'
                                    : 'bg-[#1a1a1a] text-[#8e8e8e] border-[#383838] hover:text-[#ececec]'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Instruksi awal spesifik (opsional, misal: 'Audit keamanan modul auth')..."
                            value={taskSpecInput}
                            onChange={(e) => setTaskSpecInput(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#1a1a1a] border border-[#383838] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
                          />
                          <button
                            disabled={isSpawning}
                            onClick={() => handleLaunchWorker(agent)}
                            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#ececec] text-[#171717] hover:bg-[#ffffff] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Mulai di Terminal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#303030] bg-[#1a1a1a] flex items-center justify-between text-xs text-[#8e8e8e]">
          <span>
            Agen terminal dapat dipanggil langsung dari dock studio atau melalui protokol inter-agent MCP.
          </span>
          <button
            onClick={() => setIsAgentRosterModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#ececec] border border-[#383838] transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
