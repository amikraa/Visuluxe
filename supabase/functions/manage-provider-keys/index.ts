import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert base64 to ArrayBuffer (not Uint8Array to avoid SharedArrayBuffer issues)
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

// Convert Uint8Array to base64
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binString);
}

// Encrypt API key using AES-256-GCM
async function encryptAPIKey(plainKey: string, encryptionKeyBase64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoder = new TextEncoder();

  // Import the encryption key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(encryptionKeyBase64),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Encrypt the API key
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encoder.encode(plainKey)
  );

  // Combine IV + encrypted data (GCM includes auth tag automatically)
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return bytesToBase64(combined);
}

// Decrypt API key using AES-256-GCM
async function decryptAPIKey(encryptedKey: string, encryptionKeyBase64: string): Promise<string> {
  // Decode the combined data
  const binString = atob(encryptedKey);
  const combined = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    combined[i] = binString.charCodeAt(i);
  }
  
  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  // Import the encryption key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(encryptionKeyBase64),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

// Mask API key showing only last 4 characters
function maskAPIKey(key: string): string {
  if (!key || key.length < 4) return "••••••••";
  return "••••••••" + key.slice(-4);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Encryption not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user and check admin role
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin or above
    const { data: isAdmin } = await supabase.rpc("is_admin_or_above", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, provider_id, api_key, password } = body;

    // Service role client for operations that need to bypass RLS
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different actions
    switch (action) {
      case "encrypt": {
        if (!api_key) {
          return new Response(
            JSON.stringify({ error: "API key is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const encryptedKey = await encryptAPIKey(api_key, encryptionKey);
        const maskedKey = maskAPIKey(api_key);

        return new Response(
          JSON.stringify({ 
            success: true, 
            encrypted_key: encryptedKey,
            masked_key: maskedKey
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "decrypt": {
        if (!provider_id) {
          return new Response(
            JSON.stringify({ error: "Provider ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!password) {
          return new Response(
            JSON.stringify({ error: "Password is required for re-authentication" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Rate limiting: Check decrypt count in last hour
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const { count } = await supabase
          .from("admin_audit_logs")
          .select("*", { count: "exact", head: true })
          .eq("actor_id", user.id)
          .eq("action", "provider_key_decrypted")
          .gte("created_at", oneHourAgo);

        if (count !== null && count >= 10) {
          const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
          return new Response(
            JSON.stringify({ error: `Rate limit exceeded. Max 10 decryptions per hour. IP: ${ipAddress}` }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Re-authenticate user with password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: password,
        });

        if (signInError) {
          return new Response(
            JSON.stringify({ error: "Invalid password" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch provider
        const { data: provider, error: providerError } = await serviceClient
          .from("providers")
          .select("id, name, api_key_encrypted")
          .eq("id", provider_id)
          .single();

        if (providerError || !provider) {
          return new Response(
            JSON.stringify({ error: "Provider not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!provider.api_key_encrypted) {
          return new Response(
            JSON.stringify({ error: "No API key stored for this provider" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Decrypt the key
        let decryptedKey: string;
        try {
          decryptedKey = await decryptAPIKey(provider.api_key_encrypted, encryptionKey);
        } catch (decryptError) {
          console.error("Decryption failed:", decryptError);
          return new Response(
            JSON.stringify({ error: "Failed to decrypt key. It may be stored in plain text or corrupted." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log the decrypt operation
        await supabase.from("admin_audit_logs").insert({
          actor_id: user.id,
          action: "provider_key_decrypted",
          target_type: "providers",
          target_id: provider_id,
          details: {
            provider_name: provider.name,
            ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
            user_agent: req.headers.get("user-agent"),
          },
        });

        // Notify super admins about key decryption
        const { data: superAdmins } = await serviceClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");

        if (superAdmins && superAdmins.length > 0) {
          const notifications = superAdmins
            .filter(admin => admin.user_id !== user.id) // Don't notify the user who decrypted
            .map(admin => ({
              user_id: admin.user_id,
              title: "API Key Decrypted",
              message: `${user.email} viewed the API key for provider "${provider.name}"`,
              type: "security" as const,
              action_url: "/admin/security"
            }));

          if (notifications.length > 0) {
            await serviceClient.from("notifications").insert(notifications);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            api_key: decryptedKey,
            masked_key: maskAPIKey(decryptedKey)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_masked": {
        if (!provider_id) {
          return new Response(
            JSON.stringify({ error: "Provider ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: provider, error: providerError } = await serviceClient
          .from("providers")
          .select("api_key_encrypted, key_encrypted_at")
          .eq("id", provider_id)
          .single();

        if (providerError || !provider) {
          return new Response(
            JSON.stringify({ error: "Provider not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!provider.api_key_encrypted) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              masked_key: null,
              has_key: false,
              is_encrypted: false
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Try to decrypt to get the last 4 chars for masking
        let maskedKey = "••••••••••••";
        let isEncrypted = !!provider.key_encrypted_at;
        
        if (isEncrypted) {
          try {
            const decryptedKey = await decryptAPIKey(provider.api_key_encrypted, encryptionKey);
            maskedKey = maskAPIKey(decryptedKey);
          } catch {
            // If decryption fails, it might be plain text - show generic mask
            maskedKey = "••••••••" + provider.api_key_encrypted.slice(-4);
            isEncrypted = false;
          }
        } else {
          // Plain text key - just mask it
          maskedKey = maskAPIKey(provider.api_key_encrypted);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            masked_key: maskedKey,
            has_key: true,
            is_encrypted: isEncrypted
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "re_encrypt_legacy": {
        // Re-encrypt a legacy plain-text key
        if (!provider_id) {
          return new Response(
            JSON.stringify({ error: "Provider ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch the provider with plain-text key
        const { data: provider, error: providerError } = await serviceClient
          .from("providers")
          .select("id, name, api_key_encrypted, key_encrypted_at")
          .eq("id", provider_id)
          .single();

        if (providerError || !provider) {
          return new Response(
            JSON.stringify({ error: "Provider not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!provider.api_key_encrypted) {
          return new Response(
            JSON.stringify({ error: "No API key to encrypt" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (provider.key_encrypted_at) {
          return new Response(
            JSON.stringify({ success: true, message: "Key already encrypted" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Encrypt the plain-text key
        const encryptedKey = await encryptAPIKey(provider.api_key_encrypted, encryptionKey);

        // Update the provider with encrypted key
        const { error: updateError } = await serviceClient
          .from("providers")
          .update({
            api_key_encrypted: encryptedKey,
            key_encrypted_at: new Date().toISOString()
          })
          .eq("id", provider_id);

        if (updateError) {
          console.error("Failed to update provider:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update provider" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log the re-encryption
        await supabase.from("admin_audit_logs").insert({
          actor_id: user.id,
          action: "provider_key_encrypted",
          target_type: "providers",
          target_id: provider_id,
          details: {
            provider_name: provider.name,
            ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
            migration_type: "legacy_to_encrypted"
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Key for ${provider.name} encrypted successfully`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: encrypt, decrypt, get_masked, or re_encrypt_legacy" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in manage-provider-keys:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
