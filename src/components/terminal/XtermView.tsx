import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

    // Pasang listener event channel PTY khusus sesi ini
    listen<string>(`terminal-output-${tabId}`, (event) => {
      if (!isDisposed && event.payload) {
        term.write(event.payload);
      }
    }).then((fnChannel) => {
      if (isDisposed) {
        fnChannel();
      } else {
        unlistenChannel = fnChannel;

        // Inisialisasi PTY setelah listener terpasang
        setTimeout(() => {
          if (isDisposed) return;
          try {
            fitAddon.fit();
            const rows = term.rows || 24;
            const cols = term.cols || 80;

            invoke('init_terminal_pty', { tabId, rows, cols }).catch((err) => {
              console.warn('Gagal inisialisasi PTY:', err);
            });
          } catch (e) {
            console.warn('Error saat initial fit terminal:', e);
          }
          term.focus();
        }, 30);
      }
    });

    // Kirim input ketikan pengguna langsung ke PTY backend
    const onDataDisposable = term.onData((data) => {
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

      // Tutup sesi PTY saat tab dilepas
      invoke('close_terminal_pty', { tabId }).catch(() => {});
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
