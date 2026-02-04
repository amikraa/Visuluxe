import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a secure random API key
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return "sk-" + Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

// Hash the API key for storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, expires_in_days } = body;

    if (!name || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Key name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has too many active keys
    const { count: activeKeyCount } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if ((activeKeyCount || 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Maximum of 10 active API keys allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the API key
    const fullKey = generateApiKey();
    const keyPrefix = fullKey.substring(0, 8);
    const keyHash = await hashApiKey(fullKey);

    // Calculate expiry date if specified
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expires_in_days);
      expiresAt = expiry.toISOString();
    }

    // Insert the API key record
    const { data: apiKey, error: insertError } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        status: "active",
        expires_at: expiresAt
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating API key:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the full key ONCE - it will never be shown again
    return new Response(
      JSON.stringify({
        success: true,
        api_key: {
          id: apiKey.id,
          name: apiKey.name,
          key: fullKey, // Full key - ONE TIME ONLY
          key_prefix: keyPrefix,
          created_at: apiKey.created_at,
          expires_at: apiKey.expires_at,
          status: apiKey.status
        },
        warning: "Save this key securely. It will not be shown again."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Create API key error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
