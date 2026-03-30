import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackEvent } from "@/lib/analytics";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
  });
}

window.addEventListener('error', (event) => {
  trackEvent('js_error', {
    message: event.message?.substring(0, 200),
    source: event.filename?.split('/').pop(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  trackEvent('unhandled_promise_rejection', {
    message: String(event.reason)?.substring(0, 200),
  });
});


createRoot(document.getElementById("root")!).render(<App />);
