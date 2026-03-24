import { initState } from "../context/initState";
import { App, Chat, GlobalState, Message, Options } from "../context/types";
import { toaster } from "../../components/ui/toaster";
import { t } from "i18next";

export const SESSION_KEY = "SESSIONS";
export const CHAT_HISTORY_KEY = "CHAT_HISTORY";

function replacer(key, value) {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else if (value instanceof Set) {
    return {
      dataType: "Set",
      value: Array.from(value), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}

export function reviver(key, value) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value);
    } else if (value.dataType === "Set") {
      return new Set(value.value);
    }
  }
  return value;
}

type PersistedSettings = Record<string, unknown> & {
  currentChat: number;
};

function isQuotaExceededError(error: unknown): error is Error {
  return error instanceof Error && error.name === "QuotaExceededError";
}

function logStorageSizes(settings: PersistedSettings, chat: Chat[]) {
  console.error("Quota exceeded! Analyzing sizes...");
  const settingsStr = JSON.stringify(settings, replacer);
  console.log("Total settings size:", settingsStr.length);
  for (const [key, value] of Object.entries(settings)) {
    const serialized = JSON.stringify(value, replacer);
    console.log(`Key: ${key}, Size: ${serialized ? serialized.length : 0}`);
  }
  const chatStr = JSON.stringify(chat, replacer);
  console.log("Total chat history size:", chatStr ? chatStr.length : 0);
}

function pruneChatHistoryToFitStorage(
  settings: PersistedSettings,
  chat: Chat[],
  originalError: Error
) {
  let prunedChat = [...chat];
  let hasNotified = false;

  while (prunedChat.length > 0) {
    if (!hasNotified) {
      toaster.create({
        title: t("Storage Limit Reached"),
        description: t("Automatically removing oldest chats to save space."),
        type: "warning",
        duration: 5000,
      });
      hasNotified = true;
    }

    let indexToRemove = prunedChat.length - 1;
    if (indexToRemove === settings.currentChat) {
      indexToRemove--;
    }

    if (indexToRemove < 0) {
      console.error("Cannot prune chat history any further.");
      throw originalError;
    }

    prunedChat.splice(indexToRemove, 1);

    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(prunedChat, replacer));
      if (indexToRemove < settings.currentChat) {
        settings.currentChat--;
        localStorage.setItem(SESSION_KEY, JSON.stringify(settings, replacer));
      }
      return;
    } catch (nextError) {
      if (isQuotaExceededError(nextError)) {
        continue;
      }
      throw nextError;
    }
  }
}

function stripStoredInputImage(content: unknown) {
  if (!content || typeof content !== "object") {
    return content;
  }

  const objectContent = content as Record<string, unknown>;
  if (
    objectContent.type !== "input_image" ||
    typeof objectContent.image_url !== "string"
  ) {
    return content;
  }

  if (
    objectContent.image_url.startsWith("data:") ||
    objectContent.image_url.length > 100000
  ) {
    const { image_url, ...rest } = objectContent;
    if (image_url.length > 100000) {
      console.warn("Image URL is too large, removing it: %s", image_url);
    }
    return rest;
  }

  return content;
}

function stripStoredToolPayload(tool: unknown) {
  if (!tool || typeof tool !== "object") {
    return tool;
  }

  const cleanTool = { ...(tool as Record<string, unknown>) };

  if (cleanTool.type === "image_generation_call" && cleanTool.result) {
    cleanTool.result = "[image data stored in OPFS]";
  } else if (
    typeof cleanTool.result === "string" &&
    cleanTool.result.length > 50000
  ) {
    cleanTool.result = "[stripped to save space]";
  }

  if ("image_b64" in cleanTool) {
    delete cleanTool.image_b64;
  }

  return cleanTool;
}

export function saveState(stateToSave: {
  current: number;
  chat: Chat[];
  currentChat: number;
  currentApp: App | null;
  currentEditor?: any;
  options: Options;
  is: {
    typeing: boolean;
    config: boolean;
    fullScreen: boolean;
    sidebar: boolean;
    toolbar: boolean;
    inputing: boolean;
    thinking: boolean;
    apps: boolean;
    tool: string;
  };
  typeingMessage: any;
  user: any;
  eventProcessor?: any;
  version: string;
  release?: any;
}) {
  const reducedState = reduceState(stateToSave);
  const { chat, ...settings } = reducedState as typeof reducedState & {
    currentChat: number;
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(settings, replacer));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }

  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chat, replacer));
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    logStorageSizes(settings, chat);
    pruneChatHistoryToFitStorage(settings, chat, error);
  }
}

