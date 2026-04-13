import { Router } from "express";
import {
  bulkDeletePostsHandler,
  bulkReschedulePostsHandler,
  createPostHandler,
  deletePostHandler,
  duplicatePostHandler,
  getPostHandler,
  listPostsHandler,
  updatePostHandler,
  updatePostStatusHandler,
} from "./posts.controller.js";

export const postsRouter = Router();

postsRouter.get("/", listPostsHandler);
postsRouter.post("/", createPostHandler);
postsRouter.post("/bulk/delete", bulkDeletePostsHandler);
postsRouter.post("/bulk/reschedule", bulkReschedulePostsHandler);
postsRouter.get("/:id", getPostHandler);
postsRouter.patch("/:id", updatePostHandler);
postsRouter.post("/:id/status", updatePostStatusHandler);
postsRouter.delete("/:id", deletePostHandler);
postsRouter.post("/:id/duplicate", duplicatePostHandler);
