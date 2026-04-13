import fs from "node:fs";
import { supabase } from "../../lib/supabase-client.js";
import { getYouTubeClient } from "../../lib/youtube-client.js";
import { logActivity } from "../activity/activity.service.js";

export async function doUpload(videoId: any, tokenData: any, userId: string) {
  const { data: video } = await supabase
    .from("ytscheduler_videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", userId)
    .single();

  if (!video) return;

  await supabase
    .from("ytscheduler_videos")
    .update({ status: 'uploading', upload_progress: 0.0 })
    .eq("id", videoId);

  try {
    const yt = getYouTubeClient(tokenData, userId);
    const tags = (video.tags || "")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    const filePath = video.file_path;
    if (!filePath || !fs.existsSync(filePath)) throw new Error("Video file not found on disk");

    const fileSize = fs.statSync(filePath).size;
    const fileStream = fs.createReadStream(filePath);

    const response = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: video.title.slice(0, 100),
          description: (video.description || "").slice(0, 5000),
          tags: tags.slice(0, 500),
          categoryId: video.category_id || "22",
        },
        status: {
          privacyStatus: video.privacy || "public",
          ...(video.scheduled_at && {
            publishAt: new Date(video.scheduled_at).toISOString(),
            privacyStatus: "private",
          }),
        },
      },
      media: {
        mimeType: "video/*",
        body: fileStream,
      },
    }, {
      onUploadProgress: async (evt) => {
        const progress = evt.bytesRead / fileSize;
        await supabase
          .from("ytscheduler_videos")
          .update({ upload_progress: progress })
          .eq("id", videoId);
      },
    });

    const youtubeId = response.data.id!;

    if (video.playlist_id) {
      try {
        await yt.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId: video.playlist_id,
              resourceId: { kind: "youtube#video", videoId: youtubeId },
            },
          },
        });
      } catch { /* non-fatal */ }
    }

    await supabase
      .from("ytscheduler_videos")
      .update({
        youtube_id: youtubeId,
        status: 'published',
        published_at: new Date().toISOString(),
        upload_progress: 1.0,
      })
      .eq("id", videoId);

    await logActivity({
      action: "video.published",
      post_id: String(videoId),
      user_id: userId,
      metadata: { youtube_id: youtubeId, title: video.title },
    });
  } catch (err: any) {
    const rawMessage = err.message || "Upload error";
    const msg = String(rawMessage).toLowerCase();
    const isAuthError =
      msg.includes("invalid credentials") ||
      msg.includes("oauth") ||
      msg.includes("unauthorized") ||
      msg.includes("token");

    // RECOVERY: If it's an auth error, try to fetch FRESH token from DB and retry ONCE
    const isRetry = (videoId as any)._isRetry;
    if (isAuthError && !isRetry) {
      console.log(`[Upload] Auth error detected for video ${videoId}. Attempting fresh token recovery...`);
      const { data: freshToken } = await supabase
        .from("ytscheduler_oauth_tokens")
        .select("token_data")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (freshToken?.token_data) {
        // Mark as retry and call again
        const retryId = videoId;
        (retryId as any)._isRetry = true;
        return doUpload(retryId, freshToken.token_data, userId);
      }
    }

    const message = isAuthError
      ? "YouTube auth expired. Please reconnect your channel or try 'Retry' in a few moments."
      : rawMessage;

    await supabase
      .from("ytscheduler_videos")
      .update({ status: 'failed', error_message: message })
      .eq("id", videoId);

    await logActivity({
      action: "video.upload_failed",
      post_id: String(videoId),
      user_id: userId,
      metadata: { error: message },
    });
  }
}
