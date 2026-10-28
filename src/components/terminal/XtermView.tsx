import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../../store/useStore';

interface XtermViewProps {
  tabId: string;
  isActive: boolean;
}

export const XtermView: React.FC<XtermViewProps> = ({ tabId, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Inisialisasi xterm.js langsung pada ref kontainer
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#141414',
        foreground: '#ececec',
        cursor: '#ececec',
        selectionBackground: '#264f78',
        black: '#1f1f1f',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#e5e5e5',
        brightBlack: '#737373',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let unlistenChannel: (() => void) | null = null;
    let isDisposed = false;
    let isPtyReady = false;
    const inputBuffer: string[] = [];

    const flushInputBuffer = () => {
      isPtyReady = true;
      while (inputBuffer.length > 0) {
        const item = inputBuffer.shift();
        if (item) {
          invoke('terminal_pty_write', { tabId, data: item }).catch(() => {});
        }
      }
    };

    // Pasang listener event channel PTY khusus sesi ini
    listen<string>(`terminal-output-${tabId}`, (event) => {
      if (!isDisposed && event.payload) {
        term.write(event.payload);
      }
    }).then(async (fnChannel) => {
      if (isDisposed) {
        fnChannel();
        return;
      }
      unlistenChannel = fnChannel;

      // Inisialisasi PTY setelah listener terpasang
      try {
        try {
          fitAddon.fit();
        } catch (_) {}
        const rows = term.rows && term.rows > 0 ? term.rows : 24;
        const cols = term.cols && term.cols > 0 ? term.cols : 80;

        const currentTab = useStore.getState().terminalTabs.find((t) => t.id === tabId);
        await invoke('init_terminal_pty', {
          tabId,
          rows,
          cols,
          cwd: currentTab?.cwd || undefined,
        });

        flushInputBuffer();

        // Eksekusi initialCommand jika tab memiliki perintah awal (seperti peluncuran agen)
        if (currentTab?.initialCommand) {
          const rawCmd = currentTab.initialCommand;
          useStore.getState().consumeInitialCommand(tabId);
          const cleanCmd = rawCmd.replace(/[\r\n]+$/, '').trim();
          const cmd = `${cleanCmd}\r\n`;

          // Berikan jeda 350ms agar prompt shell dan readline selesai inisialisasi
          setTimeout(async () => {
            if (isDisposed) return;
            try {
              await invoke('terminal_pty_write', { tabId, data: cmd });
            } catch (e) {
              console.warn('Gagal menulis initialCommand ke PTY:', e);
            }
          }, 350);
        }
      } catch (e) {
        console.warn('Error saat initial fit terminal atau eksekusi perintah:', e);
      }
      term.focus();
    });

    // Kirim input ketikan pengguna langsung ke PTY backend (dengan buffer jika PTY belum siap)
    const onDataDisposable = term.onData((data) => {
      if (!isPtyReady) {
        inputBuffer.push(data);
        return;
      }
      invoke('terminal_pty_write', { tabId, data }).catch((err) => {
        console.warn('Gagal menulis ke PTY:', err);
      });
    });

    // Observer otomatis untuk resize container
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !isActive || isDisposed) return;
      try {
        fitAddon.fit();
        const rows = term.rows;
        const cols = term.cols;
        if (rows && cols) {
          invoke('terminal_pty_resize', { tabId, rows, cols }).catch(() => {});
        }
      } catch (_) {}
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (unlistenChannel) unlistenChannel();

      // Sesi PTY dipertahankan saat tab berpindah panel (hanya ditutup saat tab dihapus permanen)
      term.dispose();
    };
  }, [tabId]);

  // Efek ketika tab menjadi aktif
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
        } catch (_) {}
      }, 30);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{ display: isActive ? 'block' : 'none' }}
      className="absolute inset-0 w-full h-full p-2 bg-[#141414] select-text cursor-text overflow-hidden"
      onClick={() => termRef.current?.focus()}
    />
  );
};
