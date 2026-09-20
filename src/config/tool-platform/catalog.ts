import type { ToolCatalogSource } from './types.ts';
import type { ManagedTool, ToolCatalog } from './types.ts';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotateRight = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

function sha256Hex(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const totalLength = ((input.length + 9 + 63) >> 6) << 6;
  const bytes = new Uint8Array(totalLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = (rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)) >>> 0;
      const s1 = (rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)) >>> 0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let cc = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choose = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const s0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & cc) ^ (b & cc)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = cc;
      cc = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + cc) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((valuePart) => valuePart.toString(16).padStart(8, '0')).join('');
}

function freezeMap<T>(map: Map<string, T>): ReadonlyMap<string, T> {
  return map;
}

function catalogFingerprint(tools: readonly ManagedTool[]): string {
  const payload = tools.map((tool) => ({
    id: tool.id,
    path: tool.path,
    aliases: [...tool.aliases].sort(),
    isReady: tool.isReady,
    capability: tool.capability,
    executionMode: tool.executionMode,
    operational: tool.operational,
    requirements: tool.requirements,
    recovery: tool.recovery,
  }));
  return sha256Hex(JSON.stringify(payload));
}

export function createToolCatalog(source: readonly ToolCatalogSource[]): ToolCatalog {
  const all = Object.freeze([...source].slice().sort((a, b) => a.id.localeCompare(b.id)));
  const byId = new Map<string, ManagedTool>();
  const byPath = new Map<string, ManagedTool>();
  const byAlias = new Map<string, ManagedTool>();
  const claimedRoutes = new Set<string>();

  for (const tool of all) {
    if (!tool.id.trim()) throw new Error('Tool id must not be empty.');
    if (byId.has(tool.id)) throw new Error(`Duplicate managed tool id: ${tool.id}`);
    if (claimedRoutes.has(tool.path)) throw new Error(`Duplicate managed tool path: ${tool.path}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    if (!tool.parameterSchema) throw new Error(`Tool input contract is missing: ${tool.id}`);
    if (!tool.verifier) throw new Error(`Tool verifier contract is missing: ${tool.id}`);
    if (!tool.recovery || tool.recovery.maxAttempts < 0) throw new Error(`Tool recovery contract is invalid: ${tool.id}`);
    if (!tool.operational || !tool.operational.lifecycle || !tool.operational.execution) throw new Error(`Tool operational profile is missing: ${tool.id}`);
    byId.set(tool.id, tool);
    byPath.set(tool.path, tool);
    claimedRoutes.add(tool.path);
  }

  for (const tool of all) {
    for (const alias of tool.aliases) {
      if (claimedRoutes.has(alias)) throw new Error(`Duplicate managed tool route: ${alias}`);
      claimedRoutes.add(alias);
      byAlias.set(alias, tool);
    }
  }

  if (byId.size !== all.length) throw new Error(`Tool catalog discovery mismatch: indexed=${byId.size}, source=${all.length}`);

  return Object.freeze({
    all,
    ready: Object.freeze(all.filter((tool) => tool.isReady)),
    byId: freezeMap(byId),
    byPath: freezeMap(byPath),
    byAlias: freezeMap(byAlias),
    fingerprint: catalogFingerprint(all),
  });
}
