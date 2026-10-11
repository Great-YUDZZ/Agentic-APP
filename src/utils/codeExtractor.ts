import { DiscussionMessage, CodeReviewItem } from '../types';

/**
 * Extracts code blocks from DiscussionMessage[] markdown text.
 * Handles patterns such as:
 * ```tsx src/App.tsx
 * ```rust src-tauri/src/main.rs
 * ```python script.py
 * or standard ```typescript with first-line file comments.
 */
export function extractCodeReviewItems(
  messages: DiscussionMessage[],
  existingItems: CodeReviewItem[] = []
): CodeReviewItem[] {
  const extracted: CodeReviewItem[] = [...existingItems];
  const existingMap = new Map<string, CodeReviewItem>(
    existingItems.map((item) => [`${item.filename}::${item.content}`, item])
  );

  let fileCounter = 1;

  for (const msg of messages) {
    if (!msg.content) continue;

    // Regex to match code blocks: ```lang info\ncode```
    const codeBlockRegex = /```([a-zA-Z0-9_#+-]*)(?:[ \t]+([^\n\r]+))?\r?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(msg.content)) !== null) {
      const rawLang = (match[1] || 'text').trim();
      const rawHeaderInfo = (match[2] || '').trim();
      const codeContent = match[3] || '';

      if (!codeContent.trim()) continue;

      // Extract filename from header (e.g. ```tsx src/App.tsx or ```python filename="calc.py")
      let filename = '';
      if (rawHeaderInfo) {
        const matchAttr = rawHeaderInfo.match(/(?:filename|file|path)=["']?([^"'\s]+)["']?/i);
        if (matchAttr && matchAttr[1]) {
          filename = matchAttr[1];
        } else {
          const potentialPath = rawHeaderInfo.split(/\s+/)[0];
          if (potentialPath && !potentialPath.startsWith('//') && !potentialPath.startsWith('#')) {
            filename = potentialPath;
          }
        }
      }

      // If no filename in header, inspect first line of code for path comments
      if (!filename) {
        const firstLine = codeContent.trim().split('\n')[0].trim();
        const commentMatch = firstLine.match(/^(?:\/\/|#|\/\*|<!--)\s*([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)/);
        if (commentMatch && commentMatch[1]) {
          filename = commentMatch[1];
        }
      }

      // Fallback filename based on language
      if (!filename) {
        const ext = getExtensionForLang(rawLang);
        filename = `generated_file_${fileCounter}.${ext}`;
        fileCounter++;
      }

      const key = `${filename}::${codeContent}`;
      if (!existingMap.has(key)) {
        const newItem: CodeReviewItem = {
          id: `review-${msg.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          filename,
          language: rawLang || 'code',
          content: codeContent.trimEnd(),
          agentName: msg.agent_name,
          agentRole: msg.agent_role,
          avatarColor: msg.avatar_color,
          timestamp: msg.timestamp,
          status: 'pending',
        };
        extracted.push(newItem);
        existingMap.set(key, newItem);
      }
    }
  }

  return extracted;
}

function getExtensionForLang(lang: string): string {
  const l = lang.toLowerCase();
  switch (l) {
    case 'tsx':
    case 'typescriptreact':
      return 'tsx';
    case 'ts':
    case 'typescript':
      return 'ts';
    case 'jsx':
    case 'javascriptreact':
      return 'jsx';
    case 'js':
    case 'javascript':
      return 'js';
    case 'rust':
    case 'rs':
      return 'rs';
    case 'python':
    case 'py':
      return 'py';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'md';
    case 'bash':
    case 'sh':
    case 'shell':
      return 'sh';
    case 'sql':
      return 'sql';
    default:
      return 'txt';
  }
}
