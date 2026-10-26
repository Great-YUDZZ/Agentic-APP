import { GitStatusResponse } from '../types';
import { getChatEndpoint, resolveEndpointForModel } from './api';

export async function getGitStatus(): Promise<GitStatusResponse> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<GitStatusResponse>('git_status');
}

export async function getGitDiff(filePath?: string, staged?: boolean): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_diff', { filePath: filePath || null, staged: staged ?? false });
}

export async function stageGitFile(filePath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_stage', { filePath });
}

export async function stageAllGit(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_stage_all');
}

export async function unstageGitFile(filePath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_unstage', { filePath });
}

export async function unstageAllGit(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_unstage_all');
}

export async function discardGitFile(filePath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_discard', { filePath });
}

export async function commitGit(message: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_commit', { message });
}

export async function pushGit(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_push');
}

export async function pullGit(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_pull');
}

export async function fetchGit(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_fetch');
}

export async function listGitBranches(): Promise<string[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string[]>('git_branches');
}

export async function checkoutGitBranch(branch: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_checkout', { branch });
}

export async function createGitBranch(branchName: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_create_branch', { branchName });
}

/**
 * Generate a standard Conventional Commit message using the active LLM
 */
export async function generateAiCommitMessage(
  diffText: string,
  modelId: string,
  availableModels: Array<{ id: string; endpoint_id?: string; provider?: string }>,
  apiKeys: Array<{ provider: string; api_key: string; base_url?: string; is_active: boolean }>
): Promise<string> {
  if (!diffText || diffText.trim().length === 0) {
    throw new Error('Tidak ada perbedaan perubahan (diff) untuk dianalisis.');
  }

  // Truncate diff if extremely huge to avoid blowing token limit
  const truncatedDiff = diffText.length > 8000 ? diffText.slice(0, 8000) + '\n\n... (diff truncated)' : diffText;

  const prompt = `You are a professional software engineer following the Conventional Commits specification.
Analyze the following git diff and write a concise, meaningful git commit message.

Rules:
1. Format: <type>(<scope>): <short summary in imperative present tense>
2. Valid types: feat, fix, refactor, chore, docs, test, perf, style.
3. Keep the first line under 72 characters.
4. You may include an optional concise bullet point list underneath if there are multiple important changes.
5. Output ONLY the raw commit message text. No markdown backticks, no explanations, no preamble, and ZERO emojis.

Git Diff:
\`\`\`diff
${truncatedDiff}
\`\`\``;

  const endpointConfig = resolveEndpointForModel(modelId, availableModels, apiKeys);
  const url = getChatEndpoint(endpointConfig.baseUrl);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${endpointConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`LLM Error (${res.status}): ${errorBody.slice(0, 100)}`);
  }

  const data = await res.json();
  const rawMsg = data.choices?.[0]?.message?.content?.trim() || '';

  // Clean any markdown backticks if LLM mistakenly wrapped it
  let cleanMsg = rawMsg.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  // Strip any accidental emojis
  cleanMsg = cleanMsg.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  return cleanMsg;
}

export async function gitClone(repoUrl: string, targetDir: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('git_clone', { repoUrl, targetDir });
}
