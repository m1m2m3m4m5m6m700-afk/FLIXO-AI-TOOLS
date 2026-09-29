import { createSelection, combineSelections } from '../src/lib/editor/selection';
import { createRenderGraph } from '../src/lib/editor/render';
import { createRenderSchedule } from '../src/lib/editor/render/scheduler';
import { createRenderCache, createRenderCacheKey } from '../src/lib/editor/render/cache';

test('selection combines bounded coverage deterministically', () => {
  const a=createSelection('a',2,1,[0,0.5]);
  const b=createSelection('b',2,1,[0.5,1]);
  expect(Array.from(combineSelections(a,b,'add').coverage.values)).toEqual([0.5,1]);
  expect(Array.from(combineSelections(a,b,'subtract').coverage.values)).toEqual([0,0]);
});

test('render scheduler follows graph order and rejects unsupported backend', () => {
  const graph=createRenderGraph({id:'out',operation:'output',parameters:{},backends:['canvas2d'],inputs:[{id:'src',operation:'source',parameters:{},backends:['canvas2d'],inputs:[]}]});
  expect(createRenderSchedule(graph,'canvas2d').nodes.map(n=>n.id)).toEqual(['src','out']);
  expect(()=>createRenderSchedule(graph,'webgpu')).toThrow('RENDER_BACKEND_UNSUPPORTED');
});

test('render cache stays within byte budget', () => {
  const cache=createRenderCache(10);
  const node={id:'n',operation:'x',parameters:{},backends:['canvas2d'] as const,inputs:[]};
  const key=createRenderCacheKey(node);
  cache.set({key,backend:'canvas2d',value:'a',bytes:8});
  expect(cache.stats().bytes).toBe(8);
  cache.set({key:'b',backend:'canvas2d',value:'b',bytes:8});
  expect(cache.stats().bytes).toBeLessThanOrEqual(10);
});
