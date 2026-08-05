import type { MediaJob, MediaStage } from './contracts.js';
import { MediaWorkflowStore } from './media-workflow.js';

export interface MediaStageProvider {
  readonly stage: MediaStage;
  run(job: MediaJob): Promise<Record<string, unknown>>;
}

export class MediaWorkflowOrchestrator {
  private readonly providers = new Map<MediaStage, MediaStageProvider>();

  constructor(private readonly store: MediaWorkflowStore) {}

  register(provider: MediaStageProvider): void {
    this.providers.set(provider.stage, provider);
  }

  async runStage(jobId: string): Promise<MediaJob> {
    const job = this.store.get(jobId);
    const provider = this.providers.get(job.currentStage);

    if (!provider) {
      throw new Error(`No provider registered for media stage: ${job.currentStage}`);
    }

    this.store.markRunning(jobId);

    try {
      const stageOutput = await provider.run(this.store.get(jobId));
      return this.store.completeStage(jobId, stageOutput);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown media provider error';
      return this.store.fail(jobId, message);
    }
  }
}

export class FunctionMediaProvider implements MediaStageProvider {
  constructor(
    public readonly stage: MediaStage,
    private readonly handler: (job: MediaJob) => Promise<Record<string, unknown>>,
  ) {}

  run(job: MediaJob): Promise<Record<string, unknown>> {
    return this.handler(job);
  }
}
