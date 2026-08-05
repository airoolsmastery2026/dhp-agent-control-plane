import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DhpHttpApi } from './http-api.js';

const MAX_BODY_BYTES = 1_000_000;

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body exceeds 1 MB limit');
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

export function createDhpHttpServer(api: DhpHttpApi) {
  return createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? '127.0.0.1';
      const url = new URL(request.url ?? '/', `http://${host}`);
      const method = request.method ?? 'GET';
      const body = method === 'GET' || method === 'HEAD'
        ? undefined
        : await readJsonBody(request);

      const result = await api.handle({
        method,
        path: url.pathname,
        query: url.searchParams,
        body,
      });

      writeJson(response, result.status, result.body);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown server error';
      const status = cause instanceof SyntaxError ? 400 : 413;
      writeJson(response, status, { error: message });
    }
  });
}
