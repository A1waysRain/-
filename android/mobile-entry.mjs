// Entry used only by the Android package. The game files live under the app's private storage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server/index.js';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const readyPath = path.join(root, 'mobile-port.txt');
try { fs.unlinkSync(readyPath); } catch { /* no previous startup */ }

try {
  const server = await startServer({ host: '0.0.0.0', port: 0, quiet: true });
  fs.writeFileSync(readyPath, String(server.port));
  const stop = () => server.close().finally(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch (error) {
  console.error('[mobile] server failed:', error);
  fs.writeFileSync(readyPath, `ERROR:${error?.message || error}`);
  process.exitCode = 1;
}
