-- ============================================================
-- BallKnowledgeMeter - Complete Supabase Database Schema
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRESENTATIONS TABLE
CREATE TABLE IF NOT EXISTS presentations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Presentation',
  description TEXT DEFAULT '',
  theme TEXT DEFAULT 'parchment',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SLIDES TABLE
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'mcq', -- 'mcq', 'info', 'leaderboard', 'poll'
  question TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  media_type TEXT DEFAULT 'none', -- 'image', 'video', 'gif', 'none'
  time_limit INTEGER DEFAULT 20, -- seconds
  preview_time INTEGER DEFAULT 5, -- seconds to show question before options unlock
  points_multiplier INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OPTIONS TABLE (For MCQ / Poll slides)
CREATE TABLE IF NOT EXISTS slide_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SESSIONS TABLE (Active live presentations)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_code TEXT UNIQUE NOT NULL, -- Short 5-6 char join code (e.g., 'BK792')
  status TEXT NOT NULL DEFAULT 'lobby', -- 'lobby', 'live', 'reveal', 'leaderboard', 'ended'
  current_slide_id UUID REFERENCES slides(id) ON DELETE SET NULL,
  current_slide_index INTEGER DEFAULT 0,
  phase_started_at TIMESTAMPTZ DEFAULT NOW(), -- Server timestamp for timer synchronization & response speed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- 6. PARTICIPANTS TABLE (Live players joining a session)
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar TEXT DEFAULT '⚽',
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, nickname)
);

-- 7. RESPONSES TABLE (Player answers per slide)
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES slide_options(id) ON DELETE SET NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  response_time_ms INTEGER DEFAULT 0, -- Calculated server-side based on phase_started_at
  points_awarded INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, slide_id, participant_id) -- 1 response per participant per slide
);

-- ============================================================
-- 8. INDEXES FOR HIGH-CONCURRENCY PERFORMANCE (~200 PLAYERS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_session_slide ON responses(session_id, slide_id);
CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id, order_index);
CREATE INDEX IF NOT EXISTS idx_options_slide ON slide_options(slide_id, order_index);

-- ============================================================
-- 9. REALTIME REPLICATION ENABLEMENT
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE responses;

-- ============================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Presentations & Slides: Anyone can read public/active, hosts manage their own
CREATE POLICY "Public presentations are readable by all" ON presentations FOR SELECT USING (true);
CREATE POLICY "Users can insert their own presentations" ON presentations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own presentations" ON presentations FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own presentations" ON presentations FOR DELETE USING (true);

CREATE POLICY "Slides readable by all" ON slides FOR SELECT USING (true);
CREATE POLICY "Slides insertable by all" ON slides FOR INSERT WITH CHECK (true);
CREATE POLICY "Slides updatable by all" ON slides FOR UPDATE USING (true);
CREATE POLICY "Slides deletable by all" ON slides FOR DELETE USING (true);

CREATE POLICY "Options readable by all" ON slide_options FOR SELECT USING (true);
CREATE POLICY "Options insertable by all" ON slide_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Options updatable by all" ON slide_options FOR UPDATE USING (true);
CREATE POLICY "Options deletable by all" ON slide_options FOR DELETE USING (true);

-- Sessions: Anyone can view active sessions (to join), hosts create/update
CREATE POLICY "Sessions are viewable by all" ON sessions FOR SELECT USING (true);
CREATE POLICY "Sessions can be created by anyone" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Sessions can be updated by host" ON sessions FOR UPDATE USING (true);

-- Participants: Anyone can join a session and view participants list
CREATE POLICY "Participants viewable by session" ON participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join as participant" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants score updatable" ON participants FOR UPDATE USING (true);

-- Responses: Players can insert their response and view results
CREATE POLICY "Responses viewable by all in session" ON responses FOR SELECT USING (true);
CREATE POLICY "Participants can submit response" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Responses deletable by host" ON responses FOR DELETE USING (true);

-- ============================================================
-- 11. MEDIA STORAGE & COLUMNS (RUN IF TABLES ALREADY EXIST)
-- ============================================================
ALTER TABLE slides ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '';
ALTER TABLE slides ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'none';
ALTER TABLE slides ADD COLUMN IF NOT EXISTS preview_time INTEGER DEFAULT 5;

-- Supabase Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-media', 'slide-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for slide-media bucket
CREATE POLICY "Public media access" ON storage.objects
  FOR SELECT USING (bucket_id = 'slide-media');

CREATE POLICY "Public media upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'slide-media');

CREATE POLICY "Public media update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'slide-media');

CREATE POLICY "Public media delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'slide-media');

