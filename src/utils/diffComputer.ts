export interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
  prefix: '+' | '-' | ' ';
}

export interface SplitDiffRow {
  left?: {
    lineNumber: number;
    text: string;
    type: 'deleted' | 'unchanged';
    prefix: '-' | ' ';
  };
  right?: {
    lineNumber: number;
    text: string;
    type: 'added' | 'unchanged';
    prefix: '+' | ' ';
  };
}

/**
 * Menghitung Longest Common Subsequence (LCS) dari dua array baris teks.
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Menghasilkan diff terpadu (Unified Diff) baris demi baris dengan tanda + dan -.
 */
export function computeUnifiedDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  const dp = computeLCS(oldLines, newLines);
  const result: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        oldLineNumber: i,
        newLineNumber: j,
        text: oldLines[i - 1],
        prefix: ' ',
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        newLineNumber: j,
        text: newLines[j - 1],
        prefix: '+',
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'deleted',
        oldLineNumber: i,
        text: oldLines[i - 1],
        prefix: '-',
      });
      i--;
    }
  }

  return result;
}

/**
 * Menghasilkan diff berdampingan (Side-by-side / Split Diff).
 */
export function computeSplitDiff(oldContent: string, newContent: string): SplitDiffRow[] {
  const unified = computeUnifiedDiff(oldContent, newContent);
  const rows: SplitDiffRow[] = [];

  let k = 0;
  while (k < unified.length) {
    const item = unified[k];

    if (item.type === 'unchanged') {
      rows.push({
        left: {
          lineNumber: item.oldLineNumber || 0,
          text: item.text,
          type: 'unchanged',
          prefix: ' ',
        },
        right: {
          lineNumber: item.newLineNumber || 0,
          text: item.text,
          type: 'unchanged',
          prefix: ' ',
        },
      });
      k++;
    } else if (item.type === 'deleted') {
      // Periksa apakah baris berikutnya adalah baris added yang berpasangan
      const next = unified[k + 1];
      if (next && next.type === 'added') {
        rows.push({
          left: {
            lineNumber: item.oldLineNumber || 0,
            text: item.text,
            type: 'deleted',
            prefix: '-',
          },
          right: {
            lineNumber: next.newLineNumber || 0,
            text: next.text,
            type: 'added',
            prefix: '+',
          },
        });
        k += 2;
      } else {
        rows.push({
          left: {
            lineNumber: item.oldLineNumber || 0,
            text: item.text,
            type: 'deleted',
            prefix: '-',
          },
        });
        k++;
      }
    } else {
      // added tanpa deleted sebelumnya
      rows.push({
        right: {
          lineNumber: item.newLineNumber || 0,
          text: item.text,
          type: 'added',
          prefix: '+',
        },
      });
      k++;
    }
  }

  return rows;
}
