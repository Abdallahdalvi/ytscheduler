import { z } from "zod";

export const postStatusSchema = z.enum(["draft", "scheduled", "published", "failed"]);

export const createPostSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  thumbnail_url: z.string().url().optional().nullable(),
  video_url: z.string().url().optional().nullable(),
  status: postStatusSchema.default("draft"),
  scheduled_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

export const updatePostSchema = createPostSchema.partial();

export const updatePostStatusSchema = z.object({
  status: postStatusSchema,
  scheduled_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

export const listPostsQuerySchema = z.object({
  status: postStatusSchema.optional(),
  search: z.string().trim().optional(),
  sort_by: z.enum(["created_at", "scheduled_at", "published_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const bulkRescheduleSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  scheduled_at: z.string().datetime(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type UpdatePostStatusInput = z.infer<typeof updatePostStatusSchema>;
export type ListPostsQueryInput = z.infer<typeof listPostsQuerySchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type BulkRescheduleInput = z.infer<typeof bulkRescheduleSchema>;
