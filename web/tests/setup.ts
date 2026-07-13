import { vi } from 'vitest'

Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { ready: Promise.resolve() }
})

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))
