import { SEO } from '@/components/SEO'
import { NativeHome } from '@/components/mobile/NativeHome'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { WebHome } from '@/components/web/WebHome'

export default function Home() {
  return (
    <>
      <SEO
        title="AbiaConnect — Connecting Abians Worldwide"
        description="Community forum for Abians worldwide. Join discussions on culture, news, events, polls, and subgroups across all 17 LGAs of Abia State."
        path="/"
      />
      {/* The app and the website each have their own home design. */}
      {isNativeApp() ? <NativeHome /> : <WebHome />}
    </>
  )
}
