import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit tracking (in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decryptAPIKey(encryptedKey: string, encryptionKeyBase64: string): Promise<string> {
  const encryptionKeyBytes = new Uint8Array(base64ToArrayBuffer(encryptionKeyBase64));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedKey));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

function getProviderType(name: string, baseUrl: string | null): string {
  const nameLower = name.toLowerCase();
  const urlLower = (baseUrl || "").toLowerCase();
  
  if (nameLower.includes("openai") || urlLower.includes("openai.com")) return "openai";
  if (nameLower.includes("replicate") || urlLower.includes("replicate.com")) return "replicate";
  if (nameLower.includes("stability") || urlLower.includes("stability.ai")) return "stability";
  if (nameLower.includes("together") || urlLower.includes("together.xyz")) return "together";
  if (nameLower.includes("anthropic") || urlLower.includes("anthropic.com")) return "anthropic";
  if (nameLower.includes("google") || urlLower.includes("generativelanguage.googleapis.com")) return "google";
  if (nameLower.includes("fal") || urlLower.includes("fal.run")) return "fal";
  return "generic";
}

interface HealthEndpoint {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function getHealthEndpoint(type: string, baseUrl: string | null, apiKey: string): HealthEndpoint {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  switch (type) {
    case "openai":
      headers["Authorization"] = `Bearer ${apiKey}`;
      return {
        url: baseUrl ? `${baseUrl}/models` : "https://api.openai.com/v1/models",
        method: "GET",
        headers,
      };
    
    case "replicate":
      headers["Authorization"] = `Bearer ${apiKey}`;
      return {
        url: "https://api.replicate.com/v1/predictions",
        method: "GET",
        headers,
      };
    
    case "stability":
      headers["Authorization"] = `Bearer ${apiKey}`;
      return {
        url: baseUrl ? `${baseUrl}/engines/list` : "https://api.stability.ai/v1/engines/list",
        method: "GET",
        headers,
      };
    
    case "together":
      headers["Authorization"] = `Bearer ${apiKey}`;
      return {
        url: "https://api.together.xyz/v1/models",
        method: "GET",
        headers,
      };
    
    case "anthropic":
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      return {
        url: baseUrl ? `${baseUrl}/messages` : "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      };
    
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        method: "GET",
        headers,
      };
    
    case "fal":
      headers["Authorization"] = `Key ${apiKey}`;
      return {
        url: baseUrl || "https://fal.run",
        method: "GET",
        headers,
      };
    
    default:
      headers["Authorization"] = `Bearer ${apiKey}`;
      return {
        url: baseUrl || "",
        method: "GET",
        headers,
      };
  }
}

function checkRateLimit(providerId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 5;
  
  const existing = rateLimitMap.get(providerId);
  
  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(providerId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (existing.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  
  existing.count++;
  return { allowed: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Encryption key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user-scoped client to verify auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabaseUser.rpc("is_admin_or_above", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { provider_id } = await req.json();
    if (!provider_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing provider_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(provider_id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to fetch provider (to access encrypted key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("id", provider_id)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ success: false, message: "Provider not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if API key is set
    if (!provider.api_key_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No API key configured for this provider",
          responseTime: 0,
          details: {
            statusCode: 0,
            endpoint: "",
            timestamp: new Date().toISOString(),
            errorDetails: "API key not set",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt API key
    let apiKey: string;
    try {
      if (provider.key_encrypted_at) {
        // Properly encrypted key
        apiKey = await decryptAPIKey(provider.api_key_encrypted, ENCRYPTION_KEY);
      } else {
        // Legacy plain-text key
        apiKey = provider.api_key_encrypted;
      }
    } catch (decryptError) {
      console.error("Failed to decrypt API key:", decryptError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to decrypt API key",
          responseTime: 0,
          details: {
            statusCode: 0,
            endpoint: "",
            timestamp: new Date().toISOString(),
            errorDetails: "Decryption error",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine provider type and health endpoint
    const providerType = getProviderType(provider.name, provider.base_url);
    const healthEndpoint = getHealthEndpoint(providerType, provider.base_url, apiKey);

    if (!healthEndpoint.url) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No base URL configured for this provider",
          responseTime: 0,
          details: {
            statusCode: 0,
            endpoint: "",
            timestamp: new Date().toISOString(),
            errorDetails: "Missing base URL",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Make health check request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    let testResult: {
      success: boolean;
      message: string;
      responseTime: number;
      details: {
        statusCode: number;
        endpoint: string;
        method: string;
        timestamp: string;
        errorDetails?: string;
      };
    };

    try {
      const fetchOptions: RequestInit = {
        method: healthEndpoint.method,
        headers: healthEndpoint.headers,
        signal: controller.signal,
      };
      
      if (healthEndpoint.body) {
        fetchOptions.body = healthEndpoint.body;
      }

      const response = await fetch(healthEndpoint.url, fetchOptions);
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (response.ok) {
        testResult = {
          success: true,
          message: "Connection successful",
          responseTime,
          details: {
            statusCode: response.status,
            endpoint: healthEndpoint.url.replace(apiKey, "***"),
            method: healthEndpoint.method,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        let errorMessage = "Provider returned an error";
        
        if (response.status === 401 || response.status === 403) {
          errorMessage = "Invalid API key or unauthorized";
        } else if (response.status === 429) {
          errorMessage = "Provider rate limit exceeded";
        } else if (response.status >= 500) {
          errorMessage = "Provider server error";
        }

        testResult = {
          success: false,
          message: errorMessage,
          responseTime,
          details: {
            statusCode: response.status,
            endpoint: healthEndpoint.url.replace(apiKey, "***"),
            method: healthEndpoint.method,
            timestamp: new Date().toISOString(),
            errorDetails: responseText.substring(0, 500),
          },
        };
      }
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let errorMessage = "Unable to reach provider API";
      let errorDetails = "Unknown error";
      
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          errorMessage = "Connection timeout after 10 seconds";
        }
        errorDetails = fetchError.message;
      }

      testResult = {
        success: false,
        message: errorMessage,
        responseTime,
        details: {
          statusCode: 0,
          endpoint: healthEndpoint.url.replace(apiKey, "***"),
          method: healthEndpoint.method,
          timestamp: new Date().toISOString(),
          errorDetails,
        },
      };
    }

    // Update provider with test results
    const updateResult = await supabaseAdmin
      .from("providers")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: testResult.success ? "success" : "failed",
        last_test_message: testResult.message,
        last_test_response_time: testResult.responseTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", provider_id);

    if (updateResult.error) {
      console.error("Failed to update provider test results:", updateResult.error);
    }

    // Log to admin audit logs
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: user.id,
      action: "provider_connection_tested",
      target_type: "provider",
      target_id: provider_id,
      details: {
        provider_name: provider.display_name,
        provider_type: providerType,
        result: testResult.success ? "success" : "failed",
        response_time_ms: testResult.responseTime,
        error_message: testResult.success ? null : testResult.message,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    console.log(`Provider test: ${provider.display_name} - ${testResult.success ? "SUCCESS" : "FAILED"} (${testResult.responseTime}ms)`);

    return new Response(
      JSON.stringify(testResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in test-provider-connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        responseTime: 0,
        details: {
          statusCode: 500,
          endpoint: "",
          timestamp: new Date().toISOString(),
          errorDetails: errorMessage,
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
