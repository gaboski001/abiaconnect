export type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
let iosFlag = false

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  // @ts-expect-error legacy iOS standalone
  window.navigator.standalone !== true

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // @ts-expect-error legacy iOS standalone
  window.navigator.standalone === true

export function setDeferredPrompt(e: BIPEvent | null) {
  deferred = e
}

export function getDeferredPrompt(): BIPEvent | null {
  return deferred
}

export function setIOSFlag(v: boolean) {
  iosFlag = v
}

export function getIOSFlag(): boolean {
  return iosFlag
}
