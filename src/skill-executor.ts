import type {
  SkillExecutionRequest,
  SkillExecutionResult,
} from './contracts.js';
import { SkillPermissionPolicy } from './skill-policy.js';
import { SkillRegistry } from './skill-registry.js';

export interface SkillAdapter {
  execute(request: SkillExecutionRequest): Promise<Record<string, unknown>>;
}

export interface SkillExecutionAuditEvent {
  skillId: string;
  projectId: string;
  actorId: string;
  correlationId: string;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export type SkillExecutionAuditSink = (
  event: SkillExecutionAuditEvent,
) => Promise<void> | void;

export class SkillExecutor {
  private readonly adapters = new Map<string, SkillAdapter>();

  constructor(
    private readonly registry: SkillRegistry,
    private readonly policy: SkillPermissionPolicy,
    private readonly audit: SkillExecutionAuditSink = () => undefined,
  ) {}

  registerAdapter(skillId: string, adapter: SkillAdapter): void {
    this.adapters.set(skillId, adapter);
  }

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const startedAt = new Date().toISOString();
    let success = false;
    let error: string | undefined;

    try {
      const manifest = this.registry.require(request.skillId);
      if (!manifest.enabled) {
        throw new Error(`Skill is disabled: ${manifest.id}`);
      }

      this.policy.assertAllowed(request.context.projectId, manifest);

      const adapter = this.adapters.get(manifest.id);
      if (!adapter) {
        throw new Error(`No adapter registered for skill: ${manifest.id}`);
      }

      const output = await adapter.execute(request);
      success = true;
      return { success: true, output };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unknown skill execution error';
      return { success: false, output: {}, error };
    } finally {
      await this.audit({
        skillId: request.skillId,
        projectId: request.context.projectId,
        actorId: request.context.actorId,
        correlationId: request.context.correlationId,
        success,
        startedAt,
        finishedAt: new Date().toISOString(),
        error,
      });
    }
  }
}
