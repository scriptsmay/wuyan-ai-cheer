export type Mood = 'victory' | 'low' | 'daily' | 'hope'

export interface CheerRef {
  label: string
  value: string
  source: string
}

export interface CheerResult {
  lines: string[]
  emoji_caption: string
  report_id: string
  refs: CheerRef[]
  source_snapshot_at: string
}

export interface Checkin {
  _id: string
  date: string
  tz: string
  streak: number
  total_days: number
  report_id?: string
  created_at: string
  updated_at: string
}

export interface CheckinResult {
  checkin: Checkin
  already_checked_in: boolean
  today_count: number
}

export interface MyCheckin {
  checked_in_today: boolean
  streak: number
  total_days: number
  today?: Checkin
}

export interface CheckinStats {
  date: string
  today_count: number
  updated_at: string
}

export interface ApiErrorBody {
  code: string
  message: string
  request_id: string
  retry_after?: number
}

export type UiStatus = 'idle' | 'loading' | 'success' | 'empty' | 'rate-limited' | 'network-error' | 'service-error'

export interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
}

export interface AppConfig {
  ask_daily_limit?: number
  cheer_daily_limit?: number
}

export interface AuthMe {
  uid: string
  username: string
  mode: 'anonymous' | 'authenticated'
  migrated_at?: string
}

export interface TransferStart {
  transfer_id: string
  ticket: string
  expires_at: string
  source_uid: string
}

export interface TransferComplete {
  transfer_id: string
  migrated: {
    checkins: number
    users: number
    ai_reports: number
  }
  completed_at: string
}
