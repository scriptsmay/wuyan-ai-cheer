import { describe, expect, it } from 'vitest';
import { FAMILY_BODY, FAMILY_TITLE, FAMILY_WENKAI } from '../src/lib/card/shared';

describe('font placeholder stack', () => {
  it('FAMILY_WENKAI 首位是可运行时替换的占位名', () => {
    expect(FAMILY_WENKAI.startsWith('"--wuyan-body"')).toBe(true);
  });

  it('FAMILY_TITLE 首位是可运行时替换的占位名', () => {
    expect(FAMILY_TITLE.startsWith('"--wuyan-title"')).toBe(true);
  });

  it('占位名之后仍保留原字体栈（线上未注入时行为不变）', () => {
    expect(FAMILY_WENKAI).toContain('"LXGW WenKai Screen"');
    expect(FAMILY_TITLE).toContain('"ZCOOL QingKe HuangYou"');
  });

  it('FAMILY_BODY 不参与字体替换（保持稳定可读）', () => {
    expect(FAMILY_BODY).toBe('"Noto Sans SC", sans-serif');
  });
});
