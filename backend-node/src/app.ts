import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { ok } from "./lib/http.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { templatesRouter } from "./modules/templates/templates.routes.js";
import { activityRouter } from "./modules/activity/activity.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { channelRouter, youtubeRouter } from "./modules/channel/channel.routes.js";
import { videosRouter } from "./modules/videos/videos.routes.js";
import { scheduleRouter } from "./modules/schedule/schedule.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { reportingRouter } from "./modules/reporting/reporting.routes.js";
import { requireAuth } from "./middleware/auth.js";

import { startWorker } from "./lib/worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json(ok({ status: "ok", service: "yt-manager-node" }));
});

app.get("/api/debug/tables", async (req, res) => {
  const tables = [
    "ytscheduler_oauth_tokens",
    "ytscheduler_videos",
    "ytscheduler_settings",
    "ytscheduler_templates",
    "ytscheduler_schedule_slots",
    "ytscheduler_activity_logs",
    "ytscheduler_notifications",
    "ytscheduler_media",
    "ytscheduler_analytics_daily"
  ];
  
  const results: Record<string, boolean> = {};
  for (const table of tables) {
    const { error } = await (supabase.from(table).select("*").limit(0) as any);
    results[table] = !error;
  }
  
  res.json(ok(results));
});

const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

// Expose uploaded files (videos/thumbnails) for frontend previews.
app.use("/uploads", express.static(UPLOAD_DIR));

// All API routes require Supabase Auth
app.use("/api", requireAuth as any);

// Core Modules (Supabase Migrated)
app.use("/api/media", mediaRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/activity-logs", activityRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/auth", authRouter);
app.use("/api/channel", channelRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/videos", videosRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reporting", reportingRouter);

// Serve frontend in production
if (fs.existsSync(FRONTEND_DIST)) {
  console.log(`[Server] Serving frontend from: ${FRONTEND_DIST}`);
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    }
  });
}

app.use(errorHandler);

const finalPort = Number(process.env.PORT) || env.port;
app.listen(finalPort, () => {
  // eslint-disable-next-line no-console
  console.log(`Node backend running on http://localhost:${finalPort} (serving frontend: ${fs.existsSync(FRONTEND_DIST)})`);
  startWorker();
});
