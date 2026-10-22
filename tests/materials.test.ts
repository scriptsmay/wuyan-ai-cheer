import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

// api.ts 在模块顶层读取 VITE_API_BASE_URL，stub 后再动态 import，并借 resetModules 隔离模块级缓存
async function loadApi() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  vi.resetModules();
  return import('../src/lib/api');
}

describe('getMaterials 素材池缓存', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('命中模块内存缓存，文本重绘不重复请求素材接口', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ok: true, data: [{ _id: 'mat_1', url: 'https://img.test/1.jpg', focus_y: 0.4 }] })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { getMaterials } = await loadApi();

    const first = await getMaterials();
    const second = await getMaterials();

    expect(first).toEqual([{ _id: 'mat_1', url: 'https://img.test/1.jpg', focus_y: 0.4 }]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://api.test/api/materials');
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('并发调用合并为一次 HTTP 请求', async () => {
    let release: (value: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => gate);
    vi.stubGlobal('fetch', fetchMock);
    const { getMaterials } = await loadApi();

    const first = getMaterials();
    const second = getMaterials();
    release(jsonResponse({ ok: true, data: [] }));
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('失败不写缓存，下次调用仍可重试', async () => {
    const fetchMock = vi
      .fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true, data: [] }))
      .mockRejectedValueOnce(new TypeError('网络中断'));
    vi.stubGlobal('fetch', fetchMock);
    const { getMaterials } = await loadApi();

    await expect(getMaterials()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(getMaterials()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
