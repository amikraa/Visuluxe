# Provider API Key Encryption Setup

This document explains how to set up and manage the encryption system for provider API keys.

## Overview

All provider API keys are encrypted using **AES-256-GCM** encryption before being stored in the database. This ensures that even if the database is compromised, API keys remain protected.

## Required Secret: ENCRYPTION_KEY

Before using the provider API key encryption feature, you must configure the `ENCRYPTION_KEY` secret.

### Generating a Secure Key

The encryption key must be a 32-byte (256-bit) random value encoded in base64. You can generate one using:

**Using OpenSSL (recommended):**
```bash
openssl rand -base64 32
```

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Using Python:**
```bash
python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

### Adding the Secret

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/vtudqqjmjcsgbpicjrtg
2. Navigate to **Settings → Edge Functions → Secrets**
3. Add a new secret:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** Your generated 32-byte base64 key

## Security Features

### Encryption Details
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **IV:** 96 bits (12 bytes), randomly generated per encryption
- **Authentication:** Built-in with GCM mode

### Access Controls
- Only admin users can encrypt/decrypt API keys
- Decryption requires password re-authentication
- Rate limited to 10 decryptions per admin per hour

### Audit Logging
All decryption operations are logged with:
- Admin user ID
- Provider name
- IP address
- User agent
- Timestamp

Super admins receive notifications when API keys are decrypted.

### Auto-Hide Feature
Decrypted keys are automatically hidden after 30 seconds in the UI to prevent accidental exposure.

## Security Best Practices

1. **Never commit the encryption key to version control**
2. **Rotate the key periodically** (requires re-encryption of all keys)
3. **Monitor audit logs** for unusual decryption activity
4. **Use strong passwords** for admin accounts
5. **Enable 2FA** for admin accounts (when available)

## Key Rotation

If you need to rotate the encryption key:

1. Decrypt all existing keys (document them securely)
2. Generate a new encryption key
3. Update the `ENCRYPTION_KEY` secret in Supabase Dashboard
4. Re-encrypt all provider keys using the "Encrypt All" button

**Warning:** Changing the encryption key without re-encrypting existing keys will make them unreadable.

## Troubleshooting

### "Encryption not configured on server"
The `ENCRYPTION_KEY` secret is not set. Add it via Supabase Dashboard → Settings → Edge Functions → Secrets.

### "Failed to decrypt key"
The key may have been:
- Stored in plain text (use "Encrypt All" to fix)
- Encrypted with a different key
- Corrupted

### Rate limit exceeded
Wait 1 hour or contact a super admin to review audit logs.

## Legacy Keys Migration

If you have providers with plain-text API keys (shown as "Plain Text!" in the UI):

1. Navigate to **Admin → Providers**
2. Click the **"Encrypt All"** button in the warning banner
3. All legacy keys will be encrypted automatically
4. The operation is logged for audit purposes

## Required Secrets Summary

Configure these in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Description |
|--------|-------------|
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM encryption |
| `BOOTSTRAP_KEY` | Owner bootstrap key for initial setup |
| `LOVABLE_API_KEY` | API key for AI image generation service |
