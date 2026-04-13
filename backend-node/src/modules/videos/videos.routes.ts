import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { google } from "googleapis";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { getYouTubeClient, getOAuthClient, CATEGORIES } from "../../lib/youtube-client.js";
import { doUpload } from "./videos.service.js";
import { getAIConfig } from "../ai/ai.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `${ts}_${file.originalname}`);
  },
});
const upload = multer({ storage });
const thumbUpload = multer({ storage });

export const videosRouter = Router();

function getPublicUploadUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const fileName = path.basename(filePath);
  return `/uploads/${encodeURIComponent(fileName)}`;
}

function videoDict(v: any) {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    tags: v.tags,
    category_id: v.category_id || '22',
    privacy: v.privacy,
    file_path: v.file_path,
    youtube_id: v.youtube_id,
    playlist_id: v.playlist_id,
    youtube_url: v.youtube_id ? `https://youtu.be/${v.youtube_id}` : null,
    status: v.status,
    scheduled_at: v.scheduled_at,
    published_at: v.published_at,
    upload_progress: v.upload_progress ?? 0,
    error_message: v.error_message,
    created_at: v.created_at,
    is_draft: Boolean(v.is_draft),
    notification_status: v.notification_status,
    bulk_id: v.bulk_id,
    thumbnail_path: v.thumbnail_path,
    thumbnail_url: getPublicUploadUrl(v.thumbnail_path),
    made_for_kids: Boolean(v.made_for_kids),
    default_language: v.default_language || '',
  };
}

async function getNextAvailableSlot(userId: string, channelId: string): Promise<string | null> {
  const { data: settings } = await supabase
    .from("ytscheduler_settings")
    .select("time_zone")
    .eq("user_id", userId)
    .single();

  const timeZone = settings?.time_zone || "UTC";

  // Fetch active slots for the user
  const { data: slots } = await supabase
    .from("ytscheduler_schedule_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  // Fetch already occupied slots (only upcoming scheduled videos)
  const { data: occupied } = await supabase
    .from("ytscheduler_videos")
    .select("scheduled_at")
    .eq("user_id", userId)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", new Date().toISOString());

  const occupiedTimes = new Set((occupied || []).map(v => new Date(v.scheduled_at).toISOString()));

  // Fallback if no slots defined: 6 PM today/tomorrow
  if (!slots || slots.length === 0) {
    const now = new Date();
    let candidate = new Date(now);
    candidate.setHours(18, 0, 0, 0);
    while (candidate <= now || occupiedTimes.has(candidate.toISOString())) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(18, 0, 0, 0);
    }
    return candidate.toISOString();
  }

  // Find the next slot in the next 14 days (expanded from 7 for safety)
  const now = new Date();
  let bestCandidate: Date | null = null;

  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();

    const daySlots = slots
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => (a.hour * 60 + (a.minute || 0)) - (b.hour * 60 + (b.minute || 0)));

    for (const slot of daySlots) {
      const candidate = new Date(d);
      candidate.setHours(slot.hour, slot.minute || 0, 0, 0);
      
      if (candidate > now && !occupiedTimes.has(candidate.toISOString())) {
        return candidate.toISOString();
      }
    }
  }

  return now.toISOString();
}


// GET /videos
videosRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const status = req.query.status as string | undefined;

  // Find active channel
  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.channel_id) return res.json(ok({ videos: [] }));

  // RESCUE: If user has videos with NULL channel_id, assign them to active channel
  await supabase
    .from("ytscheduler_videos")
    .update({ channel_id: token.channel_id })
    .eq("user_id", userId)
    .is("channel_id", null);

  let query = supabase
    .from("ytscheduler_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_id", token.channel_id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: videos, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json(ok({ videos: (videos || []).map(videoDict) }));
});

// GET /videos/drafts
videosRouter.get("/drafts", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Find active channel
  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.channel_id) return res.json(ok({ videos: [] }));

  const { data: videos, error } = await supabase
    .from("ytscheduler_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_id", token.channel_id)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.json(ok({ videos: (videos || []).map(videoDict) }));
});

