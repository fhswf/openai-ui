import React from "react";
import * as ReactDOMClient from "react-dom/client";
import ChatApp from "./chat/ChatApp";
import { ChakraProvider } from '@chakra-ui/react'
import "./i18n/config.ts";

const root = ReactDOMClient.createRoot(document.getElementById("app"));
root.render(
  <React.StrictMode>
    <ChakraProvider>
      <ChatApp />
    </ChakraProvider>
  </React.StrictMode>
);
