import { supabase } from "./supabase-client.js";
import { doUpload } from "../modules/videos/videos.service.js";

/**
 * Background worker that checks for scheduled videos across ALL users every minute.
 * Multi-tenant aware: fetches specific user tokens for each upload.
 */

let checkInterval: NodeJS.Timeout | null = null;
let isChecking = false;

async function checkScheduledVideos() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date().toISOString();
    
    // Find videos that are 'scheduled' and due across all users
    const { data: dueVideos, error: fetchError } = await supabase
      .from("ytscheduler_videos")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchError || !dueVideos || dueVideos.length === 0) {
      isChecking = false;
      return;
    }

    console.log(`[Worker] Found ${dueVideos.length} scheduled videos due for upload.`);

    for (const video of dueVideos) {
      try {
        console.log(`[Worker] Processing auto-upload for User ${video.user_id}, Video: ${video.title}`);

        // Fetch the specific OAuth token for this creator
        const { data: token } = await supabase
          .from("ytscheduler_oauth_tokens")
          .select("token_data")
          .eq("user_id", video.user_id)
          .eq("channel_id", video.channel_id)
          .maybeSingle();

        if (!token?.token_data) {
          console.warn(`[Worker] No OAuth token found for user ${video.user_id}. Skipping.`);
          continue;
        }

        // doUpload handles status updates and logging
        await doUpload(video.id, token.token_data, video.user_id);
      } catch (innerErr: any) {
        console.error(`[Worker] Failed task for video ${video.id}:`, innerErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Worker] Error in background scheduler:", err.message);
  } finally {
    isChecking = false;
  }
}

export function startWorker() {
  if (checkInterval) return;
  
  console.log("[Worker] YTScheduler Multi-Tenant Background Worker started.");
  
  // Initial check
  checkScheduledVideos();
  
  // Run every minute
  checkInterval = setInterval(checkScheduledVideos, 60000);
}

export function stopWorker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("[Worker] Background worker stopped.");
  }
}
