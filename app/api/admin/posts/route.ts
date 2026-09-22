import { isAdminRequest } from "@/lib/admin-auth";
import { createPost, listPosts } from "@/lib/posts";

function cleanInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const title = String(input.title ?? "").trim();
  const slug = String(input.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const excerpt = String(input.excerpt ?? "").trim();
  const imageUrl = String(input.imageUrl ?? "").trim();
  const content = String(input.content ?? "").trim();
  const status = input.status === "published" ? "published" : "draft";
  if (!title || !slug || !content) return null;
  return { title, slug, excerpt, imageUrl, content, status } as const;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ posts: await listPosts(true) });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = cleanInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "Title, slug, and content are required." }, { status: 400 });
  try {
    return Response.json({ post: await createPost(input) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create post." }, { status: 400 });
  }
}
