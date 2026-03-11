-- Verification Queries for Account Type Architecture Fix
-- Date: 2026-03-11
-- Purpose: Verify the migration was successful and data integrity is maintained

-- 1. Verify plan_type ENUM was created successfully
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname = 'plan_type'
GROUP BY t.typname;

-- 2. Verify profiles table has both account_type and plan_type columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('account_type', 'plan_type')
ORDER BY column_name;

-- 3. Verify generation_jobs table has plan_type column and correct data
SELECT 
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN plan_type IS NOT NULL THEN 1 END) as jobs_with_plan_type,
    COUNT(CASE WHEN account_type IS NOT NULL THEN 1 END) as jobs_with_account_type,
    COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as jobs_with_priority
FROM generation_jobs;

-- 4. Verify job priority values are correctly set based on plan_type
SELECT 
    plan_type,
    priority,
    COUNT(*) as job_count
FROM generation_jobs 
WHERE plan_type IS NOT NULL
GROUP BY plan_type, priority
ORDER BY plan_type, priority;

-- 5. Verify profiles have consistent plan_type values
SELECT 
    account_type,
    plan_type,
    COUNT(*) as user_count
FROM profiles 
WHERE plan_type IS NOT NULL
GROUP BY account_type, plan_type
ORDER BY account_type, plan_type;

-- 6. Verify job_logs table has plan_type column
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_logs' 
AND column_name IN ('account_type', 'plan_type')
ORDER BY column_name;

-- 7. Verify user_plan_info view was created successfully
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'user_plan_info';

-- 8. Test the get_user_priority function
SELECT 
    user_id,
    plan_type,
    get_user_priority(user_id) as calculated_priority
FROM profiles 
WHERE plan_type IS NOT NULL
LIMIT 10;

-- 9. Verify migration completion was logged
SELECT 
    key,
    value,
    description,
    updated_at
FROM system_settings 
WHERE key = 'migration_20260311171500_completed';

-- 10. Check for any jobs with invalid plan_type values
SELECT 
    job_id,
    plan_type,
    account_type
FROM generation_jobs 
WHERE plan_type NOT IN ('free', 'pro', 'enterprise')
AND plan_type IS NOT NULL;

-- 11. Verify RLS policies are in place for new columns
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policy 
WHERE tablename IN ('profiles', 'generation_jobs', 'job_logs')
AND policyname LIKE '%plan_type%' OR policyname LIKE '%account_type%';

-- 12. Test the update_user_plan function (dry run)
-- This will return false for non-admin users, which is expected
SELECT update_user_plan('00000000-0000-0000-0000-000000000000', 'pro'::plan_type) as test_result;

-- 13. Verify indexes were created for plan_type columns
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('profiles', 'generation_jobs', 'job_logs')
AND indexname LIKE '%plan_type%';

-- 14. Check data consistency between profiles and jobs
SELECT 
    p.plan_type,
    COUNT(gj.job_id) as job_count,
    AVG(gj.priority) as avg_priority
FROM profiles p
LEFT JOIN generation_jobs gj ON p.user_id = gj.user_id
WHERE p.plan_type IS NOT NULL
GROUP BY p.plan_type
ORDER BY p.plan_type;

-- 15. Verify the migration function exists and is callable
SELECT 
    proname,
    prokind,
    prosrc
FROM pg_proc 
WHERE proname = 'migrate_account_type_to_plan_type';

-- 16. Test the log_job_event_fixed function signature
SELECT 
    proname,
    proargnames,
    proargtypes
FROM pg_proc 
WHERE proname = 'log_job_event_fixed';

-- 17. Verify all new functions have proper security definitions
SELECT 
    proname,
    prosecdef,
    prokind
FROM pg_proc 
WHERE proname IN (
    'get_user_priority',
    'update_user_plan', 
    'migrate_account_type_to_plan_type',
    'log_job_event_fixed'
);

-- 18. Check for any orphaned jobs (jobs without corresponding user profiles)
SELECT 
    COUNT(*) as orphaned_jobs
FROM generation_jobs gj
LEFT JOIN profiles p ON gj.user_id = p.user_id
WHERE p.user_id IS NULL;

-- 19. Verify the user_plan_info view returns expected data
SELECT 
    user_id,
    username,
    account_type,
    plan_type,
    is_super_admin,
    credits_balance,
    daily_credits
FROM user_plan_info 
LIMIT 5;

-- 20. Final verification - ensure no enum conflicts exist
SELECT 
    'plan_type enum values' as check_type,
    array_agg(DISTINCT plan_type) as values_found
FROM generation_jobs 
WHERE plan_type IS NOT NULL

UNION ALL

SELECT 
    'account_type enum values' as check_type,
    array_agg(DISTINCT account_type) as values_found  
FROM profiles 
WHERE account_type IS NOT NULL;