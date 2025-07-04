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
import { GlobalAction, GlobalActions, GlobalState, GlobalActionType, Chat, Message } from "./types";
import { getResponse } from "../service/openai";


export const ChatContext = createContext(null);
export const MessagesContext = createContext<Dispatch<GlobalAction>>(null);

// save state to localStorage
const reduceState = (state: GlobalState) => {
  // Remove any properties that are not needed in the localStorage state
  const cleanState = { ...state };
  delete cleanState.is;
  return cleanState;
};

const inflateState = async (state: GlobalState) => {
  console.log("Inflating state: %o", state);

  const opsf = await navigator.storage.getDirectory();

  // Inflate the state by adding back any properties that were removed
  const inflatedState = { ...state };
  inflatedState.chat = await Promise.all(
    inflatedState.chat.map(async (chat: Chat) => {
      chat.messages = await Promise.all(
        chat.messages.map(async (message) => {
          // If message has images (now an object), add back the src property for each image
          if (message.images && typeof message.images === "object") {
            const updatedImages = { ...message.images };
            await Promise.all(
              Object.entries(updatedImages).map(async ([file_id, image]) => {
                const file = await opsf.getFileHandle(image.name);
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
  return inflatedState;
};

async function getState() {
  let state = initState;

  try {
    state = await inflateState(JSON.parse(localStorage.getItem("SESSIONS")));
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
  }, [])




  useEffect(() => {
    const stateToSave = { ...latestState.current };
    localStorage.setItem("SESSIONS", JSON.stringify(reduceState(stateToSave)));
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


