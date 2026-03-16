import posthog from "posthog-js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (LOCAL_HOSTS.has(hostname) || !posthogKey || !posthogHost) {
  posthog.opt_out_capturing();
} else {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    ui_host: "https://us.posthog.com",
    // Include the defaults option as required by PostHog
    defaults: "2025-11-30",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Turn on debug in development mode
    debug: process.env.NODE_ENV === "development",
    person_profiles: "always",
  });
}
