import { afterEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY_TOKEN = 'auth_token';

function mockFetchOnce(headersOut: Record<string, string>) {
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    Object.assign(headersOut, (init?.headers ?? {}) as Record<string, string>);
    return {
      ok: false,
      status: 500,
      json: async () => ({ code: 'TEST_STOP', message: 'stop', request_id: 'req-1' }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// api.ts 在模块顶层读取 VITE_API_BASE_URL，而 CI（Vercel）没有 gitignore 掉的 .env.local：
// 必须先 stub 环境变量再动态 import，静态 import 会在 stub 之前执行模块顶层代码导致崩溃
async function loadApi() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  return import('../src/lib/api');
}

describe('generateCheerStream 鉴权头', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  });

  it('回归：已登录时 Authorization 必须携带真实 JWT 而非 "[object Promise]"（漏 await 会让后端把 AI 报告归属到匿名身份）', async () => {
    localStorage.setItem(STORAGE_KEY_TOKEN, 'jwt-test-token');
    const captured: Record<string, string> = {};
    mockFetchOnce(captured);

    const { generateCheerStream, ApiError } = await loadApi();
    await expect(generateCheerStream('daily', '', 'req-1')).rejects.toBeInstanceOf(ApiError);
    expect(captured.Authorization).toBe('Bearer jwt-test-token');
  });

  it('未登录时不携带 Authorization 头（由后端按 client_id 回落匿名身份）', async () => {
    const captured: Record<string, string> = {};
    mockFetchOnce(captured);

    const { generateCheerStream } = await loadApi();
    await expect(generateCheerStream('daily', '', 'req-1')).rejects.toThrow();
    expect(captured.Authorization).toBeUndefined();
  });
});
