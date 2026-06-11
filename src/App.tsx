import { Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProtectedRoute, AdminRoute } from '@/routes/ProtectedRoute'
import Home from '@/pages/Home'

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
        <Route path="login" element={<Page name="Login" />} />
        <Route path="register" element={<Page name="Register" />} />
        <Route path="forgot-password" element={<Page name="Forgot Password" />} />
        <Route path="category/:categoryId" element={<Page name="Category" />} />
        <Route path="thread/:threadId" element={<Page name="Thread" />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Page name="Dashboard" />} />
          <Route path="profile" element={<Page name="Profile" />} />
          <Route path="polls" element={<Page name="Polls" />} />
          <Route path="subgroups" element={<Page name="Subgroups" />} />
          <Route path="notifications" element={<Page name="Notifications" />} />
          <Route path="create-thread" element={<Page name="Create Thread" />} />
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
