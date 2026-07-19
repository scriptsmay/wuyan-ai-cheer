import { getAccessToken } from './cloudbase'
import { getClientId } from './client-id'
import type { ApiErrorBody, AppConfig, AuthMe, CheerResult, CheckinResult, CheckinStats, Mood, MyCheckin, TransferComplete, TransferStart } from '../types'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/$/u, '')
const useVercelProxy = import.meta.env.PROD && (
  window.location.hostname === 'cheer.kplwuyan.site' ||
  window.location.hostname.endsWith('.vercel.app')
)
const API_BASE_URL = useVercelProxy ? window.location.origin : configuredApiBaseUrl

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string
  readonly retryAfter?: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.requestId = body.request_id
    this.retryAfter = body.retry_after
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  auth?: boolean
  authRetry?: boolean
  requestId?: string
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const shouldRetryAuth = options.authRetry !== false
  const requestId = options.requestId || crypto.randomUUID()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-Id': requestId
  }
  if (options.auth !== false) {
    headers.Authorization = `Bearer ${await getAccessToken(false)}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(20000)
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '请求超过 20 秒，请稍后重试'
      : '网络连接失败，请检查网络后重试'
    throw new ApiError(0, { code: 'NETWORK_ERROR', message, request_id: requestId })
  }

  if (response.status === 401 && options.auth !== false && shouldRetryAuth) {
    await getAccessToken(true)
    return apiRequest<T>(path, { ...options, authRetry: false })
  }

  let payload: unknown
  try {
    payload = response.status === 204 ? null : await response.json()
  } catch {
    throw new ApiError(response.status, {
      code: 'INVALID_RESPONSE',
      message: '服务返回了无法解析的响应',
      request_id: response.headers.get('x-request-id') || requestId
    })
  }

  if (!response.ok) {
    throw new ApiError(response.status, normalizeErrorBody(payload, requestId))
  }
  return unwrapPayload<T>(payload)
}

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as Record<string, unknown>).data
    if (data !== null && data !== undefined) return data as T
  }
  return payload as T
}

function normalizeErrorBody(payload: unknown, requestId: string): ApiErrorBody {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    return {
      code: typeof record.code === 'string' ? record.code : String(record.code || 'UNKNOWN_ERROR'),
      message: typeof record.message === 'string' ? record.message : '服务暂时不可用',
      request_id: typeof record.request_id === 'string' ? record.request_id : requestId,
      retry_after: typeof record.retry_after === 'number' ? record.retry_after : undefined
    }
  }
  return { code: 'UNKNOWN_ERROR', message: '服务暂时不可用', request_id: requestId }
}

export function generateCheer(mood: Mood, text: string, requestId: string): Promise<CheerResult> {
  return apiRequest<CheerResult>('/api/cheer', {
    method: 'POST',
    requestId,
    body: { mood, text, client_id: getClientId() }
  })
}

export function createCheckin(reportId?: string): Promise<CheckinResult> {
  return apiRequest<CheckinResult>('/api/checkins', {
    method: 'POST',
    body: { client_id: getClientId(), ...(reportId ? { report_id: reportId } : {}) }
  })
}

export function getMyCheckin(): Promise<MyCheckin> {
  return apiRequest<MyCheckin>('/api/checkins/me')
}

export function getMyCheckinReport(): Promise<CheerResult> {
  return apiRequest<CheerResult>('/api/checkins/me/report')
}

export function getCheckinStats(): Promise<CheckinStats> {
  return apiRequest<CheckinStats>('/api/checkins/stats', { auth: false })
}

export function askQuestion(q: string, requestId: string): Promise<{ answer: string }> {
  return apiRequest<{ answer: string }>('/api/ask', {
    method: 'POST',
    requestId,
    body: { q, client_id: getClientId() }
  })
}

export function getConfig(): Promise<AppConfig> {
  return apiRequest<AppConfig>('/api/config', { auth: false })
}

export function getAuthMe(): Promise<AuthMe> {
  return apiRequest<AuthMe>('/api/auth/me')
}

export function startAuthTransfer(): Promise<TransferStart> {
  return apiRequest<TransferStart>('/api/auth/transfer/start', { method: 'POST', body: {}, authRetry: false })
}

export function completeAuthTransfer(ticket: string): Promise<TransferComplete> {
  return apiRequest<TransferComplete>('/api/auth/transfer/complete', {
    method: 'POST',
    body: { ticket },
    authRetry: false
  })
}
