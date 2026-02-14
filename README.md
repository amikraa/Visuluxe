# Visuluxe

## Overview

Visuluxe is a production-intent AI image generation SaaS platform that enables users to generate high-fidelity images using advanced diffusion models. The platform provides a complete ecosystem for end-users, developers, and platform administrators, featuring user authentication, credit-based consumption tracking, API key management, and a comprehensive admin governance suite for security, billing, and analytics.

## Features

- **AI Image Generation**: Generate high-quality images from text prompts using multiple AI models with sub-2-second response times
- **Credit-Based System**: User-friendly credit consumption model with configurable costs per generation
- **User Authentication**: Email/password and OAuth (Google) authentication with optional OTP and magic-link support
- **API Integration**: Create and manage API keys for programmatic access to image generation
- **Dashboard & History**: View generation history, manage credits, and download generated images
- **Role-Based Admin Console**: Comprehensive admin panel for managing users, models, providers, billing, security, and analytics
- **Rate Limiting & Security**: IP blocklisting, VPN detection, NSFW filtering, and request rate limiting
- **Notifications**: Real-time notifications with file attachments for users and admins
- **Analytics & Monitoring**: Pre-computed analytics cache, audit logs, and system monitoring
- **Maintenance Mode**: System-wide maintenance controls with selective admin bypass
- **Multi-Provider Support**: Integration with multiple AI providers (OpenAI, Replicate, Stability AI, Together AI, Anthropic, Google, FAL)

## Tech Stack

**Frontend:**
- React 18.3.1
- React Router DOM 6.30.1
- TanStack React Query 5.83.0
- TypeScript
- Tailwind CSS 3.4.17
- Radix UI (component library)
- Vite 5.4.19

**Backend:**
- Supabase (authentication, database, storage, edge functions)
- PostgreSQL (database)
- Deno runtime (edge functions)
- TypeScript

**Build & Testing:**
- Vite (build tool)
- Vitest 2.1.5 (testing framework)
- npm (package manager)

**Hosting & Infrastructure:**
- Supabase Cloud (Backend service)
- Supabase Edge Functions (serverless backend)
- Supabase Storage (file hosting)

## Project Structure

```
Visuluxe/
├── src/
│   ├── pages/                  # Main route pages (Home, Dashboard, Generate, Pricing, Docs, Admin pages)
│   ├── components/            # Reusable React components
│   │   ├── ui/               # Base UI components (buttons, cards, inputs, etc.)
│   │   ├── admin/            # Admin-specific components
│   │   ├── shared/           # Shared components
│   │   └── docs/             # Documentation page sections
│   ├── contexts/             # React context providers (AuthContext, AdminContext)
│   ├── hooks/                # Custom React hooks (useUserCredits, useAvailableModels, etc.)
│   ├── lib/                  # Utility functions and helpers
│   ├── integrations/         # External integrations (Supabase client)
│   ├── assets/               # Static assets
│   ├── App.tsx               # Root component with routing
│   ├── main.tsx              # Application entry point
│   └── index.css             # Global styles
├── supabase/
│   ├── functions/            # Edge Functions (generate-image, create-api-key, etc.)
│   ├── migrations/           # Database schema migrations (SQL)
│   └── config.toml           # Supabase project configuration
├── public/
│   ├── docs.html            # Static API documentation page
│   └── assets/              # Public static files
├── docs/
│   ├── CODEBASE_DEEP_DIVE.md           # Comprehensive codebase documentation
│   ├── TECHNICAL_AUDIT.md              # Technical audit and analysis
│   ├── architecture.md                 # Architecture overview
│   ├── MIGRATION_GUIDELINES.md         # Deployment and migration guide
│   └── __tests__/                      # Documentation tests
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── vitest.config.ts          # Vitest test configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── components.json           # UI component configuration
├── postcss.config.js         # PostCSS configuration
├── eslint.config.js          # ESLint configuration
└── index.html                # HTML template
```

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/amikraa/Visuluxe.git
cd Visuluxe
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
Copy `.env.example` to `.env.local` and configure the required variables.

4. **Configure Supabase:**
- Set up a Supabase project at https://supabase.com
- Configure the project URL and API keys in your environment file

5. **Run database migrations:**
```bash
npm run supabase:migrations
```

