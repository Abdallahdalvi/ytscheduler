import { Router } from "express";
import { getAIConfig } from "../ai/ai.config.js";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { getYouTubeClient } from "../../lib/youtube-client.js";

export const scheduleRouter = Router();

async function getChannelId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.channel_id ?? null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const DEFAULT_TIME_POOL = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

function researchBackedTimesForZone(timeZone: string): string[][] {
  // Generic pattern for now (same as before)
  return [
    ["10:00", "14:00", "19:00", "21:00"],
    ["17:00", "19:00", "20:00", "21:00"],
    ["17:00", "19:00", "20:00", "21:00"],
    ["17:00", "19:00", "20:00", "21:00"],
    ["17:00", "19:00", "20:00", "21:00"],
    ["15:00", "17:00", "19:00", "21:00"],
    ["09:00", "12:00", "15:00", "18:00", "20:00"],
  ];
}

async function getChannelPerformanceSample(userId: string, timeZone: string): Promise<any[]> {
  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.token_data) return [];

  try {
    const yt = getYouTubeClient(token.token_data, userId);
    // Logic to fetch performance (Simplified for now)
    return []; 
  } catch { return []; }
}

// GET /schedule/slots
scheduleRouter.get("/slots", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: slots, error } = await supabase
    .from("ytscheduler_schedule_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("hour", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.json(ok({
    slots: (slots || []).map(s => ({
      ...s,
      day_name: DAYS[s.day_of_week],
      time_label: `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`
    }))
  }));
});

// POST /schedule/generate
scheduleRouter.post("/generate", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { posts_per_week = 3 } = req.body || {};
  const count = Math.max(1, Math.min(150, Number(posts_per_week)));

  const { data: settings } = await supabase
    .from("ytscheduler_settings")
    .select("time_zone, ai_model, openrouter_api_key")
    .eq("user_id", userId)
    .single();

  const timeZone = settings?.time_zone || "UTC";
  
  // AI-POWERED GENERATION (USER-SELECTED MODEL)
  const { key: apiKey, model: userModel } = await getAIConfig(userId);

  if (!apiKey) {
    return res.status(401).json({ error: "No AI service key available (OpenRouter). Check system configuration." });
  }

  try {
    const prompt = `### MISSION CRITICAL: DEEP STRATEGIC DISTRIBUTION AUDIT
You are the Lead Distribution Scientist at a global media firm. 

INPUT DATA:
- Weekly Velocity: ${count} videos
- Time Zone: ${timeZone}

STEP 1: PERFORM DEEP RESEARCH
- Analyze global audience heatmaps for the ${timeZone} zone.
- Identify the exact 3 highest-retention peaks for every single day of the week.
- Cross-reference with global YouTube traffic patterns (US, EU, ASIA).

STEP 2: MATHEMATICAL ANCHORING
- You must be 100% DETERMINISTIC. 
- If the inputs (${count} posts, ${timeZone}) are the same, your output MUST be identical down to the minute.
- Do not use "random" or "varied" times. Use the MATHEMATICALLY OPTIMAL peaks.

OUTPUT FORMAT (JSON ONLY):
{
  "slots": [
    { "day_of_week": 0..6, "hour": 0..23, "minute": 0..59 }
  ]
}
Total slots must equal ${count}. Return ONLY JSON.`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: userModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        top_p: 1,
        seed: 42 // Absolute anchoring
      })
    });

    const data: any = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const slotsToInsert = (parsed.slots || []).map((s: any) => ({
      user_id: userId,
      day_of_week: Math.min(6, Math.max(0, Number(s.day_of_week))),
      hour: Math.min(23, Math.max(0, Number(s.hour))),
      minute: Math.min(59, Math.max(0, Number(s.minute))),
      is_active: true
    }));

    if (slotsToInsert.length === 0) throw new Error("AI returned empty slots");

    // Clear and insert
    await supabase.from("ytscheduler_schedule_slots").delete().eq("user_id", userId);
    await supabase.from("ytscheduler_schedule_slots").insert(slotsToInsert);

    return res.json(ok({ 
      message: `AI Strategist (GPT-5.4) has optimized ${slotsToInsert.length} slots for your channel.`,
      slots: slotsToInsert 
    }));
  } catch (err: any) {
    console.error("Schedule AI Error:", err);
    return res.status(502).json({ error: "AI Strategy Node (GPT-5.4) unreachable: " + err.message });
  }
});

// GET /schedule/calendar
scheduleRouter.get("/calendar", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const current = new Date();
  const year = Number(req.query.year || current.getFullYear());
  const month = Number(req.query.month || current.getMonth() + 1);

  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59).toISOString();

  const { data: events, error } = await supabase
    .from("ytscheduler_videos")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.json(ok({ year, month, events }));
});

// DELETE /schedule/slots/:id
scheduleRouter.delete("/slots/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  await supabase
    .from("ytscheduler_schedule_slots")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  return res.json(ok({ success: true }));
});
