import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Keyboard-aware inset for chat surfaces.
 *
 * On native (iOS/Android via Capacitor), listens to the on-screen keyboard
 * lifecycle and writes its height into the `--kb-inset` CSS variable on
 * <html>. The composer and message scroller read that variable to stay above
 * the keyboard without fighting the WebView's own resize behavior.
 *
 * On the web the Visual Viewport API is used as a graceful fallback so the
 * behavior is consistent when testing in mobile Chrome/Safari.
 *
 * `onShow` fires whenever the keyboard opens or grows — the chat page uses it
 * to snap the transcript back to the newest message.
 */
export function useKeyboardInset(onShow?: () => void) {
  useEffect(() => {
    const root = document.documentElement
    const setInset = (px: number) => {
      root.style.setProperty('--kb-inset', `${Math.max(0, Math.round(px))}px`)
    }
    setInset(0)

    const isNative = Capacitor.isNativePlatform()

    // Native path — @capacitor/keyboard gives us real, reliable heights.
    if (isNative) {
      let cleanup = () => {}
      let cancelled = false
      ;(async () => {
        try {
          const { Keyboard } = await import('@capacitor/keyboard')
          if (cancelled) return
          const willShow = await Keyboard.addListener('keyboardWillShow', (info) => {
            setInset(info.keyboardHeight)
          })
          const didShow = await Keyboard.addListener('keyboardDidShow', (info) => {
            setInset(info.keyboardHeight)
            onShow?.()
          })
          const willHide = await Keyboard.addListener('keyboardWillHide', () => setInset(0))
          const didHide = await Keyboard.addListener('keyboardDidHide', () => setInset(0))
          cleanup = () => {
            willShow.remove()
            didShow.remove()
            willHide.remove()
            didHide.remove()
          }
        } catch {
          // Plugin unavailable — fall through to viewport fallback.
        }
      })()
      return () => {
        cancelled = true
        cleanup()
        setInset(0)
      }
    }

    // Web / PWA fallback — Visual Viewport shrinks when the keyboard opens.
    const vv = window.visualViewport
    if (!vv) return
    let last = 0
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setInset(inset)
      if (inset > 0 && inset > last + 20) onShow?.()
      last = inset
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset(0)
    }
  }, [onShow])
}
