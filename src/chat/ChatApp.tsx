import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback";
import { ChatProvider } from "./context";
import { AppsProvider } from "./apps/context";
import { ProgressCircle } from "@chakra-ui/react";

import "./style.less";
const Chat = React.lazy(() => import("./Chat"));
const TestPage = React.lazy(() => import("../TestPage"));

export default function ChatApp() {
  const loading = <ProgressCircle.Root size="lg" color="blue.400" />;
  const isTest = new URLSearchParams(window.location.search).get("test") === "true";

  return (
    <Suspense fallback={loading}>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <ChatProvider>
          <AppsProvider>
            {isTest ? <TestPage /> : <Chat />}
          </AppsProvider>
        </ChatProvider>
      </ErrorBoundary>
    </Suspense>
  );
}
