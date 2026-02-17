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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL || '/'}sw.js`;
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New content available, refresh to update');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
