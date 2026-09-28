export async function* readSseData(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separator = buffer.match(/\r?\n\r?\n/);
        if (!separator || separator.index === undefined) break;

        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);

        let data = "";
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith("data:")) {
            data += (data ? "\n" : "") + line.slice(5).trimStart();
          }
        }

        if (!data || data === "[DONE]") continue;

        try {
          yield JSON.parse(data) as unknown;
        } catch {
          throw new Error("Malformed streaming data received from provider.");
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      let data = "";
      for (const line of buffer.split(/\r?\n/)) {
        if (line.startsWith("data:")) {
          data += (data ? "\n" : "") + line.slice(5).trimStart();
        }
      }
      if (data && data !== "[DONE]") {
        try {
          yield JSON.parse(data) as unknown;
        } catch {
          throw new Error("Malformed trailing streaming data received from provider.");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function dedupeStreamingText(committed: string, candidate: string): string {
  if (!candidate) return "";
  if (!committed) return candidate;

  const normalizedCommitted = committed.slice(-4096);
  if (candidate === normalizedCommitted || normalizedCommitted.endsWith(candidate)) {
    return "";
  }

  const maxOverlap = Math.min(normalizedCommitted.length, candidate.length, 512);
  for (let size = maxOverlap; size >= 1; size -= 1) {
    if (normalizedCommitted.slice(-size) === candidate.slice(0, size)) {
      return candidate.slice(size);
    }
  }

  return candidate;
}
