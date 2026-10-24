import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { Provider } from "./components/ui/provider";
import * as Sentry from "@sentry/react";
import { installUnauthorizedFetchRedirect } from "./chat/utils/loginRetry";
import { chatVault, VaultError } from "./chat/service/chatVault";
import "./i18n/config.ts";

installUnauthorizedFetchRedirect();

void chatVault.getMyKey().catch((error) => {
  if (
    error instanceof VaultError &&
    (error.status === 401 || error.status === 404)
  ) {
    return;
  }
  console.error("Could not check encrypted chat authentication:", error);
});

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
