import { adminCookie, createAdminSession, verifyCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  if (!body?.username || !body.password || !(await verifyCredentials(body.username, body.password))) {
    return Response.json({ error: "That username or password is not valid." }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", adminCookie(await createAdminSession()));
  return response;
}
