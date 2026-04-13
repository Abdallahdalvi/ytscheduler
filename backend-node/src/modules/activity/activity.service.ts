import { supabase } from "../../lib/supabase-client.js";

type ActivityInput = {
  action: string;
  user_id: string; // Required for multi-tenancy
  post_id?: string | null;
  channel_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logActivity(input: ActivityInput) {
  const { error } = await supabase
    .from("ytscheduler_activity_logs")
    .insert({
      user_id: input.user_id,
      action: input.action,
      post_id: input.post_id || null,
      channel_id: input.channel_id || null,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
    });

  if (error) console.error("[Activity] Failed to log action:", error.message);
}

export async function listActivities(userId: string, limit = 50) {
  const { data: rows, error } = await supabase
    .from("ytscheduler_activity_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  
  return (rows || []).map(r => ({
    ...r,
    metadata: r.metadata || {}
  }));
}
