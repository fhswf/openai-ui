import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { Provider } from "./components/ui/provider";
import * as Sentry from "@sentry/react";
import { installUnauthorizedFetchRedirect } from "./chat/utils/loginRetry";
import "./i18n/config.ts";

installUnauthorizedFetchRedirect();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch((error) => {
    console.warn("Could not register the K!mpuls share target:", error);
  });
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 1,
  release: import.meta.env.VITE_RELEASE,
});

const root = createRoot(document.getElementById("app"));

root.render(
  <StrictMode>
    <Provider>
      <ChatApp />
    </Provider>
  </StrictMode>
);
