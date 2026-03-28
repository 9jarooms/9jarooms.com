-- Telegram integration for caretakers
-- Run this migration in Supabase SQL Editor

-- 1. Add telegram_chat_id to caretakers
ALTER TABLE caretakers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. Token table for secure connect flow
CREATE TABLE IF NOT EXISTS telegram_connect_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    caretaker_id UUID NOT NULL REFERENCES caretakers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '15 minutes'
);

-- 3. RLS policies (admin-only access via service key, no user-facing RLS needed)
ALTER TABLE telegram_connect_tokens ENABLE ROW LEVEL SECURITY;
