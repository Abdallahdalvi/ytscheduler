import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { CATEGORIES } from "../../lib/youtube-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_SECRET_PATH = path.join(__dirname, "../../../../client_secret.json");

export const settingsRouter = Router();

// GET /settings
settingsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let { data: s, error } = await supabase
    .from("ytscheduler_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Initialize defaults if not found
  if (error || !s) {
    const { data: newbie } = await supabase
      .from("ytscheduler_settings")
      .insert({ user_id: userId })
      .select()
      .single();
    s = newbie;
  }

  return res.json(
    ok({
      posts_per_week: s.posts_per_week,
      posts_per_month: s.posts_per_month,
      default_privacy: s.default_privacy,
      default_category: s.default_category,
      auto_fill_slots: Boolean(s.auto_fill_slots),
      has_openrouter_key: Boolean(s.openrouter_api_key),
      ai_model: s.ai_model || "openai/gpt-4o",
      has_client_secret: fs.existsSync(CLIENT_SECRET_PATH),
      categories: CATEGORIES,
      time_zone: s.time_zone || "UTC",
    }),
  );
});

// PUT /settings
settingsRouter.put("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const data = req.body || {};
  const allowed = ["posts_per_week", "posts_per_month", "default_privacy", "default_category", "auto_fill_slots", "ai_model", "time_zone"];
  const updates: any = {};

  for (const key of allowed) {
    if (key in data) updates[key] = data[key];
  }
  if (data.openrouter_api_key) updates.openrouter_api_key = String(data.openrouter_api_key);

  const { error } = await supabase
    .from("ytscheduler_settings")
    .update(updates)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ success: true }));
});

// PUT /settings/timezone
settingsRouter.put("/timezone", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { time_zone } = req.body || {};
  if (!time_zone) return res.status(400).json({ error: "time_zone is required" });

  const { error } = await supabase
    .from("ytscheduler_settings")
    .update({ time_zone })
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ success: true }));
});
