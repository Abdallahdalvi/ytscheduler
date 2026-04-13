import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { listActivities, logActivity } from "./activity.service.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export const activityRouter = Router();

const createActivitySchema = z.object({
  action: z.string().min(1),
  post_id: z.string().optional().nullable(),
  channel_id: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

activityRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const data = await listActivities(userId, limit);
  res.json(ok(data));
});

activityRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const payload = createActivitySchema.parse(req.body || {});
  await logActivity({
    ...payload,
    user_id: userId,
  });
  res.status(201).json(ok({ created: true }));
});
