export type SelectionId = string;

export type CoverageField = Readonly<{
  width: number;
  height: number;
  values: Float32Array;
}>;

export type Selection = Readonly<{
  id: SelectionId;
  width: number;
  height: number;
  coverage: CoverageField;
}>;

export type SelectionCombineMode = 'replace' | 'add' | 'subtract' | 'intersect';
