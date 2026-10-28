import { check } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  version: string;
  notes?: string;
  date?: string;
}

/**
 * Pengecekan pembaruan otomatis di latar belakang saat aplikasi dijalankan.
 * Jika versi baru tersedia, paket akan langsung diunduh secara senyap.
 */
export async function checkAndDownloadUpdateSilently(
  onUpdateDownloaded: (info: UpdateInfo) => void
): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      return;
    }

    // Unduh paket update di latar belakang tanpa memblokir aktivitas operator
    await update.downloadAndInstall();

    onUpdateDownloaded({
      version: update.version,
      notes: update.body || 'Pembaruan stabilitas dan peningkatan fitur.',
      date: update.date,
    });
  } catch (error) {
    console.error('Pengecekan update latar belakang gagal:', error);
  }
}

/**
 * Memulai ulang aplikasi untuk menerapkan versi baru yang telah terunduh.
 */
export async function applyUpdateAndRestart(): Promise<void> {
  try {
    await invoke('relaunch_app');
  } catch (error) {
    console.error('Gagal me-restart aplikasi via native command:', error);
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (pluginError) {
      console.error('Gagal me-restart aplikasi via plugin process:', pluginError);
    }
  }
}

/**
 * Pengecekan pembaruan manual yang dipicu oleh tombol di modal Pengaturan.
 */
export async function checkUpdateManually(): Promise<{
  hasUpdate: boolean;
  version?: string;
  notes?: string;
  error?: string;
}> {
  try {
    const update = await check();
    if (update) {
      return {
        hasUpdate: true,
        version: update.version,
        notes: update.body || '',
      };
    }
    return { hasUpdate: false };
  } catch (error: any) {
    return {
      hasUpdate: false,
      error: error?.message || 'Gagal memeriksa pembaruan server',
    };
  }
}
