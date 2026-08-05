import type { ApiRequest, ApiResponse } from './http-api.js';
import { DhpHttpApi } from './http-api.js';
import { ApiKeyAuthenticator, type ApiPrincipal } from './api-auth.js';

export interface AuthenticatedApiRequest extends ApiRequest {
  headers?: Record<string, string | undefined>;
}

export class AuthenticatedDhpHttpApi {
  constructor(
    private readonly inner: DhpHttpApi,
    private readonly auth: ApiKeyAuthenticator,
  ) {}

  async handle(request: AuthenticatedApiRequest): Promise<ApiResponse> {
    if (request.path === '/health') return this.inner.handle(request);

    let principal: ApiPrincipal;
    try {
      principal = this.auth.authenticate(
        request.headers?.authorization ?? request.headers?.Authorization,
      );
    } catch (cause) {
      return {
        status: 401,
        body: {
          error: cause instanceof Error ? cause.message : 'Unauthorized',
        },
      };
    }

    const body = this.bindPrincipal(request.body, principal);
    const query = new URLSearchParams(request.query);
    if (!query.has('projectId')) query.set('projectId', principal.projectId);

    return this.inner.handle({ ...request, query, body });
  }

  private bindPrincipal(body: unknown, principal: ApiPrincipal): unknown {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

    const value = body as Record<string, unknown>;
    const context = value.context;

    return {
      ...value,
      projectId: principal.projectId,
      context:
        context && typeof context === 'object' && !Array.isArray(context)
          ? {
              ...(context as Record<string, unknown>),
              projectId: principal.projectId,
              actorId: principal.actorId,
            }
          : context,
    };
  }
}
