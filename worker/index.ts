import handler from "vinext/server/fetch-handler";
import { POSTHOG_API_HOST, POSTHOG_ASSET_HOST, POSTHOG_PROXY_PATH } from "../lib/posthog";

export * from "vinext/server/fetch-handler";

type Env = { CF_VERSION_METADATA?: { id: string } };

// Page renders cost 60-700ms CPU (markdown + KaTeX), which trips Error 1102 on the Workers CPU limit.
// Content only changes on deploy, so cache each render at the edge, keyed by Worker version.
// ponytail: /admin and /api/admin skip the cache; if public pages ever become per-user, key on the session too.
const EDGE_TTL_SECONDS = 60 * 60 * 24;
const UNCACHED = /^\/(api\/admin|admin|signin|signout)/;
const ROUTER_HEADER = /^(rsc|next-|x-vinext-)/;

// The zone's Browser Cache TTL (4h) rewrites a low max-age upward, so browsers would keep a page from
// the previous deploy and hard-reload on the next click. It leaves no-cache alone: the edge copy stays,
// browsers always ask again.
function forBrowser(response: Response) {
  const out = new Response(response.body, response);
  out.headers.set("Cache-Control", "no-cache");
  return out;
}

// SDK assets and remote config live on the asset host; events, recordings and flags go to the API host.
function proxyPostHog(request: Request, url: URL) {
  const path = url.pathname.slice(POSTHOG_PROXY_PATH.length);
  const host = /^\/(static|array)\//.test(path) ? POSTHOG_ASSET_HOST : POSTHOG_API_HOST;
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  // PostHog reads the visitor's country from this; without it every event geolocates to the edge.
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  return fetch(`https://${host}${path}${url.search}`, { method: request.method, headers, body: request.body });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Before the edge cache: analytics requests are never cached.
    if (url.pathname.startsWith(`${POSTHOG_PROXY_PATH}/`)) return proxyPostHog(request, url);
    if (request.method !== "GET" || UNCACHED.test(url.pathname)) return handler.fetch(request, env, ctx);

    // Router headers change the payload (HTML vs RSC, prefetch vs full), so they are part of the key.
    const key = new URL(url);
    key.searchParams.set("__v", env.CF_VERSION_METADATA?.id ?? "local");
    for (const [name, value] of request.headers) if (ROUTER_HEADER.test(name)) key.searchParams.set(`__h_${name}`, value);

    // The DOM CacheStorage type (also in scope here) hides Workers' caches.default.
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(key.toString());
    if (hit) return forBrowser(hit);

    const response: Response = await handler.fetch(request, env, ctx);
    if (response.status !== 200 || response.headers.has("set-cookie")) return response;

    const cacheable = new Response(response.body, response);
    // Routes that set their own s-maxage (the GitHub activity API) keep it.
    if (!cacheable.headers.get("Cache-Control")?.includes("s-maxage")) {
      cacheable.headers.set("Cache-Control", `public, s-maxage=${EDGE_TTL_SECONDS}`);
    }
    ctx.waitUntil(cache.put(key.toString(), cacheable.clone()));
    return forBrowser(cacheable);
  },
};

export default worker;
