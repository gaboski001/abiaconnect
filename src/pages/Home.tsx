import { SEO } from '@/components/SEO'
import { NativeHome } from '@/components/mobile/NativeHome'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { WebHome } from '@/components/web/WebHome'

export default function Home() {
  return (
    <>
      <SEO
        title="AbiaConnect: Abia State & Igbo Community Forum Online"
        description="The online community for Abia State and Igbo people in Nigeria and abroad: news from Aba, Umuahia and all 17 LGAs, culture, business, jobs and more."
        path="/"
      />
      {/* The app and the website each have their own home design. */}
      {isNativeApp() ? <NativeHome /> : <WebHome />}
    </>
  )
}
