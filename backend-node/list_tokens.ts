import { supabase } from "./src/lib/supabase-client.js";
import 'dotenv/config';

async function listTokens() {
  const { data, error } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("user_id, channel_title, is_active");
  
  if (error) {
    console.error("Supabase error:", error);
    return;
  }
  
  console.log("Tokens found in DB:");
  console.table(data);
}

listTokens().catch(console.error);
