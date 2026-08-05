import { ApiKeyAuthenticator } from './api-auth.js';

export interface RuntimeApiKeyConfig {
  keyId: string;
  secret: string;
  projectId: string;
  actorId: string;
  roles: string[];
}

export function parseRuntimeApiKeys(value: string | undefined): RuntimeApiKeyConfig[] {
  if (!value?.trim()) return [];

  return value.split(';').filter(Boolean).map((entry) => {
    const [keyId, secret, projectId, actorId, roles = ''] = entry.split(':');
    if (!keyId || !secret || !projectId || !actorId) {
      throw new Error(
        'Invalid DHP_API_KEYS entry. Expected keyId:secret:projectId:actorId:role1,role2',
      );
    }

    return {
      keyId,
      secret,
      projectId,
      actorId,
      roles: roles.split(',').map((role) => role.trim()).filter(Boolean),
    };
  });
}

export function createRuntimeAuthenticator(
  value: string | undefined = process.env.DHP_API_KEYS,
): ApiKeyAuthenticator {
  const authenticator = new ApiKeyAuthenticator();
  const keys = parseRuntimeApiKeys(value);

  if (keys.length === 0) {
    throw new Error('DHP_API_KEYS must configure at least one API key');
  }

  for (const key of keys) authenticator.register(key);
  return authenticator;
}
