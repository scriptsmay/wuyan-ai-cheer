import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getClientId } from '../src/lib/client-id'

describe('client id', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('0190f447-4cea-7e74-a63f-9dc3e7fd7aa1')
  })

  it('persists one stable identifier in localStorage', () => {
    expect(getClientId()).toBe('0190f447-4cea-7e74-a63f-9dc3e7fd7aa1')
    expect(getClientId()).toBe('0190f447-4cea-7e74-a63f-9dc3e7fd7aa1')
  })
})
