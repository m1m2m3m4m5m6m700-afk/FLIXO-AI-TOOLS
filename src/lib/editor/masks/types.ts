export type MaskId = string;

export type MaskSource =
  | 'raster'
  | 'brush'
  | 'linear'
  | 'radial'
  | 'polygon'
  | 'subject'
  | 'sky'
  | 'depth'
  | 'composite';

export type MaskOperation =
  | 'add'
  | 'subtract'
  | 'intersect'
  | 'multiply'
  | 'invert'
  | 'feather'
  | 'blur';

export type CoverageField = Readonly<{
  width: number;
  height: number;
  values: Float32Array;
}>;

export type Mask = Readonly<{
  id: MaskId;
  source: MaskSource;
  coverage: CoverageField;
}>;
