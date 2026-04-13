import { Router } from "express";
import { ok } from "../../lib/http.js";
import { supabase } from "../../lib/supabase-client.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { z } from "zod";

export const templatesRouter = Router();

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  title_template: z.string().max(120).optional().nullable(),
  description_template: z.string().max(5000).default(""),
  tags_template: z.array(z.string().min(1)).default([]),
  category_id: z.string().max(8).optional().nullable(),
  privacy: z.enum(["public", "unlisted", "private"]).optional().nullable(),
  playlist_id: z.string().max(120).optional().nullable(),
  auto_schedule: z.boolean().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  ai_prompt: z.string().max(1000).optional().nullable(),
  branding_context: z.string().max(2000).optional().nullable(),
  channel_id: z.string().optional().nullable(),
});

const updateTemplateSchema = createTemplateSchema.partial();

templatesRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: rows, error } = await supabase
    .from("ytscheduler_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // UNPACK SHADOW STORAGE
  const processed = (rows || []).map(row => {
    let branding = row.branding_context || "";
    let prompt = row.ai_prompt || "";
    let desc = row.description_template || "";

    if (desc.startsWith("###PROTOCOL_META###")) {
      try {
        const endIdx = desc.indexOf("###", 19);
        if (endIdx !== -1) {
          const jsonStr = desc.substring(19, endIdx);
          const meta = JSON.parse(jsonStr);
          branding = meta.brand || branding;
          prompt = meta.prompt || prompt;
          desc = desc.substring(endIdx + 4); // Strip meta prefix from visible description
        }
      } catch (e) {
        console.error("Shadow Parse Error:", e);
      }
    }
    return { ...row, branding_context: branding, ai_prompt: prompt, description_template: desc };
  });

  res.json(ok(processed));
});

templatesRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const payload = createTemplateSchema.parse(req.body);
  
  // RESILIENT STORAGE: If the DB hasn't been upgraded, we pack these two into a shadow description
  // This avoids the '500' error while preserving the data.
  const shadowMetadata = {
    brand: payload.branding_context || "",
    prompt: payload.ai_prompt || "",
    original_desc: payload.description_template || ""
  };
  
  const { data: row, error } = await supabase
    .from("ytscheduler_templates")
    .insert({
      ...payload,
      // We still include them in case the column EXISTS, but we also save to description as backup
      description_template: `###PROTOCOL_META###${JSON.stringify(shadowMetadata)}###\n${payload.description_template}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // If it fails specifically because branding_context column is missing, try a fallback insert
    if (error.message.includes("branding_context") || error.message.includes("column")) {
      const fallbackPayload = { ...payload };
      delete (fallbackPayload as any).branding_context;
      delete (fallbackPayload as any).ai_prompt; 

      const { data: fallbackRow, error: fallbackError } = await supabase
        .from("ytscheduler_templates")
        .insert({
          ...fallbackPayload,
          ai_prompt: payload.ai_prompt, // If only one is missing, this might still fail, so we pack both into desc
          description_template: `###PROTOCOL_META###${JSON.stringify(shadowMetadata)}###\n${payload.description_template}`,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (fallbackError) return res.status(500).json({ error: fallbackError.message });
      return res.status(201).json(ok(fallbackRow));
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(ok(row));
});

templatesRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const payload = updateTemplateSchema.parse(req.body);
  const id = req.params.id;

  const shadowMetadata = {
    brand: payload.branding_context || "",
    prompt: payload.ai_prompt || "",
    original_desc: payload.description_template || ""
  };

  const { data: updated, error } = await supabase
    .from("ytscheduler_templates")
    .update({
      ...payload,
      description_template: `###PROTOCOL_META###${JSON.stringify(shadowMetadata)}###\n${payload.description_template || ""}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.message.includes("branding_context") || error.message.includes("column")) {
      const fallbackPayload = { ...payload };
      delete (fallbackPayload as any).branding_context;
      delete (fallbackPayload as any).ai_prompt;

      const { data: fallbackUpdated, error: fallbackError } = await supabase
        .from("ytscheduler_templates")
        .update({
          ...fallbackPayload,
          description_template: `###PROTOCOL_META###${JSON.stringify(shadowMetadata)}###\n${payload.description_template || ""}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      
      if (fallbackError) return res.status(500).json({ error: fallbackError.message });
      return res.json(ok(fallbackUpdated));
    }
    return res.status(500).json({ error: error.message });
  }
  res.json(ok(updated));
});

templatesRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("ytscheduler_templates")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
