import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/lib/editor/document/index.ts';
import { createHistory, currentDocument, executeCommand, undo, redo } from '../src/lib/editor/commands/index.ts';

const document = createDocument('history-doc', {
  width: 100,
  height: 100,
  colorSpace: 'srgb',
  bitDepth: 8,
  alpha: 'premultiplied',
});

const versionCommand = (id: string, version: number) => ({
  id,
  label: id,
  execute: () => ({ ...document, version }),
  undo: () => document,
  serialize: () => ({ id, version }),
});

test('history stores immutable document versions without pixel copies', () => {
  const history = createHistory(document);
  const first = executeCommand(history, versionCommand('v2', 2), 'node-2');
  assert.equal(currentDocument(first).version, 2);
  const back = undo(first);
  assert.equal(currentDocument(back).version, 1);
  const forward = redo(back);
  assert.equal(currentDocument(forward).version, 2);
});

test('history supports branching from a prior node', () => {
  const history = createHistory(document);
  const first = executeCommand(history, versionCommand('v2', 2), 'node-a');
  const second = executeCommand(first, versionCommand('v3', 3), 'node-b');
  const back = undo(second);
  const branch = executeCommand(back, versionCommand('v4', 4), 'node-c');
  assert.equal(currentDocument(branch).version, 4);
  assert.equal(currentDocument(redo(branch, 'node-b')).version, 4);
  assert.equal(branch.nodes.size, 4);
});
