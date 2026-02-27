-- =============================================
-- WhatsApp AI Concierge — Database Migration
-- =============================================

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  whatsapp_id TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  user_name TEXT,
  metadata JSONB
);

-- Safely add columns if they are missing (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'whatsapp_id') THEN
        ALTER TABLE conversations ADD COLUMN whatsapp_id TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'status') THEN
        ALTER TABLE conversations ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'user_name') THEN
        ALTER TABLE conversations ADD COLUMN user_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'metadata') THEN
        ALTER TABLE conversations ADD COLUMN metadata JSONB;
    END IF;

    -- New columns for AI Concierge upgrade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'stage') THEN
        ALTER TABLE conversations ADD COLUMN stage TEXT DEFAULT 'idle';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'guest_email') THEN
        ALTER TABLE conversations ADD COLUMN guest_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'guest_phone') THEN
        ALTER TABLE conversations ADD COLUMN guest_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'guest_name') THEN
        ALTER TABLE conversations ADD COLUMN guest_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'selected_property_id') THEN
        ALTER TABLE conversations ADD COLUMN selected_property_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'selected_room_id') THEN
        ALTER TABLE conversations ADD COLUMN selected_room_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'check_in') THEN
        ALTER TABLE conversations ADD COLUMN check_in DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'check_out') THEN
        ALTER TABLE conversations ADD COLUMN check_out DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'booking_id') THEN
        ALTER TABLE conversations ADD COLUMN booking_id UUID;
    END IF;
END $$;

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  metadata JSONB,
  processed BOOLEAN DEFAULT FALSE
);

-- Add processed column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'processed') THEN
        ALTER TABLE messages ADD COLUMN processed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_id ON conversations(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unprocessed ON messages(conversation_id, processed) WHERE processed = FALSE;

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
    DROP POLICY IF EXISTS "Admins can view all messages" ON messages;

    -- Allow service role full access (for the AI agent)
    DROP POLICY IF EXISTS "Service role full access conversations" ON conversations;
    DROP POLICY IF EXISTS "Service role full access messages" ON messages;
    
    CREATE POLICY "Admins can view all conversations" ON conversations
      FOR ALL USING (is_admin());

    CREATE POLICY "Admins can view all messages" ON messages
      FOR ALL USING (is_admin());
END $$;
