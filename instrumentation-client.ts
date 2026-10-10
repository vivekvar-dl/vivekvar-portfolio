import type { CaptureResult } from "posthog-js";
import { POSTHOG_HOST, POSTHOG_TOKEN } from "@/lib/posthog";

type ExceptionFrame = { filename?: string; in_app?: boolean };

// Android in-app browsers (Instagram, Facebook) inject a native bridge served from `iabjs://`.
// Its errors are not from this site's code, and each new bridge function opens a new issue.
function dropInAppBrowserBridgeExceptions(event: CaptureResult | null): CaptureResult | null {
  if (event?.event !== "$exception") return event;
  const frames: ExceptionFrame[] = (event.properties.$exception_list ?? []).flatMap(
    (exception: { stacktrace?: { frames?: ExceptionFrame[] } }) => exception.stacktrace?.frames ?? [],
  );
  const fromBridgeOnly =
    frames.length > 0 && frames.every((frame) => !frame.in_app && frame.filename?.startsWith("iabjs://"));
  return fromBridgeOnly ? null : event;
}

// Loaded after the page is idle so analytics never competes with first paint.
// Session replay, heatmaps and surveys code is fetched on demand only when enabled in PostHog.
function startPostHog() {
  import("posthog-js").then(({ default: posthog }) =>
    posthog.init(POSTHOG_TOKEN, {
      api_host: POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      enable_heatmaps: true,
      capture_dead_clicks: true,
      capture_exceptions: true,
      capture_performance: { web_vitals: true, network_timing: true },
      before_send: dropInAppBrowserBridgeExceptions,
    }),
  );
}

if (POSTHOG_TOKEN && typeof window !== "undefined") {
  if ("requestIdleCallback" in window) requestIdleCallback(startPostHog, { timeout: 3000 });
  else setTimeout(startPostHog, 1500);
}
