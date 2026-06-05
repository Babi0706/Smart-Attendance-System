-- =============================================
-- Smart Attend - Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Create 'users' table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')),
    department TEXT,
    year TEXT,
    section TEXT,
    subject TEXT,
    wallet_address TEXT,
    face_data TEXT,
    face_descriptor TEXT,
    fingerprint_data TEXT,
    rfid_uid TEXT UNIQUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists and you need to add biometric columns:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS face_data TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS fingerprint_data TEXT;

-- 2. Create 'iot_nodes' table
CREATE TABLE IF NOT EXISTS iot_nodes (
    id TEXT PRIMARY KEY,
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'MAINTENANCE')),
    signal_strength INTEGER DEFAULT 0,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) but allow all operations for anon key
-- This is for development/demo purposes only

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_nodes ENABLE ROW LEVEL SECURITY;

-- Allow all operations on users table (for demo)
CREATE POLICY "Allow all operations on users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Allow all operations on iot_nodes table (for demo)  
CREATE POLICY "Allow all operations on iot_nodes" ON iot_nodes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Create 'attendance_logs' table for metadata persistence
CREATE TABLE IF NOT EXISTS attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    tx_hash TEXT UNIQUE NOT NULL,
    uid TEXT NOT NULL,
    name TEXT,
    dept TEXT,
    subject TEXT,
    subject_code TEXT,
    teacher TEXT,
    method TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create 'rfid_scans' table for real-time hardware triggers
CREATE TABLE IF NOT EXISTS rfid_scans (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT,
    node_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and allow all for demo
ALTER TABLE rfid_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on rfid_scans" ON rfid_scans
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE rfid_scans;

-- 6. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_attendance_tx_hash ON attendance_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher ON attendance_logs(teacher);
