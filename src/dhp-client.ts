import type {
  MediaJob,
  SkillExecutionRequest,
  SkillExecutionResult,
  SkillManifest,
} from './contracts.js';

export interface DhpClientOptions {
  baseUrl: string;
  keyId: string;
  secret: string;
  fetch?: typeof globalThis.fetch;
}

export class DhpClient {
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: DhpClientOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  listSkills(capability?: string): Promise<SkillManifest[]> {
    const query = capability ? `?capability=${encodeURIComponent(capability)}` : '';
    return this.request<{ data: SkillManifest[] }>(`/v1/skills${query}`).then(
      (response) => response.data,
    );
  }

  executeSkill(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    return this.request('/v1/skills/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  createMediaJob(input: {
    projectId?: string;
    workflowId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<MediaJob> {
    return this.request<{ data: MediaJob }>('/v1/media/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data);
  }

  getMediaJob(jobId: string): Promise<MediaJob> {
    return this.request<{ data: MediaJob }>(`/v1/media/jobs/${jobId}`).then(
      (response) => response.data,
    );
  }

  runMediaStage(jobId: string): Promise<MediaJob> {
    return this.request<{ data: MediaJob }>(`/v1/media/jobs/${jobId}/run`, {
      method: 'POST',
    }).then((response) => response.data);
  }

  approveMediaJob(jobId: string): Promise<MediaJob> {
    return this.request<{ data: MediaJob }>(`/v1/media/jobs/${jobId}/approve`, {
      method: 'POST',
    }).then((response) => response.data);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(
      `${this.options.baseUrl.replace(/\/$/, '')}${path}`,
      {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `DHP-Key ${this.options.keyId}:${this.options.secret}`,
          ...init.headers,
        },
      },
    );

    const body = (await response.json()) as T | { error?: string };
    if (!response.ok) {
      const error = 'error' in body && body.error ? body.error : `HTTP ${response.status}`;
      throw new Error(error);
    }

    return body as T;
  }
}
