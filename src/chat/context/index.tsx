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
  Chat,
  Message,
  App,
  Options,
} from "./types";
import { getResponse } from "../service/openai";
import {
  inflateState,
  loadState,
  reduceState,
  reviver,
  saveState,
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
    const stored = JSON.parse(localStorage.getItem("SESSIONS"), reviver);
    init = { ...init, ...stored };
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
      if (savedState) {
        dispatch({ type: GlobalActionType.SET_STATE, payload: savedState });
      }
    };
    fetchState();
  }, []);

  // get user
  useEffect(() => {
    console.log("fetch user");
    fetchAndGetUser(dispatch, state.options);
  }, []);

  useEffect(() => {
    const stateToSave = { ...latestState.current };
    saveState(stateToSave);
  }, [latestState.current]);

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
