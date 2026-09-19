/**
 * SSE 事件行解析。
 *
 * event 行与 data 行必须相邻配对——不能用 indexOf 按行内容查找：
 * 一次网络批次里常有多个同名 event 行（如逐 token 的 thinking 流），
 * 按值查找会让所有同名事件都配到第一条的 data，导致首条增量被重复分发、
 * 其余增量全部丢失（表现为前端思考文本大量重复）。
 *
 * 用「等待 data 行」的状态机实现：event 行置位，下一行是 data 则产出并复位，
 * 否则复位。避免任何数组下标访问。
 */
export function pairSseEvents(lines: string[]): Array<{ type: string; data: string }> {
  const events: Array<{ type: string; data: string }> = [];
  let pendingType: string | null = null;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (pendingType !== null) {
      if (trimmed.startsWith('data: ')) {
        events.push({ type: pendingType, data: trimmed.slice(6) });
      }
      pendingType = null;
      continue;
    }
    if (trimmed.startsWith('event: ')) {
      pendingType = trimmed.slice(7);
    }
  }
  return events;
}
