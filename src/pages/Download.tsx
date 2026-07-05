import { SEO } from '@/components/SEO'
import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'

export default function Download() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO
        title="Download the AbiaConnect App"
        description="Get the latest Android and iOS builds of the AbiaConnect app."
        path="/download"
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Download the app</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Install the latest native build to get the newest features and fixes.
        </p>
      </div>
      <NativeAppDownload />
    </div>
  )
}
