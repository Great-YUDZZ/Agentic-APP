import React, { useState } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';

interface FormattedMessageProps {
  content: string;
  reasoning?: string;
  verbose?: boolean;
}

const getPrismGrammar = (lang: string) => {
  const normalized = lang.toLowerCase().trim();
  switch (normalized) {
    case 'html':
    case 'xml':
    case 'svg':
    case 'markup':
      return { grammar: Prism.languages.markup, name: 'markup' };
    case 'js':
    case 'javascript':
      return { grammar: Prism.languages.javascript, name: 'javascript' };
    case 'ts':
    case 'typescript':
      return { grammar: Prism.languages.typescript, name: 'typescript' };
    case 'jsx':
      return { grammar: Prism.languages.jsx, name: 'jsx' };
    case 'tsx':
      return { grammar: Prism.languages.tsx, name: 'tsx' };
    case 'css':
      return { grammar: Prism.languages.css, name: 'css' };
    case 'rust':
    case 'rs':
      return { grammar: Prism.languages.rust, name: 'rust' };
    case 'python':
    case 'py':
      return { grammar: Prism.languages.python, name: 'python' };
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return { grammar: Prism.languages.bash, name: 'bash' };
    case 'json':
      return { grammar: Prism.languages.json, name: 'json' };
    case 'yaml':
    case 'yml':
      return { grammar: Prism.languages.yaml, name: 'yaml' };
    case 'sql':
      return { grammar: Prism.languages.sql, name: 'sql' };
    case 'md':
    case 'markdown':
      return { grammar: Prism.languages.markdown, name: 'markdown' };
    default:
      if (Prism.languages[normalized]) {
        return { grammar: Prism.languages[normalized], name: normalized };
      }
      return null;
  }
};

const renderCodeBlock = (codeBody: string, lang: string) => {
  const grammarInfo = getPrismGrammar(lang);
  if (grammarInfo && grammarInfo.grammar) {
    try {
      const html = Prism.highlight(codeBody, grammarInfo.grammar, grammarInfo.name);
      return (
        <code
          className={`language-${grammarInfo.name}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      // Fallback safe rendering
    }
  }
  return <code>{codeBody}</code>;
};

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  reasoning,
  verbose = true,
}) => {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const parts = content.split(/(```[\s\S]*?```)/g);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  return (
    <div className="space-y-3 leading-relaxed text-sm">
      {reasoning && (
        <details
          key={String(verbose)}
          open={verbose}
          className="mb-3 p-3 rounded-xl bg-[#262626] border border-[#303030] text-xs text-[#b4b4b4] group"
        >
          <summary className="cursor-pointer font-medium text-xs text-[#b4b4b4] hover:text-[#ececec] select-none flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            <span>Proses Berpikir Model ({reasoning.length} karakter)</span>
          </summary>
          <div className="mt-2 pt-2 border-t border-[#303030] text-[11px] font-mono whitespace-pre-wrap text-[#9e9ea7] max-h-48 overflow-y-auto">
            {reasoning}
          </div>
        </details>
      )}

      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={index}
              className="my-3 rounded-xl overflow-hidden border border-[#303030] bg-[#171717]"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#212121] border-b border-[#303030] text-xs">
                <span className="font-mono text-[#b4b4b4] text-[11px] lowercase">
                  {lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeBody, index)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-[#ececec] transition-colors text-[11px]"
                >
                  {copiedCodeIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#ececec] leading-relaxed bg-[#171717]">
                {renderCodeBlock(codeBody, lang)}
              </pre>
            </div>
          );
        }

        return (
          <div key={index} className="space-y-2 whitespace-pre-wrap">
            {part.split('\n\n').map((paragraph, pIdx) => {
              if (!paragraph.trim()) return null;
              return (
                <p key={pIdx} className="text-[#ececec]">
                  {paragraph}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
