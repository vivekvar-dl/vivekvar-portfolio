import { isAdminRequest } from "@/lib/admin-auth";
import { cleanEntry, countEntries, createEntry, deleteEntry, listEntries } from "@/lib/guestbook";

const fresh = { "Cache-Control": "no-store" };

export async function GET() {
  const [count, entries] = await Promise.all([countEntries(), listEntries(5)]);
  return Response.json({ count, entries }, { headers: fresh });
}

export async function POST(request: Request) {
  const entry = cleanEntry(await request.json().catch(() => null));
  if (!entry) return Response.json({ error: "Add your name, a short message and your signature." }, { status: 400 });
  try {
    const saved = await createEntry(entry, request.headers.get("cf-connecting-ip") ?? "local");
    if (!saved) return Response.json({ error: "You've signed a few times already. Try again in a bit." }, { status: 429 });
    return Response.json({ entry: saved, count: await countEntries() }, { status: 201, headers: fresh });
  } catch (error) {
    console.error("Guestbook signature failed", error);
    return Response.json({ error: "Couldn't save your signature. Try again." }, { status: 500 });
  }
}

// Moderation: the blog admin session can remove an entry.
export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteEntry(Number(new URL(request.url).searchParams.get("id")));
  return deleted ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
}
