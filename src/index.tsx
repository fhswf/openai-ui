import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { Provider } from "./components/ui/provider";
import * as Sentry from "@sentry/react";
import "./i18n/config.ts";

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
