// Analytics shim. The game is fully client-side and ships no analytics by
// default. If VITE_GA4_ID is set at build time, a minimal GA4 loader runs
// and a single `oo_event` custom event is sent for high-level screen views.
// No personally identifiable data, no stage scores, no audio data, no
// timing data is ever sent. This keeps the privacy surface minimal and
// matches the privacy statement in the README.

const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined) ?? "";

let loaded = false;

export function initAnalytics(): void {
  if (!GA4_ID || loaded || typeof window === "undefined") return;
  loaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);
  // @ts-expect-error gtag is added by the loader
  window.dataLayer = window.dataLayer || [];
  // @ts-expect-error gtag is added by the loader
  window.gtag = function (...args: unknown[]) {
    // @ts-expect-error dataLayer is unknown[]
    window.dataLayer.push(args);
  };
  // @ts-expect-error gtag defined above
  window.gtag("js", new Date());
  // @ts-expect-error gtag defined above
  window.gtag("config", GA4_ID, { anonymize_ip: true });
}

export function trackScreen(name: string): void {
  if (!GA4_ID || typeof window === "undefined") return;
  // @ts-expect-error gtag optional
  if (typeof window.gtag === "function") {
    // @ts-expect-error gtag optional
    window.gtag("event", "oo_screen", { screen: name });
  }
}
