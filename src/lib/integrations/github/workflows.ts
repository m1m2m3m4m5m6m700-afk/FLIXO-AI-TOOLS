import type { GitHubClient } from './client';

export interface WorkflowDispatchInput {
  client: GitHubClient;
  owner: string;
  repo: string;
  workflow: string;
  ref: string;
  inputs?: Readonly<Record<string, string>>;
}

export async function dispatchWorkflow({ client, owner, repo, workflow, ref, inputs = {} }: WorkflowDispatchInput): Promise<void> {
  await client.request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: 'POST',
      body: JSON.stringify({ ref, inputs }),
    },
  );
}

export interface WorkflowRun {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  head_sha: string;
  html_url: string;
}

export async function getWorkflowRuns(
  client: GitHubClient,
  owner: string,
  repo: string,
  workflow: string,
  ref?: string,
): Promise<WorkflowRun[]> {
  const query = ref ? `?branch=${encodeURIComponent(ref)}` : '';
  const response = await client.request<{ workflow_runs: WorkflowRun[] }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs${query}`,
  );
  return response.workflow_runs;
}
