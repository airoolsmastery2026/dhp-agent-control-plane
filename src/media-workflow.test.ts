import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaWorkflowStore } from './media-workflow.js';

test('creates idempotent jobs and advances to review', () => {
  const store = new MediaWorkflowStore();
  const first = store.create({
    projectId: 'dai-hai-phat-web',
    workflowId: 'marketing-video',
    payload: { brief: 'Cửa cổng CNC màu đen' },
    idempotencyKey: 'job-001',
  });
  const duplicate = store.create({
    projectId: 'dai-hai-phat-web',
    workflowId: 'marketing-video',
    payload: { brief: 'ignored duplicate payload' },
    idempotencyKey: 'job-001',
  });

  assert.equal(first.id, duplicate.id);
  let job = store.start(first.id);
  assert.equal(job.attempts, 1);

  for (const stage of ['brief', 'script', 'storyboard', 'render', 'voice', 'video']) {
    assert.equal(job.currentStage, stage);
    job = store.completeStage(job.id, { ok: true });
  }

  assert.equal(job.currentStage, 'review');
  job = store.completeStage(job.id, { approvedByAi: true });
  assert.equal(job.status, 'waiting_review');

  job = store.approve(job.id);
  assert.equal(job.currentStage, 'publish');
  job = store.completeStage(job.id, { platforms: ['facebook'] });
  assert.equal(job.status, 'completed');
});
