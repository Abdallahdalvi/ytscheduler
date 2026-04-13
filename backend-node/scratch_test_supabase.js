import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from("ytscheduler_oauth_tokens").select("*").limit(1);
  if (error) {
    console.error("Supabase Error:", error.message);
  } else {
    console.log("Supabase Success! Found", data.length, "rows");
  }
}

test();
