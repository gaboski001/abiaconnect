import { useState } from 'react'
import { Share, PlusSquare, CheckCircle2, Smartphone, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface IOSInstallHelpModalProps {
  trigger?: React.ReactNode
}

export function IOSInstallHelpModal({ trigger }: IOSInstallHelpModalProps) {
  const [open, setOpen] = useState(false)

  const steps = [
    {
      icon: Share,
      title: 'Tap the Share button',
      description: 'In Safari, tap the Share icon at the bottom of your screen.',
    },
    {
      icon: PlusSquare,
      title: 'Select "Add to Home Screen"',
      description: 'Scroll down in the share sheet and tap "Add to Home Screen".',
    },
    {
      icon: CheckCircle2,
      title: 'Tap "Add"',
      description: 'Confirm by tapping "Add" in the top-right corner.',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Install AbiaConnect</DialogTitle>
          <DialogDescription className="text-center">
            Follow these steps to add AbiaConnect to your Home Screen.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {i + 1}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <step.icon className="h-3.5 w-3.5 text-primary" />
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
