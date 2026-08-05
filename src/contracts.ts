import { z } from 'zod';

export const skillPermissionSchema = z.enum([
  'filesystem:read',
  'filesystem:write',
  'network',
  'process',
  'render',
  'publish',
]);

export const skillManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  entrypoint: z.string().min(1),
  permissions: z.array(skillPermissionSchema).default([]),
  capabilities: z.array(z.string().min(1)).min(1),
  runtime: z.enum(['local', 'remote', 'hybrid']).default('local'),
  enabled: z.boolean().default(true),
});

export type SkillPermission = z.infer<typeof skillPermissionSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;

export const mediaStageSchema = z.enum([
  'brief',
  'script',
  'storyboard',
  'render',
  'voice',
  'video',
  'review',
  'publish',
]);

export const mediaJobStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_review',
  'completed',
  'failed',
  'cancelled',
]);

export const mediaJobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  workflowId: z.string().min(1),
  status: mediaJobStatusSchema,
  currentStage: mediaStageSchema,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).default({}),
  attempts: z.number().int().nonnegative().default(0),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional(),
});

export type MediaStage = z.infer<typeof mediaStageSchema>;
export type MediaJobStatus = z.infer<typeof mediaJobStatusSchema>;
export type MediaJob = z.infer<typeof mediaJobSchema>;

export interface SkillExecutionContext {
  projectId: string;
  actorId: string;
  correlationId: string;
}

export interface SkillExecutionRequest {
  skillId: string;
  input: Record<string, unknown>;
  context: SkillExecutionContext;
}

export interface SkillExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
}
