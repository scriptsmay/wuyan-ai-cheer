import cloudbase from '@cloudbase/js-sdk'

const env = import.meta.env.VITE_CLOUDBASE_ENV_ID
const region = import.meta.env.VITE_CLOUDBASE_REGION
const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY

if (!env || !region || !accessKey || accessKey === 'replace-with-publishable-key') {
  throw new Error('CloudBase Web 认证配置不完整')
}

export const cloudbaseApp = cloudbase.init({
  env,
  region,
  accessKey,
  auth: { detectSessionInUrl: true }
})

export const cloudbaseAuth = cloudbaseApp.auth({ persistence: 'local' })

interface SessionUser {
  id?: string
  uid?: string
  name?: string
  username?: string
  is_anonymous?: boolean
  isAnonymous?: boolean
}

interface SessionShape {
  access_token?: string
  user?: SessionUser
}

function readSession(value: unknown): SessionShape | undefined {
  if (!value || typeof value !== 'object' || !('session' in value)) return undefined
  const session = value.session
  if (!session || typeof session !== 'object') return undefined
  return session as SessionShape
}

export type AuthMode = 'anonymous' | 'authenticated' | 'signed-out'

export interface AuthSnapshot {
  mode: AuthMode
  accessToken: string
  uid: string
  username: string
}

function readUser(session: SessionShape | undefined): SessionUser | undefined {
  return session?.user
}

function readUid(user: SessionUser | undefined): string {
  return String(user?.id || user?.uid || '').trim()
}

function isAnonymousUser(user: SessionUser | undefined): boolean {
  return Boolean(user?.is_anonymous || user?.isAnonymous)
}

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  const result = await cloudbaseAuth.getSession()
  if (result.error) throw new Error(result.error.message || '读取会话失败')
  const session = readSession(result.data)
  const user = readUser(session)
  const accessToken = session?.access_token || ''
  const uid = readUid(user)
  if (!accessToken || !uid) return { mode: 'signed-out', accessToken: '', uid: '', username: '' }
  return {
    mode: isAnonymousUser(user) ? 'anonymous' : 'authenticated',
    accessToken,
    uid,
    username: guessUsername(user)
  }
}

function guessUsername(user: SessionUser | undefined): string {
  const fromSession = String(user?.name || user?.username || '').trim()
  if (fromSession) return fromSession

  // CloudBase SDK stores user profile separately from session data.
  // Try reading from @cloudbase/js-sdk internal currentUser state.
  try {
    const currentUser = (cloudbaseAuth as unknown as Record<string, unknown>).currentUser as Record<string, unknown> | undefined
    if (currentUser) {
      const name = String(currentUser.name || currentUser.username || '').trim()
      if (name) return name
    }
  } catch { /* ignore */ }

  // Fallback: read from the user_info localStorage key written by the SDK.
  try {
    const raw = localStorage.getItem(`user_info_${env}`)
    if (raw) {
      const info = JSON.parse(raw) as Record<string, unknown>
      return String(info.name || info.username || '').trim()
    }
  } catch { /* ignore */ }

  return ''
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    const refreshed = await cloudbaseAuth.refreshSession()
    if (!refreshed.error) {
      const refreshedSession = readSession(refreshed.data)
      if (refreshedSession?.access_token) return refreshedSession.access_token
    }
  }

  let sessionResult = await cloudbaseAuth.getSession()
  if (sessionResult.error) throw new Error(sessionResult.error.message || '读取会话失败')
  let session = readSession(sessionResult.data)

  if (!session?.access_token) {
    const signInResult = await cloudbaseAuth.signInAnonymously()
    if (signInResult.error) throw new Error(signInResult.error.message || '匿名会话建立失败')
    sessionResult = await cloudbaseAuth.getSession()
    if (sessionResult.error) throw new Error(sessionResult.error.message || '读取匿名会话失败')
    session = readSession(sessionResult.data)
  }

  if (!session?.access_token) throw new Error('未取得会话 access token')
  return session.access_token
}

export async function signInWithPassword(username: string, password: string): Promise<void> {
  const result = await cloudbaseAuth.signInWithPassword({ username, password })
  if (result.error) throw new Error(result.error.message || '用户名或密码错误')
}

export async function signOut(): Promise<void> {
  const result = await cloudbaseAuth.signOut()
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    throw new Error(result.error.message || '退出登录失败')
  }
}
