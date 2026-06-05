-- 1. Create Core Tables

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  uid text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  password text NOT NULL,
  email text UNIQUE NOT NULL,
  dept text,
  subject text, -- For teachers
  year text, -- For students
  section text, -- For students
  face_descriptor jsonb,
  rfid_tag text UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL DEFAULT 3,
  color text DEFAULT '#00e5ff',
  created_at timestamp with time zone DEFAULT now()
);

-- Schedules (Master Timetable) mapping subjects to teachers and times
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_code text REFERENCES public.subjects(code) ON DELETE CASCADE,
  teacher_uid text REFERENCES public.users(uid) ON DELETE SET NULL,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time text NOT NULL, -- e.g., '9:00 AM'
  created_at timestamp with time zone DEFAULT now()
);

-- IoT Nodes status
CREATE TABLE IF NOT EXISTS public.iot_nodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id text UNIQUE NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'MAINTENANCE')),
  signal integer DEFAULT 0,
  last_ping timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Setup RLS (Row Level Security) - Allowing generic read/write for the MVP
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_nodes ENABLE ROW LEVEL SECURITY;

-- Create generic permissive policies for development (Should be restricted in Production)
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable read access for all subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Enable read access for all schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Enable read access for all nodes" ON public.iot_nodes FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all subjects" ON public.subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all schedules" ON public.schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all nodes" ON public.iot_nodes FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all subjects" ON public.subjects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all schedules" ON public.schedules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all nodes" ON public.iot_nodes FOR UPDATE USING (true) WITH CHECK (true);
