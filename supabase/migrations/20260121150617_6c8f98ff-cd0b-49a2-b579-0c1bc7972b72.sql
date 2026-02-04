-- Add column to track when API keys were encrypted
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS key_encrypted_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN providers.api_key_encrypted IS 
  'AES-256-GCM encrypted API key. Format: base64(IV + ciphertext + auth_tag)';

COMMENT ON COLUMN providers.key_encrypted_at IS 
  'Timestamp when the API key was encrypted. NULL means the key is either not set or stored in plain text (legacy).';