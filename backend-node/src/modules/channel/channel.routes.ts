import { Router } from "express";
import { google } from "googleapis";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { getYouTubeClient, getOAuthClient } from "../../lib/youtube-client.js";

export const channelRouter = Router();
export const youtubeRouter = Router();

function parseIsoDurationToSeconds(iso?: string | null): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

async function getAuthToken(userId: string) {
  const { data } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.token_data;
}

channelRouter.get("/info", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokenData = await getAuthToken(userId);
  if (!tokenData) return res.status(401).json({ error: "Not connected" });

  try {
    const yt = getYouTubeClient(tokenData, userId);
    const ch = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
    const item = ch.data.items?.[0];
    if (!item) return res.status(404).json({ error: "Channel not found" });
    const s = item.snippet!;
    const stats = item.statistics || {};
    return res.json(
      ok({
        channel_id: item.id,
        channel_title: s.title,
        channel_thumbnail: s.thumbnails?.default?.url,
        subscriber_count: Number(stats.subscriberCount ?? 0),
        video_count: Number(stats.videoCount ?? 0),
        view_count: Number(stats.viewCount ?? 0),
      }),
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

channelRouter.get("/uploads", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokenData = await getAuthToken(userId);
  if (!tokenData) return res.status(401).json({ error: "Not connected" });

  try {
    const yt = getYouTubeClient(tokenData, userId);
    const ch = await yt.channels.list({ part: ["contentDetails"], mine: true });
    const playlistId = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) return res.json(ok({ videos: [] }));

    const allItems: any[] = [];
    let pageToken: string | null | undefined = undefined;

    do {
      const page: any = await yt.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken: pageToken ?? undefined,
      });
      allItems.push(...(page.data.items ?? []));
      pageToken = page.data.nextPageToken;
    } while (pageToken && allItems.length < 200);

    const videoIds = allItems.map(i => i.snippet.resourceId.videoId);
    const statsMap: Record<string, any> = {};

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const statsRes = await yt.videos.list({
        part: ["snippet", "statistics", "status", "contentDetails"],
        id: batch,
      });
      (statsRes.data.items ?? []).forEach((st) => {
        const durationSec = parseIsoDurationToSeconds(st.contentDetails?.duration || null);
        const title = String(st.snippet?.title || "");
        statsMap[st.id!] = {
          title,
          description: st.snippet?.description ?? "",
          tags: st.snippet?.tags ?? [],
          category_id: st.snippet?.categoryId ?? "22",
          view_count: Number(st.statistics?.viewCount ?? 0),
          like_count: Number(st.statistics?.likeCount ?? 0),
          comment_count: Number(st.statistics?.commentCount ?? 0),
          privacy: st.status?.privacyStatus ?? "public",
          is_short: durationSec > 0 && (durationSec <= 60 || title.toLowerCase().includes("#shorts")),
        };
      });
    }

    const videos = allItems.map((i) => {
      const vid = i.snippet.resourceId.videoId;
      const st = statsMap[vid] || {};
      return {
        youtube_id: vid,
        title: st.title || i.snippet.title,
        description: st.description || "",
        tags: st.tags || [],
        thumbnail: i.snippet.thumbnails?.medium?.url ?? "",
        published_at: i.snippet.publishedAt ?? null,
        url: `https://youtu.be/${vid}`,
        ...st,
      };
    });

    return res.json(ok({ videos }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

channelRouter.get("/analytics/daily", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokenData = await getAuthToken(userId);
  if (!tokenData) return res.status(401).json({ error: "Not connected" });

  try {
    const oauth = getOAuthClient();
    oauth.setCredentials({
      access_token: tokenData.access_token || tokenData.token,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope || (tokenData.scopes || []).join(" "),
    });
    const ytAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth });
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const report = await ytAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      metrics: "views,estimatedMinutesWatched,averageViewDuration",
      dimensions: "day",
      sort: "day",
    });
    const daily = (report.data.rows ?? []).map((row) => ({
      date: row[0],
      views: Number(row[1] ?? 0),
      watch_time_minutes: Number(row[2] ?? 0),
      avg_view_duration_seconds: Number(row[3] ?? 0),
    }));
    return res.json(ok({ daily }));
  } catch (err: any) {
    return res.json(ok({ daily: [], error: err.message }));
  }
});

// YouTube router (playlists)
youtubeRouter.get("/playlists", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokenData = await getAuthToken(userId);
  if (!tokenData) return res.status(401).json({ error: "Not connected" });

  try {
    const yt = getYouTubeClient(tokenData, userId);
    const response = await yt.playlists.list({ part: ["snippet", "status"], mine: true, maxResults: 50 });
    const playlists = (response.data.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet?.title,
      privacy: item.status?.privacyStatus ?? "private",
    }));
    return res.json(ok({ playlists }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

youtubeRouter.post("/playlists", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokenData = await getAuthToken(userId);
  if (!tokenData) return res.status(401).json({ error: "Not connected" });

  const { title, privacy = "public", description = "" } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title required" });

  try {
    const yt = getYouTubeClient(tokenData, userId);
    const response = await yt.playlists.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title, description },
        status: { privacyStatus: privacy },
      },
    });
    return res.json(ok({
      playlist: {
        id: response.data.id,
        title: response.data.snippet?.title,
        privacy: response.data.status?.privacyStatus,
      },
    }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
