import React, {
  useRef,
  useEffect,
  useReducer,
  useContext,
  createContext,
  Dispatch,
} from "react";
import action from "./action";
import reducer from "./reducer";
import { initState } from "./initState";
import { fetchAndGetUser } from "../utils";
import {
  GlobalAction,
  GlobalActions,
  GlobalState,
  GlobalActionType,
} from "./types";
import {
  loadState,
  reviver,
  saveState,
  SESSION_KEY,
  CHAT_HISTORY_KEY,
} from "../utils/settings";

export const ChatContext = createContext(null);
export const MessagesContext = createContext<Dispatch<GlobalAction>>(null);

async function getState() {
  let state = initState;

  try {
    state = await loadState();
  } catch (e) {
    console.error("error parsing state: %s", e);
  }

  return state;
}

export const ChatProvider = ({ children }) => {
  let init: GlobalState = initState;

  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY), reviver);
    const chatHistory = JSON.parse(
      localStorage.getItem(CHAT_HISTORY_KEY),
      reviver
    );
    init = { ...init, ...stored };
    if (chatHistory) {
      init.chat = chatHistory;
    }
    if (!init.options.openai.mcpAuthConfigs) {
      init.options.openai.mcpAuthConfigs = new Map();
    }
  } catch (e) {
    console.error("error parsing state: %s", e);
  }

  const [state, dispatch] = useReducer(reducer, init);
  const actionList = action(state, dispatch);
  const latestState = useRef(state);

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  useEffect(() => {
    console.log("ChatProvider: useEffect: fetching state from localStorage");
    const fetchState = async () => {
      const savedState = await getState();
      if (savedState && Array.isArray(savedState.chat)) {
        // Only merge persisted chat during async hydration. Some seeded sessions
        // only contain options, and dispatching `chat: undefined` would wipe the
        // initialized chat state and break subsequent persistence.
        dispatch({
          type: GlobalActionType.SET_STATE,
          payload: { chat: savedState.chat },
        });
      }
    };
    fetchState();
  }, []);

  // get user
  useEffect(() => {
    console.log("fetch user");
    fetchAndGetUser(
      dispatch,
      () => latestState.current.options,
      actionList.setOptions
    );
  }, []);

  useEffect(() => {
    // Persist the current reducer state directly so MCP auth/tool changes are
    // saved immediately instead of lagging one render behind the ref.
    saveState({ ...state });
  }, [state]);

  return (
    <ChatContext.Provider value={{ ...state, ...actionList }}>
      <MessagesContext.Provider value={dispatch}>
        {children}
      </MessagesContext.Provider>
    </ChatContext.Provider>
  );
};

export const useGlobal = () =>
  useContext<GlobalActions & GlobalState>(ChatContext);
export const useMessages = () => useContext(MessagesContext);