// POST /videos/upload
videosRouter.post("/upload", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id, token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.channel_id) return res.status(401).json({ error: "Connect YouTube first" });
  if (!req.file) return res.status(400).json({ error: "No file" });

  const channelId = token.channel_id;

  const {
    title = "Untitled",
    description = "",
    tags = "",
    category_id = "22",
    privacy = "public",
    playlist_id = "",
    auto_schedule = "false",
    schedule_mode = "",
    manual_scheduled_at = "",
    scheduled_at = "",
  } = req.body;

  const mode = String(schedule_mode || "").toLowerCase() || (String(auto_schedule) === "true" ? "auto" : "manual");
  let sched: string | null = null;
  const requestedSchedule = manual_scheduled_at || scheduled_at;
  if (requestedSchedule) {
    try { sched = new Date(requestedSchedule).toISOString(); } catch { sched = null; }
  }

  if (mode === "auto" && !sched) {
    sched = await getNextAvailableSlot(userId, channelId);
  }

  const { data: video, error } = await supabase
    .from("ytscheduler_videos")
    .insert({
      user_id: userId,
      channel_id: channelId,
      title,
      description,
      tags,
      category_id,
      privacy,
      file_path: req.file.path,
      status: mode === "post_now" ? "queued" : "scheduled",
      scheduled_at: sched,
      playlist_id: playlist_id || null,
      is_draft: false,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (mode === "post_now") {
    setImmediate(() => doUpload(video.id, token.token_data, userId));
  }

  return res.status(201).json(ok({ video: videoDict(video), message: "Video queued!" }));
});

// POST /videos/:id/upload-now
videosRouter.post("/:id/upload-now", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const vid = req.params.id;
  
  const { data: video } = await supabase
    .from("ytscheduler_videos")
    .select("*")
    .eq("id", vid)
    .eq("user_id", userId)
    .single();

  if (!video) return res.status(404).json({ error: "Not found" });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.token_data) return res.status(401).json({ error: "Not connected" });

  setImmediate(() => doUpload(video.id, token.token_data, userId));
  return res.json(ok({ message: "Upload started", video_id: vid }));
});

// PUT /videos/:id
videosRouter.put("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  
  const vid = req.params.id;
  const data = req.body || {};

  const updates: any = {};
  const fields = ["title", "description", "tags", "category_id", "privacy", "playlist_id", "default_language"];
  for (const f of fields) {
    if (f in data) updates[f] = data[f];
  }
  if ("made_for_kids" in data) updates.made_for_kids = data.made_for_kids;
  if ("scheduled_at" in data && data.scheduled_at) {
    updates.scheduled_at = new Date(data.scheduled_at).toISOString();
  }

  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update(updates)
    .eq("id", vid)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ video: videoDict(updated) }));
});

// DELETE /videos/:id
videosRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const vid = req.params.id;
  
  const { data: video } = await supabase
    .from("ytscheduler_videos")
    .select("file_path")
    .eq("id", vid)
    .eq("user_id", userId)
    .single();

  if (!video) return res.status(404).json({ error: "Not found" });

  if (video.file_path && fs.existsSync(video.file_path)) {
    try { fs.unlinkSync(video.file_path); } catch { /* ignore */ }
  }

  await supabase
    .from("ytscheduler_videos")
    .delete()
    .eq("id", vid)
    .eq("user_id", userId);

  return res.json(ok({ success: true }));
});


// PUT /videos/youtube/:youtubeId (Direct YT Update)
videosRouter.put("/youtube/:youtubeId", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.token_data) return res.status(401).json({ error: "Not connected" });

  const { youtubeId } = req.params;
  const data = req.body || {};

  try {
    const yt = getYouTubeClient(token.token_data, userId);
    const current = await yt.videos.list({ part: ["snippet", "status"], id: [youtubeId] });
    const item = current.data.items?.[0];
    if (!item) return res.status(404).json({ error: `Video ${youtubeId} not found on YouTube` });

    const snippet = { ...item.snippet };
    const status = { ...item.status };

    if (data.title != null) snippet.title = String(data.title).slice(0, 100);
    if (data.description != null) snippet.description = String(data.description).slice(0, 5000);
    if (data.tags != null) snippet.tags = Array.isArray(data.tags) ? data.tags : String(data.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
    if (data.category_id != null) snippet.categoryId = String(data.category_id);
    if (data.privacy != null) status.privacyStatus = data.privacy;

    const updated = await yt.videos.update({
      part: ["snippet", "status"],
      requestBody: { id: youtubeId, snippet, status },
    });

    return res.json(ok({ video: { youtube_id: updated.data.id, title: updated.data.snippet?.title } }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /videos/:id/assign-next-slot
videosRouter.post("/:id/assign-next-slot", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const sched = await getNextAvailableSlot(userId, token?.channel_id || "");
  
  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update({ scheduled_at: sched, status: "scheduled" })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ video: videoDict(updated) }));
});

// POST /videos/auto-fill-queue
videosRouter.post("/auto-fill-queue", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: drafts } = await supabase
    .from("ytscheduler_videos")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: true });

  if (!drafts || drafts.length === 0) return res.json(ok({ queued: 0 }));

  let queued = 0;
  for (const d of drafts) {
    const sched = await getNextAvailableSlot(userId, token?.channel_id || "");
    await supabase
      .from("ytscheduler_videos")
      .update({ scheduled_at: sched, status: "scheduled" })
      .eq("id", d.id)
      .eq("user_id", userId);
    queued++;
  }

  return res.json(ok({ queued }));
});

