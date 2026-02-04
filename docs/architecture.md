# Architecture & Functional Overview

## 1) High-Level Overview

Visuluxe is a React + Vite single-page application backed by Supabase. It offers AI image generation for end users, a credit system for usage tracking, API key management for programmatic access, notifications, and a dedicated admin console for operational controls. The frontend lives in `src/`, while backend logic is implemented via Supabase Edge Functions in `supabase/functions/`, backed by a Postgres schema defined in the migration SQL.【F:src/main.tsx†L1-L8】【F:src/App.tsx†L1-L146】【F:supabase/functions/generate-image/index.ts†L1-L260】【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L83-L386】

**Primary users**
- **End users**: generate images, manage credits, view history, and create API keys.【F:src/pages/Generate.tsx†L1-L220】【F:src/pages/Dashboard.tsx†L1-L220】【F:src/components/APIKeyCreationModal.tsx†L1-L200】
- **Admins/operators**: manage models/providers/users, billing, security, and analytics via the admin console.【F:src/pages/admin/AdminDashboard.tsx†L1-L229】【F:src/components/admin/AdminSidebar.tsx†L1-L183】

## 2) Architecture Breakdown

### Frontend
- **Framework**: React + Vite, entry at `src/main.tsx`.【F:src/main.tsx†L1-L8】
- **Routing**: React Router in `src/App.tsx`, with public, protected, and admin routes. Admin routes are nested under `/admin`.【F:src/App.tsx†L1-L146】
- **State/Data**:
  - Auth state in `AuthContext` (profile sync + fallback creation).【F:src/contexts/AuthContext.tsx†L1-L214】
  - Role state in `AdminContext`.【F:src/contexts/AdminContext.tsx†L1-L117】
  - Server data via TanStack Query hooks (credits, models, analytics, notifications).【F:src/hooks/useUserCredits.ts†L1-L190】【F:src/hooks/useAvailableModels.ts†L1-L30】【F:src/hooks/useNotifications.ts†L1-L190】

### Backend (Supabase Edge Functions)
- **generate-image**: Validates auth, maintenance mode, bans, IP blocklist, and rate limits before generating images and logging requests.【F:supabase/functions/generate-image/index.ts†L1-L260】
- **create-api-key**: Generates and hashes API keys, inserts into `api_keys`.【F:supabase/functions/create-api-key/index.ts†L1-L200】
- **manage-provider-keys**: Encrypts/decrypts provider keys with admin checks and rate limits.【F:supabase/functions/manage-provider-keys/index.ts†L1-L200】
- **test-provider-connection**: Admin-only provider health checks with per-provider rate limiting.【F:supabase/functions/test-provider-connection/index.ts†L1-L200】
- **refresh-analytics-cache**: Pre-computes analytics caches for reporting.【F:supabase/functions/refresh-analytics-cache/index.ts†L1-L200】

### Database Layer (Supabase Postgres)
Key tables include:
- **User/roles**: `profiles`, `user_roles`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L87-L142】
- **Credits/billing**: `user_credits`, `credits_transactions`, `invoices`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L144-L386】
- **AI models/providers**: `ai_models`, `providers`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L110-L286】
- **Images/usage**: `images`, `request_logs`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L318-L369】
- **Security/audit**: `security_events`, `ip_blocklist`, `admin_audit_logs`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L164-L235】
- **Notifications/settings**: `notifications`, `system_settings`, `admin_invites`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L155-L351】

### Authentication
Supabase Auth powers email/password and OAuth (Google), with optional OTP/magic-link settings sourced from `system_settings`. Auth state + profile fallback creation are handled in `AuthContext`.【F:src/pages/SignIn.tsx†L1-L120】【F:src/hooks/useAuthSettings.ts†L1-L57】【F:src/contexts/AuthContext.tsx†L1-L214】

### External Integrations
- **AI generation**: Edge function uses system settings and `LOVABLE_API_KEY` to call model providers via server-side logic.【F:supabase/functions/generate-image/index.ts†L69-L260】
- **Supabase Storage**: Invoices and notification attachments use storage buckets (`invoice-files`, `notification-attachments`).【F:src/pages/admin/AdminBilling.tsx†L260-L320】【F:src/pages/Notifications.tsx†L52-L120】

## 3) Feature Map (Major Features + Data Flow)

### User Features
1. **Image Generation**
   - UI: `src/pages/Generate.tsx`
   - Flow: UI → `generate-image` edge function → `images` + `request_logs` tables → UI refresh and credits update.【F:src/pages/Generate.tsx†L1-L220】【F:supabase/functions/generate-image/index.ts†L1-L260】【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L318-L369】

2. **Dashboard & History**
   - UI: `src/pages/Dashboard.tsx`
   - Flow: UI → `user_credits`, `images`, `api_keys` queries → UI render.【F:src/pages/Dashboard.tsx†L1-L220】【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L144-L337】

3. **API Key Management**
   - UI: `src/components/APIKeyCreationModal.tsx`
   - Flow: UI → `create-api-key` edge function → `api_keys` table → UI refresh.【F:src/components/APIKeyCreationModal.tsx†L1-L200】【F:supabase/functions/create-api-key/index.ts†L1-L200】

4. **Notifications**
   - UI: `src/pages/Notifications.tsx` + `useNotifications`
   - Flow: UI ↔ `notifications` table; attachments via storage bucket downloads.【F:src/pages/Notifications.tsx†L1-L120】【F:src/hooks/useNotifications.ts†L1-L190】

