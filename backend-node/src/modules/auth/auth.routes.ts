import { Router } from "express";
import { google } from "googleapis";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  hasClientSecret,
  getOAuthClient,
  YOUTUBE_SCOPES,
} from "../../lib/youtube-client.js";

export const authRouter = Router();

authRouter.get("/url", (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!hasClientSecret()) {
    return res.status(503).json({
      error: "client_secret.json not found on server.",
    });
  }
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: YOUTUBE_SCOPES,
      include_granted_scopes: true,
      prompt: "consent",
      state: userId, // Pass userId through stay to link correctly on callback
    });
    return res.json(ok({ url }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

authRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const userId = req.query.state as string; // Retrieve userId from state
  
  if (!code) return res.status(400).send("Missing code");
  if (!userId) return res.status(400).send("Missing state (userId)");

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const yt = google.youtube({ version: "v3", auth: client });
    const ch = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
    const item = ch.data.items?.[0];
    const snippet = item?.snippet;

    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_uri: "https://oauth2.googleapis.com/token",
      scope: tokens.scope || YOUTUBE_SCOPES.join(" "),
      scopes: (tokens.scope || YOUTUBE_SCOPES.join(" ")).split(" "),
    };

    console.log(`[OAuth] Successfully retrieved channel info for ${snippet?.title} (${item?.id})`);

    // Reset all other channels for this user to inactive
    await supabase.from("ytscheduler_oauth_tokens").update({ is_active: false }).eq("user_id", userId);

    const { error } = await supabase
      .from("ytscheduler_oauth_tokens")
      .upsert({
        user_id: userId,
        token_data: tokenData,
        channel_id: item?.id ?? null,
        channel_title: snippet?.title ?? null,
        channel_thumbnail: snippet?.thumbnails?.default?.url ?? null,
        connected_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: "user_id,channel_id" });

    if (error) {
       console.error("[OAuth] Failed to save tokens to database:", error.message);
       throw error;
    }
    console.log(`[OAuth] Success! Tokens saved and set as active for user ${userId}`);

    return res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage("connected", "*");
            window.close();
          </script>
          <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>YTScheduler Successfully Linked!</h2>
            <p>You can close this window now.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    return res.status(500).send(`Auth error: ${err.message}`);
  }
});

authRouter.get("/status", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.token_data) {
    // If no active channel, but user has channels, pick the first one and make it active
    const { data: first } = await supabase
      .from("ytscheduler_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
      
    if (first) {
      await supabase.from("ytscheduler_oauth_tokens").update({ is_active: true }).eq("id", first.id);
      return res.json({
        connected: true,
        channel_title: first.channel_title,
        channel_id: first.channel_id,
        channel_thumbnail: first.channel_thumbnail,
        connected_at: first.connected_at,
      });
    }

    return res.json({ connected: false });
  }

  return res.json({
    connected: true,
    channel_title: data.channel_title,
    channel_id: data.channel_id,
    channel_thumbnail: data.channel_thumbnail,
    connected_at: data.connected_at,
  });
});

authRouter.delete("/disconnect", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  await supabase
    .from("ytscheduler_oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("is_active", true);

  return res.json(ok({ success: true }));
});

authRouter.get("/channels", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase
    .from("ytscheduler_oauth_tokens")
    .select("channel_id, channel_title, channel_thumbnail, is_active, connected_at")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ channels: data || [] }));
});

authRouter.post("/switch", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { channel_id } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!channel_id) return res.status(400).json({ error: "Missing channel_id" });

  await supabase.from("ytscheduler_oauth_tokens").update({ is_active: false }).eq("user_id", userId);
  const { error } = await supabase
    .from("ytscheduler_oauth_tokens")
    .update({ is_active: true })
    .eq("user_id", userId)
    .eq("channel_id", channel_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ok({ success: true }));
});
