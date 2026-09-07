const MAX_BODY_BYTES = 64 * 1024;

function writeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error('Telemetry payload too large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += Buffer.byteLength(chunk);
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Telemetry payload too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    writeJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : null;
    if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string') {
      writeJson(res, 400, { error: 'invalid_telemetry_payload' });
      return;
    }

    // Telemetry is intentionally fire-and-forget. The endpoint acknowledges a
    // well-formed event but does not persist or echo user-provided properties.
    res.statusCode = 204;
    res.setHeader('cache-control', 'no-store');
    res.end();
  } catch (error) {
    if (error instanceof SyntaxError) {
      writeJson(res, 400, { error: 'invalid_json' });
      return;
    }
    const statusCode = Number(error?.statusCode);
    writeJson(res, Number.isInteger(statusCode) ? statusCode : 400, { error: 'invalid_telemetry_payload' });
  }
}