### Credits & Billing
1. **Credits Tracking**
   - Hook: `useUserCredits` + `useUserStats`
   - Flow: UI → `user_credits`, `images`, `request_logs` → UI stats and balances.【F:src/hooks/useUserCredits.ts†L1-L190】

2. **Admin Billing**
   - UI: `src/pages/admin/AdminBilling.tsx`
   - Flow: Admin UI → `user_credits`/`credits_transactions`/`invoices` tables → UI updates; invoice files stored in Supabase Storage.【F:src/pages/admin/AdminBilling.tsx†L1-L320】【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L144-L386】

## 4) Admin Panel Deep Dive

### Access & Roles
Admin access is enforced by `AdminProtectedRoute`, using role data from `AdminContext` (`user_roles` table). Analysts are read-only and shown a banner.【F:src/components/admin/AdminProtectedRoute.tsx†L1-L118】【F:src/contexts/AdminContext.tsx†L1-L117】

### Admin Capabilities
- **Users**: role management, orphaned user detection, profile syncs.【F:src/pages/admin/AdminUsers.tsx†L1-L200】
- **Models/Providers**: manage models/providers, encrypt keys, test connectivity.【F:src/pages/admin/AdminProviders.tsx†L1-L220】
- **Security**: IP blocklist, security events, bans, system security toggles.【F:src/pages/admin/AdminSecurity.tsx†L1-L200】
- **Billing**: credit adjustments, transactions, invoice management.【F:src/pages/admin/AdminBilling.tsx†L1-L320】
- **Analytics**: reporting and CSV export for usage and credits.【F:src/pages/admin/AdminAnalytics.tsx†L1-L200】
- **Settings**: maintenance mode, auth settings (OTP/magic-link), daily credits defaults.【F:src/pages/admin/AdminSettings.tsx†L1-L200】

## 5) Security & Permissions

- **Role system**: roles in `user_roles`, enforced in `AdminProtectedRoute`.【F:docs/migrations/lovable_cloud_to_custom_supabase.sql†L133-L142】【F:src/components/admin/AdminProtectedRoute.tsx†L1-L118】
- **Protected routes**: `ProtectedRoute` for user pages, `AdminProtectedRoute` for admin pages.【F:src/components/ProtectedRoute.tsx†L1-L33】【F:src/components/admin/AdminProtectedRoute.tsx†L1-L118】
- **Error sanitization**: `errorUtils` blocks sensitive info from leaking to the UI.【F:src/lib/errorUtils.ts†L1-L189】
- **Rate limiting**: enforced in `generate-image` (RPM/RPD) and provider tests (in-memory).【F:supabase/functions/generate-image/index.ts†L28-L260】【F:supabase/functions/test-provider-connection/index.ts†L10-L200】

## 6) Data Flow Examples

1. **User login**
   - UI (`SignIn`) → Supabase Auth → `AuthContext` profile fetch/fallback → UI session state.【F:src/pages/SignIn.tsx†L1-L120】【F:src/contexts/AuthContext.tsx†L1-L214】

2. **Generate image**
   - UI (`Generate`) → `generate-image` edge function → DB insert/updates → UI refresh + credit refetch.【F:src/pages/Generate.tsx†L1-L220】【F:supabase/functions/generate-image/index.ts†L1-L260】

3. **Credit adjustment**
   - Admin UI (`AdminBilling`) → update `user_credits` + insert `credits_transactions` → UI refresh.【F:src/pages/admin/AdminBilling.tsx†L1-L320】

4. **Admin provider test**
   - Admin UI (`AdminProviders`) → `test-provider-connection` edge function → UI result toast/modal.【F:src/pages/admin/AdminProviders.tsx†L1-L220】【F:supabase/functions/test-provider-connection/index.ts†L1-L200】

## 7) Testing & Reliability

- **Tests**: Vitest configuration and error-utils unit tests are present. Expand coverage for critical flows (generation, billing, admin actions) for stronger guarantees.【F:vitest.config.ts†L1-L8】【F:src/lib/__tests__/errorUtils.test.ts†L1-L30】
- **Reliability controls**: maintenance-mode gating, rate limits, audit logs, and analytics caching are implemented server-side.【F:src/components/MaintenanceBanner.tsx†L1-L200】【F:supabase/functions/generate-image/index.ts†L1-L260】【F:supabase/functions/refresh-analytics-cache/index.ts†L1-L200】

## 8) Deployment & Environment

Key environment variables:
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.【F:src/integrations/supabase/client.ts†L1-L17】
- Edge functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY`, `ENCRYPTION_KEY`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`.【F:supabase/functions/generate-image/index.ts†L69-L88】【F:supabase/functions/manage-provider-keys/index.ts†L69-L120】【F:supabase/functions/test-provider-connection/index.ts†L108-L140】【F:supabase/functions/assign-external-admin/index.ts†L24-L58】

Build scripts are defined in `package.json` for `dev`, `build`, and `preview`.【F:package.json†L6-L12】

## 9) Summary

Visuluxe is a Supabase-backed AI image platform with a React/Vite frontend, serverless edge functions for core operations, and a comprehensive admin console. It combines credit-based usage, API key access, notifications, and extensive administrative tooling for system management and observability.【F:src/App.tsx†L1-L146】【F:supabase/functions/generate-image/index.ts†L1-L260】【F:src/pages/admin/AdminDashboard.tsx†L1-L229】
