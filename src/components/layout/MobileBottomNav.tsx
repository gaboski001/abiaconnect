import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, MessageSquare, Bell, User } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  const unreadNotifs = useQuery({
    queryKey: ['notifications-unread', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const unreadMessages = useQuery({
    queryKey: ['messages-unread', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`);
      const ids = (convs ?? []).map((c) => c.id);
      if (!ids.length) return 0;
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .eq('is_read', false)
        .neq('sender_id', user!.id);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  if (!isNative) return null;

  const NAV_ITEMS = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Chat', icon: MessageSquare, path: '/messages', badge: unreadMessages.data },
    { label: 'Dash', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Alerts', icon: Bell, path: '/notifications', badge: unreadNotifs.data },
    { label: 'Me', icon: User, path: '/profile' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border z-50 px-2 pb-safe-offset-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 ${
                active ? 'text-primary scale-110' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`size-6 ${active ? 'fill-primary/10' : ''}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-background">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-80'}`}>
                {item.label}
              </span>

              {active && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -bottom-1 w-12 h-1 rounded-full bg-primary/20"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
