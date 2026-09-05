import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(desktopDir, '..');
const viteCli = path.resolve(appDir, 'node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, [viteCli, 'build', '--config', path.join(appDir, 'vite.config.ts')], {
  cwd: appDir,
  env: {
    ...process.env,
    BASE_PATH: './',
    NODE_ENV: 'production',
    PORT: '3000',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);