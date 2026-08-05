import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillExecutor, type SkillExecutionAuditEvent } from './skill-executor.js';
import { SkillPermissionPolicy } from './skill-policy.js';
import { SkillRegistry } from './skill-registry.js';

function createRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.register({
    id: 'render-product',
    name: 'Render Product',
    version: '1.0.0',
    description: 'Render a product scene',
    entrypoint: 'render-product',
    permissions: ['render'],
    capabilities: ['render'],
    runtime: 'local',
    enabled: true,
  });
  return registry;
}

test('executes an allowed skill and writes an audit event', async () => {
  const registry = createRegistry();
  const policy = new SkillPermissionPolicy();
  policy.upsert({ projectId: 'dhp-web', allowedPermissions: ['render'] });

  const auditEvents: SkillExecutionAuditEvent[] = [];
  const executor = new SkillExecutor(registry, policy, (event) => {
    auditEvents.push(event);
  });
  executor.registerAdapter('render-product', {
    async execute(request) {
      return { assetUrl: `/assets/${String(request.input.name)}.png` };
    },
  });

  const result = await executor.execute({
    skillId: 'render-product',
    input: { name: 'gate' },
    context: {
      projectId: 'dhp-web',
      actorId: 'user-1',
      correlationId: 'corr-1',
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.output, { assetUrl: '/assets/gate.png' });
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0]?.success, true);
});

test('denies a skill when project permissions are insufficient', async () => {
  const registry = createRegistry();
  const policy = new SkillPermissionPolicy();
  policy.upsert({ projectId: 'dhp-web', allowedPermissions: [] });

  const executor = new SkillExecutor(registry, policy);
  executor.registerAdapter('render-product', {
    async execute() {
      return { shouldNotRun: true };
    },
  });

  const result = await executor.execute({
    skillId: 'render-product',
    input: {},
    context: {
      projectId: 'dhp-web',
      actorId: 'user-1',
      correlationId: 'corr-2',
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /denied permissions/);
});
