import { useState } from 'react'
import { Heart, MessageCircle, Sparkles, UserRound, X } from 'lucide-react'
import { t, type StringKey } from '@/lib/monetization/strings'

const KEY = 'abia:dating-how-it-works-dismissed'

const STEPS: Array<{ Icon: typeof Heart; text: StringKey }> = [
  { Icon: UserRound, text: 'how.step1' },
  { Icon: Heart, text: 'how.step2' },
  { Icon: Sparkles, text: 'how.step3' },
  { Icon: MessageCircle, text: 'how.step4' },
]

function readDismissed() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Short, dismissible explainer for first-time visitors. */
export function HowItWorks() {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* private mode: just hide for this visit */
    }
  }

  return (
    <section
      aria-labelledby="how-it-works-title"
      className="relative mb-4 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-rose-600/5 p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide how it works"
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <h2 id="how-it-works-title" className="mb-2 text-sm font-bold">
        {t('how.title')}
      </h2>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map(({ Icon, text }, i) => (
          <li key={text} className="flex flex-col items-center gap-1.5 rounded-xl bg-card/80 p-2.5 text-center">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pink-600 text-white">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="text-xs leading-snug sm:text-sm">
              <span className="font-semibold text-pink-600">{i + 1}. </span>
              {t(text)}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2 text-right">
        <button type="button" onClick={dismiss} className="text-xs font-semibold text-pink-600 hover:underline">
          {t('how.dismiss')}
        </button>
      </div>
    </section>
  )
}

export default HowItWorks
