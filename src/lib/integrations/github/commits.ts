import type { GitHubClient } from './client';

interface GitReference {
  object: { sha: string };
}

interface GitTreeReference {
  sha: string;
}

interface GitTree {
  sha: string;
}

interface GitBlob {
  sha: string;
}

interface GitCommit {
  sha: string;
}

export interface CommitFile {
  path: string;
  content: string;
  mode?: '100644' | '100755';
}

export interface CommitFilesInput {
  client: GitHubClient;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: readonly CommitFile[];
}

export async function commitFiles(input: CommitFilesInput): Promise<GitCommit> {
  if (!input.files.length) throw new Error('At least one file is required');

  const prefix = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  const ref = await input.client.request<GitReference>(
    `${prefix}/git/ref/heads/${encodeURIComponent(input.branch)}`,
  );

  const parentSha = ref.object.sha;
  const parentCommit = await input.client.request<{ tree: GitTreeReference }>(
    `${prefix}/git/commits/${encodeURIComponent(parentSha)}`,
  );

  const blobs = await Promise.all(
    input.files.map(async (file) => {
      const blob = await input.client.request<GitBlob>(`${prefix}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
      });
      return {
        path: file.path,
        mode: file.mode ?? '100644',
        type: 'blob',
        sha: blob.sha,
      };
    }),
  );

  const tree = await input.client.request<GitTree>(`${prefix}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: blobs }),
  });

  const commit = await input.client.request<GitCommit>(`${prefix}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [parentSha] }),
  });

  await input.client.request(`${prefix}/git/refs/heads/${encodeURIComponent(input.branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return commit;
}
