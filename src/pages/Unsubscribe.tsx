import { SEO } from '@/components/SEO'

export default function Unsubscribe() {
  return (
    <>
      <SEO title="Unsubscribe" description="Unsubscribe from AbiaConnect emails" path="/unsubscribe" />
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Unsubscribe</h1>
          <p className="text-muted-foreground">
            To stop receiving emails from AbiaConnect, use the unsubscribe link at the bottom of any email we've sent you.
          </p>
        </div>
      </div>
    </>
  )
}
