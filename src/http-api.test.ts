import assert from 'node:assert/strict';
import test from 'node:test';
import { DhpHttpApi } from './http-api.js';
import {
  FunctionMediaProvider,
  MediaWorkflowOrchestrator,
} from './media-providers.js';
import { MediaWorkflowStore } from './media-workflow.js';
import { SkillExecutor } from './skill-executor.js';
import { SkillPermissionPolicy } from './skill-policy.js';
import { SkillRegistry } from './skill-registry.js';

function createApi(): DhpHttpApi {
  const registry = new SkillRegistry();
  registry.register({
    id: 'content-generator',
    name: 'Content Generator',
    version: '1.0.0',
    description: 'Generate content',
    entrypoint: 'local://content',
    permissions: [],
    capabilities: ['content'],
    runtime: 'local',
    enabled: true,
  });

  const policy = new SkillPermissionPolicy();
  policy.upsert({
    projectId: 'dhp-web',
    allowedPermissions: [],
    allowedSkillIds: ['content-generator'],
  });

  const executor = new SkillExecutor(registry, policy);
  executor.registerAdapter('content-generator', {
    async execute(request) {
      return { text: `Generated: ${String(request.input.topic)}` };
    },
  });

  const store = new MediaWorkflowStore();
  const orchestrator = new MediaWorkflowOrchestrator(store);
  orchestrator.register(
    new FunctionMediaProvider('brief', async (job) => ({
      accepted: true,
      title: job.input.title,
    })),
  );

  return new DhpHttpApi(registry, executor, store, orchestrator);
}

test('lists enabled skills and executes an allowed skill', async () => {
  const api = createApi();

  const list = await api.handle({ method: 'GET', path: '/v1/skills' });
  assert.equal(list.status, 200);
  assert.equal((list.body as { data: unknown[] }).data.length, 1);

  const execution = await api.handle({
    method: 'POST',
    path: '/v1/skills/execute',
    body: {
      skillId: 'content-generator',
      input: { topic: 'cửa cổng CNC' },
      context: {
        projectId: 'dhp-web',
        actorId: 'user-1',
        correlationId: 'req-1',
      },
    },
  });

  assert.equal(execution.status, 200);
  assert.deepEqual(execution.body, {
    success: true,
    output: { text: 'Generated: cửa cổng CNC' },
  });
});

test('creates an idempotent media job and runs its first stage', async () => {
  const api = createApi();
  const payload = {
    projectId: 'dhp-web',
    workflowId: 'social-video',
    payload: { title: 'Cửa cổng CNC' },
    idempotencyKey: 'job-001',
  };

  const created = await api.handle({
    method: 'POST',
    path: '/v1/media/jobs',
    body: payload,
  });
  const duplicate = await api.handle({
    method: 'POST',
    path: '/v1/media/jobs',
    body: payload,
  });

  const firstJob = (created.body as { data: { id: string } }).data;
  const secondJob = (duplicate.body as { data: { id: string } }).data;
  assert.equal(firstJob.id, secondJob.id);

  const run = await api.handle({
    method: 'POST',
    path: `/v1/media/jobs/${firstJob.id}/run`,
  });

  assert.equal(run.status, 200);
  const job = (run.body as { data: { currentStage: string; attempts: number } }).data;
  assert.equal(job.currentStage, 'script');
  assert.equal(job.attempts, 1);
});

test('returns validation and not-found errors', async () => {
  const api = createApi();

  const invalid = await api.handle({
    method: 'POST',
    path: '/v1/media/jobs',
    body: {},
  });
  assert.equal(invalid.status, 400);

  const missing = await api.handle({
    method: 'GET',
    path: '/v1/media/jobs/missing',
  });
  assert.equal(missing.status, 404);
});
