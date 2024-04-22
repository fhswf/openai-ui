import React from "react";
import { useGlobal } from "./context";
import { AssistantOptions } from "./AssistantOptions";
import { ChatOptions } from "./ChatOptions";

/** Main Config component */
export const Config = () => {
    const { currentEditor } = useGlobal();

    console.log("Current Editor:", currentEditor);

    switch (currentEditor?.type) {
        case "assistant":
            return <AssistantOptions assistant={currentEditor.assistant} />;
        default:
            return <ChatOptions />;
    }

};