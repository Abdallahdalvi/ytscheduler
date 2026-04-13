import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export const notificationsRouter = Router();

const createSchema = z.object({
  type: z.string().min(1).default("system"),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  delivery: z.enum(["in_app", "email"]).default("in_app"),
  status: z.enum(["unread", "read"]).default("unread"),
  channel_id: z.string().optional().nullable(),
});

notificationsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: rows, error } = await supabase
    .from("ytscheduler_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok(rows || []));
});

notificationsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const payload = createSchema.parse(req.body);
  const { data: row, error } = await supabase
    .from("ytscheduler_notifications")
    .insert({
      ...payload,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(ok(row));
});

notificationsRouter.patch("/read-all", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("ytscheduler_notifications")
    .update({ status: "read" })
    .eq("user_id", userId)
    .eq("status", "unread");

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok({ success: true }));
});

notificationsRouter.patch("/:id/read", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: row, error } = await supabase
    .from("ytscheduler_notifications")
    .update({ status: "read" })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok(row));
});

notificationsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("ytscheduler_notifications")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
