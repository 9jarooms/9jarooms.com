-- 0. Create the site_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Grant roles for site_settings so Next.js can read it safely
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_settings TO authenticated;

-- 2. Enable RLS and add public read policy
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create the policy (Drops if exists to allow safe re-runs)
DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings" ON site_settings FOR SELECT USING (true);
