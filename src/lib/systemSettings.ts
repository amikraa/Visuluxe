import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/logger";

export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .single();
    
    if (error) {
      devLog.error("Error fetching system setting:", key, error);
      return null;
    }
    
    // Handle both string and JSON values
    if (typeof data?.value === "string") {
      return data.value;
    }
    return data?.value ? JSON.stringify(data.value) : null;
  } catch (e) {
    devLog.error("Error in getSystemSetting:", e);
    return null;
  }
}

export async function getSystemSettings(keys: string[]): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", keys);
    
    if (error) {
      devLog.error("Error fetching system settings:", error);
      return {};
    }
    
    const result: Record<string, any> = {};
    data?.forEach(item => {
      result[item.key] = item.value;
    });
    return result;
  } catch (e) {
    devLog.error("Error in getSystemSettings:", e);
    return {};
  }
}

export async function isMaintenanceMode(): Promise<{ enabled: boolean; message: string }> {
  const settings = await getSystemSettings(["maintenance_mode", "maintenance_message"]);
  return {
    enabled: settings.maintenance_mode === "true" || settings.maintenance_mode === true,
    message: settings.maintenance_message || "System is under maintenance. Please try again later."
  };
}
