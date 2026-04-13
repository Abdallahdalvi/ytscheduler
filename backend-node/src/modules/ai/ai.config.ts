import { supabase } from "../../lib/supabase-client.js";

export interface AIConfig {
  key: string;
  model: string;
}

/**
 * Fetches user-specific AI model and API key from Supabase.
 * Multi-tenant aware: requires userId.
 * ABSOLUTELY NO HARD-CODED FALLBACKS.
 */
export async function getAIConfig(userId: string): Promise<AIConfig> {
  if (!userId) {
    throw new Error("Critical: Authentication required for AI Neural Access.");
  }

  const { data: settings } = await supabase
    .from("ytscheduler_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Prefer user-selected model from DB
  const model = settings?.ai_model?.trim();
  
  // Key can come from DB or local Environment (Secure)
  const key = settings?.openrouter_api_key || process.env.OPENROUTER_API_KEY;

  if (!model) {
    throw new Error("No AI Neural Engine selected. Please configure your preferred model (GPT-5.4, Grok, etc.) in Settings.");
  }

  if (!key) {
    throw new Error("OpenRouter API Key mission-critical: Please add your key in Settings.");
  }

  return { 
    key, 
    model 
  };
}
