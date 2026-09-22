import { POSTHOG_HOST, POSTHOG_TOKEN } from "@/lib/posthog";

type RequestInfo = { path: string; method: string; headers: Record<string, string | string[] | undefined> };

// Links a server error to the visitor's browser session when the PostHog cookie is present.
function browserDistinctId(headers: RequestInfo["headers"]) {
  const cookie = [headers.cookie].flat().join("; ");
  const raw = cookie.match(new RegExp(`ph_${POSTHOG_TOKEN}_posthog=([^;]+)`))?.[1];
  try {
    return raw ? (JSON.parse(decodeURIComponent(raw)).distinct_id as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

export async function onRequestError(error: unknown, request: RequestInfo) {
  if (!POSTHOG_TOKEN) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const distinctId = browserDistinctId(request.headers);
  await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_TOKEN,
      event: "$exception",
      distinct_id: distinctId ?? crypto.randomUUID(),
      properties: {
        $exception_list: [{ type: err.name, value: err.message, mechanism: { handled: false, synthetic: false } }],
        $current_url: request.path,
        $request_method: request.method,
        $process_person_profile: Boolean(distinctId),
        stack: err.stack,
        runtime: "cloudflare-worker",
      },
    }),
  }).catch(() => {});
}
