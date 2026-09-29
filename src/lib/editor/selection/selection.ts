import type { Selection, SelectionCombineMode, CoverageField } from './types';

function assertDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('INVALID_SELECTION_DIMENSIONS');
}

export function createSelection(id: string, width: number, height: number, values?: ArrayLike<number>): Selection {
  assertDimensions(width, height);
  const size = width * height;
  if (values && values.length !== size) throw new Error('SELECTION_COVERAGE_SIZE_MISMATCH');
  const copy = new Float32Array(size);
  if (values) for (let i=0;i<size;i++) copy[i]=Math.min(1,Math.max(0,Number(values[i])));
  const coverage: CoverageField = {width,height,values:copy};
  return Object.freeze({id,width,height,coverage});
}

export function combineSelections(a: Selection,b: Selection,mode: SelectionCombineMode,id=a.id): Selection {
  if (a.width!==b.width || a.height!==b.height) throw new Error('SELECTION_DIMENSION_MISMATCH');
  const n=a.width*a.height, out=new Float32Array(n);
  for(let i=0;i<n;i++) { const x=a.coverage.values[i], y=b.coverage.values[i]; out[i]=mode==='replace'?y:mode==='add'?Math.max(x,y):mode==='subtract'?x*(1-y):Math.min(x,y); }
  return createSelection(id,a.width,a.height,out);
}
