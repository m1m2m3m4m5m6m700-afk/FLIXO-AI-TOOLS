import { preview } from 'vite';
import flixoAgentHandler from '../api/flixo-agent.ts';

const args = process.argv.slice(2);

function flagValue(flag, fallback) {
  const equalsPrefix = `${flag}=`;
  const inline = args.find((value) => value.startsWith(equalsPrefix));
  if (inline) return inline.slice(equalsPrefix.length);
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return fallback;
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server.httpServer.listening) {
      resolve();
      return;
    }
    server.httpServer.close(() => resolve());
  });
}

const host = flagValue('--host', '0.0.0.0');
const parsedPort = Number(flagValue('--port', '3000'));
if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
  throw new Error(\`Invalid preview port: \${parsedPort}\`);
}

const previewApiPlugin = {
  name: 'flixo-preview-api-runtime',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url ?? '').split('?', 1)[0];
      if (pathname !== '/api/flixo-agent') {
        next();
        return;
      }

      Promise.resolve(flixoAgentHandler(req, res)).catch((error) => {
        next(error instanceof Error ? error : new Error(String(error)));
      });
    });
  },
};

const server = await preview({
  plugins: [previewApiPlugin],
  preview: {
    host,
    port: parsedPort,
    strictPort: true,
  },
});

server.printUrls();

const shutdown = async () => {
  await closeServer(server);
};

process.once('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.once('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
