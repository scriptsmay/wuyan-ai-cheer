import { describe, expect, it } from 'vitest';
import { pairSseEvents } from '../src/lib/sse';

describe('pairSseEvents', () => {
  it('回归：同批次多个同名 event 各自配对紧随其后的 data 行（原 indexOf 按值查找会重复分发首条、丢失其余）', () => {
    const lines = [
      'event: thinking',
      'data: {"text":"生成"}',
      'event: thinking',
      'data: {"text":"30"}',
      'event: thinking',
      'data: {"text":"字"}',
    ];
    const events = pairSseEvents(lines);
    expect(events).toHaveLength(3);
    expect(events.map((e) => JSON.parse(e.data).text)).toEqual(['生成', '30', '字']);
  });

  it('keepalive 注释行与空行被跳过', () => {
    const lines = ['', ':keepalive', 'event: chunk', 'data: {"text":"第一行"}', ''];
    expect(pairSseEvents(lines)).toEqual([{ type: 'chunk', data: '{"text":"第一行"}' }]);
  });

  it('不同事件类型交错时按各自 data 配对', () => {
    const lines = [
      'event: thinking',
      'data: {"text":"想"}',
      'event: chunk',
      'data: {"text":"第一行"}',
      'event: thinking',
      'data: {"text":"考"}',
    ];
    const events = pairSseEvents(lines);
    expect(events.map((e) => e.type)).toEqual(['thinking', 'chunk', 'thinking']);
    expect(events.map((e) => JSON.parse(e.data).text)).toEqual(['想', '第一行', '考']);
  });

  it('末尾 event 行缺 data 行时不产出事件（留待下批次 buffer）', () => {
    expect(pairSseEvents(['event: connected'])).toEqual([]);
  });
});
