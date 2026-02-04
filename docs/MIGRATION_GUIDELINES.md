# Migration Guidelines

## Backend Configuration

This project uses a Custom Supabase project as its permanent backend:

- **Project ID:** vtudqqjmjcsgbpicjrtg
- **URL:** https://vtudqqjmjcsgbpicjrtg.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/vtudqqjmjcsgbpicjrtg
- **Edge Functions:** Deployed with JWT verification disabled (verify in code)

### Required Secrets

Configure in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Required | Description |
|--------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 32-byte base64 key for provider API encryption |
| `BOOTSTRAP_KEY` | Yes | Owner bootstrap key (stored in vault) |
| `LOVABLE_API_KEY` | Yes | API key for AI image generation |
| `AI_GATEWAY_URL` | No | Custom AI endpoint (optional override) |

---

## Profile Reliability Header

All migrations that touch user/profile creation MUST include this header:

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

## Historical Migrations

Older migrations (before 2026-01-21) do not include this header.
This is intentional and safe because:

1. **Migrations are immutable** - We cannot rewrite history
2. **Trigger management is out-of-scope** - Migrations don't control `auth.users` triggers
3. **System doesn't depend on triggers** - Client fallback + auto-sync guarantee correctness

## Rules for Future Migrations

1. **Never assume trigger exists** - The `on_auth_user_created` trigger may not be attached in all environments
2. **Never rely on auth.users** - Use `public.profiles` as the single source of truth
3. **Always be idempotent** - Migrations should be safe to run multiple times
4. **Document recovery functions** - Any new recovery function should have a COMMENT

## Trigger Management

The `handle_new_user()` function exists but:

- The trigger on `auth.users` may not be attached (platform limitation)
- The function is documented as "BEST-EFFORT ONLY"
- Profile creation is guaranteed by other layers, not this trigger

### If You Need to Re-Attach the Trigger (Dashboard SQL Only)

```sql
-- This can ONLY be run via Supabase Dashboard SQL Editor
-- It CANNOT be included in migrations (auth schema is restricted)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## See Also

- `docs/PROFILE_RELIABILITY.md` - Full 4-layer architecture documentation
- `src/contexts/AuthContext.tsx` - Client-side fallback implementation
- `supabase/functions/scheduled-profile-sync/` - Auto-healing implementation
