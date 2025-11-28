import React from "react";
import { useGlobal } from "./context";
import { ChatOptions } from "./ChatOptions";

/** Main Config component */
export const Config = () => {
  const { currentEditor } = useGlobal();

  console.log("Current Editor:", currentEditor);
  return <ChatOptions />;
};
