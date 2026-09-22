import { isAdminRequest } from "@/lib/admin-auth";
import { deletePost, updatePost } from "@/lib/posts";

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = cleanInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "Title, slug, and content are required." }, { status: 400 });
  const { id } = await context.params;
  try {
    const post = await updatePost(Number(id), input);
    return post ? Response.json({ post }) : Response.json({ error: "Post not found." }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update post." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deletePost(Number(id));
  return deleted ? Response.json({ ok: true }) : Response.json({ error: "Post not found." }, { status: 404 });
}
