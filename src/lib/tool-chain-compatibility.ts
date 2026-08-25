type ChainContract = Readonly<{
  inputMime: readonly string[];
  outputMime: readonly string[];
}>;

export const TOOL_CHAIN_CONTRACTS: Readonly<Record<string, ChainContract>> = Object.freeze({
  'image-converter': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/webp'] },
  'image-upscaler': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/png'] },
  'background-remover': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/png'] },
  'crop-resize': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/png'] },
  'watermark-remover': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/png'] },
  'object-remover': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/png'] },
  'raster-to-svg': { inputMime: ['image/png', 'image/jpeg', 'image/webp'], outputMime: ['image/svg+xml'] },
});

const supportsMime = (supported: readonly string[], mime: string) => supported.includes(mime) || supported.includes('*/*');

export type ToolChainValidation = Readonly<{
  valid: boolean;
  reason?: string;
}>;

export function validateToolChainContracts(steps: readonly string[], inputMime: string): ToolChainValidation {
  if (steps.length === 0) return { valid: false, reason: 'Tool chain is empty.' };

  let mime = inputMime || 'application/octet-stream';
  for (const toolId of steps) {
    const contract = TOOL_CHAIN_CONTRACTS[toolId];
    if (!contract) return { valid: false, reason: `Tool \"${toolId}\" has no declared chain contract.` };
    if (!supportsMime(contract.inputMime, mime)) return { valid: false, reason: `Tool \"${toolId}\" cannot accept ${mime}.` };
    mime = contract.outputMime[0] ?? 'application/octet-stream';
  }
  return { valid: true };
}

export async function validateToolChain(steps: readonly string[], input: { blob: Blob }): Promise<ToolChainValidation> {
  const contractValidation = validateToolChainContracts(steps, input.blob.type);
  if (!contractValidation.valid) return contractValidation;

  const { getToolChainAdapter } = await import('./tool-chain-adapters');
  for (const toolId of steps) {
    if (!getToolChainAdapter(toolId)) {
      return { valid: false, reason: `Tool \"${toolId}\" has no local chain adapter.` };
    }
  }
  return contractValidation;
}
