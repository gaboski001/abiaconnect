import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { CallProvider } from '@/components/call/CallProvider'
import { NativeOnboardingGate } from '@/components/mobile/NativeOnboardingGate'
import { BatteryOptimizationPrompt } from '@/components/mobile/BatteryOptimizationPrompt'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { ScrollToTop } from '@/components/ScrollToTop'
import { useReportNativeInstall } from '@/hooks/useReportNativeInstall'
import { ProtectedRoute, AdminRoute } from '@/routes/ProtectedRoute'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'

// Lazy-load every non-critical route. Home + auth load eagerly because they're the
// most common landing destinations; everything else streams in on navigation.
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const CategoryPage = lazy(() => import('@/pages/Category'))
const Thread = lazy(() => import('@/pages/Thread'))
const CreateThread = lazy(() => import('@/pages/CreateThread'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Profile = lazy(() => import('@/pages/Profile'))
const Polls = lazy(() => import('@/pages/Polls'))
const Subgroups = lazy(() => import('@/pages/Subgroups'))
const SubgroupDetail = lazy(() => import('@/pages/SubgroupDetail'))
const SubgroupInvite = lazy(() => import('@/pages/SubgroupInvite'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Messages = lazy(() => import('@/pages/Messages'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const Go = lazy(() => import('@/pages/Go'))
const EmailDns = lazy(() => import('@/pages/admin/EmailDns'))
const AdminDonations = lazy(() => import('@/pages/admin/Donations'))
const BirthdayPreview = lazy(() => import('@/pages/admin/BirthdayPreview'))
const ModerationLog = lazy(() => import('@/pages/admin/ModerationLog'))
const Donate = lazy(() => import('@/pages/Donate'))
const LgasGuide = lazy(() => import('@/pages/LgasGuide'))
const KnownFor = lazy(() => import('@/pages/KnownFor'))
const AbsuGuide = lazy(() => import('@/pages/AbsuGuide'))
const About = lazy(() => import('@/pages/static/About'))
const Mission = lazy(() => import('@/pages/static/Mission'))
const Team = lazy(() => import('@/pages/static/Team'))
const Careers = lazy(() => import('@/pages/static/Careers'))
const ForumGuidelines = lazy(() => import('@/pages/static/ForumGuidelines'))
const Events = lazy(() => import('@/pages/static/Events'))
const SuccessStories = lazy(() => import('@/pages/static/SuccessStories'))
const MemberSpotlight = lazy(() => import('@/pages/static/MemberSpotlight'))
const Help = lazy(() => import('@/pages/static/Help'))
const ReportIssue = lazy(() => import('@/pages/static/ReportIssue'))
const PrivacyPolicy = lazy(() => import('@/pages/static/PrivacyPolicy'))
const TermsOfService = lazy(() => import('@/pages/static/TermsOfService'))
const CookiePolicy = lazy(() => import('@/pages/static/CookiePolicy'))
const CommunityStandards = lazy(() => import('@/pages/static/CommunityStandards'))
const Unsubscribe = lazy(() => import('@/pages/Unsubscribe'))
const Version = lazy(() => import('@/pages/Version'))
const Relationship = lazy(() => import('@/pages/Relationship'))
const RelationshipEdit = lazy(() => import('@/pages/RelationshipEdit'))
const RelationshipProfilePage = lazy(() => import('@/pages/RelationshipProfile'))
const DatingLikes = lazy(() => import('@/pages/DatingLikes'))
const DatingPremium = lazy(() => import('@/pages/DatingPremium'))
const DatingPaymentCallback = lazy(() => import('@/pages/DatingPaymentCallback'))
const DeviceNotifications = lazy(() => import('@/pages/DeviceNotifications'))
const Download = lazy(() => import('@/pages/Download'))


const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
)

const NotFound = () => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold">404 Not Found</h1>
  </div>
)

export default function App() {
  const navigate = useNavigate()
  useReportNativeInstall()


  useEffect(() => {
    // Listen for deep-links dispatched from MainActivity.java when a notification is tapped
    const handleNativeNotify = (e: any) => {
      const url = e.detail?.url
      if (url) {
        console.log('[NativeBridge] Deep linking to:', url)
        navigate(url)
      }
    }
    window.addEventListener('abiaconnect-native-notification' as any, handleNativeNotify)
    return () => window.removeEventListener('abiaconnect-native-notification' as any, handleNativeNotify)
  }, [navigate])

  return (
    <>
      <ScrollToTop />
      {/* Native-only enhancements */}
      <NativeOnboardingGate />
      {isNativeApp() && (
        <>
          <CallProvider />
          <BatteryOptimizationPrompt />
        </>
      )}

      <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="go/:token" element={<Suspense fallback={<RouteFallback />}><Go /></Suspense>} />

        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="category/:categoryId" element={<CategoryPage />} />
                <Route path="thread/:threadId" element={<Thread />} />
                <Route path="about/lgas" element={<LgasGuide />} />
                <Route path="about/known-for" element={<KnownFor />} />
                <Route path="about/absu" element={<AbsuGuide />} />
                <Route path="about" element={<About />} />
                
                <Route path="mission" element={<Mission />} />
                <Route path="team" element={<Team />} />
                <Route path="careers" element={<Careers />} />
                <Route path="forum-guidelines" element={<ForumGuidelines />} />
                <Route path="events" element={<Events />} />
                <Route path="success-stories" element={<SuccessStories />} />
                <Route path="member-spotlight" element={<MemberSpotlight />} />
                <Route path="help" element={<Help />} />
                <Route path="report-issue" element={<ReportIssue />} />
                <Route path="privacy-policy" element={<PrivacyPolicy />} />
                <Route path="terms-of-service" element={<TermsOfService />} />
                <Route path="cookie-policy" element={<CookiePolicy />} />
                <Route path="community-standards" element={<CommunityStandards />} />
                <Route path="donate" element={<Donate />} />
                <Route path="unsubscribe" element={<Unsubscribe />} />
                <Route path="version" element={<Version />} />
                <Route path="download" element={<Download />} />



                <Route element={<ProtectedRoute />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="polls" element={<Polls />} />
                  <Route path="subgroups" element={<Subgroups />} />
                  <Route path="subgroups/:subgroupId" element={<SubgroupDetail />} />
                  <Route path="subgroups/invite/:token" element={<SubgroupInvite />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="create-thread" element={<CreateThread />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:conversationId" element={<Messages />} />
                  <Route path="relationship" element={<Relationship />} />
                  <Route path="relationship/edit" element={<RelationshipEdit />} />
                  <Route path="relationship/likes" element={<DatingLikes />} />
                  <Route path="relationship/premium" element={<DatingPremium />} />
                  <Route path="relationship/payment/callback" element={<DatingPaymentCallback />} />
                  <Route path="relationship/:userId" element={<RelationshipProfilePage />} />
                  <Route path="settings/devices" element={<DeviceNotifications />} />

                  <Route element={<AdminRoute />}>
                    <Route path="admin/dashboard" element={<AdminDashboard />} />
                    
                    <Route path="admin/email-dns" element={<EmailDns />} />
                    <Route path="admin/donations" element={<AdminDonations />} />
                    <Route path="admin/birthday-preview" element={<BirthdayPreview />} />
                    <Route path="admin/moderation" element={<ModerationLog />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
    </>
  )
}
