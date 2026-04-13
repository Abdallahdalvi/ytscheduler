import { supabase } from "../../lib/supabase-client.js";
import { CreatePostInput, UpdatePostInput } from "./posts.schema.js";

const TABLE = "ytscheduler_posts";

export async function insertPost(input: CreatePostInput, userId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...input,
      user_id: userId,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

type FindPostsOptions = {
  status?: string;
  search?: string;
  sort_by?: "created_at" | "scheduled_at" | "published_at" | "updated_at";
  order?: "asc" | "desc";
};

export async function findPosts(options: FindPostsOptions = {}, userId: string) {
  const sortBy = options.sort_by || "created_at";
  const order = options.order || "desc";
  
  let query = supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId);

  if (options.status) query = query.eq("status", options.status);
  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
  }

  const { data, error } = await query.order(sortBy, { ascending: order === "asc" });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function findPostById(id: string, userId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  
  if (error) throw new Error(error.message);
  return data;
}

export async function patchPost(id: string, updates: UpdatePostInput, userId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removePost(id: string, userId: string) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
