import { randomUUID } from 'node:crypto';
import {
  mediaJobSchema,
  type MediaJob,
  type MediaStage,
} from './contracts.js';

const stageOrder: MediaStage[] = [
  'brief',
  'script',
  'storyboard',
  'render',
  'voice',
  'video',
  'review',
  'publish',
];

export class MediaWorkflowStore {
  private readonly jobs = new Map<string, MediaJob>();
  private readonly idempotencyIndex = new Map<string, string>();

  create(input: {
    projectId: string;
    workflowId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): MediaJob {
    const existingId = this.idempotencyIndex.get(input.idempotencyKey);
    if (existingId) return this.require(existingId);

    const now = new Date().toISOString();
    const job = mediaJobSchema.parse({
      id: randomUUID(),
      projectId: input.projectId,
      workflowId: input.workflowId,
      status: 'queued',
      currentStage: 'brief',
      input: input.payload,
      output: {},
      attempts: 0,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    this.jobs.set(job.id, job);
    this.idempotencyIndex.set(job.idempotencyKey, job.id);
    return job;
  }

  require(jobId: string): MediaJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown media job: ${jobId}`);
    return job;
  }

  start(jobId: string): MediaJob {
    return this.update(jobId, { status: 'running', attemptsDelta: 1 });
  }

  completeStage(
    jobId: string,
    output: Record<string, unknown>,
  ): MediaJob {
    const current = this.require(jobId);
    const index = stageOrder.indexOf(current.currentStage);
    const mergedOutput = { ...current.output, [current.currentStage]: output };

    if (current.currentStage === 'review') {
      return this.replace(current, {
        status: 'waiting_review',
        output: mergedOutput,
      });
    }

    if (index === stageOrder.length - 1) {
      return this.replace(current, {
        status: 'completed',
        output: mergedOutput,
      });
    }

    return this.replace(current, {
      status: 'running',
      currentStage: stageOrder[index + 1],
      output: mergedOutput,
    });
  }

  approve(jobId: string): MediaJob {
    const current = this.require(jobId);
    if (current.status !== 'waiting_review' || current.currentStage !== 'review') {
      throw new Error(`Job ${jobId} is not waiting for review`);
    }

    return this.replace(current, {
      status: 'running',
      currentStage: 'publish',
    });
  }

  fail(jobId: string, error: string): MediaJob {
    return this.update(jobId, { status: 'failed', error });
  }

  list(projectId?: string): MediaJob[] {
    return [...this.jobs.values()].filter(
      (job) => !projectId || job.projectId === projectId,
    );
  }

  private update(
    jobId: string,
    patch: Partial<MediaJob> & { attemptsDelta?: number },
  ): MediaJob {
    const current = this.require(jobId);
    const { attemptsDelta = 0, ...rest } = patch;
    return this.replace(current, {
      ...rest,
      attempts: current.attempts + attemptsDelta,
    });
  }

  private replace(current: MediaJob, patch: Partial<MediaJob>): MediaJob {
    const updated = mediaJobSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    this.jobs.set(updated.id, updated);
    return updated;
  }
}
