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
  /** 能力分项的联盟名次；卡片据此优先抽取第 1 名，2/3 名只在前者缺席时兜底 */
  abilityRank?: number;
}

/** KPL 能力分榜的单项条目，后端只下发全联盟第 1~3 名 */
export interface AbilityField {
  key: string;
  label: string;
  score: number;
  rank: number;
}

/** 后端结构化的能力数据，替代 refs 里「对抗路分榜第1能力」这类合并长文本 */
export interface AbilitiesDisplay {
  score: number;
  overall_rank: number | null;
  position: string | null;
  position_rank: number | null;
  fields: AbilityField[];
}

export interface CheerResult {
  lines: string[];
  emoji_caption: string;
  report_id: string;
  refs: CheerRef[];
  source_snapshot_at: string;
  abilities_display?: AbilitiesDisplay | null;
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
