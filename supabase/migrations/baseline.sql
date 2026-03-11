


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."account_type" AS ENUM (
    'normal',
    'partner'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."announcement_type" AS ENUM (
    'info',
    'warning',
    'error',
    'success',
    'maintenance'
);


ALTER TYPE "public"."announcement_type" OWNER TO "postgres";


CREATE TYPE "public"."api_key_status" AS ENUM (
    'active',
    'suspended',
    'expired',
    'revoked',
    'rate_limited'
);


ALTER TYPE "public"."api_key_status" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'admin',
    'moderator',
    'user',
    'support',
    'analyst'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."block_reason" AS ENUM (
    'abuse',
    'spam',
    'ddos',
    'vpn',
    'proxy',
    'manual',
    'country'
);


ALTER TYPE "public"."block_reason" OWNER TO "postgres";


CREATE TYPE "public"."credit_transaction_type" AS ENUM (
    'add',
    'deduct',
    'refund',
    'expire',
    'daily_reset',
    'generation'
);


ALTER TYPE "public"."credit_transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."image_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."image_status" OWNER TO "postgres";


CREATE TYPE "public"."model_access_level" AS ENUM (
    'public',
    'partner_only',
    'admin_only'
);


ALTER TYPE "public"."model_access_level" OWNER TO "postgres";


CREATE TYPE "public"."model_status" AS ENUM (
    'active',
    'beta',
    'disabled',
    'offline'
);


ALTER TYPE "public"."model_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'info',
    'warning',
    'error',
    'success',
    'credit',
    'security',
    'system'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."plan_type" AS ENUM (
    'free',
    'pro',
    'enterprise'
);


ALTER TYPE "public"."plan_type" OWNER TO "postgres";


CREATE TYPE "public"."provider_status" AS ENUM (
    'active',
    'inactive',
    'maintenance',
    'error'
);


ALTER TYPE "public"."provider_status" OWNER TO "postgres";


CREATE TYPE "public"."security_event_type" AS ENUM (
    'login_failed',
    'rate_limit',
    'suspicious_activity',
    'api_abuse',
    'blocked_ip',
    'auto_ban',
    'prompt_filter',
    'vpn_detected'
);


ALTER TYPE "public"."security_event_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_user_role"("_target_user_id" "uuid", "_role" "public"."app_role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target_is_owner boolean;
  v_caller_is_owner boolean;
  v_existing_role record;
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can assign roles');
  END IF;
  
  -- Check if caller is the owner
  SELECT is_owner INTO v_caller_is_owner
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_owner = true;
  
  v_caller_is_owner := COALESCE(v_caller_is_owner, false);
  
  -- Only the owner can assign super_admin role
  IF _role = 'super_admin' AND NOT v_caller_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the system owner can create super_admins');
  END IF;
  
  -- Check if target is the owner (is_owner = true)
  SELECT is_owner INTO v_target_is_owner
  FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = true;
  
  IF v_target_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify the system owner role');
  END IF;
  
  -- Non-owner super_admins cannot modify other super_admins
  IF NOT v_caller_is_owner THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _target_user_id AND role = 'super_admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the owner can modify super_admin roles');
    END IF;
  END IF;
  
  -- Remove existing role
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = false;
  
  -- Insert new role (unless it's 'user' which means no entry needed)
  IF _role != 'user' THEN
    INSERT INTO public.user_roles (user_id, role, is_owner, created_by)
    VALUES (_target_user_id, _role, false, auth.uid());
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'role', _role
  );
END;
$$;


ALTER FUNCTION "public"."assign_user_role"("_target_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_ai_models_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, new_value)
    VALUES (
      COALESCE(NEW.created_by, auth.uid()),
      'model_created',
      'ai_models',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'model_id', NEW.model_id, 'status', NEW.status, 'access_level', NEW.access_level)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'model_updated',
      'ai_models',
      NEW.id,
      jsonb_build_object('name', OLD.name, 'status', OLD.status, 'access_level', OLD.access_level),
      jsonb_build_object('name', NEW.name, 'status', NEW.status, 'access_level', NEW.access_level)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value)
    VALUES (
      auth.uid(),
      'model_deleted',
      'ai_models',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'model_id', OLD.model_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_ai_models_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_user_roles_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, new_value)
    VALUES (
      COALESCE(NEW.created_by, NEW.user_id),
      'role_assigned',
      'user_roles',
      NEW.user_id,
      jsonb_build_object('role', NEW.role, 'is_owner', NEW.is_owner)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'role_updated',
      'user_roles',
      NEW.user_id,
      jsonb_build_object('role', OLD.role, 'is_owner', OLD.is_owner),
      jsonb_build_object('role', NEW.role, 'is_owner', NEW.is_owner)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value)
    VALUES (
      auth.uid(),
      'role_removed',
      'user_roles',
      OLD.user_id,
      jsonb_build_object('role', OLD.role, 'is_owner', OLD.is_owner)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_user_roles_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_owner"("_user_id" "uuid", "_bootstrap_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_expected_key text;
  v_owner_exists boolean;
  v_user_exists boolean;
BEGIN
  -- Get bootstrap key from environment variable (set via Supabase secrets)
  v_expected_key := current_setting('app.settings.bootstrap_key', true);
  
  -- If not set via app.settings, try to get from vault
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    BEGIN
      SELECT decrypted_secret INTO v_expected_key 
      FROM vault.decrypted_secrets 
      WHERE name = 'BOOTSTRAP_KEY'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  
  -- If still no key configured, return error
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bootstrap key not configured on server');
  END IF;
  
  IF _bootstrap_key != v_expected_key THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bootstrap key');
  END IF;
  
  -- Check if an owner already exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE is_owner = true
  ) INTO v_owner_exists;
  
  IF v_owner_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner already exists. Bootstrap can only be run once.');
  END IF;
  
  -- Check if user exists in profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id
  ) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Insert the owner role
  INSERT INTO public.user_roles (user_id, role, is_owner, created_by)
  VALUES (_user_id, 'super_admin', true, _user_id);
  
  -- Log bootstrap attempt for security auditing
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (_user_id, 'system_bootstrapped', 'system', _user_id, jsonb_build_object('event', 'owner_designated'));
  
  RETURN jsonb_build_object('success', true, 'message', 'Owner successfully bootstrapped');
END;
$$;


