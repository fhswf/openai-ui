import React, {
  useRef,
  useEffect,
  useReducer,
  useContext,
  createContext,
  Dispatch
} from "react";
import action from "./action";
import reducer from "./reducer";
import { initState } from "./initState";
import { fetchAndGetUser } from "../utils";
import { GlobalAction, GlobalActions, GlobalState, GlobalActionType } from "./types";
import { init } from "i18next";


export const ChatContext = createContext(null);
export const MessagesContext = createContext<Dispatch<GlobalAction>>(null);

function getState() {
  let state = initState;

  try {
    state = JSON.parse(localStorage.getItem("SESSIONS"));
  } catch (e) {
    console.error("error parsing state: %s", e);
  }

  return state;
}

export const ChatProvider = ({ children }) => {
  let init: GlobalState = initState;

  try {
    let stored = JSON.parse(localStorage.getItem("SESSIONS"));
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
    const savedState = getState();
    if (savedState) {
      dispatch({ type: GlobalActionType.SET_STATE, payload: savedState });
    }
  }, []);

  // get user
  useEffect(() => {
    console.log("fetch user");
    fetchAndGetUser(dispatch, state.options);
  }, [])


  useEffect(() => {
    const stateToSave = latestState.current;
    localStorage.setItem("SESSIONS", JSON.stringify(stateToSave));
  }, [latestState.current]);


  return (
    <ChatContext.Provider value={{ ...state, ...actionList }}>
      <MessagesContext.Provider value={dispatch}>
        {children}
      </MessagesContext.Provider>
    </ChatContext.Provider>
  );
};

export const useGlobal = () => useContext<GlobalActions & GlobalState>(ChatContext);
export const useMessages = () => useContext(MessagesContext);


