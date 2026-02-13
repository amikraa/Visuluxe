# Visuluxe Codebase Deep Dive

> This document is a comprehensive technical analysis of the Visuluxe codebase, intended as a definitive onboarding and maintenance reference for developers, operators, and reviewers.

---

## 1. Project Overview & Purpose

### Project Name
- **Visuluxe**.

### Primary Purpose
Visuluxe is an AI image generation web platform with:
- end-user image generation,
- credit-based usage accounting,
- user API key lifecycle,
- notifications,
- and a role-based admin control plane (security, billing, providers, models, analytics, settings).

### Target Audience
- **End users** generating images and managing credits/API keys.
- **Developers** integrating via API keys.
- **Operators/Admins** running moderation, security, billing, and platform configuration.

### Typical Use Cases
1. A user signs in and generates images from selected models.
2. A developer creates API keys and calls platform endpoints programmatically.
3. Admins adjust credits, issue invoices, test providers, and monitor abuse events.
4. System operators run profile-reliability maintenance and analytics cache refresh jobs.

### Domain / Industry
- AI SaaS / image generation platform / developer tooling.

### Project Maturity (Assessment)
- **Production-intent / late beta**: broad operational coverage, but some placeholders and limited tests still indicate hardening work remains.

---

## 2. Technology Stack & Versions

### Programming Languages
- **TypeScript / TSX**: frontend app and most app logic.
- **TypeScript (Deno style)**: Supabase Edge Functions.
- **SQL**: migrations/schema.
- **CSS**: styling layers.
- **Markdown**: project documentation.

### Language Standards / Config Signals
- TypeScript target: `ES2020`.
- Module: `ESNext` (bundler resolution).
- JSX: `react-jsx`.

### Frameworks & Libraries
#### Core frontend
- `react` `^18.3.1`
- `react-dom` `^18.3.1`
- `react-router-dom` `^6.30.1`
- `@tanstack/react-query` `^5.83.0`
- `@supabase/supabase-js` `^2.90.0`

#### UI / UX
- Extensive Radix UI packages (`@radix-ui/*`) for primitives.
- `tailwindcss` `^3.4.17`
- `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react` icons
- `sonner` toasts

#### Forms / validation
- `react-hook-form`, `@hookform/resolvers`, `zod`

#### Data viz / misc
- `recharts`, `date-fns`, `embla-carousel-react`, etc.

#### Build / lint / test
- `vite` `^5.4.19`
- `@vitejs/plugin-react-swc` `^3.11.0`
- `eslint` `^9.32.0`
- `vitest` `^2.1.5`

### Runtime Environments
- Node.js runtime for local frontend tooling (npm + vite).
- Deno runtime for Supabase Edge Functions.

### Build Tools & Package Managers
- Build tool: **Vite**.
- Package manager: **npm** (`package-lock.json` present).
- Optional/legacy artifact: `bun.lockb` exists.

### Database & Storage
- **Supabase Postgres** (SQL migrations define schema).
- No ORM; direct Supabase query API.
- Caching table: `analytics_cache`.
- Supabase Storage used for invoice and notification attachment files.

### Infrastructure & Deployment
- Supabase project-backed architecture.
- Supabase Edge Functions configured via `supabase/config.toml`.
- JWT verification in function config is disabled; handlers do auth checks in code.

---

## 3. Complete Codebase Structure

## Top-Level Tree (functional view)
- `src/`: frontend app source.
- `supabase/functions/`: edge/serverless backend endpoints.
- `supabase/migrations/`: DB migrations.
- `docs/`: operational and architecture docs.
- `public/`: static assets.
- `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`: tooling config.

## Major Modules

### `src/App.tsx`
- Global composition root.
- Mounts providers (`QueryClientProvider`, `AuthProvider`, `AdminProvider`).
- Defines public/user/admin routes and nested admin area.
- Includes maintenance gate logic that can block selected protected routes.

### `src/contexts/AuthContext.tsx`
- Session and user state.
- Profile retrieval/update and fallback profile creation.
- Ensures `user_credits` existence.
- Logs fallback profile events via RPC.

### `src/contexts/AdminContext.tsx`
- Role and account-type hydration.
- Exposes capability flags (`isAdmin`, `isSuperAdmin`, `canAccessAdmin`, etc.).

### `src/components/ProtectedRoute.tsx`
- Blocks user routes for unauthenticated sessions.

### `src/components/admin/AdminProtectedRoute.tsx`
- Role-based guard for admin routes.
- Supports read-only analyst mode.

### `src/pages/Generate.tsx`
- Main product UI.
- Handles prompt/model settings, invokes `generate-image`, and maps backend errors to UX.

### `src/pages/Dashboard.tsx`
- User dashboard for credits, API keys, stats, and recent image activity.

### `src/pages/admin/*`
- Admin modules:
  - `AdminUsers`
  - `AdminModels`
  - `AdminProviders`
  - `AdminSecurity`
  - `AdminBilling`
  - `AdminSettings`
  - `AdminAnalytics`
  - `AdminLogs`, `AdminAPIKeys`, etc.

