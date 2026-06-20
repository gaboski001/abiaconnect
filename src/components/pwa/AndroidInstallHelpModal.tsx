import { useMemo, useState } from 'react'
import { Smartphone, MoreVertical, Download, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AndroidInstallHelpModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type BrowserKey = 'chrome' | 'samsung' | 'firefox' | 'opera'

const STEPS: Record<BrowserKey, { label: string; steps: string[] }> = {
  chrome: {
    label: 'Chrome / Edge',
    steps: [
      'Tap the three-dot icon at the top-right of the browser.',
      'Tap "Install app" or "Add to Home screen".',
      'Tap "Install" to confirm — AbiaConnect will appear on your Home Screen.',
    ],
  },
  samsung: {
    label: 'Samsung Internet',
    steps: [
      'Tap the menu icon (☰) at the bottom-right.',
      'Tap "Add page to" and choose "Home screen".',
      'Tap "Add" — AbiaConnect will appear on your Home Screen.',
    ],
  },
  firefox: {
    label: 'Firefox',
    steps: [
      'Tap the three-dot icon next to the address bar.',
      'Tap "Install" or "Add to Home screen".',
      'Tap "Add" to confirm.',
    ],
  },
  opera: {
    label: 'Opera / Brave',
    steps: [
      'Tap the menu icon in the bottom bar.',
      'Tap "Add to…" and select "Home screen".',
      'Tap "Add" to confirm.',
    ],
  },
}

function detectBrowser(): BrowserKey {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('samsungbrowser')) return 'samsung'
  if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox'
  if (ua.includes('opr/') || ua.includes('opera') || ua.includes('brave')) return 'opera'
  return 'chrome'
}

export function AndroidInstallHelpModal({ open, onOpenChange }: AndroidInstallHelpModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const initial = useMemo(detectBrowser, [])

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Install AbiaConnect</DialogTitle>
          <DialogDescription className="text-center">
            Pick your browser to see the install steps.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initial} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            {(Object.keys(STEPS) as BrowserKey[]).map((k) => (
              <TabsTrigger key={k} value={k} className="text-[11px] px-1">
                {STEPS[k].label.split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(STEPS) as BrowserKey[]).map((k) => (
            <TabsContent key={k} value={k} className="space-y-3 mt-4">
              {STEPS[k].steps.map((s, i) => {
                const Icon = i === 0 ? MoreVertical : i === 1 ? Download : CheckCircle2
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm flex items-start gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
