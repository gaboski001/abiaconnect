import { CategoryList } from '@/components/forum/CategoryList'
import { SEO } from '@/components/SEO'
import { SidebarWidgets } from '@/components/forum/SidebarWidgets'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { NativeHome } from '@/components/mobile/NativeHome'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'

export default function Home() {
  return (
    <>
      <SEO
        title="AbiaConnect — Connecting Abians Worldwide"
        description="Community forum for Abians worldwide. Join discussions on culture, news, events, polls, and subgroups across all 17 LGAs of Abia State."
        path="/"
      />
      {isNativeApp() ? (
        <NativeHome />
      ) : (
      <div className="space-y-12">
        <HeroSlider />

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <CategoryList />
          </div>
          <div className="lg:col-span-4">
            <SidebarWidgets />
          </div>
        </div>
      </div>
      )}
    </>
  )
}
