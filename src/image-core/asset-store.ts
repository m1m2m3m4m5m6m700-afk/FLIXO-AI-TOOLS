export type ImageAssetInput = Readonly<{
  blob: Blob;
  width: number;
  height: number;
  name?: string;
}>;

export type StoredImageAsset = Readonly<ImageAssetInput & {
  readonly id: string;
  readonly mimeType: string;
  readonly size: number;
}>;

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

function assertBlob(blob: Blob): void {
  if (!(blob instanceof Blob)) throw new Error('Image asset blob is required');
  if (blob.size <= 0) throw new Error('Image asset blob must not be empty');
}

function createAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ImageAssetStore {
  private readonly assets = new Map<string, StoredImageAsset>();
  private readonly objectUrls = new Map<string, string>();

  put(input: ImageAssetInput): string {
    assertBlob(input.blob);
    assertPositiveInteger(input.width, 'Image asset width');
    assertPositiveInteger(input.height, 'Image asset height');
    if (input.name !== undefined && (input.name.trim() !== input.name || input.name === '')) {
      throw new Error('Image asset name must be a non-empty safe filename');
    }

    const id = createAssetId();
    const asset: StoredImageAsset = Object.freeze({
      id,
      blob: input.blob,
      mimeType: input.blob.type,
      width: input.width,
      height: input.height,
      size: input.blob.size,
      ...(input.name ? { name: input.name } : {}),
    });
    this.assets.set(id, asset);
    return id;
  }

  get(id: string): StoredImageAsset | undefined {
    return this.assets.get(id);
  }

  require(id: string): StoredImageAsset {
    const asset = this.get(id);
    if (!asset) throw new Error(`Image asset not found: ${id}`);
    return asset;
  }

  createObjectURL(id: string): string {
    const asset = this.require(id);
    const existing = this.objectUrls.get(id);
    if (existing) return existing;
    if (typeof URL.createObjectURL !== 'function') throw new Error('Object URL support is unavailable.');
    const url = URL.createObjectURL(asset.blob);
    this.objectUrls.set(id, url);
    return url;
  }

  revokeObjectURL(id: string): void {
    const url = this.objectUrls.get(id);
    if (!url) return;
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    this.objectUrls.delete(id);
  }

  delete(id: string): boolean {
    this.revokeObjectURL(id);
    return this.assets.delete(id);
  }

  clear(): void {
    for (const id of [...this.objectUrls.keys()]) this.revokeObjectURL(id);
    this.assets.clear();
  }

  get size(): number {
    return this.assets.size;
  }
}
