import React, {
  useCallback,
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
import { consumeLoginRetry } from "../utils/loginRetry";
import { useDebounce } from "../hooks/useDebounce";

const DRAFT_PERSIST_DELAY_MS = 300;

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

  const [state, reducerDispatch] = useReducer(reducer, init);
  const pendingTypingOnly = useRef<boolean | null>(null);
  const dispatch = useCallback<Dispatch<GlobalAction>>((nextAction) => {
    pendingTypingOnly.current =
      (pendingTypingOnly.current ?? true) &&
      nextAction.type === GlobalActionType.CHANGE_MESSAGE;
    reducerDispatch(nextAction);
  }, []);
  const actionList = action(state, dispatch);
  const debouncedSave = useDebounce(
    (stateToSave: GlobalState) => saveState({ ...stateToSave }),
    DRAFT_PERSIST_DELAY_MS,
    true
  );
  const latestState = useRef(state);
  const latestActions = useRef(actionList);

  useEffect(() => {
    latestState.current = state;
    latestActions.current = actionList;
  }, [state]);

  useEffect(() => {
    console.log("ChatProvider: useEffect: fetching state from localStorage");
    const fetchState = async () => {
      const savedState = await getState();
      if (Array.isArray(savedState.chat)) {
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
      actionList.setOptions,
      () => {
        // Resume the request that triggered the login redirect now that the
        // session is valid again. Use the latest actions so the retry sees the
        // hydrated chat state instead of the initial render's snapshot.
        if (consumeLoginRetry()) {
          console.log("resuming interrupted message after login");
          latestActions.current.retryPendingMessage();
        }
      }
    );
  }, []);

  useEffect(() => {
    const typingOnly = pendingTypingOnly.current === true;
    pendingTypingOnly.current = null;
    if (typingOnly) {
      debouncedSave.run(state);
    } else {
      // Sending, attachment changes, and other state updates must be saved now.
      debouncedSave.cancel();
      saveState({ ...state });
    }
  }, [state, debouncedSave.run, debouncedSave.cancel]);

  useEffect(() => {
    window.addEventListener("pagehide", debouncedSave.flush);
    return () => window.removeEventListener("pagehide", debouncedSave.flush);
  }, [debouncedSave.flush]);

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
