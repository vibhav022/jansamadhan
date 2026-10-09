import { rmSync } from 'node:fs';

for (const dir of ['.wrangler/state', '.wrangler/state-smoke', '.wrangler/logs']) {
  rmSync(dir, { recursive: true, force: true });
}
