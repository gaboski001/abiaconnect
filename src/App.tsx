import { Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProtectedRoute, AdminRoute } from '@/routes/ProtectedRoute'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import CategoryPage from '@/pages/Category'
import Thread from '@/pages/Thread'
import CreateThread from '@/pages/CreateThread'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import Polls from '@/pages/Polls'
import Subgroups from '@/pages/Subgroups'
import SubgroupDetail from '@/pages/SubgroupDetail'
import Notifications from '@/pages/Notifications'
import Messages from '@/pages/Messages'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import LgasGuide from '@/pages/LgasGuide'
import KnownFor from '@/pages/KnownFor'
import AbsuGuide from '@/pages/AbsuGuide'
import About from '@/pages/static/About'
import Mission from '@/pages/static/Mission'
import Team from '@/pages/static/Team'
import Careers from '@/pages/static/Careers'
import ForumGuidelines from '@/pages/static/ForumGuidelines'
import Events from '@/pages/static/Events'
import SuccessStories from '@/pages/static/SuccessStories'
import MemberSpotlight from '@/pages/static/MemberSpotlight'
import Help from '@/pages/static/Help'
import ReportIssue from '@/pages/static/ReportIssue'
import PrivacyPolicy from '@/pages/static/PrivacyPolicy'
import TermsOfService from '@/pages/static/TermsOfService'
import CookiePolicy from '@/pages/static/CookiePolicy'
import CommunityStandards from '@/pages/static/CommunityStandards'



const Page = ({ name }: { name: string }) => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold">{name}</h1>
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
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

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="polls" element={<Polls />} />
          <Route path="subgroups" element={<Subgroups />} />
          <Route path="subgroups/:subgroupId" element={<SubgroupDetail />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="create-thread" element={<CreateThread />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:conversationId" element={<Messages />} />

          <Route element={<AdminRoute />}>
            <Route path="admin/dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Page name="404 Not Found" />} />
      </Route>
    </Routes>
  )
}
