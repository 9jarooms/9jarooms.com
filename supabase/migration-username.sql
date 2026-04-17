-- Add username support to owners and caretakers
-- Username is used for admin-created accounts instead of email
-- Auth email will be {username}@9jarooms.internal (fake, never receives mail)
-- Real email is optional and stored in the profile table for password reset etc.

-- Caretakers
ALTER TABLE caretakers
  ADD COLUMN IF NOT EXISTS username TEXT,
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE caretakers
  ADD CONSTRAINT caretakers_username_unique UNIQUE (username);

-- Owners
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS username TEXT,
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE owners
  ADD CONSTRAINT owners_username_unique UNIQUE (username);
