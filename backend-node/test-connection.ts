import { supabase } from "./src/lib/supabase-client.js";

async function test() {
  console.log("Testing Supabase connection...");
  const { data, error } = await supabase.from("ytscheduler_videos").select("count");
  if (error) {
    console.error("Connection failed:", error.message);
  } else {
    console.log("Success! Data received:", data);
  }
}

test();
