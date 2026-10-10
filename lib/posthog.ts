// Project tokens are public (every browser receives them); this is not a secret.
export const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "phc_Bwxvfymd27EgjoDmCa6qoaoKeFxZa8zrLgbXwZBnaD8R";
// Ad blockers drop requests to the PostHog domains, so browsers send to this first-party path and
// worker/index.ts forwards it. The server reports errors to POSTHOG_API_HOST directly.
export const POSTHOG_PROXY_PATH = "/relay";
export const POSTHOG_API_HOST = "us.i.posthog.com";
export const POSTHOG_ASSET_HOST = "us-assets.i.posthog.com";
