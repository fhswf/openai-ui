import React from "react";
import * as ReactDOMClient from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { Provider } from "./components/ui/provider"
import { defaultSystem } from "@chakra-ui/react"
import "./i18n/config.ts";

const root = ReactDOMClient.createRoot(document.getElementById("app"));


root.render(
  <React.StrictMode>
    <Provider>
      <ChatApp />
    </Provider>
  </React.StrictMode>
);