### `supabase/functions/*`
- `generate-image`: generation pipeline + abuse/limit controls.
- `create-api-key`: API key issuance and hash persistence.
- `manage-provider-keys`: encryption/decryption workflow.
- `test-provider-connection`: provider health test endpoint.
- `scheduled-profile-sync`: profile reliability auto-heal job.
- `refresh-analytics-cache`: precompute analytics snapshots.
- `assign-external-admin`: admin bootstrap role assignment helper.

### Architecture Pattern
- **Modular monorepo** with a SPA frontend + serverless edge backend + SQL schema layer.
- Frontend pattern: route-centric pages + hooks + context providers.
- Backend pattern: function-per-capability with explicit request-time auth checks.

---

## 4. How the Code Works (Technical Deep Dive)

## Startup Lifecycle
1. Browser loads `index.html`, then `src/main.tsx` mounts React app.
2. `src/App.tsx` sets global providers and route tree.
3. `AuthContext` subscribes to auth state and fetches profile.
4. `AdminContext` resolves role/account flags.
5. Routes render through `ProtectedRoute`/`AdminProtectedRoute` as needed.

## Core Request/Response Flow Example (Generate)
1. User submits prompt in `Generate.tsx`.
2. UI calls `supabase.functions.invoke('generate-image')`.
3. Edge function:
   - validates auth (JWT/API key),
   - checks maintenance mode,
   - checks bans / IP blocklist,
   - checks rate limits and credits,
   - resolves model availability/fallback,
   - performs generation call,
   - logs request/result.
4. Response returns images/error; UI updates cards/toasts/history and refreshes credits.

## Background/Scheduled Processing
- `scheduled-profile-sync` periodically finds orphaned auth users and creates missing profiles/credits, logs audit trail, and notifies super admins.
- `refresh-analytics-cache` refreshes summary metrics and prunes expired cache entries.

---

## 5. Data Models & Schema Summary

Main entities (from migrations):
- Identity/access: `profiles`, `user_roles`, `admin_invites`
- Credits/billing: `user_credits`, `credits_transactions`, `invoices`
- Generation domain: `providers`, `ai_models`, `images`, `request_logs`, `api_keys`
- Security/ops: `security_events`, `ip_blocklist`, `admin_audit_logs`, `system_settings`, `analytics_cache`, `notifications`

Notable constraints/relationships:
- `user_id` appears as cross-table identity key.
- `ai_models.provider_id` references `providers.id`.
- `images` references model/provider/api_key dimensions for traceability.

---

## 6. API / Endpoint Catalog (Edge Functions)

> Edge functions are configured in Supabase and invoked by name.

1. `generate-image`
   - Auth: required (API key or bearer token path in handler)
   - Behavior: generation orchestration + limits/security checks
   - Key statuses: 400, 401, 402, 403, 429, 503, 500

2. `create-api-key`
   - Auth: required
   - Behavior: validates, creates hashed API key record, returns full key once

3. `manage-provider-keys`
   - Auth: admin required
   - Behavior: encrypt/decrypt/masked retrieval logic with re-auth and audit

4. `test-provider-connection`
   - Auth: admin required
   - Behavior: provider test call with rate limiting

5. `scheduled-profile-sync`
   - Auth: service role context
   - Behavior: orphan profile reconciliation + notifications

6. `refresh-analytics-cache`
   - Auth: service role context
   - Behavior: analytics precompute and cache maintenance

7. `assign-external-admin`
   - Auth/usage: specialized bootstrap utility for external project role assignment

---

## 7. Authentication & Authorization

### Authentication
- Supabase Auth used with:
  - email/password,
  - Google OAuth,
  - optional OTP and magic-link configuration via system settings.

### Authorization
- User page access: `ProtectedRoute`.
- Admin page access: `AdminProtectedRoute` with role hierarchy and per-route `requiredRole`.
- Backend-sensitive actions: role checks inside edge functions (`is_admin_or_above` RPC and role lookups).

### Role System
- Roles include: `super_admin`, `admin`, `moderator`, `support`, `analyst`, `user`.
- `analyst` mode is explicitly read-only in admin UX layer.

---

## 8. User Guide

## End Users
1. Sign up/sign in.
2. Navigate to Generate.
3. Select model and generation settings.
4. Generate images; handle any credit/rate-limit/maintenance errors.
5. Review dashboard/history and download outputs.
6. Optionally create API keys for external integration.

## Developers
### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure env values (Supabase URL/publishable key).
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Build:
   ```bash
   npm run build
   ```
5. Test:
   ```bash
   npm run test
   ```

### Env Variables (observed)
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Backend function secrets (docs + code):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `LOVABLE_API_KEY`
- `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`

---

## 9. Code Quality Analysis

## Organization
- Strong modular separation of pages/components/hooks/contexts/functions.
- Some large admin files (notably billing/settings/security) indicate refactor opportunities.

## Best Practices Followed
- Role-gated route wrappers.
- Centralized error sanitization utility.
- Lazy-loaded non-critical routes.
- Security-centric backend checks in generation and key management paths.

