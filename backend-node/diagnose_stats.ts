import { supabase } from "./src/lib/supabase-client.js";
import { getYouTubeClient } from "./src/lib/youtube-client.js";
import 'dotenv/config';

async function diagnoseVideoStats() {
  const userId = '7d3f3d12-1ebf-4783-b815-68001b0674cf';
  const { data: tokenEntry } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("user_id, token_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();


  if (!tokenEntry) {
    console.error("No active user found in ytscheduler_oauth_tokens.");
    return;
  }
  
  console.log("Diagnosing for User ID:", userId);

  const yt = getYouTubeClient(tokenEntry.token_data, userId);
  
  // Fetch channel info
  const ch = await yt.channels.list({ part: ["snippet", "contentDetails", "statistics"], mine: true });
  const channel = ch.data.items?.[0];
  
  if (!channel) {
    console.error("No channel found for this user.");
    return;
  }
  
  console.log("Found Channel:", channel.snippet?.title);
  console.log("Channel Statistics:", JSON.stringify(channel.statistics));
  
  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) {
    console.error("Could not find uploads playlist for this channel.");
    return;
  }
  
  console.log("Uploads Playlist ID:", uploadsId);
  
  const items = await yt.playlistItems.list({
    playlistId: uploadsId,
    part: ["snippet"],
    maxResults: 10
  });
  
  const vids = items.data.items?.map(i => i.snippet?.resourceId?.videoId) || [];
  console.log("Recent Video IDs:", vids);
  
  if (vids.length === 0) {
    console.log("No videos found in uploads playlist.");
    return;
  }
  
  const stats = await yt.videos.list({
    id: vids,
    part: ["snippet", "statistics", "status"]
  });
  
  for (const v of stats.data.items || []) {
    console.log(`\n--- Video: ${v.snippet?.title} ---`);
    console.log(`- ID: ${v.id}`);
    console.log(`- Views: ${v.statistics?.viewCount}`);
    console.log(`- Likes: ${v.statistics?.likeCount}`);
    console.log(`- Comments: ${v.statistics?.commentCount}`);
    console.log(`- Privacy: ${v.status?.privacyStatus}`);
    console.log(`- Full Statistics Data:`, JSON.stringify(v.statistics));
    
    if (!('likeCount' in (v.statistics || {}))) {
      console.log(`[!] CRITICAL: likeCount is MISSING from stats for this video.`);
    }
  }
}

diagnoseVideoStats().catch(console.error);
