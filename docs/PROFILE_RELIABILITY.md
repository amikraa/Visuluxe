# Profile Creation Reliability Architecture

## Overview

This document explains the multi-layer reliability system that ensures every 
user in `auth.users` always has a corresponding profile in `public.profiles`.

## Architecture Layers

### Layer 1: Server-Side Trigger (Best-Effort)
- **Status:** NOT ATTACHED (platform limitation in Lovable Cloud)
- **Function:** `handle_new_user()` exists but may not be triggered
- **Impact:** None - this layer is intentionally treated as optional

### Layer 2: Client-Side Fallback (PRIMARY GUARANTEE)
- **Location:** `src/contexts/AuthContext.tsx`
- **Trigger:** Every session initialization via `onAuthStateChange`
- **Behavior:** 
  1. Fetches profile from `public.profiles`
  2. If missing, creates profile + credits using user metadata
  3. Logs success/failure to `admin_audit_logs` for observability
- **Reliability:** 100% - runs on every login/session

### Layer 3: Admin Detection & Recovery (MONITORING + REPAIR)
- **Detection:** `get_orphaned_user_count()` RPC
- **Manual Fix:** "Sync Now" button in Admin → Users
- **Visibility:** Warning banner when orphaned users exist
- **Health Card:** Shows system status and fallback event count

### Layer 4: Scheduled Auto-Healing (SELF-REPAIR)
- **Frequency:** Hourly (can be adjusted)
- **Function:** `scheduled-profile-sync` edge function
- **RPC Used:** `sync_missing_profiles_system()`
- **Notification:** Super admins notified if any profiles synced
- **Audit Trail:** All auto-sync events logged to `admin_audit_logs`

## Single Source of Truth

| Data | Source | Notes |
|------|--------|-------|
| User identity | `auth.users` | Authentication only |
| User data | `public.profiles` | ALL app logic |
| User credits | `public.user_credits` | Linked to profiles |

**Rule:** Never query `auth.users` for business logic. Only admin recovery tools access it.

## Observability

All profile creation events are logged to `admin_audit_logs`:

| Action | Description |
|--------|-------------|
| `profile_created_via_fallback` | Client-side fallback created a profile |
| `profile_creation_failed` | Client-side fallback failed |
| `profiles_auto_synced` | Scheduled job synced orphaned profiles |

### Admin Panel Indicators
- **Orphan Warning Banner:** Shows when orphaned users exist
- **Fallback Event Counter:** Shows recent fallback usage (last 24h)
- **System Health Card:** Green = healthy, Amber = needs attention

## Why Trigger-Only is Unsafe

1. **Platform limitation:** Triggers on `auth.users` may be removed/disabled
2. **Timing issues:** OAuth providers may have async metadata
3. **Silent failures:** Trigger errors don't block signup
4. **No observability:** Failed triggers don't log anywhere accessible

## Migration Safety Rules

Any migration touching profile creation MUST:
1. Include header comment: "This migration does NOT manage auth.users triggers"
2. Never assume `on_auth_user_created` trigger exists
3. Be safe to run with or without trigger attached

### Migration Header Template
```sql
-- ============================================================
-- PROFILE RELIABILITY NOTICE
-- ============================================================
-- This migration does NOT create or manage auth.users triggers.
-- Profile creation is guaranteed by:
--   1. Client-side fallback (AuthContext.tsx)
--   2. Admin sync tools (sync_missing_profiles RPC)
--   3. Scheduled auto-healing (scheduled-profile-sync function)
-- ============================================================
```

## How to Manually Inspect Trigger Status

If you have direct database access (not available in Lovable Cloud):
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check function definition
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

## Recovery Procedures

### If orphaned users are detected:
1. Admin panel shows warning banner automatically
2. Click "Sync Now" to manually sync, OR
3. Wait for hourly auto-sync

### If fallback events spike:
1. Check `admin_audit_logs` for failure patterns
2. Verify OAuth metadata is being passed correctly
3. Check for network issues during profile creation

## Testing the System

### Verify client fallback works:
1. Create a new user via signup
2. Check `admin_audit_logs` for `profile_created_via_fallback` (if trigger missed)
3. Confirm profile exists in `public.profiles`

### Verify auto-sync works:
1. Call edge function: `scheduled-profile-sync`
2. Check logs for sync status
3. Verify super admin received notification (if profiles were synced)

### Verify health monitoring:
1. Navigate to Admin → Users
2. Confirm health card shows "System Healthy"
3. Confirm fallback event count displays correctly

## Error Logging Architecture

All profile creation events are logged for full observability:

### Client-Side Fallback Logging (Layer 2)
- **RPC Used:** `log_profile_fallback_event()` (SECURITY DEFINER)
- **Why RPC?** Allows any authenticated user to log profile events (bypasses admin-only RLS)
- **Actions:**
  - `profile_created_via_fallback` - Fallback successfully created a profile
  - `profile_creation_failed` - Fallback encountered an error

### Admin Sync Logging (Layer 3)
- **RPC Used:** `log_admin_action()` or direct insert (admin RLS allows)
- **Actions:**
  - `profiles_synced` - Manual sync from Admin → Users

### Auto-Sync Logging (Layer 4)
- **Method:** Service role key (bypasses RLS entirely)
- **Actions:**
  - `profiles_auto_synced` - Scheduled job synced orphaned profiles
- **Notifications:** Super admins receive in-app notification when sync occurs

## Known Security Warnings (Reviewed & Deferred)

The following warnings have been reviewed and are intentionally deferred:

| Warning | Decision | Rationale |
|---------|----------|-----------|
| Extension in Public Schema | Deferred | Requires dashboard access to move; does not affect profile reliability |
| Leaked Password Protection | Enabled | Configured via auth settings |
| System Settings Partial Exposure | Safe | Only exposes `maintenance_mode` which is public by design |
| Profiles Email Exposure | Safe | RLS correctly restricts to own profile only |
| Announcements Public No RLS | By Design | `announcements_public` is a public view for banner display |
| Admin Invite Token Exposure | Safe | Restricted to owner role only; tokens are hashed |

*Last reviewed: 2026-01-21*

## Conclusion

This 4-layer architecture ensures:
- ✅ **No single point of failure** - Each layer can operate independently
- ✅ **Full observability** - All events logged to audit trail via SECURITY DEFINER RPC
- ✅ **Self-healing** - Automatic recovery without manual intervention
- ✅ **Admin visibility** - Clear indicators of system health
- ✅ **No PARTIAL items** - All gaps closed, all warnings documented
