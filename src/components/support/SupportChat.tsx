import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, HelpCircle, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { SUPPORT_EMAIL, type QA } from '@/lib/helpCentre'
import { findAnswers, intentOf } from '@/lib/helpMatch'
import { cn } from '@/lib/utils'

type Msg =
  | { from: 'me'; text: string }
  | { from: 'bot'; text: string; answer?: QA; more?: QA[]; contact?: boolean }

const STARTERS = ['How do I change my profile picture?', 'How do I report a post?', 'How do I add an event?', 'How do I volunteer?']

const GREETING: Msg = {
  from: 'bot',
  text: 'Hello! Ask me anything about using AbiaConnect, in your own words. I answer from our Help Centre.',
}

function reply(text: string): Msg {
  const intent = intentOf(text)
  if (intent === 'hello') return { from: 'bot', text: 'Hello! What would you like help with?' }
  if (intent === 'thanks') return { from: 'bot', text: 'You are welcome. Ask me anything else any time.' }
  if (intent === 'human') {
    return { from: 'bot', text: 'Our team is happy to help. Tell us what is happening and we will reply by email.', contact: true }
  }
  const found = findAnswers(text)
  if (!found.length) {
    return {
      from: 'bot',
      text: 'Sorry, I could not find an answer to that in our Help Centre. Try asking in other words, or tell our team and we will reply by email.',
      contact: true,
    }
  }
  const [best, ...rest] = found
  return { from: 'bot', text: best.item.a, answer: best.item, more: rest.map((m) => m.item) }
}

/**
 * The chat window. Loaded only when someone opens it (see SupportChatLauncher),
 * so the Help Centre text isn't downloaded on every page.
 */
export function SupportChat({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const native = isNativeApp()

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [msgs, open])

  const ask = (q: string) => {
    const clean = q.trim().slice(0, 300)
    if (!clean) return
    setMsgs((m) => [...m, { from: 'me', text: clean }, reply(clean)])
    setText('')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(text)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={native ? 'bottom' : 'right'}
          className={cn('flex flex-col gap-0 p-0', native ? 'h-[85dvh] rounded-t-2xl' : 'w-full sm:max-w-md')}
        >
          <div className="border-b px-4 py-3 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="size-5 text-secondary" /> AbiaConnect Help
            </SheetTitle>
            <SheetDescription className="text-xs">Instant answers from our Help Centre.</SheetDescription>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m, i) =>
              m.from === 'me' ? (
                <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.text}
                </p>
              ) : (
                <BotMessage key={i} msg={m} onAsk={ask} />
              ),
            )}
            {msgs.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border px-3 py-1.5 text-left text-xs font-medium hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your question…"
              aria-label="Your question"
              maxLength={300}
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Ask">
              <Send />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

function BotMessage({ msg, onAsk }: { msg: Extract<Msg, { from: 'bot' }>; onAsk: (q: string) => void }) {
  return (
    <div className="max-w-[90%] space-y-2">
      <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm">
        {msg.answer ? <p className="mb-1 font-semibold">{msg.answer.q}</p> : null}
        <p className="leading-relaxed">{msg.text}</p>
      </div>
      {msg.answer?.link ? (
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link to={msg.answer.link.to}>
            {msg.answer.link.label} <ArrowRight />
          </Link>
        </Button>
      ) : null}
      {msg.more?.length ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Did you mean:</p>
          {msg.more.map((q) => (
            <button
              key={q.q}
              type="button"
              onClick={() => onAsk(q.q)}
              className="block w-full rounded-lg border px-3 py-1.5 text-left text-xs font-medium hover:bg-muted"
            >
              {q.q}
            </button>
          ))}
        </div>
      ) : null}
      {msg.contact ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8">
            <Link to="/report-issue">Tell our team</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail /> {SUPPORT_EMAIL}
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default SupportChat

