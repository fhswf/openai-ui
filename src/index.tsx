import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { Provider } from "./components/ui/provider";
import "./i18n/config.ts";

const root = createRoot(document.getElementById("app"));

root.render(
  <StrictMode>
    <Provider>
      <ChatApp />
    </Provider>
  </StrictMode>
);
