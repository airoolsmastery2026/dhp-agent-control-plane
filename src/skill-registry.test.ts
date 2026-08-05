import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillRegistry } from './skill-registry.js';

test('registers and filters skills', () => {
  const registry = new SkillRegistry();
  registry.register({
    id: 'dhp-render',
    name: 'DHP Render',
    version: '1.0.0',
    description: 'Render provider adapter',
    entrypoint: './skills/render.js',
    permissions: ['render'],
    capabilities: ['render', 'image'],
    runtime: 'hybrid',
    enabled: true,
  });

  assert.equal(registry.require('dhp-render').name, 'DHP Render');
  assert.equal(registry.list({ capability: 'render' }).length, 1);
  assert.equal(registry.list({ capability: 'publish' }).length, 0);
});

test('rejects duplicate skill versions', () => {
  const registry = new SkillRegistry();
  const manifest = {
    id: 'dhp-content',
    name: 'DHP Content',
    version: '1.0.0',
    description: 'Content generation skill',
    entrypoint: './skills/content.js',
    capabilities: ['content'],
  };

  registry.register(manifest);
  assert.throws(() => registry.register(manifest), /already registered/);
});
