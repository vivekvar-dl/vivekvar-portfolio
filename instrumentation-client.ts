import { POSTHOG_HOST, POSTHOG_TOKEN } from "@/lib/posthog";

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
    }),
  );
}

if (POSTHOG_TOKEN && typeof window !== "undefined") {
  if ("requestIdleCallback" in window) requestIdleCallback(startPostHog, { timeout: 3000 });
  else setTimeout(startPostHog, 1500);
}
