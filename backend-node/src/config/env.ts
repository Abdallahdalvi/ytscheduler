import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5199),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};
