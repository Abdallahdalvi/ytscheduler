import { Router } from "express";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import path from "node:path";

export const dashboardRouter = Router();

function getPublicUploadUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const fileName = path.basename(filePath);
  return `/uploads/${encodeURIComponent(fileName)}`;
}

function videoDict(v: any) {
  return {
    id: v.id, title: v.title, description: v.description, tags: v.tags,
    category_id: v.category_id, privacy: v.privacy, file_path: v.file_path,
    youtube_id: v.youtube_id, playlist_id: v.playlist_id,
    youtube_url: v.youtube_id ? `https://youtu.be/${v.youtube_id}` : null,
    status: v.status, scheduled_at: v.scheduled_at, published_at: v.published_at,
    upload_progress: v.upload_progress ?? 0, error_message: v.error_message,
    created_at: v.created_at, is_draft: Boolean(v.is_draft),
    notification_status: v.notification_status, bulk_id: v.bulk_id,
    thumbnail_path: v.thumbnail_path,
    thumbnail_url: getPublicUploadUrl(v.thumbnail_path),
  };
}

dashboardRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 1. Get linked channel info
    const { data: token } = await supabase
      .from("ytscheduler_oauth_tokens")
      .select("channel_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!token?.channel_id) {
      return res.json(ok({
        total_videos: 0, published: 0, scheduled: 0, queued: 0, failed: 0,
        next_scheduled: null, recent_published: [],
      }));
    }

    const channelId = token.channel_id;

    // 2. Fetch Aggregates
    const { data: videos, error } = await supabase
      .from("ytscheduler_videos")
      .select("status")
      .eq("user_id", userId)
      .eq("channel_id", channelId);

    if (error) throw error;

    const total = videos.length;
    const published = videos.filter(v => v.status === 'published').length;
    const scheduled = videos.filter(v => v.status === 'scheduled').length;
    const queued = videos.filter(v => v.status === 'queued').length;
    const failed = videos.filter(v => v.status === 'failed').length;

    // 3. Next Scheduled
    const { data: nextVid } = await supabase
      .from("ytscheduler_videos")
      .select("*")
      .eq("user_id", userId)
      .eq("channel_id", channelId)
      .eq("status", "scheduled")
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .single();

    // 4. Recent Published
    const { data: recent } = await supabase
      .from("ytscheduler_videos")
      .select("*")
      .eq("user_id", userId)
      .eq("channel_id", channelId)
      .eq("status", "published")
      .order("published_at", { descending: true })
      .limit(5);

    return res.json(
      ok({
        total_videos: total,
        published,
        scheduled,
        queued,
        failed,
        next_scheduled: nextVid ? videoDict(nextVid) : null,
        recent_published: (recent || []).map(videoDict),
      }),
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
