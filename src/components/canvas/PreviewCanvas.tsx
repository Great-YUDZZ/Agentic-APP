import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, AlertCircle, FileCode } from 'lucide-react';
import { Artifact } from '../../types';

interface PreviewCanvasProps {
  artifact: Artifact;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({ artifact }) => {
  const [zoom, setZoom] = useState(1);
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = artifact.language.toLowerCase();
  const isMermaid = lang === 'mermaid' || artifact.content.trim().startsWith('graph ') || artifact.content.trim().startsWith('flowchart ') || artifact.content.trim().startsWith('sequenceDiagram');
  const isHtml = lang === 'html';
  const isSvg = lang === 'svg';
  const isMarkdown = lang === 'markdown' || lang === 'md';

  // Render Mermaid diagrams
  useEffect(() => {
    let isMounted = true;
    if (isMermaid) {
      setRenderError(null);
      import('mermaid')
        .then(async (m) => {
          const mermaid = m.default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            darkMode: true,
            themeVariables: {
              background: '#171717',
              primaryColor: '#2f2f2f',
              primaryTextColor: '#ececec',
              primaryBorderColor: '#4f4f4f',
              lineColor: '#b4b4b4',
              secondaryColor: '#262626',
              tertiaryColor: '#1e1e1e',
            },
          });
          const id = `mermaid-canvas-${Date.now()}`;
          try {
            const { svg } = await mermaid.render(id, artifact.content);
            if (isMounted) {
              setMermaidSvg(svg);
              setRenderError(null);
            }
          } catch (err: any) {
            if (isMounted) {
              setRenderError(err?.message || 'Gagal merender diagram Mermaid.');
            }
          }
        })
        .catch((err) => {
          if (isMounted) {
            setRenderError(`Modul Mermaid tidak dapat dimuat: ${err?.message || err}`);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [artifact.content, isMermaid]);

  // Zoom controls for SVG / Mermaid
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.2));
  const handleZoomReset = () => setZoom(1);

  if (isMermaid) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#171717] overflow-hidden relative select-none">
        {/* Floating Zoom Controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-[#212121] border border-[#303030] shadow-sm">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Perkecil"
            className="p-1 rounded-lg hover:bg-[#2c2c2c] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[#707070] px-1 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Perbesar"
            className="p-1 rounded-lg hover:bg-[#2c2c2c] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            title="Reset Zoom"
            className="p-1 rounded-lg hover:bg-[#2c2c2c] text-[#b4b4b4] hover:text-[#ececec] transition-colors border-l border-[#303030] ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mermaid SVG Viewport */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#171717]"
        >
          {renderError ? (
            <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] text-xs text-[#ececec] flex items-start gap-3 max-w-md">
              <AlertCircle className="w-4 h-4 text-[#ff6b6b] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#ececec]">Sintaks Diagram Tidak Valid</p>
                <p className="text-[11px] text-[#b4b4b4] font-mono whitespace-pre-wrap">{renderError}</p>
              </div>
            </div>
          ) : mermaidSvg ? (
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
              }}
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              className="max-w-full max-h-full"
            />
          ) : (
            <div className="text-xs text-[#707070] animate-pulse">Merender diagram Mermaid...</div>
          )}
        </div>
      </div>
    );
  }

  if (isHtml) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#171717] overflow-hidden relative">
        <iframe
          title="HTML Artifact Preview"
          srcDoc={artifact.content}
          sandbox="allow-scripts allow-modals"
          className="w-full h-full border-none bg-[#ffffff]"
        />
      </div>
    );
  }

  if (isSvg) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#171717] overflow-auto p-8 items-center justify-center">
        <div
          dangerouslySetInnerHTML={{ __html: artifact.content }}
          className="max-w-full max-h-full flex items-center justify-center"
        />
      </div>
    );
  }

  if (isMarkdown) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#171717] text-[#ececec] text-sm leading-relaxed space-y-4">
        {artifact.content.split('\n\n').map((block, idx) => {
          if (block.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-lg font-bold text-[#ececec] border-b border-[#303030] pb-1">
                {block.replace(/^# /, '')}
              </h1>
            );
          }
          if (block.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base font-semibold text-[#ececec] border-b border-[#303030] pb-1">
                {block.replace(/^## /, '')}
              </h2>
            );
          }
          if (block.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-semibold text-[#ececec]">
                {block.replace(/^### /, '')}
              </h3>
            );
          }
          if (block.startsWith('- ') || block.startsWith('* ')) {
            const items = block.split('\n');
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1 text-xs text-[#d1d1d1]">
                {items.map((it, i) => (
                  <li key={i}>{it.replace(/^[-*]\s*/, '')}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={idx} className="text-xs text-[#d1d1d1] whitespace-pre-wrap leading-relaxed">
              {block}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#707070] bg-[#171717] space-y-2">
      <FileCode className="w-8 h-8 text-[#4a4a4a]" />
      <p className="font-semibold text-[#ececec]">Pratinjau Visual Tidak Tersedia</p>
      <p className="text-[#b4b4b4] max-w-xs">
        Bahasa ini ({artifact.language}) tidak mendukung rendering visual langsung. Gunakan tab Kode untuk meninjau dan mengedit berkas.
      </p>
    </div>
  );
};
