import {
  BulkDeleteInput,
  BulkRescheduleInput,
  CreatePostInput,
  ListPostsQueryInput,
  UpdatePostInput,
  UpdatePostStatusInput,
} from "./posts.schema.js";
import { findPostById, findPosts, insertPost, patchPost, removePost } from "./posts.repo.js";
import { logActivity } from "../activity/activity.service.js";

export async function createPost(input: CreatePostInput) {
  const created = await insertPost(input);
  await logActivity({
    action: "post.created",
    post_id: String(created.id),
    metadata: { title: created.title, status: created.status },
  });
  return created;
}

export async function listPosts(query: ListPostsQueryInput) {
  return findPosts(query);
}

export async function getPost(id: string) {
  return findPostById(id);
}

export async function updatePost(id: string, input: UpdatePostInput) {
  const updated = await patchPost(id, input);
  await logActivity({
    action: "post.updated",
    post_id: id,
    metadata: { changed: Object.keys(input), status: updated.status },
  });
  return updated;
}

export async function updatePostStatus(id: string, input: UpdatePostStatusInput) {
  const updated = await patchPost(id, {
    status: input.status,
    scheduled_at: input.scheduled_at,
    published_at: input.published_at,
  });

  await logActivity({
    action: "post.status.updated",
    post_id: id,
    metadata: {
      status: input.status,
      scheduled_at: input.scheduled_at || null,
      published_at: input.published_at || null,
    },
  });

  return updated;
}

export async function deletePost(id: string) {
  const source = await findPostById(id);
  await removePost(id);
  await logActivity({
    action: "post.deleted",
    post_id: id,
    metadata: { title: source.title },
  });
}

export async function duplicatePost(id: string) {
  const source = await findPostById(id);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...cloneSource } = source;
  const duplicated = await insertPost({
    ...cloneSource,
    title: `${source.title} (Copy)`,
    status: "draft",
    scheduled_at: null,
    published_at: null,
  });
  await logActivity({
    action: "post.duplicated",
    post_id: String(duplicated.id),
    metadata: { source_post_id: id, title: duplicated.title },
  });
  return duplicated;
}

export async function bulkDeletePosts(input: BulkDeleteInput) {
  for (const id of input.ids) {
    const source = await findPostById(id);
    await removePost(id);
    await logActivity({
      action: "post.deleted.bulk",
      post_id: id,
      metadata: { title: source.title },
    });
  }

  return { deleted: input.ids.length };
}

export async function bulkReschedulePosts(input: BulkRescheduleInput) {
  for (const id of input.ids) {
    await patchPost(id, { status: "scheduled", scheduled_at: input.scheduled_at });
    await logActivity({
      action: "post.rescheduled.bulk",
      post_id: id,
      metadata: { scheduled_at: input.scheduled_at },
    });
  }

  return { updated: input.ids.length, scheduled_at: input.scheduled_at };
}
