import { Request, Response } from "express";
import { ok } from "../../lib/http.js";
import {
  bulkDeleteSchema,
  bulkRescheduleSchema,
  createPostSchema,
  listPostsQuerySchema,
  updatePostSchema,
  updatePostStatusSchema,
} from "./posts.schema.js";
import {
  bulkDeletePosts,
  bulkReschedulePosts,
  createPost,
  deletePost,
  duplicatePost,
  getPost,
  listPosts,
  updatePost,
  updatePostStatus,
} from "./posts.service.js";

export async function createPostHandler(req: Request, res: Response) {
  const payload = createPostSchema.parse(req.body);
  const data = await createPost(payload);
  res.status(201).json(ok(data));
}

export async function listPostsHandler(req: Request, res: Response) {
  const query = listPostsQuerySchema.parse(req.query);
  const data = await listPosts(query);
  res.json(ok(data));
}

export async function getPostHandler(req: Request, res: Response) {
  const data = await getPost(req.params.id);
  res.json(ok(data));
}

export async function updatePostHandler(req: Request, res: Response) {
  const payload = updatePostSchema.parse(req.body);
  const data = await updatePost(req.params.id, payload);
  res.json(ok(data));
}

export async function updatePostStatusHandler(req: Request, res: Response) {
  const payload = updatePostStatusSchema.parse(req.body);
  const data = await updatePostStatus(req.params.id, payload);
  res.json(ok(data));
}

export async function deletePostHandler(req: Request, res: Response) {
  await deletePost(req.params.id);
  res.status(204).send();
}

export async function duplicatePostHandler(req: Request, res: Response) {
  const data = await duplicatePost(req.params.id);
  res.status(201).json(ok(data));
}

export async function bulkDeletePostsHandler(req: Request, res: Response) {
  const payload = bulkDeleteSchema.parse(req.body);
  const data = await bulkDeletePosts(payload);
  res.json(ok(data));
}

export async function bulkReschedulePostsHandler(req: Request, res: Response) {
  const payload = bulkRescheduleSchema.parse(req.body);
  const data = await bulkReschedulePosts(payload);
  res.json(ok(data));
}
