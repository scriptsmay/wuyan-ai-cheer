class TestFontFace {
  family: string
  source: string

  constructor(family: string, source: string) {
    this.family = family
    this.source = source
  }

  async load(): Promise<TestFontFace> {
    return this
  }
}

if (!('FontFace' in globalThis)) {
  Object.defineProperty(globalThis, 'FontFace', { value: TestFontFace })
}

if (typeof document !== 'undefined' && !document.fonts) {
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() } })
}

if (!globalThis.localStorage) {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear()
    }
  })
}
