import { Router } from "express";
import { ok } from "../../lib/http.js";
import { z } from "zod";
import db, { now, makeId } from "../../lib/db.js";
import { findPosts, patchPost } from "../posts/posts.repo.js";
import { logActivity } from "../activity/activity.service.js";

export const schedulerRouter = Router();

const createRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  time_local: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(2).default("UTC"),
  active: z.boolean().default(true),
  channel_id: z.string().optional().nullable(),
});

const autoFillSchema = z.object({
  count: z.number().int().min(1).max(100).default(10),
});

function nextWeekdayDate(base: Date, weekday: number) {
  const d = new Date(base);
  const diff = (weekday + 7 - d.getDay()) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function combineDateTime(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

schedulerRouter.get("/calendar", async (_req, res) => {
  const posts = await findPosts();
  const items = posts.filter((p: any) => p.scheduled_at).map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    scheduled_at: p.scheduled_at,
    thumbnail_url: p.thumbnail_url,
  }));
  res.json(ok(items));
});

schedulerRouter.get("/rules", (_req, res) => {
  const rows = db.prepare("SELECT * FROM scheduler_rules ORDER BY created_at DESC").all();
  res.json(ok(rows.map(r => ({
    ...r as any,
    active: Boolean((r as any).active)
  }))));
});

schedulerRouter.post("/rules", (req, res) => {
  const payload = createRuleSchema.parse(req.body);
  const id = makeId();
  const created = now();
  
  db.prepare(`
    INSERT INTO scheduler_rules (id, weekday, time_local, timezone, active, channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.weekday, payload.time_local, payload.timezone, payload.active ? 1 : 0, payload.channel_id, created);

  const row = db.prepare("SELECT * FROM scheduler_rules WHERE id = ?").get(id);
  res.status(201).json(ok({
    ...row as any,
    active: Boolean((row as any).active)
  }));
});

schedulerRouter.delete("/rules/:id", (req, res) => {
  db.prepare("DELETE FROM scheduler_rules WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

schedulerRouter.post("/queue/autofill", async (req, res) => {
  const payload = autoFillSchema.parse(req.body || {});
  const rules = db.prepare("SELECT * FROM scheduler_rules WHERE active = 1").all() as any[];
  
  if (!rules.length) {
    return res.json(ok({ queued: 0, message: "No active rules found" }));
  }

  const posts = await findPosts();
  const drafts = posts.filter((p: any) => p.status === "draft" && !p.scheduled_at).slice(0, payload.count);
  let queued = 0;

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    const rule = rules[i % rules.length];
    const base = new Date();
    const slotDate = nextWeekdayDate(base, Number(rule.weekday));
    slotDate.setDate(slotDate.getDate() + Math.floor(i / rules.length) * 7);
    const scheduled = combineDateTime(slotDate, String(rule.time_local));

    const updated = await patchPost(String(draft.id), {
      status: "scheduled",
      scheduled_at: scheduled.toISOString(),
    });

    await logActivity({
      action: "post.autofilled",
      post_id: String(updated.id),
      metadata: { rule_id: rule.id, scheduled_at: updated.scheduled_at },
    });
    queued += 1;
  }

  res.json(ok({ queued }));
});
