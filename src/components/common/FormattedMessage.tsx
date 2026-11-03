import React, { useState, useMemo } from 'react';
import { ChevronRight, Copy, Check, PanelRightOpen } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { marked } from 'marked';
import Prism from 'prismjs';

// Base, Markup & Web
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Systems & Backend
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-zig';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-haskell';

// Templating & Modern Web
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-less';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-wasm';
import 'prismjs/components/prism-solidity';

// Shell, DevOps & Config
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';

interface FormattedMessageProps {
  content: string;
  reasoning?: string;
  verbose?: boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  // Web & JS
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  // Systems & Languages
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  py: 'python',
  rb: 'ruby',
  kt: 'kotlin',
  // Shell, DevOps & Data
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  dockerfile: 'docker',
  containerfile: 'docker',
  yml: 'yaml',
  md: 'markdown',
  sol: 'solidity',
};

const getPrismGrammar = (lang: string) => {
  const normalized = lang.toLowerCase().trim();
  if (['text', 'plain', 'txt', 'output', 'code'].includes(normalized)) {
    return null;
  }
  const target = LANGUAGE_ALIASES[normalized] || normalized;
  if (Prism.languages[target]) {
    return { grammar: Prism.languages[target], name: target };
  }
  if (Prism.languages.clike) {
    return { grammar: Prism.languages.clike, name: 'clike' };
  }
  return null;
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

// Render inline Markdown tokens (strong, em, codespan, link, del, text, br)
const renderInlineTokens = (tokens?: any[]): React.ReactNode => {
  if (!tokens || !Array.isArray(tokens)) return null;

  return tokens.map((token: any, idx: number) => {
    const key = `inline-${idx}`;
    if (!token) return null;

    switch (token.type) {
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-[#ececec]">
            {token.tokens ? renderInlineTokens(token.tokens) : token.text}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic text-[#dcdcdc]">
            {token.tokens ? renderInlineTokens(token.tokens) : token.text}
          </em>
        );
      case 'codespan':
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#262626] border border-[#383838] text-[#ececec] font-mono text-[11.5px]"
          >
            {token.text}
          </code>
        );
      case 'del':
        return (
          <del key={key} className="line-through text-[#808080]">
            {token.tokens ? renderInlineTokens(token.tokens) : token.text}
          </del>
        );
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 transition-colors"
          >
            {token.tokens ? renderInlineTokens(token.tokens) : token.text}
          </a>
        );
      case 'br':
        return <br key={key} />;
      case 'text':
        if (token.tokens && token.tokens.length > 0) {
          return <React.Fragment key={key}>{renderInlineTokens(token.tokens)}</React.Fragment>;
        }
        return token.text;
      case 'escape':
        return token.text;
      default:
        return token.text || null;
    }
  });
};

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  reasoning,
  verbose = true,
}) => {
  const { openArtifact } = useStore();
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const handleOpenInCanvas = (codeBody: string, lang: string, index: number) => {
    const artifactId = `art-${lang}-${Date.now()}-${index}`;
    const title = `Snippet ${lang.toUpperCase()}`;
    openArtifact({
      id: artifactId,
      title,
      language: lang,
      content: codeBody,
      versions: [
        {
          version: 1,
          content: codeBody,
          timestamp: new Date().toISOString(),
          author: 'ai',
          summary: 'Diekstrak dari pesan percakapan',
        },
      ],
      currentVersionIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  // Parse markdown content ke dalam AST tokens
  const astTokens = useMemo(() => {
    if (!content) return [];
    try {
      return marked.lexer(content);
    } catch {
      // Fallback jika parser mengalami anomali string
      return null;
    }
  }, [content]);

  // Render block-level token rekursif
  const renderBlockTokens = (tokens: any[], prefix = 'block'): React.ReactNode => {
    return tokens.map((token: any, idx: number) => {
      const key = `${prefix}-${idx}`;
      if (!token) return null;

      switch (token.type) {
        case 'heading': {
          const headingContent = token.tokens ? renderInlineTokens(token.tokens) : token.text;
          if (token.depth === 1) {
            return (
              <h1
                key={key}
                className="text-base font-bold text-[#ececec] mt-3.5 mb-2 pb-1 border-b border-[#303030]"
              >
                {headingContent}
              </h1>
            );
          }
          if (token.depth === 2) {
            return (
              <h2
                key={key}
                className="text-sm font-bold text-[#ececec] mt-3 mb-1.5 pb-0.5 border-b border-[#303030]/60"
              >
                {headingContent}
              </h2>
            );
          }
          if (token.depth === 3) {
            return (
              <h3 key={key} className="text-xs font-semibold text-[#ececec] mt-2.5 mb-1">
                {headingContent}
              </h3>
            );
          }
          return (
            <h4 key={key} className="text-xs font-medium text-[#b4b4b4] mt-2 mb-0.5">
              {headingContent}
            </h4>
          );
        }

        case 'paragraph':
          return (
            <p key={key} className="my-1.5 text-xs leading-relaxed text-[#ececec] select-text">
              {token.tokens ? renderInlineTokens(token.tokens) : token.text}
            </p>
          );

        case 'table':
          return (
            <div
              key={key}
              className="my-3 overflow-x-auto rounded-xl border border-[#383838] bg-[#1a1a1a]"
            >
              <table className="w-full text-left text-xs text-[#ececec] border-collapse">
                <thead className="bg-[#262626] border-b border-[#383838] text-[#b4b4b4] font-medium">
                  <tr>
                    {token.header.map((cell: any, cIdx: number) => {
                      const align = token.align ? token.align[cIdx] : null;
                      const alignClass =
                        align === 'center'
                          ? 'text-center'
                          : align === 'right'
                          ? 'text-right'
                          : 'text-left';
                      return (
                        <th
                          key={cIdx}
                          className={`px-3.5 py-2 border-r last:border-r-0 border-[#383838] text-xs font-semibold text-[#ececec] ${alignClass}`}
                        >
                          {cell.tokens ? renderInlineTokens(cell.tokens) : cell.text}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {token.rows.map((row: any[], rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-[#262626]/40 transition-colors">
                      {row.map((cell: any, cIdx: number) => {
                        const align = token.align ? token.align[cIdx] : null;
                        const alignClass =
                          align === 'center'
                            ? 'text-center'
                            : align === 'right'
                            ? 'text-right'
                            : 'text-left';
                        return (
                          <td
                            key={cIdx}
                            className={`px-3.5 py-2 border-r last:border-r-0 border-[#2a2a2a] text-xs text-[#d1d1d1] ${alignClass}`}
                          >
                            {cell.tokens ? renderInlineTokens(cell.tokens) : cell.text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        case 'list': {
          const ListTag = token.ordered ? 'ol' : 'ul';
          const listClass = token.ordered
            ? 'my-2 ml-5 space-y-1 list-decimal marker:text-[#888] text-xs text-[#ececec]'
            : 'my-2 ml-5 space-y-1 list-disc marker:text-[#888] text-xs text-[#ececec]';

          return (
            <ListTag
              key={key}
              className={listClass}
              start={token.ordered && token.start ? Number(token.start) : undefined}
            >
              {token.items.map((item: any, iIdx: number) => {
                const itemKey = `${key}-item-${iIdx}`;
                return (
                  <li key={itemKey} className="leading-relaxed">
                    {item.task && (
                      <input
                        type="checkbox"
                        checked={item.checked}
                        readOnly
                        className="mr-2 h-3.5 w-3.5 rounded border-[#444] bg-[#222] text-[#ececec] focus:ring-0 cursor-default align-middle"
                      />
                    )}
                    {item.tokens && item.tokens.length > 0 ? (
                      item.tokens.map((itToken: any, tIdx: number) => {
                        if (itToken.type === 'text') {
                          return (
                            <React.Fragment key={tIdx}>
                              {itToken.tokens
                                ? renderInlineTokens(itToken.tokens)
                                : itToken.text}
                            </React.Fragment>
                          );
                        }
                        if (itToken.type === 'paragraph') {
                          return (
                            <span key={tIdx} className="inline">
                              {itToken.tokens
                                ? renderInlineTokens(itToken.tokens)
                                : itToken.text}
                            </span>
                          );
                        }
                        return renderBlockTokens([itToken], `${itemKey}-${tIdx}`);
                      })
                    ) : (
                      <span>{item.text}</span>
                    )}
                  </li>
                );
              })}
            </ListTag>
          );
        }

        case 'blockquote':
          return (
            <blockquote
              key={key}
              className="my-2 pl-3.5 border-l-2 border-[#525252] text-xs text-[#b4b4b4] italic bg-[#262626]/20 py-1.5 rounded-r"
            >
              {token.tokens
                ? renderBlockTokens(token.tokens, `quote-${key}`)
                : token.text}
            </blockquote>
          );

        case 'code': {
          const lang = token.lang ? token.lang.trim().split(/\s+/)[0] : 'code';
          const codeBody = token.text || '';
          return (
            <div
              key={key}
              className="my-3 rounded-xl overflow-hidden border border-[#303030] bg-[#171717]"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#212121] border-b border-[#303030] text-xs select-none">
                <span className="font-mono text-[#b4b4b4] text-[11px] lowercase">
                  {lang}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenInCanvas(codeBody, lang, idx)}
                    title="Buka kode ini di panel Sidecar Canvas terpisah"
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-[#ececec] transition-colors text-[11px]"
                  >
                    <PanelRightOpen className="w-3.5 h-3.5" />
                    <span>Buka di Canvas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(codeBody, idx)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-[#ececec] transition-colors text-[11px]"
                  >
                    {copiedCodeIndex === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#ececec]" />
                        <span className="text-[#ececec]">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#ececec] leading-relaxed bg-[#171717] select-text">
                {renderCodeBlock(codeBody, lang)}
              </pre>
            </div>
          );
        }

        case 'hr':
          return <hr key={key} className="my-3 border-t border-[#303030]" />;

        case 'space':
          return null;

        case 'html':
          return (
            <div key={key} className="text-xs text-[#ececec] my-1">
              {token.text}
            </div>
          );

        default:
          if (token.text) {
            return (
              <p key={key} className="my-1.5 text-xs text-[#ececec]">
                {token.text}
              </p>
            );
          }
          return null;
      }
    });
  };

  return (
    <div className="space-y-2 leading-relaxed text-xs select-text">
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
          <div className="mt-2 pt-2 border-t border-[#303030] text-[11px] font-mono whitespace-pre-wrap text-[#9e9ea7] max-h-48 overflow-y-auto select-text">
            {reasoning}
          </div>
        </details>
      )}

      {astTokens && astTokens.length > 0 ? (
        renderBlockTokens(astTokens, 'root')
      ) : (
        // Fallback klasik jika AST tidak tersedia
        <div className="space-y-2 whitespace-pre-wrap select-text">
          {content.split('\n\n').map((paragraph, pIdx) => {
            if (!paragraph.trim()) return null;
            return (
              <p key={pIdx} className="text-[#ececec] select-text">
                {paragraph}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
