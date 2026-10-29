import React, { useState } from 'react';
import {
  Server,
  Plus,
  Trash2,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  Globe,
  FileJson,
  X,
  Edit2,
  Wrench,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { McpServerConfig } from '../../types';

export const McpServersTab: React.FC = () => {
  const {
    mcpServers,
    mcpTools,
    mcpStatuses,
    fetchMcpServers,
    fetchMcpTools,
    saveMcpServer,
    deleteMcpServer,
    toggleMcpServer,
    importMcpConfigJson,
    addToast,
  } = useStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'sse'>('stdio');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formEnv, setFormEnv] = useState('');
  const [formUrl, setFormUrl] = useState('');

  // Import JSON state
  const [importJsonText, setImportJsonText] = useState('');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchMcpServers();
      await fetchMcpTools();
      addToast('info', 'Status server dan tool MCP berhasil diperbarui.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const openAddModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormTransport('stdio');
    setFormCommand('');
    setFormArgs('');
    setFormEnv('');
    setFormUrl('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (server: McpServerConfig) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormTransport(server.transport);
    setFormCommand(server.command || '');
    setFormArgs((server.args || []).join(' '));
    const envStr = Object.entries(server.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    setFormEnv(envStr);
    setFormUrl(server.url || '');
    setIsAddModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      addToast('error', 'Nama server tidak boleh kosong.');
      return;
    }

    if (formTransport === 'stdio' && !formCommand.trim()) {
      addToast('error', 'Command eksekusi subprocess wajib diisi untuk transport stdio.');
      return;
    }

    if (formTransport === 'sse' && !formUrl.trim()) {
      addToast('error', 'URL SSE wajib diisi untuk transport sse.');
      return;
    }

    // Parse args
    const parsedArgs = formArgs
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0);

    // Parse env
    const parsedEnv: Record<string, string> = {};
    formEnv
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('='))
      .forEach((line) => {
        const idx = line.indexOf('=');
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) parsedEnv[k] = v;
      });

    const newConfig: McpServerConfig = {
      id: editingServer ? editingServer.id : `mcp_${Date.now()}`,
      name: trimmedName,
      transport: formTransport,
      command: formTransport === 'stdio' ? formCommand.trim() : undefined,
      args: formTransport === 'stdio' ? parsedArgs : [],
      env: parsedEnv,
      url: formTransport === 'sse' ? formUrl.trim() : undefined,
      is_active: editingServer ? editingServer.is_active : true,
    };

    try {
      await saveMcpServer(newConfig);
      setIsAddModalOpen(false);
    } catch {
      // error handled in store toast
    }
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      addToast('error', 'Teks JSON konfigurasi tidak boleh kosong.');
      return;
    }
    try {
      await importMcpConfigJson(importJsonText);
      setIsImportModalOpen(false);
      setImportJsonText('');
    } catch {
      // toast handled in store
    }
  };

  const activeCount = mcpServers.filter((s) => s.is_active).length;

  return (
    <div className="space-y-5 max-w-4xl text-[#ececec]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#303030] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#ececec]" />
            <h3 className="text-sm font-semibold text-[#ececec]">Model Context Protocol (MCP)</h3>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Integrasikan tool eksternal via stdio atau SSE. Semua pemanggilan tool MCP mewajibkan izin Human-in-the-Loop.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-3 rounded-xl bg-[#212121] hover:bg-[#2d2d2d] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
            title="Refresh status server dan tool"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-8 px-3 rounded-xl bg-[#212121] hover:bg-[#2d2d2d] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
            title="Impor konfigurasi claude_desktop_config.json atau mcp.json"
          >
            <FileJson className="w-3.5 h-3.5 text-[#ececec]" />
            <span>Impor JSON</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="h-8 px-3 rounded-xl bg-[#ececec] hover:bg-white text-xs font-medium text-[#171717] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Server</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-[#262626] border border-[#383838] rounded-2xl">
          <div className="text-[11px] text-[#707070] uppercase font-semibold tracking-wider">Total Server</div>
          <div className="text-lg font-bold text-[#ececec] mt-1">{mcpServers.length}</div>
        </div>
        <div className="p-3 bg-[#262626] border border-[#383838] rounded-2xl">
          <div className="text-[11px] text-[#707070] uppercase font-semibold tracking-wider">Server Aktif</div>
          <div className="text-lg font-bold text-[#ececec] mt-1">{activeCount}</div>
        </div>
        <div className="p-3 bg-[#262626] border border-[#383838] rounded-2xl">
          <div className="text-[11px] text-[#707070] uppercase font-semibold tracking-wider">Tool Terhubung</div>
          <div className="text-lg font-bold text-[#ececec] mt-1">{mcpTools.length}</div>
        </div>
      </div>

      {/* Server List */}
      {mcpServers.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[#383838] rounded-2xl bg-[#262626]/40 text-xs text-[#707070] space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#2f2f2f] border border-[#383838] flex items-center justify-center mx-auto text-[#ececec]">
            <Server className="w-5 h-5 text-[#b4b4b4]" />
          </div>
          <div>
            <div className="font-semibold text-[#ececec] text-sm">Belum Ada Server MCP</div>
            <p className="mt-1 max-w-md mx-auto">
              Daftarkan server MCP lokal (misal paket npm via npx atau uvx) atau impor file konfigurasi standar Claude Desktop / Cursor.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="h-8 px-3 rounded-xl bg-[#212121] hover:bg-[#2d2d2d] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Impor Config JSON</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="h-8 px-3 rounded-xl bg-[#ececec] hover:bg-white text-xs font-medium text-[#171717] transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Server Baru</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {mcpServers.map((server) => {
            const status = mcpStatuses.find((s) => s.id === server.id);
            const serverTools = mcpTools.filter((t) => t.server_id === server.id);
            const isExpanded = expandedServerId === server.id;

            return (
              <div
                key={server.id}
                className="bg-[#262626] border border-[#383838] rounded-2xl overflow-hidden transition-colors"
              >
                {/* Card Header Row */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setExpandedServerId(isExpanded ? null : server.id)}
                      className="text-[#707070] hover:text-[#ececec] transition-colors p-1"
                      title={isExpanded ? 'Tutup daftar tool' : 'Lihat daftar tool'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-[#ececec]">{server.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#212121] border border-[#383838] text-[#b4b4b4]">
                          {server.transport}
                        </span>

                        {server.is_active ? (
                          status?.is_connected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#ececec] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ececec]" />
                              <span>Terhubung ({status.tools_count} tool)</span>
                            </span>
                          ) : status?.error_message ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-[#ececec] font-medium truncate max-w-xs"
                              title={status.error_message}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e8e]" />
                              <span className="truncate">Gagal: {status.error_message}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#b4b4b4] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ececec] animate-pulse" />
                              <span>Menghubungkan...</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#707070]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#707070]" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-[#707070] mt-0.5 truncate max-w-xl">
                        {server.transport === 'stdio' ? (
                          <span>
                            {server.command} {(server.args || []).join(' ')}
                          </span>
                        ) : (
                          <span>{server.url}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => toggleMcpServer(server.id, !server.is_active)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        server.is_active
                          ? 'bg-[#2f2f2f] text-[#ececec] border-[#4f4f4f] hover:bg-[#383838]'
                          : 'bg-[#212121] text-[#707070] border-[#383838] hover:bg-[#2d2d2d] hover:text-[#ececec]'
                      }`}
                    >
                      {server.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(server)}
                      className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#2f2f2f] transition-colors"
                      title="Edit konfigurasi server"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => deleteMcpServer(server.id)}
                      className="p-1.5 rounded-lg text-[#707070] hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Hapus server"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Tool List Inspector */}
                {isExpanded && (
                  <div className="border-t border-[#303030] bg-[#212121]/60 p-3.5 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#707070] flex items-center justify-between">
                      <span>Daftar Tool yang Diekspos ({serverTools.length})</span>
                      {server.env && Object.keys(server.env).length > 0 && (
                        <span className="font-mono lowercase text-[#707070]">
                          {Object.keys(server.env).length} env variables
                        </span>
                      )}
                    </div>

                    {serverTools.length === 0 ? (
                      <div className="text-xs text-[#707070] italic py-2">
                        {server.is_active
                          ? 'Tidak ada tool yang ditemukan atau server belum selesai merespons tools/list.'
                          : 'Server sedang nonaktif. Aktifkan server untuk menghubungkan tool.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {serverTools.map((tool) => (
                          <div
                            key={tool.namespaced_name}
                            className="p-2.5 rounded-xl bg-[#262626] border border-[#383838] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span className="font-mono font-semibold text-[#ececec]">
                                  {tool.namespaced_name}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-[#707070] px-1.5 py-0.5 rounded bg-[#212121] border border-[#303030]">
                                {tool.original_name}
                              </span>
                            </div>
                            <p className="text-[#b4b4b4] text-[11px] leading-relaxed">
                              {tool.description || 'Tidak ada deskripsi tool.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-[#212121] border border-[#383838] rounded-3xl p-5 text-[#ececec] space-y-4 shadow-none">
            <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#ececec]" />
                <h4 className="text-sm font-semibold text-[#ececec]">
                  {editingServer ? 'Edit Konfigurasi Server MCP' : 'Tambah Server MCP Baru'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2f2f2f]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                  Nama Server (Identifier)
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="misal: filesystem, github, fetch"
                  className="w-full h-8 px-3 rounded-xl bg-[#262626] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                  Tipe Transport
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTransport('stdio')}
                    className={`flex-1 h-8 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      formTransport === 'stdio'
                        ? 'bg-[#2f2f2f] text-white border-[#4f4f4f] font-semibold'
                        : 'bg-[#212121] text-[#707070] border-[#383838] hover:bg-[#262626]'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>stdio (Subprocess)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTransport('sse')}
                    className={`flex-1 h-8 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      formTransport === 'sse'
                        ? 'bg-[#2f2f2f] text-white border-[#4f4f4f] font-semibold'
                        : 'bg-[#212121] text-[#707070] border-[#383838] hover:bg-[#262626]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>sse (HTTP EventStream)</span>
                  </button>
                </div>
              </div>

              {formTransport === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                      Command Executable
                    </label>
                    <input
                      type="text"
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      placeholder="misal: npx, node, uvx, python3"
                      className="w-full h-8 px-3 rounded-xl bg-[#262626] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none font-mono"
                      required={formTransport === 'stdio'}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                      Arguments (pisahkan dengan spasi)
                    </label>
                    <input
                      type="text"
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                      placeholder="misal: -y @modelcontextprotocol/server-filesystem /home/user/project"
                      className="w-full h-8 px-3 rounded-xl bg-[#262626] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                      Environment Variables (satu per baris, format KEY=VALUE)
                    </label>
                    <textarea
                      value={formEnv}
                      onChange={(e) => setFormEnv(e.target.value)}
                      placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx&#10;DEBUG=1"
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-[#262626] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none font-mono resize-none text-xs"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1">
                    URL Endpoint SSE
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="misal: http://localhost:8000/sse"
                    className="w-full h-8 px-3 rounded-xl bg-[#262626] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none font-mono"
                    required={formTransport === 'sse'}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#303030]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 px-3 rounded-xl bg-[#262626] hover:bg-[#303030] text-[#ececec] border border-[#383838]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] font-semibold"
                >
                  Simpan Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-[#212121] border border-[#383838] rounded-3xl p-5 text-[#ececec] space-y-4 shadow-none">
            <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-[#ececec]" />
                <h4 className="text-sm font-semibold text-[#ececec]">
                  Impor Konfigurasi MCP (Claude Desktop / Cursor)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2f2f2f]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#707070]">
              Tempelkan konten berkas <span className="font-mono text-[#ececec]">claude_desktop_config.json</span> atau{' '}
              <span className="font-mono text-[#ececec]">mcp.json</span> di bawah ini:
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}`}
              rows={10}
              className="w-full p-3 rounded-xl bg-[#171717] border border-[#383838] focus:border-[#4f4f4f] text-[#ececec] outline-none font-mono resize-none text-xs leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#303030]">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="h-8 px-3 rounded-xl bg-[#262626] hover:bg-[#303030] text-[#ececec] border border-[#383838] text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="h-8 px-4 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] font-semibold text-xs"
              >
                Impor Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
