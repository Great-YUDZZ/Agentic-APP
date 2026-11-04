import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  version: string;
  notes?: string;
  date?: string;
}

let activeUpdateInstance: Update | null = null;

/**
 * Pengecekan pembaruan di latar belakang tanpa mengunduh otomatis.
 * Hanya mendeteksi apakah versi baru tersedia dan TIDAK memicu instalasi mendadak.
 */
export async function checkUpdateAvailableSilently(
  onUpdateAvailable: (info: UpdateInfo) => void
): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      activeUpdateInstance = null;
      return;
    }

    activeUpdateInstance = update;

    onUpdateAvailable({
      version: update.version,
      notes: update.body || 'Pembaruan stabilitas dan peningkatan fitur.',
      date: update.date,
    });
  } catch (error) {
    console.warn('Pengecekan update latar belakang gagal:', error);
  }
}

// Alias untuk kompatibilitas ke belakang
export const checkAndDownloadUpdateSilently = checkUpdateAvailableSilently;

/**
 * Mengunduh dan memasang pembaruan setelah disetujui secara eksplisit oleh operator.
 */
export async function downloadAndInstallConfirmedUpdate(): Promise<boolean> {
  try {
    let update = activeUpdateInstance;
    if (!update) {
      update = await check();
      activeUpdateInstance = update;
    }

    if (!update) {
      throw new Error('Tidak ada pembaruan aktif untuk dipasang.');
    }

    // Unduh dan pasang paket update secara eksplisit atas persetujuan operator
    await update.downloadAndInstall();
    return true;
  } catch (error) {
    console.error('Gagal memasang pembaruan:', error);
    throw error;
  }
}

/**
 * Memulai ulang aplikasi untuk menerapkan versi baru yang telah terpasang.
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
      activeUpdateInstance = update;
      return {
        hasUpdate: true,
        version: update.version,
        notes: update.body || '',
      };
    }
    activeUpdateInstance = null;
    return { hasUpdate: false };
  } catch (error: any) {
    return {
      hasUpdate: false,
      error: error?.message || 'Gagal memeriksa pembaruan server',
    };
  }
}
