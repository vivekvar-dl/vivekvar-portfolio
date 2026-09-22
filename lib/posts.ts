import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { posts } from "@/db/schema";

export type BlogPost = typeof posts.$inferSelect;
export type BlogPostInput = Pick<BlogPost, "slug" | "title" | "excerpt" | "imageUrl" | "content" | "status">;

export async function listPosts(includeDrafts = false): Promise<BlogPost[]> {
  try {
    const db = getDb();
    return includeDrafts
      ? await db.select().from(posts).orderBy(desc(posts.updatedAt))
      : await db.select().from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.updatedAt));
  } catch (error) {
    console.warn("Blog database is not ready yet", error);
    return [];
  }
}

export async function getPostBySlug(slug: string) {
  try {
    const rows = await getDb().select().from(posts).where(eq(posts.slug, slug)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function createPost(input: BlogPostInput) {
  const rows = await getDb().insert(posts).values(input).returning();
  return rows[0];
}

export async function updatePost(id: number, input: BlogPostInput) {
  const rows = await getDb()
    .update(posts)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deletePost(id: number) {
  const rows = await getDb().delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  return rows[0] ?? null;
}
