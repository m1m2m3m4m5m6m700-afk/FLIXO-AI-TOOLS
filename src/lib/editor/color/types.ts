export type WorkingColorSpace = 'srgb' | 'display-p3' | 'adobe-rgb';
export type BitDepth = 8 | 16;
export type AlphaMode = 'straight' | 'premultiplied';

export type ColorPipeline = Readonly<{
  input: WorkingColorSpace;
  working: WorkingColorSpace;
  output: WorkingColorSpace;
  bitDepth: BitDepth;
  alpha: AlphaMode;
}>;

export const DEFAULT_COLOR_PIPELINE: ColorPipeline = Object.freeze({
  input: 'srgb',
  working: 'srgb',
  output: 'srgb',
  bitDepth: 8,
  alpha: 'premultiplied',
});
