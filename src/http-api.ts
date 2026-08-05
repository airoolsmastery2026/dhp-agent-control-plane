import { z } from 'zod';
import { MediaWorkflowOrchestrator } from './media-providers.js';
import { MediaWorkflowStore } from './media-workflow.js';
import { SkillExecutor } from './skill-executor.js';
import { SkillRegistry } from './skill-registry.js';

export interface ApiRequest {
  method: string;
  path: string;
  query?: URLSearchParams;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const createJobSchema = z.object({
  projectId: z.string().min(1),
  workflowId: z.string().min(1),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().min(1),
});

const executeSkillSchema = z.object({
  skillId: z.string().min(1),
  input: z.record(z.unknown()),
  context: z.object({
    projectId: z.string().min(1),
    actorId: z.string().min(1),
    correlationId: z.string().min(1),
  }),
});

export class DhpHttpApi {
  constructor(
    private readonly skills: SkillRegistry,
    private readonly executor: SkillExecutor,
    private readonly media: MediaWorkflowStore,
    private readonly orchestrator: MediaWorkflowOrchestrator,
  ) {}

  async handle(request: ApiRequest): Promise<ApiResponse> {
    try {
      if (request.method === 'GET' && request.path === '/health') {
        return this.ok({ status: 'ok', service: 'dhp-agent-control-plane' });
      }

      if (request.method === 'GET' && request.path === '/v1/skills') {
        const capability = request.query?.get('capability') ?? undefined;
        return this.ok({
          data: this.skills.list({ enabledOnly: true, capability }),
        });
      }

      if (request.method === 'POST' && request.path === '/v1/skills/execute') {
        const input = executeSkillSchema.parse(request.body);
        const result = await this.executor.execute(input);
        return { status: result.success ? 200 : 403, body: result };
      }

      if (request.method === 'POST' && request.path === '/v1/media/jobs') {
        const input = createJobSchema.parse(request.body);
        return { status: 201, body: { data: this.media.create(input) } };
      }

      if (request.method === 'GET' && request.path === '/v1/media/jobs') {
        const projectId = request.query?.get('projectId') ?? undefined;
        return this.ok({ data: this.media.list(projectId) });
      }

      const jobMatch = request.path.match(/^\/v1\/media\/jobs\/([^/]+)$/);
      if (request.method === 'GET' && jobMatch) {
        return this.ok({ data: this.media.require(jobMatch[1]) });
      }

      const runMatch = request.path.match(/^\/v1\/media\/jobs\/([^/]+)\/run$/);
      if (request.method === 'POST' && runMatch) {
        return this.ok({ data: await this.orchestrator.runStage(runMatch[1]) });
      }

      const approveMatch = request.path.match(/^\/v1\/media\/jobs\/([^/]+)\/approve$/);
      if (request.method === 'POST' && approveMatch) {
        return this.ok({ data: this.media.approve(approveMatch[1]) });
      }

      return { status: 404, body: { error: 'Not found' } };
    } catch (cause) {
      if (cause instanceof z.ZodError) {
        return {
          status: 400,
          body: { error: 'Invalid request', details: cause.flatten() },
        };
      }

      const message = cause instanceof Error ? cause.message : 'Unknown error';
      const status = message.startsWith('Unknown ') ? 404 : 409;
      return { status, body: { error: message } };
    }
  }

  private ok(body: unknown): ApiResponse {
    return { status: 200, body };
  }
}
