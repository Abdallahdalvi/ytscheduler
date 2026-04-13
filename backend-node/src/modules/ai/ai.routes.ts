import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { getAIConfig } from "./ai.config.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export const aiRouter = Router();

const baseSchema = z.object({
  topic: z.string().min(2).max(300),
  keywords: z.array(z.string()).default([]),
  audience: z.string().optional().default("general"),
});

const seoSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  keyword: z.string().optional().default(""),
});

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

function scoreSeo(input: z.infer<typeof seoSchema>) {
  const title = input.title.trim();
  const desc = input.description.trim();
  const tags = uniqueStrings(input.tags);
  const keyword = input.keyword.trim().toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (title.length >= 40 && title.length <= 70) {
    score += 25;
  } else {
    score += 10;
    reasons.push("Keep title length between 40 and 70 characters");
  }

  if (desc.length >= 120) {
    score += 20;
  } else {
    score += 8;
    reasons.push("Add more description detail (120+ chars)");
  }

  if (tags.length >= 5) {
    score += 20;
  } else {
    score += 8;
    reasons.push("Use at least 5 focused tags");
  }

  if (keyword && title.toLowerCase().includes(keyword)) {
    score += 20;
  } else if (keyword) {
    score += 5;
    reasons.push("Include primary keyword in title");
  }

  if (keyword && desc.toLowerCase().includes(keyword)) {
    score += 15;
  } else if (keyword) {
    score += 5;
    reasons.push("Include primary keyword in description");
  }

  const clamped = Math.max(0, Math.min(100, score));
  let strength: "weak" | "good" | "strong" = "weak";
  if (clamped >= 75) strength = "strong";
  else if (clamped >= 50) strength = "good";

  return { score: clamped, strength, reasons };
}

aiRouter.post("/title", (req, res) => {
  const input = baseSchema.parse(req.body);
  const tags = input.keywords.length ? ` | ${input.keywords.slice(0, 2).join(" + ")}` : "";
  const title = `${input.topic} - Practical Guide${tags}`.slice(0, 100);
  res.json(ok({ title }));
});

aiRouter.post("/description", (req, res) => {
  const input = baseSchema.parse(req.body);
  const keywordLine = input.keywords.length ? `Keywords: ${input.keywords.join(", ")}.` : "";
  const description = `In this video, we break down ${input.topic} for ${input.audience} viewers with clear steps, examples, and actionable insights. ${keywordLine} Watch till the end for implementation tips and common mistakes to avoid.`;
  res.json(ok({ description }));
});

aiRouter.post("/tags", (req, res) => {
  const input = baseSchema.parse(req.body);
  const generated = uniqueStrings([
    ...input.keywords,
    input.topic,
    `${input.topic} tutorial`,
    `${input.topic} tips`,
    `${input.topic} 2026`,
  ]).slice(0, 12);

  res.json(ok({ tags: generated }));
});

aiRouter.post("/thumbnail-text", (req, res) => {
  const input = baseSchema.parse(req.body);
  const ideas = [
    `${input.topic}: Start Here`,
    `${input.topic} in 10 Minutes`,
    `Stop Doing ${input.topic} Wrong`,
    `${input.topic} Blueprint 2026`,
  ];

  res.json(ok({ ideas }));
});

aiRouter.post("/seo-score", (req, res) => {
  const input = seoSchema.parse(req.body);
  const result = scoreSeo(input);
  res.json(ok(result));
});

// ─── /caption (DEEP STRATEGIC AUDIT MODE + URL SCRAPER) ───────────────────────
aiRouter.post("/caption", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { title = "", prompt = "", tone = "casual", extra_context = "" } = req.body || {};
  const userPrompt = String(prompt || title || "").trim();

  if (!userPrompt) {
    return res.status(400).json({ error: { message: "Missing prompt." } });
  }

  const { key: openrouterKey, model: aiModel } = await getAIConfig(userId);

  // URL DETECTION & SCRAPING ENGINE
  let sourceData = "";
  const urlMatch = userPrompt.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    try {
      const response = await fetch(urlMatch[0]);
      if (response.ok) {
        const html = await response.text();
        const articleTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
        // Basic body extraction to avoid bloat
        const bodyText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                             .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                             .replace(/<[^>]+>/g, " ")
                             .replace(/\s+/g, " ")
                             .substring(0, 5000); 
        sourceData = `### SCIENTIFIC SOURCE DATA (FROM LINK):\nTitle: ${articleTitle}\nContent: ${bodyText}`;
      }
    } catch (e) {
      console.error("Scraper Error:", e);
    }
  }

  try {
    const promptText = `### MISSION CRITICAL: DEEP CONTENT STRATEGY AUDIT
You are a Lead SEO Strategist and Fact-Checker. 

TOPIC: ${userPrompt}
TONE: ${tone}
CONTEXT: ${extra_context}

${sourceData ? sourceData : "RESEARCH MODE: Activate internal knowledge for this topic."}

MISSION:
1. EXTRACT ALL KEY DETAILS (Date, Time, Specific Locations, BMC/Official quotes, and Facts).
2. LEAD the description with the most critical breaking news facts.
3. Ensure the description is rich, professional, and high-retention.

RETURN VALID JSON:
{
  "description": "EXTREMELY DETAILED description with all facts extracted",
  "tags": ["keyword1", "keyword2", "..."],
  "hashtags": ["#tag1", "#tag2", "..."],
  "suggested_titles": ["Fact-Rich Title 1", "Fact-Rich Title 2", "Viral High-CTR Title 3"],
  "seo_score": 98
}
Be 100% DETERMINISTIC. No conversational text.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0,
        seed: 42,
        messages: [{ role: "user", content: promptText }],
        response_format: { type: "json_object" }
      }),
    });

    const rawBody = await response.text();
    let data: {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } = {};

    try {
      data = JSON.parse(rawBody) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        rawBody?.slice(0, 300) ||
        "OpenRouter request failed";
      return res.status(502).json({ error: { message } });
    }

    let text = data?.choices?.[0]?.message?.content?.trim() || rawBody?.trim() || "";
    text = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    if (!text) {
      return res.status(502).json({ error: { message: "OpenRouter returned an empty response." } });
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonCandidate = start !== -1 && end !== -1 ? text.slice(start, end + 1) : "";

    let parsed: Record<string, unknown> = {};
    if (jsonCandidate) {
      try {
        parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }

    const description = String(parsed.description || text || userPrompt).trim();
    const tags = uniqueStrings(
      Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t))
        : userPrompt.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 8),
    );
    const hashtags = uniqueStrings(
      Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((h) => String(h).startsWith("#") ? String(h) : `#${String(h)}`)
        : tags.slice(0, 6).map((t) => `#${t.replace(/\s+/g, "")}`),
    );
    const suggestedTitles = Array.isArray(parsed.suggested_titles)
      ? parsed.suggested_titles.map((s) => String(s)).filter(Boolean).slice(0, 3)
      : [
          `${title || userPrompt} - Complete Guide`,
          `How to ${title || userPrompt} (Step by Step)`,
          `${title || userPrompt}: Key Insights`,
        ];
    const rawSeo = Number(parsed.seo_score ?? 78);
    const seoScore = Number.isFinite(rawSeo) ? Math.max(0, Math.min(100, Math.round(rawSeo))) : 78;

    return res.json(ok({
      description,
      tags,
      hashtags,
      suggested_titles: suggestedTitles,
      seo_score: seoScore,
      source: "openrouter",
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI caption generation failed";
    return res.status(502).json({ error: { message } });
  }
});
