export type Mood = 'victory' | 'low' | 'daily' | 'hope';

/**
 * 「常用英雄」括号详情拆出来的结构化战绩。
 * 线上原始值形如 `夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）…`，
 * 拆分后每位英雄一条，局数/胜率可能缺失（后端只给名字时两者为 undefined）。
 */
export interface HeroStat {
  name: string;
  games?: number;
  winRate?: number;
}

export interface CheerRef {
  label: string;
  value: string;
  source: string;
  /** 仅英雄类条目携带；卡片据此改走「名字 + 局数 + 胜率」胶囊渲染，而非普通指标 */
  hero?: HeroStat;
}

export interface CheerResult {
  lines: string[];
  emoji_caption: string;
  report_id: string;
  refs: CheerRef[];
  source_snapshot_at: string;
}

export interface Checkin {
  _id: string;
  date: string;
  tz: string;
  streak: number;
  total_days: number;
  report_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckinResult {
  checkin: Checkin;
  already_checked_in: boolean;
  today_count: number;
}

export interface MyCheckin {
  checked_in_today: boolean;
  streak: number;
  total_days: number;
  today?: Checkin;
}

export interface CheckinStats {
  date: string;
  today_count: number;
  updated_at: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
  retry_after?: number;
}

export type UiStatus = 'idle' | 'loading' | 'success' | 'empty' | 'rate-limited' | 'network-error' | 'service-error';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
}

export interface AppConfig {
  ask_daily_limit?: number;
  cheer_daily_limit?: number;
}
