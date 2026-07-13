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
  is_anonymous?: boolean
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

  if (forceRefresh || !session?.access_token) {
    const signInResult = await cloudbaseAuth.signInAnonymously()
    if (signInResult.error) throw new Error(signInResult.error.message || '匿名会话建立失败')
    sessionResult = await cloudbaseAuth.getSession()
    if (sessionResult.error) throw new Error(sessionResult.error.message || '读取匿名会话失败')
    session = readSession(sessionResult.data)
  }

  if (!session?.access_token) throw new Error('未取得匿名会话 access token')
  return session.access_token
}
