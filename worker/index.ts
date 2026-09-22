import handler from "vinext/server/fetch-handler";

export * from "vinext/server/fetch-handler";

type Env = { CF_VERSION_METADATA?: { id: string } };

// Page renders cost 60-700ms CPU (markdown + KaTeX), which trips Error 1102 on the Workers CPU limit.
// Content only changes on deploy, so cache each render at the edge, keyed by Worker version.
// ponytail: /admin and /api skip the cache; if public pages ever become per-user, key on the session too.
const EDGE_TTL_SECONDS = 60 * 60 * 24;
const UNCACHED = /^\/(api|admin|signin|signout)/;
const ROUTER_HEADER = /^(rsc|next-|x-vinext-)/;

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" || UNCACHED.test(url.pathname)) return handler.fetch(request, env, ctx);

    // Router headers change the payload (HTML vs RSC, prefetch vs full), so they are part of the key.
    const key = new URL(url);
    key.searchParams.set("__v", env.CF_VERSION_METADATA?.id ?? "local");
    for (const [name, value] of request.headers) if (ROUTER_HEADER.test(name)) key.searchParams.set(`__h_${name}`, value);

    // The DOM CacheStorage type (also in scope here) hides Workers' caches.default.
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(key.toString());
    if (hit) return hit;

    const response: Response = await handler.fetch(request, env, ctx);
    if (response.status !== 200 || response.headers.has("set-cookie")) return response;

    const cacheable = new Response(response.body, response);
    // s-maxage is for the edge; browsers still revalidate so a deploy is visible immediately.
    cacheable.headers.set("Cache-Control", `public, max-age=0, must-revalidate, s-maxage=${EDGE_TTL_SECONDS}`);
    ctx.waitUntil(cache.put(key.toString(), cacheable.clone()));
    return cacheable;
  },
};

export default worker;
