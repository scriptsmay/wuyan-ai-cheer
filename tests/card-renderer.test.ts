import { describe, expect, it } from 'vitest'
import { CARD_HEIGHT, CARD_WIDTH } from '../src/lib/card-renderer'

describe('card renderer contract', () => {
  it('keeps the fixed 1080 by 1440 export size', () => {
    expect(CARD_WIDTH).toBe(1080)
    expect(CARD_HEIGHT).toBe(1440)
    expect(CARD_WIDTH / CARD_HEIGHT).toBe(0.75)
  })
})