// POST /videos/:id/publish
videosRouter.post("/:id/publish", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update({ status: "queued" })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (token?.token_data) {
    setImmediate(() => doUpload(updated.id, token.token_data, userId));
  }

  return res.json(ok({ video: videoDict(updated), message: "Upload started" }));
});

// POST /videos/:id/retry
videosRouter.post("/:id/retry", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update({ status: "queued", error_message: null })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (token?.token_data) {
    setImmediate(() => doUpload(updated.id, token.token_data, userId));
  }

  return res.json(ok({ video: videoDict(updated), message: "Retry started" }));
});

// POST /videos/:id/reschedule
videosRouter.post("/:id/reschedule", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: "scheduled_at required" });

  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update({ scheduled_at: new Date(scheduled_at).toISOString(), status: "scheduled" })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ video: videoDict(updated) }));
});

// POST /videos/:id/thumbnail
videosRouter.post("/:id/thumbnail", thumbUpload.single("thumbnail"), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!req.file) return res.status(400).json({ error: "No file" });

  const { data: updated, error } = await supabase
    .from("ytscheduler_videos")
    .update({ thumbnail_path: req.file.path })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ video: videoDict(updated) }));
});

// DELETE /videos/youtube/:youtubeId (Direct YT Deletion)
videosRouter.delete("/youtube/:youtubeId", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { youtubeId } = req.params;

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!token?.token_data) return res.status(401).json({ error: "Not connected" });

  try {
    const yt = getYouTubeClient(token.token_data, userId);
    await yt.videos.delete({ id: youtubeId });

    // Also remove from local DB if it exists
    await supabase.from("ytscheduler_videos").delete().eq("youtube_id", youtubeId).eq("user_id", userId);

    return res.json(ok({ success: true }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});



// POST /videos/bulk-upload
videosRouter.post("/bulk-upload", upload.array("files"), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: "No files" });

  let meta = [];
  try {
    meta = JSON.parse(req.body.meta || "[]");
  } catch (e) {
    console.error("[Bulk] Failed to parse meta JSON:", e);
  }

  const { data: token } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id, token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const results = [];
  let postNowStarted = 0;
  let postNowSkipped = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    // Frontend sends metadata as an array for each file (which it sends one by one)
    // So meta[0] is the correct one.
    const m = meta[0] || meta[i] || {};
    
    let status = "queued";
    let scheduled_at = null;

    if (m.schedule_mode === "post_now") {
      status = "uploading";
    } else if (m.schedule_mode === "manual" && m.manual_scheduled_at) {
      status = "scheduled";
      scheduled_at = new Date(m.manual_scheduled_at).toISOString();
    } else if (m.schedule_mode === "auto") {
      status = "scheduled";
      scheduled_at = await getNextAvailableSlot(userId, token?.channel_id || "");
    }

    const videoToInsert: any = {
      user_id: userId,
      channel_id: token?.channel_id || null, // CRITICAL FIX: Include channel_id
      title: (m.title || f.originalname).trim(),
      description: m.description || "",
      tags: m.tags || "",
      category_id: m.category_id || "22",
      privacy: m.privacy || "public",
      playlist_id: m.playlist_id || null,
      file_path: f.path,
      status: status,
      scheduled_at: scheduled_at,
      made_for_kids: Boolean(m.made_for_kids),
      default_language: m.default_language || "",
    };

    const { data, error } = await supabase
      .from("ytscheduler_videos")
      .insert(videoToInsert)
      .select()
      .single();

    if (error) {
      console.error("[Bulk] Insert error:", error.message);
      return res.status(500).json({ error: `Failed to insert video ${f.originalname}: ${error.message}` });
    }

    if (data) {
      results.push(videoDict(data));
      if (m.schedule_mode === "post_now") {
        if (token?.token_data) {
          setImmediate(() => doUpload(data.id, token.token_data, userId));
          postNowStarted++;
        } else {
          postNowSkipped++;
          await supabase.from("ytscheduler_videos").update({ status: "queued" }).eq("id", data.id);
        }
      }
    }
  }

  return res.json(ok({ videos: results, post_now_started: postNowStarted, post_now_skipped: postNowSkipped }));
});

// POST /videos/:id/notify
videosRouter.post("/:id/notify", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { status } = req.body || {};
  await supabase
    .from("ytscheduler_videos")
    .update({ notification_status: status })
    .eq("id", req.params.id)
    .eq("user_id", userId);

  return res.json(ok({ success: true }));
});

