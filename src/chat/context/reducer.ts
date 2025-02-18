import { GlobalState, GlobalAction, GlobalActionType } from "./types";

// TODO: refactor this to use proper actions and types
export default function reduce(state: GlobalState, action: GlobalAction): GlobalState {
  const { type, payload = {} } = action;
  // console.log("context reducer:", state, action);
  switch (type) {
    case GlobalActionType.SET_STATE:
    case GlobalActionType.IS_CONFIG:
    case GlobalActionType.CHANGE_MESSAGE:
    case GlobalActionType.START_CHAT:
      return {
        ...state,
        ...payload,
      };

    default:
      return state;
  }
}
