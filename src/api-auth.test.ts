import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiKeyAuthenticator } from './api-auth.js';

test('authenticates a valid project API key', () => {
  const auth = new ApiKeyAuthenticator();
  auth.register({
    keyId: 'web',
    secret: 'secret-value',
    projectId: 'dhp-web',
    actorId: 'website',
    roles: ['media:create'],
  });

  assert.deepEqual(auth.authenticate('DHP-Key web:secret-value'), {
    projectId: 'dhp-web',
    actorId: 'website',
    roles: ['media:create'],
  });
});

test('rejects invalid and disabled API keys', () => {
  const auth = new ApiKeyAuthenticator();
  auth.register({
    keyId: 'bot',
    secret: 'correct',
    projectId: 'bot-dang-bai',
    actorId: 'publisher',
  });

  assert.throws(() => auth.authenticate('DHP-Key bot:wrong'), /Invalid API key/);
  auth.setEnabled('bot', false);
  assert.throws(() => auth.authenticate('DHP-Key bot:correct'), /Invalid API key/);
});
