import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeAuthenticator, parseRuntimeApiKeys } from './runtime-auth.js';

test('parses multiple runtime API keys and roles', () => {
  const keys = parseRuntimeApiKeys(
    'web:secret:web-project:web-agent:admin,media;bot:token:bot-project:publisher:publish',
  );

  assert.equal(keys.length, 2);
  assert.deepEqual(keys[0].roles, ['admin', 'media']);
  assert.equal(keys[1].projectId, 'bot-project');
});

test('creates an authenticator from runtime configuration', () => {
  const auth = createRuntimeAuthenticator(
    'web:secret:web-project:web-agent:admin',
  );

  assert.deepEqual(auth.authenticate('DHP-Key web:secret'), {
    projectId: 'web-project',
    actorId: 'web-agent',
    roles: ['admin'],
  });
});

test('rejects missing runtime keys', () => {
  assert.throws(
    () => createRuntimeAuthenticator(''),
    /at least one API key/,
  );
});
