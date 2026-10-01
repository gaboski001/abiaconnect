import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8">Loading…</div>
  // Remember where the visitor was going, so sign-in can bring them back.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8">Loading…</div>
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
