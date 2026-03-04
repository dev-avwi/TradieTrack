import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackEvent } from "@/lib/analytics";

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
