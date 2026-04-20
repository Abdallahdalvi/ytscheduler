import { Router } from "express";
import { ok } from "../../lib/http.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { supabase } from "../../lib/supabase-client.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// @ts-ignore
import { runReportingJob } from "../../engine/reporting-orchestrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const reportingRouter = Router();

// In-memory job store for logs
const jobStore: Record<string, { logs: any[] }> = {};

/**
 * GET /api/reporting
 */
reportingRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const channelId = req.headers["x-channel-id"] as string;
  if (!channelId) return res.status(400).json({ error: "Missing x-channel-id header" });

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok({ reports: data }));
});

/**
 * GET /api/reporting/settings
 */
reportingRouter.get("/settings", async (req: AuthenticatedRequest, res) => {
  const channelId = req.headers["x-channel-id"] as string;
  if (!channelId) return res.status(400).json({ error: "Missing x-channel-id header" });

  const { data, error } = await supabase
    .from("channels")
    .select("auto_reporting, reporting_type")
    .eq("id", channelId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok({ 
    autoReporting: data?.auto_reporting, 
    reportType: data?.reporting_type 
  }));
});

/**
 * POST /api/reporting/settings
 */
reportingRouter.post("/settings", async (req: AuthenticatedRequest, res) => {
  const channelId = req.headers["x-channel-id"] as string;
  const { autoReporting, reportType } = req.body;
  if (!channelId) return res.status(400).json({ error: "Missing x-channel-id header" });

  const { error } = await supabase
    .from("channels")
    .update({ 
       auto_reporting: autoReporting, 
       reporting_type: reportType 
    })
    .eq("id", channelId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok({ success: true }));
});

/**
 * GET /api/reporting/genspark/status
 */
reportingRouter.get("/genspark/status", async (req, res) => {
  const sessionPath = path.join(__dirname, "../../../.genspark-session");
  const exists = fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;
  res.json({ connected: exists });
});

/**
 * POST /api/reporting/genspark/connect
 */
reportingRouter.post("/genspark/connect", async (req, res) => {
  const sessionDir = path.join(__dirname, "../../../.genspark-session");
  const url = "https://www.genspark.ai";
  
  res.json({ ok: true, msg: "Opening GenSpark connect browser..." });

  // Move this logic to a helper for production, but mirroring server.js here
  (async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", "--disable-infobars", "--no-sandbox", "--start-maximized"],
      viewport: null,
    });
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto(url);
  })();
});

/**
 * POST /api/reporting/generate
 */
reportingRouter.post("/generate", async (req: AuthenticatedRequest, res) => {
  const channelId = req.headers["x-channel-id"] as string;
  const { reportType, startDate, endDate } = req.body;
  
  if (!channelId) return res.status(400).json({ error: "Missing x-channel-id" });

  const jobId = Math.random().toString(36).substring(2, 10);
  jobStore[jobId] = { logs: [] };

  const emitLog = (msg: string, type = "info") => {
    jobStore[jobId].logs.push({ message: msg, type, timestamp: new Date() });
    console.log(`[Job:${jobId}] ${msg}`);
  };

  res.json({ ok: true, jobId });

  (async () => {
    try {
      // 1. Fetch channel info and tokens
      const { data: channel } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single();

      if (!channel?.oauth_tokens_json) throw new Error("No YouTube tokens found for this channel.");

      const result = await runReportingJob({
        channelId: channel.channel_external_id,
        oauthToken: channel.oauth_tokens_json,
        startDate,
        endDate,
        reportType,
        jobId,
        emitLog
      });

      // 2. Save complete report to DB
      await supabase.from("reports").insert({
        channel_id: channelId,
        report_type: reportType,
        period_start: startDate,
        period_end: endDate,
        status: "done",
        presentation_url: result.shareLink,
        csv_folder: `csv-${jobId}`
      });

      emitLog("🎉 All done! Your report is ready.", "done");
    } catch (err: any) {
      emitLog(`❌ Error: ${err.message}`, "error");
      await supabase.from("reports").insert({
        channel_id: channelId,
        report_type: reportType,
        period_start: startDate,
        period_end: endDate,
        status: "failed",
        error_message: err.message
      });
    }
  })();
});

/**
 * GET /api/reporting/logs/:jobId (SSE)
 */
reportingRouter.get("/logs/:jobId", (req, res) => {
  const { jobId } = req.params;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const job = jobStore[jobId];
  if (job) job.logs.forEach(msg => send(msg));

  let lastIndex = job?.logs.length || 0;
  const timer = setInterval(() => {
    const currentJob = jobStore[jobId];
    if (currentJob && currentJob.logs.length > lastIndex) {
      currentJob.logs.slice(lastIndex).forEach(msg => {
        send(msg);
        if (msg.type === "done" || msg.type === "error") {
          clearInterval(timer);
          res.end();
        }
      });
      lastIndex = currentJob.logs.length;
    }
  }, 1000);

  req.on("close", () => clearInterval(timer));
});
