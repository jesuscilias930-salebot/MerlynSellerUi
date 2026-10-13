import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Render build defaults to Node and Cloudflare runtime is opt-in',()=>{
  const config=fs.readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
  assert.match(config,/process\.env\.MERLYN_BUILD_TARGET \|\| 'node'/);
  assert.match(config,/if \(buildTarget === 'cloudflare'\)\s*\{[\s\S]*await import\('@cloudflare\/vite-plugin'\)/);
  assert.match(config,/\.\.\.cloudflarePlugins/);
});
