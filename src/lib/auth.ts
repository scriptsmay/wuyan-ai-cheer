/**
 * 本地 JWT 认证模块
 *
 * 登录 → POST /api/auth/login 获取 JWT → 存入 localStorage
 * 请求 → 读取 localStorage 中的 token → Authorization: Bearer <token>
 * 登出 → 清除 localStorage
 *
 * 兼容旧 cloudbase.ts 的导出接口，最小化组件改动。
 */

const STORAGE_KEY_TOKEN = "auth_token";
const STORAGE_KEY_USERNAME = "auth_username";

// ---- 类型（与旧 cloudbase.ts 兼容） ----

export type AuthMode = "anonymous" | "authenticated" | "signed-out";

export interface AuthSnapshot {
  mode: AuthMode;
  accessToken: string;
  uid: string;
  username: string;
}

// ---- 内部工具 ----

function getStoredToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || "";
  } catch {
    return "";
  }
}

function setStoredToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } catch { /* quota exceeded — silently fail */ }
}

function getStoredUsername(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_USERNAME) || "";
  } catch {
    return "";
  }
}

function setStoredUsername(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_USERNAME, name);
  } catch { /* ignore */ }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
  } catch { /* ignore */ }
}

// ---- 公开 API ----

/**
 * 获取当前 access token。
 * JWT 模式下没有 refresh 机制，forceRefresh 参数仅为接口兼容保留。
 */
export async function getAccessToken(_forceRefresh = false): Promise<string> {
  const token = getStoredToken();
  if (!token) throw new Error("未登录，请先登录账号");
  return token;
}

/**
 * 获取当前认证快照（兼容旧 cloudbase.ts 的 AuthSnapshot 结构）。
 */
export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  const token = getStoredToken();
  const username = getStoredUsername();
  if (!token) {
    return { mode: "signed-out", accessToken: "", uid: "", username: "" };
  }
  return {
    mode: "authenticated",
    accessToken: token,
    uid: username, // JWT 模式下 uid 就是用户名
    username,
  };
}

/**
 * 用户名密码登录 → POST /api/auth/login → 存储 JWT。
 */
export async function signInWithPassword(
  username: string,
  password: string,
): Promise<void> {
  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/$/u, "");
  const resp = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!resp.ok) {
    let msg = "用户名或密码错误";
    try {
      const body = await resp.json();
      if (body?.message) msg = body.message;
    } catch { /* use default */ }
    throw new Error(msg);
  }

  const body = await resp.json();
  const token =
    body?.access_token || body?.data?.access_token || body?.token || "";
  if (!token) throw new Error("服务未返回有效的 access token");

  setStoredToken(token);
  setStoredUsername(username);
}

/**
 * 登出 — 清除本地存储的 token 和用户名。
 */
export async function signOut(): Promise<void> {
  clearStoredAuth();
}

/**
 * 清除当前会话（JWT 模式下等同于 signOut）。
 * 保留此函数以兼容 AuthDialog 中的旧调用。
 */
export async function clearSession(): Promise<void> {
  clearStoredAuth();
}

/**
 * 简易事件发射器，替代 CloudBase SDK 的 onAuthStateChange。
 * 仅用于 AppShell 组件内监听登录/登出变化。
 */
type AuthListener = () => void;
const listeners = new Set<AuthListener>();

export function onAuthChange(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAuthChange(): void {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