## Environment Variables

**Frontend Variables:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

**Supabase Edge Function Secrets:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTION_KEY=your_32_byte_base64_key
LOVABLE_API_KEY=your_ai_api_key
BOOTSTRAP_KEY=your_bootstrap_key
EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=optional_external_key
AI_GATEWAY_URL=optional_custom_ai_endpoint
```

All secrets should be configured in the Supabase Dashboard under Settings → Edge Functions → Secrets.

## Usage

### Development Server

Start the development server on port 8080:
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Run Tests

```bash
npm run test
```

### Lint Code

```bash
npm run lint
```

## API Endpoints

All API interactions are handled through Supabase Edge Functions:

**Image Generation:**
- Function: `generate-image`
- Method: POST
- Auth: Required (JWT or API key)
- Returns: Generated image URLs with metadata

**API Key Management:**
- Function: `create-api-key`
- Method: POST
- Auth: Required (user)
- Returns: API key (shown once)

**Provider Management:**
- Function: `manage-provider-keys`
- Method: POST
- Auth: Required (admin)
- Returns: Provider key information

**Provider Testing:**
- Function: `test-provider-connection`
- Method: POST
- Auth: Required (admin)
- Returns: Health check result

**Analytics:**
- Function: `refresh-analytics-cache`
- Method: POST
- Auth: Service role required
- Returns: Cache update status

**Profile Sync:**
- Function: `scheduled-profile-sync`
- Method: POST
- Auth: Service role required
- Returns: Sync status

**Admin Bootstrap:**
- Function: `assign-external-admin`
- Method: POST
- Auth: Service role required
- Returns: Role assignment status

## How It Works

### Authentication Flow

1. User signs up/logs in via Supabase Auth
2. `AuthContext` handles session hydration and profile creation
3. Role information is fetched and cached
4. Protected routes check authentication status
5. Admin routes additionally verify role permissions

### Image Generation Flow

**Frontend:**
- User enters prompt and selects model
- Credit balance is checked locally
- Request is sent to `generate-image` edge function with JWT token or API key

**Backend:**
- JWT/API key is verified
- Maintenance mode status is checked
- User ban status is verified
- IP blocklist is consulted
- Rate limits (RPM/RPD) are enforced
- Model status and availability are validated
- Credits are deducted from user account
- Generation request is sent to configured AI provider
- Result is stored in database and returned to user

### Admin Management

Administrators can:
- Manage user accounts and roles
- Configure AI providers and models
- Monitor system analytics and metrics
- Handle security events and IP blocks
- Process billing and credit adjustments
- Send system notifications
- Control maintenance mode

### Database Schema

Core tables include:
- `profiles`: User profile information
- `user_roles`: Role assignments
- `user_credits`: Credit balances
- `ai_models`: Available AI models
- `providers`: AI provider configurations
- `api_keys`: User API keys (hashed)
- `images`: Generated images metadata
- `request_logs`: Generation request logs
- `credits_transactions`: Credit transaction history
- `invoices`: Billing invoices
- `notifications`: System notifications
- `system_settings`: Global configuration
- `admin_audit_logs`: Admin action audit trail
- `security_events`: Security-related events
- `ip_blocklist`: Blocked IP addresses

## Future Improvements

- Expand test coverage for critical paths (generation, billing, admin actions)
- Implement CI/CD pipeline for automated lint, type-check, and test gates
- Add structured observability and distributed tracing
- Create comprehensive API contract documentation with examples for all endpoints
- Optimize admin page components (currently some large monolithic files)
- Improve TypeScript compiler strictness configuration
- Replace placeholder metrics in admin dashboard with real analytics
- Add support for additional AI providers
- Implement fine-tuning capabilities
- Add team management and SSO support

## License

Proprietary. All rights reserved.

## Documentation

- [Code Base Guidelines](docs/CODEBASE_DEEP_DIVE.md)
- [Encryption Setup](docs/ENCRYPTION_SETUP.md)
- [Migration Guidelines](docs/MIGRATION_GUIDELINES.md)
- [Profile Reliability](docs/PROFILE_RELIABILITY.md)
- [Architecture](docs/architecture.md)
- [Technical Audit](docs/TECHNICAL_AUDIT.md)
