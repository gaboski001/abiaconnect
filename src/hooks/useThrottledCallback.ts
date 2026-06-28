import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns a throttled version of `fn` that fires at most once per `waitMs`,
 * coalescing trailing calls so bursts collapse to a single invocation.
 * Safe across re-renders; cleans up timers on unmount.
 */
export function useThrottledCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  waitMs = 500,
) {
  const fnRef = useRef(fn)
  const lastRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<TArgs | null>(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return useMemo(() => {
    const throttled = (...args: TArgs) => {
      const now = Date.now()
      const elapsed = now - lastRunRef.current
      lastArgsRef.current = args
      if (elapsed >= waitMs) {
        lastRunRef.current = now
        fnRef.current(...args)
        lastArgsRef.current = null
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          lastRunRef.current = Date.now()
          if (lastArgsRef.current) {
            const queued = lastArgsRef.current
            lastArgsRef.current = null
            fnRef.current(...queued)
          }
        }, waitMs - elapsed)
      }
    }
    return throttled
  }, [waitMs])
}

export default useThrottledCallback
