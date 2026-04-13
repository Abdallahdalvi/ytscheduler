import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export const analyticsRouter = Router();

const rangeSchema = z.enum(["7d", "28d", "90d"]).default("28d");

function daysFromRange(range: string) {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 28;
}

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /analytics/overview
analyticsRouter.get("/overview", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const range = rangeSchema.parse(req.query.range || "28d");
    const fromDate = dateDaysAgo(daysFromRange(range));
    const since = fromDate.toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("ytscheduler_analytics_daily")
      .select("views, watch_time_minutes, subscriber_change, ctr")
      .eq("user_id", userId)
      .gte("date", since);

    if (error) return res.status(500).json({ error: error.message });

    const totalViews = (rows || []).reduce((acc, r) => acc + Number(r.views || 0), 0);
    const totalWatch = (rows || []).reduce((acc, r) => acc + Number(r.watch_time_minutes || 0), 0);
    const totalSubs = (rows || []).reduce((acc, r) => acc + Number(r.subscriber_change || 0), 0);
    const ctrRows = (rows || []).filter((r) => r.ctr != null);
    const avgCtr = ctrRows.length ? ctrRows.reduce((acc, r) => acc + Number(r.ctr || 0), 0) / ctrRows.length : 0;

    return res.json(
      ok({
        range,
        total_views: totalViews,
        average_views: rows?.length ? totalViews / rows.length : 0,
        watch_time: totalWatch,
        subscriber_change: totalSubs,
        ctr: Number(avgCtr.toFixed(3)),
      }),
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /analytics/views-over-time
analyticsRouter.get("/views-over-time", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const range = rangeSchema.parse(req.query.range || "28d");
    const fromDate = dateDaysAgo(daysFromRange(range));
    const since = fromDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("ytscheduler_analytics_daily")
      .select("date, views, watch_time_minutes")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(ok(data || []));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /analytics/top-worst
analyticsRouter.get("/top-worst", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const range = rangeSchema.parse(req.query.range || "28d");
    const fromDate = dateDaysAgo(daysFromRange(range));
    const since = fromDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("ytscheduler_analytics_daily")
      .select("post_id, views, watch_time_minutes, ctr, ytscheduler_videos(title, status)")
      .eq("user_id", userId)
      .gte("date", since)
      .not("post_id", "is", null);

    if (error) return res.status(500).json({ error: error.message });

    const grouped = new Map<string, { id: string; title: string; status: string; views: number; watch_time_minutes: number; ctr_sum: number; ctr_count: number }>();

    for (const row of data || []) {
      const id = String(row.post_id);
      const postRef: any = Array.isArray(row.ytscheduler_videos) ? row.ytscheduler_videos[0] : row.ytscheduler_videos;
      if (!grouped.has(id)) {
        grouped.set(id, {
          id,
          title: postRef?.title || "Untitled",
          status: postRef?.status || "draft",
          views: 0,
          watch_time_minutes: 0,
          ctr_sum: 0,
          ctr_count: 0,
        });
      }

      const item = grouped.get(id)!;
      item.views += Number(row.views || 0);
      item.watch_time_minutes += Number(row.watch_time_minutes || 0);
      if (row.ctr != null) {
        item.ctr_sum += Number(row.ctr);
        item.ctr_count += 1;
      }
    }

    const scored = Array.from(grouped.values()).map((g) => {
      const ctr = g.ctr_count ? g.ctr_sum / g.ctr_count : null;
      const score = g.views * 0.6 + g.watch_time_minutes * 0.3 + (ctr || 0) * 10;
      return { ...g, ctr, score: Number(score.toFixed(2)) };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    const topIds = new Set(top.map((t) => t.id));
    const worst = [...scored].reverse().filter((p) => !topIds.has(p.id)).slice(0, 5);

    return res.json(ok({ top, worst }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /analytics/videos/:id
analyticsRouter.get("/videos/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data, error } = await supabase
      .from("ytscheduler_analytics_daily")
      .select("date, views, watch_time_minutes, ctr")
      .eq("user_id", userId)
      .eq("post_id", req.params.id)
      .order("date", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const views = rows.reduce((acc, r) => acc + Number(r.views || 0), 0);
    const watch = rows.reduce((acc, r) => acc + Number(r.watch_time_minutes || 0), 0);
    const ctrRows = rows.filter((r) => r.ctr != null);
    const ctr = ctrRows.length ? ctrRows.reduce((acc, r) => acc + Number(r.ctr || 0), 0) / ctrRows.length : null;

    return res.json(ok({ post_id: req.params.id, views, watch_time_minutes: watch, ctr, points: rows }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /analytics/metrics (Compatibility)
analyticsRouter.get("/metrics", (_req, res) => {
  res.json(ok({ total_views: 0, average_views: 0, watch_time: 0, subscriber_change: 0, ctr: 0 }));
});

