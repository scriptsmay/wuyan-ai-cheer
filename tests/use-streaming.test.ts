import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return { ...actual, generateCheerStream: vi.fn() };
});

const emptyResult = {
  lines: [],
  emoji_caption: '',
  report_id: '',
  refs: [],
  source_snapshot_at: '',
};

async function loadStreaming() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  const { ApiError, generateCheerStream } = await import('../src/lib/api');
  const { useStreaming } = await import('../src/composables/useStreaming');
  return { ApiError, generateCheerStream, useStreaming };
}

describe('useStreaming error contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('preserves GENERATION_TIMEOUT from repeated server error events and reports once', async () => {
    const { generateCheerStream, useStreaming } = await loadStreaming();
    vi.mocked(generateCheerStream).mockImplementation(async (_mood, _text, _requestId, callbacks) => {
      callbacks?.onError?.('GENERATION_TIMEOUT', '生成超时');
      callbacks?.onError?.('GENERATION_TIMEOUT', '生成超时');
      return emptyResult;
    });
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'hello', 'req-1');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('GENERATION_TIMEOUT', '生成超时');
    expect(streaming.streamingError.value).toBe('生成超时');
  });

  it('does not duplicate GENERATION_TIMEOUT when the callback precedes the ApiError rejection', async () => {
    const { ApiError, generateCheerStream, useStreaming } = await loadStreaming();
    const message = '生成超时';
    const error = new ApiError(0, {
      code: 'GENERATION_TIMEOUT',
      message,
      request_id: 'req-1',
    });
    vi.mocked(generateCheerStream).mockImplementation(async (_mood, _text, _requestId, callbacks) => {
      callbacks?.onError?.('GENERATION_TIMEOUT', message);
      throw error;
    });
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'hello', 'req-1');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('GENERATION_TIMEOUT', message);
    expect(streaming.streamingError.value).toBe(message);
  });

  it('preserves STREAM_INTERRUPTED when the stream rejects with ApiError', async () => {
    const { ApiError, generateCheerStream, useStreaming } = await loadStreaming();
    const error = new ApiError(0, {
      code: 'STREAM_INTERRUPTED',
      message: '流连接意外中断',
      request_id: 'req-1',
    });
    vi.mocked(generateCheerStream).mockRejectedValue(error);
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'hello', 'req-1');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('STREAM_INTERRUPTED', '流连接意外中断');
    expect(streaming.streamingError.value).toBe('流连接意外中断');
  });

  it('preserves HTTP_ERROR when the stream rejects with ApiError', async () => {
    const { ApiError, generateCheerStream, useStreaming } = await loadStreaming();
    const error = new ApiError(502, {
      code: 'HTTP_ERROR',
      message: '服务暂时不可用',
      request_id: 'req-1',
    });
    vi.mocked(generateCheerStream).mockRejectedValue(error);
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'hello', 'req-1');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('HTTP_ERROR', '服务暂时不可用');
    expect(streaming.streamingError.value).toBe('服务暂时不可用');
  });

  it('uses UNKNOWN_ERROR for a non-ApiError stream rejection', async () => {
    const { generateCheerStream, useStreaming } = await loadStreaming();
    vi.mocked(generateCheerStream).mockRejectedValue(new Error('读取响应失败'));
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'hello', 'req-1');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('UNKNOWN_ERROR', '读取响应失败');
    expect(streaming.streamingError.value).toBe('读取响应失败');
  });

  it('allows one error callback for each consecutive submission', async () => {
    const { generateCheerStream, useStreaming } = await loadStreaming();
    let call = 0;
    vi.mocked(generateCheerStream).mockImplementation(async (_mood, _text, _requestId, callbacks) => {
      call += 1;
      callbacks?.onError?.(call === 1 ? 'FIRST_ERROR' : 'SECOND_ERROR', call === 1 ? '第一次失败' : '第二次失败');
      return emptyResult;
    });
    const onError = vi.fn();
    const streaming = useStreaming({ onError });

    await streaming.submitWithStreaming('daily', 'first', 'req-1');
    await streaming.submitWithStreaming('daily', 'second', 'req-2');

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, 'FIRST_ERROR', '第一次失败');
    expect(onError).toHaveBeenNthCalledWith(2, 'SECOND_ERROR', '第二次失败');
    expect(streaming.streamingError.value).toBe('第二次失败');
  });
});
