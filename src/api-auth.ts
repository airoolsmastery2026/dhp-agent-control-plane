import { createHash, timingSafeEqual } from 'node:crypto';

export interface ApiPrincipal {
  projectId: string;
  actorId: string;
  roles: string[];
}

export interface ApiKeyRecord extends ApiPrincipal {
  keyHash: string;
  enabled: boolean;
}

function hashKey(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export class ApiKeyAuthenticator {
  private readonly records = new Map<string, ApiKeyRecord>();

  register(input: {
    keyId: string;
    secret: string;
    projectId: string;
    actorId: string;
    roles?: string[];
  }): void {
    if (!input.keyId || !input.secret) {
      throw new Error('API key id and secret are required');
    }

    this.records.set(input.keyId, {
      projectId: input.projectId,
      actorId: input.actorId,
      roles: [...new Set(input.roles ?? [])],
      keyHash: hashKey(input.secret).toString('hex'),
      enabled: true,
    });
  }

  setEnabled(keyId: string, enabled: boolean): void {
    const current = this.records.get(keyId);
    if (!current) throw new Error(`Unknown API key: ${keyId}`);
    this.records.set(keyId, { ...current, enabled });
  }

  authenticate(authorization?: string): ApiPrincipal {
    const match = authorization?.match(/^DHP-Key\s+([^:]+):(.+)$/);
    if (!match) throw new Error('Missing or invalid authorization header');

    const [, keyId, secret] = match;
    const record = this.records.get(keyId);
    if (!record || !record.enabled) throw new Error('Invalid API key');

    const expected = Buffer.from(record.keyHash, 'hex');
    const actual = hashKey(secret);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error('Invalid API key');
    }

    return {
      projectId: record.projectId,
      actorId: record.actorId,
      roles: [...record.roles],
    };
  }
}
