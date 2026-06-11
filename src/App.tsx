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

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="polls" element={<Page name="Polls" />} />
          <Route path="subgroups" element={<Page name="Subgroups" />} />
          <Route path="notifications" element={<Page name="Notifications" />} />
          <Route path="create-thread" element={<CreateThread />} />
          <Route path="messages" element={<Page name="Messages" />} />
          <Route path="messages/:conversationId" element={<Page name="Conversation" />} />

          <Route element={<AdminRoute />}>
            <Route path="admin/dashboard" element={<Page name="Admin Dashboard" />} />
          </Route>
        </Route>

        <Route path="*" element={<Page name="404 Not Found" />} />
      </Route>
    </Routes>
  )
}
