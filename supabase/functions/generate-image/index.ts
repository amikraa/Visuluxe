import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Hash function for API key validation
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Get system setting value
async function getSystemSetting(supabase: any, key: string): Promise<any> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value;
}

// Check rate limits
async function checkRateLimits(
  supabase: any,
  userId: string,
  apiKeyId: string | null,
  customRpm: number | null,
  customRpd: number | null
): Promise<{ allowed: boolean; error?: string }> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get request counts
  const { count: minuteCount } = await supabase
    .from("request_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo.toISOString());

  const { count: dayCount } = await supabase
    .from("request_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  // Get system defaults
  const defaultRpm = parseInt(await getSystemSetting(supabase, "default_rpm") || "60");
  const defaultRpd = parseInt(await getSystemSetting(supabase, "default_rpd") || "1000");

  // Use custom limits if set, otherwise use system defaults
  const effectiveRpm = customRpm || defaultRpm;
  const effectiveRpd = customRpd || defaultRpd;

  if ((minuteCount || 0) >= effectiveRpm) {
    return { allowed: false, error: "Rate limit exceeded (requests per minute)" };
  }

  if ((dayCount || 0) >= effectiveRpd) {
    return { allowed: false, error: "Rate limit exceeded (requests per day)" };
  }

  return { allowed: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body
    const body = await req.json();
    const { prompt, negative_prompt, model_id, width, height, steps, seed, cfg_scale, num_images } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for maintenance mode
    const maintenanceMode = await getSystemSetting(supabase, "maintenance_mode");
    if (maintenanceMode === "true" || maintenanceMode === true) {
      const message = await getSystemSetting(supabase, "maintenance_message") || "System is under maintenance";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user - try API key first, then session
    let userId: string | null = null;
    let apiKeyId: string | null = null;
    let customRpm: number | null = null;
    let customRpd: number | null = null;
    
    const apiKeyHeader = req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");

    if (apiKeyHeader) {
      // Validate API key
      const keyPrefix = apiKeyHeader.substring(0, 8);
      const keyHash = await hashApiKey(apiKeyHeader);

      const { data: apiKey, error: apiKeyError } = await supabase
        .from("api_keys")
        .select("*")
        .eq("key_prefix", keyPrefix)
        .eq("key_hash", keyHash)
        .single();

      if (apiKeyError || !apiKey) {
        // Log security event
        await supabase.from("security_events").insert({
          event_type: "api_abuse",
          severity: "medium",
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
          details: { reason: "Invalid API key" }
        });
        
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (apiKey.status !== "active") {
        return new Response(
          JSON.stringify({ error: `API key is ${apiKey.status}` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiry
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "API key has expired" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = apiKey.user_id;
      apiKeyId = apiKey.id;
      customRpm = apiKey.custom_rpm;
      customRpd = apiKey.custom_rpd;
    } else if (authHeader) {
      // Validate JWT session
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = user.id;
    } else {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is banned and get profile rate limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, ban_reason, max_images_per_day, custom_rpm, custom_rpd")
      .eq("user_id", userId)
      .single();

    // For session auth (no API key), use profile's custom rate limits
    if (!apiKeyId && profile) {
      customRpm = profile.custom_rpm;
      customRpd = profile.custom_rpd;
    }

    if (profile?.is_banned) {
      return new Response(
        JSON.stringify({ error: `Account banned: ${profile.ban_reason || "Contact support"}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check IP blocklist
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";

    const { data: blockedIp } = await supabase
      .from("ip_blocklist")
      .select("*")
      .eq("ip_address", clientIp)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (blockedIp) {
      await supabase.from("security_events").insert({
        event_type: "blocked_ip",
        severity: "high",
        ip_address: clientIp,
        user_id: userId,
        details: { reason: blockedIp.reason }
      });

      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limits
    const rateLimitCheck = await checkRateLimits(supabase, userId!, apiKeyId, customRpm, customRpd);
    if (!rateLimitCheck.allowed) {
      await supabase.from("security_events").insert({
        event_type: "rate_limit",
        severity: "low",
        ip_address: clientIp,
        user_id: userId,
        api_key_id: apiKeyId,
        details: { error: rateLimitCheck.error }
      });

      return new Response(
        JSON.stringify({ error: rateLimitCheck.error }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily image limit for user
    if (profile?.max_images_per_day) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase
        .from("images")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString());

      if ((todayCount || 0) >= profile.max_images_per_day) {
        return new Response(
          JSON.stringify({ error: "Daily image generation limit reached" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get model info (or use default)
    let modelInfo: any = null;
    let creditsCost = 1;

    if (model_id) {
      const { data: model } = await supabase
        .from("ai_models")
        .select("*, providers(*)")
        .eq("id", model_id)
        .single();

      if (model) {
        // Check if model is available
        if (model.status === "disabled" || model.status === "offline") {
          return new Response(
            JSON.stringify({ error: "Model is currently unavailable" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check soft disable
        if (model.is_soft_disabled) {
          return new Response(
            JSON.stringify({ error: model.soft_disable_message || "Model temporarily unavailable" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check cooldown
        if (model.cooldown_until && new Date(model.cooldown_until) > new Date()) {
          if (model.fallback_model_id) {
            // Use fallback model
            const { data: fallbackModel } = await supabase
              .from("ai_models")
              .select("*")
              .eq("id", model.fallback_model_id)
              .single();
            if (fallbackModel) {
              modelInfo = fallbackModel;
              creditsCost = fallbackModel.credits_cost || 1;
            }
          } else {
            return new Response(
              JSON.stringify({ error: "Model is in cooldown, please try again later" }),
              { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          modelInfo = model;
          creditsCost = model.credits_cost || 1;
        }
      }
    }

    // Check user credits
    const { data: userCredits } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .single();

    const currentBalance = userCredits?.balance || 0;
    const dailyCredits = userCredits?.daily_credits || 0;
    const totalAvailable = currentBalance + dailyCredits;

    if (totalAvailable < creditsCost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditsCost, available: totalAvailable }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI Gateway for image generation
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Image generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use configurable AI Gateway URL (defaults to Lovable AI Gateway)
    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate an image: ${prompt}${negative_prompt ? `. Avoid: ${negative_prompt}` : ""}`
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    const generationTime = Date.now() - startTime;

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      // Log failed request
      await supabase.from("request_logs").insert({
        user_id: userId,
        api_key_id: apiKeyId,
        endpoint: "/generate-image",
        method: "POST",
        status_code: aiResponse.status,
        response_time_ms: generationTime,
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
        error_message: errorText.substring(0, 500)
      });

      // Insert failed image record
      await supabase.from("images").insert({
        user_id: userId,
        api_key_id: apiKeyId,
        prompt,
        negative_prompt,
        model_id: modelInfo?.id,
        status: "failed",
        error: errorText.substring(0, 500),
        generation_time_ms: generationTime,
        width,
        height,
        credits_used: 0
      });

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service quota exceeded" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in response:", aiData);
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SUCCESS - Now deduct credits
    // First try to deduct from daily credits, then from balance
    let deductedFromDaily = 0;
    let deductedFromBalance = 0;

    if (dailyCredits >= creditsCost) {
      deductedFromDaily = creditsCost;
    } else {
      deductedFromDaily = dailyCredits;
      deductedFromBalance = creditsCost - dailyCredits;
    }

    if (userCredits) {
      await supabase
        .from("user_credits")
        .update({
          daily_credits: userCredits.daily_credits - deductedFromDaily,
          balance: userCredits.balance - deductedFromBalance,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);
    }

    // Record credit transaction
    await supabase.from("credits_transactions").insert({
      user_id: userId,
      amount: -creditsCost,
      type: "generation",
      reason: `Image generation: ${prompt.substring(0, 50)}...`
    });

    // Insert successful image record
    const { data: imageRecord } = await supabase
      .from("images")
      .insert({
        user_id: userId,
        api_key_id: apiKeyId,
        prompt,
        negative_prompt,
        model_id: modelInfo?.id,
        provider_id: modelInfo?.provider_id,
        image_url: generatedImage,
        status: "completed",
        generation_time_ms: generationTime,
        width: width || 1024,
        height: height || 1024,
        credits_used: creditsCost,
        metadata: { steps, seed, cfg_scale: cfg_scale || 7, num_images: num_images || 1 }
      })
      .select()
      .single();

    // Update API key usage stats
    if (apiKeyId) {
      // Get current usage count and increment
      const { data: currentKey } = await supabase
        .from("api_keys")
        .select("usage_count")
        .eq("id", apiKeyId)
        .single();
      
      await supabase
        .from("api_keys")
        .update({
          usage_count: (currentKey?.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
          last_used_ip: clientIp
        })
        .eq("id", apiKeyId);
    }

    // Update model usage count
    if (modelInfo?.id) {
      const { data: currentModel } = await supabase
        .from("ai_models")
        .select("usage_count")
        .eq("id", modelInfo.id)
        .single();
      
      await supabase
        .from("ai_models")
        .update({ usage_count: (currentModel?.usage_count || 0) + 1 })
        .eq("id", modelInfo.id);
    }

    // Log successful request
    await supabase.from("request_logs").insert({
      user_id: userId,
      api_key_id: apiKeyId,
      endpoint: "/generate-image",
      method: "POST",
      status_code: 200,
      response_time_ms: generationTime,
      ip_address: clientIp,
      user_agent: req.headers.get("user-agent"),
      image_id: imageRecord?.id
    });

    // Get updated credit balance
    const { data: updatedCredits } = await supabase
      .from("user_credits")
      .select("balance, daily_credits")
      .eq("user_id", userId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: imageRecord?.id,
          url: generatedImage,
          prompt,
          width: width || 1024,
          height: height || 1024,
          generation_time_ms: generationTime
        },
        credits: {
          used: creditsCost,
          balance: updatedCredits?.balance || 0,
          daily_remaining: updatedCredits?.daily_credits || 0
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
