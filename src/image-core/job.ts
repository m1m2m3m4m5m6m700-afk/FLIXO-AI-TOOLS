import type { ImageAssetInput, ImageAssetStore, StoredImageAsset } from './asset-store';

export type ImageJobOutput = Readonly<{
  blob: Blob;
  width: number;
  height: number;
  name?: string;
}>;

export type ImageJobResult = Readonly<{
  toolId: string;
  inputAssetId: string;
  outputAssetId: string;
  output: StoredImageAsset;
}>;

export type ImageJobVerification = Readonly<{
  valid: boolean;
  failures: readonly string[];
}>;

export type ImageJobProcessor = (
  input: StoredImageAsset,
  parameters: unknown,
) => Promise<ImageJobOutput>;

export type ImageJobVerifier = (
  input: StoredImageAsset,
  output: StoredImageAsset,
  parameters: unknown,
) => Promise<ImageJobVerification | boolean>;

export type ImageJobConfig = Readonly<{
  toolId: string;
  inputAssetId: string;
  parameters?: unknown;
  assetStore: ImageAssetStore;
  processor: ImageJobProcessor;
  verifier?: ImageJobVerifier;
}>;

function normalizeVerification(result: ImageJobVerification | boolean): ImageJobVerification {
  return typeof result === 'boolean' ? { valid: result, failures: result ? [] : ['image job verification failed'] } : result;
}

export class ImageJob {
  readonly toolId: string;
  readonly inputAssetId: string;

  private readonly parameters: unknown;
  private readonly assetStore: ImageAssetStore;
  private readonly processor: ImageJobProcessor;
  private readonly verifier?: ImageJobVerifier;

  constructor(config: ImageJobConfig) {
    if (!config.toolId.trim()) throw new Error('Image job toolId must not be empty');
    this.toolId = config.toolId;
    this.inputAssetId = config.inputAssetId;
    this.parameters = config.parameters ?? {};
    this.assetStore = config.assetStore;
    this.processor = config.processor;
    this.verifier = config.verifier;
  }

  async execute(): Promise<ImageJobResult> {
    const input = this.assetStore.require(this.inputAssetId);
    const processed = await this.processor(input, this.parameters);
    if (!(processed.blob instanceof Blob) || processed.blob.size <= 0) throw new Error(`Image job '${this.toolId}' produced an empty output`);
    if (!Number.isInteger(processed.width) || processed.width <= 0 || !Number.isInteger(processed.height) || processed.height <= 0) {
      throw new Error(`Image job '${this.toolId}' produced invalid output dimensions`);
    }

    const outputInput: ImageAssetInput = {
      blob: processed.blob,
      width: processed.width,
      height: processed.height,
      ...(processed.name ? { name: processed.name } : {}),
    };
    const outputAssetId = this.assetStore.put(outputInput);
    return Object.freeze({
      toolId: this.toolId,
      inputAssetId: this.inputAssetId,
      outputAssetId,
      output: this.assetStore.require(outputAssetId),
    });
  }

  async verify(result: ImageJobResult): Promise<ImageJobVerification> {
    if (result.toolId !== this.toolId || result.inputAssetId !== this.inputAssetId) {
      throw new Error(`Image job '${this.toolId}' verification result does not belong to this job`);
    }
    const input = this.assetStore.require(result.inputAssetId);
    const output = this.assetStore.require(result.outputAssetId);
    if (!this.verifier) return { valid: true, failures: [] };
    return normalizeVerification(await this.verifier(input, output, this.parameters));
  }

  async run(): Promise<Readonly<{ result: ImageJobResult; verification: ImageJobVerification }>> {
    const result = await this.execute();
    const verification = await this.verify(result);
    if (!verification.valid) {
      this.assetStore.delete(result.outputAssetId);
      throw new Error(`Image job '${this.toolId}' verification failed: ${verification.failures.join('; ')}`);
    }
    return Object.freeze({ result, verification });
  }
}