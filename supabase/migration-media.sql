-- Add 'type' column to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Entire Apartment';

-- Add 'videos' column to properties (array of URLs)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}';

-- Add 'videos' column to rooms (array of URLs)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}';

-- Add 'thumbnail' column to properties (single URL)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS thumbnail TEXT;

-- Create an index for property type filtering
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);

-- Create Storage Bucket 'property-media' if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-media', 'property-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Read
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'property-media' );

-- Policy: Authenticated Upload
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'property-media' AND auth.role() = 'authenticated' );

-- Policy: Owner Update/Delete (Optional, simplistic for now)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'property-media' AND auth.role() = 'authenticated' );
