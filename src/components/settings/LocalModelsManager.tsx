import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Download,
  Trash2,
  RotateCw,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Server,
} from 'lucide-react';

interface EngineStatus {
  is_running: boolean;
  has_model: boolean;
  status: string;
  progress: number;
  message: string;
}

export function LocalModelsManager() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsChecking(true);
    setActionError(null);
    try {
      if (typeof window !== 'undefined' && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        setEngineStatus({
          is_running: true,
          has_model: false,
          status: 'ready_no_model',
          progress: 0,
          message: 'Ollama aktif di sistem. Model belum diunduh.',
        });
        setInstalledModels([]);
        setIsChecking(false);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<EngineStatus>('get_local_engine_status');
      setEngineStatus(status);
      setDownloadProgress(status.progress);
      if (status.status === 'downloading_model') {
        setIsDownloading(true);
        setStatusMessage(status.message);
      } else {
        setIsDownloading(false);
        setStatusMessage(status.message);
      }

      if (status.is_running) {
        try {
          const models = await invoke<string[]>('get_installed_local_models');
          setInstalledModels(models);
        } catch {
          setInstalledModels([]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        if (typeof window !== 'undefined' && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
          const { listen } = await import('@tauri-apps/api/event');
          const unsub = await listen<EngineStatus>('local-engine-status-changed', (event) => {
            const st = event.payload;
            setEngineStatus(st);
            setDownloadProgress(st.progress);
            setStatusMessage(st.message);
            if (st.status === 'downloading_model') {
              setIsDownloading(true);
            } else {
              setIsDownloading(false);
              fetchStatus();
            }
          });
          unlisten = unsub;
        }
      } catch {
        // ignore in non-tauri environment
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchStatus]);

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setActionError(null);
    setStatusMessage('Memulai pengunduhan model LFM3 1.7B...');
    try {
      if (typeof window !== 'undefined' && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        setTimeout(() => {
          setIsDownloading(false);
          setDownloadProgress(100);
          setEngineStatus({
            is_running: true,
            has_model: true,
            status: 'ready',
            progress: 100,
            message: 'Model LFM3 siap digunakan',
          });
          setInstalledModels(['lfm3:1.7b']);
        }, 1500);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('download_local_model');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
      setIsDownloading(false);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!window.confirm(`Hapus model "${modelName}" dari penyimpanan lokal?`)) {
      return;
    }
    setActionError(null);
    try {
      if (typeof window !== 'undefined' && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        setInstalledModels((prev) => prev.filter((m) => m !== modelName));
        setEngineStatus((prev) => prev ? { ...prev, has_model: false, status: 'ready_no_model' } : null);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_local_model', { modelName });
      await fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    }
  };

  const hasLfm3 = engineStatus?.has_model || installedModels.some((m) => m.startsWith('lfm3:1.7b') || m.startsWith('hf.co/bartowski/LFM3'));

  return (
    <div className="space-y-6">
      {/* Header Info Status Engine */}
      <div className="p-4 rounded-2xl bg-[#262626] border border-[#383838] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#ececec]" />
            <h3 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
              Status Runtime Ollama
            </h3>
          </div>
          <button
            type="button"
            onClick={fetchStatus}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#b4b4b4] hover:text-[#ececec] bg-[#1f1f1f] border border-[#333333] hover:border-[#444444] transition-colors"
          >
            <RotateCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Periksa Status</span>
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              engineStatus?.is_running ? 'bg-[#39d353]' : 'bg-[#707070]'
            }`}
          />
          <div className="text-xs">
            <span className="font-semibold text-[#ececec]">
              {engineStatus?.is_running
                ? 'Ollama Aktif (Port 11434)'
                : 'Ollama Tidak Terdeteksi'}
            </span>
            <span className="text-[#8b949e] ml-2">
              {engineStatus?.message || 'Memeriksa koneksi...'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#707070] leading-relaxed pt-1 border-t border-[#303030]">
          Nodra terhubung langsung ke layanan Ollama di sistem Anda tanpa menyertakan binary runtime bawaan. Pastikan Ollama telah terpasang di komputer Anda jika ingin menjalankan inferensi secara offline.
        </p>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Kartu Model Utama: LFM3 1.7B */}
      <div className="p-5 rounded-2xl bg-[#262626] border border-[#383838] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#39d353]" />
              <h4 className="text-sm font-semibold text-[#ececec]">
                Liquid Foundation Model (LFM3 1.7B)
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1f1f1f] border border-[#333333] text-[#b4b4b4]">
                GGUF Q4_K_M
              </span>
            </div>
            <p className="text-xs text-[#8b949e]">
              Model penalaran lokal terpadu (1.73B parameters, 256K context window). Bekerja 100% offline di memori CPU/RAM tanpa memerlukan kunci API.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasLfm3 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0e4429] border border-[#006d32] text-xs font-semibold text-[#39d353]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terinstal</span>
              </div>
            ) : isDownloading ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1f1f1f] border border-[#333333] text-xs font-medium text-[#b4b4b4]">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-[#58a6ff]" />
                <span>Mengunduh...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1f1f1f] border border-[#333333] text-xs font-medium text-[#707070]">
                <span>Belum Diunduh</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar saat Downloading */}
        {isDownloading && (
          <div className="space-y-2 pt-2 border-t border-[#303030]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ececec] font-medium truncate max-w-[280px]">
                {statusMessage || 'Mengunduh bobot model...'}
              </span>
              <span className="font-mono text-[#39d353] font-semibold">
                {downloadProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#171717] overflow-hidden border border-[#303030]">
              <div
                className="h-full bg-[#26a641] transition-all duration-300"
                style={{ width: `${Math.max(2, downloadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#303030]">
          <div className="flex items-center gap-2 text-xs text-[#707070]">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Ukuran berkas: ~1.11 GB</span>
          </div>

          <div className="flex items-center gap-2">
            {!hasLfm3 ? (
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={isDownloading || !engineStatus?.is_running}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#ececec] hover:bg-white text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Model (1.1 GB)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDeleteModel('lfm3:1.7b')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#1f1f1f] hover:bg-rose-950/40 text-rose-300 border border-[#383838] hover:border-rose-800/40 transition-colors"
                title="Hapus model untuk menghemat ruang disk"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Hapus Model</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Daftar Model Lokal Lainnya yang Terdeteksi di Ollama */}
      {installedModels.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#262626] border border-[#383838] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
            <h4 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
              Model Terpasang di Ollama ({installedModels.length})
            </h4>
            <span className="text-[11px] text-[#707070]">Siap digunakan langsung di chat</span>
          </div>

          <div className="space-y-2">
            {installedModels.map((m) => (
              <div
                key={m}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#1f1f1f] border border-[#303030]"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#39d353]" />
                  <span className="text-xs font-mono font-medium text-[#ececec]">{m}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteModel(m)}
                  className="p-1.5 rounded-lg hover:bg-rose-950/40 text-[#707070] hover:text-rose-400 transition-colors"
                  title={`Hapus model ${m}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
