# Visuluxe

# AIGen Platform - AI Image Generation

A full-featured AI image generation platform built with React, TypeScript, and Supabase.

## Project Info

**Backend:** Custom Supabase Project (`vtudqqjmjcsgbpicjrtg`)  
**URL:** https://vtudqqjmjcsgbpicjrtg.supabase.co

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **AI:** Multi-provider image generation via AI Gateway

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_PROJECT_ID="vtudqqjmjcsgbpicjrtg"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_bUYkzyODGAROVWu29_xROQ_soRrvnNw"
VITE_SUPABASE_URL="https://vtudqqjmjcsgbpicjrtg.supabase.co"
```

## Edge Functions

Deployed to: `https://vtudqqjmjcsgbpicjrtg.supabase.co/functions/v1/`

| Function | Description |
|----------|-------------|
| `create-api-key` | User API key generation |
| `generate-image` | AI image generation |
| `manage-provider-keys` | Admin provider key encryption/decryption |
| `test-provider-connection` | Provider health checks |
| `refresh-analytics-cache` | Analytics pre-computation |
| `scheduled-profile-sync` | Auto-heal orphaned profiles |

### Required Secrets

Configure these in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Required | Description |
|--------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 32-byte base64 key for provider API encryption |
| `BOOTSTRAP_KEY` | Yes | Owner bootstrap key |
| `LOVABLE_API_KEY` | Yes | API key for AI image generation |
| `AI_GATEWAY_URL` | No | Custom AI endpoint (defaults to Lovable AI Gateway) |

## Features

- **User Authentication** - Email/password, magic link, OTP
- **Image Generation** - Text-to-image with multiple models
- **API Keys** - User-managed API keys with rate limits
- **Admin Panel** - User management, analytics, providers
- **Credit System** - Daily credits + purchased balance
- **Role-Based Access** - Owner, super_admin, admin, moderator, user

## Architecture

### Database Tables

- `profiles` - User profiles and settings
- `user_credits` - Credit balances
- `images` - Generated images
- `api_keys` - User API keys
- `providers` - AI provider configurations
- `ai_models` - Available models
- `admin_audit_logs` - Audit trail

### Security

- Row Level Security (RLS) on all tables
- API key hashing with SHA-256
- Provider key encryption with AES-256-GCM
- Rate limiting per user and API key

## Deployment

Build the production bundle:

```bash
npm run build
```

Deploy the `dist` folder to your preferred hosting provider (Vercel, Netlify, etc.)

## Documentation

- [Encryption Setup](docs/ENCRYPTION_SETUP.md)
- [Profile Reliability](docs/PROFILE_RELIABILITY.md)
- [Migration Guidelines](docs/MIGRATION_GUIDELINES.md)
