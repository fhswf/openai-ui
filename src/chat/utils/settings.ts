import { initState } from "../context/initState";
import { App, Chat, GlobalState, Message, Options } from "../context/types";

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

  localStorage.setItem(SESSION_KEY, JSON.stringify(settings, replacer));
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chat, replacer));
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
  cleanState.chat = cleanState.chat.map((chat: Chat) => {
    chat.messages = chat.messages.map((message: Message) => {
      if (message.content && Array.isArray(message.content)) {
        message.content = message.content.map((content) => {
          if (content.type === "input_image" && content.image_url) {
            // If the content is an image, remove the image_url property
            const { image_url, ...rest } = content;
            // If the image_url is too large, remove it
            if (image_url.length > 100000) {
              console.warn(
                "Image URL is too large, removing it: %s",
                image_url
              );
              return rest;
            }
          }
          return content;
        });
      }
      return message;
    });
    return chat;
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
