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
  const { chat, ...settings } = reducedState;

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(settings, replacer));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }

  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chat, replacer));
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("Quota exceeded! Analyzing sizes...");
      const settingsStr = JSON.stringify(settings, replacer);
      console.log("Total settings size:", settingsStr.length);
      for (const key in settings) {
        if (Object.hasOwn(settings, key)) {
          const val = (settings as unknown as Record<string, unknown>)[key];
          const s = JSON.stringify(val, replacer);
          console.log(`Key: ${key}, Size: ${s ? s.length : 0}`);
        }
      }
      const chatStr = JSON.stringify(chat, replacer);
      console.log("Total chat history size:", chatStr ? chatStr.length : 0);

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
          throw error;
        }
        
        prunedChat.splice(indexToRemove, 1);
        try {
          localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(prunedChat, replacer));
          if (indexToRemove < settings.currentChat) {
            settings.currentChat--;
            localStorage.setItem(SESSION_KEY, JSON.stringify(settings, replacer));
          }
          break;
        } catch (e2) {
          if (e2 instanceof Error && e2.name === "QuotaExceededError") {
            continue;
          }
          throw e2;
        }
      }
    } else {
      throw error;
    }
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

    // Migration: if no new chat history, check if it exists in session
    if (!parsedChat && parsedSession.chat) {
      console.log("Migrating chat history from session to separate key");
      // We don't save here, it will be saved on next update
    }

    const combinedState = {
      ...parsedSession,
    };

    if (parsedChat) {
      combinedState.chat = parsedChat;
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

      if (cleanMessage.content && Array.isArray(cleanMessage.content)) {
        cleanMessage.content = cleanMessage.content.map((content) => {
          if (content.type === "input_image" && content.image_url) {
            // Remove data urls to save space. OPFS URLs stay.
            if (content.image_url.startsWith("data:")) {
              const rest = { ...content };
              delete rest.image_url;
              return rest;
            }
          }
          return content;
        });
      }

      if (cleanMessage.toolsUsed) {
        cleanMessage.toolsUsed = cleanMessage.toolsUsed.map((tool) => {
          const cleanTool = { ...tool };
          if (cleanTool.type === "image_generation_call" && cleanTool.result) {
            cleanTool.result = "[image data stored in OPFS]";
          } else if (cleanTool.result && typeof cleanTool.result === "string" && cleanTool.result.length > 50000) {
            cleanTool.result = "[stripped to save space]";
          }
          if (cleanTool.image_b64) {
            delete cleanTool.image_b64;
          }
          return cleanTool;
        });
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