export async function loadState(): Promise<GlobalState> {
  const sessionData = localStorage.getItem(SESSION_KEY);
  const chatData = localStorage.getItem(CHAT_HISTORY_KEY);

  if (!sessionData && !chatData) {
    return initState;
  }

  try {
    const parsedSession = sessionData
      ? JSON.parse(sessionData, reviver)
      : {};
    const parsedChat = chatData ? JSON.parse(chatData, reviver) : null;

    // Migration: if no dedicated chat history exists yet, move legacy chat
    // out of SESSIONS immediately instead of waiting for a later save cycle.
    if (!parsedChat && Array.isArray(parsedSession.chat)) {
      console.log("Migrating chat history from session to separate key");
      const { chat, ...sessionWithoutChat } = parsedSession;
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionWithoutChat, replacer));
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chat, replacer));
    }

    const combinedState = {
      ...parsedSession,
    };

    if (parsedChat) {
      combinedState.chat = parsedChat;
    }

    if (
      combinedState.options?.openai &&
      !combinedState.options.openai.mcpAuthConfigs
    ) {
      combinedState.options.openai.mcpAuthConfigs = new Map();
    }

    const inflated = await inflateState(combinedState);
    return inflated;
  } catch (error) {
    console.error("Error parsing state from localStorage:", error);
    throw error;
  }
}

// save state to localStorage
export function reduceState(state: GlobalState): GlobalState {
  // Remove any properties that are not needed in the localStorage state
  const cleanState = { ...state };
  delete cleanState.is;
  delete cleanState.eventProcessor;
  cleanState.chat = cleanState.chat.map((chat: Chat) => {
    const cleanChat = { ...chat };

    cleanChat.messages = cleanChat.messages.map((message: Message) => {
      const cleanMessage = { ...message };

      if (Array.isArray(cleanMessage.content)) {
        cleanMessage.content = cleanMessage.content.map((content) =>
          stripStoredInputImage(content)
        );
      }

      if (Array.isArray(cleanMessage.toolsUsed)) {
        cleanMessage.toolsUsed = cleanMessage.toolsUsed.map((tool) =>
          stripStoredToolPayload(tool)
        );
      }

      return cleanMessage;
    });

    return cleanChat;
  });
  // Remove any properties that are not needed in the options
  return cleanState;
}

export async function inflateState(state: GlobalState) {
  console.log("Inflating state: %o", state);

  let opfs = null;

  try {
    opfs = await navigator.storage.getDirectory();
  } catch (error) {
    console.error("Error getting OPFS directory: %o", error);
  }

  // Inflate the state by adding back any properties that were removed
  const inflatedState = { ...state };
  if (inflatedState.chat) {
    inflatedState.chat = await Promise.all(
      inflatedState.chat.map(async (chat: Chat) => {
        chat.messages = await Promise.all(
          chat.messages.map(async (message) => {
            // If message has images (now an object), add back the src property for each image
            if (opfs && message.images && typeof message.images === "object") {
              const updatedImages = { ...message.images };
              await Promise.all(
                Object.entries(updatedImages).map(async ([file_id, image]) => {
                  const file = await opfs.getFileHandle(image.name);
                  image.src = URL.createObjectURL(await file.getFile());
                  updatedImages[file_id] = image;
                })
              );
              message.images = updatedImages;
            }
            return message;
          })
        );
        return chat;
      })
    );
  }
  return inflatedState;
}

export const exportSettings = () => {
  console.log("Export settings");
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return;
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "settings.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importSettings = (file: File): Promise<GlobalState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      try {
        const settings = JSON.parse(data);
        localStorage.setItem(SESSION_KEY, JSON.stringify(settings));
        console.log("Settings imported successfully");
        resolve(settings);
      } catch (error) {
        console.error("Error parsing settings file:", error);
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};
