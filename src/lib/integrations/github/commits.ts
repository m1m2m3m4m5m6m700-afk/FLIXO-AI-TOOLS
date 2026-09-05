import type { GitHubClient } from './client';

interface GitReference {
  object: { sha: string };
}

interface GitTree {
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

  const ref = await input.client.request<GitReference>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/ref/heads/${encodeURIComponent(input.branch)}`,
  );

  const parentSha = ref.object.sha;
  const blobs = await Promise.all(
    input.files.map(async (file) => ({
      path: file.path,
      mode: file.mode ?? '100644',
      type: 'blob',
      sha: await input.client.request<string>(
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/blobs`,
        {
          method: 'POST',
          body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
        },
      ),
    })),
  );

  const tree = await input.client.request<GitTree>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentSha, tree: blobs }),
    },
  );

  const commit = await input.client.request<GitCommit>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [parentSha] }),
    },
  );

  await input.client.request(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/refs/heads/${encodeURIComponent(input.branch)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    },
  );

  return commit;
}
