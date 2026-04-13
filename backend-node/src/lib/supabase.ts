import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);

if (!hasSupabase) {
  // eslint-disable-next-line no-console
  console.warn("Supabase credentials are missing. Running in memory mode for local development.");
}

export const supabase = hasSupabase
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
  : null;
