import { google } from "googleapis";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { supabase } from "./supabase-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_SECRET_PATH = path.join(__dirname, "../../../client_secret.json");

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const CATEGORIES: Record<string, string> = {
  "Film & Animation": "1",
  "Autos & Vehicles": "2",
  "Music": "10",
  "Pets & Animals": "15",
  "Sports": "17",
  "Travel & Events": "19",
  "Gaming": "20",
  "People & Blogs": "22",
  "Comedy": "23",
  "Entertainment": "24",
  "News & Politics": "25",
  "Howto & Style": "26",
  "Education": "27",
  "Science & Technology": "28",
  "Nonprofits & Activism": "29",
};

export function hasClientSecret(): boolean {
  return fs.existsSync(CLIENT_SECRET_PATH);
}

function getRedirectUri() {
  return process.env.OAUTH_REDIRECT_URI || "https://ytscheduler.dalvi.cloud/api/auth/callback";
}

export function getOAuthClient() {
  if (!hasClientSecret()) {
    throw new Error(
      "client_secret.json not found. Download it from Google Cloud Console and place it in the project root folder.",
    );
  }
  const secrets = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, "utf-8"));
  const web = secrets.web || secrets.installed;
  const redirectUri = getRedirectUri();
  console.log(`[OAuth] Using redirect URI: ${redirectUri}`);
  return new google.auth.OAuth2(web.client_id, web.client_secret, redirectUri);
}

/**
 * Returns a fully authenticated OAuth2 client with background token persistence.
 * Targeted for a specific userId.
 */
export function getAuthenticatedClient(tokenData: any, userId: string) {
  const client = getOAuthClient();
  const accessToken = tokenData.access_token || tokenData.token;
  const refreshToken = tokenData.refresh_token;

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    scope: tokenData.scope || (tokenData.scopes || YOUTUBE_SCOPES).join(" "),
  });

  // BACKGROUND PERSISTENCE LISTENER
  client.on("tokens", async (newTokens) => {
    console.log(`[OAuth] Token refresh detected for user ${userId}. Persisting...`);
    
    // We fetch the current record first to ensure the JSONB is merged correctly
    const { data: currentToken } = await supabase
      .from("ytscheduler_oauth_tokens")
      .select("token_data")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const updatedTokenData = {
      ...(currentToken?.token_data || tokenData),
      token: newTokens.access_token || (currentToken?.token_data?.access_token || tokenData.access_token),
      access_token: newTokens.access_token || (currentToken?.token_data?.access_token || tokenData.access_token),
      refresh_token: newTokens.refresh_token || (currentToken?.token_data?.refresh_token || tokenData.refresh_token),
      expiry_date: newTokens.expiry_date,
    };

    try {
      await supabase
        .from("ytscheduler_oauth_tokens")
        .update({ token_data: updatedTokenData })
        .eq("user_id", userId)
        .eq("is_active", true);
      console.log(`[OAuth] Successfully persisted refreshed tokens for ${userId} to Supabase.`);
    } catch (err) {
      console.error(`[OAuth] Failed to persist refreshed tokens for ${userId}:`, err);
    }
  });

  return client;
}

export function getYouTubeClient(tokenData: Record<string, unknown>, userId: string) {
  const auth = getAuthenticatedClient(tokenData, userId);
  return google.youtube({ version: "v3", auth });
}

export function getYouTubeClientFromCreds(creds: InstanceType<typeof google.auth.OAuth2>) {
  return google.youtube({ version: "v3", auth: creds });
}
