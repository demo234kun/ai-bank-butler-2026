/** 构建 Qoder Site 在线 Demo：hash 路由 + Edge Function API 前缀，输出到 site/。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', '../../site', '--emptyOutDir'],
  {
    cwd: path.join(root, 'apps/web'),
    env: {
      ...process.env,
      VITE_API_BASE: process.env.VITE_API_BASE ?? '/functions/v1/app',
      VITE_ROUTER: 'hash',
    },
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
