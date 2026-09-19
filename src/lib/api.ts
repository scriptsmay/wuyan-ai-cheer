import { clearStoredAuth, emitAuthChange, getAccessToken } from './auth';
import { getClientId } from './client-id';
import { pairSseEvents } from './sse';
import type { ApiErrorBody, AppConfig, CheerResult, CheckinResult, CheckinStats, Mood, MyCheckin } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/u, '');
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || '';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly retryAfter?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.request_id;
    this.retryAfter = body.retry_after;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
  requestId?: string;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestId = options.requestId || crypto.randomUUID();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
  };
  if (options.auth !== false) {
    const token = await getAccessToken(false);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let url = `${API_BASE_URL}${path}`;
  if (options.auth !== false && !headers.Authorization && AUTH_TOKEN) {
    const sep = path.includes('?') ? '&' : '?';
    url += `${sep}token=${AUTH_TOKEN}`;
  }

  const defaultTimeout = 180000;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(defaultTimeout),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? `请求超过 ${defaultTimeout} 秒，请稍后重试`
        : '网络连接失败，请检查网络后重试';
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message,
      request_id: requestId,
    });
  }

  if (response.status === 401) {
    clearStoredAuth();
    emitAuthChange('expired');
  }

  let payload: unknown;
  try {
    payload = response.status === 204 ? null : await response.json();
  } catch {
    throw new ApiError(response.status, {
      code: 'INVALID_RESPONSE',
      message: '服务返回了无法解析的响应',
      request_id: response.headers.get('x-request-id') || requestId,
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status, normalizeErrorBody(payload, requestId));
  }
  return unwrapPayload<T>(payload);
}

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as Record<string, unknown>).data;
    if (data !== null && data !== undefined) return data as T;
  }
  return payload as T;
}

function normalizeErrorBody(payload: unknown, requestId: string): ApiErrorBody {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code : String(record.code || 'UNKNOWN_ERROR'),
      message: typeof record.message === 'string' ? record.message : '服务暂时不可用',
      request_id: typeof record.request_id === 'string' ? record.request_id : requestId,
      retry_after: typeof record.retry_after === 'number' ? record.retry_after : undefined,
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: '服务暂时不可用',
    request_id: requestId,
  };
}

export interface CheerStreamCallbacks {
  onConnected?: (requestId: string) => void;
  onThinking?: (text: string) => void;
  onChunk?: (text: string, fullText: string) => void;
  onComplete?: (result: CheerResult) => void;
  onRetry?: (message: string, attempt: number) => void;
  onError?: (code: string, message: string) => void;
}

export function generateCheerStream(
  mood: Mood,
  text: string,
  requestId: string,
  callbacks: CheerStreamCallbacks = {}
): Promise<CheerResult> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}/api/cheer/stream`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    };

    const token = getAccessToken(false);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let fullText = '';
    let thinkingText = '';
    let isFinished = false;

    function handleEvent(eventType: string, data: unknown) {
      switch (eventType) {
        case 'connected':
          callbacks.onConnected?.(requestId);
          break;
        case 'thinking':
          if (data && typeof data === 'object' && 'text' in data) {
            // 后端只下发增量片段，本地累计成完整思考文本
            thinkingText += String(data.text);
            callbacks.onThinking?.(thinkingText);
          }
          break;
        case 'chunk':
          if (data && typeof data === 'object' && 'text' in data) {
            // 后端按行下发增量（每事件一条新增行），本地累计成全文
            const line = String(data.text);
            fullText = fullText ? `${fullText}\n${line}` : line;
            callbacks.onChunk?.(line, fullText);
          }
          break;
        case 'complete':
          if (data && typeof data === 'object') {
            isFinished = true;
            const result = data as CheerResult;
            callbacks.onComplete?.(result);
            resolve(result);
          }
          break;
        case 'retry':
          if (data && typeof data === 'object') {
            // 后端将重新生成，本地累计缓冲一并清零
            fullText = '';
            thinkingText = '';
            const message = String((data as { message?: string }).message || '正在重新润色...');
            const attempt = Number((data as { attempt?: number }).attempt || 1);
            callbacks.onRetry?.(message, attempt);
          }
          break;
        case 'error':
          if (data && typeof data === 'object') {
            const code = String((data as { code?: string }).code || 'UNKNOWN_ERROR');
            const message = String((data as { message?: string }).message || '生成失败');
            callbacks.onError?.(code, message);
            reject(new ApiError(0, { code, message, request_id: requestId }));
          }
          break;
      }
    }

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mood, text, client_id: getClientId() }),
      // 总时长兜底 10 分钟：后端已改为空闲超时（无数据间隔才中断），
      // 思考型模型长推理只要数据在流动就不受此限制
      signal: AbortSignal.timeout(600000),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new ApiError(response.status, err);
          });
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法读取响应流');
        }

        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        function processStream(currentReader: ReadableStreamDefaultReader<Uint8Array>) {
          currentReader.read().then(({ done, value }) => {
            if (done) {
              if (!isFinished) {
                reject(new ApiError(0, {
                  code: 'STREAM_INTERRUPTED',
                  message: '流连接意外中断',
                  request_id: requestId,
                }));
              }
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const { type, data: dataStr } of pairSseEvents(lines)) {
              try {
                handleEvent(type, JSON.parse(dataStr));
              } catch {
                // 忽略解析错误
              }
            }

            if (!isFinished) {
              processStream(currentReader);
            }
          }).catch((err) => {
            if (!isFinished) {
              reject(new ApiError(0, {
                code: 'STREAM_ERROR',
                message: err.message || '流读取失败',
                request_id: requestId,
              }));
            }
          });
        }

        processStream(reader);
      })
      .catch((err) => {
        if (!isFinished) {
          reject(err);
        }
      });
  });
}

export function generateCheer(mood: Mood, text: string, requestId: string): Promise<CheerResult> {
  return apiRequest<CheerResult>('/api/cheer', {
    method: 'POST',
    requestId,
    body: { mood, text, client_id: getClientId() },
  });
}

export function createCheckin(reportId?: string): Promise<CheckinResult> {
  return apiRequest<CheckinResult>('/api/checkins', {
    method: 'POST',
    body: {
      client_id: getClientId(),
      ...(reportId ? { report_id: reportId } : {}),
    },
  });
}

export function getMyCheckin(): Promise<MyCheckin> {
  return apiRequest<MyCheckin>('/api/checkins/me');
}

export function getMyCheckinReport(): Promise<CheerResult> {
  return apiRequest<CheerResult>('/api/checkins/me/report');
}

export function getCheckinStats(): Promise<CheckinStats> {
  return apiRequest<CheckinStats>('/api/checkins/stats', { auth: false });
}

export function askQuestion(q: string, requestId: string): Promise<{ answer: string }> {
  return apiRequest<{ answer: string }>('/api/ask', {
    method: 'POST',
    body: { q, client_id: getClientId() },
  });
}

export function getConfig(): Promise<AppConfig> {
  return apiRequest<AppConfig>('/api/config', { auth: false });
}

export function verifySession(): Promise<{
  username: string;
  subject_id: string;
}> {
  return apiRequest<{ username: string; subject_id: string }>('/api/auth/me');
}