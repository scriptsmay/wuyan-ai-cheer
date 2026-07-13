import type { RenderedCard } from './card-renderer'

export function requiresLongPressSave(): boolean {
  const userAgent = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/iu.test(userAgent)
  const isWechat = /MicroMessenger/iu.test(userAgent)
  return isIos || isWechat
}

export function downloadCard(card: RenderedCard): void {
  const url = URL.createObjectURL(card.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = card.filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