ALTER FUNCTION "public"."bootstrap_owner"("_user_id" "uuid", "_bootstrap_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_admin_invite"("_role" "public"."app_role", "_expires_in_days" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_token text;
  v_token_hash text;
  v_token_prefix text;
  v_invite_id uuid;
BEGIN
  -- SECURITY: Only Owner can create invites (not all super_admins)
  IF NOT is_owner(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the Owner can create invites');
  END IF;
  
  -- Generate secure token
  v_token := generate_invite_token();
  
  -- Hash the token for storage
  v_token_hash := hash_invite_token(v_token);
  
  -- Store first 8 chars as prefix for identification
  v_token_prefix := left(v_token, 8);
  
  -- Insert invite record with ONLY the hash (not the plaintext token)
  -- The token column stores 'PENDING' as placeholder to satisfy NOT NULL constraint
  INSERT INTO public.admin_invites (token, token_hash, token_prefix, role, created_by, expires_at)
  VALUES ('PENDING', v_token_hash, v_token_prefix, _role, auth.uid(), now() + (_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;
  
  -- Immediately clear the token column to prevent exposure
  UPDATE public.admin_invites 
  SET token = 'REDACTED'
  WHERE id = v_invite_id;
  
  -- Return the plaintext token only once (for display to owner)
  -- After this response, the plaintext is never stored or retrievable
  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token,
    'role', _role,
    'expires_at', now() + (_expires_in_days || ' days')::interval
  );
END;
$$;


ALTER FUNCTION "public"."create_admin_invite"("_role" "public"."app_role", "_expires_in_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_random_bytes"(integer) RETURNS "bytea"
    LANGUAGE "sql"
    AS $_$
  SELECT extensions.gen_random_bytes($1);
$_$;


ALTER FUNCTION "public"."gen_random_bytes"(integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_token"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex')
$$;


ALTER FUNCTION "public"."generate_invite_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_type"("_user_id" "uuid") RETURNS "public"."account_type"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(account_type, 'normal'::public.account_type) 
  FROM public.profiles 
  WHERE user_id = _user_id 
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_account_type"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_model_analytics"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("date" "date", "total_requests" bigint, "successful_requests" bigint, "failed_requests" bigint, "total_credits" numeric, "avg_response_time" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE i.status = 'completed')::BIGINT as successful_requests,
    COUNT(*) FILTER (WHERE i.status = 'failed')::BIGINT as failed_requests,
    COALESCE(SUM(i.credits_used), 0) as total_credits,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM images i
  WHERE i.model_id = p_model_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY DATE(i.created_at)
  ORDER BY DATE(i.created_at);
END;
$$;


ALTER FUNCTION "public"."get_model_analytics"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_model_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("model_id" "uuid", "model_name" "text", "total_requests" bigint, "successful_requests" bigint, "failed_requests" bigint, "success_rate" numeric, "total_credits" numeric, "avg_credits_per_gen" numeric, "avg_response_time" numeric, "last_used" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    m.id as model_id,
    m.name as model_name,
    COALESCE(COUNT(i.id), 0)::BIGINT as total_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed'), 0)::BIGINT as successful_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'failed'), 0)::BIGINT as failed_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(SUM(i.credits_used), 0) as total_credits,
    CASE 
      WHEN COUNT(i.id) FILTER (WHERE i.status = 'completed') > 0 THEN 
        ROUND(SUM(i.credits_used) / COUNT(i.id) FILTER (WHERE i.status = 'completed'), 4)
      ELSE 0 
    END as avg_credits_per_gen,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time,
    MAX(i.created_at) as last_used
  FROM ai_models m
  LEFT JOIN images i ON i.model_id = m.id 
    AND i.created_at >= p_start_date 
    AND i.created_at <= p_end_date
  GROUP BY m.id, m.name
  ORDER BY total_requests DESC;
END;
$$;


ALTER FUNCTION "public"."get_model_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_model_top_users"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer DEFAULT 10) RETURNS TABLE("user_id" "uuid", "user_email" "text", "total_generations" bigint, "credits_spent" numeric, "success_rate" numeric, "last_used" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access user analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    i.user_id,
    p.email as user_email,
    COUNT(i.id)::BIGINT as total_generations,
    COALESCE(SUM(i.credits_used), 0) as credits_spent,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    MAX(i.created_at) as last_used
  FROM images i
  LEFT JOIN profiles p ON p.user_id = i.user_id
  WHERE i.model_id = p_model_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY i.user_id, p.email
  ORDER BY total_generations DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_model_top_users"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_orphaned_user_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::integer
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL;
$$;


ALTER FUNCTION "public"."get_orphaned_user_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_orphaned_user_count"() IS 'ADMIN RECOVERY ONLY: Counts auth.users without matching profiles. DO NOT use auth.users for business logic.';



CREATE OR REPLACE FUNCTION "public"."get_provider_analytics"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("date" "date", "total_requests" bigint, "successful_requests" bigint, "failed_requests" bigint, "avg_response_time" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE i.status = 'completed')::BIGINT as successful_requests,
    COUNT(*) FILTER (WHERE i.status = 'failed')::BIGINT as failed_requests,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM images i
  WHERE i.provider_id = p_provider_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY DATE(i.created_at)
  ORDER BY DATE(i.created_at);
END;
$$;


ALTER FUNCTION "public"."get_provider_analytics"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_provider_models"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("model_id" "uuid", "model_name" "text", "total_requests" bigint, "success_rate" numeric, "avg_response_time" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    m.id as model_id,
    m.name as model_name,
    COUNT(i.id)::BIGINT as total_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM ai_models m
  INNER JOIN images i ON i.model_id = m.id
  WHERE i.provider_id = p_provider_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY m.id, m.name
  ORDER BY total_requests DESC;
END;
$$;


ALTER FUNCTION "public"."get_provider_models"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_provider_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("provider_id" "uuid", "provider_name" "text", "provider_display_name" "text", "total_requests" bigint, "successful_requests" bigint, "failed_requests" bigint, "success_rate" numeric, "total_cost" numeric, "avg_response_time" numeric, "last_used" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as provider_id,
    p.name as provider_name,
    p.display_name as provider_display_name,
    COALESCE(COUNT(i.id), 0)::BIGINT as total_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed'), 0)::BIGINT as successful_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'failed'), 0)::BIGINT as failed_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed') * p.cost_per_image, 0) as total_cost,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time,
    MAX(i.created_at) as last_used
  FROM providers p
  LEFT JOIN images i ON i.provider_id = p.id 
    AND i.created_at >= p_start_date 
    AND i.created_at <= p_end_date
  GROUP BY p.id, p.name, p.display_name, p.cost_per_image
  ORDER BY total_requests DESC;
END;
$$;


ALTER FUNCTION "public"."get_provider_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_priority"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_plan plan_type;
BEGIN
  SELECT plan_type INTO user_plan 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  RETURN CASE 
    WHEN user_plan = 'enterprise'::plan_type THEN 10
    WHEN user_plan = 'pro'::plan_type THEN 5
    ELSE 1
  END;
END;
$$;


ALTER FUNCTION "public"."get_user_priority"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id
  ORDER BY CASE role 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'moderator' THEN 3
    WHEN 'support' THEN 4
    WHEN 'analyst' THEN 5
    WHEN 'user' THEN 6 
  END
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_display_name text;
  v_avatar_url text;
  v_raw_name text;
BEGIN
  -- Safely extract raw name from OAuth metadata
  v_raw_name := COALESCE(
    new.raw_user_meta_data ->> 'full_name', 
    new.raw_user_meta_data ->> 'name'
  );
  
  -- Sanitize display_name
  IF v_raw_name IS NOT NULL THEN
    v_display_name := TRIM(v_raw_name);
    v_display_name := regexp_replace(v_display_name, '<[^>]*>', '', 'g');
    v_display_name := regexp_replace(v_display_name, '(javascript|data|vbscript):', '', 'gi');
    v_display_name := regexp_replace(v_display_name, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
    v_display_name := replace(v_display_name, chr(0), '');
    v_display_name := SUBSTRING(v_display_name, 1, 100);
    v_display_name := NULLIF(TRIM(v_display_name), '');
  END IF;
  
  -- Fallback to email prefix if no display name
  IF v_display_name IS NULL THEN
    v_display_name := split_part(new.email, '@', 1);
  END IF;
  
  -- Safely extract and validate avatar_url
  v_avatar_url := COALESCE(
    new.raw_user_meta_data ->> 'avatar_url', 
    new.raw_user_meta_data ->> 'picture'
  );
  
  IF v_avatar_url IS NOT NULL THEN
    v_avatar_url := TRIM(v_avatar_url);
    IF length(v_avatar_url) > 2048 
       OR NOT (v_avatar_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9](/[^\s<>"'']*)?$')
       OR v_avatar_url ~ '(javascript|data|vbscript):' THEN
      v_avatar_url := NULL;
    END IF;
  END IF;

  -- Insert profile with ON CONFLICT to handle edge cases
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (new.id, v_display_name, v_avatar_url, new.email)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'BEST-EFFORT ONLY: This trigger function may not fire in all environments (e.g., Lovable Cloud). Profile creation is guaranteed by client-side fallback (AuthContext.tsx) and auto-healing (scheduled-profile-sync). DO NOT rely on this trigger for correctness.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  VALUES (NEW.user_id, 0, 10)  -- Start with 10 daily credits
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_invite_token"("token" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT encode(extensions.digest(token, 'sha256'), 'hex')
$$;


ALTER FUNCTION "public"."hash_invite_token"("token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_above"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;


ALTER FUNCTION "public"."is_admin_or_above"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_moderator_or_above"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;


ALTER FUNCTION "public"."is_moderator_or_above"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin' AND is_owner = true
  )
$$;


ALTER FUNCTION "public"."is_owner"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_system_bootstrapped"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE is_owner = true)
$$;


ALTER FUNCTION "public"."is_system_bootstrapped"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_admin_action"("_action" "text", "_target_type" "text" DEFAULT NULL::"text", "_target_id" "uuid" DEFAULT NULL::"uuid", "_old_value" "jsonb" DEFAULT NULL::"jsonb", "_new_value" "jsonb" DEFAULT NULL::"jsonb", "_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
  v_log_id uuid;
BEGIN
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, _old_value, _new_value, _details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_admin_action"("_action" "text", "_target_type" "text", "_target_id" "uuid", "_old_value" "jsonb", "_new_value" "jsonb", "_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_job_event"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_account_type" character varying, "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO job_logs (
    job_id, user_id, username, account_type, prompt, negative_prompt, model_name, model_id,
    provider_name, provider_id, credits_used, provider_credit_cost, platform_profit,
    status, image_url, failure_reason, processing_time_ms, log_type, metadata
  ) VALUES (
    p_job_id, p_user_id, p_username, p_account_type, p_prompt, p_negative_prompt, p_model_name, p_model_id,
    p_provider_name, p_provider_id, p_credits_used, p_provider_credit_cost, p_platform_profit,
    p_status, p_image_url, p_failure_reason, p_processing_time_ms, p_log_type, p_metadata
  );
END;
$$;


ALTER FUNCTION "public"."log_job_event"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_account_type" character varying, "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_job_event_fixed"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_plan_type" "public"."plan_type", "p_account_type" "public"."account_type", "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO job_logs (
    job_id, user_id, username, plan_type, account_type, prompt, negative_prompt, model_name, model_id,
    provider_name, provider_id, credits_used, provider_credit_cost, platform_profit,
    status, image_url, failure_reason, processing_time_ms, log_type, metadata
  ) VALUES (
    p_job_id, p_user_id, p_username, p_plan_type, p_account_type, p_prompt, p_negative_prompt, p_model_name, p_model_id,
    p_provider_name, p_provider_id, p_credits_used, p_provider_credit_cost, p_platform_profit,
    p_status, p_image_url, p_failure_reason, p_processing_time_ms, p_log_type, p_metadata
  );
END;
$$;


ALTER FUNCTION "public"."log_job_event_fixed"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_plan_type" "public"."plan_type", "p_account_type" "public"."account_type", "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow specific profile-related actions
  IF _action NOT IN ('profile_created_via_fallback', 'profile_creation_failed') THEN
    RAISE EXCEPTION 'Invalid action for profile fallback logging';
  END IF;
  
  -- Insert the audit log entry
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, 'profiles', _target_id, _details);
END;
$$;


ALTER FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb") IS 'PROFILE FALLBACK LOGGING: Allows any authenticated user to log profile creation fallback events. Only accepts profile_created_via_fallback and profile_creation_failed actions. This ensures observability of the client-side fallback mechanism.';



CREATE OR REPLACE FUNCTION "public"."migrate_account_type_to_plan_type"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- This function can be called to ensure consistency
  -- Map account_type to plan_type for any profiles that might be inconsistent
  UPDATE profiles 
  SET plan_type = CASE 
    WHEN account_type = 'partner' AND plan_type != 'pro'::plan_type THEN 'pro'::plan_type
    WHEN account_type = 'normal' AND plan_type != 'free'::plan_type THEN 'free'::plan_type
    ELSE plan_type
  END;
END;
$$;


ALTER FUNCTION "public"."migrate_account_type_to_plan_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_admin_invite"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_existing_role app_role;
  v_token_hash text;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Hash the provided token
  v_token_hash := hash_invite_token(_token);
  
  -- Find invite by hash only (not by plaintext token anymore)
  SELECT * INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;
  
  -- Check if already used
  IF v_invite.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has already been used');
  END IF;
  
  -- Check if expired
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;
  
  -- Check if user already has this or higher role
  SELECT role INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      WHEN 'user' THEN 4
    END
  LIMIT 1;
  
  IF v_existing_role IN ('super_admin', 'admin') AND v_invite.role = 'moderator' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a higher role');
  END IF;
  
  IF v_existing_role = v_invite.role THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have this role');
  END IF;
  
  -- Mark invite as used
  UPDATE public.admin_invites
  SET used_at = now(), used_by = auth.uid(), token = 'REDEEMED'
  WHERE id = v_invite.id;
  
  -- Remove existing role if any (except owner)
  DELETE FROM public.user_roles
  WHERE user_id = auth.uid() AND is_owner = false;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (auth.uid(), v_invite.role, v_invite.created_by);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'role', v_invite.role
  );
END;
$$;


ALTER FUNCTION "public"."redeem_admin_invite"("_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_add_column"("table_name" "text", "column_name" "text", "column_type" "text", "default_value" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_name 
        AND column_name = column_name
    ) THEN
        -- Add column
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', table_name, column_name, column_type);
        
        -- Set default if provided
        IF default_value IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET %I = %s', table_name, column_name, default_value);
        END IF;
    END IF;
END;
$$;


ALTER FUNCTION "public"."safe_add_column"("table_name" "text", "column_name" "text", "column_type" "text", "default_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_missing_profiles"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only admins can call this
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    CASE 
      WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'avatar_url'
      WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'picture'
      ELSE NULL
    END
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also sync user_credits for any new profiles
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log the sync action
  IF v_count > 0 THEN
    INSERT INTO admin_audit_logs (actor_id, action, target_type, details)
    VALUES (auth.uid(), 'profiles_synced', 'profiles', 
      jsonb_build_object('synced_count', v_count));
  END IF;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."sync_missing_profiles"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_missing_profiles"() IS 'ADMIN RECOVERY ONLY: Creates missing profile records from auth.users. Primary profile creation happens via client fallback.';



CREATE OR REPLACE FUNCTION "public"."sync_missing_profiles_system"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  -- This function is for system use only (service role)
  -- No auth check - caller must use service role key
  
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    CASE 
      WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'avatar_url'
      WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'picture'
      ELSE NULL
    END
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also sync user_credits
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."sync_missing_profiles_system"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_missing_profiles_system"() IS 'SYSTEM USE ONLY: Called by scheduled job for auto-healing. Uses service role key - no auth check.';



CREATE OR REPLACE FUNCTION "public"."update_account_type"("_target_user_id" "uuid", "_account_type" "public"."account_type") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can update account types');
  END IF;
  
  -- Update account type
  UPDATE public.profiles
  SET account_type = _account_type, updated_at = now()
  WHERE user_id = _target_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account type updated successfully',
    'account_type', _account_type
  );
END;
$$;


ALTER FUNCTION "public"."update_account_type"("_target_user_id" "uuid", "_account_type" "public"."account_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_priority_on_account_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update priority for pending and processing jobs when account type changes
  UPDATE generation_jobs 
  SET 
    priority = CASE 
      WHEN NEW.account_type = 'partner' THEN 5
      ELSE 1
    END,
    account_type = NEW.account_type
  WHERE user_id = NEW.user_id 
    AND status IN ('pending', 'processing');
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_priority_on_account_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_priority_on_plan_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update priority for pending and processing jobs when plan_type changes
  UPDATE generation_jobs 
  SET 
    priority = CASE 
      WHEN NEW.plan_type = 'enterprise'::plan_type THEN 10
      WHEN NEW.plan_type = 'pro'::plan_type THEN 5
      ELSE 1
    END,
    plan_type = NEW.plan_type,
    account_type = NEW.account_type
  WHERE user_id = NEW.user_id 
    AND status IN ('pending', 'processing');
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_priority_on_plan_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_plan"("p_user_id" "uuid", "p_new_plan" "public"."plan_type") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow updates by super admins or the user themselves (for free tier)
  IF NOT (is_super_admin_or_above(auth.uid()) OR (auth.uid() = p_user_id AND p_new_plan = 'free'::plan_type)) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE profiles 
  SET plan_type = p_new_plan
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_user_plan"("p_user_id" "uuid", "p_new_plan" "public"."plan_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invite_token"("_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_token_hash text;
BEGIN
  -- Hash the provided token
  v_token_hash := hash_invite_token(_token);
  
  -- Find invite by hash only
  SELECT role, expires_at, used_at INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite token');
  END IF;
  
  IF v_invite.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has already been used');
  END IF;
  
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has expired');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at
  );
END;
$$;


ALTER FUNCTION "public"."validate_invite_token"("_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abuse_detection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "api_key_id" "uuid",
    "ip_address" character varying(45),
    "event_type" character varying(50) NOT NULL,
    "severity" character varying(20) DEFAULT 'medium'::character varying,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "is_resolved" boolean DEFAULT false
);


ALTER TABLE "public"."abuse_detection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "details" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "token_hash" "text",
    "token_prefix" "text",
    CONSTRAINT "valid_expiry" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "valid_invite_role" CHECK (("role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))
);


ALTER TABLE "public"."admin_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "model_id" "text" NOT NULL,
    "engine_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "public"."model_status" DEFAULT 'active'::"public"."model_status" NOT NULL,
    "credits_cost" numeric(10,6) DEFAULT 0.001 NOT NULL,
    "access_level" "public"."model_access_level" DEFAULT 'public'::"public"."model_access_level" NOT NULL,
    "rpm" integer DEFAULT 60 NOT NULL,
    "rpd" integer DEFAULT 1000 NOT NULL,
    "usage_count" bigint DEFAULT 0 NOT NULL,
    "api_endpoint" "text",
    "api_key_encrypted" "text",
    "description" "text",
    "is_partner_only" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "provider_id" "uuid",
    "is_soft_disabled" boolean DEFAULT false NOT NULL,
    "soft_disable_message" "text",
    "cooldown_until" timestamp with time zone,
    "fallback_model_id" "uuid"
);


ALTER TABLE "public"."ai_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cache_key" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."announcement_type" DEFAULT 'info'::"public"."announcement_type" NOT NULL,
    "target_roles" "public"."app_role"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."announcements_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "title",
    "message",
    "type",
    "starts_at",
    "ends_at",
    "is_active",
    "created_at"
   FROM "public"."announcements"
  WHERE (("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"())));


ALTER VIEW "public"."announcements_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "status" "public"."api_key_status" DEFAULT 'active'::"public"."api_key_status" NOT NULL,
    "custom_rpm" integer,
    "custom_rpd" integer,
    "allowed_models" "uuid"[],
    "last_used_at" timestamp with time zone,
    "last_used_ip" "text",
    "usage_count" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backend_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(100) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."backend_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credits_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "type" "public"."credit_transaction_type" NOT NULL,
    "reason" "text",
    "related_image_id" "uuid",
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credits_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "backend_job_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "image_url" "text",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edge_generation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_enabled" boolean DEFAULT false NOT NULL,
    "rollout_percentage" integer DEFAULT 100,
    "target_roles" "public"."app_role"[],
    "target_account_types" "public"."account_type"[],
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feature_flags_rollout_percentage_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100)))
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."feature_flags_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "description",
    "is_enabled"
   FROM "public"."feature_flags"
  WHERE ("is_enabled" = true);


ALTER VIEW "public"."feature_flags_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" character varying(100) NOT NULL,
    "user_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "prompt" "text" NOT NULL,
    "negative_prompt" "text",
    "model_id" character varying(100),
    "size" character varying(20) DEFAULT '1024x1024'::character varying,
    "num_images" integer DEFAULT 1,
    "r2_keys" "text"[],
    "signed_urls" "jsonb",
    "expires_at" timestamp with time zone,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "retry_count" integer DEFAULT 0,
    "archived" boolean DEFAULT false,
    "account_type" character varying(20) DEFAULT 'free'::character varying,
    "priority" integer DEFAULT 1,
    "job_owner_username" character varying(255),
    "provider_credit_cost" numeric DEFAULT 0,
    "platform_profit" numeric DEFAULT 0,
    "started_at" timestamp with time zone,
    "processing_time_ms" integer,
    "provider_name" character varying(255),
    "model_name" character varying(255),
    "auto_retry_count" integer DEFAULT 0,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "retry_after" timestamp with time zone,
    "provider_id" "text"
);


ALTER TABLE "public"."generation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "api_key_id" "uuid",
    "prompt" "text" NOT NULL,
    "negative_prompt" "text",
    "model_id" "uuid",
    "provider_id" "uuid",
    "image_url" "text",
    "thumbnail_url" "text",
    "width" integer,
    "height" integer,
    "credits_used" numeric DEFAULT 0 NOT NULL,
    "generation_time_ms" integer,
    "status" "public"."image_status" DEFAULT 'pending'::"public"."image_status" NOT NULL,
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "description" "text",
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "file_url" "text",
    "file_name" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ip_blocklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "text" NOT NULL,
    "cidr_range" "text",
    "reason" "public"."block_reason" DEFAULT 'manual'::"public"."block_reason" NOT NULL,
    "notes" "text",
    "blocked_by" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ip_blocklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" character varying(100) NOT NULL,
    "user_id" "uuid",
    "username" character varying(255),
    "account_type" character varying(20),
    "prompt" "text",
    "negative_prompt" "text",
    "model_name" character varying(255),
    "model_id" character varying(100),
    "provider_name" character varying(255),
    "provider_id" character varying(100),
    "credits_used" numeric,
    "provider_credit_cost" numeric,
    "platform_profit" numeric,
    "status" character varying(20),
    "image_url" "text",
    "failure_reason" "text",
    "processing_time_ms" integer,
    "log_type" character varying(20) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" character varying(100) NOT NULL,
    "model_name" character varying(255) NOT NULL,
    "description" "text",
    "capabilities" "jsonb" DEFAULT '{}'::"jsonb",
    "supported_sizes" "jsonb" DEFAULT '["1024x1024", "1344x768", "768x1344"]'::"jsonb",
    "max_images" integer DEFAULT 4,
    "pricing_tiers" "jsonb" DEFAULT '{}'::"jsonb",
    "provider_support" "jsonb" DEFAULT '{}'::"jsonb",
    "documentation_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."model_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'info'::"public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachment_url" "text",
    "attachment_name" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_type" "public"."account_type" DEFAULT 'normal'::"public"."account_type" NOT NULL,
    "email" "text",
    "is_banned" boolean DEFAULT false NOT NULL,
    "ban_reason" "text",
    "banned_at" timestamp with time zone,
    "banned_by" "uuid",
    "force_password_reset" boolean DEFAULT false NOT NULL,
    "max_images_per_day" integer DEFAULT 100,
    "last_login_at" timestamp with time zone,
    "last_login_ip" "text",
    "custom_rpm" integer,
    "custom_rpd" integer,
    CONSTRAINT "avatar_url_length" CHECK ((("avatar_url" IS NULL) OR ("length"("avatar_url") <= 2048))),
    CONSTRAINT "display_name_length" CHECK ((("display_name" IS NULL) OR ("length"("display_name") <= 100))),
    CONSTRAINT "profiles_custom_rpd_positive" CHECK ((("custom_rpd" IS NULL) OR ("custom_rpd" > 0))),
    CONSTRAINT "profiles_custom_rpm_positive" CHECK ((("custom_rpm" IS NULL) OR ("custom_rpm" > 0))),
    CONSTRAINT "profiles_max_images_per_day_positive" CHECK ((("max_images_per_day" IS NULL) OR ("max_images_per_day" > 0))),
    CONSTRAINT "username_format" CHECK ((("username" IS NULL) OR ("username" ~ '^[a-zA-Z0-9_-]+$'::"text"))),
    CONSTRAINT "username_length" CHECK ((("username" IS NULL) OR (("length"("username") >= 3) AND ("length"("username") <= 30))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."account_type" IS 'User relationship type: normal or partner';



COMMENT ON COLUMN "public"."profiles"."custom_rpm" IS 'Custom requests per minute limit. NULL = use system default';



COMMENT ON COLUMN "public"."profiles"."custom_rpd" IS 'Custom requests per day limit. NULL = use system default';



CREATE TABLE IF NOT EXISTS "public"."provider_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" character varying(100) NOT NULL,
    "max_concurrent_jobs" integer DEFAULT 5,
    "max_images_per_request" integer DEFAULT 4,
    "supports_multi_image" boolean DEFAULT true,
    "cost_per_generation" numeric DEFAULT 0,
    "health_check_interval" integer DEFAULT 300,
    "auto_disable_on_failure" boolean DEFAULT true,
    "failure_threshold" integer DEFAULT 3,
    "retry_delay" integer DEFAULT 60,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_health_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" character varying(100) NOT NULL,
    "provider_name" character varying(255),
    "status" character varying(20) NOT NULL,
    "response_time_ms" integer,
    "error_message" "text",
    "consecutive_failures" integer DEFAULT 0,
    "last_check_at" timestamp with time zone DEFAULT "now"(),
    "next_check_at" timestamp with time zone,
    "auto_disabled" boolean DEFAULT false,
    "disabled_at" timestamp with time zone,
    "disabled_by" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_health_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "api_key_encrypted" "text",
    "base_url" "text",
    "status" "public"."provider_status" DEFAULT 'active'::"public"."provider_status" NOT NULL,
    "cost_per_image" numeric DEFAULT 0 NOT NULL,
    "is_fallback" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "key_encrypted_at" timestamp with time zone,
    "last_test_at" timestamp with time zone,
    "last_test_status" "text" DEFAULT 'never_tested'::"text",
    "last_test_message" "text",
    "last_test_response_time" integer,
    "status_page_url" "text",
    CONSTRAINT "providers_last_test_status_check" CHECK ((("last_test_status" IS NULL) OR ("last_test_status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'never_tested'::"text"]))))
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."providers"."api_key_encrypted" IS 'AES-256-GCM encrypted API key. Format: base64(IV + ciphertext + auth_tag)';



COMMENT ON COLUMN "public"."providers"."key_encrypted_at" IS 'Timestamp when the API key was encrypted. NULL means the key is either not set or stored in plain text (legacy).';



CREATE TABLE IF NOT EXISTS "public"."request_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "api_key_id" "uuid",
    "image_id" "uuid",
    "endpoint" "text" NOT NULL,
    "method" "text" NOT NULL,
    "status_code" integer,
    "response_time_ms" integer,
    "ip_address" "text",
    "user_agent" "text",
    "country" "text",
    "request_body" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."request_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "api_key_id" "uuid",
    "event_type" "public"."security_event_type" NOT NULL,
    "severity" "text" DEFAULT 'low'::"text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolution_notes" "text"
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."security_events"."resolution_notes" IS 'Optional notes from the admin who resolved this incident';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "telegram_chat_id" character varying(255),
    "notification_types" "jsonb" DEFAULT '["image_generation", "security_events", "system_alerts"]'::"jsonb",
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."telegram_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "daily_credits" numeric DEFAULT 0 NOT NULL,
    "last_daily_reset" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_credits_balance_check" CHECK (("balance" >= (0)::numeric))
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL,
    "is_owner" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_storage_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "auto_delete_after_days" integer DEFAULT 30,
    "storage_tier" character varying(20) DEFAULT 'basic'::character varying,
    "max_storage_days" integer DEFAULT 90,
    "enable_long_term_storage" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_storage_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."abuse_detection"
    ADD CONSTRAINT "abuse_detection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_model_id_key" UNIQUE ("model_id");



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_cache"
    ADD CONSTRAINT "analytics_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."analytics_cache"
    ADD CONSTRAINT "analytics_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backend_config"
    ADD CONSTRAINT "backend_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."backend_config"
    ADD CONSTRAINT "backend_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credits_transactions"
    ADD CONSTRAINT "credits_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_generation_jobs"
    ADD CONSTRAINT "edge_generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ip_blocklist"
    ADD CONSTRAINT "ip_blocklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_catalog"
    ADD CONSTRAINT "model_catalog_model_id_key" UNIQUE ("model_id");



ALTER TABLE ONLY "public"."model_catalog"
    ADD CONSTRAINT "model_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."provider_configurations"
    ADD CONSTRAINT "provider_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_configurations"
    ADD CONSTRAINT "provider_configurations_provider_id_key" UNIQUE ("provider_id");



ALTER TABLE ONLY "public"."provider_health_checks"
    ADD CONSTRAINT "provider_health_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_logs"
    ADD CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."telegram_notifications"
    ADD CONSTRAINT "telegram_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_storage_settings"
    ADD CONSTRAINT "user_storage_settings_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "edge_generation_jobs_backend_job_id_idx" ON "public"."edge_generation_jobs" USING "btree" ("backend_job_id");



CREATE INDEX "edge_generation_jobs_user_id_idx" ON "public"."edge_generation_jobs" USING "btree" ("user_id");



CREATE INDEX "idx_abuse_detection_event_type" ON "public"."abuse_detection" USING "btree" ("event_type");



CREATE INDEX "idx_abuse_detection_triggered_at" ON "public"."abuse_detection" USING "btree" ("triggered_at" DESC);



CREATE INDEX "idx_abuse_detection_user_id" ON "public"."abuse_detection" USING "btree" ("user_id");



CREATE INDEX "idx_ai_models_access_level" ON "public"."ai_models" USING "btree" ("access_level");



CREATE INDEX "idx_ai_models_status" ON "public"."ai_models" USING "btree" ("status");



CREATE INDEX "idx_api_keys_key_hash" ON "public"."api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_api_keys_status" ON "public"."api_keys" USING "btree" ("status");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_action" ON "public"."admin_audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_actor" ON "public"."admin_audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_created" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_target" ON "public"."admin_audit_logs" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_credits_transactions_created_at" ON "public"."credits_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credits_transactions_user_id" ON "public"."credits_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_generation_jobs_account_type" ON "public"."generation_jobs" USING "btree" ("account_type");



CREATE INDEX "idx_generation_jobs_expires_at" ON "public"."generation_jobs" USING "btree" ("expires_at");



CREATE INDEX "idx_generation_jobs_failed_retry" ON "public"."generation_jobs" USING "btree" ("status", "retry_count", "archived") WHERE (("status")::"text" = 'failed'::"text");



CREATE INDEX "idx_generation_jobs_job_id" ON "public"."generation_jobs" USING "btree" ("job_id");



CREATE INDEX "idx_generation_jobs_priority" ON "public"."generation_jobs" USING "btree" ("priority" DESC);



CREATE INDEX "idx_generation_jobs_status" ON "public"."generation_jobs" USING "btree" ("status");



CREATE INDEX "idx_generation_jobs_status_failed" ON "public"."generation_jobs" USING "btree" ("status") WHERE (("status")::"text" = 'failed'::"text");



CREATE INDEX "idx_generation_jobs_status_pending" ON "public"."generation_jobs" USING "btree" ("status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_generation_jobs_status_started" ON "public"."generation_jobs" USING "btree" ("status", "started_at") WHERE (("status")::"text" = 'processing'::"text");



CREATE INDEX "idx_generation_jobs_user_id" ON "public"."generation_jobs" USING "btree" ("user_id");



CREATE INDEX "idx_images_created_at" ON "public"."images" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_images_model_created" ON "public"."images" USING "btree" ("model_id", "created_at");



CREATE INDEX "idx_images_provider_created" ON "public"."images" USING "btree" ("provider_id", "created_at");



CREATE INDEX "idx_images_status" ON "public"."images" USING "btree" ("status");



CREATE INDEX "idx_images_status_created" ON "public"."images" USING "btree" ("status", "created_at");



CREATE INDEX "idx_images_user_created" ON "public"."images" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_images_user_id" ON "public"."images" USING "btree" ("user_id");



CREATE INDEX "idx_ip_blocklist_ip_address" ON "public"."ip_blocklist" USING "btree" ("ip_address");



CREATE INDEX "idx_job_logs_created_at" ON "public"."job_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_job_logs_job_id" ON "public"."job_logs" USING "btree" ("job_id");



CREATE INDEX "idx_job_logs_log_type" ON "public"."job_logs" USING "btree" ("log_type");



CREATE INDEX "idx_job_logs_user_id" ON "public"."job_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_read_at" ON "public"."notifications" USING "btree" ("read_at");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_provider_configurations_provider_id" ON "public"."provider_configurations" USING "btree" ("provider_id");



CREATE INDEX "idx_provider_health_checks_provider_id" ON "public"."provider_health_checks" USING "btree" ("provider_id");



CREATE INDEX "idx_provider_health_checks_status" ON "public"."provider_health_checks" USING "btree" ("status");



CREATE INDEX "idx_request_logs_api_key_id" ON "public"."request_logs" USING "btree" ("api_key_id");



CREATE INDEX "idx_request_logs_created_at" ON "public"."request_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_request_logs_user_id" ON "public"."request_logs" USING "btree" ("user_id");



CREATE INDEX "idx_security_events_created_at" ON "public"."security_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_security_events_event_type" ON "public"."security_events" USING "btree" ("event_type");



CREATE INDEX "idx_security_events_resolved_at" ON "public"."security_events" USING "btree" ("resolved_at");



CREATE INDEX "idx_security_events_user_id" ON "public"."security_events" USING "btree" ("user_id");



CREATE INDEX "idx_telegram_notifications_user_id" ON "public"."telegram_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_user_credits_user_id" ON "public"."user_credits" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_storage_settings_user_id" ON "public"."user_storage_settings" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "audit_ai_models" AFTER INSERT OR DELETE OR UPDATE ON "public"."ai_models" FOR EACH ROW EXECUTE FUNCTION "public"."audit_ai_models_changes"();



CREATE OR REPLACE TRIGGER "audit_user_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_user_roles_changes"();



CREATE OR REPLACE TRIGGER "on_profile_created_add_credits" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_credits"();



CREATE OR REPLACE TRIGGER "on_profile_created_create_credits" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_credits"();



CREATE OR REPLACE TRIGGER "update_ai_models_updated_at" BEFORE UPDATE ON "public"."ai_models" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_announcements_updated_at" BEFORE UPDATE ON "public"."announcements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feature_flags_updated_at" BEFORE UPDATE ON "public"."feature_flags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_model_catalog_updated_at" BEFORE UPDATE ON "public"."model_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_provider_configurations_updated_at" BEFORE UPDATE ON "public"."provider_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_providers_updated_at" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_telegram_notifications_updated_at" BEFORE UPDATE ON "public"."telegram_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_credits_updated_at" BEFORE UPDATE ON "public"."user_credits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_storage_settings_updated_at" BEFORE UPDATE ON "public"."user_storage_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."abuse_detection"
    ADD CONSTRAINT "abuse_detection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_models"
    ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credits_transactions"
    ADD CONSTRAINT "credits_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."edge_generation_jobs"
    ADD CONSTRAINT "edge_generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telegram_notifications"
    ADD CONSTRAINT "telegram_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_storage_settings"
    ADD CONSTRAINT "user_storage_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete invoices" ON "public"."invoices" FOR DELETE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can insert any logs" ON "public"."request_logs" FOR INSERT WITH CHECK ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can insert any transactions" ON "public"."credits_transactions" FOR INSERT WITH CHECK ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can insert invoices" ON "public"."invoices" FOR INSERT WITH CHECK ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can insert models" ON "public"."ai_models" FOR INSERT WITH CHECK ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can insert security events" ON "public"."security_events" FOR INSERT WITH CHECK ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage analytics cache" ON "public"."analytics_cache" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage announcements" ON "public"."announcements" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage blocklist" ON "public"."ip_blocklist" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage feature flags" ON "public"."feature_flags" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage model catalog" ON "public"."model_catalog" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage notifications" ON "public"."notifications" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage provider configurations" ON "public"."provider_configurations" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can manage providers" ON "public"."providers" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update abuse detection" ON "public"."abuse_detection" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update all API keys" ON "public"."api_keys" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update credits" ON "public"."user_credits" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update invoices" ON "public"."invoices" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update models" ON "public"."ai_models" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can update security events" ON "public"."security_events" FOR UPDATE USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view abuse detection" ON "public"."abuse_detection" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all API keys" ON "public"."api_keys" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all credits" ON "public"."user_credits" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all images" ON "public"."images" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all invoices" ON "public"."invoices" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all job logs" ON "public"."job_logs" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all logs" ON "public"."request_logs" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all roles" ON "public"."user_roles" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all settings" ON "public"."system_settings" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all storage settings" ON "public"."user_storage_settings" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view all transactions" ON "public"."credits_transactions" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view audit logs" ON "public"."admin_audit_logs" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view provider health" ON "public"."provider_health_checks" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view security events" ON "public"."security_events" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Admins can view telegram settings" ON "public"."telegram_notifications" FOR SELECT USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Anyone can view active providers" ON "public"."providers" FOR SELECT USING ((("status" = 'active'::"public"."provider_status") OR "public"."is_admin_or_above"("auth"."uid"())));



CREATE POLICY "Anyone can view model catalog" ON "public"."model_catalog" FOR SELECT USING (true);



CREATE POLICY "Anyone can view non-sensitive settings" ON "public"."system_settings" FOR SELECT USING ((("key" !~~ '%_secret%'::"text") AND ("key" !~~ '%_key%'::"text")));



CREATE POLICY "Authenticated users can view enabled flags" ON "public"."feature_flags" FOR SELECT USING ((("is_enabled" = true) AND ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "No deletes allowed on audit logs" ON "public"."admin_audit_logs" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "No updates allowed on audit logs" ON "public"."admin_audit_logs" FOR UPDATE TO "authenticated" USING (false);



CREATE POLICY "Only system functions can insert audit logs" ON "public"."admin_audit_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "Owner can create invites" ON "public"."admin_invites" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_owner"("auth"."uid"()));



CREATE POLICY "Owner can delete unused invites" ON "public"."admin_invites" FOR DELETE TO "authenticated" USING (("public"."is_owner"("auth"."uid"()) AND ("used_at" IS NULL)));



CREATE POLICY "Owner can view all invites" ON "public"."admin_invites" FOR SELECT TO "authenticated" USING ("public"."is_owner"("auth"."uid"()));



CREATE POLICY "Service role can manage backend config" ON "public"."backend_config" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage jobs" ON "public"."generation_jobs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Super admins can delete models" ON "public"."ai_models" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can delete roles except owner" ON "public"."user_roles" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") AND ("is_owner" = false)));



CREATE POLICY "Super admins can insert roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can manage settings" ON "public"."system_settings" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can update account type" ON "public"."profiles" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins can update roles" ON "public"."user_roles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") AND (NOT (("is_owner" = true) AND ("user_id" <> "auth"."uid"()))) AND (NOT (("is_owner" = true) AND ("auth"."uid"() = "user_id")))));



CREATE POLICY "System can insert abuse detection" ON "public"."abuse_detection" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert credits" ON "public"."user_credits" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin_or_above"("auth"."uid"())));



CREATE POLICY "System can insert job logs" ON "public"."job_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can manage health checks" ON "public"."provider_health_checks" USING ("public"."is_admin_or_above"("auth"."uid"()));



CREATE POLICY "Users can create their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own API keys" ON "public"."api_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own images" ON "public"."images" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own jobs" ON "public"."edge_generation_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own logs" ON "public"."request_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own transactions" ON "public"."credits_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own telegram settings" ON "public"."telegram_notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own jobs" ON "public"."edge_generation_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own storage settings" ON "public"."user_storage_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own jobs" ON "public"."generation_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view public models" ON "public"."ai_models" FOR SELECT USING ((("access_level" = 'public'::"public"."model_access_level") OR (("access_level" = 'partner_only'::"public"."model_access_level") AND (("public"."get_account_type"("auth"."uid"()) = 'partner'::"public"."account_type") OR "public"."is_admin_or_above"("auth"."uid"()))) OR (("access_level" = 'admin_only'::"public"."model_access_level") AND "public"."is_admin_or_above"("auth"."uid"()))));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own credits" ON "public"."user_credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own images" ON "public"."images" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own logs" ON "public"."request_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own storage settings" ON "public"."user_storage_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."credits_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."abuse_detection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_models" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backend_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credits_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_generation_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ip_blocklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."model_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_health_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_storage_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_user_role"("_target_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_user_role"("_target_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_user_role"("_target_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_ai_models_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_ai_models_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_ai_models_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_user_roles_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_user_roles_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_user_roles_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_owner"("_user_id" "uuid", "_bootstrap_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_owner"("_user_id" "uuid", "_bootstrap_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_owner"("_user_id" "uuid", "_bootstrap_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_admin_invite"("_role" "public"."app_role", "_expires_in_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_admin_invite"("_role" "public"."app_role", "_expires_in_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_admin_invite"("_role" "public"."app_role", "_expires_in_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_type"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_type"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_type"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_model_analytics"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_model_analytics"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_model_analytics"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_model_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_model_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_model_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_model_top_users"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_model_top_users"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_model_top_users"("p_model_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_orphaned_user_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_orphaned_user_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_orphaned_user_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_provider_analytics"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_provider_analytics"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_provider_analytics"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_provider_models"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_provider_models"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_provider_models"("p_provider_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_provider_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_provider_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_provider_summary_stats"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_priority"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_priority"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_priority"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_invite_token"("token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_invite_token"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_invite_token"("token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_above"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_above"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_above"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_moderator_or_above"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_moderator_or_above"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_moderator_or_above"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_system_bootstrapped"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_system_bootstrapped"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_system_bootstrapped"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_admin_action"("_action" "text", "_target_type" "text", "_target_id" "uuid", "_old_value" "jsonb", "_new_value" "jsonb", "_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_admin_action"("_action" "text", "_target_type" "text", "_target_id" "uuid", "_old_value" "jsonb", "_new_value" "jsonb", "_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_admin_action"("_action" "text", "_target_type" "text", "_target_id" "uuid", "_old_value" "jsonb", "_new_value" "jsonb", "_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_job_event"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_account_type" character varying, "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_job_event"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_account_type" character varying, "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_job_event"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_account_type" character varying, "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_job_event_fixed"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_plan_type" "public"."plan_type", "p_account_type" "public"."account_type", "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_job_event_fixed"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_plan_type" "public"."plan_type", "p_account_type" "public"."account_type", "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_job_event_fixed"("p_job_id" character varying, "p_user_id" "uuid", "p_username" character varying, "p_plan_type" "public"."plan_type", "p_account_type" "public"."account_type", "p_prompt" "text", "p_negative_prompt" "text", "p_model_name" character varying, "p_model_id" character varying, "p_provider_name" character varying, "p_provider_id" character varying, "p_credits_used" numeric, "p_provider_credit_cost" numeric, "p_platform_profit" numeric, "p_status" character varying, "p_image_url" "text", "p_failure_reason" "text", "p_processing_time_ms" integer, "p_log_type" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_profile_fallback_event"("_action" "text", "_target_id" "uuid", "_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_account_type_to_plan_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_account_type_to_plan_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_account_type_to_plan_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_admin_invite"("_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_admin_invite"("_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_admin_invite"("_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_add_column"("table_name" "text", "column_name" "text", "column_type" "text", "default_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_add_column"("table_name" "text", "column_name" "text", "column_type" "text", "default_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_add_column"("table_name" "text", "column_name" "text", "column_type" "text", "default_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_missing_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_missing_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_missing_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_missing_profiles_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_missing_profiles_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_missing_profiles_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_type"("_target_user_id" "uuid", "_account_type" "public"."account_type") TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_type"("_target_user_id" "uuid", "_account_type" "public"."account_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_type"("_target_user_id" "uuid", "_account_type" "public"."account_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_priority_on_account_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_priority_on_account_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_priority_on_account_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_priority_on_plan_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_priority_on_plan_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_priority_on_plan_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_plan"("p_user_id" "uuid", "p_new_plan" "public"."plan_type") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_plan"("p_user_id" "uuid", "p_new_plan" "public"."plan_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_plan"("p_user_id" "uuid", "p_new_plan" "public"."plan_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invite_token"("_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invite_token"("_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invite_token"("_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."abuse_detection" TO "anon";
GRANT ALL ON TABLE "public"."abuse_detection" TO "authenticated";
GRANT ALL ON TABLE "public"."abuse_detection" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_invites" TO "anon";
GRANT ALL ON TABLE "public"."admin_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_invites" TO "service_role";



GRANT ALL ON TABLE "public"."ai_models" TO "anon";
GRANT ALL ON TABLE "public"."ai_models" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_models" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_cache" TO "anon";
GRANT ALL ON TABLE "public"."analytics_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_cache" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."announcements_public" TO "anon";
GRANT ALL ON TABLE "public"."announcements_public" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements_public" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."backend_config" TO "anon";
GRANT ALL ON TABLE "public"."backend_config" TO "authenticated";
GRANT ALL ON TABLE "public"."backend_config" TO "service_role";



GRANT ALL ON TABLE "public"."credits_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credits_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credits_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."edge_generation_jobs" TO "anon";
GRANT ALL ON TABLE "public"."edge_generation_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_generation_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags_public" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags_public" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags_public" TO "service_role";



GRANT ALL ON TABLE "public"."generation_jobs" TO "anon";
GRANT ALL ON TABLE "public"."generation_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."images" TO "anon";
GRANT ALL ON TABLE "public"."images" TO "authenticated";
GRANT ALL ON TABLE "public"."images" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."ip_blocklist" TO "anon";
GRANT ALL ON TABLE "public"."ip_blocklist" TO "authenticated";
GRANT ALL ON TABLE "public"."ip_blocklist" TO "service_role";



GRANT ALL ON TABLE "public"."job_logs" TO "anon";
GRANT ALL ON TABLE "public"."job_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_logs" TO "service_role";



GRANT ALL ON TABLE "public"."model_catalog" TO "anon";
GRANT ALL ON TABLE "public"."model_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."model_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_configurations" TO "anon";
GRANT ALL ON TABLE "public"."provider_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."provider_health_checks" TO "anon";
GRANT ALL ON TABLE "public"."provider_health_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_health_checks" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."request_logs" TO "anon";
GRANT ALL ON TABLE "public"."request_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."request_logs" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_notifications" TO "anon";
GRANT ALL ON TABLE "public"."telegram_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_storage_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_storage_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_storage_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







