import { z } from 'zod';
import { recordRateLimit } from '../lib/rateLimit';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FsResponse<T> {
  data: T;
  nextPath: string | null;
}

/** Parse `Link: </api/fs/agents?page=2>; rel="next"` into a path usable with fsGet. */
export function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  const m = link.match(/<([^>]+)>\s*;\s*rel="next"/);
  if (!m) return null;
  const url = new URL(m[1], 'http://local');
  return url.pathname.replace(/^\/api\/fs\//, '') + url.search;
}

/**
 * Call a Freshservice endpoint through the local proxy.
 * `path` is relative to /api/v2, e.g. "tickets?per_page=1".
 */
export async function fsRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<FsResponse<z.infer<S>>> {
  const res = await fetch(`/api/fs/${path.replace(/^\/+/, '')}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers ?? {}) },
  });
  recordRateLimit(res.headers, res.status);

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const b = (body ?? {}) as Record<string, unknown>;
    const code = String(b.code ?? b.error ?? `http_${res.status}`);
    const message = String(b.message ?? b.description ?? messageForStatus(res.status));
    const retryAfter = res.headers.get('retry-after');
    throw new ApiError(res.status, code, message, retryAfter ? Number(retryAfter) : undefined, body);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(res.status, 'unexpected_shape', `Unexpected response from ${path}: ${parsed.error.message}`, undefined, body);
  }
  return { data: parsed.data, nextPath: parseNextLink(res.headers.get('link')) };
}

export const fsGet = <S extends z.ZodType>(path: string, schema: S) => fsRequest(path, schema);

/** Follow Link rel="next" until exhausted (bounded). Use for small lookup tables only. */
export async function fsGetAll<S extends z.ZodType, T>(
  firstPath: string,
  schema: S,
  pick: (d: z.infer<S>) => T[],
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  let path: string | null = firstPath;
  for (let i = 0; path && i < maxPages; i++) {
    const { data, nextPath }: FsResponse<z.infer<S>> = await fsGet(path, schema);
    out.push(...pick(data));
    path = nextPath;
  }
  return out;
}

function messageForStatus(status: number): string {
  switch (status) {
    case 401: return 'Freshservice rejected the API key.';
    case 403: return 'Not allowed (the key lacks permission, or the proxy blocks this endpoint).';
    case 404: return 'Not found.';
    case 429: return 'Rate limit reached. Waiting before retrying.';
    case 502: return 'Could not reach Freshservice.';
    case 503: return 'The server is not configured. Check your .env file.';
    default: return `Request failed (HTTP ${status}).`;
  }
}

/** TanStack Query retry policy: retry 429 and network/5xx, never 4xx client errors. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429) return failureCount < 3;
    if (error.status >= 400 && error.status < 500) return false;
    if (error.status === 503) return false;
  }
  return failureCount < 2;
}

export function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.status === 429) return (error.retryAfter ?? 30) * 1000;
  return Math.min(1000 * 2 ** attempt, 10_000);
}
