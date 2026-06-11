
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('Super Admin', 'Admin', 'Member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, display_name TEXT, username TEXT UNIQUE, bio TEXT, lga TEXT, dob DATE,
  avatar_url TEXT, reputation INTEGER NOT NULL DEFAULT 0, role TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false, is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('Admin','Super Admin'))
$$;

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, username, lga, dob) VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'lga',
    NULLIF(NEW.raw_user_meta_data->>'dob','')::date
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Member')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE, description TEXT, icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUBGROUPS
CREATE TABLE public.subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT, category TEXT, cover_image_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subgroups TO authenticated;
GRANT SELECT ON public.subgroups TO anon;
GRANT ALL ON public.subgroups TO service_role;
ALTER TABLE public.subgroups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subgroups viewable by everyone" ON public.subgroups FOR SELECT USING (true);
CREATE POLICY "Users create subgroups" ON public.subgroups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin update subgroup" ON public.subgroups FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin(auth.uid()));
CREATE POLICY "Owner or admin delete subgroup" ON public.subgroups FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin(auth.uid()));
CREATE TRIGGER subgroups_updated_at BEFORE UPDATE ON public.subgroups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subgroup_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.subgroup_members TO authenticated;
GRANT SELECT ON public.subgroup_members TO anon;
GRANT ALL ON public.subgroup_members TO service_role;
ALTER TABLE public.subgroup_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by everyone" ON public.subgroup_members FOR SELECT USING (true);
CREATE POLICY "User joins self" ON public.subgroup_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User leaves self" ON public.subgroup_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- THREADS
CREATE TABLE public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subgroup_id UUID REFERENCES public.subgroups(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, content TEXT, tags TEXT[] DEFAULT '{}',
  allow_replies BOOLEAN NOT NULL DEFAULT true,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT SELECT ON public.threads TO anon;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Threads viewable by everyone" ON public.threads FOR SELECT USING (true);
CREATE POLICY "Users create threads" ON public.threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author or admin update thread" ON public.threads FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Author or admin delete thread" ON public.threads FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE TRIGGER threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REPLIES
CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replies TO authenticated;
GRANT SELECT ON public.replies TO anon;
GRANT ALL ON public.replies TO service_role;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Replies viewable by everyone" ON public.replies FOR SELECT USING (true);
CREATE POLICY "Users create replies" ON public.replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author or admin update reply" ON public.replies FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Author or admin delete reply" ON public.replies FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE TRIGGER replies_updated_at BEFORE UPDATE ON public.replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- THREAD VOTES
CREATE TABLE public.thread_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_votes TO authenticated;
GRANT SELECT ON public.thread_votes TO anon;
GRANT ALL ON public.thread_votes TO service_role;
ALTER TABLE public.thread_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes viewable by everyone" ON public.thread_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own votes" ON public.thread_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- BOOKMARKS
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, message TEXT, link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);

-- CONVERSATIONS + MESSAGES
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Participants update conversations" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id))
);
CREATE POLICY "Sender inserts messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Participants update messages" ON public.messages FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id))
);

-- POLLS
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT SELECT ON public.polls TO anon;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls viewable by everyone" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Users create polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin update poll" ON public.polls FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin(auth.uid()));
CREATE POLICY "Owner or admin delete poll" ON public.polls FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin(auth.uid()));

CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT ON public.poll_options TO anon;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poll options viewable by everyone" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Owner or admin manage options" ON public.poll_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND (p.created_by = auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND (p.created_by = auth.uid() OR public.is_admin(auth.uid()))));

CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  poll_option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT SELECT ON public.poll_votes TO anon;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poll votes viewable by everyone" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own poll votes" ON public.poll_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
  reply_id UUID REFERENCES public.replies(id) ON DELETE SET NULL,
  reason TEXT, status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporter or admin read reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reports" ON public.reports FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ACHIEVEMENTS
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT SELECT ON public.achievements TO anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements viewable by everyone" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Admins manage achievements" ON public.achievements FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- SITE SETTINGS
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT SELECT ON public.site_settings TO anon;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site settings viewable by everyone" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
