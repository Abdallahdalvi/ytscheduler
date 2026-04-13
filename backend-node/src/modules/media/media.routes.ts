import { Router } from "express";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { z } from "zod";

export const mediaRouter = Router();

mediaRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const type = req.query.type ? String(req.query.type) : null;
  const q = req.query.q ? String(req.query.q).toLowerCase() : "";

  let query = supabase
    .from("ytscheduler_media")
    .select("*")
    .eq("user_id", userId);

  if (type) query = query.eq("type", type);
  if (q) query = query.ilike("public_url", `%${q}%`);

  const { data: rows, error } = await query.order("uploaded_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(ok(rows || []));
});

mediaRouter.post("/upload", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const payload = z.object({
    type: z.enum(["video", "thumbnail"]),
    public_url: z.string().url(),
    storage_path: z.string().default("external"),
    file_size_bytes: z.number().int().nonnegative().optional().nullable(),
    mime_type: z.string().optional().nullable(),
    channel_id: z.string().optional().nullable(),
  }).parse(req.body);

  const { data: row, error } = await supabase
    .from("ytscheduler_media")
    .insert({
      ...payload,
      user_id: userId,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(ok(row));
});

mediaRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("ytscheduler_media")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
