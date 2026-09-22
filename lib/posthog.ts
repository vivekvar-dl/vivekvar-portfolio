// Project tokens are public (every browser receives them); this is not a secret.
export const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "";
export const POSTHOG_HOST = "https://us.i.posthog.com";
