import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, role = "super_admin", is_owner = true } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // External Supabase project credentials
    const externalUrl = "https://vtudqqjmjcsgbpicjrtg.supabase.co";
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalServiceKey) {
      console.error("Missing EXTERNAL_SUPABASE_SERVICE_ROLE_KEY secret");
      return new Response(
        JSON.stringify({ success: false, error: "Service role key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client for external Supabase using service role (bypass RLS)
    const externalSupabase = createClient(externalUrl, externalServiceKey, {
      auth: { persistSession: false },
    });

    // Check if owner already exists
    const { data: existingOwner, error: checkError } = await externalSupabase
      .from("user_roles")
      .select("id, user_id, role, is_owner")
      .eq("is_owner", true)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing owner:", checkError);
      return new Response(
        JSON.stringify({ success: false, error: checkError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingOwner && existingOwner.user_id !== user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "An owner already exists. Cannot create another owner.",
          existing_owner_id: existingOwner.user_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove existing role for this user (if any) before inserting new one
    await externalSupabase
      .from("user_roles")
      .delete()
      .eq("user_id", user_id);

    // Insert new role
    const { data, error } = await externalSupabase
      .from("user_roles")
      .insert({
        user_id,
        role,
        is_owner,
        created_by: user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting role:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully assigned role:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${user_id} assigned ${role} role with is_owner=${is_owner}`,
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