## Best Practices Missing / Weak
- Relaxed TypeScript strictness.
- Minimal automated test coverage.
- Function JWT verification disabled in Supabase config (relies on handler checks).

## Documentation State
- README and architecture docs exist.
- Additional docs for encryption/migration/profile reliability exist.
- Could still improve generated API reference style docs.

---

## 10. Bugs, Errors, and Issues

## Identified Issues (sample high-value list)

### Issue A — README contains internal token artifact
- Severity: Low
- Impact: Documentation polish issue
- Location: `README.md` currently includes an internal-style reference token in summary line.
- Suggested fix: remove token string and keep plain prose.

### Issue B — `.env` appears in repo and .gitignore does not exclude `.env`
- Severity: High (process/security hygiene)
- Impact: Potential accidental secret leakage pattern.
- Suggested fix: add `.env*` patterns to `.gitignore`; introduce `.env.example`.

### Issue C — Edge function JWT verification disabled globally
- Severity: High
- Impact: Security posture relies on each handler implementing checks correctly.
- Suggested fix: enable `verify_jwt = true` per function where feasible; document exceptions.

### Issue D — Placeholder admin dashboard metrics
- Severity: Medium
- Impact: Can mislead operations decisions.
- Suggested fix: wire to real analytics source.

### Issue E — Limited test suite
- Severity: Medium
- Impact: regressions may slip into critical paths.
- Suggested fix: add integration tests for auth/generate/billing/security.

---

## 11. Missing Core Functionality / Technical Debt

### Missing / thin areas
- Comprehensive integration/e2e tests.
- CI pipeline config for lint/test/type-check gates.
- Stronger structured observability and tracing.
- Explicit API contract docs with examples for every edge endpoint.

### Technical debt indicators
- Large monolithic admin page files.
- Relaxed TS compiler strictness.
- Placeholder metrics in admin dashboard.

---

## 12. Dependencies & Integrations

## External Integrations
- Supabase (Auth, DB, Storage, Edge Functions).
- AI provider gateway path in generation function via settings/secrets.

## Dependency health comments
- Package versions look modern.
- Full vulnerability/deprecation state requires runtime tooling (`npm audit`, `npm outdated`) in a network-enabled environment.

---

## 13. Performance & Scalability

## Existing positives
- Route-level lazy loading for many pages.
- Analytics precompute cache job.

## Potential bottlenecks
- Multiple DB queries per generation request (rate-limit counts + model/credits checks).
- Large admin pages with many queries and rich client-side filtering.

## Scaling recommendations
- Add targeted DB indexes for high-frequency filters (`request_logs.created_at`, `images.user_id+created_at`, etc.).
- Consider moving heavy analytics reads to precomputed materialized views/caches.
- Add explicit timeout/retry/circuit-breaker patterns around provider calls.

---

## 14. Maintenance & Extensibility Recommendations

1. Tighten TS strictness incrementally.
2. Implement CI quality gates.
3. Expand tests from unit → integration → e2e critical paths.
4. Refactor very large admin pages into domain subcomponents/services.
5. Harden edge auth policy by enabling JWT verification where possible.
6. Clean environment-variable hygiene and docs (`.env.example`, secret handling policy).

---

## 15. Significant File Inventory

| File | Purpose | Approx Complexity |
|---|---|---|
| `src/App.tsx` | Global app composition and route map | Moderate |
| `src/contexts/AuthContext.tsx` | Auth/session/profile lifecycle | Complex |
| `src/contexts/AdminContext.tsx` | Role capability context | Moderate |
| `src/pages/Generate.tsx` | Main generation UX | Complex |
| `src/pages/Dashboard.tsx` | User account and activity dashboard | Complex |
| `src/pages/admin/AdminBilling.tsx` | Credits + invoice admin logic | Very Complex |
| `src/pages/admin/AdminSecurity.tsx` | Security controls and event monitoring | Complex |
| `src/pages/admin/AdminSettings.tsx` | Platform/system settings | Complex |
| `supabase/functions/generate-image/index.ts` | Core generation backend pipeline | Very Complex |
| `supabase/functions/manage-provider-keys/index.ts` | Provider key crypto and admin controls | Complex |
| `supabase/functions/create-api-key/index.ts` | User API key issuance | Moderate |
| `supabase/functions/test-provider-connection/index.ts` | Provider connectivity diagnostics | Complex |
| `supabase/functions/scheduled-profile-sync/index.ts` | Reliability self-heal task | Moderate |
| `docs/migrations/lovable_cloud_to_custom_supabase.sql` | Canonical schema/function reference | Complex |
| `src/lib/errorUtils.ts` | Safe user-facing error mapping/redaction | Moderate |
| `src/lib/__tests__/errorUtils.test.ts` | Unit tests for error sanitization | Simple |

---

## 16. Final Summary

Visuluxe is a full-stack (frontend + serverless backend) AI image SaaS platform with strong operational breadth. The architecture is clear and extensible, with robust admin functionality and meaningful security controls in critical backend paths. The most important next steps are test-depth expansion, config hardening (JWT verification policy), and maintainability improvements on very large admin modules.
